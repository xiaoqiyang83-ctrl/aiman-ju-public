-- ========================================
-- AIManju v5.1 shots表字段补齐
-- 修复：character_id/scene_image_url等字段可能缺失
-- ========================================

-- shots表字段补齐
ALTER TABLE shots ADD COLUMN IF NOT EXISTS character_id INTEGER REFERENCES characters(id) ON DELETE SET NULL;
ALTER TABLE shots ADD COLUMN IF NOT EXISTS character_angle VARCHAR(20) DEFAULT 'front';
ALTER TABLE shots ADD COLUMN IF NOT EXISTS scene_image_url TEXT;

-- image_prompt字段（v5.0设计规格中的三层提示词）
ALTER TABLE shots ADD COLUMN IF NOT EXISTS image_prompt TEXT;
ALTER TABLE shots ADD COLUMN IF NOT EXISTS image_prompt_zh TEXT;
ALTER TABLE shots ADD COLUMN IF NOT EXISTS end_frame_prompt TEXT;
ALTER TABLE shots ADD COLUMN IF NOT EXISTS end_frame_prompt_zh TEXT;
ALTER TABLE shots ADD COLUMN IF NOT EXISTS needs_end_frame BOOLEAN DEFAULT FALSE;
ALTER TABLE shots ADD COLUMN IF NOT EXISTS video_prompt TEXT;
ALTER TABLE shots ADD COLUMN IF NOT EXISTS video_prompt_zh TEXT;
ALTER TABLE shots ADD COLUMN IF NOT EXISTS character_ids TEXT[] DEFAULT '{}';
ALTER TABLE shots ADD COLUMN IF NOT EXISTS emotion_tags TEXT[] DEFAULT '{}';

-- scenes表字段补齐
ALTER TABLE scenes ADD COLUMN IF NOT EXISTS scene_image_url TEXT;

-- characters表字段补齐（如果migrate_v5.0没跑过）
ALTER TABLE characters ADD COLUMN IF NOT EXISTS identity_anchors JSONB DEFAULT '{}';
ALTER TABLE characters ADD COLUMN IF NOT EXISTS negative_prompt JSONB DEFAULT '{}';
ALTER TABLE characters ADD COLUMN IF NOT EXISTS consistency_elements JSONB DEFAULT '{}';
ALTER TABLE characters ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
ALTER TABLE characters ADD COLUMN IF NOT EXISTS age VARCHAR(20);
ALTER TABLE characters ADD COLUMN IF NOT EXISTS personality TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS role_desc TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS appearance TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS visual_prompt_en TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS visual_prompt_zh TEXT;
