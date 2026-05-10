const express = require('express');
const router = express.Router();
const { pool } = require('../shared');

const userId = 1; // 临时硬编码

// 获取所有模板
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;
    let query = 'SELECT * FROM templates';
    const params = [];
    
    if (category && category !== '全部') {
      query += ' WHERE category = $1';
      params.push(category);
    }
    
    query += ' ORDER BY is_official DESC, use_count DESC';
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[Templates] 获取失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 获取模板详情
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM templates WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '模板不存在' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[Templates] 获取详情失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
