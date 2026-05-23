-- ================================================================
-- AIManju v3.8 完整数据库迁移
-- 一句一句执行，不要整段粘贴
-- ================================================================

-- ========== 先删旧表（按外键依赖顺序） ==========
DROP TABLE IF EXISTS audio_tasks CASCADE;

DROP TABLE IF EXISTS sfx_presets CASCADE;

DROP TABLE IF EXISTS bgm_presets CASCADE;

DROP TABLE IF EXISTS tts_voices CASCADE;

DROP TABLE IF EXISTS scene_audio CASCADE;

DROP TABLE IF EXISTS task_jobs CASCADE;

DROP TABLE IF EXISTS exports CASCADE;

DROP TABLE IF EXISTS project_versions CASCADE;

-- ========== 建新表 ==========

CREATE TABLE scene_audio (
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
  status VARCHAR(20) DEFAULT 'pending',
  job_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_scene_audio_scene_id ON scene_audio(scene_id);

CREATE INDEX idx_scene_audio_user_id ON scene_audio(user_id);

CREATE INDEX idx_scene_audio_script_id ON scene_audio(script_id);

CREATE TABLE tts_voices (
  id SERIAL PRIMARY KEY,
  voice_id VARCHAR(50) UNIQUE NOT NULL,
  voice_name VARCHAR(100) NOT NULL,
  voice_code VARCHAR(50) NOT NULL,
  gender VARCHAR(10),
  language VARCHAR(20) DEFAULT 'zh-CN',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO tts_voices (voice_id, voice_name, voice_code, gender, language, description) VALUES
  ('zh-CN-XiaoxiaoNeural', '晓晓（温柔女声）', 'xiaoxiao', 'female', 'zh-CN', '温柔亲和的年轻女声'),
  ('zh-CN-YunxiNeural', '云希（活力男声）', 'yunxi', 'male', 'zh-CN', '阳光活力的年轻男声'),
  ('zh-CN-YunyangNeural', '云扬（专业男声）', 'yunyang', 'male', 'zh-CN', '专业播报的男声'),
  ('zh-CN-Xiaoyi', '小艺（甜美女声）', 'xiaoyi', 'female', 'zh-CN', '甜美可爱的女声'),
  ('zh-CN-Yunye', '云野（成熟男声）', 'yunye', 'male', 'zh-CN', '成熟稳重的中年男声'),
  ('zh-CN-Xiaobei', '小蓓（知性女声）', 'xiaobei', 'female', 'zh-CN', '知性优雅的女声'),
  ('zh-CN-Yunxia', '云夏（青春女声）', 'yunxia', 'female', 'zh-CN', '青春活泼的女声'),
  ('zh-CN-Yunjian', '云健（阳光男声）', 'yunjian', 'male', 'zh-CN', '阳光健康的男声');

CREATE TABLE bgm_presets (
  id SERIAL PRIMARY KEY,
  preset_id VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(30) NOT NULL,
  description TEXT,
  tags VARCHAR(200),
  duration DECIMAL(6,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO bgm_presets (preset_id, name, category, description, tags, duration) VALUES
  ('bgm_romantic_01', '浪漫轻音乐', 'romantic', '温馨浪漫', '浪漫,温馨', 120.0),
  ('bgm_tension_01', '紧张悬疑', 'tension', '悬疑紧张', '悬疑,紧张', 150.0),
  ('bgm_happy_01', '欢快愉悦', 'happy', '欢快活泼', '欢快,活泼', 100.0),
  ('bgm_sad_01', '悲伤抒情', 'sad', '悲伤感人', '悲伤,抒情', 140.0),
  ('bgm_action_01', '动感节奏', 'action', '动感节奏', '动感,节奏', 110.0),
  ('bgm_fantasy_01', '奇幻梦境', 'fantasy', '奇幻梦幻', '奇幻,梦幻', 130.0);

CREATE TABLE sfx_presets (
  id SERIAL PRIMARY KEY,
  preset_id VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(30) NOT NULL,
  description TEXT,
  tags VARCHAR(200),
  duration DECIMAL(6,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO sfx_presets (preset_id, name, category, description, tags, duration) VALUES
  ('sfx_rain_01', '细雨绵绵', 'weather', '轻柔雨声', '雨,自然', 30.0),
  ('sfx_thunder_01', '雷声隆隆', 'weather', '远处雷声', '雷,自然', 8.0),
  ('sfx_wind_01', '微风轻拂', 'weather', '轻柔风声', '风,自然', 20.0),
  ('sfx_forest_01', '森林鸟鸣', 'nature', '鸟叫声', '森林,鸟', 45.0),
  ('sfx_ocean_01', '海浪拍岸', 'nature', '海浪声', '海,波浪', 35.0),
  ('sfx_city_01', '城市街道', 'urban', '街道环境音', '城市,街道', 60.0),
  ('sfx_door_01', '开门声', 'action', '开关门', '门,动作', 2.0),
  ('sfx_phone_01', '手机铃声', 'alert', '来电铃声', '手机,提醒', 10.0),
  ('sfx_crowd_01', '人群喧哗', 'crowd', '人群嘈杂', '人群,嘈杂', 30.0);

CREATE TABLE audio_tasks (
  id SERIAL PRIMARY KEY,
  task_id VARCHAR(100) UNIQUE NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  scene_audio_id INTEGER REFERENCES scene_audio(id) ON DELETE SET NULL,
  task_type VARCHAR(30) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  input_params JSONB,
  output_url VARCHAR(500),
  error_message TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE project_versions (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  version_name VARCHAR(100) NOT NULL,
  description TEXT,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_project_versions_project_id ON project_versions(project_id);

CREATE TABLE exports (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  format VARCHAR(20) DEFAULT 'mp4',
  status VARCHAR(20) DEFAULT 'pending',
  file_url VARCHAR(500),
  file_size BIGINT DEFAULT 0,
  duration DECIMAL(8,2) DEFAULT 0,
  progress INTEGER DEFAULT 0,
  error_message TEXT,
  export_range VARCHAR(50) DEFAULT 'all',
  job_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_exports_project_id ON exports(project_id);

CREATE TABLE task_jobs (
  id SERIAL PRIMARY KEY,
  job_id VARCHAR(100) UNIQUE NOT NULL,
  queue_name VARCHAR(50) NOT NULL,
  task_type VARCHAR(50) NOT NULL,
  ref_id INTEGER,
  ref_type VARCHAR(20),
  user_id INTEGER NOT NULL REFERENCES users(id),
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  params JSONB,
  result JSONB,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_task_jobs_job_id ON task_jobs(job_id);

CREATE INDEX idx_task_jobs_user_id ON task_jobs(user_id);

-- ========== 给已有表加新字段 ==========

ALTER TABLE projects ADD COLUMN IF NOT EXISTS cover_image VARCHAR(500);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS current_version INTEGER DEFAULT 1;

ALTER TABLE shots ADD COLUMN IF NOT EXISTS job_id VARCHAR(100);

ALTER TABLE shots ADD COLUMN IF NOT EXISTS character_id INTEGER REFERENCES characters(id) ON DELETE SET NULL;
ALTER TABLE shots ADD COLUMN IF NOT EXISTS scene_image_url TEXT;

ALTER TABLE characters ADD COLUMN IF NOT EXISTS job_id VARCHAR(100);

ALTER TABLE characters ADD COLUMN IF NOT EXISTS image_status VARCHAR(20) DEFAULT 'pending';

-- ========== 触发器 ==========

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_task_jobs_updated_at ON task_jobs;

CREATE TRIGGER update_task_jobs_updated_at
  BEFORE UPDATE ON task_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_exports_updated_at ON exports;

CREATE TRIGGER update_exports_updated_at
  BEFORE UPDATE ON exports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- v3.9: 为scenes表添加场景参考图字段
ALTER TABLE scenes ADD COLUMN IF NOT EXISTS scene_image_url TEXT;
