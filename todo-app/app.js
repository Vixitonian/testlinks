(function () {
  const STORAGE_KEY = 'bein-todos-v2';
  const THEME_KEY = 'bein-theme';
  const $ = (id) => document.getElementById(id);
  const form = $('todo-form'), input = $('todo-input'), dueInput = $('todo-due');
  const list = $('todo-list'), emptyMsg = $('empty-msg'), count = $('count');
  const clearBtn = $('clear-done'), markAll = $('mark-all'), search = $('search');
  const themeBtn = $('theme-toggle');
  const filterBtns = document.querySelectorAll('.filter');

  let todos = load();
  let filter = 'all';
  let query = '';

  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (Array.isArray(data)) return data;
      const old = JSON.parse(localStorage.getItem('bein-todos'));
      if (Array.isArray(old)) return old.map(t => ({ due: null, priority: 0, ...t }));
      return [];
    } catch (e) { return []; }
  }
  const PRIORITIES = ['', 'Low', 'Medium', 'High'];
  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(todos)); }

  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function dueInfo(t) {
    if (!t.due || t.done) return null;
    const today = todayStr();
    if (t.due < today) return { cls: 'overdue', label: 'Overdue · ' + fmt(t.due) };
    if (t.due === today) return { cls: 'today', label: 'Due today' };
    return { cls: '', label: 'Due ' + fmt(t.due) };
  }
  function fmt(s) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function visibleTodos() {
    const q = query.trim().toLowerCase();
    return todos.filter(t => {
      if (filter === 'active' && t.done) return false;
      if (filter === 'done' && !t.done) return false;
      return !q || t.text.toLowerCase().includes(q);
    });
  }

  function render() {
    list.innerHTML = '';
    const visible = visibleTodos();

    visible.forEach(t => {
      const li = document.createElement('li');
      li.className = 'todo-item' + (t.done ? ' done' : '');
      li.dataset.id = t.id;

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = t.done;
      cb.setAttribute('aria-label', 'Mark "' + t.text + '" as done');
      cb.addEventListener('change', () => { t.done = cb.checked; save(); render(); });

      const body = document.createElement('div');
      body.className = 'todo-body';
      const span = document.createElement('span');
      span.className = 'todo-text';
      span.textContent = t.text;
      body.appendChild(span);

      const due = dueInfo(t);
      if (due) {
        const badge = document.createElement('span');
        badge.className = 'due ' + due.cls;
        badge.textContent = due.label;
        body.appendChild(badge);
      } else if (t.due && t.done) {
        const badge = document.createElement('span');
        badge.className = 'due';
        badge.textContent = fmt(t.due);
        body.appendChild(badge);
      }

      if (t.priority) {
        const p = document.createElement('span');
        p.className = 'due prio prio' + t.priority;
        p.textContent = PRIORITIES[t.priority] + ' priority';
        body.appendChild(p);
      }
      const prio = iconButton('⚑', 'Cycle priority', 'prio-btn', () => {
        t.priority = ((t.priority || 0) + 1) % 4; save(); render();
      });
      const edit = iconButton('✎', 'Edit', 'edit', () => startEdit(t, li));
      const del = iconButton('×', 'Delete', 'delete', () => {
        const idx = todos.findIndex(x => x.id === t.id);
        todos.splice(idx, 1); save(); render();
        showUndo('Todo deleted', () => { todos.splice(idx, 0, t); save(); render(); });
      });

      li.append(cb, body, prio, edit, del);
      list.appendChild(li);
    });

    const hasTodos = todos.length > 0;
    if (!hasTodos) emptyMsg.textContent = 'Nothing here yet. Add your first todo above!';
    else if (visible.length === 0) emptyMsg.textContent = 'No todos match this view.';
    else emptyMsg.textContent = '';

    const left = todos.filter(t => !t.done).length;
    count.textContent = `${left} item${left === 1 ? '' : 's'} left`;
    markAll.checked = hasTodos && left === 0;
    markAll.indeterminate = hasTodos && left > 0 && left < todos.length;
    markAll.disabled = !hasTodos;
    clearBtn.hidden = !todos.some(t => t.done);
  }

  let toastTimer;
  function showUndo(msg, onUndo) {
    const toast = $('toast');
    $('toast-msg').textContent = msg;
    toast.hidden = false;
    $('toast-undo').onclick = () => { onUndo(); toast.hidden = true; clearTimeout(toastTimer); };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 6000);
  }

  function iconButton(symbol, label, cls, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'icon-btn ' + cls;
    b.textContent = symbol;
    b.title = label;
    b.setAttribute('aria-label', label);
    b.addEventListener('click', onClick);
    return b;
  }

  function startEdit(t, li) {
    const body = li.querySelector('.todo-body');
    const edit = document.createElement('input');
    edit.type = 'text';
    edit.value = t.text;
    edit.maxLength = 200;
    edit.className = 'edit-input';
    edit.setAttribute('aria-label', 'Edit todo');
    body.replaceChildren(edit);
    edit.focus();
    edit.select();

    let finished = false;
    const finish = (commit) => {
      if (finished) return;
      finished = true;
      const val = edit.value.trim();
      if (commit && val) t.text = val;
      save(); render();
    };
    edit.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      if (e.key === 'Escape') finish(false);
    });
    edit.addEventListener('blur', () => finish(true));
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) { input.focus(); return; }
    todos.unshift({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      text,
      done: false,
      due: dueInput.value || null,
      priority: Number($('todo-prio').value) || 0,
      created: Date.now()
    });
    input.value = '';
    dueInput.value = '';
    $('todo-prio').value = '0';
    input.focus();
    save(); render();
  });

  filterBtns.forEach(btn => btn.addEventListener('click', () => {
    filter = btn.dataset.filter;
    filterBtns.forEach(b => {
      b.classList.toggle('active', b === btn);
      b.setAttribute('aria-pressed', String(b === btn));
    });
    render();
  }));

  search.addEventListener('input', () => { query = search.value; render(); });

  markAll.addEventListener('change', () => {
    const target = markAll.checked;
    todos.forEach(t => { t.done = target; });
    save(); render();
  });

  clearBtn.addEventListener('click', () => {
    const before = todos.slice();
    todos = todos.filter(t => !t.done); save(); render();
    showUndo('Completed todos cleared', () => { todos = before; save(); render(); });
  });

  // Theme: saved choice, otherwise follow the system setting
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    themeBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
  }
  const savedTheme = localStorage.getItem(THEME_KEY);
  applyTheme(savedTheme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  themeBtn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  });

  // Keyboard: "/" focuses search (when not typing)
  document.addEventListener('keydown', e => {
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault(); search.focus();
    }
  });

  render();
})();
