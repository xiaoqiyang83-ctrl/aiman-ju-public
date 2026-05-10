const express = require('express');
const router = express.Router();
const { pool } = require('../shared');

function getUserId(req) {
  return req.user?.id || 1;
}

async function getTeamRole(teamId, userId) {
  const res = await pool.query(
    'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
    [teamId, userId]
  );
  return res.rows[0]?.role || null;
}

function canEdit(role) {
  return role === 'owner' || role === 'admin';
}

router.post('/', async (req, res) => {
  const userId = getUserId(req);
  const client = await pool.connect();
  try {
    const { name } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: '请输入团队名称' });
    }

    await client.query('BEGIN');
    const teamRes = await client.query(
      'INSERT INTO teams (name, owner_id) VALUES ($1, $2) RETURNING *',
      [String(name).trim(), userId]
    );
    const team = teamRes.rows[0];

    await client.query(
      'INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT (team_id, user_id) DO NOTHING',
      [team.id, userId, 'owner']
    );

    await client.query('COMMIT');
    res.json({ success: true, data: team });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Teams] 创建失败:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});

router.get('/', async (req, res) => {
  const userId = getUserId(req);
  try {
    const teamsRes = await pool.query(
      `SELECT t.*, tm.role AS my_role
       FROM teams t
       JOIN team_members tm ON tm.team_id = t.id
       WHERE tm.user_id = $1
       ORDER BY t.created_at DESC`,
      [userId]
    );

    const teams = teamsRes.rows;
    const teamIds = teams.map(t => t.id);
    let membersByTeam = {};
    if (teamIds.length) {
      const membersRes = await pool.query(
        `SELECT tm.team_id, tm.user_id, tm.role, tm.joined_at, u.username
         FROM team_members tm
         JOIN users u ON u.id = tm.user_id
         WHERE tm.team_id = ANY($1::int[])
         ORDER BY tm.role ASC, tm.joined_at ASC`,
        [teamIds]
      );
      membersByTeam = membersRes.rows.reduce((acc, row) => {
        if (!acc[row.team_id]) acc[row.team_id] = [];
        acc[row.team_id].push(row);
        return acc;
      }, {});
    }

    const data = teams.map(t => ({
      ...t,
      members: membersByTeam[t.id] || []
    }));

    res.json({ success: true, data });
  } catch (err) {
    console.error('[Teams] 查询失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/:id/members', async (req, res) => {
  const userId = getUserId(req);
  const teamId = Number(req.params.id);
  try {
    if (!teamId || Number.isNaN(teamId)) {
      return res.status(400).json({ success: false, message: '无效的团队ID' });
    }

    const role = (req.body?.role || 'member').toLowerCase();
    if (!['admin', 'member'].includes(role)) {
      return res.status(400).json({ success: false, message: '无效的角色' });
    }

    const myRole = await getTeamRole(teamId, userId);
    if (!canEdit(myRole)) {
      return res.status(403).json({ success: false, message: '没有权限邀请成员' });
    }

    let targetUserId = req.body?.user_id ? Number(req.body.user_id) : null;
    if (!targetUserId && req.body?.username) {
      const uRes = await pool.query('SELECT id FROM users WHERE username = $1', [String(req.body.username)]);
      targetUserId = uRes.rows[0]?.id || null;
    }
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: '请提供 user_id 或 username' });
    }

    const existsRes = await pool.query('SELECT id FROM users WHERE id = $1', [targetUserId]);
    if (!existsRes.rows.length) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    await pool.query(
      `INSERT INTO team_members (team_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (team_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
      [teamId, targetUserId, role]
    );

    res.json({ success: true, message: '成员已添加/更新' });
  } catch (err) {
    console.error('[Teams] 邀请失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id/members/:uid', async (req, res) => {
  const userId = getUserId(req);
  const teamId = Number(req.params.id);
  const targetUserId = Number(req.params.uid);
  try {
    if (!teamId || Number.isNaN(teamId) || !targetUserId || Number.isNaN(targetUserId)) {
      return res.status(400).json({ success: false, message: '无效参数' });
    }

    const myRole = await getTeamRole(teamId, userId);
    if (!canEdit(myRole)) {
      return res.status(403).json({ success: false, message: '没有权限修改成员角色' });
    }

    const newRole = String(req.body?.role || '').toLowerCase();
    if (!['admin', 'member'].includes(newRole)) {
      return res.status(400).json({ success: false, message: '无效的角色' });
    }

    const targetRole = await getTeamRole(teamId, targetUserId);
    if (!targetRole) {
      return res.status(404).json({ success: false, message: '成员不存在' });
    }
    if (targetRole === 'owner') {
      return res.status(403).json({ success: false, message: '不能修改 owner 角色' });
    }
    if (myRole === 'admin' && targetRole === 'admin' && targetUserId !== userId) {
      return res.status(403).json({ success: false, message: 'admin 不能修改其他 admin' });
    }

    await pool.query(
      'UPDATE team_members SET role = $1 WHERE team_id = $2 AND user_id = $3',
      [newRole, teamId, targetUserId]
    );

    res.json({ success: true, message: '角色已更新' });
  } catch (err) {
    console.error('[Teams] 更新失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

