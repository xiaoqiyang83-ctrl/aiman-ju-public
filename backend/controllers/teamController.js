const teamService = require('../services/teamService');

function getUserId(req) {
  return req.user?.id || 1;
}

function canEdit(role) {
  return role === 'owner' || role === 'admin';
}

async function create(req, res) {
  const userId = getUserId(req);
  try {
    const { name } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: '请输入团队名称' });
    }

    const team = await teamService.createTeam({ name, userId });
    res.json({ success: true, data: team });
  } catch (err) {
    console.error('[Teams] 创建失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function list(req, res) {
  const userId = getUserId(req);
  try {
    const data = await teamService.listTeamsWithMembers({ userId });
    res.json({ success: true, data });
  } catch (err) {
    console.error('[Teams] 查询失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function addMember(req, res) {
  const operatorUserId = getUserId(req);
  const teamId = Number(req.params.id);
  try {
    if (!teamId || Number.isNaN(teamId)) {
      return res.status(400).json({ success: false, message: '无效的团队ID' });
    }

    const role = String(req.body?.role || 'member').toLowerCase();
    if (!['admin', 'member'].includes(role)) {
      return res.status(400).json({ success: false, message: '无效的角色' });
    }

    const myRole = await teamService.getTeamRole({ teamId, userId: operatorUserId });
    if (!canEdit(myRole)) {
      return res.status(403).json({ success: false, message: '没有权限邀请成员' });
    }

    let targetUserId = req.body?.user_id ? Number(req.body.user_id) : null;
    if (!targetUserId && req.body?.username) {
      targetUserId = await teamService.getUserIdByUsername(req.body.username);
    }
    if (!targetUserId || Number.isNaN(targetUserId)) {
      return res.status(400).json({ success: false, message: '请提供 user_id 或 username' });
    }

    const exists = await teamService.userExists(targetUserId);
    if (!exists) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    await teamService.upsertTeamMember({ teamId, userId: targetUserId, role });
    res.json({ success: true, message: '成员已添加/更新' });
  } catch (err) {
    console.error('[Teams] 邀请失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function updateMemberRole(req, res) {
  const operatorUserId = getUserId(req);
  const teamId = Number(req.params.id);
  const targetUserId = Number(req.params.uid);
  try {
    if (!teamId || Number.isNaN(teamId) || !targetUserId || Number.isNaN(targetUserId)) {
      return res.status(400).json({ success: false, message: '无效参数' });
    }

    const myRole = await teamService.getTeamRole({ teamId, userId: operatorUserId });
    if (!canEdit(myRole)) {
      return res.status(403).json({ success: false, message: '没有权限修改成员角色' });
    }

    const newRole = String(req.body?.role || '').toLowerCase();
    if (!['admin', 'member'].includes(newRole)) {
      return res.status(400).json({ success: false, message: '无效的角色' });
    }

    const targetRole = await teamService.getTeamRole({ teamId, userId: targetUserId });
    if (!targetRole) {
      return res.status(404).json({ success: false, message: '成员不存在' });
    }
    if (targetRole === 'owner') {
      return res.status(403).json({ success: false, message: '不能修改 owner 角色' });
    }
    if (myRole === 'admin' && targetRole === 'admin' && targetUserId !== operatorUserId) {
      return res.status(403).json({ success: false, message: 'admin 不能修改其他 admin' });
    }

    await teamService.updateTeamMemberRole({ teamId, userId: targetUserId, role: newRole });
    res.json({ success: true, message: '角色已更新' });
  } catch (err) {
    console.error('[Teams] 更新失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  create,
  list,
  addMember,
  updateMemberRole,
};
