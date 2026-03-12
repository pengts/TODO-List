import './style.css';

// ---- Wails Go 绑定 ----
let GoApp = {};

async function initBindings() {
  try {
    const mod = await import('../wailsjs/go/main/App');
    GoApp = mod;
  } catch (e) {
    console.warn('Wails bindings not available, running in browser mode');
  }
}

async function callGo(fn, ...args) {
  try {
    if (GoApp[fn]) return await GoApp[fn](...args);
  } catch (e) {
    console.error(`Go call ${fn} failed:`, e);
  }
  return null;
}

// ---- 颜色主题 ----
const THEMES = {
  green:  { bg: '#d4edbc', titlebar: '#c6e4a5', toolbar: '#c6e4a5', hover: '#b8dc94', active: '#a8d080', border: '#b0d490', check: '#8ab86e' },
  yellow: { bg: '#f5f0c1', titlebar: '#ece6a0', toolbar: '#ece6a0', hover: '#e3da85', active: '#d9ce6e', border: '#d9ce6e', check: '#c4b94e' },
  blue:   { bg: '#c9e0f5', titlebar: '#afd1ee', toolbar: '#afd1ee', hover: '#96c2e6', active: '#7db3de', border: '#96c2e6', check: '#6a9fd0' },
  pink:   { bg: '#f5d0d8', titlebar: '#edb8c4', toolbar: '#edb8c4', hover: '#e4a0b0', active: '#db899d', border: '#e4a0b0', check: '#d07088' },
  purple: { bg: '#ddd0f0', titlebar: '#cdbde6', toolbar: '#cdbde6', hover: '#bca8dc', active: '#ab94d2', border: '#bca8dc', check: '#9a7ec8' },
  orange: { bg: '#fce0c4', titlebar: '#f8d0a6', toolbar: '#f8d0a6', hover: '#f4c08a', active: '#f0b06e', border: '#f0b06e', check: '#e09840' },
};

function applyTheme(themeName) {
  const t = THEMES[themeName] || THEMES.green;
  const root = document.documentElement;
  root.style.setProperty('--bg-primary', t.bg);
  root.style.setProperty('--bg-titlebar', t.titlebar);
  root.style.setProperty('--bg-toolbar', t.toolbar);
  root.style.setProperty('--bg-hover', t.hover);
  root.style.setProperty('--bg-active', t.active);
  root.style.setProperty('--border-color', t.border);
}

// ---- 状态 ----
let state = {
  page: null,      // 当前窗口的页面
  pageId: '',      // 当前窗口绑定的pageId
  allData: null,   // 全部数据（用于保存）
  pinned: false,
  theme: 'green',
};

let saveTimer = null;

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---- 持久化 ----
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!state.allData || !state.page) return;
    // 更新当前page到allData
    const idx = state.allData.pages.findIndex(p => p.id === state.pageId);
    if (idx >= 0) {
      state.allData.pages[idx] = state.page;
    }
    // 保存置顶和主题状态
    if (!state.allData.settings.alwaysOnTop) state.allData.settings.alwaysOnTop = {};
    state.allData.settings.alwaysOnTop[state.pageId] = state.pinned;
    if (!state.allData.settings.themes) state.allData.settings.themes = {};
    state.allData.settings.themes[state.pageId] = state.theme;
    callGo('SaveData', state.allData);
  }, 300);
}

async function loadData() {
  // 获取当前窗口绑定的pageId
  state.pageId = await callGo('GetPageID') || '';

  const data = await callGo('LoadData');
  if (data && data.pages && data.pages.length > 0) {
    if (!data.settings) data.settings = {};
    if (!data.settings.alwaysOnTop) data.settings.alwaysOnTop = {};
    if (!data.settings.themes) data.settings.themes = {};
    state.allData = data;

    if (state.pageId) {
      state.page = data.pages.find(p => p.id === state.pageId);
    }
    if (!state.page) {
      // 没指定pageId或找不到，用第一个
      state.page = data.pages[0];
      state.pageId = state.page.id;
    }
    state.pinned = data.settings.alwaysOnTop[state.pageId] || false;
    state.theme = data.settings.themes[state.pageId] || 'green';
  } else {
    // 首次启动，创建默认页
    const page = {
      id: generateId(),
      title: '',
      content: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    state.page = page;
    state.pageId = page.id;
    state.allData = {
      pages: [page],
      settings: { alwaysOnTop: {} },
    };
    scheduleSave();
  }

  if (state.pinned) {
    callGo('SetAlwaysOnTop', true);
  }
  applyTheme(state.theme);
}

// ---- 渲染 ----
function render() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  app.appendChild(renderTitleBar());
  app.appendChild(renderEditor());
  app.appendChild(renderFormatToolbar());
}

// ---- 标题栏 ----
function renderTitleBar() {
  const bar = document.createElement('div');
  bar.className = 'titlebar';

  // + 新建窗口按钮
  const addBtn = document.createElement('button');
  addBtn.className = 'titlebar-btn add-btn';
  addBtn.title = '新建便签';
  addBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16">
    <line x1="8" y1="2" x2="8" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
  addBtn.onclick = async () => {
    const newPage = {
      id: generateId(),
      title: '',
      content: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    state.allData.pages.push(newPage);
    await callGo('SaveData', state.allData);
    await callGo('NewWindow', newPage.id);
  };

  // 便签列表按钮
  const listContainer = document.createElement('div');
  listContainer.className = 'list-container';

  const listBtn = document.createElement('button');
  listBtn.className = 'titlebar-btn list-btn';
  listBtn.title = '便签列表';
  listBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16">
    <line x1="1" y1="3" x2="15" y2="3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    <line x1="1" y1="8" x2="15" y2="8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    <line x1="1" y1="13" x2="15" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
  </svg>`;

  const listPanel = document.createElement('div');
  listPanel.className = 'note-list-panel hidden';

  listBtn.onclick = async (e) => {
    e.stopPropagation();
    const isHidden = listPanel.classList.contains('hidden');
    if (isHidden) {
      // 重新从磁盘加载最新数据再显示
      const freshData = await callGo('LoadData');
      if (freshData && freshData.pages) {
        state.allData = freshData;
      }
      renderNoteList(listPanel);
    }
    listPanel.classList.toggle('hidden');
  };

  listContainer.appendChild(listBtn);
  listContainer.appendChild(listPanel);

  // 拖拽区
  const drag = document.createElement('div');
  drag.className = 'drag-region';

  // 置顶大头钉按钮
  const pinBtn = document.createElement('button');
  pinBtn.className = 'titlebar-btn pin-btn' + (state.pinned ? ' active' : '');
  pinBtn.title = state.pinned ? '取消置顶' : '窗口置顶';
  pinBtn.innerHTML = getPinSvg(state.pinned);
  pinBtn.onclick = async () => {
    state.pinned = !state.pinned;
    await callGo('SetAlwaysOnTop', state.pinned);
    pinBtn.className = 'titlebar-btn pin-btn' + (state.pinned ? ' active' : '');
    pinBtn.title = state.pinned ? '取消置顶' : '窗口置顶';
    pinBtn.innerHTML = getPinSvg(state.pinned);
    scheduleSave();
  };

  // 关闭按钮
  const closeBtn = document.createElement('button');
  closeBtn.className = 'titlebar-btn close-btn';
  closeBtn.title = '关闭';
  closeBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12">
    <line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    <line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
  </svg>`;
  closeBtn.onclick = () => callGo('WindowClose');

  // 点击其他区域关闭列表面板
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.list-container')) {
      listPanel.classList.add('hidden');
    }
  });

  bar.appendChild(addBtn);
  bar.appendChild(listContainer);
  bar.appendChild(drag);
  bar.appendChild(pinBtn);
  bar.appendChild(closeBtn);
  return bar;
}

// ---- 便签列表面板 ----
function renderNoteList(panel) {
  panel.innerHTML = '';

  const pages = state.allData?.pages || [];
  if (pages.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'note-list-empty';
    empty.textContent = '暂无便签';
    panel.appendChild(empty);
    return;
  }

  pages.forEach(page => {
    const item = document.createElement('div');
    item.className = 'note-list-item' + (page.id === state.pageId ? ' current' : '');

    const info = document.createElement('div');
    info.className = 'note-list-info';
    info.onclick = async () => {
      if (page.id === state.pageId) return; // 当前页不重复打开
      await callGo('NewWindow', page.id);
      panel.classList.add('hidden');
    };

    const preview = document.createElement('div');
    preview.className = 'note-list-preview';
    // 提取纯文本预览
    const text = stripHtml(page.content).trim();
    preview.textContent = text ? text.slice(0, 30) + (text.length > 30 ? '...' : '') : '(空便签)';

    const time = document.createElement('div');
    time.className = 'note-list-time';
    time.textContent = formatTime(page.updatedAt);

    info.appendChild(preview);
    info.appendChild(time);
    item.appendChild(info);

    // 删除按钮（当前页不允许删除自己）
    if (page.id !== state.pageId) {
      const delBtn = document.createElement('button');
      delBtn.className = 'note-list-del';
      delBtn.title = '永久删除';
      delBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12">
        <line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>`;
      delBtn.onclick = async (e) => {
        e.stopPropagation();
        await callGo('DeletePage', page.id);
        // 刷新allData
        const freshData = await callGo('LoadData');
        if (freshData) state.allData = freshData;
        renderNoteList(panel);
      };
      item.appendChild(delBtn);
    }

    panel.appendChild(item);
  });
}

function stripHtml(html) {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || '';
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  if (d.toDateString() === now.toDateString()) {
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return `${pad(d.getMonth()+1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getPinSvg(pinned) {
  if (pinned) {
    // 实心大头钉（已置顶）
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 2L14.5 3.5L15 6L10 11H6L4.5 12.5L9 17L4 22H6L11 17L15.5 21.5L17 20V16L22 11L24.5 11.5L26 10L16 2Z"
        transform="scale(0.75) translate(2,2)"
        fill="currentColor" stroke="currentColor" stroke-width="0.5" stroke-linejoin="round"/>
    </svg>`;
  }
  // 空心大头钉（未置顶）
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M16 2L14.5 3.5L15 6L10 11H6L4.5 12.5L9 17L4 22H6L11 17L15.5 21.5L17 20V16L22 11L24.5 11.5L26 10L16 2Z"
      transform="scale(0.75) translate(2,2)"
      fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
  </svg>`;
}

// ---- 编辑器 ----
let editorEl = null;
let isComposing = false;

function renderEditor() {
  const container = document.createElement('div');
  container.className = 'editor-container';

  const editor = document.createElement('div');
  editor.className = 'note-editor';
  editor.contentEditable = 'true';
  editor.spellcheck = false;

  if (state.page) {
    if (state.page.content) {
      editor.innerHTML = state.page.content;
    } else {
      editor.setAttribute('data-placeholder', '记笔记...');
    }
  }

  editor.addEventListener('input', () => {
    if (isComposing) return;
    syncEditorToState(editor);
  });

  editor.addEventListener('compositionstart', () => { isComposing = true; });
  editor.addEventListener('compositionend', () => {
    isComposing = false;
    syncEditorToState(editor);
  });

  editor.addEventListener('focus', () => {
    editor.removeAttribute('data-placeholder');
  });

  editor.addEventListener('blur', () => {
    if (!editor.innerHTML || editor.innerHTML === '<br>') {
      editor.setAttribute('data-placeholder', '记笔记...');
    }
  });

  // TODO checkbox 点击
  editor.addEventListener('click', (e) => {
    const target = e.target;
    if (target.tagName === 'LI' && target.parentElement?.classList.contains('todo-list')) {
      const rect = target.getBoundingClientRect();
      if (e.clientX - rect.left < 24) {
        const checked = target.getAttribute('data-checked') === 'true';
        target.setAttribute('data-checked', String(!checked));
        e.preventDefault();
        syncEditorToState(editor);
      }
    }
  });

  editorEl = editor;
  container.appendChild(editor);
  return container;
}

function syncEditorToState(editor) {
  if (!state.page) return;
  state.page.content = editor.innerHTML;
  state.page.updatedAt = Date.now();
  scheduleSave();
}

// ---- 格式工具栏 ----
function renderFormatToolbar() {
  const bar = document.createElement('div');
  bar.className = 'format-toolbar';

  function addBtn(title, html, action) {
    const btn = document.createElement('button');
    btn.className = 'toolbar-btn';
    btn.title = title;
    btn.innerHTML = html;
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      action();
    });
    bar.appendChild(btn);
  }

  function addDivider() {
    const d = document.createElement('div');
    d.className = 'toolbar-divider';
    bar.appendChild(d);
  }

  addBtn('粗体', '<strong>B</strong>', () => document.execCommand('bold'));
  addBtn('斜体', '<em>I</em>', () => document.execCommand('italic'));
  addBtn('下划线', '<span style="text-decoration:underline">U</span>', () => document.execCommand('underline'));
  addBtn('删除线', '<span style="text-decoration:line-through">ab</span>', () => document.execCommand('strikeThrough'));

  addDivider();

  addBtn('有序列表',
    `<svg width="16" height="16" viewBox="0 0 16 16">
      <text x="1" y="5" font-size="5" fill="currentColor">1.</text>
      <line x1="7" y1="3" x2="15" y2="3" stroke="currentColor" stroke-width="1.5"/>
      <text x="1" y="10" font-size="5" fill="currentColor">2.</text>
      <line x1="7" y1="8" x2="15" y2="8" stroke="currentColor" stroke-width="1.5"/>
      <text x="1" y="15" font-size="5" fill="currentColor">3.</text>
      <line x1="7" y1="13" x2="15" y2="13" stroke="currentColor" stroke-width="1.5"/>
    </svg>`,
    () => document.execCommand('insertOrderedList'));

  addBtn('无序列表',
    `<svg width="16" height="16" viewBox="0 0 16 16">
      <circle cx="3" cy="3" r="1.5" fill="currentColor"/>
      <line x1="7" y1="3" x2="15" y2="3" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="3" cy="8" r="1.5" fill="currentColor"/>
      <line x1="7" y1="8" x2="15" y2="8" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="3" cy="13" r="1.5" fill="currentColor"/>
      <line x1="7" y1="13" x2="15" y2="13" stroke="currentColor" stroke-width="1.5"/>
    </svg>`,
    () => document.execCommand('insertUnorderedList'));

  addBtn('TODO列表',
    `<svg width="16" height="16" viewBox="0 0 16 16">
      <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.2" fill="none"/>
      <line x1="9" y1="4" x2="15" y2="4" stroke="currentColor" stroke-width="1.5"/>
      <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.2" fill="none"/>
      <polyline points="2.5,12 4,13.5 6,10.5" stroke="currentColor" stroke-width="1.2" fill="none"/>
      <line x1="9" y1="12" x2="15" y2="12" stroke="currentColor" stroke-width="1.5"/>
    </svg>`,
    () => insertTodoList());

  // 右侧弹性间距
  const spacer = document.createElement('div');
  spacer.style.flex = '1';
  bar.appendChild(spacer);

  // 颜色选择器
  const colorContainer = document.createElement('div');
  colorContainer.className = 'color-picker-container';

  const colorBtn = document.createElement('button');
  colorBtn.className = 'toolbar-btn color-btn';
  colorBtn.title = '更换颜色';
  colorBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16">
    <circle cx="8" cy="8" r="6" fill="${THEMES[state.theme].active}" stroke="${THEMES[state.theme].border}" stroke-width="1.5"/>
  </svg>`;

  const colorPanel = document.createElement('div');
  colorPanel.className = 'color-panel hidden';

  Object.keys(THEMES).forEach(name => {
    const dot = document.createElement('button');
    dot.className = 'color-dot' + (name === state.theme ? ' active' : '');
    dot.style.background = THEMES[name].bg;
    dot.style.borderColor = THEMES[name].active;
    dot.title = name;
    dot.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      state.theme = name;
      applyTheme(name);
      scheduleSave();
      // 更新按钮和面板状态
      colorBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="6" fill="${THEMES[name].active}" stroke="${THEMES[name].border}" stroke-width="1.5"/>
      </svg>`;
      colorPanel.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
      colorPanel.classList.add('hidden');
    });
    colorPanel.appendChild(dot);
  });

  colorBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    colorPanel.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.color-picker-container')) {
      colorPanel.classList.add('hidden');
    }
  });

  colorContainer.appendChild(colorBtn);
  colorContainer.appendChild(colorPanel);
  bar.appendChild(colorContainer);

  return bar;
}

function insertTodoList() {
  if (!editorEl) return;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  let node = sel.getRangeAt(0).startContainer;
  while (node && node !== editorEl) {
    if (node instanceof HTMLUListElement && node.classList.contains('todo-list')) {
      document.execCommand('insertUnorderedList');
      return;
    }
    node = node.parentNode;
  }

  document.execCommand('insertUnorderedList');

  const sel2 = window.getSelection();
  if (!sel2 || sel2.rangeCount === 0) return;
  let cur = sel2.getRangeAt(0).startContainer;
  while (cur && cur !== editorEl) {
    if (cur instanceof HTMLUListElement) {
      cur.classList.add('todo-list');
      Array.from(cur.children).forEach(li => {
        if (li instanceof HTMLLIElement && !li.hasAttribute('data-checked')) {
          li.setAttribute('data-checked', 'false');
        }
      });
      break;
    }
    cur = cur.parentNode;
  }
}

// ---- 启动 ----
initBindings().then(async () => {
  await loadData();
  render();
});
