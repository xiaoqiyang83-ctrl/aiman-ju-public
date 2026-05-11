const { submitVideoJob, submitExportJob } = require('../queues/submit');
const { checkCredits } = require('../middleware/auth');
const { deductCredits } = require('../services/credit-service');
const videoService = require('../services/videoService');

const userId = 1;

function parseId(val) {
  const n = parseInt(val, 10);
  if (!n || Number.isNaN(n)) return null;
  return n;
}

async function text2video(req, res) {
  try {
    const shotId = parseId(req.params.shotId);
    if (!shotId) return res.status(400).json({ success: false, message: '无效的镜头ID' });

    const row = await videoService.getShotProjectScript(shotId);
    if (!row) return res.status(404).json({ success: false, message: '镜头不存在' });

    const params = { ...req.body, projectId: row.project_id, scriptId: row.script_id };
    await deductCredits(userId, 'video_generation', `生成镜头视频 #${shotId}`);

    const jobId = await submitVideoJob(shotId, 'text2video', params, userId);
    res.json({ success: true, message: '视频生成任务已提交', data: { job_id: jobId } });
  } catch (err) {
    console.error('[Videos] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function image2video(req, res) {
  try {
    const shotId = parseId(req.params.shotId);
    if (!shotId) return res.status(400).json({ success: false, message: '无效的镜头ID' });

    const row = await videoService.getShotProjectScript(shotId);
    if (!row) return res.status(404).json({ success: false, message: '镜头不存在' });

    const params = { ...req.body, projectId: row.project_id, scriptId: row.script_id };
    if (req.body.scene_image_url) params.scene_image_url = req.body.scene_image_url;

    await deductCredits(userId, 'video_generation', `图生视频 #${shotId}`);
    const jobId = await submitVideoJob(shotId, 'image2video', params, userId);
    res.json({ success: true, message: '任务已提交', data: { job_id: jobId } });
  } catch (err) {
    console.error('[Videos] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function reference2video(req, res) {
  try {
    const shotId = parseId(req.params.shotId);
    if (!shotId) return res.status(400).json({ success: false, message: '无效的镜头ID' });

    const row = await videoService.getShotProjectScript(shotId);
    if (!row) return res.status(404).json({ success: false, message: '镜头不存在' });

    const params = { ...req.body, projectId: row.project_id, scriptId: row.script_id };

    if (params.character_id) {
      const ch = await videoService.getCharacterReference(params.character_id);
      if (ch) params.reference_image = ch.reference_image || ch.image_url;
    }

    await deductCredits(userId, 'video_generation', `参考生视频 #${shotId}`);
    const jobId = await submitVideoJob(shotId, 'reference2video', params, userId);
    res.json({ success: true, message: '任务已提交', data: { job_id: jobId } });
  } catch (err) {
    console.error('[Videos] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function regenerate(req, res) {
  try {
    const shotId = parseId(req.params.shotId);
    if (!shotId) return res.status(400).json({ success: false, message: '无效的镜头ID' });

    const shot = await videoService.getShotDetailWithProject(shotId);
    if (!shot) return res.status(404).json({ success: false, message: '镜头不存在' });

    const params = {
      ...req.body,
      projectId: shot.project_id,
      scriptId: shot.script_id,
      visual_description: shot.visual_description,
      shot_type: shot.shot_type,
      camera_movement: shot.camera_movement,
    };

    const jobId = await submitVideoJob(shotId, 'text2video', params, userId);
    res.json({ success: true, message: '重新生成任务已提交', data: { job_id: jobId } });
  } catch (err) {
    console.error('[Videos] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function merge(req, res) {
  try {
    const project_id = req.body.project_id;
    if (!project_id) return res.status(400).json({ success: false, message: '缺少 project_id' });

    const { jobId, exportId } = await submitExportJob(project_id, req.body, userId);
    res.json({ success: true, message: '拼接任务已提交', data: { job_id: jobId, export_id: exportId } });
  } catch (err) {
    console.error('[Videos] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function list(req, res) {
  try {
    const { project_id } = req.query;
    const rows = await videoService.listVideos({ projectId: project_id });
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[Videos] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getById(req, res) {
  try {
    const row = await videoService.getVideoById(req.params.video_id);
    res.json({ success: true, data: row });
  } catch (err) {
    console.error('[Videos] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function generate(req, res) {
  try {
    const { project_id, quality } = req.body;
    const row = await videoService.createVideo({ projectId: project_id, quality });
    res.json({ success: true, message: '开始生成视频', data: row });
  } catch (err) {
    console.error('[Videos] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function status(req, res) {
  try {
    const row = await videoService.getVideoStatus(req.params.video_id);
    res.json({ success: true, data: row });
  } catch (err) {
    console.error('[Videos] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function remove(req, res) {
  try {
    await videoService.deleteVideo(req.params.video_id);
    res.json({ success: true, message: '删除成功' });
  } catch (err) {
    console.error('[Videos] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  text2video: [checkCredits('video_generation'), text2video],
  image2video: [checkCredits('video_generation'), image2video],
  reference2video: [checkCredits('video_generation'), reference2video],
  regenerate,
  merge,
  list,
  getById,
  generate,
  status,
  remove,
};

