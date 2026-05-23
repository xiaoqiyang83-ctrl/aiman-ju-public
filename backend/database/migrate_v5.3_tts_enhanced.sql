-- ========================================
-- AIManju v5.3 增强TTS配音系统
-- 添加情感控制、参数调节相关字段
-- ========================================

-- shots表添加配音参数字段
ALTER TABLE shots ADD COLUMN IF NOT EXISTS voice_rate VARCHAR(20) DEFAULT '+0%';
ALTER TABLE shots ADD COLUMN IF NOT EXISTS voice_volume VARCHAR(20) DEFAULT '+0%';
ALTER TABLE shots ADD COLUMN IF NOT EXISTS voice_pitch VARCHAR(20) DEFAULT '+0Hz';
ALTER TABLE shots ADD COLUMN IF NOT EXISTS voice_emotion VARCHAR(50) DEFAULT '';
ALTER TABLE shots ADD COLUMN IF NOT EXISTS audio_duration INTEGER DEFAULT 0; -- 音频时长（秒）

-- tts_voices表添加情感风格字段
ALTER TABLE tts_voices ADD COLUMN IF NOT EXISTS style VARCHAR(50) DEFAULT '';
ALTER TABLE tts_voices ADD COLUMN IF NOT EXISTS emotion VARCHAR(50) DEFAULT '';
ALTER TABLE tts_voices ADD COLUMN IF NOT EXISTS age VARCHAR(20) DEFAULT 'adult';

-- 更新tts_voices表，添加情感风格
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
WHERE style = '' OR emotion = '';

-- 确保is_active字段存在
ALTER TABLE tts_voices ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 创建音频素材关联表（用于配音与镜头的关联管理）
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
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_audio_assignments_shot_id ON audio_assignments(shot_id);
