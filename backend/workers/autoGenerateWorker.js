/**
 * 一键成片 Worker
 * 编排整个制作流程：解析剧本 -> 生成分镜 -> 生成视频 -> 生成配音 -> 拼接
 */
const { Worker } = require('bullmq');
const { redis } = require('../config/redis');
const { pool } = require('../shared');
const { updateTaskStatus, submitVideoJob, submitAudioJob, submitExportJob } = require('../queues/submit');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function splitToShots(content) {
  const text = String(content || '').trim();
  const parts = text
    .split(/[\n。！？!?]/)
    .map(s => s.trim())
    .filter(Boolean);

  const length = text.length;
  let count = length < 20 ? 2 : 3;
  if (length >= 180) count = 4;
  if (parts.length >= 3 && count < 3) count = 3;
  if (parts.length >= 4 && count < 4) count = 4;
  if (count < 2) count = 2;

  const buckets = Array.from({ length: count }, () => []);
  for (let i = 0; i < parts.length; i++) {
    buckets[i % count].push(parts[i]);
  }

  const shotTypes = ['全景', '中景', '近景', '特写'];
  return buckets.map((bucket, idx) => ({
    shot_number: idx + 1,
    shot_type: shotTypes[idx] || '中景',
    camera_movement: '固定',
    visual_description: bucket.join('，') || text
  }));
}

/**
 * 更新主任务进度
 */
async function updateMainProgress(job, progress, message) {
  await job.updateProgress(progress);
  await updateTaskStatus(
    job.data.jobId,
    'active',
    progress,
    { message }
  );
}

async function processAutoGenerate(job) {
  const { jobId, projectId, params, userId, mockMode } = job.data;
  const { scriptId } = params;

  console.log(`[autoGenerateWorker] 开始一键成片, projectId: ${projectId}, scriptId: ${scriptId}`);

  try {
    // 1. 解析剧本并生成分镜
    await updateMainProgress(job, 5, '正在解析剧本并生成分镜...');
    
    const scriptRes = await pool.query('SELECT content FROM scripts WHERE id = $1', [scriptId]);
    if (scriptRes.rows.length === 0) throw new Error('剧本不存在');
    const scriptContent = scriptRes.rows[0].content;

    // 模拟分镜生成逻辑 (复用 scenes.js 的逻辑)
    const lines = scriptContent.split('\n').filter(line => line.trim());
    const scenesCount = Math.ceil(lines.length / 3);
    
    // 清理旧分镜 (可选，按需决定是否清理)
    // await pool.query('DELETE FROM scenes WHERE script_id = $1', [scriptId]);

    const generatedShots = [];
    for (let i = 0; i < lines.length; i += 3) {
      const sceneNumber = Math.floor(i / 3) + 1;
      const content = lines.slice(i, i + 3).join('\n');
      
      const sceneResult = await pool.query(
        `INSERT INTO scenes (script_id, user_id, scene_number, title, content, status)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [scriptId, userId, String(sceneNumber), `场景${sceneNumber}`, content, 'completed']
      );
      const sceneId = sceneResult.rows[0].id;

      const shots = splitToShots(content);
      for (const sh of shots) {
        const shotResult = await pool.query(
          `INSERT INTO shots (scene_id, script_id, user_id, shot_number, shot_type, camera_movement, visual_description, duration, video_status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 5, 'none') RETURNING id`,
          [sceneId, scriptId, userId, sh.shot_number, sh.shot_type, sh.camera_movement, sh.visual_description]
        );
        generatedShots.push({
          id: shotResult.rows[0].id,
          sceneId,
          content: sh.visual_description,
          shot_type: sh.shot_type,
          camera_movement: sh.camera_movement
        });
      }
      
      const prog = Math.floor(5 + (sceneNumber / scenesCount) * 10);
      await updateMainProgress(job, prog, `正在生成分镜 ${sceneNumber}/${scenesCount}...`);
      await sleep(200);
    }

    // 2. 逐个生成视频和配音
    const totalShots = generatedShots.length;
    await updateMainProgress(job, 15, `分镜生成完成，共 ${totalShots} 个。开始生成视频和配音...`);

    const videoJobIds = [];
    const audioJobIds = [];

    for (let i = 0; i < totalShots; i++) {
      const shot = generatedShots[i];
      const shotNum = i + 1;

      // 提交视频任务
      const vJobId = await submitVideoJob(shot.id, 'text2video', {
        projectId,
        scriptId,
        visual_description: shot.content,
        shot_type: shot.shot_type || '中景',
        camera_movement: shot.camera_movement || '固定'
      }, userId);
      videoJobIds.push(vJobId);

      // 提交音频任务
      const aJobId = await submitAudioJob(shot.sceneId, 'tts', {
        text: shot.content,
        voice_id: 'female_01',
        voice_name: '温柔女声',
        volume: 0.8,
        scriptId
      }, userId);
      audioJobIds.push(aJobId);

      const prog = Math.floor(15 + (shotNum / totalShots) * 60);
      await updateMainProgress(job, prog, `正在处理镜头任务 ${shotNum}/${totalShots}...`);
      await sleep(300);
    }

    // 3. 等待所有子任务完成 (Mock模式下我们假设它们会异步完成，主任务可以轮询或直接完成)
    // 在真实生产环境，这里需要监听子任务状态。Mock 模式下我们直接跳到拼接。
    await updateMainProgress(job, 80, '所有生成任务已提交，正在等待渲染队列...');
    await sleep(2000);

    // 4. 提交最终拼接任务
    await updateMainProgress(job, 90, '正在提交视频拼接任务...');
    const { jobId: exportJobId, exportId } = await submitExportJob(projectId, { format: 'mp4' }, userId);

    // 5. 完成
    await updateTaskStatus(jobId, 'completed', 100, {
      message: '一键成片流程已全部启动',
      export_job_id: exportJobId,
      export_id: exportId,
      shots_count: totalShots
    });

    console.log(`[autoGenerateWorker] 一键成片任务完成提交, jobId: ${jobId}`);
  } catch (err) {
    console.error(`[autoGenerateWorker] 任务失败:`, err);
    await updateTaskStatus(jobId, 'failed', job.progress, null, err.message);
    throw err;
  }
}

const autoGenerateWorker = new Worker('autoGenerateQueue', processAutoGenerate, {
  connection: redis,
  concurrency: 1
});

module.exports = { autoGenerateWorker };
