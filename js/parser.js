/**
 * 杀戮尖塔描述标记解析器
 * 将描述 JSON 中的富文本标记渲染为 HTML 预览
 */

export function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseBraceBlock(text, start) {
  let depth = 0;
  let i = start;
  for (; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) {
        return { inner: text.slice(start + 1, i), end: i + 1 };
      }
    }
  }
  return { inner: text.slice(start + 1), end: text.length };
}

function splitTopLevel(str, sep) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === sep && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return parts;
}

function renderVariable(inner) {
  const nameMatch = inner.match(/^([\w.]+):(.*)$/s);

  if (!nameMatch) {
    if (inner.includes('|')) {
      const branches = splitTopLevel(inner, '|');
      const rendered = branches.map(b => renderMarkup(b)).join('<span class="desc-branch"> | </span>');
      return `<span class="desc-var">{${rendered}}</span>`;
    }
    return `<span class="desc-var" title="${escapeHtml(inner)}">{${escapeHtml(inner)}}</span>`;
  }

  const name = nameMatch[1];
  const modifier = nameMatch[2];

  if (modifier.startsWith('{')) {
    return `<span class="desc-var" title="${escapeHtml(name)}">{${renderMarkup(modifier)}}</span>`;
  }

  if (modifier.startsWith('energyIcons')) {
    const match = modifier.match(/energyIcons\((\d+)\)/);
    const count = match ? parseInt(match[1], 10) : 1;
    const icons = Array(count).fill('<span class="desc-energy"></span>').join('');
    return `<span class="desc-var" title="${escapeHtml(inner)}">${icons}</span>`;
  }

  if (modifier.startsWith('starIcons')) {
    return `<span class="desc-var" title="${escapeHtml(inner)}"><span class="desc-star"></span></span>`;
  }

  if (modifier === 'diff()' || modifier === 'inverseDiff()' ||
      modifier === 'percentMore()' || modifier === 'percentLess()' || modifier === 'abs()') {
    const sample = modifier === 'inverseDiff()' ? '−N' :
      modifier.includes('percent') ? 'N%' : 'N';
    return `<span class="desc-var desc-blue" title="${escapeHtml(inner)}">${sample}</span>`;
  }

  if (modifier.startsWith('show:')) {
    const branches = splitTopLevel(modifier.slice(5), '|');
    const rendered = branches.map(b => renderMarkup(b)).join('<span class="desc-branch"> | </span>');
    return `<span class="desc-var" title="show 条件">{${rendered}}</span>`;
  }

  if (modifier.startsWith('cond:')) {
    const branches = splitTopLevel(modifier.slice(5), '|');
    const rendered = branches.map(b => renderMarkup(b)).join('<span class="desc-branch"> | </span>');
    return `<span class="desc-var" title="cond 条件">{${rendered}}</span>`;
  }

  if (modifier.startsWith('choose(')) {
    const closeIdx = modifier.indexOf('):');
    const branches = splitTopLevel(modifier.slice(closeIdx + 2), '|');
    const rendered = branches.map(b => renderMarkup(b)).join('<span class="desc-branch"> | </span>');
    return `<span class="desc-var" title="choose 分支">{${rendered}}</span>`;
  }

  if (modifier.startsWith('plural:')) {
    const branches = splitTopLevel(modifier.slice(7), '|');
    const rendered = branches.map(b => renderMarkup(b)).join('<span class="desc-branch"> | </span>');
    return `<span class="desc-var" title="plural 复数">{${rendered}}</span>`;
  }

  if (modifier.includes('|') && !modifier.startsWith('show:') && !modifier.startsWith('cond:') &&
      !modifier.startsWith('plural:') && !modifier.startsWith('choose(')) {
    const branches = splitTopLevel(modifier, '|');
    const rendered = branches.map(b => renderMarkup(b)).join('<span class="desc-branch"> | </span>');
    return `<span class="desc-var" title="${escapeHtml(name)}">{${rendered}}</span>`;
  }

  return `<span class="desc-var" title="${escapeHtml(inner)}">{${escapeHtml(name)}:${escapeHtml(modifier)}}</span>`;
}

export function renderMarkup(text) {
  if (!text) return '';

  let html = '';
  let i = 0;

  while (i < text.length) {
    const tagMatch = text.slice(i).match(/^\[(\w+)\]/);
    if (tagMatch) {
      const tag = tagMatch[1];
      const closeTag = `[/${tag}]`;
      const closeIdx = text.indexOf(closeTag, i + tagMatch[0].length);
      if (closeIdx !== -1) {
        const inner = text.slice(i + tagMatch[0].length, closeIdx);
        html += `<span class="desc-${tag}">${renderMarkup(inner)}</span>`;
        i = closeIdx + closeTag.length;
        continue;
      }
    }

    if (text[i] === '{') {
      const block = parseBraceBlock(text, i);
      html += renderVariable(block.inner);
      i = block.end;
      continue;
    }

    let j = i + 1;
    while (j < text.length && text[j] !== '{' && !text.slice(j).match(/^\[\w+\]/)) {
      j++;
    }
    html += escapeHtml(text.slice(i, j));
    i = j;
  }

  return html;
}

export function extractTokens(text) {
  const tokens = { colors: new Set(), modifiers: new Set(), variables: new Set() };
  if (!text) return tokens;

  for (const m of text.matchAll(/\[(\w+)\]/g)) {
    tokens.colors.add(m[1]);
  }

  for (const m of text.matchAll(/\{([^{}]+(?:\{[^{}]*\}[^{}]*)*)\}/g)) {
    const inner = m[1];
    tokens.variables.add(inner.split(':')[0]);
    if (inner.includes(':diff()')) tokens.modifiers.add('diff');
    if (inner.includes(':energyIcons')) tokens.modifiers.add('energyIcons');
    if (inner.includes(':starIcons')) tokens.modifiers.add('starIcons');
    if (inner.includes(':show:')) tokens.modifiers.add('show');
    if (inner.includes(':cond:')) tokens.modifiers.add('cond');
    if (inner.includes(':choose(')) tokens.modifiers.add('choose');
    if (inner.includes(':plural:')) tokens.modifiers.add('plural');
    if (inner.includes(':inverseDiff()')) tokens.modifiers.add('inverseDiff');
    if (inner.includes(':percentMore()')) tokens.modifiers.add('percentMore');
    if (inner.includes(':percentLess()')) tokens.modifiers.add('percentLess');
  }

  return tokens;
}

/** 判断 JSON 字段是否属于描述文本范例 */
export function isDescriptionField(field) {
  if (field === 'title' || field === 'name') return true;

  const exact = new Set([
    'description', 'smartDescription', 'flavor', 'eventDescription', 'extraText',
    'extraCardText', 'loss', 'dialogue', 'body', 'infoText', 'unlockInfo',
    'unlockText', 'unlock', 'secretDescription', 'remoteDescription',
    'additionalRestSiteHealText', 'selectionScreenPrompt', 'selectionPrompt',
    'discardSelectionPrompt', 'goldMonologue', 'aromaPrinciple',
    'cardsModifierDescription', 'eventDeathPrevention',
  ]);
  if (exact.has(field)) return true;
  if (/Description$/.test(field)) return true;
  if (/\.description$/.test(field)) return true;
  if (/hoverTip\.(title|description)$/.test(field)) return true;
  if (/\.options\.[^.]+\.(title|description)$/.test(field)) return true;
  if (/cardRemovalService\.(title|description)$/.test(field)) return true;
  return false;
}

export const SYNTAX_RULES = [
  {
    id: 'gold',
    title: '关键词高亮 [gold]',
    desc: '标记游戏机制关键词，渲染为金色加粗文字。也用于牌堆名、状态名等术语。',
    example: '获得{Block:diff()}点[gold]格挡[/gold]。',
    filter: (t) => t.includes('[gold]'),
  },
  {
    id: 'blue',
    title: '数值高亮 [blue]',
    desc: '标记固定数值或遗物/能力描述中的具体数字，渲染为蓝色。',
    example: '在每场战斗开始时，获得[blue]{VigorPower}[/blue]点[gold]活力[/gold]。',
    filter: (t) => t.includes('[blue]'),
  },
  {
    id: 'red',
    title: '负面/警告 [red]',
    desc: '标记负面效果、未解锁提示或危险信息，渲染为红色。',
    example: '[red]这个遗物的细节将在未来揭晓……[/red]',
    filter: (t) => t.includes('[red]'),
  },
  {
    id: 'green',
    title: '治疗/增益 [green]',
    desc: '标记生命值恢复等正面数值。',
    example: '在战斗结束时，回复[green]{Heal}[/green]点生命。',
    filter: (t) => t.includes('[green]'),
  },
  {
    id: 'purple',
    title: '附魔/特殊 [purple]',
    desc: '标记附魔名称等特殊紫色文本。',
    example: '添加{Cards:diff()}张[purple]墨影[/purple][gold]小刀[/gold]。',
    filter: (t) => t.includes('[purple]'),
  },
  {
    id: 'orange',
    title: '叙事强调 [orange]',
    desc: '事件文本中的橙色强调，常用于 NPC 名称或重要叙事元素。',
    example: '[orange]熔合者[/orange]重重地锤击着它的骨砧。',
    filter: (t) => t.includes('[orange]'),
  },
  {
    id: 'aqua',
    title: '叙事强调 [aqua]',
    desc: '事件文本中的青蓝色强调。',
    example: '一个拥有[aqua]进阶之魂[/aqua]的人竟然找到了我的工坊？',
    filter: (t) => t.includes('[aqua]'),
  },
  {
    id: 'sine',
    title: '柔和动画 [sine]',
    desc: '事件叙事中的柔和脉动/波浪式文字效果，可嵌套其他颜色标签。',
    example: '[sine][purple]你浸泡了太久，已经忘却了时间的流逝…[/purple][/sine]',
    filter: (t) => t.includes('[sine]'),
  },
  {
    id: 'jitter',
    title: '抖动动画 [jitter]',
    desc: '事件叙事中的颤抖/抖动文字效果，常用于紧张或冲击性语句。',
    example: '[b][jitter][red]好烫！！！[/red][/jitter][/b]',
    filter: (t) => t.includes('[jitter]'),
  },
  {
    id: 'rainbow',
    title: '彩虹文字 [rainbow]',
    desc: '事件中的彩虹渐变色文字，多用于混沌/异变主题。',
    example: '[sine][rainbow]变幻莫测的混沌[/rainbow][/sine]',
    filter: (t) => t.includes('[rainbow]'),
  },
  {
    id: 'bold',
    title: '加粗 [b]',
    desc: '事件对话或旁白中的加粗强调。',
    example: '[b][jitter]锵！锵！！！[/jitter][/b]',
    filter: (t) => t.includes('[b]'),
  },
  {
    id: 'diff',
    title: '动态数值 :diff()',
    desc: '显示随升级/增益变化的数值，升级后通常以绿色显示差值。',
    example: '造成{Damage:diff()}点伤害。',
    filter: (t) => t.includes(':diff()'),
  },
  {
    id: 'energyIcons',
    title: '能量图标 :energyIcons()',
    desc: '将数值渲染为能量球图标。可传参指定数量，如 energyIcons(1)。',
    example: '获得{Energy:energyIcons()}。',
    filter: (t) => t.includes('energyIcons'),
  },
  {
    id: 'starIcons',
    title: '辉星图标 :starIcons()',
    desc: '将数值渲染为辉星（★）图标，用于储君角色机制。',
    example: '获得{Stars:starIcons()}。',
    filter: (t) => t.includes('starIcons'),
  },
  {
    id: 'show',
    title: '升级分支 :show:',
    desc: '根据是否升级显示不同文本，用 | 分隔两个分支。',
    example: '[gold]升级[/gold]你[gold]手牌[/gold]中的{IfUpgraded:show:所有牌|一张牌}。',
    filter: (t) => t.includes(':show:'),
  },
  {
    id: 'cond',
    title: '条件文本 :cond:',
    desc: '根据变量状态选择不同措辞，如所有者名称、初始卡牌名是否存在等。',
    example: '[gold]格挡[/gold]不会在{ApplierName.StringValue:cond:[gold]{OwnerName}的[/gold]|你的}回合开始时被移除。',
    filter: (t) => t.includes(':cond:'),
  },
  {
    id: 'choose',
    title: '枚举分支 :choose()',
    desc: '根据枚举类型或快捷键状态选择文本分支。',
    example: '牌组{Hotkey:choose(None):|（{}）}',
    filter: (t) => t.includes(':choose('),
  },
  {
    id: 'plural',
    title: '复数形式 :plural:',
    desc: '根据数量选择合适的量词或复数形式。',
    example: '移除[blue]{Cards}[/blue]张{plural:牌|牌}。',
    filter: (t) => t.includes(':plural:'),
  },
  {
    id: 'context',
    title: '上下文条件块',
    desc: '如 {InCombat:战斗内文本|}，在特定游戏状态下才显示部分内容。',
    example: '造成{Damage:diff()}点伤害。{InCombat:\n（命中{CalculatedHits:diff()}次）|}',
    filter: (t) => /\{InCombat:/.test(t) || /\{[A-Z]\w*:[^}]*\|/.test(t),
  },
  {
    id: 'binary',
    title: '二元分支 |',
    desc: '无修饰符的 {A|B} 形式，在玩家/敌人、自身/目标等之间切换。',
    example: '每回合开始时，{你的|其}回合开始时…',
    filter: (t) => /\{[^:{}]+\|[^:{}]+\}/.test(t),
  },
];

export const CATEGORY_GROUPS = [
  {
    label: '核心游戏内容',
    categories: ['cards', 'relics', 'powers', 'potions', 'orbs', 'card_keywords', 'enchantments', 'afflictions', 'modifiers', 'intents'],
  },
  {
    label: '事件与叙事',
    categories: ['events'],
  },
  {
    label: '界面与系统',
    categories: ['tips', 'map', 'rest_site', 'game_modes', 'achievements', 'ascension', 'badges', 'epochs', 'characters'],
  },
];

export const CATEGORY_META = {
  cards: { label: '卡牌', file: 'zhs/cards.json' },
  relics: { label: '遗物', file: 'zhs/relics.json' },
  powers: { label: '能力', file: 'zhs/powers.json' },
  potions: { label: '药水', file: 'zhs/potions.json' },
  orbs: { label: '充能球', file: 'zhs/orbs.json' },
  card_keywords: { label: '卡牌关键词', file: 'zhs/card_keywords.json' },
  enchantments: { label: '附魔', file: 'zhs/enchantments.json' },
  afflictions: { label: '苦痛', file: 'zhs/afflictions.json' },
  modifiers: { label: '局内修饰', file: 'zhs/modifiers.json' },
  intents: { label: '意图', file: 'zhs/intents.json' },
  events: { label: '事件', file: 'zhs/events.json' },
  tips: { label: '悬停提示', file: 'zhs/static_hover_tips.json' },
  map: { label: '地图', file: 'zhs/map.json' },
  rest_site: { label: '休息处', file: 'zhs/rest_site_ui.json' },
  game_modes: { label: '游戏模式', file: 'zhs/game_modes.json' },
  achievements: { label: '成就', file: 'zhs/achievements.json' },
  ascension: { label: '进阶', file: 'zhs/ascension.json' },
  badges: { label: '徽章', file: 'zhs/badges.json' },
  epochs: { label: '纪元', file: 'zhs/epochs.json' },
  characters: { label: '角色', file: 'zhs/characters.json' },
};

const FIELD_SORT_ORDER = ['title', 'name', 'description', 'smartDescription', 'loss', 'flavor', 'eventDescription'];

export function sortDescriptionFields(fields) {
  return [...fields].sort((a, b) => {
    const ai = FIELD_SORT_ORDER.indexOf(a);
    const bi = FIELD_SORT_ORDER.indexOf(b);
    if (ai !== -1 || bi !== -1) {
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    }
    return a.localeCompare(b, 'zh-CN');
  });
}

export function parseJsonToEntries(category, raw) {
  const entityMap = new Map();

  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== 'string') continue;
    const dotIdx = key.indexOf('.');
    if (dotIdx === -1) continue;

    const id = key.slice(0, dotIdx);
    const field = key.slice(dotIdx + 1);
    if (!isDescriptionField(field)) continue;

    if (!entityMap.has(id)) {
      entityMap.set(id, { id, category, fields: {} });
    }
    entityMap.get(id).fields[field] = value;
  }

  return [...entityMap.values()]
    .filter((entry) => Object.keys(entry.fields).length > 0)
    .sort((a, b) => {
      const titleA = a.fields.title || a.fields.name || a.id;
      const titleB = b.fields.title || b.fields.name || b.id;
      return titleA.localeCompare(titleB, 'zh-CN');
    });
}
