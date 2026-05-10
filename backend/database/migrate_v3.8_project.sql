-- AIManju v3.8 项目管理功能迁移
-- 数据库：aimanju，用户：postgres
-- 创建时间：2024年

-- ============================================
-- 1. 项目版本快照表
-- ============================================
CREATE TABLE IF NOT EXISTS project_versions (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    version_name VARCHAR(100) NOT NULL,
    description TEXT,
    snapshot JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_project_versions_project_id ON project_versions(project_id);
CREATE INDEX IF NOT EXISTS idx_project_versions_user_id ON project_versions(user_id);
CREATE INDEX IF NOT EXISTS idx_project_versions_created_at ON project_versions(created_at DESC);

COMMENT ON TABLE project_versions IS '项目版本快照表';
COMMENT ON COLUMN project_versions.snapshot IS '项目完整快照JSON，包含剧本、场景、镜头、角色等数据';

-- ============================================
-- 2. 导出任务表
-- ============================================
CREATE TABLE IF NOT EXISTS exports (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    format VARCHAR(20) DEFAULT 'mp4',
    status VARCHAR(20) DEFAULT 'pending',
    file_url VARCHAR(500),
    file_size BIGINT DEFAULT 0,
    duration DECIMAL(8,2) DEFAULT 0,
    progress INTEGER DEFAULT 0,
    error_message TEXT,
    export_range VARCHAR(50) DEFAULT 'all',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_exports_project_id ON exports(project_id);
CREATE INDEX IF NOT EXISTS idx_exports_user_id ON exports(user_id);
CREATE INDEX IF NOT EXISTS idx_exports_status ON exports(status);
CREATE INDEX IF NOT EXISTS idx_exports_created_at ON exports(created_at DESC);

COMMENT ON TABLE exports IS '导出任务表';
COMMENT ON COLUMN exports.status IS 'pending-等待处理, processing-处理中, completed-已完成, failed-失败';
COMMENT ON COLUMN exports.export_range IS 'all-全部场景, selected-选中场景';

-- ============================================
-- 3. projects表新增字段
-- ============================================
ALTER TABLE projects ADD COLUMN IF NOT EXISTS cover_image VARCHAR(500);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS current_version INTEGER DEFAULT 1;

COMMENT ON COLUMN projects.cover_image IS '项目封面图片URL';
COMMENT ON COLUMN projects.current_version IS '当前版本号';

-- ============================================
-- 4. 更新现有表注释（可选）
-- ============================================
COMMENT ON TABLE projects IS '项目表 - AI漫剧项目管理';

-- ============================================
-- 验证迁移结果
-- ============================================
DO $$
BEGIN
    -- 验证project_versions表
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'project_versions'
    ) THEN
        RAISE NOTICE '✓ project_versions表创建成功';
    ELSE
        RAISE WARNING '✗ project_versions表创建失败';
    END IF;
    
    -- 验证exports表
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'exports'
    ) THEN
        RAISE NOTICE '✓ exports表创建成功';
    ELSE
        RAISE WARNING '✗ exports表创建失败';
    END IF;
    
    -- 验证projects表新增字段
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'cover_image'
    ) THEN
        RAISE NOTICE '✓ projects.cover_image字段创建成功';
    ELSE
        RAISE WARNING '✗ projects.cover_image字段创建失败';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'current_version'
    ) THEN
        RAISE NOTICE '✓ projects.current_version字段创建成功';
    ELSE
        RAISE WARNING '✗ projects.current_version字段创建失败';
    END IF;
END $$;

-- ============================================
-- 回滚脚本（如需回滚，执行以下SQL）
-- ============================================
-- DROP TABLE IF EXISTS exports;
-- DROP TABLE IF EXISTS project_versions;
-- ALTER TABLE projects DROP COLUMN IF EXISTS cover_image;
-- ALTER TABLE projects DROP COLUMN IF EXISTS current_version;
