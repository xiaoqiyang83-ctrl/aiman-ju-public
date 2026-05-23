/**
 * AIManju v5.3 提示词编译体系迁移脚本
 * 
 * 功能：
 * 1. shots表新增字段用于存储结构化专业提示词
 * 2. 保留原字段兼容前端展示
 * 
 * 新增字段：
 * - visual_prompt_json: JSONB 结构化视觉提示词（lighting/color_palette/character_placement/facial_detail/scene_description/composition）
 * - action_prompt_json: JSONB 动作提示词（physical_action/micro_movement）
 * - emotion_cue_json: JSONB 情绪提示词（primary_emotion/visual_mapping）
 * - scene_reference: VARCHAR(100) 场景@引用标签
 * - narration: TEXT 旁白内容
 * - camera_angle: VARCHAR(50) 摄影机角度
 */

const { pool } = require('../shared');

async function migrate() {
    console.log('[Migration v5.3] 开始提示词编译体系迁移...');
    
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // 检查shots表是否存在
        const tableCheck = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'shots'
            );
        `);
        
        if (!tableCheck.rows[0].exists) {
            console.log('[Migration v5.3] shots表不存在，跳过迁移');
            await client.query('COMMIT');
            return;
        }
        
        // 1. 添加 visual_prompt_json JSONB 字段 - 结构化视觉提示词
        console.log('[Migration v5.3] 添加 visual_prompt_json 字段...');
        await client.query(`
            ALTER TABLE shots 
            ADD COLUMN IF NOT EXISTS visual_prompt_json JSONB DEFAULT '{}'::jsonb
        `);
        
        // 2. 添加 action_prompt_json JSONB 字段 - 动作提示词
        console.log('[Migration v5.3] 添加 action_prompt_json 字段...');
        await client.query(`
            ALTER TABLE shots 
            ADD COLUMN IF NOT EXISTS action_prompt_json JSONB DEFAULT '{}'::jsonb
        `);
        
        // 3. 添加 emotion_cue_json JSONB 字段 - 情绪提示词
        console.log('[Migration v5.3] 添加 emotion_cue_json 字段...');
        await client.query(`
            ALTER TABLE shots 
            ADD COLUMN IF NOT EXISTS emotion_cue_json JSONB DEFAULT '{}'::jsonb
        `);
        
        // 4. 添加 scene_reference VARCHAR 字段 - 场景@引用标签
        console.log('[Migration v5.3] 添加 scene_reference 字段...');
        await client.query(`
            ALTER TABLE shots 
            ADD COLUMN IF NOT EXISTS scene_reference VARCHAR(100) DEFAULT ''
        `);
        
        // 5. 添加 narration 字段用于旁白
        console.log('[Migration v5.3] 添加 narration 字段...');
        await client.query(`
            ALTER TABLE shots 
            ADD COLUMN IF NOT EXISTS narration TEXT DEFAULT ''
        `);
        
        // 6. 添加 camera_angle 字段用于摄影机角度
        console.log('[Migration v5.3] 添加 camera_angle 字段...');
        await client.query(`
            ALTER TABLE shots 
            ADD COLUMN IF NOT EXISTS camera_angle VARCHAR(50) DEFAULT '平视'
        `);
        
        // 7. 创建索引以优化JSONB字段查询
        console.log('[Migration v5.3] 创建索引...');
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_shots_visual_prompt_json 
            ON shots USING GIN (visual_prompt_json)
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_shots_action_prompt_json 
            ON shots USING GIN (action_prompt_json)
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_shots_emotion_cue_json 
            ON shots USING GIN (emotion_cue_json)
        `);
        
        // 创建migrations表（如果不存在）
        await client.query(`
            CREATE TABLE IF NOT EXISTS migrations (
                id SERIAL PRIMARY KEY,
                version VARCHAR(50) UNIQUE NOT NULL,
                description TEXT,
                applied_at TIMESTAMP DEFAULT NOW()
            )
        `);
        
        // 记录迁移日志
        await client.query(`
            INSERT INTO migrations (version, description, applied_at)
            VALUES ('v5.3', '提示词编译体系 - 新增visual_prompt_json/action_prompt_json/emotion_cue_json/scene_reference字段', NOW())
            ON CONFLICT (version) DO NOTHING
        `);
        
        await client.query('COMMIT');
        console.log('[Migration v5.3] 迁移完成！');
        
        // 输出新增字段说明
        console.log('\n========== v5.3 字段说明 ==========');
        console.log('visual_prompt_json JSONB: 结构化视觉提示词');
        console.log('  - lighting: 光影描述（含色温K值）');
        console.log('  - color_palette: 色彩方案（含hex值）');
        console.log('  - character_placement: 角色位置布局');
        console.log('  - facial_detail: 面部细节');
        console.log('  - scene_description: 场景描述');
        console.log('  - composition: 构图法则');
        console.log('\naction_prompt_json JSONB: 动作提示词');
        console.log('  - physical_action: 物理级动作描述');
        console.log('  - micro_movement: 微动作');
        console.log('\nemotion_cue_json JSONB: 情绪提示词');
        console.log('  - primary_emotion: 主要情绪');
        console.log('  - visual_mapping: 视觉映射');
        console.log('\nscene_reference VARCHAR: 场景@引用标签');
        console.log('narration TEXT: 旁白内容');
        console.log('camera_angle VARCHAR: 摄影机角度');
        console.log('=====================================\n');
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[Migration v5.3] 迁移失败:', error.message);
        throw error;
    } finally {
        client.release();
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    migrate()
        .then(() => {
            console.log('[Migration v5.3] 脚本执行成功');
            process.exit(0);
        })
        .catch((err) => {
            console.error('[Migration v5.3] 脚本执行失败:', err);
            process.exit(1);
        });
}

module.exports = { migrate };
