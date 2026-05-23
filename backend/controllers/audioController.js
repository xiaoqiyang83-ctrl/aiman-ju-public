const { checkCredits } = require('../middleware/auth');
const { deductCredits } = require('../services/credit-service');
const audioService = require('../services/audioService');

const userId = 1;

async function library(req, res) {
  try {
    const { project_id } = req.query;
    const rows = await audioService.listLibrary({ userId, projectId: project_id });
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[Audio] 获取音频库失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function upload(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '请选择音频文件' });
    }

    const { project_id, audio_type } = req.body;
    const row = await audioService.createAudioAsset({
      userId,
      projectId: project_id,
      originalname: req.file.originalname,
      filename: req.file.filename,
      audioType: audio_type,
    });

    res.json({ success: true, data: row });
  } catch (err) {
    console.error('[Audio] 上传音频失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function remove(req, res) {
  try {
    const { id } = req.params;

    const asset = await audioService.getAudioAsset({ id, userId });
    if (!asset) {
      return res.status(404).json({ success: false, message: '音频不存在' });
    }

    await audioService.deleteAudioAsset({ id });
    audioService.deleteLocalFileByPublicPath(asset.file_path);

    res.json({ success: true, message: '删除成功' });
  } catch (err) {
    console.error('[Audio] 删除音频失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function voices(req, res) {
  try {
    const rows = await audioService.listVoices();
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[Audio] 操作失败:', err);
    res.json({
      success: true,
      data: [
        { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓', language: '中文', gender: 'female' },
        { id: 'zh-CN-YunxiNeural', name: '云希', language: '中文', gender: 'male' },
      ],
    });
  }
}

async function bgmPresets(req, res) {
  try {
    const rows = await audioService.listBgmPresets();
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[Audio] 操作失败:', err);
    res.json({ success: true, data: [] });
  }
}

async function sfxPresets(req, res) {
  try {
    const rows = await audioService.listSfxPresets();
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[Audio] 操作失败:', err);
    res.json({ success: true, data: [] });
  }
}

async function applyBgm(req, res) {
  try {
    const { scene_id, bgm_id, volume } = req.body;
    if (!scene_id) {
      return res.status(400).json({ success: false, message: '缺少 scene_id' });
    }
    const meta = await audioService.getSceneMeta(scene_id);
    if (!meta) {
      return res.status(404).json({ success: false, message: '场景不存在' });
    }

    await audioService.insertSceneAudio({
      sceneId: scene_id,
      userId: meta.user_id,
      scriptId: meta.script_id,
      audioType: 'bgm',
      textContent: bgm_id,
      volume: volume ?? 0.7,
    });

    res.json({ success: true, message: 'BGM应用成功' });
  } catch (err) {
    console.error('[Audio] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function applySfx(req, res) {
  try {
    const { scene_id, sfx_id, volume } = req.body;
    if (!scene_id) {
      return res.status(400).json({ success: false, message: '缺少 scene_id' });
    }
    const meta = await audioService.getSceneMeta(scene_id);
    if (!meta) {
      return res.status(404).json({ success: false, message: '场景不存在' });
    }

    await audioService.insertSceneAudio({
      sceneId: scene_id,
      userId: meta.user_id,
      scriptId: meta.script_id,
      audioType: 'sfx',
      textContent: sfx_id,
      volume: volume ?? 0.8,
    });

    res.json({ success: true, message: '音效应用成功' });
  } catch (err) {
    console.error('[Audio] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function generateVoice(req, res) {
  try {
    const { shot_id, text } = req.body;

    await deductCredits(userId, 'tts_generation', `生成配音: ${String(text || '').substring(0, 10)}...`);
    res.json({ success: true, message: '配音生成中', data: { shot_id } });
  } catch (err) {
    console.error('[Audio] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  library,
  upload,
  remove,
  voices,
  bgmPresets,
  sfxPresets,
  applyBgm,
  applySfx,
  generateVoice: [checkCredits('tts_generation'), generateVoice],
};

