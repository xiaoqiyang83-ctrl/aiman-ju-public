-- 音频资产表
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
CREATE INDEX IF NOT EXISTS idx_audio_assets_user_id ON audio_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_audio_assets_project_id ON audio_assets(project_id);
