const fs = require('fs');
const path = require('path');
const { TextDecoder: UtilTextDecoder } = require('util');
const iconv = require('iconv-lite');

const Utf8FatalDecoder =
  typeof globalThis.TextDecoder !== 'undefined'
    ? new globalThis.TextDecoder('utf-8', { fatal: true })
    : new UtilTextDecoder('utf-8', { fatal: true });

const { pool } = require('../config/database');

function decodeTextFile(buffer) {
  try {
    return Utf8FatalDecoder.decode(buffer);
  } catch {
    return iconv.decode(buffer, 'gbk');
  }
}

function readTxtFile(filePath) {
  const buf = fs.readFileSync(filePath);
  return decodeTextFile(buf);
}

async function readDocxFile(filePath) {
  const mammoth = require('mammoth');
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

async function getFirstProject(userId) {
  const res = await pool.query('SELECT id FROM projects WHERE user_id = $1 ORDER BY id ASC LIMIT 1', [userId]);
  if (res.rows[0]?.id) return res.rows[0].id;
  const created = await pool.query('INSERT INTO projects (user_id, name) VALUES ($1, $2) RETURNING id', [
    userId,
    '默认项目',
  ]);
  return created.rows[0]?.id || null;
}

async function listScripts({ projectId, userId }) {
  const res = await pool.query(
    'SELECT * FROM scripts WHERE project_id = $1 AND user_id = $2 ORDER BY created_at DESC',
    [projectId, userId]
  );
  return res.rows;
}

async function createScript({ projectId, userId, title, content, status = 'pending' }) {
  const res = await pool.query(
    `INSERT INTO scripts (project_id, user_id, title, content, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [projectId, userId, title, content, status]
  );
  return res.rows[0];
}

async function updateScript({ id, userId, title, content }) {
  const res = await pool.query(
    `UPDATE scripts
     SET title = $1, content = $2
     WHERE id = $3 AND user_id = $4
     RETURNING *`,
    [title, content, id, userId]
  );
  return res.rows[0] || null;
}

async function deleteScript({ id, userId }) {
  await pool.query('DELETE FROM scripts WHERE id = $1 AND user_id = $2', [id, userId]);
}

async function createScriptFromUpload({ projectId, userId, originalName, filePath }) {
  const ext = path.extname(originalName).toLowerCase();
  const title = path.basename(originalName, ext);

  let content = '';
  if (ext === '.txt') {
    content = readTxtFile(filePath);
  } else if (ext === '.docx' || ext === '.doc') {
    content = await readDocxFile(filePath);
  } else {
    throw new Error('不支持的文件类型');
  }

  const row = await createScript({ projectId, userId, title, content, status: 'pending' });
  return row;
}

module.exports = {
  getFirstProject,
  listScripts,
  createScript,
  updateScript,
  deleteScript,
  createScriptFromUpload,
};
