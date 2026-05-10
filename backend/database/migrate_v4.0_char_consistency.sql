-- 角色多角度一致性扩展
ALTER TABLE characters ADD COLUMN IF NOT EXISTS front_image_url TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS side_image_url TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS back_image_url TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS expressions JSONB DEFAULT '[]';
ALTER TABLE characters ADD COLUMN IF NOT EXISTS costumes JSONB DEFAULT '[]';

-- 分镜角度扩展
ALTER TABLE shots ADD COLUMN IF NOT EXISTS character_angle VARCHAR(20); -- front, side, back

-- 迁移旧数据 (如果 image_url 有值，默认填入正面图)
UPDATE characters SET front_image_url = image_url WHERE front_image_url IS NULL AND image_url IS NOT NULL;
