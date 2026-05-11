const { pool } = require('../shared');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('开始 v5.2 TTS配音系统迁移...');

    // shots表添加配音音色字段
    await client.query(`ALTER TABLE shots ADD COLUMN IF NOT EXISTS voice_name VARCHAR(50) DEFAULT ''`);
    await client.query(`ALTER TABLE shots ADD COLUMN IF NOT EXISTS voice_id VARCHAR(50) DEFAULT ''`);
    await client.query(`ALTER TABLE shots ADD COLUMN IF NOT EXISTS tts_status VARCHAR(20) DEFAULT 'none'`);
    console.log('✅ shots表字段添加完成');

    // characters表添加默认音色绑定字段
    await client.query(`ALTER TABLE characters ADD COLUMN IF NOT EXISTS default_voice_id VARCHAR(50) DEFAULT ''`);
    await client.query(`ALTER TABLE characters ADD COLUMN IF NOT EXISTS default_voice_name VARCHAR(100) DEFAULT ''`);
    console.log('✅ characters表字段添加完成');

    // 创建tts_voices表（如果不存在）
    await client.query(`
      CREATE TABLE IF NOT EXISTS tts_voices (
        id SERIAL PRIMARY KEY,
        voice_id VARCHAR(50) UNIQUE NOT NULL,
        voice_name VARCHAR(100) NOT NULL,
        voice_code VARCHAR(50),
        gender VARCHAR(10),
        language VARCHAR(10) DEFAULT 'zh-CN',
        description TEXT,
        is_active BOOLEAN DEFAULT true
      )
    `);
    console.log('✅ tts_voices表创建完成');

    // 插入音色数据
    await client.query(`
      INSERT INTO tts_voices (voice_id, voice_name, voice_code, gender, language, description)
      VALUES 
        ('zh-CN-XiaoxiaoNeural', '晓晓（温柔女声）', 'xiaoxiao', 'female', 'zh-CN', '温柔亲和的年轻女声'),
        ('zh-CN-YunxiNeural', '云希（阳光男声）', 'yunxi', 'male', 'zh-CN', '阳光帅气的年轻男声'),
        ('zh-CN-YunjianNeural', '云健（磁性男声）', 'yunjian', 'male', 'zh-CN', '磁性低沉的成熟男声'),
        ('zh-CN-XiaoyiNeural', '晓伊（活泼女声）', 'xiaoyi', 'female', 'zh-CN', '活泼可爱的年轻女声'),
        ('zh-CN-YunyangNeural', '云扬（播音男声）', 'yunyang', 'male', 'zh-CN', '新闻播报风格男声'),
        ('zh-CN-XiaochenNeural', '晓辰（轻松女声）', 'xiaochen', 'female', 'zh-CN', '轻松自然的年轻女声'),
        ('zh-CN-XiaohanNeural', '晓涵（甜美女声）', 'xiaohan', 'female', 'zh-CN', '甜美温柔的年轻女声'),
        ('zh-CN-XiaomengNeural', '晓梦（可爱女声）', 'xiaomeng', 'female', 'zh-CN', '可爱俏皮的年轻女声'),
        ('zh-CN-XiaomoNeural', '晓墨（成熟女声）', 'xiaomo', 'female', 'zh-CN', '成熟知性的女性声音'),
        ('zh-CN-XiaoruiNeural', '晓睿（知性女声）', 'xiaorui', 'female', 'zh-CN', '知性优雅的女性声音'),
        ('zh-CN-XiaoshuangNeural', '晓双（儿童女声）', 'xiaoshuang', 'female', 'zh-CN', '稚嫩可爱的儿童女声'),
        ('zh-CN-XiaoxuanNeural', '晓萱（温暖女声）', 'xiaoxuan', 'female', 'zh-CN', '温暖柔和的女性声音'),
        ('zh-CN-XiaozhenNeural', '晓甄（大气女声）', 'xiaozhen', 'female', 'zh-CN', '大气端庄的女性声音'),
        ('zh-CN-YunfengNeural', '云枫（沉稳男声）', 'yunfeng', 'male', 'zh-CN', '沉稳有力的成熟男声'),
        ('zh-CN-YunhaoNeural', '云皓（广告男声）', 'yunhao', 'male', 'zh-CN', '专业广告配音男声'),
        ('zh-CN-YunxiaNeural', '云夏（少年男声）', 'yunxia', 'male', 'zh-CN', '清澈阳光的少年男声'),
        ('zh-CN-YunzeNeural', '云泽（低沉男声）', 'yunze', 'male', 'zh-CN', '低沉浑厚的成熟男声')
      ON CONFLICT (voice_id) DO NOTHING
    `);
    console.log('✅ 音色数据插入完成');

    console.log('🎉 v5.2 TTS配音系统迁移完成！');
  } catch (err) {
    console.error('❌ 迁移失败:', err.message);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

migrate();
