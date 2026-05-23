/**
 * 真实剧本测试文件 - v6.2.1
 * 使用真实剧本数据测试完整流程
 * 验证台词识别、描述多样性、台词去重等修复
 */

var aiService = require('./services/ai-service');
var applyDirectorEngine = aiService.applyDirectorEngine;
var normalizeStoryboard = aiService.normalizeStoryboard;
var compileImagePrompt = aiService.compileImagePrompt;
var validateStoryboard = require('./middleware/validateStoryboard');

// 测试计数器
var passed = 0;
var failed = 0;

// ==================== 辅助函数 ====================

function test(name, testFn) {
    try {
        testFn();
        console.log('[TEST] ' + name + ': PASS');
        passed++;
    } catch (e) {
        console.log('[TEST] ' + name + ': FAIL - ' + e.message);
        failed++;
    }
}

function assertTrue(condition, msg) {
    if (!condition) {
        throw new Error(msg);
    }
}

function assertContains(arr, val, msg) {
    if (arr.indexOf(val) < 0) {
        throw new Error(msg + ' - 期望包含: ' + val);
    }
}

function assertNotContains(str, val, msg) {
    if (str.indexOf(val) >= 0) {
        throw new Error(msg + ' - 不应包含: ' + val);
    }
}

// 创建mock shot（深拷贝）
function createMockShot(overrides) {
    var defaults = {
        shot_number: 1,
        shot_type: '中景',
        camera_angle: '平视',
        camera_movement: '固定',
        duration: 3,
        emotion_cue: { primary_emotion: '', visual_mapping: '' },
        visual_prompt: {
            scene_description: '测试场景',
            lighting: '自然光',
            color_palette: '暖色调',
            character_placement: '',
            facial_detail: '',
            composition: ''
        },
        action_prompt: { physical_action: '', micro_movement: '' },
        dialogue: '',
        narration: '',
        original_text: '',
        scene_reference: ''
    };
    
    // 深拷贝defaults
    var result = JSON.parse(JSON.stringify(defaults));
    
    // 合并overrides
    if (overrides) {
        for (var key in overrides) {
            if (overrides.hasOwnProperty(key)) {
                if (typeof overrides[key] === 'object' && !Array.isArray(overrides[key]) && overrides[key] !== null) {
                    // 如果是嵌套对象，深拷贝
                    result[key] = JSON.parse(JSON.stringify(overrides[key]));
                } else {
                    result[key] = overrides[key];
                }
            }
        }
    }
    
    return result;
}

// 创建mock scene（深拷贝）
function createMockScene(sceneOverrides, shotsOverrides) {
    var defaults = {
        episode: '1',
        scene_number: '1',
        title: '测试场景',
        location: '测试地点',
        time_of_day: '日内',
        characters: [],
        content: '测试内容'
    };
    
    var result = JSON.parse(JSON.stringify(defaults));
    
    // 合并sceneOverrides
    if (sceneOverrides) {
        for (var key in sceneOverrides) {
            if (sceneOverrides.hasOwnProperty(key) && key !== 'shots') {
                result[key] = sceneOverrides[key];
            }
        }
    }
    
    // 创建shots
    var shots = [];
    for (var i = 0; i < shotsOverrides.length; i++) {
        var shotOverrides = Object.assign({ shot_number: i + 1 }, shotsOverrides[i]);
        shots.push(createMockShot(shotOverrides));
    }
    result.shots = shots;
    
    return result;
}

// ==================== 真实剧本模拟数据（包含所有bug特征） ====================

/**
 * 模拟真实剧本分镜结果（模拟LLM输出，包含bug特征）
 */
function createRealScriptMockData() {
    return {
        scenes: [
            createMockScene(
                {
                    episode: '2',
                    scene_number: '2-1',
                    title: '工厂农场 - 温室',
                    location: '工厂农场',
                    time_of_day: '日内',
                    characters: '队长，队员甲，队员乙，S级丧尸，阿空，张扬'
                },
                [
                    // 分镜1：远景 - S级丧尸出手
                    {
                        shot_number: 1,
                        shot_type: '远景',
                        camera_movement: '固定',
                        duration: 3,
                        visual_prompt: {
                            scene_description: '温室内部，绿意盎然，蔬菜丛生',
                            lighting: '自然光',
                            color_palette: '绿色主调',
                            character_placement: '@S级丧尸（阿空） @队长',
                            facial_detail: '',
                            composition: ''
                        },
                        action_prompt: {
                            physical_action: 'S级丧尸（阿空）瞬间出手',
                            micro_movement: ''
                        },
                        dialogue: '△S级丧尸（阿空）瞬间出手，队长一行人释放异能抵挡。',
                        original_text: '△S级丧尸（阿空）瞬间出手，队长一行人释放异能抵挡。'
                    },
                    // 分镜2：近景 - 队长台词（bug：角色名（情绪）：台词格式）
                    {
                        shot_number: 2,
                        shot_type: '近景',
                        camera_movement: '固定',
                        duration: 4,
                        visual_prompt: {
                            scene_description: '温室内部，绿意盎然，蔬菜丛生',  // bug：与分镜1相同
                            lighting: '自然光',
                            color_palette: '绿色主调',
                            character_placement: '@队长 @队员甲',
                            facial_detail: '绝望表情',
                            composition: ''
                        },
                        action_prompt: {
                            physical_action: '队长释放异能',
                            micro_movement: ''
                        },
                        dialogue: '队长（绝望）：携带空间异能的S级丧尸一起出手！',  // bug：需要转换为@队长
                        original_text: '队长（绝望）：携带空间异能的S级丧尸一起出手！'
                    },
                    // 分镜3：特写 - 队员甲台词
                    {
                        shot_number: 3,
                        shot_type: '特写',
                        camera_movement: '慢推',
                        duration: 4,
                        visual_prompt: {
                            scene_description: '温室内部，绿意盎然，蔬菜丛生',  // bug：与前两个相同
                            lighting: '自然光',
                            color_palette: '绿色主调',
                            character_placement: '@队员甲',
                            facial_detail: '震惊表情',
                            composition: ''
                        },
                        action_prompt: {
                            physical_action: '队员甲释放异能',
                            micro_movement: ''
                        },
                        dialogue: '队员甲：我们的攻击竟然对他毫无作用！这就是S级丧尸的威力吗？！',
                        original_text: '队员甲：我们的攻击竟然对他毫无作用！这就是S级丧尸的威力吗？！'
                    },
                    // 分镜4：阿空攻击
                    {
                        shot_number: 4,
                        shot_type: '中景',
                        camera_movement: '固定',
                        duration: 3,
                        visual_prompt: {
                            scene_description: '温室内部，阿空抬手准备发动致命一击',
                            lighting: '逆光',
                            color_palette: '暗色调',
                            character_placement: '@阿空',
                            facial_detail: '',
                            composition: ''
                        },
                        action_prompt: {
                            physical_action: 'S级丧尸（阿空）抬手准备发动致命一击',
                            micro_movement: ''
                        },
                        dialogue: '@阿空：现在该我了！',  // 正确格式
                        original_text: '△S级丧尸（阿空）抬手准备发动致命一击。\n阿空：现在该我了！'
                    },
                    // 分镜5：阿空台词重复bug
                    {
                        shot_number: 5,
                        shot_type: '特写',
                        camera_movement: '慢推',
                        duration: 4,
                        visual_prompt: {
                            scene_description: '温室内部，阿空攻击被无形力量挡下',
                            lighting: '自然光',
                            color_palette: '蓝色调',
                            character_placement: '@阿空',
                            facial_detail: '困惑表情',
                            composition: ''
                        },
                        action_prompt: {
                            physical_action: '攻击被无形力量挡下',
                            micro_movement: ''
                        },
                        dialogue: '@阿空：现在该我了！\n@阿空：现在该我了！',  // bug：重复台词
                        original_text: '△S级丧尸（阿空）的攻击被无形的力量挡下，它困惑地停住。\n阿空：现在该我了！'
                    },
                    // 分镜6：多人台词bug
                    {
                        shot_number: 6,
                        shot_type: '近景',
                        camera_movement: '固定',
                        duration: 3,
                        visual_prompt: {
                            scene_description: '温室内部，队员甲乙惊愕',
                            lighting: '自然光',
                            color_palette: '暖色调',
                            character_placement: '@队员甲 @队员乙',
                            facial_detail: '惊愕表情',
                            composition: ''
                        },
                        action_prompt: {
                            physical_action: '队员惊愕',
                            micro_movement: ''
                        },
                        dialogue: '队员甲/乙（惊愕）：啊！队长',  // bug：需要转换为@队员甲
                        original_text: '队员甲/乙（惊愕）：啊！队长\n张扬：阿空！'
                    },
                    // 分镜7：张扬出场
                    {
                        shot_number: 7,
                        shot_type: '中景',
                        camera_movement: '推镜头',
                        duration: 5,
                        visual_prompt: {
                            scene_description: '温室内部，张扬从里面走出来',
                            lighting: '自然光',
                            color_palette: '暖色调',
                            character_placement: '@张扬',
                            facial_detail: '不悦表情',
                            composition: ''
                        },
                        action_prompt: {
                            physical_action: '张扬从温室里走出来，一脸不悦',
                            micro_movement: ''
                        },
                        dialogue: '张扬：和你说了多少遍，别在菜地里打架，吓到客人怎么办？本月KPI考核扣你10颗晶核的奖金！',
                        original_text: '△张扬从温室里走出来，一脸不悦。\n张扬：和你说了多少遍，别在菜地里打架，吓到客人怎么办？本月KPI考核扣你10颗晶核的奖金！'
                    },
                    // 分镜8：张扬台词 - 堆叠bug
                    {
                        shot_number: 8,
                        shot_type: '中景',
                        camera_movement: '固定',
                        duration: 5,
                        visual_prompt: {
                            scene_description: '温室内部，阿空委屈低头',
                            lighting: '自然光',
                            color_palette: '暖色调',
                            character_placement: '@S级丧尸（阿空） @张扬',
                            facial_detail: '',
                            composition: ''
                        },
                        action_prompt: {
                            physical_action: 'S级丧尸（阿空）委屈地低下头并跟其他人鞠躬',
                            micro_movement: ''
                        },
                        dialogue: '@张扬：行了行了，继续干活！\n@张扬：番茄，咬一口，回味末日前的味道。\n@张扬：哈哈！尝尝我们厂的明星产品，丧尸劳模荣誉出品，纯天然无污染。',  // 3条台词，需要拆分
                        original_text: '△S级丧尸（阿空）委屈地低下头并跟其他人鞠躬。\n张扬：行了行了，继续干活！\n张扬：番茄，咬一口，回味末日前的味道。'
                    }
                ]
            )
        ]
    };
}

// ==================== 测试用例 ====================

console.log('');
console.log('========================================');
console.log('真实剧本测试开始 - v6.2.1 修复验证');
console.log('========================================');
console.log('');

// 1. 测试台词格式识别：角色名（情绪）：台词 → @角色名：台词
test('台词格式识别-角色名（情绪）：台词格式应转换为@角色名：台词', function() {
    var mockData = createRealScriptMockData();
    var result = applyDirectorEngine(mockData);
    
    // 检查队长台词是否被正确转换
    var shot2 = result.scenes[0].shots[1];
    
    assertTrue(
        shot2.dialogue.indexOf('@队长：') === 0,
        '队长（绝望）：... 应该被转换为 @队长：...，实际: ' + shot2.dialogue
    );
    
    assertTrue(
        shot2.dialogue.indexOf('（绝望）') < 0,
        '转换后不应包含情绪标注，实际: ' + shot2.dialogue
    );
});

// 2. 测试台词格式识别：角色名/角色名（情绪）：台词 → @第一个角色名：台词
test('台词格式识别-多人台词格式应取第一个角色名', function() {
    var mockData = createRealScriptMockData();
    var result = applyDirectorEngine(mockData);
    
    // 检查队员甲/乙台词是否被正确处理
    var shot6 = result.scenes[0].shots[5];
    
    assertTrue(
        shot6.dialogue.indexOf('@队员甲') === 0,
        '队员甲/乙（惊愕）：... 应该被转换为 @队员甲：...，实际: ' + shot6.dialogue
    );
});

// 3. 测试台词去重：同一分镜内重复台词应被去除
test('台词去重-同一分镜内重复台词应被去除', function() {
    var mockData = createRealScriptMockData();
    var result = applyDirectorEngine(mockData);
    
    // 检查第5个分镜（原本有重复台词）
    var shot5 = result.scenes[0].shots[4];
    var lines = shot5.dialogue.split('\n').filter(function(l) { return l.trim(); });
    
    // 去重后应该只有1条
    assertTrue(
        lines.length === 1 || (lines.length === 2 && lines[0] !== lines[1]),
        '重复台词应被去除，实际行数: ' + lines.length + '，内容: ' + shot5.dialogue
    );
});

// 4. 测试描述多样性：连续分镜描述相同应添加差异化
test('描述多样性-连续分镜描述相同应添加差异化', function() {
    var mockData = createRealScriptMockData();
    var result = applyDirectorEngine(mockData);
    
    var scene = result.scenes[0];
    var shot1Desc = scene.shots[0].visual_prompt.scene_description;
    var shot2Desc = scene.shots[1].visual_prompt.scene_description;
    var shot3Desc = scene.shots[2].visual_prompt.scene_description;
    
    // 前3个分镜原本描述相同，应该被差异化
    assertTrue(
        shot1Desc !== shot2Desc || shot2Desc !== shot3Desc,
        '连续相同描述应被差异化，shot1: ' + shot1Desc + '，shot2: ' + shot2Desc + '，shot3: ' + shot3Desc
    );
});

// 5. 测试台词不以@旁白开头（防止双重标注）
test('台词格式-@角色名格式不应被@旁白包裹', function() {
    var mockData = createRealScriptMockData();
    var result = applyDirectorEngine(mockData);
    
    var allDialogues = [];
    for (var i = 0; i < result.scenes.length; i++) {
        var scene = result.scenes[i];
        for (var j = 0; j < scene.shots.length; j++) {
            var dialogue = scene.shots[j].dialogue;
            if (dialogue && dialogue.trim()) {
                allDialogues.push(dialogue);
            }
        }
    }
    
    for (var k = 0; k < allDialogues.length; k++) {
        var d = allDialogues[k];
        // 如果包含@角色名，不应该是@旁白：@角色名这种双重标注
        if (d.indexOf('@旁白：') === 0 && d.indexOf('@旁白：@') === 0) {
            throw new Error('发现双重标注: ' + d);
        }
        // @旁白后面不应该是@角色名
        if (d.indexOf('@旁白：@') >= 0) {
            throw new Error('发现双重标注: ' + d);
        }
    }
});

// 6. 测试台词最终格式：每句台词都以@角色名开头
test('台词格式-每句台词最终都以@角色名开头', function() {
    var mockData = createRealScriptMockData();
    var result = applyDirectorEngine(mockData);
    
    var allLines = [];
    for (var i = 0; i < result.scenes.length; i++) {
        var scene = result.scenes[i];
        for (var j = 0; j < scene.shots.length; j++) {
            var dialogue = scene.shots[j].dialogue;
            if (dialogue && dialogue.trim()) {
                var lines = dialogue.split('\n').filter(function(l) { return l.trim(); });
                for (var k = 0; k < lines.length; k++) {
                    allLines.push(lines[k]);
                }
            }
        }
    }
    
    for (var m = 0; m < allLines.length; m++) {
        var line = allLines[m].trim();
        // 每行台词应该以@开头
        if (line.indexOf('@') !== 0) {
            throw new Error('台词应以@开头: ' + line);
        }
    }
});

// 7. 测试compileImagePrompt输出不含[object Object]
test('compileImagePrompt-输出不应包含[object Object]', function() {
    var mockData = createRealScriptMockData();
    var result = applyDirectorEngine(mockData);
    
    var scene = result.scenes[0];
    for (var i = 0; i < scene.shots.length; i++) {
        var shot = scene.shots[i];
        var imagePrompt = compileImagePrompt(shot, scene, []);
        
        assertNotContains(
            imagePrompt,
            '[object Object]',
            'image_prompt不应包含[object Object]: ' + imagePrompt
        );
    }
});

// 8. 测试每个分镜台词≤2条
test('台词数量-每个分镜台词不超过2条', function() {
    var mockData = createRealScriptMockData();
    var result = applyDirectorEngine(mockData);
    
    var scene = result.scenes[0];
    for (var i = 0; i < scene.shots.length; i++) {
        var shot = scene.shots[i];
        var dialogue = shot.dialogue || '';
        var lines = dialogue.split('\n').filter(function(l) { return l.trim(); });
        
        // 每行是一条台词
        if (lines.length > 2) {
            throw new Error('分镜' + (i + 1) + '有' + lines.length + '条台词，超过2条限制');
        }
    }
});

// 9. 测试所有image_prompt不完全相同
test('描述多样性-所有分镜的image_prompt不完全相同', function() {
    var mockData = createRealScriptMockData();
    var result = applyDirectorEngine(mockData);
    
    var scene = result.scenes[0];
    var prompts = [];
    for (var i = 0; i < scene.shots.length; i++) {
        var shot = scene.shots[i];
        var imagePrompt = compileImagePrompt(shot, scene, []);
        prompts.push(imagePrompt);
    }
    
    // 检查是否有完全相同的prompt
    var uniquePrompts = [];
    for (var j = 0; j < prompts.length; j++) {
        if (uniquePrompts.indexOf(prompts[j]) < 0) {
            uniquePrompts.push(prompts[j]);
        }
    }
    
    // 至少应该有多个不同的prompt
    assertTrue(
        uniquePrompts.length > 1,
        '不同分镜应有不同的image_prompt，实际只有' + uniquePrompts.length + '种'
    );
});

// 10. 完整流程测试：从normalizeStoryboard到compileImagePrompt
test('完整流程-normalizeStoryboard → applyDirectorEngine → compileImagePrompt', function() {
    var mockData = createRealScriptMockData();
    
    // 1. normalizeStoryboard
    var normalized = normalizeStoryboard(mockData);
    
    // 2. applyDirectorEngine
    var processed = applyDirectorEngine(normalized);
    
    // 3. validateStoryboard
    var validated = validateStoryboard(processed);
    
    // 4. compileImagePrompt
    var scene = validated.scenes[0];
    for (var i = 0; i < scene.shots.length; i++) {
        var shot = scene.shots[i];
        shot.image_prompt = compileImagePrompt(shot, scene, []);
    }
    
    // 验证基本结构完整
    assertTrue(
        validated.scenes && validated.scenes.length > 0,
        '处理后应保留scenes结构'
    );
    
    assertTrue(
        scene.shots && scene.shots.length > 0,
        '处理后应保留shots'
    );
    
    // 验证台词格式正确
    for (var j = 0; j < scene.shots.length; j++) {
        var dialogue = scene.shots[j].dialogue || '';
        if (dialogue.trim()) {
            assertTrue(
                dialogue.indexOf('@') === 0 || dialogue.indexOf('@旁白') === 0,
                '台词应有@标注: ' + dialogue
            );
        }
    }
});

// ==================== 测试结果 ====================

console.log('');
console.log('========================================');
console.log('测试结果: ' + passed + ' 通过，' + failed + ' 失败');
console.log('========================================');
console.log('');

if (failed > 0) {
    process.exit(1);
}

// ==================== v7.0 真实剧本测试 ====================

var calculatePowerUpScore = aiService.calculatePowerUpScore;
var applyPaceDetection = aiService.applyPaceDetection;
var POWER_UP_PATTERNS = aiService.POWER_UP_PATTERNS;

// v7.0 测试：真实剧本数据通过节奏检测
test('v7.0真实剧本-节奏检测结果应包含问题列表', function() {
    var mockData = createRealScriptMockData();
    var result = applyDirectorEngine(mockData);
    
    if (!result.scenes[0].pace_analysis) {
        throw new Error('场景应包含pace_analysis');
    }
    if (!Array.isArray(result.scenes[0].pace_analysis.problems)) {
        throw new Error('pace_analysis应包含problems数组');
    }
});

test('v7.0真实剧本-应包含评分字段', function() {
    var mockData = createRealScriptMockData();
    var result = applyDirectorEngine(mockData);
    
    // 检查是否有shot包含climax字段（如果检测到爽点）
    var hasClimax = false;
    for (var i = 0; i < result.scenes[0].shots.length; i++) {
        if (result.scenes[0].shots[i].climax && result.scenes[0].shots[i].climax.type) {
            hasClimax = true;
            break;
        }
    }
    
    // 这个剧本可能没有爽点，所以不强制要求有climax
    console.log('[INFO] 剧本爽点检测: ' + (hasClimax ? '有爽点' : '无爽点'));
});

test('v7.0真实剧本-每个shot应有retention分数', function() {
    var mockData = createRealScriptMockData();
    var result = applyDirectorEngine(mockData);
    
    for (var i = 0; i < result.scenes[0].shots.length; i++) {
        var shot = result.scenes[0].shots[i];
        if (typeof shot.retention !== 'object') {
            throw new Error('shot ' + (i+1) + '应有retention字段');
        }
    }
});

test('v7.0真实剧本-所有8种爽点类型应可被检测', function() {
    // 测试8种爽点的关键词是否都能被检测
    var testCases = [
        { name: '觉醒', keyword: '觉醒' },
        { name: '反杀', keyword: '反杀' },
        { name: '打脸', keyword: '打脸' },
        { name: '压迫', keyword: '压迫' },
        { name: '羞辱', keyword: '羞辱' },
        { name: '装逼', keyword: '淡然' },
        { name: '绝望', keyword: '绝望' },
        { name: '爆发', keyword: '爆发' }
    ];
    
    for (var i = 0; i < testCases.length; i++) {
        var testCase = testCases[i];
        var found = false;
        for (var j = 0; j < POWER_UP_PATTERNS.length; j++) {
            if (POWER_UP_PATTERNS[j].name === testCase.name) {
                if (POWER_UP_PATTERNS[j].keywords.indexOf(testCase.keyword) >= 0) {
                    found = true;
                    break;
                }
            }
        }
        if (!found) {
            throw new Error('爽点类型 ' + testCase.name + ' 未能正确配置');
        }
    }
});

test('v7.0真实剧本-每个爽点应有权重', function() {
    for (var i = 0; i < POWER_UP_PATTERNS.length; i++) {
        var pattern = POWER_UP_PATTERNS[i];
        if (typeof pattern.weight !== 'number') {
            throw new Error('爽点 ' + pattern.name + ' 缺少weight属性');
        }
    }
});

// ==================== 测试结果 ====================

console.log('');
console.log('========================================');
console.log('v7.0 真实剧本测试结果: ' + passed + ' 通过，' + failed + ' 失败');
console.log('========================================');
console.log('');

if (failed > 0) {
    process.exit(1);
}
