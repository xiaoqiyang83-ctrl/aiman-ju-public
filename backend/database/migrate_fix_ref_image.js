// ========================================
// 修复reference_image_url字段类型为TEXT
// 用法：cd backend && node database/migrate_fix_ref_image.js
// ========================================

const { pool } = require('../shared');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('修复 reference_image_url 字段类型...');

    // 将VARCHAR(500)改为TEXT，支持存储base64或长路径
    await client.query(`ALTER TABLE shots ALTER COLUMN reference_image_url TYPE TEXT`);
    console.log('✅ reference_image_url 已改为 TEXT 类型');

    // 同样确保scene_image_url也是TEXT（应该是了，但以防万一）
    await client.query(`ALTER TABLE shots ALTER COLUMN scene_image_url TYPE TEXT`);
    console.log('✅ scene_image_url 确认为 TEXT 类型');

    await client.query('COMMIT');
    console.log('\n🎉 字段类型修复完成！');
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
