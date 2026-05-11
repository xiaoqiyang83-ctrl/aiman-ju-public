const path = require('path');
const fs = require('fs');

const { pool } = require('../config/database');

function normalizeJsonList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function listCharacters({ userId, scriptId, projectId }) {
  let q = 'SELECT * FROM characters WHERE user_id = $1';
  const p = [userId];
  if (scriptId) {
    p.push(scriptId);
    q += ` AND script_id = $${p.length}`;
  } else if (projectId) {
    p.push(projectId);
    q += ` AND script_id IN (SELECT id FROM scripts WHERE project_id = $${p.length} AND user_id = $1)`;
  }
  q += ' ORDER BY created_at DESC';
  const result = await pool.query(q, p);
  return result.rows;
}

async function getCharacter({ userId, id }) {
  const result = await pool.query('SELECT * FROM characters WHERE id = $1 AND user_id = $2', [id, userId]);
  return result.rows[0] || null;
}

async function createCharacter({
  userId,
  scriptId,
  name,
  description,
  imageUrl,
  frontImageUrl,
  sideImageUrl,
  backImageUrl,
  expressions,
  costumes,
}) {
  const result = await pool.query(
    `INSERT INTO characters (
       script_id, user_id, name, description, image_url,
       front_image_url, side_image_url, back_image_url,
       expressions, costumes
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      scriptId,
      userId,
      name || '新角色',
      description || '',
      imageUrl || null,
      frontImageUrl || null,
      sideImageUrl || null,
      backImageUrl || null,
      JSON.stringify(expressions || []),
      JSON.stringify(costumes || []),
    ]
  );
  return result.rows[0];
}

async function updateCharacter({
  userId,
  id,
  name,
  description,
  imageUrl,
  frontImageUrl,
  sideImageUrl,
  backImageUrl,
  expressions,
  costumes,
}) {
  const result = await pool.query(
    `UPDATE characters
     SET name = COALESCE($1, name),
         description = COALESCE($2, description),
         image_url = COALESCE($3, image_url),
         front_image_url = COALESCE($4, front_image_url),
         side_image_url = COALESCE($5, side_image_url),
         back_image_url = COALESCE($6, back_image_url),
         expressions = COALESCE($7, expressions),
         costumes = COALESCE($8, costumes)
     WHERE id = $9 AND user_id = $10
     RETURNING *`,
    [
      name ?? null,
      description ?? null,
      imageUrl ?? null,
      frontImageUrl ?? null,
      sideImageUrl ?? null,
      backImageUrl ?? null,
      expressions ? JSON.stringify(expressions) : null,
      costumes ? JSON.stringify(costumes) : null,
      id,
      userId,
    ]
  );
  return result.rows[0] || null;
}

function deleteLocalFileByPublicPath(publicPath) {
  const rel = String(publicPath || '').trim();
  if (!rel || !rel.startsWith('/uploads/')) return;
  const normalized = rel.startsWith('/') ? rel.slice(1) : rel;
  const filePath = path.join(__dirname, '..', normalized);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

async function deleteCharacter({ userId, id }) {
  const row = await getCharacter({ userId, id });
  if (!row) return null;
  await pool.query('DELETE FROM characters WHERE id = $1 AND user_id = $2', [id, userId]);
  deleteLocalFileByPublicPath(row.image_url);
  deleteLocalFileByPublicPath(row.reference_image);
  return row;
}

async function addJsonImage({ userId, id, field, name, url }) {
  const oldRes = await pool.query(`SELECT ${field} FROM characters WHERE id = $1`, [id]);
  const list = normalizeJsonList(oldRes.rows[0]?.[field]);
  list.push({ name: name || '未命名', url });
  const result = await pool.query(`UPDATE characters SET ${field} = $1 WHERE id = $2 AND user_id = $3 RETURNING *`, [
    JSON.stringify(list),
    id,
    userId,
  ]);
  return result.rows[0] || null;
}

async function setImageField({ userId, id, column, url }) {
  const result = await pool.query(`UPDATE characters SET ${column} = $1 WHERE id = $2 AND user_id = $3 RETURNING *`, [
    url,
    id,
    userId,
  ]);
  return result.rows[0] || null;
}

module.exports = {
  listCharacters,
  getCharacter,
  createCharacter,
  updateCharacter,
  deleteCharacter,
  addJsonImage,
  setImageField,
};

