-- ========================================
-- AIManju v3.4 → v3.5 增量迁移
-- 新增字段：视频类型、参考图片/视频、场景拼接视频
-- ========================================

\c aimanju

-- shots表新增字段
ALTER TABLE shots ADD COLUMN IF NOT EXISTS video_type VARCHAR(20) DEFAULT 'text';
ALTER TABLE shots ADD COLUMN IF NOT EXISTS reference_image_url VARCHAR(500) DEFAULT '';
ALTER TABLE shots ADD COLUMN IF NOT EXISTS reference_video_url VARCHAR(500) DEFAULT '';

-- scenes表新增字段（拼接视频）
ALTER TABLE scenes ADD COLUMN IF NOT EXISTS merged_video_url VARCHAR(500) DEFAULT '';
ALTER TABLE scenes ADD COLUMN IF NOT EXISTS merged_video_status VARCHAR(20) DEFAULT 'none';
