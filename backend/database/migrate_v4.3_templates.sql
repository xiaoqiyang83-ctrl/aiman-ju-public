-- 漫剧模板表
CREATE TABLE IF NOT EXISTS templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL, -- 霸道总裁、古风、校园、悬疑、都市、玄幻
    description TEXT,
    cover_image TEXT,
    script_template TEXT, -- 剧本框架
    scene_prompts JSONB DEFAULT '[]', -- 分镜提示词模板
    style_config JSONB DEFAULT '{}', -- 风格配置 (LORA, 比例等)
    is_official BOOLEAN DEFAULT true,
    use_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 初始化官方模板数据
INSERT INTO templates (name, category, description, cover_image, script_template, scene_prompts, style_config)
VALUES 
(
    '霸道总裁的合约新娘', 
    '霸道总裁', 
    '经典的都市言情风格，包含豪宅、晚宴、误会等冲突场景。', 
    '/static/templates/president.jpg',
    '第一幕：在繁华的酒会上，[男主]冷冷地看着不小心撞到他的[女主]。\n第二幕：[女主]的家中，[男主]递上一份结婚协议。',
    '[{"title": "酒会偶遇", "content": "华丽的宴会厅，水晶吊灯，男主穿着笔挺西装，神情高冷。"}, {"title": "契约谈判", "content": "昏暗的书房，男主坐在皮质转椅上，将协议推向女主。"}]',
    '{"aspect_ratio": "9:16", "style": "realistic", "lighting": "cinematic"}'
),
(
    '古风·红衣剑客', 
    '古风', 
    '唯美的仙侠武侠风格，强调意境与动作。', 
    '/static/templates/ancient.jpg',
    '第一幕：竹林深处，一名红衣剑客背对镜头，衣袂飘飘。\n第二幕：剑客拔剑，落叶纷飞。',
    '[{"title": "竹林背影", "content": "翠绿的竹林，晨雾缭绕，一抹红色身影若隐若现。"}, {"title": "拔剑瞬间", "content": "特写，手指扣住剑柄，寒光一闪，周围落叶震开。"}]',
    '{"aspect_ratio": "16:9", "style": "anime", "lighting": "soft"}'
),
(
    '校园·迟到的告白', 
    '校园', 
    '清新的日系校园风格，充满青春气息。', 
    '/static/templates/school.jpg',
    '第一幕：夕阳下的教室，[女主]坐在窗边发呆。\n第二幕：操场跑道上，[男主]气喘吁吁地跑来。',
    '[{"title": "窗边沉思", "content": "夕阳斜射进教室，照在女主侧脸上，氛围安静忧郁。"}, {"title": "奔跑告白", "content": "蓝天白云下的塑胶操场，男主穿着校服挥汗如雨地奔跑。"}]',
    '{"aspect_ratio": "9:16", "style": "anime", "lighting": "bright"}'
),
(
    '悬疑·消失的密室', 
    '悬疑', 
    '阴森冷峻的悬疑推理风格。', 
    '/static/templates/mystery.jpg',
    '第一幕：破旧的老宅，门锁被撬开的痕迹。\n第二幕：手电筒的光扫过杂乱的桌面，发现一张泛黄的照片。',
    '[{"title": "密室入口", "content": "阴暗的长廊，木质地板发出吱呀声，一扇半开的门。"}, {"title": "关键证据", "content": "低角度拍摄，光束照在桌面上的旧照片上，灰尘飞扬。"}]',
    '{"aspect_ratio": "2.35:1", "style": "dark_cinematic", "lighting": "dim"}'
),
(
    '玄幻·魔神降世', 
    '玄幻', 
    '大气的玄幻史诗风格，包含特效与宏大场景。', 
    '/static/templates/fantasy.jpg',
    '第一幕：雷云滚滚的天空，一道裂缝缓缓打开。\n第二幕：魔神站在山巅，脚下是万丈深渊。',
    '[{"title": "异象降临", "content": "紫色的雷电劈开乌云，巨大的眼睛在云层后睁开。"}, {"title": "魔神降临", "content": "黑色的铠甲，燃烧的红眼，魔神手持巨剑立于废墟之上。"}]',
    '{"aspect_ratio": "16:9", "style": "digital_art", "lighting": "dramatic"}'
);
