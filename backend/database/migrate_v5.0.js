/**
 * AIManju v5.0 数据库迁移脚本
 * 角色一致性系统 - 6层身份锚点
 * 
 * 使用方法：cd backend && node database/migrate_v5.0.js
 */
require('dotenv').config();
const { readFileSync } = require('fs');
const { join } = require('path');

async function runMigration() {
  // 动态导入shared，确保dotenv已加载
  const { pool } = require('../shared');
  
  console.log('========================================');
  console.log('AIManju v5.0 数据库迁移');
  console.log('角色一致性系统 - 6层身份锚点');
  console.log('========================================\n');

  const sqlFile = join(__dirname, 'migrate_v5.0_character_anchors.sql');
  const sql = readFileSync(sqlFile, 'utf8');
  
  // 按分号分割，逐条执行（跳过注释行）
  const statements = sql
    .split('\n')
    .filter(line => line.trim() && !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  let success = 0;
  let failed = 0;

  for (const stmt of statements) {
    try {
      await pool.query(stmt);
      success++;
      // 提取操作类型简要显示
      const preview = stmt.substring(0, 80).replace(/\n/g, ' ');
      console.log('✅ ' + preview + (stmt.length > 80 ? '...' : ''));
    } catch (err) {
      failed++;
      console.error('❌ ' + err.message);
    }
  }

  console.log('\n========================================');
  console.log(`迁移完成：成功 ${success} 条，失败 ${failed} 条`);
  console.log('========================================');
  
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

runMigration().catch(err => {
  console.error('迁移失败:', err.message);
  process.exit(1);
});
