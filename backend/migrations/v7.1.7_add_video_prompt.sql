-- v7.1.7: 添加 video_prompt 字段到 shots 表
-- 用于视频生成时的自定义提示词
ALTER TABLE IF EXISTS shots ADD COLUMN IF NOT EXISTS video_prompt TEXT DEFAULT NULL;
