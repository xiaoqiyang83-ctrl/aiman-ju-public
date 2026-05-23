-- ========================================
-- AIManju v5.0 角色一致性系统扩展
-- 新增：6层身份锚点、角色变体表
-- ========================================

-- 1. 扩展characters表 - 6层身份锚点系统
ALTER TABLE characters ADD COLUMN IF NOT EXISTS identity_anchors JSONB DEFAULT '{}';
ALTER TABLE characters ADD COLUMN IF NOT EXISTS negative_prompt JSONB DEFAULT '{}';
ALTER TABLE characters ADD COLUMN IF NOT EXISTS consistency_elements JSONB DEFAULT '{}';

-- 2. 扩展characters表 - 角色基础属性
ALTER TABLE characters ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
ALTER TABLE characters ADD COLUMN IF NOT EXISTS age VARCHAR(20);
ALTER TABLE characters ADD COLUMN IF NOT EXISTS personality TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS role_desc TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS appearance TEXT;

-- 3. 扩展characters表 - 视觉提示词
ALTER TABLE characters ADD COLUMN IF NOT EXISTS visual_prompt_en TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS visual_prompt_zh TEXT;

-- 4. 新建角色变体表（换装/阶段变体）
CREATE TABLE IF NOT EXISTS character_variations (
    id SERIAL PRIMARY KEY,
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL DEFAULT '默认变体',
    description TEXT DEFAULT '',
    
    -- 视觉提示词
    visual_prompt TEXT DEFAULT '',
    visual_prompt_zh TEXT DEFAULT '',
    
    -- 参考图
    reference_image TEXT,
    
    -- 变体属性
    is_stage_variation BOOLEAN DEFAULT false,  -- true=阶段变体(如成长), false=换装变体(如衣服)
    episode_range VARCHAR(50) DEFAULT '',       -- 适用的集数范围，如 "1-10"
    age_description VARCHAR(100) DEFAULT '',    -- 年龄描述，如 "少年时期"
    stage_description VARCHAR(100) DEFAULT '',  -- 阶段描述，如 "第一次变身"
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. 创建索引
CREATE INDEX IF NOT EXISTS idx_variations_character_id ON character_variations(character_id);

-- 6. 添加注释
COMMENT ON COLUMN characters.identity_anchors IS '6层身份锚点JSON: {gender, age, physique, face, hair, clothing}';
COMMENT ON COLUMN characters.negative_prompt IS '负面提示词JSON: {style, composition, quality}';
COMMENT ON COLUMN characters.consistency_elements IS '一致性元素JSON: {key_features, avoid_conflicts}';
COMMENT ON COLUMN characters.visual_prompt_en IS '英文视觉提示词(编译后)';
COMMENT ON COLUMN characters.visual_prompt_zh IS '中文视觉提示词(编译后)';
