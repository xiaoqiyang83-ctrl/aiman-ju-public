-- AIManJu v4.6 schema sync (idempotent)

-- ===== teams =====
CREATE TABLE IF NOT EXISTS teams (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_teams_owner_id ON teams(owner_id);

CREATE TABLE IF NOT EXISTS team_members (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);

-- ===== projects =====
ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_team_id ON projects(team_id);

-- ===== exports =====
ALTER TABLE exports ADD COLUMN IF NOT EXISTS config JSONB;
ALTER TABLE exports ADD COLUMN IF NOT EXISTS file_path VARCHAR(500);

UPDATE exports
SET file_path = file_url
WHERE file_path IS NULL AND file_url IS NOT NULL;

-- ===== shots =====
ALTER TABLE shots ADD COLUMN IF NOT EXISTS visual_prompt TEXT DEFAULT '';
ALTER TABLE shots ADD COLUMN IF NOT EXISTS original_text TEXT DEFAULT '';

-- widen for movement labels if needed (idempotent)
ALTER TABLE shots ALTER COLUMN camera_movement TYPE VARCHAR(50);

-- backfill (do not overwrite existing values)
UPDATE shots
SET visual_prompt = COALESCE(NULLIF(visual_prompt, ''), NULLIF(visual_description, ''), '')
WHERE visual_prompt IS NULL OR visual_prompt = '';

UPDATE shots
SET original_text = COALESCE(
  NULLIF(original_text, ''),
  NULLIF(dialogue, ''),
  NULLIF(action_description, ''),
  NULLIF(visual_description, ''),
  ''
)
WHERE original_text IS NULL OR original_text = '';
