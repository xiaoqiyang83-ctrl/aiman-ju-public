// 台词解析修复测试
// 运行：node test-dialogue-fix.js

/**
 * 解析单行台词，返回格式化的@角色名：台词
 * 返回null表示解析失败
 */
function parseSingleLine(line) {
    line = line.trim();
    if (!line) return null;
    
    // 如果已经是@开头的格式，直接返回
    if (line.indexOf('@') === 0) return line;
    
    // 格式A: "角色OS：台词" 或 "角色 OS：台词" → 旁白
    var osPattern = line.match(/^(.+?)\s*OS[：:]/);
    if (osPattern) {
        var osContent = line.substring(line.indexOf('OS') + 2).replace(/^[：:]\s*/, '');
        return '@旁白：' + osContent.trim();
    }
    
    // 找到普通对话的冒号位置
    var colonPos = line.indexOf('：');
    if (colonPos < 0) colonPos = line.indexOf(':');
    if (colonPos < 0) return null;
    
    var beforeColon = line.substring(0, colonPos);
    var afterColon = line.substring(colonPos + 1).trim();
    
    // 格式B: "角色名/角色名" → 取第一个
    if (beforeColon.indexOf('/') > 0) {
        var firstSpeaker = beforeColon.split('/')[0].trim();
        // 去除情绪标注
        firstSpeaker = firstSpeaker.replace(/[（(][^）)]+[）)]$/, '');
        return '@' + firstSpeaker + '：' + afterColon;
    }
    
    // 格式C: "角色名（情绪）" → 去除情绪
    var emotionMatch = beforeColon.match(/^(.+?)[（(].+?[）)]$/);
    if (emotionMatch) {
        return '@' + emotionMatch[1].trim() + '：' + afterColon;
    }
    
    // 格式D: 普通角色名
    if (beforeColon && beforeColon !== '旁白' && beforeColon.trim().length > 0) {
        return '@' + beforeColon.trim() + '：' + afterColon;
    }
    
    return null;
}

/**
 * 解析台词格式并转换为标准格式@角色名：台词
 * 支持多行对话，逐行解析
 */
function parseDialogueFormat(dialogue, shot, scene, shotIndex) {
    if (!dialogue || !dialogue.trim()) return null;
    
    var lines = dialogue.split(/\n/);
    
    if (lines.length === 1) {
        return parseSingleLine(lines[0]);
    }
    
    var parsedLines = [];
    for (var i = 0; i < lines.length; i++) {
        var parsed = parseSingleLine(lines[i]);
        if (parsed) {
            parsedLines.push(parsed);
        } else {
            parsedLines.push(lines[i]);
        }
    }
    
    return parsedLines.join('\n');
}

// 测试用例
var testCases = [
    // Bug 1: 队员甲/乙格式 + 多行
    {
        input: "队员甲/乙（惊愕）：啊！队长\n张扬：阿空！",
        expected: "@队员甲：啊！队长\n@张扬：阿空！",
        description: "Bug1: 队员甲/乙格式+多行解析"
    },
    // Bug 2: OS格式 + 多行多说话人
    {
        input: "队长（震惊）：你到底是什么人？\n队长OS：B级丧尸需要3人小队才能对付\n张扬（轻哼一声）：哼\n队长（难以置信）：雇佣丧尸？",
        expected: "@队长：你到底是什么人？\n@旁白：B级丧尸需要3人小队才能对付\n@张扬：哼\n@队长：雇佣丧尸？",
        description: "Bug2: OS转旁白+多行多说话人"
    },
    // Bug 3: 同角色多行
    {
        input: "张扬：哼，美女你这话说的\n张扬：番茄，咬一口。",
        expected: "@张扬：哼，美女你这话说的\n@张扬：番茄，咬一口。",
        description: "Bug3: 同角色多行解析"
    },
    // 单行情绪格式
    {
        input: "队长（绝望）：携带空间异能的S级丧尸一起出手！",
        expected: "@队长：携带空间异能的S级丧尸一起出手！",
        description: "单行情绪格式"
    },
    // 单行简单格式
    {
        input: "张扬：和你说了多少遍",
        expected: "@张扬：和你说了多少遍",
        description: "单行简单格式"
    },
    // 已经是@格式
    {
        input: "@张扬：已经是@格式的台词",
        expected: "@张扬：已经是@格式的台词",
        description: "@格式保持"
    },
    // 多人简单格式（无情绪）
    {
        input: "队员甲/乙：简单多人格式",
        expected: "@队员甲：简单多人格式",
        description: "多人简单格式"
    },
    // 英文括号
    {
        input: "队长(震惊)：你到底是谁？",
        expected: "@队长：你到底是谁？",
        description: "英文括号格式"
    }
];

console.log('='.repeat(60));
console.log('台词解析修复测试');
console.log('='.repeat(60));

var passCount = 0;
var failCount = 0;

testCases.forEach(function(tc, i) {
    var result = parseDialogueFormat(tc.input, {}, {}, 0);
    var pass = result === tc.expected;
    
    if (pass) {
        passCount++;
        console.log('\n✓ 测试' + (i+1) + ': ' + tc.description);
    } else {
        failCount++;
        console.log('\n✗ 测试' + (i+1) + ': ' + tc.description);
        console.log('  输入: ' + JSON.stringify(tc.input));
        console.log('  期望: ' + JSON.stringify(tc.expected));
        console.log('  实际: ' + JSON.stringify(result));
    }
});

console.log('\n' + '='.repeat(60));
console.log('结果: ' + passCount + ' 通过, ' + failCount + ' 失败');
console.log('='.repeat(60));

process.exit(failCount > 0 ? 1 : 0);
