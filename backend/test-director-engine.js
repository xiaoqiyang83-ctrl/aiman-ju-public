/**
 * Director Rule Engine 测试文件
 * 纯本地测试，不依赖网络/API调用
 */

var aiService = require('./services/ai-service');
var applyDirectorEngine = aiService.applyDirectorEngine;

var passed = 0;
var failed = 0;

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

function assertEqual(actual, expected, msg) {
    if (actual !== expected) {
        throw new Error(msg + ' - 期望: ' + expected + ', 实际: ' + actual);
    }
}

function assertContains(arr, val, msg) {
    if (arr.indexOf(val) < 0) {
        throw new Error(msg + ' - 期望包含: ' + val + ', 实际: ' + JSON.stringify(arr));
    }
}

function createMockShot(overrides) {
    return Object.assign({
        shot_number: 1,
        shot_type: '中景',
        camera_angle: '平视',
        camera_movement: '固定',
        duration: 3,
        visual_prompt: {
            lighting: '',
            color_palette: '',
            character_placement: '',
            facial_detail: '',
            scene_description: '',
            composition: ''
        },
        action_prompt: {
            physical_action: '',
            micro_movement: ''
        },
        emotion_cue: {
            primary_emotion: '',
            visual_mapping: ''
        },
        dialogue: '',
        narration: '',
        scene_reference: '',
        original_text: ''
    }, overrides);
}

function createMockScene(sceneOverrides, shotsOverrides) {
    var shots = [];
    for (var i = 0; i < shotsOverrides.length; i++) {
        shots.push(createMockShot(Object.assign({ shot_number: i + 1 }, shotsOverrides[i])));
    }
    return Object.assign({
        episode: '1',
        scene_number: '1',
        title: '测试场景',
        location: '测试地点',
        time_of_day: '日内',
        characters: [],
        content: '测试内容',
        shots: shots
    }, sceneOverrides);
}

function createMockData(scenesOverrides) {
    return {
        scenes: scenesOverrides || [createMockScene({}, [{}])]
    };
}

// ==================== 测试用例 ====================

console.log('');
console.log('========================================');
console.log('Director Rule Engine 测试开始');
console.log('========================================');
console.log('');

// 1. 情绪→镜头映射：愤怒场景用中景→应修正为特写/大特写
test('情绪映射-愤怒场景应修正为特写或大特写', function() {
    var mockData = createMockData([
        createMockScene({}, [
            { shot_type: '中景', emotion_cue: { primary_emotion: '愤怒', visual_mapping: '' } }
        ])
    ]);
    
    var result = applyDirectorEngine(mockData);
    var shotType = result.scenes[0].shots[0].shot_type;
    assertContains(['特写', '大特写'], shotType, '愤怒情绪应映射到特写/大特写');
});

// 2. 情绪映射-绝望场景应使用远景/全景
test('情绪映射-绝望场景应修正为远景或全景', function() {
    var mockData = createMockData([
        createMockScene({}, [
            { shot_type: '近景', emotion_cue: { primary_emotion: '绝望', visual_mapping: '' } }
        ])
    ]);
    
    var result = applyDirectorEngine(mockData);
    var shotType = result.scenes[0].shots[0].shot_type;
    assertContains(['远景', '全景'], shotType, '绝望情绪应映射到远景/全景');
});

// 3. 情绪映射-悲伤场景应使用中景/远景
test('情绪映射-悲伤场景应修正为中景或远景', function() {
    var mockData = createMockData([
        createMockScene({}, [
            { shot_type: '特写', emotion_cue: { primary_emotion: '悲伤', visual_mapping: '' } }
        ])
    ]);
    
    var result = applyDirectorEngine(mockData);
    var shotType = result.scenes[0].shots[0].shot_type;
    assertContains(['中景', '远景'], shotType, '悲伤情绪应映射到中景/远景');
});

// 4. 爽点检测-觉醒关键词应强化为大特写+仰视+慢推
test('爽点检测-觉醒关键词应强化镜头', function() {
    var mockData = createMockData([
        createMockScene({}, [
            { 
                shot_type: '中景', 
                camera_angle: '平视', 
                camera_movement: '固定',
                duration: 3,
                dialogue: '主角慢慢抬起头',
                original_text: '力量觉醒',
                emotion_cue: { primary_emotion: '愤怒', visual_mapping: '' }
            }
        ])
    ]);
    
    var result = applyDirectorEngine(mockData);
    var shot = result.scenes[0].shots[0];
    assertEqual(shot.shot_type, '大特写', '觉醒应强化为大特写');
    assertEqual(shot.camera_angle, '仰视', '觉醒应使用仰视');
    assertEqual(shot.camera_movement, '慢推', '觉醒应使用慢推');
    assertEqual(shot.duration, 4, '觉醒duration应为4');
});

// 5. 爽点检测-反杀关键词应强化为特写+跟镜头
test('爽点检测-反杀关键词应强化镜头', function() {
    var mockData = createMockData([
        createMockScene({}, [
            { 
                shot_type: '中景', 
                camera_movement: '固定',
                duration: 3,
                dialogue: '我一刀击败了他',
                original_text: '反杀成功'
            }
        ])
    ]);
    
    var result = applyDirectorEngine(mockData);
    var shot = result.scenes[0].shots[0];
    assertEqual(shot.shot_type, '特写', '反杀应强化为特写');
    assertEqual(shot.camera_movement, '跟镜头', '反杀应使用跟镜头');
    assertEqual(shot.duration, 2, '反杀duration应为2');
});

// 6. 爽点检测-打脸关键词应强化为大特写+仰视
test('爽点检测-打脸关键词应强化镜头', function() {
    var mockData = createMockData([
        createMockScene({}, [
            { 
                shot_type: '中景', 
                camera_angle: '平视',
                dialogue: '哼，你算什么',
                original_text: '冷笑'
            }
        ])
    ]);
    
    var result = applyDirectorEngine(mockData);
    var shot = result.scenes[0].shots[0];
    assertEqual(shot.shot_type, '大特写', '打脸应强化为大特写');
    assertEqual(shot.camera_angle, '仰视', '打脸应使用仰视');
    assertEqual(shot.duration, 3, '打脸duration应为3');
});

// 7. 爽点检测-威压关键词应强化为特写+推镜头
test('爽点检测-威压关键词应强化镜头', function() {
    var mockData = createMockData([
        createMockScene({}, [
            { 
                shot_type: '中景', 
                camera_movement: '固定',
                dialogue: '感受到我的气息了吗',
                original_text: '压迫感'
            }
        ])
    ]);
    
    var result = applyDirectorEngine(mockData);
    var shot = result.scenes[0].shots[0];
    assertEqual(shot.shot_type, '特写', '威压应强化为特写');
    assertEqual(shot.camera_movement, '推镜头', '威压应使用推镜头');
    assertEqual(shot.duration, 3, '威压duration应为3');
});

// 8. 爽点检测-装逼关键词应强化为近景+侧视+环绕
test('爽点检测-装逼关键词应强化镜头', function() {
    var mockData = createMockData([
        createMockScene({}, [
            { 
                shot_type: '中景', 
                camera_angle: '平视',
                camera_movement: '固定',
                dialogue: '他淡然一笑，随意挥了挥手',
                original_text: ''
            }
        ])
    ]);
    
    var result = applyDirectorEngine(mockData);
    var shot = result.scenes[0].shots[0];
    assertEqual(shot.shot_type, '近景', '装逼应强化为近景');
    assertEqual(shot.camera_angle, '侧视', '装逼应使用侧视');
    assertEqual(shot.camera_movement, '环绕', '装逼应使用环绕');
    assertEqual(shot.duration, 4, '装逼duration应为4');
});

// 9. 景别多样性-3个连续中景应强制升降
test('景别多样性-连续3个相同景别应强制变化', function() {
    var mockData = createMockData([
        createMockScene({}, [
            { shot_type: '中景' },
            { shot_type: '中景' },
            { shot_type: '中景' }
        ])
    ]);
    
    var result = applyDirectorEngine(mockData);
    var types = result.scenes[0].shots.map(function(s) { return s.shot_type; });
    
    // 至少第2个应该变化
    if (types[0] === types[1] && types[1] === types[2]) {
        throw new Error('3个连续相同景别未被修正');
    }
});

// 10. 景别多样性-整个scene没有特写应添加特写
test('景别多样性-没有特写应添加特写', function() {
    var mockData = createMockData([
        createMockScene({}, [
            { shot_type: '远景' },
            { shot_type: '全景' },
            { shot_type: '中景' },
            { shot_type: '近景' }
        ])
    ]);
    
    var result = applyDirectorEngine(mockData);
    var hasExtreme = false;
    for (var i = 0; i < result.scenes[0].shots.length; i++) {
        if (result.scenes[0].shots[i].shot_type === '特写' || 
            result.scenes[0].shots[i].shot_type === '大特写') {
            hasExtreme = true;
            break;
        }
    }
    if (!hasExtreme) {
        throw new Error('scene缺少特写但未被添加');
    }
});

// 11. 景别多样性-整个scene没有远景应添加远景
test('景别多样性-没有远景应添加远景', function() {
    var mockData = createMockData([
        createMockScene({}, [
            { shot_type: '中景' },
            { shot_type: '近景' },
            { shot_type: '特写' }
        ])
    ]);
    
    var result = applyDirectorEngine(mockData);
    var hasWide = false;
    for (var i = 0; i < result.scenes[0].shots.length; i++) {
        if (result.scenes[0].shots[i].shot_type === '远景' || 
            result.scenes[0].shots[i].shot_type === '全景') {
            hasWide = true;
            break;
        }
    }
    if (!hasWide) {
        throw new Error('scene缺少远景/全景但未被添加');
    }
});

// 12. 运镜多样性-连续3个固定镜头应改变
test('运镜多样性-连续3个相同运镜应改变', function() {
    var mockData = createMockData([
        createMockScene({}, [
            { camera_movement: '固定' },
            { camera_movement: '固定' },
            { camera_movement: '固定' }
        ])
    ]);
    
    var result = applyDirectorEngine(mockData);
    var movements = result.scenes[0].shots.map(function(s) { return s.camera_movement; });
    
    // 至少第2个应该变化
    if (movements[0] === movements[1] && movements[1] === movements[2]) {
        throw new Error('3个连续相同运镜未被修正');
    }
});

// 13. 运镜多样性-全是固定镜头应部分改为动态
test('运镜多样性-全是固定应改为动态运镜', function() {
    var mockData = createMockData([
        createMockScene({}, [
            { camera_movement: '固定' },
            { camera_movement: '固定' },
            { camera_movement: '固定' },
            { camera_movement: '固定' }
        ])
    ]);
    
    var result = applyDirectorEngine(mockData);
    var hasDynamic = false;
    for (var i = 0; i < result.scenes[0].shots.length; i++) {
        if (result.scenes[0].shots[i].camera_movement !== '固定') {
            hasDynamic = true;
            break;
        }
    }
    if (!hasDynamic) {
        throw new Error('全是固定镜头但未被改为动态运镜');
    }
});

// 14. duration合理性-超长duration应修正
test('duration合理性-超长duration应修正', function() {
    var mockData = createMockData([
        createMockScene({}, [
            { shot_type: '中景', duration: 10, dialogue: '这是一段很长的对话内容' }
        ])
    ]);
    
    var result = applyDirectorEngine(mockData);
    var duration = result.scenes[0].shots[0].duration;
    assertEqual(duration <= 4, true, '对话镜头duration应<=4');
});

// 15. duration合理性-过短duration应修正
test('duration合理性-过短duration应修正', function() {
    var mockData = createMockData([
        createMockScene({}, [
            { shot_type: '远景', duration: 1, dialogue: '' }
        ])
    ]);
    
    var result = applyDirectorEngine(mockData);
    var duration = result.scenes[0].shots[0].duration;
    assertEqual(duration >= 3, true, '远景镜头duration应>=3');
});

// 16. 混合场景-多种问题同时出现
test('混合场景-多种问题应同时修正', function() {
    var mockData = createMockData([
        createMockScene({}, [
            { shot_type: '中景', camera_movement: '固定', duration: 10, emotion_cue: { primary_emotion: '愤怒', visual_mapping: '' }, dialogue: '觉醒吧！' },
            { shot_type: '中景', camera_movement: '固定', duration: 10, emotion_cue: { primary_emotion: '喜悦', visual_mapping: '' }, dialogue: '' },
            { shot_type: '中景', camera_movement: '固定', duration: 10 }
        ])
    ]);
    
    var result = applyDirectorEngine(mockData);
    var shots = result.scenes[0].shots;
    
    // 第1个应该是大特写（爽点优先）
    assertEqual(shots[0].shot_type, '大特写', '第1个应是大特写(觉醒爽点)');
    
    // 第2个应该是近景（喜悦情绪）
    assertContains(['中景', '近景'], shots[1].shot_type, '第2个应是中景/近景(喜悦)');
    
    // 至少有一个镜头duration被修正
    var hasReasonableDuration = true;
    for (var i = 0; i < shots.length; i++) {
        if (shots[i].duration > 4) {
            hasReasonableDuration = false;
            break;
        }
    }
    if (!hasReasonableDuration) {
        throw new Error('存在超长duration未被修正');
    }
});

// 17. 边界case-空scene
test('边界case-空scene应正常处理', function() {
    var mockData = { scenes: [] };
    var result = applyDirectorEngine(mockData);
    if (!result || !Array.isArray(result.scenes)) {
        throw new Error('空scene处理异常');
    }
});

// 18. 边界case-空shots数组
test('边界case-空shots数组应正常处理', function() {
    var mockData = createMockData([
        createMockScene({}, [])
    ]);
    var result = applyDirectorEngine(mockData);
    if (result.scenes[0].shots.length !== 0) {
        throw new Error('空shots处理异常');
    }
});

// 19. 边界case-空emotion_cue
test('边界case-空emotion_cue应正常处理', function() {
    var mockData = createMockData([
        createMockScene({}, [
            { emotion_cue: { primary_emotion: '', visual_mapping: '' } }
        ])
    ]);
    var result = applyDirectorEngine(mockData);
    if (!result.scenes[0].shots[0]) {
        throw new Error('空emotion_cue处理异常');
    }
});

// 20. 边界case-无data
test('边界case-无data应正常处理', function() {
    var result = applyDirectorEngine(null);
    if (result !== null) {
        throw new Error('null data处理异常');
    }
});

// 21. 边界case-无scenes属性
test('边界case-无scenes属性应正常处理', function() {
    var result = applyDirectorEngine({});
    if (!result) {
        throw new Error('无scenes属性处理异常');
    }
});

// 22. 深拷贝验证-不应修改原始数据
test('深拷贝-不应修改原始数据', function() {
    var mockData = createMockData([
        createMockScene({}, [
            { shot_type: '中景', emotion_cue: { primary_emotion: '愤怒', visual_mapping: '' } }
        ])
    ]);
    var originalShotType = mockData.scenes[0].shots[0].shot_type;
    
    applyDirectorEngine(mockData);
    
    assertEqual(mockData.scenes[0].shots[0].shot_type, originalShotType, '原始数据不应被修改');
});

// 23. 运镜多样性-2个镜头不应触发连续修正
test('运镜多样性-少于3个镜头不应强制修正', function() {
    var mockData = createMockData([
        createMockScene({}, [
            { camera_movement: '固定' },
            { camera_movement: '固定' }
        ])
    ]);
    
    var result = applyDirectorEngine(mockData);
    // 2个固定镜头不应被强制改变
    assertEqual(result.scenes[0].shots[0].camera_movement, '固定', '2个镜头不应强制改变');
    assertEqual(result.scenes[0].shots[1].camera_movement, '固定', '2个镜头不应强制改变');
});

// 24. 景别多样性-2个镜头不应触发连续修正
test('景别多样性-少于3个镜头不应强制修正', function() {
    var mockData = createMockData([
        createMockScene({}, [
            { shot_type: '中景' },
            { shot_type: '中景' }
        ])
    ]);
    
    var result = applyDirectorEngine(mockData);
    // 2个相同景别不应被强制改变
    assertEqual(result.scenes[0].shots[0].shot_type, '中景', '2个镜头不应强制改变');
    assertEqual(result.scenes[0].shots[1].shot_type, '中景', '2个镜头不应强制改变');
});

// 25. 多场景处理
test('多场景处理-各场景应独立处理', function() {
    var mockData = createMockData([
        createMockScene({ title: '场景1' }, [
            { shot_type: '中景', emotion_cue: { primary_emotion: '愤怒', visual_mapping: '' } }
        ]),
        createMockScene({ title: '场景2' }, [
            { shot_type: '中景', emotion_cue: { primary_emotion: '悲伤', visual_mapping: '' } }
        ])
    ]);
    
    var result = applyDirectorEngine(mockData);
    
    // 两个场景都应有处理结果
    assertEqual(result.scenes.length, 2, '应有2个场景');
    assertEqual(result.scenes[0].shots.length, 1, '场景1应有1个shot');
    assertEqual(result.scenes[1].shots.length, 1, '场景2应有1个shot');
});

// ==================== 测试结果 ====================

console.log('');
console.log('========================================');
console.log('测试结果: ' + passed + '/' + (passed + failed) + ' PASSED');
console.log('========================================');

if (failed === 0) {
    console.log('');
    console.log('Director Rule Engine 25项测试全部通过');
    console.log('');
}

// ==================== compileImagePrompt 测试 ====================

var compileImagePrompt = aiService.compileImagePrompt;

test('compileImagePrompt-应从visual_prompt对象提取scene_description', function() {
    var shot = {
        shot_type: '中景',
        visual_prompt: {
            lighting: '逆光4500K',
            color_palette: '#2C3E50 70%, #E74C3C 30%',
            scene_description: '温室内部，绿色植物茂盛',
            character_placement: '@队长 画面中央',
            facial_detail: '震惊表情',
            composition: '三分法'
        },
        action_prompt: { physical_action: '缓缓转头', micro_movement: '' },
        emotion_cue: { primary_emotion: '震惊', visual_mapping: '高对比' }
    };
    var scene = { time_of_day: '日内' };
    var result = compileImagePrompt(shot, scene, []);
    if (result.indexOf('温室内部') < 0) {
        throw new Error('image_prompt未包含scene_description内容: ' + result);
    }
    if (result.indexOf('[object Object]') >= 0) {
        throw new Error('image_prompt包含[object Object]，visual_prompt被当作对象拼接: ' + result);
    }
});

test('compileImagePrompt-应包含所有visual_prompt字段', function() {
    var shot = {
        shot_type: '特写',
        visual_prompt: {
            lighting: '侧逆光3200K',
            color_palette: '冷蓝色调',
            scene_description: '废弃大楼走廊',
            character_placement: '@林夜 左侧',
            facial_detail: '眉头紧锁',
            composition: '对角线构图'
        },
        action_prompt: { physical_action: '', micro_movement: '' },
        emotion_cue: { primary_emotion: '', visual_mapping: '' }
    };
    var scene = { time_of_day: '夜内' };
    var result = compileImagePrompt(shot, scene, []);
    if (result.indexOf('废弃大楼走廊') < 0) throw new Error('缺少scene_description');
    if (result.indexOf('侧逆光3200K') < 0) throw new Error('缺少lighting');
    if (result.indexOf('冷蓝色调') < 0) throw new Error('缺少color_palette');
    if (result.indexOf('对角线构图') < 0) throw new Error('缺少composition');
});

test('compileImagePrompt-应包含情绪提示词', function() {
    var shot = {
        shot_type: '近景',
        visual_prompt: { lighting: '', color_palette: '', scene_description: '室内', character_placement: '', facial_detail: '', composition: '' },
        action_prompt: { physical_action: '', micro_movement: '' },
        emotion_cue: { primary_emotion: '愤怒', visual_mapping: '红光映射' }
    };
    var scene = { time_of_day: '日内' };
    var result = compileImagePrompt(shot, scene, []);
    if (result.indexOf('愤怒') < 0) throw new Error('缺少primary_emotion');
    if (result.indexOf('红光映射') < 0) throw new Error('缺少visual_mapping');
});

test('compileImagePrompt-应包含动作提示词', function() {
    var shot = {
        shot_type: '中景',
        visual_prompt: { lighting: '', color_palette: '', scene_description: '战场', character_placement: '', facial_detail: '', composition: '' },
        action_prompt: { physical_action: '拔刀斩出', micro_movement: '手指微颤' },
        emotion_cue: { primary_emotion: '', visual_mapping: '' }
    };
    var scene = { time_of_day: '日外' };
    var result = compileImagePrompt(shot, scene, []);
    if (result.indexOf('拔刀斩出') < 0) throw new Error('缺少physical_action: ' + result);
});

test('compileImagePrompt-旧格式字符串visual_prompt应兼容', function() {
    var shot = {
        shot_type: '远景',
        visual_prompt: '末世废墟城市远景，烟尘弥漫',
        action_prompt: { physical_action: '', micro_movement: '' },
        emotion_cue: { primary_emotion: '', visual_mapping: '' }
    };
    var scene = { time_of_day: '夜外' };
    var result = compileImagePrompt(shot, scene, []);
    if (result.indexOf('末世废墟') < 0) throw new Error('旧格式字符串未正确拼接: ' + result);
});

test('compileImagePrompt-空visual_prompt不应崩溃', function() {
    var shot = {
        shot_type: '中景',
        visual_prompt: null,
        action_prompt: null,
        emotion_cue: null
    };
    var scene = { time_of_day: '日内' };
    var result = compileImagePrompt(shot, scene, []);
    if (!result || result.indexOf('[object') >= 0) throw new Error('空visual_prompt导致异常: ' + result);
});

// ==================== v6.2 applyDialogueRules 测试 ====================

var applyDialogueRules = aiService.applyDialogueRules;

// 台词补全说话人测试
test('applyDialogueRules-台词没有@标注应自动补@角色名', function() {
    var mockData = createMockData([
        createMockScene({ characters: '队长,张扬' }, [
            { 
                dialogue: '啊！队长',
                visual_prompt: { character_placement: '@队长 画面中央', scene_description: '队长震惊地看着张扬' },
                scene_reference: ''
            },
            { 
                dialogue: '@张扬：哼，不过如此',
                visual_prompt: { character_placement: '@张扬 画面右侧', scene_description: '张扬冷笑' },
                scene_reference: ''
            }
        ])
    ]);
    
    var result = applyDialogueRules(mockData);
    var firstDialogue = result.scenes[0].shots[0].dialogue;
    
    // 应该补全说话人标注
    if (firstDialogue.indexOf('@') !== 0) {
        throw new Error('台词未补全说话人标注: ' + firstDialogue);
    }
});

// 台词补全旁白测试
test('applyDialogueRules-无法推断说话人应标注@旁白', function() {
    var mockData = createMockData([
        createMockScene({ characters: '' }, [
            { 
                dialogue: '这是一段旁白描述',
                visual_prompt: { character_placement: '', scene_description: '空旷的场景' },
                scene_reference: ''
            }
        ])
    ]);
    
    var result = applyDialogueRules(mockData);
    var dialogue = result.scenes[0].shots[0].dialogue;
    
    // 应该补全为旁白
    if (dialogue.indexOf('@旁白') !== 0) {
        throw new Error('台词应标注为旁白: ' + dialogue);
    }
});

// 合并断裂对话测试
test('applyDialogueRules-相邻两个只有1条台词的分镜应合并', function() {
    var mockData = createMockData([
        createMockScene({ characters: '队长,张扬' }, [
            { 
                dialogue: '啊！',
                visual_prompt: { character_placement: '@队长 画面中央', scene_description: '队长震惊地看着张扬' },
                scene_reference: ''
            },
            { 
                dialogue: '阿空!',
                visual_prompt: { character_placement: '@张扬 画面右侧', scene_description: '队长震惊地看着张扬' },  // 使用完全相同的场景描述
                scene_reference: ''
            }
        ])
    ]);
    
    var result = applyDialogueRules(mockData);
    var shotCount = result.scenes[0].shots.length;
    
    // 两个相邻分镜应该合并为一个（使用完全相同的场景描述）
    if (shotCount !== 1) {
        throw new Error('相邻对话分镜应合并，但shot数量为' + shotCount);
    }
    
    var combinedDialogue = result.scenes[0].shots[0].dialogue;
    // 合并后应该有两条台词
    var lines = combinedDialogue.split(/\n/).filter(function(d) { return d.trim(); });
    if (lines.length !== 2) {
        throw new Error('合并后应有2条台词，但有' + lines.length + '条: ' + combinedDialogue);
    }
});

// 不合并非对话分镜测试
test('applyDialogueRules-一个有台词一个没台词的相邻分镜不应合并', function() {
    var mockData = createMockData([
        createMockScene({ characters: '队长' }, [
            { 
                dialogue: '@队长：啊！',
                visual_prompt: { character_placement: '@队长 画面中央', scene_description: '队长震惊地看着张扬' },
                scene_reference: ''
            },
            { 
                dialogue: '',
                visual_prompt: { character_placement: '', scene_description: '环境全景' },
                scene_reference: ''
            }
        ])
    ]);
    
    var result = applyDialogueRules(mockData);
    var shotCount = result.scenes[0].shots.length;
    
    // 不应该合并
    if (shotCount !== 2) {
        throw new Error('有台词和无台词的分镜不应合并，但shot数量为' + shotCount);
    }
});

// 拆分堆叠台词测试
test('applyDialogueRules-超过2条台词的分镜应拆分', function() {
    var mockData = createMockData([
        createMockScene({ characters: '队长,张扬,阿空' }, [
            { 
                dialogue: '@队长：你到底是什么人？\n@张扬：他竟然能驱使S级丧尸！\n@阿空：哼',
                visual_prompt: { character_placement: '@队长 画面中央', scene_description: '队长震惊地看着张扬' },
                scene_reference: ''
            }
        ])
    ]);
    
    var result = applyDialogueRules(mockData);
    var shotCount = result.scenes[0].shots.length;
    
    // 3条台词应该拆分为2个分镜
    if (shotCount < 2) {
        throw new Error('超过2条台词应拆分，但shot数量为' + shotCount);
    }
    
    // 检查每个分镜的台词条数不超过2条
    for (var i = 0; i < result.scenes[0].shots.length; i++) {
        var dialogue = result.scenes[0].shots[i].dialogue || '';
        var lines = dialogue.split(/\n/).filter(function(d) { return d.trim(); });
        var validLines = lines.filter(function(d) {
            return d.indexOf('@') === 0 || /^[^\@]+[：:]/.test(d);
        });
        if (validLines.length > 2) {
            throw new Error('拆分后每个分镜台词不应超过2条，但分镜' + (i+1) + '有' + validLines.length + '条');
        }
    }
});

// 不拆分合规台词测试
test('applyDialogueRules-2条及以下台词的分镜不应拆分', function() {
    var mockData = createMockData([
        createMockScene({ characters: '队长,张扬' }, [
            { 
                dialogue: '@队长：啊！\n@张扬：阿空!',
                visual_prompt: { character_placement: '@队长 画面中央', scene_description: '队长震惊地看着张扬' },
                scene_reference: ''
            }
        ])
    ]);
    
    var result = applyDialogueRules(mockData);
    var shotCount = result.scenes[0].shots.length;
    
    // 2条台词不应拆分
    if (shotCount !== 1) {
        throw new Error('2条台词不应拆分，但shot数量为' + shotCount);
    }
});

console.log('');
console.log('========================================');
console.log('测试结果: ' + (passed + failed > 0 ? passed + '/' + (passed + failed) : '0') + ' PASSED');
console.log('========================================');
if (failed === 0) {
    console.log('Director Rule Engine + compileImagePrompt 测试全部通过');
}

process.exit(failed > 0 ? 1 : 0);