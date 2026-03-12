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

// ---- 状态 ----
let state = {
  pages: [],
  activePageId: '',
  alwaysOnTop: false,
  menuOpen: false,
};

let saveTimer = null;

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function createDefaultPage(title) {
  return {
    id: generateId(),
    title: title || 'TODO',
    content: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function getActivePage() {
  return state.pages.find(p => p.id === state.activePageId) || state.pages[0];
}

// ---- 持久化 ----
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    callGo('SaveData', {
      pages: state.pages,
      settings: {
        alwaysOnTop: state.alwaysOnTop,
        activePageId: state.activePageId,
      },
    });
  }, 300);
}

async function loadData() {
  const data = await callGo('LoadData');
  if (data && data.pages && data.pages.length > 0) {
    state.pages = data.pages;
    state.activePageId = data.settings?.activePageId || data.pages[0].id;
    state.alwaysOnTop = data.settings?.alwaysOnTop || false;
  } else {
    const page = createDefaultPage();
    state.pages = [page];
    state.activePageId = page.id;
  }
  if (state.alwaysOnTop) {
    callGo('SetAlwaysOnTop', true);
  }
}

// ---- 渲染 ----
function render() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  app.appendChild(renderTitleBar());
  app.appendChild(renderPageTabs());
  app.appendChild(renderEditor());
  app.appendChild(renderFormatToolbar());

  // 关闭菜单的全局点击
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.menu-container') && state.menuOpen) {
      state.menuOpen = false;
      const menu = document.querySelector('.dropdown-menu');
      if (menu) menu.classList.add('hidden');
    }
  });
}

// ---- 标题栏 ----
function renderTitleBar() {
  const bar = document.createElement('div');
  bar.className = 'titlebar';

  // + 按钮
  const addBtn = document.createElement('button');
  addBtn.className = 'titlebar-btn';
  addBtn.title = '新建页面';
  addBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14">
    <line x1="7" y1="1" x2="7" y2="13" stroke="currentColor" stroke-width="2"/>
    <line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" stroke-width="2"/>
  </svg>`;
  addBtn.onclick = () => {
    const page = createDefaultPage('Page ' + (state.pages.length + 1));
    state.pages.push(page);
    state.activePageId = page.id;
    scheduleSave();
    render();
  };

  // 拖拽区
  const drag = document.createElement('div');
  drag.className = 'drag-region';

  // 菜单
  const menuContainer = document.createElement('div');
  menuContainer.className = 'menu-container';

  const menuBtn = document.createElement('button');
  menuBtn.className = 'titlebar-btn';
  menuBtn.title = '菜单';
  menuBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14">
    <circle cx="3" cy="7" r="1.5" fill="currentColor"/>
    <circle cx="7" cy="7" r="1.5" fill="currentColor"/>
    <circle cx="11" cy="7" r="1.5" fill="currentColor"/>
  </svg>`;

  const dropdown = document.createElement('div');
  dropdown.className = 'dropdown-menu hidden';

  const pinItem = document.createElement('div');
  pinItem.className = 'menu-item';
  pinItem.textContent = state.alwaysOnTop ? '取消置顶' : '窗口置顶';
  pinItem.onclick = async (e) => {
    e.stopPropagation();
    state.alwaysOnTop = !state.alwaysOnTop;
    await callGo('SetAlwaysOnTop', state.alwaysOnTop);
    scheduleSave();
    state.menuOpen = false;
    dropdown.classList.add('hidden');
    pinItem.textContent = state.alwaysOnTop ? '取消置顶' : '窗口置顶';
  };

  dropdown.appendChild(pinItem);
  menuContainer.appendChild(menuBtn);
  menuContainer.appendChild(dropdown);

  menuBtn.onclick = (e) => {
    e.stopPropagation();
    state.menuOpen = !state.menuOpen;
    dropdown.classList.toggle('hidden', !state.menuOpen);
  };

  // 关闭按钮
  const closeBtn = document.createElement('button');
  closeBtn.className = 'titlebar-btn close-btn';
  closeBtn.title = '关闭';
  closeBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12">
    <line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" stroke-width="1.8"/>
    <line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" stroke-width="1.8"/>
  </svg>`;
  closeBtn.onclick = () => callGo('WindowClose');

  bar.appendChild(addBtn);
  bar.appendChild(drag);
  bar.appendChild(menuContainer);
  bar.appendChild(closeBtn);
  return bar;
}

// ---- 页签栏 ----
function renderPageTabs() {
  const container = document.createElement('div');
  container.className = 'page-tabs';
  if (state.pages.length <= 1) {
    container.classList.add('hidden');
    return container;
  }

  state.pages.forEach(page => {
    const tab = document.createElement('div');
    tab.className = 'tab' + (page.id === state.activePageId ? ' active' : '');

    const title = document.createElement('span');
    title.className = 'tab-title';
    title.textContent = page.title;
    tab.appendChild(title);

    if (state.pages.length > 1) {
      const closeBtn = document.createElement('button');
      closeBtn.className = 'tab-close';
      closeBtn.innerHTML = `<svg width="8" height="8" viewBox="0 0 8 8">
        <line x1="1" y1="1" x2="7" y2="7" stroke="currentColor" stroke-width="1.5"/>
        <line x1="7" y1="1" x2="1" y2="7" stroke="currentColor" stroke-width="1.5"/>
      </svg>`;
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        const idx = state.pages.findIndex(p => p.id === page.id);
        state.pages.splice(idx, 1);
        if (state.activePageId === page.id) {
          state.activePageId = state.pages[Math.min(idx, state.pages.length - 1)].id;
        }
        scheduleSave();
        render();
      };
      tab.appendChild(closeBtn);
    }

    tab.onclick = () => {
      if (state.activePageId !== page.id) {
        saveCurrentEditor();
        state.activePageId = page.id;
        scheduleSave();
        render();
      }
    };

    container.appendChild(tab);
  });

  return container;
}

// ---- 编辑器 ----
let editorEl = null;
let isComposing = false;

function saveCurrentEditor() {
  if (editorEl) {
    const page = getActivePage();
    if (page) {
      page.content = editorEl.innerHTML;
      page.updatedAt = Date.now();
    }
  }
}

function renderEditor() {
  const container = document.createElement('div');
  container.className = 'editor-container';

  const editor = document.createElement('div');
  editor.className = 'note-editor';
  editor.contentEditable = 'true';
  editor.spellcheck = false;

  const page = getActivePage();
  if (page) {
    editor.innerHTML = page.content;
  }

  editor.addEventListener('input', () => {
    if (isComposing) return;
    const page = getActivePage();
    if (page) {
      page.content = editor.innerHTML;
      page.updatedAt = Date.now();
      scheduleSave();
    }
  });

  editor.addEventListener('compositionstart', () => { isComposing = true; });
  editor.addEventListener('compositionend', () => {
    isComposing = false;
    const page = getActivePage();
    if (page) {
      page.content = editor.innerHTML;
      page.updatedAt = Date.now();
      scheduleSave();
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
        const page = getActivePage();
        if (page) {
          page.content = editor.innerHTML;
          page.updatedAt = Date.now();
          scheduleSave();
        }
      }
    }
  });

  editorEl = editor;
  container.appendChild(editor);
  return container;
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
      e.preventDefault(); // 不抢焦点
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

  return bar;
}

function insertTodoList() {
  if (!editorEl) return;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  // 检查是否已在todo-list中
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
