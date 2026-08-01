'use strict';
/* 饮食：月历（三餐记全=绿点）+ 三餐占位 + 记录/编辑一餐 */

const MEAL_SLOTS = ['早餐', '午餐', '晚餐', '加餐', '夜宵'];
const MAIN_SLOTS = ['早餐', '午餐', '晚餐'];

const Meal = {
  cal: null,
  f: null,

  init() {
    const now = new Date();
    this.cal = MonthCal($('#mhCal'), {
      y: now.getFullYear(), m: now.getMonth(), sel: todayStr(), cellH: 38, selStyle: 'dark',
      dotFn: ds => {
        const mains = new Set(S.meals.filter(m => m.date === ds && MAIN_SLOTS.includes(m.slot)).map(m => m.slot));
        if (mains.size >= 3) return { fill: '#8FDDB4' };
        if (mains.size > 0) return { fill: 'rgba(255,255,255,0.5)' };
        return null;
      },
      onPick: () => this.renderDay()
    });
    Nav.register('mealHome', { open: () => this.renderHome(), refresh: () => this.renderHome() });
    Nav.register('mealEdit', { open: p => this.openEdit(p) });

    $('#mhExtra').addEventListener('click', () => Nav.push('mealEdit', { slot: '加餐', date: this.cal.sel || todayStr() }));
    $('#mhList').addEventListener('click', e => {
      const empty = e.target.closest('[data-rec-slot]');
      if (empty) { Nav.push('mealEdit', { slot: empty.dataset.recSlot, date: this.cal.sel || todayStr() }); return; }
      const card = e.target.closest('[data-meal]');
      if (card) Nav.push('mealEdit', { id: card.dataset.meal });
    });

    $('#meAmount').addEventListener('click', e => {
      const b = e.target.closest('[data-a]');
      if (!b) return;
      this.f.amount = b.dataset.a;
      $$('#meAmount button').forEach(x => x.classList.toggle('on', x === b));
    });
    $('#meSlotRow').addEventListener('click', () => {
      openWheelSheet({
        title: '餐次', cols: [{ values: MEAL_SLOTS, idx: MEAL_SLOTS.indexOf(this.f.slot) }],
        allowClear: false,
        onOk: idxs => { this.f.slot = MEAL_SLOTS[idxs[0]]; this.sync(); }
      });
    });
    $('#meTimeRow').addEventListener('click', () => {
      openTimeSheet({ time: this.f.time, allowClear: false, onPick: v => { if (v) { this.f.time = v; this.sync(); } } });
    });
    $('#meDateRow').addEventListener('click', () => {
      openDateSheet({
        date: this.f.date, clearLabel: false,
        onPick: d => { if (!d) return; this.f.date = d; this.sync(); }
      });
    });
    $('#mePhotos').addEventListener('click', e => {
      if (e.target.closest('.shot-add')) {
        pickImages(9 - (this.f.photos || []).length, blobs => {
          this.f.photos = (this.f.photos || []).concat(blobs).slice(0, 9);
          this.renderPhotos();
        });
      }
    });
    attachLongPress($('#mePhotos'), '.shot', el => {
      const i = Number(el.dataset.i);
      confirmBox('删除这张照片？', '删除后无法恢复。', '删除', () => {
        this.f.photos.splice(i, 1);
        this.renderPhotos();
      });
    });
    $('#meSave').addEventListener('click', () => this.saveMeal());
    $('#meDelete').addEventListener('click', () => {
      confirmBox('删除这一餐？', '删除后无法恢复。', '删除', async () => {
        await DB.delMeals(this.f.id);
        S.meals = S.meals.filter(x => x.id !== this.f.id);
        Nav.back();
      });
    });
  },

  meal(id) { return S.meals.find(m => m.id === id); },
  async save(m) {
    m.updatedAt = Date.now();
    await DB.putMeals(m);
    const i = S.meals.findIndex(x => x.id === m.id);
    if (i >= 0) S.meals[i] = m; else S.meals.push(m);
  },

  autoSlot() {
    const h = new Date().getHours();
    return h < 12 ? '早餐' : h < 17 ? '午餐' : '晚餐';
  },

  renderHome() {
    this.cal.render();
    this.renderDay();
  },
  renderDay() {
    const sel = this.cal.sel || todayStr();
    const meals = S.meals.filter(m => m.date === sel).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    const n = meals.length;
    let html = `<div class="sh-day-head">${cnMD(sel)}${sel === todayStr() ? ' · 今天' : ''}${n ? '记了 ' + n + ' 餐' : ' · 还没记'}</div>`;
    for (const slot of MAIN_SLOTS) {
      const m = meals.find(x => x.slot === slot);
      if (m) html += this.mealCard(m);
      else html += `
        <div class="meal-empty">
          <span>${slot}还没记</span>
          <button class="mini-btn" data-rec-slot="${slot}">记录</button>
        </div>`;
    }
    for (const m of meals.filter(x => !MAIN_SLOTS.includes(x.slot))) html += this.mealCard(m);
    $('#mhList').innerHTML = html;
  },
  mealCard(m) {
    const ph = (m.photos || []);
    const thumb = ph.length ? `
      <div class="meal-thumb" style="background-image:url('${blobUrl(ph[0])}')">
        ${ph.length > 1 ? '<b>+' + (ph.length - 1) + '</b>' : ''}
      </div>` : '';
    return `
      <div class="meal-card" data-meal="${m.id}">
        ${thumb}
        <div class="meal-main">
          <div class="meal-slot">${m.slot}${m.time ? ' · ' + m.time : ''}</div>
          <div class="meal-text">${esc(m.text)}</div>
          <div class="meal-amount">饭量 ${m.amount}</div>
        </div>
      </div>`;
  },

  openEdit(p) {
    if (p.id) {
      const m = this.meal(p.id);
      this.f = { ...m, photos: (m.photos || []).slice() };
      $('#meBack').textContent = '‹ 返回';
      $('#meTitle').textContent = '编辑一餐';
      $('#meDelete').classList.remove('hidden');
    } else {
      const isToday = p.date === todayStr();
      this.f = {
        id: uid(), date: p.date || todayStr(),
        slot: p.slot === '加餐' ? '加餐' : (p.slot || this.autoSlot()),
        time: isToday || !p.date ? nowHM() : '12:00',
        text: '', amount: '正常', photos: [],
        createdAt: Date.now(), updatedAt: Date.now(), _new: true
      };
      $('#meBack').textContent = '取消';
      $('#meTitle').textContent = '记录 · ' + this.f.slot;
      $('#meDelete').classList.add('hidden');
    }
    $('#meText').value = this.f.text;
    $$('#meAmount button').forEach(x => x.classList.toggle('on', x.dataset.a === this.f.amount));
    this.sync();
    this.renderPhotos();
    if (this.f._new) setTimeout(() => $('#meText').focus(), 300);
  },
  sync() {
    $('#meTitle').textContent = (this.f._new ? '记录 · ' : '编辑 · ') + this.f.slot;
    $('#meSlotVal').textContent = this.f.slot + ' ›';
    $('#meTimeVal').textContent = this.f.time + ' ›';
    $('#meDateVal').textContent = dateLabel(this.f.date) + ' ›';
  },
  renderPhotos() {
    const ph = this.f.photos || [];
    $('#mePhotos').innerHTML = ph.map((b, i) =>
      `<div class="shot" data-i="${i}" style="background-image:url('${blobUrl(b)}')"></div>`).join('') +
      (ph.length < 9 ? '<button class="shot-add">+</button>' : '');
  },
  async saveMeal() {
    this.f.text = $('#meText').value.trim();
    if (!this.f.text) { toast('先写下吃了什么'); return; }
    delete this.f._new;
    await this.save(this.f);
    Nav.back();
  }
};
