/**
 * AIManju v5.1 数据库迁移脚本
 * shots/scenes/characters表字段补齐
 * 
 * 使用方法：cd backend && node database/migrate_v5.1.js
 */
require('dotenv').config();
const { readFileSync } = require('fs');
const { join } = require('path');

async function runMigration() {
  const { pool } = require('../shared');
  
  console.log('========================================');
  console.log('AIManju v5.1 数据库迁移');
  console.log('shots/scenes/characters表字段补齐');
  console.log('========================================\n');

  const sqlFile = join(__dirname, 'migrate_v5.1_shot_fields.sql');
  const sql = readFileSync(sqlFile, 'utf8');
  
  const statements = sql
    .split('\n')
    .filter(line => line.trim() && !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const stmt of statements) {
    try {
      await pool.query(stmt);
      success++;
      const preview = stmt.substring(0, 80).replace(/\n/g, ' ');
      console.log('✅ ' + preview + (stmt.length > 80 ? '...' : ''));
    } catch (err) {
      if (err.message.includes('already exists') || err.message.includes('重复')) {
        skipped++;
        console.log('⏭️  字段已存在，跳过');
      } else {
        failed++;
        console.error('❌ ' + err.message);
      }
    }
  }

  console.log('\n========================================');
  console.log(`迁移完成：成功 ${success}，跳过 ${skipped}，失败 ${failed}`);
  console.log('========================================');
  
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

runMigration().catch(err => {
  console.error('迁移失败:', err.message);
  process.exit(1);
});
