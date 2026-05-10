-- AIManju v3.8 任务队列数据库迁移
-- 创建任务队列表和相关字段

-- =============================================
-- 任务队列表（用于持久化任务记录）
-- =============================================
CREATE TABLE IF NOT EXISTS task_jobs (
  id SERIAL PRIMARY KEY,
  job_id VARCHAR(100) UNIQUE, -- BullMQ job ID
  queue_name VARCHAR(50) NOT NULL,
  task_type VARCHAR(50) NOT NULL,
  ref_id INTEGER, -- 关联的shot/scene/export ID
  ref_type VARCHAR(20), -- 'shot', 'scene_audio', 'export', 'image'
  user_id INTEGER NOT NULL REFERENCES users(id),
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending', -- pending, active, completed, failed, cancelled
  progress INTEGER DEFAULT 0, -- 0-100
  params JSONB, -- 任务参数字段
  result JSONB, -- 任务结果字段
  error_message TEXT, -- 错误信息
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_task_jobs_job_id ON task_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_task_jobs_user_id ON task_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_task_jobs_status ON task_jobs(status);
CREATE INDEX IF NOT EXISTS idx_task_jobs_project_id ON task_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_task_jobs_ref ON task_jobs(ref_id, ref_type);

-- =============================================
-- shots表添加job_id字段（视频任务关联）
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shots' AND column_name = 'job_id'
  ) THEN
    ALTER TABLE shots ADD COLUMN job_id VARCHAR(100);
  END IF;
  
  -- 添加video_status字段（如果不存在）
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shots' AND column_name = 'video_status'
  ) THEN
    ALTER TABLE shots ADD COLUMN video_status VARCHAR(20) DEFAULT 'pending';
  END IF;
END $$;

-- =============================================
-- scene_audio表添加job_id字段（音频任务关联）
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'scene_audio' AND column_name = 'job_id'
  ) THEN
    ALTER TABLE scene_audio ADD COLUMN job_id VARCHAR(100);
  END IF;
END $$;

-- =============================================
-- exports表添加job_id字段（导出任务关联）
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'exports' AND column_name = 'job_id'
  ) THEN
    ALTER TABLE exports ADD COLUMN job_id VARCHAR(100);
  END IF;
END $$;

-- =============================================
-- 字符图/分镜图表添加job_id字段（图片任务关联）
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'characters' AND column_name = 'job_id'
  ) THEN
    ALTER TABLE characters ADD COLUMN job_id VARCHAR(100);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'characters' AND column_name = 'image_status'
  ) THEN
    ALTER TABLE characters ADD COLUMN image_status VARCHAR(20) DEFAULT 'pending';
  END IF;
END $$;

-- =============================================
-- 更新updated_at的触发器函数
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 为task_jobs表创建触发器
DROP TRIGGER IF EXISTS update_task_jobs_updated_at ON task_jobs;
CREATE TRIGGER update_task_jobs_updated_at
  BEFORE UPDATE ON task_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
