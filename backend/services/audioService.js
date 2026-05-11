const path = require('path');
const fs = require('fs');

const { pool } = require('../config/database');

async function listLibrary({ userId, projectId }) {
  let query = 'SELECT * FROM audio_assets WHERE user_id = $1';
  const params = [userId];

  if (projectId) {
    query += ' AND (project_id = $2 OR project_id IS NULL)';
    params.push(projectId);
  }

  query += ' ORDER BY created_at DESC';
  const result = await pool.query(query, params);
  return result.rows;
}

async function createAudioAsset({ userId, projectId, originalname, filename, audioType }) {
  const filePath = `/uploads/audio/${filename}`;
  const mockDuration = Number((Math.random() * 27 + 3).toFixed(2));

  const result = await pool.query(
    `INSERT INTO audio_assets (user_id, project_id, filename, file_path, audio_type, duration)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [userId, projectId || null, originalname, filePath, audioType || 'voice', mockDuration]
  );
  return result.rows[0];
}

async function getAudioAsset({ id, userId }) {
  const assetRes = await pool.query('SELECT * FROM audio_assets WHERE id = $1 AND user_id = $2', [id, userId]);
  return assetRes.rows[0] || null;
}

async function deleteAudioAsset({ id }) {
  await pool.query('DELETE FROM audio_assets WHERE id = $1', [id]);
}

function deleteLocalFileByPublicPath(publicPath) {
  const rel = String(publicPath || '').trim();
  if (!rel) return;
  const normalized = rel.startsWith('/') ? rel.slice(1) : rel;
  const filePath = path.join(__dirname, '..', normalized);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

async function listVoices() {
  const result = await pool.query('SELECT * FROM tts_voices ORDER BY id ASC');
  return result.rows;
}

async function listBgmPresets() {
  const result = await pool.query('SELECT * FROM bgm_presets ORDER BY id ASC');
  return result.rows;
}

async function listSfxPresets() {
  const result = await pool.query('SELECT * FROM sfx_presets ORDER BY id ASC');
  return result.rows;
}

async function getSceneMeta(sceneId) {
  const sceneRes = await pool.query('SELECT script_id, user_id FROM scenes WHERE id = $1', [sceneId]);
  return sceneRes.rows[0] || null;
}

async function insertSceneAudio({ sceneId, userId, scriptId, audioType, textContent, volume }) {
  await pool.query(
    `INSERT INTO scene_audio (scene_id, user_id, script_id, audio_type, text_content, volume)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [sceneId, userId, scriptId, audioType, String(textContent || ''), volume]
  );
}

module.exports = {
  listLibrary,
  createAudioAsset,
  getAudioAsset,
  deleteAudioAsset,
  deleteLocalFileByPublicPath,
  listVoices,
  listBgmPresets,
  listSfxPresets,
  getSceneMeta,
  insertSceneAudio,
};

