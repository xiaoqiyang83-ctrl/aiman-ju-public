const { submitAutoGenerateJob } = require('../queues/submit');
const { checkCredits } = require('../middleware/auth');
const { deductCredits } = require('../services/credit-service');
const projectService = require('../services/projectService');

function canEdit(role) {
  return role === 'owner' || role === 'admin';
}

async function fromTemplate(req, res) {
  try {
    const { template_id, project_name } = req.body;
    const userId = 1;
    const data = await projectService.createFromTemplate({ templateId: template_id, projectName: project_name, userId });
    res.json({ success: true, data });
  } catch (err) {
    console.error('[Projects] 从模板创建失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function list(req, res) {
  try {
    const userId = req.user?.id || 1;
    const rows = await projectService.listProjects(userId);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[Projects] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function create(req, res) {
  try {
    const { name, cover_image, description, status, team_id } = req.body;
    const userId = req.user?.id || 1;

    if (!name) {
      return res.status(400).json({ success: false, message: '请输入项目名称' });
    }

    let teamId = team_id ? Number(team_id) : null;
    if (teamId && Number.isNaN(teamId)) teamId = null;

    if (teamId) {
      const role = await projectService.getTeamRole(teamId, userId);
      if (!role) {
        return res.status(403).json({ success: false, message: '你不是该团队成员，无法关联到团队' });
      }
    }

    const row = await projectService.createProject({
      userId,
      name,
      coverImage: cover_image,
      teamId,
      description,
      status,
    });

    console.log('[Projects] 创建成功:', name);
    res.json({ success: true, data: row });
  } catch (err) {
    console.error('[Projects] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function update(req, res) {
  try {
    const { id } = req.params;
    const { name, cover_image, current_version, description, status } = req.body;
    const userId = req.user?.id || 1;

    const project = await projectService.getProjectById(id);
    if (!project) {
      return res.status(404).json({ success: false, message: '项目不存在' });
    }

    if (project.user_id !== userId) {
      const role = await projectService.getTeamRole(project.team_id, userId);
      if (!canEdit(role)) {
        return res.status(403).json({ success: false, message: '没有权限编辑该项目' });
      }
    }

    const row = await projectService.updateProject({
      id,
      name,
      coverImage: cover_image,
      currentVersion: current_version,
      description,
      status,
    });

    if (!row) {
      return res.status(404).json({ success: false, message: '项目不存在' });
    }

    res.json({ success: true, data: row });
  } catch (err) {
    console.error('[Projects] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function remove(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user?.id || 1;

    const project = await projectService.getProjectById(id);
    if (!project) {
      return res.status(404).json({ success: false, message: '项目不存在' });
    }

    if (project.user_id !== userId) {
      const role = await projectService.getTeamRole(project.team_id, userId);
      if (role !== 'owner') {
        return res.status(403).json({ success: false, message: '只有 owner 可以删除团队项目' });
      }
    }

    const deleted = await projectService.deleteProject(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: '项目不存在' });
    }

    console.log('[Projects] 删除成功:', deleted.name);
    res.json({ success: true, message: '删除成功' });
  } catch (err) {
    console.error('[Projects] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function setTeam(req, res) {
  try {
    const userId = req.user?.id || 1;
    const projectId = Number(req.params.id);
    const teamId = req.body?.team_id ? Number(req.body.team_id) : null;
    if (!projectId || Number.isNaN(projectId)) {
      return res.status(400).json({ success: false, message: '无效的项目ID' });
    }
    if (req.body?.team_id && Number.isNaN(teamId)) {
      return res.status(400).json({ success: false, message: '无效的 team_id' });
    }

    const project = await projectService.getProjectById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: '项目不存在' });
    }
    if (project.user_id !== userId) {
      return res.status(403).json({ success: false, message: '只有项目创建者可以设置团队' });
    }

    if (teamId) {
      const role = await projectService.getTeamRole(teamId, userId);
      if (!canEdit(role) && role !== 'member') {
        return res.status(403).json({ success: false, message: '你不是该团队成员' });
      }
    }

    const row = await projectService.setProjectTeam({ projectId, teamId });
    res.json({ success: true, data: row });
  } catch (err) {
    console.error('[Projects] 设置团队失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function autoGenerate(req, res) {
  try {
    const { id } = req.params;
    const userId = 1;

    const scriptId = await projectService.getLatestScriptIdForProject({ projectId: id, userId });
    if (!scriptId) {
      return res.status(400).json({ success: false, message: '该项目尚未上传剧本，无法一键成片' });
    }

    await deductCredits(userId, 'auto_generate', `一键成片: 项目 #${id}`);
    const jobId = await submitAutoGenerateJob(id, { scriptId }, userId);

    res.json({ success: true, message: '一键成片任务已启动', data: { job_id: jobId } });
  } catch (err) {
    console.error('[Projects] 一键成片失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  fromTemplate,
  list,
  create,
  update,
  remove,
  setTeam,
  autoGenerate: [checkCredits('auto_generate'), autoGenerate],
};

