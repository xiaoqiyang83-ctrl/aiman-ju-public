const { submitLipSyncJob } = require('../queues/submit');
const shotService = require('../services/shotService');

const userId = 1;

async function list(req, res) {
  try {
    const { scene_id } = req.query;
    const rows = await shotService.listShots({ sceneId: scene_id });
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[Shots] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function get(req, res) {
  try {
    const row = await shotService.getShotById(req.params.id);
    res.json({ success: true, data: row });
  } catch (err) {
    console.error('[Shots] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function create(req, res) {
  try {
    const {
      scene_id,
      shot_number,
      shot_type,
      camera_movement,
      visual_description,
      visual_prompt,
      original_text,
      duration,
      character_id,
      scene_image_url,
      character_angle,
    } = req.body;

    if (!scene_id) {
      return res.status(400).json({ success: false, message: '缺少 scene_id' });
    }

    const row = await shotService.createShot({
      sceneId: scene_id,
      shotNumber: shot_number,
      shotType: shot_type,
      cameraMovement: camera_movement,
      visualDescription: visual_description,
      visualPrompt: visual_prompt,
      originalText: original_text,
      duration,
      characterId: character_id,
      sceneImageUrl: scene_image_url,
      characterAngle: character_angle,
    });

    if (!row) {
      return res.status(404).json({ success: false, message: '场景不存在' });
    }

    res.json({ success: true, data: row });
  } catch (err) {
    console.error('[Shots] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function update(req, res) {
  try {
    const {
      shot_number,
      shot_type,
      camera_movement,
      visual_description,
      visual_prompt,
      original_text,
      dialogue,
      action_description,
      duration,
      character_id,
      scene_image_url,
      character_angle,
    } = req.body;

    const row = await shotService.updateShot({
      id: req.params.id,
      shotNumber: shot_number,
      shotType: shot_type,
      cameraMovement: camera_movement,
      visualDescription: visual_description,
      visualPrompt: visual_prompt,
      originalText: original_text,
      dialogue,
      actionDescription: action_description,
      duration,
      characterId: character_id,
      sceneImageUrl: scene_image_url,
      characterAngle: character_angle,
    });

    if (!row) {
      return res.status(404).json({ success: false, message: '镜头不存在' });
    }

    res.json({ success: true, data: row });
  } catch (err) {
    console.error('[Shots] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function remove(req, res) {
  try {
    await shotService.deleteShot(req.params.id);
    res.json({ success: true, message: '删除成功' });
  } catch (err) {
    console.error('[Shots] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function lipSync(req, res) {
  try {
    const { id } = req.params;

    const shot = await shotService.getShotVideoAudio(id);
    if (!shot) {
      return res.status(404).json({ success: false, message: '镜头不存在' });
    }

    if (!shot.video_url || !shot.audio_url) {
      return res.status(400).json({
        success: false,
        message: '口型同步需要同时具备视频和配音音频，请先生成视频和配音',
      });
    }

    const jobId = await submitLipSyncJob(
      id,
      {
        video_url: shot.video_url,
        audio_url: shot.audio_url,
      },
      userId
    );

    res.json({ success: true, message: '口型同步任务已提交', data: { job_id: jobId } });
  } catch (err) {
    console.error('[Shots] 口型同步失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  list,
  get,
  create,
  update,
  remove,
  lipSync,
};
