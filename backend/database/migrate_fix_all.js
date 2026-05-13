// ========================================
// 综合数据库修复：补全所有缺失字段
// 用法：cd backend && node database/migrate_fix_all.js
// ========================================

const { pool } = require('../shared');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('开始数据库修复...\n');

    // 1. exports表补全字段
    const exportsColumns = [
      ['config', 'JSONB'],
      ['job_id', 'VARCHAR(100)'],
    ];
    for (const [col, type] of exportsColumns) {
      try {
        await client.query(`ALTER TABLE exports ADD COLUMN IF NOT EXISTS ${col} ${type}`);
        console.log(`✅ exports.${col} 已添加`);
      } catch (e) {
        console.log(`⚠️ exports.${col}: ${e.message}`);
      }
    }

    // 2. shots表补全字段
    const shotsColumns = [
      ['reference_image_url', 'TEXT'],
      ['scene_image_url', 'TEXT'],
      ['character_angle', 'VARCHAR(50)'],
      ['tts_status', 'VARCHAR(20) DEFAULT \'pending\''],
      ['voice_id', 'VARCHAR(100)'],
      ['voice_name', 'VARCHAR(100)'],
      ['audio_url', 'VARCHAR(500)'],
      ['video_prompt', 'TEXT'],
      ['video_url', 'VARCHAR(500)'],
      ['video_status', 'VARCHAR(20) DEFAULT \'pending\''],
      ['result_url', 'VARCHAR(500)'],
      ['thumbnail', 'VARCHAR(500)'],
      ['job_id', 'VARCHAR(100)'],
      ['image_size', 'VARCHAR(50)'],
      ['visual_prompt', 'TEXT'],
    ];
    for (const [col, type] of shotsColumns) {
      try {
        await client.query(`ALTER TABLE shots ADD COLUMN IF NOT EXISTS ${col} ${type}`);
        console.log(`✅ shots.${col} 已添加/确认`);
      } catch (e) {
        console.log(`⚠️ shots.${col}: ${e.message}`);
      }
    }

    // 3. 修复reference_image_url字段类型（从VARCHAR(500)改为TEXT）
    try {
      await client.query(`ALTER TABLE shots ALTER COLUMN reference_image_url TYPE TEXT`);
      console.log('✅ shots.reference_image_url 类型已改为TEXT');
    } catch (e) {
      console.log(`⚠️ shots.reference_image_url改TEXT: ${e.message}`);
    }

    // 4. scene_image_url也确保TEXT
    try {
      await client.query(`ALTER TABLE shots ALTER COLUMN scene_image_url TYPE TEXT`);
      console.log('✅ shots.scene_image_url 类型确认TEXT');
    } catch (e) {
      console.log(`⚠️ shots.scene_image_url改TEXT: ${e.message}`);
    }

    // 5. characters表补全字段
    const charColumns = [
      ['visual_prompt_en', 'TEXT'],
      ['identity_anchors', 'JSONB'],
      ['front_image_url', 'VARCHAR(500)'],
      ['side_image_url', 'VARCHAR(500)'],
      ['back_image_url', 'VARCHAR(500)'],
      ['default_voice_id', 'VARCHAR(100)'],
      ['default_voice_name', 'VARCHAR(100)'],
      ['reference_image', 'VARCHAR(500)'],
    ];
    for (const [col, type] of charColumns) {
      try {
        await client.query(`ALTER TABLE characters ADD COLUMN IF NOT EXISTS ${col} ${type}`);
        console.log(`✅ characters.${col} 已添加/确认`);
      } catch (e) {
        console.log(`⚠️ characters.${col}: ${e.message}`);
      }
    }

    // 6. scenes表补全字段
    const scenesColumns = [
      ['scene_image_url', 'TEXT'],
      ['location', 'VARCHAR(200)'],
      ['time_of_day', 'VARCHAR(50)'],
    ];
    for (const [col, type] of scenesColumns) {
      try {
        await client.query(`ALTER TABLE scenes ADD COLUMN IF NOT EXISTS ${col} ${type}`);
        console.log(`✅ scenes.${col} 已添加/确认`);
      } catch (e) {
        console.log(`⚠️ scenes.${col}: ${e.message}`);
      }
    }

    // 7. 创建audio_assets表（如果不存在）
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
    console.log('✅ audio_assets 表已创建/确认');

    // 8. task_jobs表补user_id（如果缺失）
    try {
      await client.query(`ALTER TABLE task_jobs ADD COLUMN IF NOT EXISTS user_id INTEGER NOT NULL DEFAULT 1`);
      console.log('✅ task_jobs.user_id 已添加/确认');
    } catch (e) {
      console.log(`⚠️ task_jobs.user_id: ${e.message}`);
    }

    await client.query('COMMIT');
    console.log('\n🎉 数据库修复完成！所有字段已补全。');
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
