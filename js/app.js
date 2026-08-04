'use strict';
/* 主逻辑：启动、首页、全部待办、待办编辑、专注、抽屉、设置、天气 */

const S = {
  todos: [], topics: [], books: [], shows: [], episodes: [], sports: [], meals: [],
  userName: '杨错', weather: null, exp: null
};

const SRC_COLOR = { '选题库': '#E89A72', '自媒体': '#E89A72', '读书': '#8FDDB4' };
const accentOf = t => (t.src && SRC_COLOR[t.src.label]) || 'rgba(255,255,255,0.45)';
const srcText = t => t.src ? '来自 ' + t.src.label : '手动新建';

/* ═══════════ 启动 ═══════════ */
if (navigator.standalone) document.documentElement.classList.add('standalone');

function vpDebug() {
  const el = $('#vpDebug');
  if (!el) return;
  if (!location.search.includes('debug')) { el.textContent = ''; return; }
  el.textContent = `ih:${window.innerHeight} sh:${screen.height} sa:${navigator.standalone ? 1 : 0}`;
}

async function Boot() {
  await DB.open();
  S.userName = (await DB.getMeta('userName')) || '杨错';
  await seedIfNeeded();
  await seedDemo();
  [S.todos, S.topics, S.books, S.shows, S.episodes, S.sports, S.meals] = await Promise.all([
    DB.allTodos(), DB.allTopics(), DB.allBooks(), DB.allShows(), DB.allEpisodes(), DB.allSports(), DB.allMeals()
  ]);
  bindCoreSheets();
  Home.init();
  AllTodos.init();
  TodoEdit.init();
  Focus.init();
  Settings.init();
  Topics.init();
  Books.init();
  Podcast.init();
  Sport.init();
  Meal.init();
  bindDrawer();
  Home.refresh();
  initWeather();
  vpDebug();
  window.addEventListener('resize', vpDebug);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  setInterval(() => {
    Home.greet();
    if (S._day !== todayStr()) { S._day = todayStr(); Nav.refreshTop(); Home.dateLine(); }
  }, 60000);
  S._day = todayStr();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && (!S.weather || Date.now() - S.weather.ts > 30 * 60e3)) initWeather();
  });
  await Focus.restore();
  await Sync.init();
}

async function seedIfNeeded() {
  if (await DB.getMeta('seeded')) return;
  const t = todayStr();
  const mk = (id, title, note, date, time, src) =>
    ({ id, title, note, date, time, src, done: false, doneAt: null, focusMin: 0, focusRounds: 0, createdAt: Date.now(), updatedAt: Date.now() });
  const seed = [
    mk('seed-td1', '定下周 3 个备选选题', '从选题库里挑 8 条，按可拍性排序，只留 3 条。', t, '10:00', { type: null, id: null, label: '选题库' }),
    mk('seed-td2', '读《创新者的窘境》30 分钟', '读第 6 章，重点看「资源依赖」那部分。', t, '21:30', { type: null, id: null, label: '读书' }),
    mk('seed-td3', '整理旧素材硬盘', '', null, null, null)
  ];
  for (const s of seed) await DB.putTodos(s);
  await DB.setMeta('seeded', 1);
}

/* ═══════════ 待办数据操作 ═══════════ */
async function saveTodo(t) {
  t.updatedAt = Date.now();
  await DB.putTodos(t);
  const i = S.todos.findIndex(x => x.id === t.id);
  if (i >= 0) S.todos[i] = t; else S.todos.push(t);
}
async function removeTodo(id) {
  await DB.delTodos(id);
  S.todos = S.todos.filter(x => x.id !== id);
}
const todoById = id => S.todos.find(x => x.id === id);
const sortTodos = list => list.slice().sort((a, b) =>
  (a.done ? 1 : 0) - (b.done ? 1 : 0) ||
  (a.time || '99:99').localeCompare(b.time || '99:99') || a.createdAt - b.createdAt);
const todosOn = date => sortTodos(S.todos.filter(t => t.date === date));
const overdueTodos = () => {
  const t = todayStr();
  return S.todos.filter(x => x.date && x.date < t && !x.done)
    .sort((a, b) => b.date.localeCompare(a.date) || a.createdAt - b.createdAt);
};

async function toggleTodo(id) {
  const t = todoById(id);
  t.done = !t.done;
  t.doneAt = t.done ? Date.now() : null;
  await saveTodo(t);
  if (t.done && t.src && t.src.type === 'topic') Topics.onStageDone(t);
}

/* ═══════════ 首页 ═══════════ */
const Home = {
  init() {
    $('#weatherCard').addEventListener('click', () => Nav.push('allTodos'));
    $('#btnNew').addEventListener('click', () => Nav.push('todoEdit', { date: todayStr() }));
    for (const [sel, isOvd] of [['#todayList', false], ['#overdueList', true]]) {
      $(sel).addEventListener('click', async e => {
        const card = e.target.closest('.tcard');
        if (!card) return;
        const id = card.dataset.id;
        const act = e.target.closest('[data-act]')?.dataset.act;
        const t = todoById(id);
        if (act === 'toggle') { this.toggleWithFx(id, isOvd); return; }
        if (act === 'focus') { Focus.enter(id); return; }
        if (act === 'defer') { t.date = addDays(todayStr(), 1); await saveTodo(t); S.exp = null; this.refresh(); return; }
        if (act === 'toToday') { t.date = todayStr(); await saveTodo(t); S.exp = null; this.refresh(); return; }
        if (act === 'redate') {
          openDateSheet({ date: t.date, dotFn: dotForTodos, onPick: async d => { t.date = d; await saveTodo(t); S.exp = null; this.refresh(); } });
          return;
        }
        if (act === 'edit') { Nav.push('todoEdit', { id }); return; }
        S.exp = S.exp === id ? null : id;
        this.refresh();
      });
    }
    Nav.register('home', { refresh: () => this.refresh() });
    this.greet(); this.dateLine();
  },

  async toggleWithFx(id, fromOverdue) {
    const t = todoById(id);
    await toggleTodo(id);
    if (fromOverdue && t.done) {
      const el = document.querySelector(`#overdueList .tcard[data-id="${id}"]`);
      if (el) {
        el.classList.add('done');
        setTimeout(() => { el.classList.add('leaving'); setTimeout(() => this.refresh(), 280); }, 320);
        return;
      }
    }
    this.refresh();
  },

  greet() {
    const h = new Date().getHours();
    const g = h < 5 ? '晚上好' : h < 11 ? '早上好' : h < 13 ? '中午好' : h < 18 ? '下午好' : '晚上好';
    $('#greet').textContent = g + '，' + S.userName;
  },

  dateLine() {
    const d = new Date();
    $('#dateLine').textContent = (d.getMonth() + 1) + '月' + d.getDate() + '日 星期' + WD[d.getDay()] + ' · 农历' + Lunar.from(d);
  },

  card(t, ovd) {
    const open = S.exp === t.id;
    const meta = t.time ? t.time + ' · ' + srcText(t) : srcText(t);
    const focusLabel = Focus.activeFor(t.id) ? '回到专注' : '进入专注';
    if (!ovd) return `
      <div class="tcard ${t.done ? 'done' : ''} ${open ? 'open' : ''}" data-id="${t.id}">
        <div class="t-accent" style="background:${accentOf(t)}"></div>
        <div class="t-main">
          <div class="t-title">${esc(t.title)}</div>
          <div class="t-meta">${esc(meta)}</div>
          ${open ? `
            ${t.note ? `<div class="t-note">${esc(t.note)}</div>` : ''}
            <div class="t-acts">
              <button class="t-act pri" data-act="focus">${focusLabel}</button>
              <button class="t-act" data-act="defer">推迟到明天</button>
              <button class="t-act" data-act="edit">编辑</button>
            </div>` : ''}
        </div>
        <button class="t-ring" data-act="toggle">✓</button>
      </div>`;
    const late = daysBetween(t.date, todayStr());
    return `
      <div class="tcard ovd ${t.done ? 'done' : ''} ${open ? 'open' : ''}" data-id="${t.id}">
        <div class="t-accent" style="background:${accentOf(t)}"></div>
        <div class="t-main">
          <div class="t-title">${esc(t.title)}</div>
          <div class="t-meta-row">
            <span class="t-late">逾期 ${late} 天</span>
            <span class="t-meta2">${esc(cnMD(t.date))} · ${esc(srcText(t))}</span>
          </div>
          ${open ? `
            <div class="t-acts">
              <button class="t-act pri" data-act="toToday">排到今天</button>
              <button class="t-act" data-act="redate">改日期</button>
              <button class="t-act" data-act="edit">编辑</button>
            </div>` : ''}
        </div>
        <button class="t-ring" data-act="toggle">✓</button>
      </div>`;
  },

  refresh() {
    const today = todosOn(todayStr());
    const done = today.filter(t => t.done).length;
    const prog = $('#progWrap');
    if (today.length) {
      prog.classList.remove('hidden');
      $('#progFill').style.width = Math.round(done / today.length * 100) + '%';
      $('#progNum').textContent = done + '/' + today.length;
    } else prog.classList.add('hidden');

    $('#todayList').innerHTML = today.length
      ? today.map(t => this.card(t, false)).join('')
      : '<div class="t-empty">今天还没有安排 · 点下方「新建待办」</div>';

    const ovd = overdueTodos();
    const sec = $('#overdueSec');
    if (ovd.length) {
      sec.classList.remove('hidden');
      $('#overdueCount').textContent = ovd.length;
      $('#overdueList').innerHTML = ovd.map(t => this.card(t, true)).join('');
    } else sec.classList.add('hidden');
    updateDrawer();
    this.greet();
  }
};

function dotForTodos(ds) {
  const list = S.todos.filter(t => t.date === ds);
  if (!list.length) return null;
  return list.every(t => t.done) ? { fill: '#8FDDB4' } : { fill: 'rgba(255,255,255,0.55)' };
}

/* ═══════════ 全部待办 ═══════════ */
const AllTodos = {
  cal: null,
  init() {
    const now = new Date();
    this.cal = MonthCal($('#atCal'), {
      y: now.getFullYear(), m: now.getMonth(), sel: todayStr(), cellH: 38,
      dotFn: (ds, sel) => {
        const d = dotForTodos(ds);
        if (!d) return null;
        return sel ? { fill: d.fill === '#8FDDB4' ? '#8FDDB4' : 'rgba(60,64,60,0.4)' } : d;
      },
      onPick: () => this.renderList()
    });
    $('#atNew').addEventListener('click', () => Nav.push('todoEdit', { date: this.cal.sel || todayStr() }));
    $('#atList').addEventListener('click', e => {
      const ring = e.target.closest('[data-toggle]');
      if (ring) { toggleTodo(ring.dataset.toggle).then(() => this.refresh()); return; }
      const sch = e.target.closest('[data-sched]');
      if (sch) { Nav.push('todoEdit', { id: sch.dataset.sched, askDate: true }); return; }
      const row = e.target.closest('[data-todo]');
      if (row) Nav.push('todoEdit', { id: row.dataset.todo });
    });
    Nav.register('allTodos', {
      open: () => { this.cal.sel = todayStr(); this.renderList(); },
      refresh: () => this.refresh()
    });
  },
  refresh() { this.cal.render(); this.renderList(); },
  renderList() {
    const sel = this.cal.sel || todayStr();
    const list = todosOn(sel);
    const unsch = S.todos.filter(t => !t.date && !t.done).sort((a, b) => a.createdAt - b.createdAt);
    const rows = list.map(t => `
      <div class="at-row ${t.done ? 'done' : ''}" data-todo="${t.id}">
        <div class="t-accent" style="background:${t.done ? 'rgba(232,154,114,0.5)' : accentOf(t)}"></div>
        <div class="t-main">
          <div class="at-title">${esc(t.title)}</div>
          <div class="at-meta">${esc(t.time ? t.time + ' · ' + srcText(t) : srcText(t))}</div>
        </div>
        <button class="t-ring sm" data-toggle="${t.id}">✓</button>
      </div>`).join('');
    $('#atList').innerHTML = `
      <div class="at-day-head"><b>${cnMD(sel)}${sel === todayStr() ? ' · 今天' : ''}</b><span>${list.length ? list.length + ' 件待办' : '无待办'}</span></div>
      ${rows || '<div class="t-empty">这天还没有安排</div>'}
      <div class="at-unsch-head"><b>还没排期 · ${unsch.length}</b></div>
      ${unsch.map(t => `
        <div class="at-row dashed" data-todo="${t.id}">
          <div class="t-accent short" style="background:rgba(255,255,255,0.4)"></div>
          <div class="t-main">
            <div class="at-title thin">${esc(t.title)}</div>
            <div class="at-meta">${esc(srcText(t))}</div>
          </div>
          <button class="mini-btn" data-sched="${t.id}">排期</button>
        </div>`).join('') || '<div class="at-none">没有未排期的待办</div>'}`;
  }
};

/* ═══════════ 待办编辑页 ═══════════ */
const TodoEdit = {
  ed: null,
  init() {
    Nav.register('todoEdit', { open: p => this.open(p) });
    $('#teSave').addEventListener('click', () => this.saveNew());
    $('#teName').addEventListener('input', e => { autoGrow(e.target); this.autoSave(); });
    $('#teNote').addEventListener('input', () => this.autoSave());
    $('#teDateRow').addEventListener('click', () => {
      openDateSheet({
        date: this.ed.date, dotFn: dotForTodos,
        onPick: d => { this.ed.date = d; this.sync(); this.autoSave(); }
      });
    });
    $('#teTimeRow').addEventListener('click', () => {
      openTimeSheet({ time: this.ed.time, onPick: v => { this.ed.time = v; this.sync(); this.autoSave(); } });
    });
    $('#teSrcRow').addEventListener('click', () => {
      const s = this.ed.srcObj;
      if (!s || !s.type) return;
      if (s.type === 'topic') Nav.push('topicDetail', { id: s.id });
      if (s.type === 'book') Nav.push('bookDetail', { id: s.id });
    });
    $('#teDelete').addEventListener('click', () => {
      confirmBox('删除这条待办？', '删除后无法恢复。', '删除', async () => {
        await removeTodo(this.ed.id);
        Nav.back();
      });
    });
  },
  open(p) {
    const t = p.id ? todoById(p.id) : null;
    this.ed = {
      mode: t ? 'edit' : 'new',
      id: t ? t.id : null,
      date: t ? t.date : (p.date !== undefined ? p.date : todayStr()),
      time: t ? t.time : null,
      srcObj: t ? t.src : null
    };
    $('#teTitle').textContent = t ? '编辑待办' : '新建待办';
    $('#teCancel').textContent = t ? '‹ 返回' : '取消';
    $('#teSave').classList.toggle('hidden', !!t);
    $('#teName').value = t ? t.title : '';
    $('#teNote').value = t ? t.note : '';
    autoGrow($('#teName'));
    const srcRow = $('#teSrcRow');
    if (t && t.src) {
      srcRow.classList.remove('hidden');
      let label = t.src.label;
      if (t.src.type === 'topic') { const tp = S.topics.find(x => x.id === t.src.id); label = '选题库 · ' + (tp ? tp.title : ''); }
      if (t.src.type === 'book') { const bk = S.books.find(x => x.id === t.src.id); label = '读书 · ' + (bk ? bk.title : ''); }
      $('#teSrcVal').textContent = label + (t.src.type ? ' ›' : '');
    } else srcRow.classList.add('hidden');
    const fr = $('#teFocusRow');
    if (t && t.focusMin > 0) {
      fr.classList.remove('hidden');
      $('#teFocusVal').textContent = t.focusMin + ' 分钟 · ' + t.focusRounds + ' 轮';
    } else fr.classList.add('hidden');
    $('#teDelete').classList.toggle('hidden', !t);
    this.sync();
    if (!t) setTimeout(() => $('#teName').focus(), 300);
    if (p.askDate) setTimeout(() => $('#teDateRow').click(), 350);
  },
  sync() {
    $('#teDateVal').textContent = dateLabel(this.ed.date) + ' ›';
    $('#teDateVal').classList.toggle('dim3', !this.ed.date);
    $('#teTimeVal').textContent = (this.ed.time || '不设时间') + ' ›';
    $('#teTimeVal').classList.toggle('dim3', !this.ed.time);
  },
  autoSave: debounce(async function () {
    const self = TodoEdit;
    if (!self.ed || self.ed.mode !== 'edit') return;
    const t = todoById(self.ed.id);
    if (!t) return;
    const title = $('#teName').value.trim();
    if (title) t.title = title;
    t.note = $('#teNote').value.trim();
    t.date = self.ed.date;
    t.time = self.ed.time;
    await saveTodo(t);
  }, 400),
  async saveNew() {
    const title = $('#teName').value.trim();
    if (!title) { toast('先写点要做的事'); return; }
    await saveTodo({
      id: uid(), title, note: $('#teNote').value.trim(),
      date: this.ed.date, time: this.ed.time, src: null,
      done: false, doneAt: null, focusMin: 0, focusRounds: 0,
      createdAt: Date.now(), updatedAt: Date.now()
    });
    Nav.back();
  }
};

function autoGrow(ta) {
  ta.style.height = 'auto';
  ta.style.height = ta.scrollHeight + 'px';
}

/* ═══════════ 专注 ═══════════ */
const ROUND_SEC = 25 * 60;
const Focus = {
  st: null,   // {todoId, round, startTs, accum, running, lastSec}
  timer: null,

  init() {
    Nav.register('focusRun', { open: () => this.renderRun() });
    Nav.register('focusEnd', { open: () => this.renderEnd() });
    $('#frClose').addEventListener('click', () => Nav.back());
    $('#feClose').addEventListener('click', () => { this.clear(); Nav.back(); });
    $('#frPause').addEventListener('click', () => this.togglePause());
    $('#frEnd').addEventListener('click', () => this.finishRound());
    $('#feAgain').addEventListener('click', () => {
      const { todoId, round } = this.st;
      this.start(todoId, round + 1);
      Nav.replace('focusRun');
    });
    $('#feDone').addEventListener('click', () => { this.clear(); Nav.back(); });
    $('#feMark').addEventListener('click', async () => {
      const t = todoById(this.st.todoId);
      if (!t) return;
      if (!t.done) { await toggleTodo(t.id); }
      $('#feMark').classList.toggle('on', t.done);
    });
  },

  activeFor(id) { return this.st && this.st.phase === 'run' && this.st.todoId === id; },

  enter(id) {
    if (this.activeFor(id)) { Nav.push('focusRun'); return; }
    if (this.st && this.st.phase === 'run') { toast('先结束当前的专注'); return; }
    this.start(id, 1);
    Nav.push('focusRun');
  },

  start(todoId, round) {
    this.st = { phase: 'run', todoId, round, startTs: Date.now(), accum: 0, running: true };
    this.persist();
    this.startTimer();
  },

  elapsed() {
    if (!this.st) return 0;
    return this.st.accum + (this.st.running ? (Date.now() - this.st.startTs) / 1000 : 0);
  },

  startTimer() {
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), 500);
  },

  tick() {
    if (!this.st || this.st.phase !== 'run' || !this.st.running) return;
    const remain = ROUND_SEC - this.elapsed();
    if (remain <= 0) { this.finishRound(); return; }
    if (Nav.top().id === 'focusRun') this.updateRunUI(remain);
  },

  updateRunUI(remain) {
    $('#frTime').textContent = fmtClock(Math.max(0, remain));
    $('#frArc').style.strokeDashoffset = (678.6 * Math.min(1, this.elapsed() / ROUND_SEC)).toFixed(1);
  },

  renderRun() {
    const t = todoById(this.st.todoId);
    $('#frRound').textContent = '第 ' + this.st.round + ' 轮';
    $('#frTitle').textContent = t ? t.title : '';
    $('#frMeta').textContent = (t && t.src ? '来自 ' + t.src.label + ' · ' : '') + '今日累计 ' + this.dayMin() + ' 分';
    $('#frPause').textContent = this.st.running ? '暂停' : '继续';
    this.updateRunUI(ROUND_SEC - this.elapsed());
  },

  togglePause() {
    if (this.st.running) {
      this.st.accum += (Date.now() - this.st.startTs) / 1000;
      this.st.running = false;
    } else {
      this.st.startTs = Date.now();
      this.st.running = true;
    }
    $('#frPause').textContent = this.st.running ? '暂停' : '继续';
    this.persist();
  },

  async finishRound() {
    const sec = Math.min(ROUND_SEC, Math.round(this.elapsed()));
    clearInterval(this.timer);
    const t = todoById(this.st.todoId);
    const min = Math.max(1, Math.round(sec / 60));
    if (t) {
      t.focusMin = (t.focusMin || 0) + min;
      t.focusRounds = (t.focusRounds || 0) + 1;
      await saveTodo(t);
    }
    const day = (await DB.getMeta('focusDay')) || {};
    const key = todayStr();
    const total = (day.date === key ? day.min : 0) + min;
    await DB.setMeta('focusDay', { date: key, min: total });
    this.st = { phase: 'end', todoId: this.st.todoId, round: this.st.round, lastSec: sec, dayMin: total };
    this.persist();
    if (Nav.top().id === 'focusRun') Nav.replace('focusEnd');
    else Nav.push('focusEnd');
  },

  renderEnd() {
    const t = todoById(this.st.todoId);
    const today = todosOn(todayStr());
    const done = today.filter(x => x.done).length;
    $('#feRound').textContent = '第 ' + this.st.round + ' 轮';
    $('#feTime').textContent = fmtClock(this.st.lastSec);
    $('#feTitle').textContent = t ? t.title : '';
    $('#feTotal').textContent = this.st.dayMin + ' 分';
    $('#feProg').textContent = done + '/' + today.length;
    $('#feMark').classList.toggle('on', !!(t && t.done));
  },

  dayMin() { return this.st && this.st.dayMin || this._dayMin || 0; },

  persist() { DB.setMeta('focus', this.st ? { ...this.st, savedAt: Date.now() } : null); },
  clear() { this.st = null; clearInterval(this.timer); DB.setMeta('focus', null); },

  async restore() {
    const day = await DB.getMeta('focusDay');
    this._dayMin = day && day.date === todayStr() ? day.min : 0;
    const f = await DB.getMeta('focus');
    if (!f || !f.phase) return;
    if (f.phase === 'run') {
      this.st = f;
      if (f.running) {
        // 后台流逝的时间照常计入
        if (this.elapsed() >= ROUND_SEC) { await this.finishRound(); return; }
      }
      this.startTimer();
    }
  }
};
const fmtClock = sec => Math.floor(sec / 60) + ':' + pad(Math.floor(sec % 60));

/* ═══════════ 抽屉 ═══════════ */
function openDrawer() { updateDrawer(); $('#drawerWrap').classList.remove('hidden'); }
function closeDrawer() { $('#drawerWrap').classList.add('hidden'); }

function bindDrawer() {
  $('#btnNavClose').addEventListener('click', closeDrawer);
  $('#drawerMask').addEventListener('click', closeDrawer);
  $$('.dw-item').forEach(el => el.addEventListener('click', () => {
    const mod = el.dataset.mod;
    closeDrawer();
    const target = { todo: 'home', topics: 'topicsList', books: 'booksList', podcast: 'podList', sport: 'sportHome', meal: 'mealHome', settings: 'settings' }[mod];
    if (target === 'home') { Nav.home(); return; }
    if (Nav.top().id === target) return;
    Nav.home();
    Nav.push(target);
  }));
}

function updateDrawer() {
  const today = todosOn(todayStr());
  const unsch = S.todos.filter(t => !t.date && !t.done).length;
  const doneN = today.filter(t => t.done).length;
  $('#dwTodoSub').textContent = '今天 ' + today.length + ' 件' + (unsch ? ' · 未排期 ' + unsch : ' · 已完成 ' + doneN);
  const ideas = S.topics.filter(t => t.status === '想法').length;
  const doing = S.topics.filter(t => t.status === '进行中').length;
  $('#dwTopicsSub').textContent = S.topics.length ? '想法 ' + ideas + ' · 进行中 ' + doing : '还没有选题';
  const reading = S.books.filter(b => b.status === '在读').length;
  const yr = new Date().getFullYear();
  const doneY = S.books.filter(b => b.status === '读完' && b.finishedAt && new Date(b.finishedAt).getFullYear() === yr).length;
  $('#dwBooksSub').textContent = S.books.length ? '在读 ' + reading + ' · 今年读完 ' + doneY : '书架还是空的';
  const listening = S.episodes.filter(e => e.inList && e.state === '在听').length;
  const unheard = S.episodes.filter(e => e.inList && e.state === '未听').length;
  $('#dwPodSub').textContent = (listening + unheard) ? '在听 ' + listening + ' · 未听 ' + unheard + ' 集' : '清单还是空的';
  const ym = todayStr().slice(0, 7);
  const monthN = S.sports.filter(s => !s.planned && s.date.startsWith(ym)).length;
  const last = S.sports.filter(s => !s.planned && s.date <= todayStr()).sort((a, b) => b.date.localeCompare(a.date))[0];
  $('#dwSportSub').textContent = monthN ? '本月 ' + monthN + ' 次' + (last ? ' · ' + relDay(last.date) + last.type : '') : '本月还没动过';
  const mealsToday = S.meals.filter(m => m.date === todayStr()).length;
  $('#dwMealSub').textContent = mealsToday ? '今天已记 ' + mealsToday + ' 餐' : '今天还没记';
}
const relDay = d => d === todayStr() ? '今天' : d === addDays(todayStr(), -1) ? '昨天' : cnMD(d);

/* ═══════════ 设置 ═══════════ */
const Settings = {
  init() {
    Nav.register('settings', { open: () => this.render() });
    $('#setNameSave').addEventListener('click', async () => {
      const v = $('#setName').value.trim();
      if (!v) { toast('称呼不能为空'); return; }
      S.userName = v;
      await DB.setMeta('userName', v);
      toast('已保存');
    });
    $('#setExport').addEventListener('click', () => this.exportData());
    $('#setImport').addEventListener('click', () => this.importData());
  },
  async render() {
    $('#setName').value = S.userName;
    if (typeof Sync !== 'undefined') Sync.renderCard();
    const lastExp = await DB.getMeta('lastExport');
    let photoBytes = 0;
    for (const t of S.topics) for (const b of (t.shots || [])) photoBytes += b.size || 0;
    for (const m of S.meals) for (const b of (m.photos || [])) photoBytes += b.size || 0;
    const mb = photoBytes ? (photoBytes / 1048576).toFixed(photoBytes > 10485760 ? 0 : 1) + ' MB' : '0 MB';
    $('#setDataInfo').textContent = (lastExp ? '上次导出：' + cnMD(lastExp) : '还没导出过') + ' · 照片占用 ' + mb;
  },
  async exportData() {
    toast('正在打包…');
    const b2s = blob => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
    const packShots = async arr => Promise.all((arr || []).map(b2s));
    const topics = await Promise.all(S.topics.map(async t => ({ ...t, shots: await packShots(t.shots) })));
    const meals = await Promise.all(S.meals.map(async m => ({ ...m, photos: await packShots(m.photos) })));
    const data = {
      version: 1, exportedAt: new Date().toISOString(),
      userName: S.userName,
      todos: S.todos, topics, books: S.books, shows: S.shows, episodes: S.episodes, sports: S.sports, meals
    };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '工作台备份-' + todayStr() + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    await DB.setMeta('lastExport', todayStr());
    this.render();
  },
  importData() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'application/json,.json';
    inp.onchange = () => {
      const f = inp.files[0];
      if (!f) return;
      confirmBox('导入并覆盖？', '导入会用备份文件整体覆盖现有数据，无法撤销。', '覆盖导入', async () => {
        try {
          const data = JSON.parse(await f.text());
          if (!data || data.version !== 1) throw new Error('bad');
          const s2b = async s => (await fetch(s)).blob();
          const unpack = async arr => Promise.all((arr || []).map(s2b));
          for (const st of ['Todos', 'Topics', 'Books', 'Shows', 'Episodes', 'Sports', 'Meals']) await DB['clear' + st]();
          for (const t of data.todos || []) await DB.putTodos(t);
          for (const t of data.topics || []) await DB.putTopics({ ...t, shots: await unpack(t.shots) });
          for (const b of data.books || []) await DB.putBooks(b);
          for (const s of data.shows || []) await DB.putShows(s);
          for (const e of data.episodes || []) await DB.putEpisodes(e);
          for (const s of data.sports || []) await DB.putSports(s);
          for (const m of data.meals || []) await DB.putMeals({ ...m, photos: await unpack(m.photos) });
          await DB.setMeta('userName', data.userName || '杨错');
          await DB.setMeta('seeded', 1);
          toast('导入完成，正在刷新…');
          setTimeout(() => location.reload(), 800);
        } catch (e) { toast('导入失败：文件格式不对'); }
      });
    };
    inp.click();
  }
};

/* ═══════════ 天气 ═══════════ */
function wmoToCn(code) {
  if (code === 0 || code === 1) return '晴';
  if (code === 2) return '多云';
  if (code === 3 || code === 45 || code === 48) return '阴';
  if (code >= 95) return '雷雨';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return '雪';
  return '雨';
}
const COND_ICON = { '晴': 'w-sun', '多云': 'w-partly', '阴': 'w-cloud', '雨': 'w-rain', '雷雨': 'w-storm', '雪': 'w-snow' };

function renderWeather() {
  const w = S.weather;
  if (!w) return;
  $('#wLoading').classList.add('hidden');
  $('#wReady').classList.remove('hidden');
  $('#wIconBox').classList.remove('dim2');
  $('#wTemp').textContent = Math.round(w.temp);
  $('#wCond').textContent = '° ' + w.cond + ' · 体感 ' + Math.round(w.feel) + '°';
  let extra = '';
  if (w.uv >= 8) extra = ' · 紫外线极强';
  else if (w.uv >= 6) extra = ' · 午后紫外线强';
  else if (w.uv >= 3) extra = ' · 紫外线中等';
  $('#wRange').textContent = '最高 ' + Math.round(w.hi) + '° 最低 ' + Math.round(w.lo) + '°' + extra;
  $('#wCity').textContent = w.city || '';
  $$('#wIconBox svg').forEach(s => s.classList.add('hidden'));
  const ic = $('#' + (COND_ICON[w.cond] || 'w-sun'));
  if (ic) ic.classList.remove('hidden');
}

function geoPosition() {
  return new Promise(res => {
    if (!navigator.geolocation || !window.isSecureContext) return res(null);
    navigator.geolocation.getCurrentPosition(p => res(p), () => res(null), { timeout: 10000, maximumAge: 600000 });
  });
}
async function geocodeCity(name) {
  try {
    const j = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=zh&format=json`)).json();
    const r = j.results && j.results[0];
    if (r) return { lat: r.latitude, lon: r.longitude, city: r.name };
  } catch (e) { }
  return null;
}
async function getLocation() {
  const pos = await geoPosition();
  if (pos) {
    const { latitude: lat, longitude: lon } = pos.coords;
    let city = '';
    try {
      const gj = await (await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=zh`)).json();
      city = gj.city || gj.locality || '';
    } catch (e) { }
    return { lat, lon, city };
  }
  try {
    const txt = await (await fetch('https://myip.ipip.net/')).text();
    const m = txt.match(/来自于[：:]\s*([^\n]+)/);
    if (m) {
      const parts = m[1].trim().split(/\s+/).filter(s => !/电信|联通|移动|铁通|广电|教育网|鹏博士/.test(s));
      for (const name of parts.reverse()) {
        const g = await geocodeCity(name);
        if (g) return g;
      }
    }
  } catch (e) { }
  try {
    const j = await (await fetch('https://ipapi.co/json/')).json();
    if (j && j.latitude) return { lat: j.latitude, lon: j.longitude, city: j.city || '' };
  } catch (e) { }
  return null;
}
async function initWeather() {
  const cached = await DB.getMeta('weather');
  if (cached && Date.now() - cached.ts < 3 * 3600e3) {
    S.weather = cached;
    renderWeather();
    if (Date.now() - cached.ts < 30 * 60e3) return;
  }
  try {
    const loc = await getLocation();
    if (!loc) return;
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,apparent_temperature,weather_code&daily=temperature_2m_max,temperature_2m_min,uv_index_max&timezone=auto&forecast_days=1`);
    const j = await r.json();
    S.weather = {
      temp: j.current.temperature_2m, feel: j.current.apparent_temperature,
      cond: wmoToCn(j.current.weather_code),
      hi: j.daily.temperature_2m_max[0], lo: j.daily.temperature_2m_min[0],
      uv: j.daily.uv_index_max[0], city: loc.city, ts: Date.now()
    };
    await DB.setMeta('weather', S.weather);
    renderWeather();
  } catch (e) { }
}
