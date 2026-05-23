// ========================================
// AIManju v5.3 增强TTS配音系统迁移（Node版本）
// 添加情感控制、参数调节相关字段
// 用法：cd backend && node database/migrate_v5.3_tts_enhanced.js
// ========================================

const { pool } = require('../shared');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('开始 v5.3 增强TTS配音系统迁移...');

    // shots表添加配音参数字段
    await client.query(`ALTER TABLE shots ADD COLUMN IF NOT EXISTS voice_rate VARCHAR(20) DEFAULT '+0%'`);
    await client.query(`ALTER TABLE shots ADD COLUMN IF NOT EXISTS voice_volume VARCHAR(20) DEFAULT '+0%'`);
    await client.query(`ALTER TABLE shots ADD COLUMN IF NOT EXISTS voice_pitch VARCHAR(20) DEFAULT '+0Hz'`);
    await client.query(`ALTER TABLE shots ADD COLUMN IF NOT EXISTS voice_emotion VARCHAR(50) DEFAULT ''`);
    await client.query(`ALTER TABLE shots ADD COLUMN IF NOT EXISTS audio_duration INTEGER DEFAULT 0`);
    console.log('✅ shots表配音参数字段添加完成');

    // tts_voices表添加情感风格字段
    await client.query(`ALTER TABLE tts_voices ADD COLUMN IF NOT EXISTS style VARCHAR(50) DEFAULT ''`);
    await client.query(`ALTER TABLE tts_voices ADD COLUMN IF NOT EXISTS emotion VARCHAR(50) DEFAULT ''`);
    await client.query(`ALTER TABLE tts_voices ADD COLUMN IF NOT EXISTS age VARCHAR(20) DEFAULT 'adult'`);
    console.log('✅ tts_voices表情感风格字段添加完成');

    // 更新tts_voices表，添加情感风格
    await client.query(`
      UPDATE tts_voices SET 
        style = CASE voice_id
          WHEN 'zh-CN-XiaoxiaoNeural' THEN '温柔'
          WHEN 'zh-CN-YunxiNeural' THEN '阳光'
          WHEN 'zh-CN-YunjianNeural' THEN '磁性'
          WHEN 'zh-CN-XiaoyiNeural' THEN '活泼'
          WHEN 'zh-CN-YunyangNeural' THEN '播音'
          WHEN 'zh-CN-XiaochenNeural' THEN '轻松'
          WHEN 'zh-CN-XiaohanNeural' THEN '甜美'
          WHEN 'zh-CN-XiaomengNeural' THEN '可爱'
          WHEN 'zh-CN-XiaomoNeural' THEN '成熟'
          WHEN 'zh-CN-XiaoruiNeural' THEN '知性'
          WHEN 'zh-CN-XiaoshuangNeural' THEN '儿童'
          WHEN 'zh-CN-XiaoxuanNeural' THEN '温暖'
          WHEN 'zh-CN-XiaozhenNeural' THEN '大气'
          WHEN 'zh-CN-YunfengNeural' THEN '沉稳'
          WHEN 'zh-CN-YunhaoNeural' THEN '广告'
          WHEN 'zh-CN-YunxiaNeural' THEN '少年'
          WHEN 'zh-CN-YunzeNeural' THEN '低沉'
          ELSE ''
        END,
        emotion = CASE voice_id
          WHEN 'zh-CN-XiaoxiaoNeural' THEN 'warm'
          WHEN 'zh-CN-YunxiNeural' THEN 'cheerful'
          WHEN 'zh-CN-YunjianNeural' THEN 'seductive'
          WHEN 'zh-CN-XiaoyiNeural' THEN 'lively'
          WHEN 'zh-CN-YunyangNeural' THEN 'formal'
          WHEN 'zh-CN-XiaochenNeural' THEN 'relaxed'
          WHEN 'zh-CN-XiaohanNeural' THEN 'cheerful'
          WHEN 'zh-CN-XiaomengNeural' THEN 'playful'
          WHEN 'zh-CN-XiaomoNeural' THEN 'steady'
          WHEN 'zh-CN-XiaoruiNeural' THEN 'calm'
          WHEN 'zh-CN-XiaoshuangNeural' THEN 'innocent'
          WHEN 'zh-CN-XiaoxuanNeural' THEN 'gentle'
          WHEN 'zh-CN-XiaozhenNeural' THEN 'confident'
          WHEN 'zh-CN-YunfengNeural' THEN 'steady'
          WHEN 'zh-CN-YunhaoNeural' THEN 'energetic'
          WHEN 'zh-CN-YunxiaNeural' THEN 'youthful'
          WHEN 'zh-CN-YunzeNeural' THEN 'deep'
          ELSE 'calm'
        END,
        age = CASE voice_id
          WHEN 'zh-CN-XiaoshuangNeural' THEN 'child'
          WHEN 'zh-CN-YunxiaNeural' THEN 'teen'
          WHEN 'zh-CN-XiaoxiaoNeural' THEN 'young'
          WHEN 'zh-CN-YunxiNeural' THEN 'young'
          WHEN 'zh-CN-XiaoyiNeural' THEN 'young'
          WHEN 'zh-CN-XiaohanNeural' THEN 'young'
          WHEN 'zh-CN-XiaomengNeural' THEN 'young'
          WHEN 'zh-CN-XiaochenNeural' THEN 'young'
          ELSE 'adult'
        END
      WHERE style = '' OR emotion = ''
    `);
    console.log('✅ tts_voices表情感风格数据更新完成');

    // 确保is_active字段存在
    await client.query(`ALTER TABLE tts_voices ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`);
    console.log('✅ tts_voices.is_active字段确保完成');

    // 创建音频素材关联表
    await client.query(`
      CREATE TABLE IF NOT EXISTS audio_assignments (
        id SERIAL PRIMARY KEY,
        shot_id INTEGER REFERENCES shots(id) ON DELETE CASCADE,
        audio_url TEXT NOT NULL,
        voice_id VARCHAR(50) DEFAULT '',
        voice_name VARCHAR(100) DEFAULT '',
        voice_rate VARCHAR(20) DEFAULT '+0%',
        voice_volume VARCHAR(20) DEFAULT '+0%',
        voice_pitch VARCHAR(20) DEFAULT '+0Hz',
        voice_emotion VARCHAR(50) DEFAULT '',
        audio_duration INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ audio_assignments表创建完成');

    // 创建索引
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audio_assignments_shot_id ON audio_assignments(shot_id)`);
    console.log('✅ 索引创建完成');

    await client.query('COMMIT');
    console.log('\n🎉 v5.3 增强TTS配音系统迁移完成！');
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
