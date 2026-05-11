/**
 * videoGenerateController.js - CogVideoX视频生成控制器
 * 提供异步任务轮询的API接口
 */

const videoGenerateService = require('../services/video-generate-service');

/**
 * POST /api/videos/generate
 * 通用视频生成接口
 */
async function generate(req, res) {
  try {
    const { prompt, imageUrl, model, size, fps, withAudio, quality } = req.body;

    if (!prompt) {
      return res.status(400).json({ success: false, message: '缺少视频描述(prompt)' });
    }

    const { taskId } = await videoGenerateService.generateVideo({
      prompt,
      imageUrl,
      model,
      size,
      fps,
      withAudio,
      quality
    });

    res.json({
      success: true,
      taskId: taskId,
      message: '视频生成任务已提交'
    });
  } catch (error) {
    console.error('[VideoGenerate] 生成失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * POST /api/videos/generate-shot/:shotId
 * 生成分镜视频
 */
async function generateShot(req, res) {
  try {
    const shotId = parseInt(req.params.shotId);
    if (!shotId || Number.isNaN(shotId)) {
      return res.status(400).json({ success: false, message: '无效的镜头ID' });
    }

    const { model, withAudio } = req.body;

    const { taskId } = await videoGenerateService.generateShotVideo(shotId, {
      model,
      withAudio
    });

    res.json({
      success: true,
      taskId: taskId,
      shotId: shotId,
      message: '视频生成任务已提交'
    });
  } catch (error) {
    console.error('[VideoGenerate] 生成分镜视频失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * GET /api/videos/task/:taskId
 * 查询任务状态
 */
async function getTaskStatus(req, res) {
  try {
    const { taskId } = req.params;

    if (!taskId) {
      return res.status(400).json({ success: false, message: '缺少taskId' });
    }

    const result = await videoGenerateService.getVideoTaskStatus(taskId);

    // 如果任务完成，自动下载视频
    if (result.status === 'completed' && result.videoUrl) {
      // 需要知道shotId才能更新数据库
      // 从job_id字段查询
      const { pool } = require('../config/database');
      const shotResult = await pool.query(
        'SELECT id, job_id FROM shots WHERE job_id = $1',
        [taskId]
      );

      if (shotResult.rows.length > 0) {
        const shotId = shotResult.rows[0].id;
        try {
          await videoGenerateService.downloadAndUpdateShot(
            taskId,
            shotId,
            result.videoUrl,
            result.coverImageUrl
          );
          result.shotId = shotId;
          result.videoUrl = undefined; // 返回相对路径而不是远程URL
          // 重新查询获取本地路径
          const updatedShot = await pool.query(
            'SELECT video_url FROM shots WHERE id = $1',
            [shotId]
          );
          result.localVideoPath = updatedShot.rows[0]?.video_url;
        } catch (downloadError) {
          console.error('[VideoGenerate] 下载视频失败:', downloadError);
          result.downloadError = downloadError.message;
        }
      }
    }

    res.json({
      success: true,
      taskId: taskId,
      status: result.status,
      ...result
    });
  } catch (error) {
    console.error('[VideoGenerate] 查询任务状态失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * POST /api/videos/batch-generate
 * 批量生视频
 */
async function batchGenerate(req, res) {
  try {
    const { shotIds, model, withAudio } = req.body;

    if (!shotIds || !Array.isArray(shotIds) || shotIds.length === 0) {
      return res.status(400).json({ success: false, message: '缺少shotIds数组' });
    }

    const results = [];
    const errors = [];

    for (const shotId of shotIds) {
      try {
        const { taskId } = await videoGenerateService.generateShotVideo(shotId, {
          model,
          withAudio
        });
        results.push({ shotId, taskId, success: true });
      } catch (error) {
        errors.push({ shotId, error: error.message, success: false });
      }
    }

    res.json({
      success: true,
      message: `已提交 ${results.length} 个视频生成任务`,
      submitted: results,
      failed: errors,
      totalSubmitted: results.length,
      totalFailed: errors.length
    });
  } catch (error) {
    console.error('[VideoGenerate] 批量生成失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * GET /api/videos/models
 * 获取支持的模型列表
 */
async function getModels(req, res) {
  try {
    const models = videoGenerateService.getSupportedModels();
    res.json({
      success: true,
      models: models,
      defaultModel: videoGenerateService.DEFAULT_MODEL
    });
  } catch (error) {
    console.error('[VideoGenerate] 获取模型列表失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * GET /api/videos/test
 * 测试API连接
 */
async function test(req, res) {
  try {
    const result = await videoGenerateService.testConnection();
    res.json({
      success: result.success,
      message: result.success ? 'API连接正常' : 'API连接失败',
      taskId: result.taskId,
      error: result.error
    });
  } catch (error) {
    console.error('[VideoGenerate] 测试连接失败:', error);
    res.json({
      success: false,
      message: '测试失败',
      error: error.message
    });
  }
}

module.exports = {
  generate,
  generateShot,
  getTaskStatus,
  batchGenerate,
  getModels,
  test
};
