const { pool } = require('../config/database');

async function listTemplates({ category }) {
  let query = 'SELECT * FROM templates';
  const params = [];

  if (category && category !== '全部') {
    query += ' WHERE category = $1';
    params.push(category);
  }

  query += ' ORDER BY is_official DESC, use_count DESC';
  const result = await pool.query(query, params);
  return result.rows;
}

async function getTemplateById(id) {
  const result = await pool.query('SELECT * FROM templates WHERE id = $1', [id]);
  return result.rows[0] || null;
}

module.exports = {
  listTemplates,
  getTemplateById,
};
