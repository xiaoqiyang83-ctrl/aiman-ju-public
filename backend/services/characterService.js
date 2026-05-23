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

function normalizeJsonObject(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return {};
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
  // v5.0 新增字段
  identityAnchors,
  negativePrompt,
  consistencyElements,
  gender,
  age,
  personality,
  roleDesc,
  appearance,
  visualPromptEn,
  visualPromptZh,
}) {
  const result = await pool.query(
    `INSERT INTO characters (
       script_id, user_id, name, description, image_url,
       front_image_url, side_image_url, back_image_url,
       expressions, costumes,
       identity_anchors, negative_prompt, consistency_elements,
       gender, age, personality, role_desc, appearance,
       visual_prompt_en, visual_prompt_zh
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
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
      JSON.stringify(identityAnchors || {}),
      JSON.stringify(negativePrompt || {}),
      JSON.stringify(consistencyElements || {}),
      gender || null,
      age || null,
      personality || null,
      roleDesc || null,
      appearance || null,
      visualPromptEn || null,
      visualPromptZh || null,
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
  // v5.0 新增字段
  identityAnchors,
  negativePrompt,
  consistencyElements,
  gender,
  age,
  personality,
  roleDesc,
  appearance,
  visualPromptEn,
  visualPromptZh,
}) {
  // 动态构建更新字段
  const updates = [];
  const values = [];
  let paramIndex = 1;

  const addUpdate = (field, value, json = false) => {
    if (value !== undefined) {
      updates.push(`${field} = $${paramIndex}`);
      values.push(json ? JSON.stringify(value) : value);
      paramIndex++;
    }
  };

  addUpdate('name', name ?? null);
  addUpdate('description', description ?? null);
  addUpdate('image_url', imageUrl ?? null);
  addUpdate('front_image_url', frontImageUrl ?? null);
  addUpdate('side_image_url', sideImageUrl ?? null);
  addUpdate('back_image_url', backImageUrl ?? null);
  addUpdate('expressions', expressions, true);
  addUpdate('costumes', costumes, true);
  // v5.0 新增
  addUpdate('identity_anchors', identityAnchors, true);
  addUpdate('negative_prompt', negativePrompt, true);
  addUpdate('consistency_elements', consistencyElements, true);
  addUpdate('gender', gender ?? null);
  addUpdate('age', age ?? null);
  addUpdate('personality', personality ?? null);
  addUpdate('role_desc', roleDesc ?? null);
  addUpdate('appearance', appearance ?? null);
  addUpdate('visual_prompt_en', visualPromptEn ?? null);
  addUpdate('visual_prompt_zh', visualPromptZh ?? null);

  if (updates.length === 0) {
    return getCharacter({ userId, id });
  }

  values.push(id, userId);
  const result = await pool.query(
    `UPDATE characters SET ${updates.join(', ')} WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1} RETURNING *`,
    values
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
  // 删除关联的变体
  await pool.query('DELETE FROM character_variations WHERE character_id = $1', [id]);
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

// ==================== v5.0 角色变体 CRUD ====================

async function listVariations({ userId, characterId }) {
  // 验证角色归属
  const char = await pool.query('SELECT id FROM characters WHERE id = $1 AND user_id = $2', [characterId, userId]);
  if (!char.rows[0]) return null;

  const result = await pool.query(
    'SELECT * FROM character_variations WHERE character_id = $1 ORDER BY is_stage_variation, id',
    [characterId]
  );
  return result.rows;
}

async function getVariation({ userId, id, characterId }) {
  const result = await pool.query(
    `SELECT v.* FROM character_variations v
     JOIN characters c ON v.character_id = c.id
     WHERE v.id = $1 AND c.user_id = $2 AND ($3::integer IS NULL OR v.character_id = $3)`,
    [id, userId, characterId || null]
  );
  return result.rows[0] || null;
}

async function createVariation({
  userId,
  characterId,
  name,
  description,
  visualPrompt,
  visualPromptZh,
  referenceImage,
  isStageVariation,
  episodeRange,
  ageDescription,
  stageDescription,
}) {
  // 验证角色归属
  const char = await pool.query('SELECT id FROM characters WHERE id = $1 AND user_id = $2', [characterId, userId]);
  if (!char.rows[0]) return null;

  const result = await pool.query(
    `INSERT INTO character_variations (
       character_id, name, description, visual_prompt, visual_prompt_zh,
       reference_image, is_stage_variation, episode_range,
       age_description, stage_description
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      characterId,
      name || '新变体',
      description || '',
      visualPrompt || '',
      visualPromptZh || '',
      referenceImage || null,
      isStageVariation || false,
      episodeRange || '',
      ageDescription || '',
      stageDescription || '',
    ]
  );
  return result.rows[0];
}

async function updateVariation({
  userId,
  id,
  name,
  description,
  visualPrompt,
  visualPromptZh,
  referenceImage,
  isStageVariation,
  episodeRange,
  ageDescription,
  stageDescription,
}) {
  // 先验证归属
  const existing = await pool.query(
    `SELECT v.* FROM character_variations v
     JOIN characters c ON v.character_id = c.id
     WHERE v.id = $1 AND c.user_id = $2`,
    [id, userId]
  );
  if (!existing.rows[0]) return null;

  const result = await pool.query(
    `UPDATE character_variations SET
       name = COALESCE($1, name),
       description = COALESCE($2, description),
       visual_prompt = COALESCE($3, visual_prompt),
       visual_prompt_zh = COALESCE($4, visual_prompt_zh),
       reference_image = COALESCE($5, reference_image),
       is_stage_variation = COALESCE($6, is_stage_variation),
       episode_range = COALESCE($7, episode_range),
       age_description = COALESCE($8, age_description),
       stage_description = COALESCE($9, stage_description),
       updated_at = CURRENT_TIMESTAMP
     WHERE id = $10
     RETURNING *`,
    [
      name ?? null,
      description ?? null,
      visualPrompt ?? null,
      visualPromptZh ?? null,
      referenceImage ?? null,
      isStageVariation ?? null,
      episodeRange ?? null,
      ageDescription ?? null,
      stageDescription ?? null,
      id,
    ]
  );
  return result.rows[0];
}

async function deleteVariation({ userId, id }) {
  const existing = await pool.query(
    `SELECT v.* FROM character_variations v
     JOIN characters c ON v.character_id = c.id
     WHERE v.id = $1 AND c.user_id = $2`,
    [id, userId]
  );
  if (!existing.rows[0]) return null;

  await pool.query('DELETE FROM character_variations WHERE id = $1', [id]);
  return existing.rows[0];
}

module.exports = {
  listCharacters,
  getCharacter,
  createCharacter,
  updateCharacter,
  deleteCharacter,
  addJsonImage,
  setImageField,
  // v5.0 变体CRUD
  listVariations,
  getVariation,
  createVariation,
  updateVariation,
  deleteVariation,
};
