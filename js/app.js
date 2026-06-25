import {
  renderMarkup,
  escapeHtml,
  extractTokens,
  SYNTAX_RULES,
  CATEGORY_META,
  CATEGORY_GROUPS,
  parseJsonToEntries,
  isDescriptionField,
  sortDescriptionFields,
} from './parser.js';

const PAGE_SIZE = 24;
const state = {
  view: 'browse',
  category: 'cards',
  search: '',
  fieldFilter: 'all',
  syntaxFilter: '',
  showRaw: false,
  page: 1,
  entries: {},
  allTexts: [],
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

async function loadData() {
  const entries = {};
  const allTexts = [];

  for (const [cat, meta] of Object.entries(CATEGORY_META)) {
    const res = await fetch(meta.file);
    if (!res.ok) throw new Error(`${meta.file} HTTP ${res.status}`);
    const raw = await res.json();
    entries[cat] = parseJsonToEntries(cat, raw);
    for (const entry of entries[cat]) {
      for (const [field, text] of Object.entries(entry.fields)) {
        allTexts.push({ category: cat, id: entry.id, field, text });
      }
    }
  }

  state.entries = entries;
  state.allTexts = allTexts;
}

function getFilteredEntries() {
  const list = state.entries[state.category] || [];
  const q = state.search.trim().toLowerCase();

  return list.filter((entry) => {
    const title = (entry.fields.title || entry.fields.name || '').toLowerCase();
    const id = entry.id.toLowerCase();
    const allFieldText = Object.entries(entry.fields)
      .map(([k, v]) => `${k}:${v}`)
      .join('\n')
      .toLowerCase();

    if (q && !title.includes(q) && !id.includes(q) && !allFieldText.includes(q)) {
      return false;
    }

    if (state.syntaxFilter) {
      const rule = SYNTAX_RULES.find((r) => r.id === state.syntaxFilter);
      if (rule) {
        const hasMatch = Object.values(entry.fields).some((text) => rule.filter(text));
        if (!hasMatch) return false;
      }
    }

    return true;
  });
}

function matchFieldFilter(field) {
  const f = state.fieldFilter;
  if (f === 'all') return true;
  if (f === 'description') {
    return field.includes('description') || field === 'loss' || field.includes('Prompt') ||
      field === 'dialogue' || field === 'body' || field === 'infoText';
  }
  if (f === 'title') return field === 'title' || field === 'name' || field.endsWith('.title');
  if (f === 'options') return field.includes('.options.');
  if (f === 'flavor') return field === 'flavor' || field.includes('flavor');
  return field === f;
}

function getVisibleFields(entry) {
  const fields = sortDescriptionFields(
    Object.keys(entry.fields).filter((f) => isDescriptionField(f) && matchFieldFilter(f))
  );
  return fields;
}

function getEntryTitle(entry) {
  return entry.fields.title || entry.fields.name || entry.id;
}

function renderEntryCard(entry) {
  const fields = getVisibleFields(entry);
  if (fields.length === 0) return '';

  const fieldsHtml = fields.map((field) => {
    const text = entry.fields[field];
    const rendered = renderMarkup(text);
    const rawBlock = state.showRaw
      ? `<div class="raw-text">${escapeHtml(text)}</div>`
      : '';

    return `
      <div class="entry-field">
        <div class="field-label">${escapeHtml(field)}</div>
        <div class="rendered-text">${rendered}</div>
        ${rawBlock}
      </div>`;
  }).join('');

  return `
    <article class="entry-card">
      <div class="entry-header">
        <span class="entry-title">${escapeHtml(getEntryTitle(entry))}</span>
        <span class="entry-id">${escapeHtml(entry.id)}</span>
      </div>
      ${fieldsHtml}
    </article>`;
}

function renderBrowse() {
  const filtered = getFilteredEntries();
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (state.page > totalPages) state.page = totalPages;

  const start = (state.page - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  const grid = $('#entryGrid');
  if (pageItems.length === 0) {
    grid.innerHTML = '<div class="empty-msg">没有匹配的条目</div>';
  } else {
    grid.innerHTML = pageItems.map(renderEntryCard).join('');
  }

  const meta = CATEGORY_META[state.category];
  const fieldCount = state.allTexts.filter((t) => t.category === state.category).length;
  $('#resultsCount').textContent =
    `${meta.label}：${filtered.length} 条实体 · ${fieldCount} 个描述字段` +
    (state.search ? ` · 搜索「${state.search}」` : '');

  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const el = $('#pagination');
  if (totalPages <= 1) {
    el.innerHTML = '';
    return;
  }

  const buttons = [];
  buttons.push(`<button class="page-btn" data-page="prev" ${state.page <= 1 ? 'disabled' : ''}>上一页</button>`);

  for (const p of getPageRange(state.page, totalPages)) {
    if (p === '...') {
      buttons.push('<span class="page-info">…</span>');
    } else {
      buttons.push(
        `<button class="page-btn${p === state.page ? ' active' : ''}" data-page="${p}">${p}</button>`
      );
    }
  }

  buttons.push(`<button class="page-btn" data-page="next" ${state.page >= totalPages ? 'disabled' : ''}>下一页</button>`);
  buttons.push(`<span class="page-info">${state.page} / ${totalPages}</span>`);

  el.innerHTML = buttons.join('');

  el.querySelectorAll('.page-btn[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.page;
      if (val === 'prev') state.page = Math.max(1, state.page - 1);
      else if (val === 'next') state.page = Math.min(totalPages, state.page + 1);
      else state.page = parseInt(val, 10);
      renderBrowse();
      window.scrollTo({ top: 200, behavior: 'smooth' });
    });
  });
}

function getPageRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [1];
  if (current > 3) pages.push('...');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}

function countSyntaxUsage() {
  const counts = {};
  for (const rule of SYNTAX_RULES) counts[rule.id] = 0;
  for (const { text } of state.allTexts) {
    for (const rule of SYNTAX_RULES) {
      if (rule.filter(text)) counts[rule.id]++;
    }
  }
  return counts;
}

function renderSyntaxView() {
  const counts = countSyntaxUsage();
  $('#syntaxGrid').innerHTML = SYNTAX_RULES.map((rule) => {
    const preview = renderMarkup(rule.example);
    return `
      <div class="syntax-card">
        <h3>${escapeHtml(rule.title)}</h3>
        <p>${escapeHtml(rule.desc)}</p>
        <div class="syntax-example">${escapeHtml(rule.example)}</div>
        <div class="syntax-preview">${preview}</div>
        <div class="syntax-count">范例中出现 ${counts[rule.id]} 次 ·
          <button class="link-btn" data-filter="${rule.id}">筛选查看</button>
        </div>
      </div>`;
  }).join('');

  $('#syntaxGrid').querySelectorAll('[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.syntaxFilter = btn.dataset.filter;
      $('#syntaxFilter').value = btn.dataset.filter;
      switchView('browse');
      state.page = 1;
      renderBrowse();
    });
  });
}

function renderStatsView() {
  const grid = $('#statsGrid');
  const counts = countSyntaxUsage();
  const maxCount = Math.max(...Object.values(counts), 1);

  const categoryTotals = Object.entries(CATEGORY_META).map(([cat, meta]) => ({
    label: meta.label,
    count: (state.entries[cat] || []).length,
    fields: state.allTexts.filter((t) => t.category === cat).length,
  }));

  const colorCounts = {};
  const modifierCounts = {};
  for (const { text } of state.allTexts) {
    const tokens = extractTokens(text);
    tokens.colors.forEach((c) => { colorCounts[c] = (colorCounts[c] || 0) + 1; });
    tokens.modifiers.forEach((m) => { modifierCounts[m] = (modifierCounts[m] || 0) + 1; });
  }

  const renderBars = (obj, limit = 12) => Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => {
      const pct = (count / maxCount * 100).toFixed(1);
      return `
        <div class="stat-bar-row">
          <span class="stat-label">${escapeHtml(label)}</span>
          <div class="stat-bar-wrap"><div class="stat-bar" style="width:${pct}%"></div></div>
          <span class="stat-value">${count}</span>
        </div>`;
    }).join('');

  grid.innerHTML = `
    <div class="stat-card">
      <div class="stat-total">${state.allTexts.length}</div>
      <div class="stat-total-label">描述字段总数（官方范例）</div>
    </div>
    <div class="stat-card">
      <div class="stat-total">${Object.keys(CATEGORY_META).length}</div>
      <div class="stat-total-label">内容分类</div>
    </div>
    ${categoryTotals.map((c) => `
      <div class="stat-card stat-card-sm">
        <div class="stat-total stat-total-sm">${c.count}</div>
        <div class="stat-total-label">${c.label} · ${c.fields} 字段</div>
      </div>`).join('')}
    <div class="stat-card stat-card-wide">
      <h3>语法模式使用频率</h3>
      ${renderBars(counts, 20)}
    </div>
    <div class="stat-card">
      <h3>颜色 / 格式标签</h3>
      ${renderBars(colorCounts, 12)}
    </div>
    <div class="stat-card">
      <h3>变量修饰符</h3>
      ${renderBars(modifierCounts, 10)}
    </div>`;
}

function buildCategoryNav() {
  const container = $('#categoryNav');
  container.innerHTML = CATEGORY_GROUPS.map((group) => `
    <div class="cat-group">
      <span class="cat-group-label">${group.label}</span>
      <div class="cat-group-btns">
        ${group.categories.map((cat) => `
          <button class="cat-btn${cat === state.category ? ' active' : ''}" data-category="${cat}">
            ${CATEGORY_META[cat].label}
          </button>`).join('')}
      </div>
    </div>`).join('');

  container.querySelectorAll('.cat-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.cat-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.category = btn.dataset.category;
      state.page = 1;
      state.fieldFilter = 'all';
      updateFieldFilterOptions();
      renderBrowse();
    });
  });
}

function updateSyntaxFilterOptions() {
  const select = $('#syntaxFilter');
  select.innerHTML = '<option value="">语法筛选</option>' +
    SYNTAX_RULES.map((r) => `<option value="${r.id}">${r.title}</option>`).join('');
  select.value = state.syntaxFilter;
}

function updateFieldFilterOptions() {
  const select = $('#fieldFilter');
  select.innerHTML = `
    <option value="all">全部字段</option>
    <option value="description">描述类字段</option>
    <option value="title">标题类字段</option>
    <option value="options">事件选项</option>
    <option value="flavor">风味文本</option>`;
  select.value = state.fieldFilter;
}

function switchView(view) {
  state.view = view;
  $$('.nav-btn[data-view]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  $$('.view').forEach((el) => el.classList.remove('active'));
  $(`#${view}View`).classList.add('active');

  if (view === 'syntax') renderSyntaxView();
  if (view === 'stats') renderStatsView();
  if (view === 'browse') renderBrowse();
}

function bindEvents() {
  $$('.nav-btn[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  $('#searchInput').addEventListener('input', (e) => {
    state.search = e.target.value;
    state.page = 1;
    renderBrowse();
  });

  $('#showRawToggle').addEventListener('change', (e) => {
    state.showRaw = e.target.checked;
    renderBrowse();
  });

  $('#fieldFilter').addEventListener('change', (e) => {
    state.fieldFilter = e.target.value;
    renderBrowse();
  });

  $('#syntaxFilter').addEventListener('change', (e) => {
    state.syntaxFilter = e.target.value;
    state.page = 1;
    renderBrowse();
  });
}

async function init() {
  const grid = $('#entryGrid');
  grid.innerHTML = '<div class="loading-msg">正在加载官方范例…</div>';

  try {
    await loadData();
    buildCategoryNav();
    updateFieldFilterOptions();
    updateSyntaxFilterOptions();
    bindEvents();
    renderBrowse();
  } catch (err) {
    grid.innerHTML = `
      <div class="error-msg">
        <strong>加载失败</strong><br>
        ${escapeHtml(err.message)}<br><br>
        请通过本地 HTTP 服务器访问此页面。<br>
        运行：<code style="color:var(--gold)">python -m http.server 8080</code>
        然后打开 <code style="color:var(--gold)">http://localhost:8080</code>
      </div>`;
  }
}

init();
