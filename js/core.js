'use strict';
/* 共享核心：工具、路由、月历、弹层、确认框、图片 */

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const dstr = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parseD = s => { const [a, b, c] = s.split('-').map(Number); return new Date(a, b - 1, c); };
const todayStr = () => dstr(new Date());
const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return dstr(d); };
const cnMD = s => { const d = parseD(s); return (d.getMonth() + 1) + '月' + d.getDate() + '日'; };
const WD = ['日', '一', '二', '三', '四', '五', '六'];
const daysBetween = (a, b) => Math.round((parseD(b) - parseD(a)) / 86400000);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2));
const nowHM = () => { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const fmtDur = sec => {
  const m = Math.round(sec / 60);
  return m >= 60 ? Math.floor(m / 60) + ' 小时 ' + pad(m % 60) + ' 分' : m + ' 分';
};
const fmtTs = sec => {
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s);
};
const nextMonday = () => { const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); return dstr(d); };
const dateLabel = s => !s ? '不设日期' : (s === todayStr() ? '今天 ' + cnMD(s) : (s === addDays(todayStr(), 1) ? '明天 ' + cnMD(s) : cnMD(s)));

/* ── toast ── */
let _toastTimer = null;
function toast(msg, ms) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.add('hidden'), ms || 2200);
}

/* ── 路由：栈式屏幕管理 ── */
const Nav = (() => {
  const stack = [{ id: 'home' }];
  const ctrl = {};   // id -> {open(params), refresh(), close()}
  function register(id, c) { ctrl[id] = c; }
  function top() { return stack[stack.length - 1]; }
  function show(id) { $$('.screen').forEach(el => el.classList.toggle('hidden', el.id !== id)); }
  function push(id, params) {
    stack.push({ id, params });
    show(id);   // 先显示再渲染：内容渲染里常有依赖布局的测量（如输入框自适应高度）
    if (ctrl[id] && ctrl[id].open) ctrl[id].open(params || {});
  }
  function replace(id, params) {
    stack.pop();
    push(id, params);
  }
  function back(refreshParams) {
    if (stack.length <= 1) return;
    const leaving = stack.pop();
    if (ctrl[leaving.id] && ctrl[leaving.id].close) ctrl[leaving.id].close();
    const t = top();
    if (ctrl[t.id] && ctrl[t.id].refresh) ctrl[t.id].refresh(refreshParams);
    show(t.id);
  }
  function home() {
    while (stack.length > 1) stack.pop();
    if (ctrl.home && ctrl.home.refresh) ctrl.home.refresh();
    show('home');
  }
  function refreshTop() {
    const t = top();
    if (ctrl[t.id] && ctrl[t.id].refresh) ctrl[t.id].refresh();
  }
  return { register, push, replace, back, home, top, refreshTop };
})();

/* ── 月历组件 ──
   opts: {y, m, sel, cellH, dotFn(dateStr)->{fill,ring}|null, selStyle:'light'|'dark',
          onPick(dateStr), onMonthChange()} */
function MonthCal(el, opts) {
  const st = { y: opts.y, m: opts.m, sel: opts.sel || null };
  const cellH = opts.cellH || 38;

  function render() {
    const { y, m } = st;
    const first = new Date(y, m, 1);
    const startOffset = (first.getDay() + 6) % 7;
    const dim = new Date(y, m + 1, 0).getDate();
    const prevDim = new Date(y, m, 0).getDate();
    const t = todayStr();
    const cells = [];
    for (let i = 0; i < startOffset; i++) {
      const d = prevDim - startOffset + 1 + i;
      cells.push({ d, date: dstr(new Date(y, m - 1, d)), out: true });
    }
    for (let d = 1; d <= dim; d++) cells.push({ d, date: dstr(new Date(y, m, d)) });
    let nx = 1;
    while (cells.length % 7) { cells.push({ d: nx, date: dstr(new Date(y, m + 1, nx)), out: true }); nx++; }

    let grid = '';
    for (let i = 0; i < cells.length; i += 7) {
      grid += '<div class="cal-grid-week">' + cells.slice(i, i + 7).map(c => {
        const sel = c.date === st.sel, isToday = c.date === t;
        const dot = opts.dotFn ? opts.dotFn(c.date, sel) : null;
        const dotHtml = dot
          ? `<i style="background:${dot.fill || 'transparent'};border:1px solid ${dot.ring || 'transparent'}"></i>`
          : '<i style="background:transparent;border:1px solid transparent"></i>';
        const cls = ['cal-cell'];
        if (c.out) cls.push('out');
        if (sel) cls.push(opts.selStyle === 'dark' ? 'seld' : 'sel');
        else if (isToday) cls.push('today');
        return `<div class="${cls.join(' ')}" data-date="${c.date}" style="height:${cellH}px"><b>${c.d}</b><span class="cal-dots">${dotHtml}</span></div>`;
      }).join('') + '</div>';
    }
    el.innerHTML = `
      <div class="cal-month-row">
        <span class="cal-month">${st.m + 1}月 ${st.y}</span>
        <span class="cal-nav"><button data-cal="prev">‹</button><button data-cal="next">›</button></span>
      </div>
      <div class="cal-week-row">${['一', '二', '三', '四', '五', '六', '日'].map(w => `<span>${w}</span>`).join('')}</div>
      ${grid}`;
  }

  el.addEventListener('click', e => {
    const nav = e.target.closest('[data-cal]');
    if (nav) {
      st.m += nav.dataset.cal === 'next' ? 1 : -1;
      if (st.m < 0) { st.m = 11; st.y--; }
      if (st.m > 11) { st.m = 0; st.y++; }
      render();
      if (opts.onMonthChange) opts.onMonthChange();
      return;
    }
    const cell = e.target.closest('.cal-cell[data-date]');
    if (cell) {
      st.sel = cell.dataset.date;
      const d = parseD(st.sel);
      if (d.getMonth() !== st.m || d.getFullYear() !== st.y) { st.y = d.getFullYear(); st.m = d.getMonth(); }
      render();
      if (opts.onPick) opts.onPick(st.sel);
    }
  });

  return {
    render,
    get sel() { return st.sel; },
    set sel(v) { st.sel = v; if (v) { const d = parseD(v); st.y = d.getFullYear(); st.m = d.getMonth(); } render(); },
    goto(y, m) { st.y = y; st.m = m; render(); }
  };
}

/* ── 滚轮列 ── */
const WHEEL_H = 46;
function makeWheel(ul, values) {
  ul.innerHTML = values.map(v => `<li>${esc(v)}</li>`).join('');
  ul._vals = values;
  if (!ul._bound) {
    ul._bound = true;
    let raf = null;
    ul.addEventListener('scroll', () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = null; styleWheel(ul); });
    });
  }
  styleWheel(ul);
}
function styleWheel(ul) {
  const idx = Math.round(ul.scrollTop / WHEEL_H);
  [...ul.children].forEach((li, i) => {
    li.className = i === idx ? 'mid' : Math.abs(i - idx) === 1 ? 'near' : '';
  });
}
function setWheelIdx(ul, idx) {
  idx = Math.max(0, Math.min(idx, (ul._vals || []).length - 1));
  ul.scrollTop = idx * WHEEL_H;
  styleWheel(ul);
}
function wheelIdx(ul) {
  return Math.max(0, Math.min(Math.round(ul.scrollTop / WHEEL_H), (ul._vals || []).length - 1));
}

/* ── 日期弹层（月网格 + 点 + 不设日期/确定）── */
let _dsCal = null, _dsCb = null, _dsAllowClear = true;
function openDateSheet(o) {
  // o: {date, dotFn, clearLabel|false, onPick(dateStr|null)}
  _dsCb = o.onPick;
  _dsAllowClear = o.clearLabel !== false;
  $('#dsClear').style.visibility = _dsAllowClear ? 'visible' : 'hidden';
  $('#dsClear').textContent = typeof o.clearLabel === 'string' ? o.clearLabel : '不设日期';
  const init = o.date || todayStr();
  const d = parseD(init);
  if (!_dsCal) {
    _dsCal = MonthCal($('#dsCal'), { y: d.getFullYear(), m: d.getMonth(), sel: o.date || null, cellH: 38, dotFn: ds => (_dsDotFn ? _dsDotFn(ds) : null) });
  }
  _dsDotFn = o.dotFn || null;
  _dsCal.sel = o.date || null;
  if (!o.date) _dsCal.goto(d.getFullYear(), d.getMonth());
  $('#dateSheetWrap').classList.remove('hidden');
}
let _dsDotFn = null;
function closeDateSheet() { $('#dateSheetWrap').classList.add('hidden'); _dsCb = null; }

/* ── 时间弹层 ── */
let _tsCb = null;
function openTimeSheet(o) {
  // o: {time, allowClear, onPick(t|null)}
  _tsCb = o.onPick;
  $('#tsClear').style.visibility = o.allowClear === false ? 'hidden' : 'visible';
  const ulH = $('#tsH'), ulM = $('#tsM');
  if (!ulH._vals) {
    makeWheel(ulH, Array.from({ length: 24 }, (_, i) => pad(i)));
    makeWheel(ulM, Array.from({ length: 12 }, (_, i) => pad(i * 5)));
  }
  $('#timeSheetWrap').classList.remove('hidden');
  const [h, m] = (o.time || '09:00').split(':').map(Number);
  requestAnimationFrame(() => {
    setWheelIdx(ulH, h);
    setWheelIdx(ulM, Math.round(m / 5));
  });
}
function closeTimeSheet() { $('#timeSheetWrap').classList.add('hidden'); _tsCb = null; }

/* ── 通用滚轮弹层 ── */
let _wsCb = null, _wsClearCb = null, _wsCols = [];
function openWheelSheet(o) {
  // o: {title, cols:[{label, values:[], idx}], quick:[{label, idxs:[..]}], last, allowClear, onOk(idxs), onClear}
  _wsCb = o.onOk; _wsClearCb = o.onClear; _wsCols = o.cols;
  $('#wsTitle').textContent = o.title || '';
  $('#wsClear').style.visibility = o.allowClear === false ? 'hidden' : 'visible';
  const q = $('#wsQuick');
  if (o.quick && o.quick.length) {
    q.classList.remove('hidden');
    q.innerHTML = o.quick.map((c, i) => `<button data-q="${i}">${esc(c.label)}</button>`).join('');
    q._quick = o.quick;
  } else { q.classList.add('hidden'); }
  const lab = $('#wsLabels');
  if (o.cols.some(c => c.label)) {
    lab.classList.remove('hidden');
    lab.innerHTML = o.cols.map(c => `<span>${esc(c.label || '')}</span>`).join('');
  } else lab.classList.add('hidden');
  const box = $('#wsBox');
  box.innerHTML = '<div class="wheel-hl2"></div>' + o.cols.map((c, i) =>
    (i > 0 ? '<div class="wheel-div"></div>' : '') + `<ul class="wheel2" data-col="${i}"></ul>`).join('');
  const last = $('#wsLast');
  if (o.last) { last.classList.remove('hidden'); last.textContent = o.last; } else last.classList.add('hidden');
  $('#wheelSheetWrap').classList.remove('hidden');
  requestAnimationFrame(() => {
    o.cols.forEach((c, i) => {
      const ul = box.querySelector(`ul[data-col="${i}"]`);
      makeWheel(ul, c.values);
      setWheelIdx(ul, c.idx || 0);
    });
  });
}
function closeWheelSheet() { $('#wheelSheetWrap').classList.add('hidden'); _wsCb = null; _wsClearCb = null; }
function wsSetIdxs(idxs) {
  const box = $('#wsBox');
  idxs.forEach((idx, i) => {
    const ul = box.querySelector(`ul[data-col="${i}"]`);
    if (ul && idx != null) setWheelIdx(ul, idx);
  });
}

/* ── 确认弹窗 ── */
let _cfCb = null;
function confirmBox(title, text, okLabel, cb) {
  $('#cfTitle').textContent = title;
  $('#cfText').textContent = text;
  $('#cfOk').textContent = okLabel || '确定';
  _cfCb = cb;
  $('#confirmWrap').classList.remove('hidden');
}

/* ── 长按 ── */
function attachLongPress(container, selector, fn) {
  let timer = null, target = null;
  const clear = () => { clearTimeout(timer); timer = null; target = null; };
  container.addEventListener('touchstart', e => {
    const el = e.target.closest(selector);
    if (!el) return;
    target = el;
    timer = setTimeout(() => { fn(target); clear(); }, 550);
  }, { passive: true });
  container.addEventListener('touchmove', clear, { passive: true });
  container.addEventListener('touchend', clear);
  container.addEventListener('contextmenu', e => {
    const el = e.target.closest(selector);
    if (el) { e.preventDefault(); fn(el); }
  });
}

/* ── 图片：选取 + 压缩为 Blob ── */
let _fpCb = null;
function pickImages(max, cb) {
  _fpCb = { max, cb };
  const inp = $('#filePick');
  inp.value = '';
  inp.click();
}
async function shrinkImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i); i.onerror = rej; i.src = url;
    });
    const MAX = 1280;
    let { width: w, height: h } = img;
    if (Math.max(w, h) > MAX) { const k = MAX / Math.max(w, h); w = Math.round(w * k); h = Math.round(h * k); }
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    cv.getContext('2d').drawImage(img, 0, 0, w, h);
    return await new Promise(res => cv.toBlob(res, 'image/jpeg', 0.8));
  } finally { URL.revokeObjectURL(url); }
}
const _blobUrls = new Map();
function blobUrl(blob) {
  if (!_blobUrls.has(blob)) _blobUrls.set(blob, URL.createObjectURL(blob));
  return _blobUrls.get(blob);
}

/* ── JSONP（iTunes API 无 CORS 头）── */
function jsonp(url, timeout) {
  return new Promise((res, rej) => {
    const cb = 'jp' + Math.random().toString(36).slice(2);
    const s = document.createElement('script');
    const to = setTimeout(() => { cleanup(); rej(new Error('timeout')); }, timeout || 10000);
    function cleanup() { clearTimeout(to); delete window[cb]; s.remove(); }
    window[cb] = data => { cleanup(); res(data); };
    s.onerror = () => { cleanup(); rej(new Error('jsonp error')); };
    s.src = url + (url.includes('?') ? '&' : '?') + 'callback=' + cb;
    document.head.appendChild(s);
  });
}

/* ── 日期方案（选题库 / 读书共用）──
   schemes: today / monday / seq / pick */
const SCHEMES = [
  { key: 'today', label: '今天' },
  { key: 'monday', label: '下周一' },
  { key: 'seq', label: '依次每天' },
  { key: 'pick', label: '指定某天' }
];
function schemeDate(scheme, pickDate, seqIndex) {
  const base = scheme === 'today' ? todayStr()
    : scheme === 'monday' ? nextMonday()
    : scheme === 'pick' ? (pickDate || todayStr())
    : todayStr();
  return scheme === 'seq' ? addDays(todayStr(), seqIndex) : base;
}

/* ── 弹层通用事件绑定（Boot 时调用一次）── */
function bindCoreSheets() {
  document.addEventListener('click', e => {
    const c = e.target.closest('[data-sheet-close]');
    if (!c) return;
    const k = c.dataset.sheetClose;
    if (k === 'date') closeDateSheet();
    if (k === 'time') closeTimeSheet();
    if (k === 'wheel') closeWheelSheet();
    if (k === 'read') $('#readSheetWrap').classList.add('hidden');
  });
  $('#dsClear').addEventListener('click', () => { const cb = _dsCb; closeDateSheet(); cb && cb(null); });
  $('#dsOk').addEventListener('click', () => {
    const v = _dsCal ? _dsCal.sel : null;
    const cb = _dsCb; closeDateSheet();
    cb && cb(v);
  });
  $('#tsClear').addEventListener('click', () => { const cb = _tsCb; closeTimeSheet(); cb && cb(null); });
  $('#tsOk').addEventListener('click', () => {
    const v = $('#tsH')._vals[wheelIdx($('#tsH'))] + ':' + $('#tsM')._vals[wheelIdx($('#tsM'))];
    const cb = _tsCb; closeTimeSheet();
    cb && cb(v);
  });
  $('#tsQuick').addEventListener('click', e => {
    const chip = e.target.closest('[data-t]');
    if (!chip) return;
    const [h, m] = chip.dataset.t.split(':').map(Number);
    setWheelIdx($('#tsH'), h);
    setWheelIdx($('#tsM'), Math.round(m / 5));
  });
  $('#wsClear').addEventListener('click', () => { const cb = _wsClearCb; closeWheelSheet(); cb && cb(); });
  $('#wsOk').addEventListener('click', () => {
    const box = $('#wsBox');
    const idxs = _wsCols.map((c, i) => wheelIdx(box.querySelector(`ul[data-col="${i}"]`)));
    const cb = _wsCb; closeWheelSheet();
    cb && cb(idxs);
  });
  $('#wsQuick').addEventListener('click', e => {
    const chip = e.target.closest('[data-q]');
    if (!chip) return;
    const q = $('#wsQuick')._quick[Number(chip.dataset.q)];
    wsSetIdxs(q.idxs);
  });
  $('#cfCancel').addEventListener('click', () => { $('#confirmWrap').classList.add('hidden'); _cfCb = null; });
  $('#cfOk').addEventListener('click', () => { const cb = _cfCb; $('#confirmWrap').classList.add('hidden'); _cfCb = null; cb && cb(); });
  $('#filePick').addEventListener('change', async e => {
    if (!_fpCb) return;
    const { max, cb } = _fpCb; _fpCb = null;
    const files = [...e.target.files].slice(0, max);
    const blobs = [];
    for (const f of files) {
      try { blobs.push(await shrinkImage(f)); } catch (err) { /* 跳过坏图 */ }
    }
    if (blobs.length) cb(blobs);
  });
  // 返回按钮统一处理
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-back]');
    if (b) Nav.back();
  });
  // 抽屉开关统一处理
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-nav="drawer"]');
    if (b) openDrawer();
  });
}
