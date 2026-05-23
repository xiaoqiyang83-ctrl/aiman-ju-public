function isBlankLine(line) {
  return !String(line || '').trim();
}

function isPlaceholderSceneText(s) {
  const t = String(s || '').trim();
  if (!t) return true;
  if (/^场景\s*\d+$/i.test(t)) return true;
  if (/^未命名场景$/i.test(t)) return true;
  return false;
}

function isSceneHeadingLine(line) {
  const t = String(line || '').trim();
  if (!t) return false;
  if (t.length > 40) return false;
  if (/[。！？.!?"“”「」]/.test(t)) return false;
  if (/^\d+\s*-\s*\d+\b/.test(t)) return true;
  if (/^场景\s*\d+\s*[:：]/.test(t)) return true;
  if (/^(日内|夜|日|晨|早|午|晚|内|外)\s+/.test(t)) return true;
  if ((t.includes('-') || t.includes('—')) && !/[《》]/.test(t) && !/第.+(卷|集|章)/.test(t)) return true;
  return false;
}

function parseSceneHeadingLine(line) {
  const t = String(line || '').trim();
  if (!t) return { title: '', location: '', time_of_day: '' };
  const mCode = t.match(/^(\d+)\s*-\s*(\d+)\s+(.*)$/);
  if (mCode) {
    const episodeNo = String(mCode[1] || '').trim();
    const sceneNo = String(mCode[2] || '').trim();
    const code = `${episodeNo}-${sceneNo}`;
    const rest = String(mCode[3] || '').trim();
    const tokens = rest.split(/\s+/).filter(Boolean);
    const timeTokens = [];
    while (tokens.length) {
      const tok = tokens[0];
      if (/^(日内|日外|夜内|夜外)$/.test(tok)) {
        timeTokens.push(tok);
        tokens.shift();
        break;
      }
      if (/^(日|夜|晨|早|午|晚|内|外|清晨|傍晚|黄昏|凌晨|午后|深夜)$/.test(tok)) {
        timeTokens.push(tok);
        tokens.shift();
        continue;
      }
      break;
    }
    let time_of_day = timeTokens.join('');
    if (time_of_day === '日外' || time_of_day === '日内' || time_of_day === '夜外' || time_of_day === '夜内') {
      // ok
    } else if (timeTokens.length >= 2) {
      time_of_day = timeTokens.join('');
    }
    const location = tokens.join(' ').replace(/\s*-\s*/g, '-').trim();
    return {
      title: location || code,
      location: location || '',
      time_of_day,
      scene_number: code,
      episode: episodeNo,
    };
  }
  const m1 = t.match(/^(日内|夜|日|晨|早|午|晚|内|外)\s+(.+)$/);
  if (m1) {
    const time_of_day = m1[1].trim();
    const location = String(m1[2] || '').trim();
    return { title: location, location, time_of_day };
  }
  const m2 = t.match(/^场景\s*\d+\s*[:：]\s*(.+)$/);
  if (m2) {
    const location = String(m2[1] || '').trim();
    return { title: location, location, time_of_day: '' };
  }
  return { title: t, location: t, time_of_day: '' };
}

function stripLeadingHeading(text) {
  const lines = String(text || '')
    .split('\n')
    .map(s => String(s));
  const firstNonEmptyIdx = lines.findIndex(l => !isBlankLine(l));
  if (firstNonEmptyIdx < 0) return { heading: null, body: '' };
  const first = String(lines[firstNonEmptyIdx] || '').trim();
  if (!isSceneHeadingLine(first)) return { heading: null, body: String(text || '').trim() };
  const heading = parseSceneHeadingLine(first);
  const body = lines.slice(firstNonEmptyIdx + 1).join('\n').trim();
  return { heading, body };
}

function splitScriptToScenes(scriptContent) {
  const lines = String(scriptContent || '')
    .split('\n')
    .map(s => s.replace(/\r/g, ''));
  const scenes = [];
  let current = null;
  let currentEpisode = '';

  function pushCurrent() {
    if (!current) return;
    const content = current.lines.join('\n').trim();
    if (!content) return;
    if (!current.startedByHeading && scenes.length === 0) return;
    scenes.push({
      episode: current.episode || currentEpisode || '',
      scene_number: current.scene_number || String(scenes.length + 1),
      title: current.title || `场景${scenes.length + 1}`,
      location: current.location || '',
      time_of_day: current.time_of_day || '',
      content,
    });
  }

  for (let idx = 0; idx < lines.length; idx++) {
    const raw = lines[idx];
    const t = String(raw || '').trim();
    if (!t) continue;
    const episodeHeader = t.match(/^第([一二三四五六七八九十百千0-9]+)(集|话|章)\b/);
    if (episodeHeader) {
      currentEpisode = t;
      if (current && current.lines.length > 0) current.lines.push(raw);
      continue;
    }
    if (isSceneHeadingLine(t)) {
      pushCurrent();
      const meta = parseSceneHeadingLine(t);
      current = {
        title: meta.title || '',
        location: meta.location || '',
        time_of_day: meta.time_of_day || '',
        episode: meta.episode || currentEpisode || '',
        scene_number: meta.scene_number || '',
        lines: [t],
        startedByHeading: true,
      };
      continue;
    }
    if (!current) {
      current = { title: '', location: '', time_of_day: '', episode: currentEpisode || '', scene_number: '', lines: [], startedByHeading: false };
    }
    current.lines.push(raw);
  }
  pushCurrent();

  if (scenes.length > 0) return scenes;

  const blocks = String(scriptContent || '')
    .split(/\n\s*\n+/)
    .map(s => s.trim())
    .filter(Boolean);
  return blocks.map((content, i) => ({
    scene_number: String(i + 1),
    title: `场景${i + 1}`,
    location: '',
    time_of_day: '',
    content,
  }));
}

function detectSceneType(text) {
  const t = String(text || '');
  const quotes = extractDialogueQuotes(t);
  const dialogueLines = t
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)
    .filter(l => /^.{1,16}[：:]/.test(l) && !/^人物[：:]/.test(l));
  const actionKeywords = ['打', '跑', '冲', '撞', '踢', '跳', '抓', '摔', '挥', '劈', '闪', '扑', '逃', '追', '爆炸', '撞击'];
  const emotionKeywords = ['哭', '泪', '笑', '怒', '颤抖', '崩溃', '绝望', '惊喜', '感动', '委屈', '悲伤', '惊愕', '凝重'];
  const transitionKeywords = ['走', '来到', '进入', '离开', '穿过', '走向', '转身', '推门'];
  const hasAction = actionKeywords.some(k => t.includes(k));
  const hasEmotion = emotionKeywords.some(k => t.includes(k));
  const hasTransition = transitionKeywords.some(k => t.includes(k));
  if (quotes.length >= 2 || dialogueLines.length >= 2) return 'dialogue';
  if (hasAction && hasEmotion) return 'action_emotion';
  if (hasAction) return 'action';
  if (hasEmotion) return 'emotion';
  if (hasTransition) return 'transition';
  return 'environment';
}

const SHOT_TEMPLATES = {
  dialogue: {
    shots: ['全景', '中景', '近景', '近景', '中景'],
    movements: ['static', 'static', 'push_in', 'push_in', 'static'],
    durations: [5, 4, 3, 3, 4],
  },
  action: {
    shots: ['全景', '中景', '近景', '特写', '全景'],
    movements: ['static', 'tracking', 'tracking', 'push_in', 'pull_back'],
    durations: [4, 3, 2, 2, 4],
  },
  action_emotion: {
    shots: ['全景', '中景', '近景', '特写', '大特写', '全景'],
    movements: ['static', 'tracking', 'push_in', 'push_in', 'push_in', 'pull_back'],
    durations: [4, 3, 3, 2, 3, 4],
  },
  emotion: {
    shots: ['中景', '近景', '特写', '大特写'],
    movements: ['static', 'push_in', 'push_in', 'push_in'],
    durations: [4, 4, 4, 5],
  },
  environment: {
    shots: ['远景', '全景', '中景'],
    movements: ['static', 'pan', 'push_in'],
    durations: [5, 5, 4],
  },
  transition: {
    shots: ['全景', '中景'],
    movements: ['static', 'tracking'],
    durations: [4, 4],
  },
};

function extractCharacters(text) {
  const t = String(text || '');
  const matches = [];
  const explicit = t.match(/队员[甲乙丙丁戊己庚辛壬癸]/g) || [];
  for (const name of explicit) matches.push(name);
  if (t.includes('队长')) matches.push('队长');

  const pattern = /([\u4e00-\u9fa5]{2,6})(?:盯着|盯|看着|看|望|走|跑|冲|喊道|喊|叫|握|抓|拉|推|笑|哭|怒|叹|触碰|触摸|触及|压低|低声|轻声|说道|说|道|问|答|颤抖|凝视|面色|皱眉|抬头|点头|摇头|退后|靠近|抬手|伸手|拍打)/g;
  let match;
  while ((match = pattern.exec(t)) !== null) {
    const name = match[1];
    if (String(name || '').endsWith('地')) continue;
    if (!/队员|队长/.test(name) && name.length > 4) continue;
    if (['手指', '面前', '表面', '声音', '目光', '神情', '表情', '身体', '脚步', '番茄'].some(k => String(name).includes(k))) continue;
    if (!['然后', '接着', '突然', '这时', '于是', '只见', '此时', '小心翼翼', '面色凝重', '惊愕'].includes(name)) {
      matches.push(name);
    }
  }
  return [...new Set(matches)].slice(0, 4);
}

function extractActions(text) {
  const t = String(text || '');
  const verbs = [
    '盯着',
    '盯',
    '看着',
    '看',
    '凝视',
    '触碰',
    '触摸',
    '触及',
    '颤抖',
    '压低声音',
    '低声',
    '轻声',
    '记录',
    '后退',
    '靠近',
    '伸手',
    '抬手',
    '推门',
    '奔跑',
    '冲',
    '撞',
    '追',
    '逃',
    '说',
    '说道',
    '喊道',
  ];
  return verbs.filter(v => t.includes(v));
}

function extractEmotions(text) {
  const t = String(text || '');
  const emotionMap = {
    '惊愕': '惊愕',
    '凝重': '凝重',
    '紧张': '紧张',
    '恐惧': '恐惧',
    '愤怒': '愤怒',
    '颤抖': '颤抖',
    '哭': '流泪',
    '泪': '含泪',
    '笑': '微笑',
    '怒': '愤怒',
    '惊': '惊讶',
    '愕': '惊愕',
    '慌': '慌张',
    '怕': '恐惧',
    '抖': '颤抖',
    '叹': '叹气',
    '默': '沉默',
    '僵': '僵硬',
  };
  return Object.entries(emotionMap)
    .filter(([k]) => t.includes(k))
    .map(([, v]) => v);
}

function extractKeyObjects(text) {
  const t = String(text || '');
  const objects = [];
  const objectPattern = /([\u4e00-\u9fa5]{2,6})(?:上的|手中的|面前的|桌上的|怀里的|表面|植株|设备|按钮|屏幕)/g;
  let m;
  while ((m = objectPattern.exec(t)) !== null) {
    objects.push(m[1]);
  }
  if (t.includes('番茄')) objects.unshift('番茄');
  return [...new Set(objects)].slice(0, 3);
}

function extractDialogueQuotes(text) {
  const t = String(text || '');
  const result = [];
  const patterns = [
    { re: /“([^”]+)”/g, open: '“', close: '”' },
    { re: /"([^"]+)"/g, open: '"', close: '"' },
    { re: /「([^」]+)」/g, open: '「', close: '」' },
  ];
  for (const { re, open, close } of patterns) {
    let m;
    while ((m = re.exec(t)) !== null) {
      const quote = String(m[1] || '').trim();
      if (!quote) continue;
      const full = `${open}${quote}${close}`;
      result.push({ quote, full, index: m.index, length: full.length });
    }
  }
  result.sort((a, b) => a.index - b.index);
  return result;
}

function extractDialogueFromText(text) {
  const t = String(text || '');
  const result = [];
  for (const q of extractDialogueQuotes(t)) result.push(q.quote);
  const lines = t.split('\n').map(s => s.trim()).filter(Boolean);
  for (const line of lines) {
    const m = line.match(/^(.{1,16}?)(?:\s*\(([^)]+)\))?\s*(VO|OS)?\s*[：:]\s*(.+)$/i);
    if (m) {
      const rhs = String(m[4] || '').trim();
      if (rhs) result.push(rhs);
    }
  }
  return result;
}

function inferSpeaker(text, quoteIndex) {
  const t = String(text || '');
  const start = Math.max(0, quoteIndex - 40);
  const ctx = t.slice(start, quoteIndex);
  const re = /([\u4e00-\u9fa5]{2,6})(?:[^。\n]{0,12})(?:说|说道|问|答|喊道|低声|轻声|压低声音)/g;
  let m;
  let last = '';
  while ((m = re.exec(ctx)) !== null) last = m[1];
  if (last && !String(last).endsWith('地')) return last;
  const fallback = extractCharacters(ctx);
  return fallback[0] || '';
}

function splitDialogueBeats(sceneBodyText) {
  const t = String(sceneBodyText || '').trim();
  const lines = t.split('\n').map(s => s.trim()).filter(Boolean);
  const beats = [];

  for (const line of lines) {
    if (/^人物[：:]/.test(line)) continue;
    if (/^[【\[]/.test(line) && /[】\]]$/.test(line)) {
      beats.push({ speaker: '', quote: '', text: line, mode: 'note' });
      continue;
    }
    if (/^[◆◇▶►•\-*]/.test(line)) {
      beats.push({ speaker: '', quote: '', text: line.replace(/^[◆◇▶►•\-*]+\s*/, ''), mode: 'action' });
      continue;
    }
    const m = line.match(/^(.{1,16}?)(?:\s*\(([^)]+)\))?\s*(VO|OS)?\s*[：:]\s*(.+)$/i);
    if (m) {
      const left = String(m[1] || '').trim();
      const paren = String(m[2] || '').trim();
      const tag = String(m[3] || '').trim().toUpperCase();
      const rhs = String(m[4] || '').trim();
      const speaker = left.replace(/\s+(VO|OS)$/i, '').trim();
      beats.push({
        speaker,
        quote: rhs,
        text: `${speaker}${tag || paren ? ` ${tag || paren}` : ''}：${rhs}`,
        mode: tag || paren || '',
      });
      continue;
    }
    const qs = extractDialogueQuotes(line);
    if (qs.length) {
      const q = qs[0];
      const speaker = inferSpeaker(line, q.index);
      beats.push({ speaker, quote: q.quote, text: line, mode: '' });
      continue;
    }
    beats.push({ speaker: '', quote: '', text: line, mode: 'narration' });
  }

  const compact = beats.filter(b => String(b.text || '').trim());
  if (compact.some(b => b.quote)) return compact;

  const qsAll = extractDialogueQuotes(t);
  if (qsAll.length === 0) return compact;
  const fallback = [];
  let cursor = 0;
  for (const q of qsAll) {
    const segStart = cursor;
    const segEnd = q.index + q.length;
    const seg = t.slice(segStart, segEnd).trim();
    const speaker = inferSpeaker(t, q.index);
    fallback.push({ speaker, quote: q.quote, text: seg, mode: '' });
    cursor = segEnd;
  }
  return fallback.filter(b => String(b.text || '').trim());
}

function splitNonDialogueBeats(sceneBodyText) {
  const t = String(sceneBodyText || '').trim();
  if (!t) return [];
  const raw = t
    .split(/[\n]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .join('\n');
  const sentences = raw
    .split(/(?<=[。！？!?])/g)
    .map(s => s.trim())
    .filter(Boolean);
  if (sentences.length > 0) return sentences;
  return [raw];
}

function normalizeMovement(movement) {
  const map = {
    static: '固定',
    push_in: '推镜头',
    pull_back: '拉镜头',
    tracking: '移镜头',
    pan: '摇镜头',
  };
  return map[movement] || '固定';
}

function buildLighting(timeOfDay) {
  const t = String(timeOfDay || '');
  if (t.includes('夜') || t.includes('晚')) return '暗调光线，月光/灯光';
  if (t.includes('日') || t.includes('早') || t.includes('晨')) return '明亮自然光';
  return '自然光';
}

function buildSceneContext(scene, fullText) {
  const { heading, body } = stripLeadingHeading(fullText);
  const fromHeading = heading || { title: '', location: '', time_of_day: '' };
  const location =
    (!isPlaceholderSceneText(scene?.location) && String(scene?.location || '').trim()) ||
    (!isPlaceholderSceneText(scene?.title) && String(scene?.title || '').trim()) ||
    String(fromHeading.location || '').trim() ||
    '';
  const time_of_day = String(scene?.time_of_day || '').trim() || String(fromHeading.time_of_day || '').trim() || '';
  const sceneContext = {
    location,
    timeOfDay: time_of_day,
    lighting: buildLighting(time_of_day),
    characters: extractCharacters(body || fullText),
  };
  return { sceneContext, bodyText: body || fullText };
}

function distributeParts(parts, shotCount) {
  const list = Array.isArray(parts) ? parts.filter(Boolean) : [];
  if (list.length === 0) return Array.from({ length: shotCount }, () => '');
  if (list.length <= shotCount) {
    const result = [];
    for (let i = 0; i < shotCount; i++) result.push(list[Math.min(i, list.length - 1)] || '');
    return result;
  }
  const per = Math.ceil(list.length / shotCount);
  const result = [];
  for (let i = 0; i < shotCount; i++) {
    const start = i * per;
    const end = Math.min(start + per, list.length);
    result.push(list.slice(start, end).join(''));
  }
  return result;
}

function generateVisualPrompt(shotType, contentPart, sceneContext, movement, opts = {}) {
  const content = String(contentPart || '').trim();
  const speaker = String(opts.speaker || '').trim();
  const role = String(opts.role || '').trim();
  const allChars = Array.isArray(sceneContext.characters) ? sceneContext.characters : [];
  const characters = (() => {
    if (speaker) return [speaker, ...allChars.filter(c => c && c !== speaker)];
    const c = extractCharacters(content);
    if (c.length) return c;
    return allChars;
  })().filter(Boolean);

  const actions = extractActions(content);
  const emotions = extractEmotions(content);
  const objects = extractKeyObjects(content);
  const hasDialogue = extractDialogueFromText(content).length > 0;

  const loc = sceneContext.location || '场景';
  const time = sceneContext.timeOfDay || '';
  const obj = objects[0] || (content.includes('番茄') ? '番茄' : '');
  const group = characters.length ? characters.join('、') : '人物';
  const emo = emotions[0] || '';

  let detail = '';
  if (role === 'establish') {
    detail = `${loc}内部空间全景，${group}围在${obj || '关键物件'}前，${emo || '氛围紧张'}`;
  } else if (role === 'closing') {
    detail = `${group}中景，${loc}环境可见，${emo || '情绪压迫'}持续蔓延`;
  } else if (shotType === '远景') {
    detail = `${loc}整体空间与结构，${time || '自然光'}下环境质感`;
  } else if (shotType === '全景') {
    const act = actions[0] || (hasDialogue ? '交谈' : '活动');
    detail = `${group}位于${loc}，${act}${obj ? `，画面中可见${obj}` : ''}，环境信息清晰`;
  } else if (shotType === '中景') {
    const subject = speaker || characters[0] || '人物';
    const act = actions[0] || (hasDialogue ? '说话' : '动作表现');
    detail = `${subject}半身，${act}${obj ? `，与${obj}互动` : ''}${emo ? `，${emo}神情` : ''}，背景交代${loc}`;
  } else if (shotType === '近景') {
    const subject = speaker || characters[0] || '人物';
    const e = emo || (hasDialogue ? '情绪变化明显' : '神情专注');
    detail = `${subject}面部近景，${e}${obj ? `，眼神落在${obj}` : ''}，背景虚化`;
  } else if (shotType === '特写') {
    if (objects.length) {
      detail = `${objects[0]}特写，细节清晰，强调关键线索`;
    } else {
      const subject = speaker || characters[0] || '人物';
      const e = emo || '细微表情';
      detail = `${subject}${e}特写，眼神/手部细节突出`;
    }
  } else if (shotType === '大特写') {
    if (objects.length) {
      detail = `${objects[0]}极近距离特写，纹理与光泽可见`;
    } else {
      const subject = speaker || characters[0] || '人物';
      const e = emo || '强烈情绪';
      detail = `${subject}眼神大特写，${e}冲击力强`;
    }
  } else {
    detail = `${loc}内人物动作与情绪推进`;
  }

  const movementDesc = {
    static: '固定镜头',
    push_in: '缓慢推进',
    pull_back: '缓慢拉远',
    tracking: '跟拍',
    pan: '缓慢摇镜',
  };
  return `${shotType}，${detail}，${movementDesc[movement] || '固定镜头'}，${sceneContext.lighting || '自然光'}`;
}

function buildDialogueShotPlan(template, beats, maxShots) {
  const safeBeats = Array.isArray(beats) ? beats.filter(b => String(b.text || '').trim()) : [];
  const plan = [];

  // 建立镜头：场景环境描述（不含台词）
  const envBeats = safeBeats.filter(b => !b.quote);
  if (envBeats.length > 0) {
    plan.push({ shotType: template.shots[0], movement: template.movements[0], duration: template.durations[0], text: envBeats.map(b => b.text).join('\n'), speaker: '', role: 'establish' });
  }

  // 每个台词beat独立成一个镜头，同一说话人连续多句可合并
  const dialogueBeats = safeBeats.filter(b => b.quote);
  let i = 0;
  while (i < dialogueBeats.length && plan.length < maxShots - 1) {
    const b = dialogueBeats[i];
    const isVO = /\bVO\b|\bOS\b/i.test(String(b.mode || ''));
    const hasSpeaker = !!String(b.speaker || '').trim();

    // 同一说话人连续的台词合并到一个镜头
    let combinedText = b.text;
    let combinedSpeaker = b.speaker || '';
    while (i + 1 < dialogueBeats.length && dialogueBeats[i + 1].speaker === combinedSpeaker) {
      i++;
      combinedText += '\n' + dialogueBeats[i].text;
    }

    const shotType = (() => {
      if (!hasSpeaker || isVO) return '全景';
      if (plan.length <= 1) return '中景';
      if (plan.length % 3 === 0) return '中景';
      return '近景';
    })();
    const movement = shotType === '近景' ? 'push_in' : 'static';
    plan.push({ shotType, movement, duration: 3, text: combinedText, speaker: combinedSpeaker, role: 'beat' });
    i++;
  }

  // 收尾镜头
  if (plan.length < maxShots) {
    const closingText = safeBeats[safeBeats.length - 1]?.text || '';
    plan.push({ shotType: template.shots[4] || '中景', movement: template.movements[4] || 'static', duration: template.durations[4] || 4, text: closingText, speaker: '', role: 'closing' });
  }
  return plan.slice(0, maxShots);
}

function buildNonDialogueShotPlan(template, parts, maxShots) {
  const baseCount = template.shots.length;
  const shotCount = Math.min(Math.max(baseCount, Math.min(maxShots, parts.length || baseCount)), maxShots);
  const contentParts = distributeParts(parts, shotCount);
  const plan = [];
  for (let i = 0; i < shotCount; i++) {
    const idx = i % template.shots.length;
    plan.push({
      shotType: template.shots[idx],
      movement: template.movements[idx],
      duration: template.durations[idx],
      text: contentParts[i] || contentParts[contentParts.length - 1] || '',
      speaker: '',
      role: '',
    });
  }
  return plan;
}

function generateShotsForScene(scene, sceneText) {
  const fullText = String(sceneText || scene?.rawContent || scene?.description || '').trim();
  const { sceneContext, bodyText } = buildSceneContext(scene, fullText);
  const sceneType = detectSceneType(bodyText);
  const template = SHOT_TEMPLATES[sceneType] || SHOT_TEMPLATES.environment;

  const maxShots = Math.min(10, Math.max(template.shots.length, bodyText.length > 300 ? template.shots.length + Math.floor((bodyText.length - 300) / 200) : template.shots.length));

  let plan = [];
  if (sceneType === 'dialogue') {
    const beats = splitDialogueBeats(bodyText);
    plan = buildDialogueShotPlan(template, beats, maxShots);
  } else {
    const beats = splitNonDialogueBeats(bodyText);
    plan = buildNonDialogueShotPlan(template, beats, maxShots);
  }

  const shots = [];
  for (let i = 0; i < plan.length; i++) {
    const p = plan[i];
    const text = String(p.text || '').trim();
    const visualPrompt = generateVisualPrompt(p.shotType, text, sceneContext, p.movement, { speaker: p.speaker, role: p.role });
    const dialogueParts = extractDialogueFromText(text);
    const dialogue = dialogueParts.join(' ');
    const original_text = text || bodyText || fullText;
    shots.push({
      shot_number: i + 1,
      shot_type: p.shotType,
      duration: p.duration,
      camera_movement: normalizeMovement(p.movement),
      visual_prompt: visualPrompt,
      visual_description: visualPrompt,
      original_text,
      dialogue: dialogue || '',
      speaker: p.speaker || '',
      action_description: dialogue ? original_text.replace(/["“”「」].*?["“”「」]/g, '').trim() : original_text,
    });
  }

  return { sceneType, shots };
}

module.exports = {
  detectSceneType,
  SHOT_TEMPLATES,
  splitScriptToScenes,
  extractCharacters,
  extractActions,
  extractEmotions,
  extractKeyObjects,
  extractDialogueFromText,
  generateVisualPrompt,
  generateShotsForScene,
};
