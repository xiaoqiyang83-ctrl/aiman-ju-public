-- ================================================================
-- AIManju v3.8 音频模块数据库迁移
-- 包含: AI配音(TTS)、背景音乐(BGM)、环境音效(SFX)
-- 数据库: PostgreSQL
-- ================================================================

-- 1. 场景音频表 - 存储所有类型的场景音频
CREATE TABLE IF NOT EXISTS scene_audio (
  id SERIAL PRIMARY KEY,
  scene_id INTEGER NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  script_id INTEGER NOT NULL REFERENCES scripts(id),
  audio_type VARCHAR(20) NOT NULL CHECK (audio_type IN ('tts', 'bgm', 'sfx')),
  file_url VARCHAR(500),
  duration DECIMAL(6,2) DEFAULT 0,
  text_content TEXT,
  voice_name VARCHAR(50),
  volume DECIMAL(3,2) DEFAULT 1.0,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  preset_id VARCHAR(50),
  original_filename VARCHAR(255),
  file_size INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引提升查询性能
CREATE INDEX IF NOT EXISTS idx_scene_audio_scene_id ON scene_audio(scene_id);
CREATE INDEX IF NOT EXISTS idx_scene_audio_user_id ON scene_audio(user_id);
CREATE INDEX IF NOT EXISTS idx_scene_audio_script_id ON scene_audio(script_id);
CREATE INDEX IF NOT EXISTS idx_scene_audio_type ON scene_audio(audio_type);
CREATE INDEX IF NOT EXISTS idx_scene_audio_status ON scene_audio(status);

-- 2. TTS音色预设表
CREATE TABLE IF NOT EXISTS tts_voices (
  id SERIAL PRIMARY KEY,
  voice_id VARCHAR(50) UNIQUE NOT NULL,
  voice_name VARCHAR(100) NOT NULL,
  voice_code VARCHAR(50) NOT NULL,
  gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'neutral')),
  language VARCHAR(20) DEFAULT 'zh-CN',
  description TEXT,
  preview_url VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 插入预设TTS音色
INSERT INTO tts_voices (voice_id, voice_name, voice_code, gender, language, description) VALUES
  ('zh-CN-XiaoxiaoNeural', '晓晓（温柔女声）', 'xiaoxiao', 'female', 'zh-CN', '温柔亲和的年轻女声'),
  ('zh-CN-YunxiNeural', '云希（活力男声）', 'yunxi', 'male', 'zh-CN', '阳光活力的年轻男声'),
  ('zh-CN-YunyangNeural', '云扬（专业男声）', 'yunyang', 'male', 'zh-CN', '专业播报的男声'),
  ('zh-CN-Xiaoyi', '小艺（甜美女声）', 'xiaoyi', 'female', 'zh-CN', '甜美可爱的女声'),
  ('zh-CN-Yunye', '云野（成熟男声）', 'yunye', 'male', 'zh-CN', '成熟稳重的中年男声'),
  ('zh-CN-Xiaobei', '小蓓（知性女声）', 'xiaobei', 'female', 'zh-CN', '知性优雅的女声'),
  ('zh-CN-Yunxia', '云夏（青春女声）', 'yunxia', 'female', 'zh-CN', '青春活泼的女声'),
  ('zh-CN-Yunjian', '云健（阳光男声）', 'yunjian', 'male', 'zh-CN', '阳光健康的男声')
ON CONFLICT (voice_id) DO NOTHING;

-- 3. 背景音乐预设表
CREATE TABLE IF NOT EXISTS bgm_presets (
  id SERIAL PRIMARY KEY,
  preset_id VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(30) NOT NULL,
  description TEXT,
  tags VARCHAR(200),
  duration DECIMAL(6,2),
  preview_url VARCHAR(500),
  file_url VARCHAR(500),
  thumbnail_url VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 插入预设背景音乐
INSERT INTO bgm_presets (preset_id, name, category, description, tags, duration) VALUES
  ('bgm_romantic_01', '浪漫轻音乐', 'romantic', '温馨浪漫的背景音乐', '浪漫,温馨,轻柔', 120.0),
  ('bgm_romantic_02', '甜蜜时刻', 'romantic', '甜蜜爱情的背景音乐', '甜蜜,爱情,幸福', 90.0),
  ('bgm_tension_01', '紧张悬疑', 'tension', '悬疑紧张的背景音乐', '悬疑,紧张,刺激', 150.0),
  ('bgm_tension_02', '惊险时刻', 'tension', '惊险刺激的背景音乐', '惊险,紧张,动作', 180.0),
  ('bgm_happy_01', '欢快愉悦', 'happy', '欢快活泼的背景音乐', '欢快,活泼,轻松', 100.0),
  ('bgm_happy_02', '快乐时光', 'happy', '快乐轻松的背景音乐', '快乐,轻松,阳光', 85.0),
  ('bgm_sad_01', '悲伤抒情', 'sad', '悲伤感人的背景音乐', '悲伤,抒情,感人', 140.0),
  ('bgm_sad_02', '离别时刻', 'sad', '离别伤感的背景音乐', '离别,伤感,回忆', 120.0),
  ('bgm_action_01', '动感节奏', 'action', '动感节奏的背景音乐', '动感,节奏,活力', 110.0),
  ('bgm_action_02', '战斗音乐', 'action', '激烈战斗的背景音乐', '战斗,激烈,热血', 160.0),
  ('bgm_fantasy_01', '奇幻梦境', 'fantasy', '奇幻梦幻的背景音乐', '奇幻,梦幻,神秘', 130.0),
  ('bgm_fantasy_02', '魔法森林', 'fantasy', '魔法奇幻的背景音乐', '魔法,森林,奇幻', 145.0)
ON CONFLICT (preset_id) DO NOTHING;

-- 4. 环境音效预设表
CREATE TABLE IF NOT EXISTS sfx_presets (
  id SERIAL PRIMARY KEY,
  preset_id VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(30) NOT NULL,
  description TEXT,
  tags VARCHAR(200),
  duration DECIMAL(6,2),
  preview_url VARCHAR(500),
  file_url VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 插入预设环境音效
INSERT INTO sfx_presets (preset_id, name, category, description, tags, duration) VALUES
  ('sfx_rain_01', '细雨绵绵', 'weather', '轻柔的雨声', '雨,自然,轻柔', 30.0),
  ('sfx_rain_02', '暴雨倾盆', 'weather', '暴雨雷鸣声', '暴雨,雷电,激烈', 25.0),
  ('sfx_thunder_01', '雷声隆隆', 'weather', '远处的雷声', '雷,自然,沉闷', 8.0),
  ('sfx_wind_01', '微风轻拂', 'weather', '轻柔的风声', '风,自然,轻柔', 20.0),
  ('sfx_wind_02', '狂风呼啸', 'weather', '狂风大作声', '风,自然,强烈', 15.0),
  ('sfx_forest_01', '森林鸟鸣', 'nature', '森林中的鸟叫声', '森林,鸟,自然', 45.0),
  ('sfx_ocean_01', '海浪拍岸', 'nature', '海浪拍打海岸声', '海,波浪,自然', 35.0),
  ('sfx_ocean_02', '深海宁静', 'nature', '深海的宁静声', '海,深,宁静', 40.0),
  ('sfx_city_01', '城市街道', 'urban', '城市街道的环境音', '城市,街道,嘈杂', 60.0),
  ('sfx_city_02', '咖啡馆', 'urban', '咖啡馆的环境音', '咖啡馆,人声,温馨', 50.0),
  ('sfx_office_01', '办公室', 'indoor', '办公室的环境音', '办公室,工作,键盘', 55.0),
  ('sfx_room_01', '温馨房间', 'indoor', '温馨家居环境音', '房间,家居,温馨', 40.0),
  ('sfx_door_01', '开门声', 'action', '开关门的声音', '门,开关,动作', 2.0),
  ('sfx_steps_01', '脚步声', 'action', '行走脚步声', '脚步,行走,动作', 3.0),
  ('sfx_phone_01', '手机铃声', 'alert', '手机来电铃声', '手机,铃声,提醒', 10.0),
  ('sfx_alarm_01', '警报声', 'alert', '紧急警报声', '警报,紧急,警告', 8.0),
  ('sfx_clap_01', '掌声', 'crowd', '观众掌声', '鼓掌,掌声,观众', 5.0),
  ('sfx_crowd_01', '人群喧哗', 'crowd', '人群嘈杂声', '人群,喧哗,嘈杂', 30.0)
ON CONFLICT (preset_id) DO NOTHING;

-- 5. 音频处理记录表 - 记录音频生成任务
CREATE TABLE IF NOT EXISTS audio_tasks (
  id SERIAL PRIMARY KEY,
  task_id VARCHAR(100) UNIQUE NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  scene_audio_id INTEGER REFERENCES scene_audio(id) ON DELETE SET NULL,
  task_type VARCHAR(30) NOT NULL CHECK (task_type IN ('tts', 'lip_sync', 'audio_mix', 'bgm_cut', 'sfx_extract')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  progress INTEGER DEFAULT 0,
  input_params JSONB,
  output_url VARCHAR(500),
  error_message TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_audio_tasks_user_id ON audio_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_audio_tasks_status ON audio_tasks(status);
CREATE INDEX IF NOT EXISTS idx_audio_tasks_task_id ON audio_tasks(task_id);

-- ================================================================
-- 迁移脚本执行说明：
-- 1. 确保在 PostgreSQL 数据库中执行此脚本
-- 2. 执行顺序：按从上到下的顺序执行
-- 3. 如果表已存在，CREATE TABLE IF NOT EXISTS 不会覆盖
-- 4. INSERT ON CONFLICT DO NOTHING 确保重复执行不会报错
-- ================================================================
