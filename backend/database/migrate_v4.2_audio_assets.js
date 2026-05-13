// ========================================
// 创建audio_assets表
// 用法：cd backend && node database/migrate_v4.2_audio_assets.js
// ========================================

const { pool } = require('../shared');
const fs = require('fs');
const path = require('path');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 创建audio_assets表
    await client.query(`
      CREATE TABLE IF NOT EXISTS audio_assets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL DEFAULT 1,
        project_id INTEGER,
        filename VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        audio_type VARCHAR(50) DEFAULT 'sfx',
        duration FLOAT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ audio_assets 表已创建');

    // 创建索引
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audio_assets_user_id ON audio_assets(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audio_assets_project_id ON audio_assets(project_id)`);
    console.log('✅ 索引已创建');

    await client.query('COMMIT');
    console.log('\n🎉 audio_assets 迁移完成！');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ 迁移失败:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error('迁移异常:', err);
  process.exit(1);
});
