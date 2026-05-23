-- 口型同步扩展
ALTER TABLE shots ADD COLUMN IF NOT EXISTS lip_sync_status VARCHAR(20) DEFAULT 'none'; -- none, processing, completed, failed
ALTER TABLE shots ADD COLUMN IF NOT EXISTS lip_sync_video_url VARCHAR(500);
