-- v6.3 分镜交互功能迁移
-- 为shots表添加image_prompt字段

ALTER TABLE shots ADD COLUMN IF NOT EXISTS image_prompt TEXT DEFAULT '';
