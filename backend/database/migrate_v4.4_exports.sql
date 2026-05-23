-- AIManJu v4.4 exports: config & file_path

ALTER TABLE exports ADD COLUMN IF NOT EXISTS config JSONB;
ALTER TABLE exports ADD COLUMN IF NOT EXISTS file_path VARCHAR(500);

UPDATE exports
SET file_path = file_url
WHERE file_path IS NULL AND file_url IS NOT NULL;

