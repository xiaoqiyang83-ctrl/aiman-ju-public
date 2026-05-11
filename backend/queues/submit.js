/**
 * 任务提交辅助函数
 * 封装任务提交逻辑，更新数据库状态
 * 
 * 实际表结构参考：
 * scene_audio: id, scene_id, user_id, script_id, audio_type, file_url, duration, text_content, voice_name, volume, status, created_at, job_id
 * exports: id, project_id, user_id, format, status, file_url, file_size, duration, progress, error_message, export_range, created_at, updated_at, job_id
 * shots: id, scene_id, script_id, user_id, shot_number, shot_type, camera_movement, visual_description, dialogue, action_description, duration, characters, video_url, video_status, video_prompt, video_type, reference_image_url, reference_video_url, status, created_at, job_id
 * characters: id, script_id, user_id, name, description, created_at, gender, age, occupation, appearance, costume, personality, image_url, image_prompt, job_id, image_status
 */
const { queues } = require('./index');
const { pool } = require('../config/database');
const crypto = require('crypto');

// Mock模式配置
const MOCK_MODE = process.env.MOCK_MODE !== 'false';

/**
 * 生成唯一job_id
 */
function generateJobId(prefix = 'job') {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
}

/**
 * 提交视频生成任务
 * @param {number} shotId - 分镜ID
 * @param {string} type - 任务类型: text2video, image2video, reference2video
 * @param {object} params - 生成参数
 * @param {number} userId - 用户ID
 * @returns {Promise<string>} - 返回jobId
 */
async function submitVideoJob(shotId, type, params, userId) {
  // 1. 更新shots表状态为processing
  await pool.query(
    `UPDATE shots SET video_status = 'processing' WHERE id = $1`,
    [shotId]
  );
  
  // 2. 创建task_jobs记录
  const jobId = generateJobId('video');
  await pool.query(
    `INSERT INTO task_jobs 
      (job_id, queue_name, task_type, ref_id, ref_type, project_id,user_id,status, progress, params)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8,$9, $10)`,
    [
      jobId,
      'videoQueue',
      type,
      shotId,
      'shot',
      params.projectId || null,
      userId,
      'pending',
      0,
      JSON.stringify(params)
    ]
  );
  
  // 3. 提交到videoQueue
  await queues.videoQueue.add(
    `video_${type}_${shotId}`,
    {
      jobId,
      shotId,
      type,
      params,
      userId,
      mockMode: MOCK_MODE
    },
    { jobId }
  );
  
  // 4. 更新shots表的job_id
  await pool.query(
    `UPDATE shots SET job_id = $1 WHERE id = $2`,
    [jobId, shotId]
  );
  
  console.log(`[submitVideoJob] shotId: ${shotId}, type: ${type}, jobId: ${jobId}`);
  return jobId;
}

/**
 * 提交音频生成任务
 * @param {number} sceneId - 场景ID
 * @param {string} type - 任务类型: tts, bgm, sfx
 * @param {object} params - 生成参数 { text, voice_id, voice_name, volume, scriptId, preset_id }
 * @param {number} userId - 用户ID
 * @returns {Promise<string>} - 返回jobId
 */
async function submitAudioJob(sceneId, type, params, userId) {
  // 1. 创建scene_audio记录（状态pending，等Worker完成后更新）
  const audioRecord = await pool.query(
    `INSERT INTO scene_audio 
      (scene_id, user_id, script_id, audio_type, file_url, duration, text_content, voice_name, volume, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING id`,
    [
      sceneId,
      userId,
      params.scriptId || null,
      type,
      '',
      0,
      params.text || '',
      params.voice_name || '',
      params.volume || 1.0,
      'pending'
    ]
  );
  
  const audioId = audioRecord.rows[0].id;
  
  // 2. 创建task_jobs记录
  const jobId = generateJobId('audio');
  await pool.query(
    `INSERT INTO task_jobs 
      (job_id, queue_name, task_type, ref_id, ref_type, project_id, status, progress, params)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      jobId,
      'audioQueue',
      type,
      audioId,
      'scene_audio',
      params.projectId || null,
      'pending',
      0,
      JSON.stringify(params)
    ]
  );
  
  // 3. 更新scene_audio的job_id
  await pool.query(
    `UPDATE scene_audio SET job_id = $1 WHERE id = $2`,
    [jobId, audioId]
  );
  
  // 4. 提交到audioQueue
  await queues.audioQueue.add(
    `audio_${type}_${audioId}`,
    {
      jobId,
      audioId,
      sceneId,
      type,
      params,
      userId,
      mockMode: MOCK_MODE
    },
    { jobId }
  );
  
  console.log(`[submitAudioJob] sceneId: ${sceneId}, type: ${type}, jobId: ${jobId}`);
  return jobId;
}

/**
 * 提交导出任务
 * @param {number} projectId - 项目ID
 * @param {object} params - 导出参数 { format, quality|resolution, include_voice, include_bgm, exportRange, sceneIds, config }
 * @param {number} userId - 用户ID
 * @returns {Promise<{jobId: string, exportId: number}>}
 */
async function submitExportJob(projectId, params, userId) {
  const config = params?.config || {
    resolution: params?.resolution || params?.quality || '1080p',
    format: params?.format || 'mp4',
    include_voice: params?.include_voice !== false,
    include_bgm: params?.include_bgm !== false
  };

  // 1. 创建exports记录
  const exportRecord = await pool.query(
    `INSERT INTO exports 
      (project_id, user_id, format, status, progress, export_range, config)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id`,
    [
      projectId,
      userId,
      config.format || 'mp4',
      'pending',
      0,
      params.exportRange || 'all',
      JSON.stringify(config)
    ]
  );
  
  const exportId = exportRecord.rows[0].id;
  
  // 2. 创建task_jobs记录
  const jobId = generateJobId('export');
  await pool.query(
    `INSERT INTO task_jobs 
      (job_id, queue_name, task_type, ref_id, ref_type, project_id, status, progress, params)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      jobId,
      'exportQueue',
      'export_mp4',
      exportId,
      'export',
      projectId,
      'pending',
      0,
      JSON.stringify({ ...params, config })
    ]
  );
  
  // 3. 更新exports的job_id
  await pool.query(
    `UPDATE exports SET job_id = $1 WHERE id = $2`,
    [jobId, exportId]
  );
  
  // 4. 提交到exportQueue
  await queues.exportQueue.add(
    `export_${projectId}_${exportId}`,
    {
      jobId,
      exportId,
      projectId,
      type: 'export_mp4',
      params,
      userId,
      mockMode: MOCK_MODE
    },
    { jobId }
  );
  
  console.log(`[submitExportJob] projectId: ${projectId}, exportId: ${exportId}, jobId: ${jobId}`);
  return { jobId, exportId };
}

/**
 * 提交图片生成任务
 * @param {string} type - 任务类型: character_image, shot_image
 * @param {object} params - 生成参数 { characterId, prompt, projectId }
 * @param {number} userId - 用户ID
 * @returns {Promise<string>} - 返回jobId
 */
async function submitImageJob(type, params, userId) {
  // 1. 创建task_jobs记录
  const jobId = generateJobId('image');
  await pool.query(
    `INSERT INTO task_jobs 
      (job_id, queue_name, task_type, ref_id, ref_type, project_id, status, progress, params)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      jobId,
      'imageQueue',
      type,
      params.refId || null,
      type === 'character_image' ? 'character' : 'shot',
      params.projectId || null,
      'pending',
      0,
      JSON.stringify(params)
    ]
  );
  
  // 2. 提交到imageQueue
  await queues.imageQueue.add(
    `image_${type}_${params.refId || Date.now()}`,
    {
      jobId,
      type,
      params,
      userId,
      mockMode: MOCK_MODE
    },
    { jobId }
  );
  
  // 3. 如果是角色图，更新characters表
  if (type === 'character_image' && params.characterId) {
    await pool.query(
      `UPDATE characters SET image_status = 'processing', job_id = $1 WHERE id = $2`,
      [jobId, params.characterId]
    );
  }
  
  console.log(`[submitImageJob] type: ${type}, jobId: ${jobId}`);
  return jobId;
}

/**
 * 更新任务状态
 */
async function updateTaskStatus(jobId, status, progress, result, errorMessage) {
  await pool.query(
    `UPDATE task_jobs SET 
      status = $2,
      progress = $3,
      result = $4,
      error_message = $5,
      updated_at = CURRENT_TIMESTAMP
    WHERE job_id = $1`,
    [jobId, status, progress, result ? JSON.stringify(result) : null, errorMessage || null]
  );
}

/**
 * 提交一键成片任务
 * @param {number} projectId - 项目ID
 * @param {object} params - 参数 { scriptId, options }
 * @param {number} userId - 用户ID
 * @returns {Promise<string>} - 返回jobId
 */
async function submitAutoGenerateJob(projectId, params, userId) {
  // 1. 创建主任务记录
  const jobId = generateJobId('auto');
  await pool.query(
    `INSERT INTO task_jobs 
      (job_id, queue_name, task_type, ref_id, ref_type, project_id, user_id,status, progress, params)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      jobId,
      'autoGenerateQueue',
      'auto_generate',
      projectId,
      'project',
      projectId,
      userId,
      'pending',
      0,
      JSON.stringify(params)
    ]
  );

  // 2. 提交到autoGenerateQueue
  await queues.autoGenerateQueue.add(
    `auto_gen_${projectId}`,
    {
      jobId,
      projectId,
      params,
      userId,
      mockMode: MOCK_MODE
    },
    { jobId }
  );

  console.log(`[submitAutoGenerateJob] projectId: ${projectId}, jobId: ${jobId}`);
  return jobId;
}

/**
 * 提交口型同步任务
 */
async function submitLipSyncJob(shotId, params, userId) {
  const jobId = generateJobId('lipsync');
  
  await pool.query(
    `UPDATE shots SET lip_sync_status = 'processing', job_id = $1 WHERE id = $2`,
    [jobId, shotId]
  );

  await queues.lipSyncQueue.add(
    `lipsync_${shotId}`,
    {
      jobId,
      shotId,
      params,
      userId,
      mockMode: MOCK_MODE
    },
    { jobId }
  );

  return jobId;
}

/**
 * 获取任务状态
 */
async function getTaskStatus(jobId) {
  const result = await pool.query(
    `SELECT * FROM task_jobs WHERE job_id = $1`,
    [jobId]
  );
  return result.rows[0] || null;
}

module.exports = {
  submitVideoJob,
  submitAudioJob,
  submitExportJob,
  submitImageJob,
  submitAutoGenerateJob,
  submitLipSyncJob,
  updateTaskStatus,
  getTaskStatus,
  MOCK_MODE
};
