-- ========================================
-- AIManju 数据库初始化脚本 v3.4
-- 幂等设计：先删库再建库，每次执行都是干净状态
-- 6张核心表：users, projects, scripts, characters, scenes, shots
-- 场景→镜头 两级分镜结构
-- v3.4新增：shots表视频相关字段(video_url, video_status, video_prompt)
-- 执行前请先断开前后端服务！
-- ========================================

-- 第一步：断开所有连接到aimanju的会话
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'aimanju';

-- 第二步：删库重建
DROP DATABASE IF EXISTS aimanju;
CREATE DATABASE aimanju;

-- 第三步：切换到aimanju数据库
\c aimanju

-- 第四步：按外键依赖顺序建表

-- 1. 用户表
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. 项目表
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. 剧本表
-- 关键约定：project_id 不能为空！每个剧本必须属于一个项目
CREATE TABLE IF NOT EXISTS scripts (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. 角色表
-- 关键约定：script_id 不能为空！每个角色必须属于一个剧本
CREATE TABLE IF NOT EXISTS characters (
    id SERIAL PRIMARY KEY,
    script_id INTEGER REFERENCES scripts(id) ON DELETE CASCADE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT DEFAULT '',
    image_url TEXT,
    reference_image TEXT,
    front_image_url TEXT,
    side_image_url TEXT,
    back_image_url TEXT,
    expressions JSONB DEFAULT '[]',
    costumes JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. 场景表（新增episode字段）
CREATE TABLE IF NOT EXISTS scenes (
    id SERIAL PRIMARY KEY,
    script_id INTEGER REFERENCES scripts(id) ON DELETE CASCADE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    episode VARCHAR(20) DEFAULT '',
    scene_number VARCHAR(50) DEFAULT '',
    title VARCHAR(255) DEFAULT '',
    location VARCHAR(255) DEFAULT '',
    time_of_day VARCHAR(50) DEFAULT '',
    content TEXT DEFAULT '',
    characters TEXT DEFAULT '',
    status VARCHAR(20) DEFAULT 'pending',
    scene_image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. 镜头/分镜表
-- v3.4新增字段：video_url, video_status, video_prompt
CREATE TABLE IF NOT EXISTS shots (
    id SERIAL PRIMARY KEY,
    scene_id INTEGER REFERENCES scenes(id) ON DELETE CASCADE NOT NULL,
    script_id INTEGER REFERENCES scripts(id) ON DELETE CASCADE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    shot_number INTEGER DEFAULT 1,
    shot_type VARCHAR(20) DEFAULT '中景',
    camera_movement VARCHAR(50) DEFAULT '固定',
    visual_description TEXT DEFAULT '',
    visual_prompt TEXT DEFAULT '',
    original_text TEXT DEFAULT '',
    dialogue TEXT DEFAULT '',
    action_description TEXT DEFAULT '',
    duration INTEGER DEFAULT 3,
    characters TEXT DEFAULT '',
    character_id INTEGER REFERENCES characters(id) ON DELETE SET NULL,
    character_angle VARCHAR(20) DEFAULT 'front',
    scene_image_url TEXT,
    video_url VARCHAR(500) DEFAULT '',
    video_status VARCHAR(20) DEFAULT 'none',
    video_prompt TEXT DEFAULT '',
    job_id VARCHAR(100),
    audio_url TEXT,
    lip_sync_status VARCHAR(20) DEFAULT 'none',
    lip_sync_video_url VARCHAR(500),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audio_assets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    audio_type VARCHAR(20) DEFAULT 'voice', -- bgm, sfx, voice
    duration DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_scripts_project_id ON scripts(project_id);
CREATE INDEX IF NOT EXISTS idx_scripts_user_id ON scripts(user_id);
CREATE INDEX IF NOT EXISTS idx_characters_script_id ON characters(script_id);
CREATE INDEX IF NOT EXISTS idx_scenes_script_id ON scenes(script_id);
CREATE INDEX IF NOT EXISTS idx_shots_scene_id ON shots(scene_id);
CREATE INDEX IF NOT EXISTS idx_shots_script_id ON shots(script_id);

-- 插入默认管理员用户（密码：admin123）
-- bcrypt hash of 'admin123'
INSERT INTO users (username, password)
SELECT 'admin', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin');
