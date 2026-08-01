'use strict';
/* 运动：月历三态 + 计时/球类/力量记录 + 计划 + 动作库 */

const SPORT_TYPES = {
  timed: ['跑步', '骑行', '游泳', '瑜伽', '快走', '跳绳'],
  ball: ['羽毛球', '篮球', '乒乓球', '网球'],
  strength: ['力量训练']
};
const DIST_TYPES = ['跑步', '骑行', '游泳'];
const PARTS = ['胸', '背', '腿', '肩', '臂', '核心'];
const SPORT_LIB = {
  '胸': [{ n: '卧推' }, { n: '上斜卧推' }, { n: '哑铃卧推' }, { n: '哑铃飞鸟' }, { n: '龙门夹胸' }, { n: '器械推胸' }, { n: '双杠臂屈伸', bw: 1 }, { n: '俯卧撑', bw: 1 }],
  '背': [{ n: '高位下拉' }, { n: '坐姿划船' }, { n: '杠铃划船' }, { n: '单臂哑铃划船' }, { n: '直臂下压' }, { n: '面拉' }, { n: '引体向上', bw: 1 }],
  '腿': [{ n: '深蹲' }, { n: '腿举' }, { n: '腿弯举' }, { n: '腿屈伸' }, { n: '保加利亚分腿蹲' }, { n: '硬拉' }, { n: '箭步蹲' }, { n: '提踵' }],
  '肩': [{ n: '肩推' }, { n: '哑铃侧平举' }, { n: '前平举' }, { n: '反向飞鸟' }, { n: '直立划船' }],
  '臂': [{ n: '杠铃弯举' }, { n: '哑铃弯举' }, { n: '锤式弯举' }, { n: '绳索下压' }, { n: '仰卧臂屈伸' }, { n: '窄距卧推' }],
  '核心': [{ n: '卷腹', bw: 1 }, { n: '平板支撑', bw: 1, secs: 1 }, { n: '悬垂举腿', bw: 1 }, { n: '俄罗斯转体', bw: 1 }, { n: '仰卧抬腿', bw: 1 }]
};

const Sport = {
  cal: null,
  f: null,          // 表单草稿
  part: '胸',
  libPending: null,

  init() {
    const now = new Date();
    this.cal = MonthCal($('#shCal'), {
      y: now.getFullYear(), m: now.getMonth(), sel: todayStr(), cellH: 38, selStyle: 'dark',
      dotFn: ds => {
        const recs = S.sports.filter(s => s.date === ds);
        if (recs.some(s => !s.planned)) return { fill: '#8FDDB4' };
        if (recs.some(s => s.planned)) {
          return ds >= todayStr() ? { fill: 'rgba(255,255,255,0.92)' } : { fill: 'rgba(230,225,215,0.42)' };
        }
        return null;
      },
      onPick: () => this.renderDay()
    });
    Nav.register('sportHome', { open: () => this.renderHome(), refresh: () => this.renderHome() });
    Nav.register('sportType', { open: p => this.openType(p) });
    Nav.register('sportTimed', { open: p => this.openTimed(p) });
    Nav.register('sportStrength', { open: p => this.openStrength(p), refresh: () => this.renderLifts() });
    Nav.register('sportLib', { open: p => this.openLib(p) });

    $('#shRecord').addEventListener('click', () => Nav.push('sportType', { mode: 'record' }));
    $('#shPlan').addEventListener('click', () => Nav.push('sportType', { mode: 'plan' }));
    $('#shList').addEventListener('click', async e => {
      const done = e.target.closest('[data-plan-done]');
      if (done) {
        const r = this.rec(done.dataset.planDone);
        r.planned = false;
        r.doneFromPlan = true;
        await this.save(r);
        this.renderHome();
        return;
      }
      const redate = e.target.closest('[data-plan-redate]');
      if (redate) {
        const r = this.rec(redate.dataset.planRedate);
        openDateSheet({
          date: todayStr(), clearLabel: false,
          onPick: async d => { if (!d) return; r.date = d; await this.save(r); this.renderHome(); }
        });
        return;
      }
      const card = e.target.closest('[data-sport]');
      if (card) {
        const r = this.rec(card.dataset.sport);
        Nav.push(r.kind === 'strength' ? 'sportStrength' : 'sportTimed', { id: r.id });
      }
    });

    $('#stGroups').addEventListener('click', e => {
      const b = e.target.closest('[data-type]');
      if (!b) return;
      const type = b.dataset.type, kind = b.dataset.kind;
      const date = this._typeMode === 'plan'
        ? (this.cal.sel > todayStr() ? this.cal.sel : addDays(todayStr(), 1))
        : (this.cal.sel <= todayStr() ? this.cal.sel : todayStr());
      Nav.replace(kind === 'strength' ? 'sportStrength' : 'sportTimed', { type, kind, date });
    });

    /* 计时类表单 */
    $('#sfDurRow').addEventListener('click', () => {
      const vals = Array.from({ length: 178 }, (_, i) => String(i + 3));
      openWheelSheet({
        title: '时长', cols: [{ values: vals.map(v => v + ' 分钟'), idx: this.f.duration - 3 }],
        quick: [20, 30, 45, 60].map(v => ({ label: String(v), idxs: [v - 3] })),
        last: this.lastTimedText(),
        allowClear: false,
        onOk: idxs => { this.f.duration = idxs[0] + 3; this.syncTimed(); }
      });
    });
    $('#sfDistRow').addEventListener('click', () => {
      const ints = Array.from({ length: 100 }, (_, i) => String(i));
      const decs = Array.from({ length: 10 }, (_, i) => '.' + i);
      const cur = this.f.distance || 5;
      openWheelSheet({
        title: '距离（公里）', cols: [
          { values: ints, idx: Math.floor(cur) },
          { values: decs, idx: Math.round((cur % 1) * 10) }
        ],
        onOk: idxs => { this.f.distance = idxs[0] + idxs[1] / 10; this.syncTimed(); },
        onClear: () => { this.f.distance = null; this.syncTimed(); }
      });
    });
    $('#sfDateRow').addEventListener('click', () => {
      openDateSheet({
        date: this.f.date, clearLabel: false,
        onPick: d => { if (!d) return; this.f.date = d; this.syncTimed(); }
      });
    });
    $('#sfFeel').addEventListener('click', e => {
      const b = e.target.closest('[data-f]');
      if (!b) return;
      this.f.feel = b.dataset.f;
      $$('#sfFeel button').forEach(x => x.classList.toggle('on', x === b));
    });
    $('#sfSave').addEventListener('click', () => this.saveTimed());
    $('#sfDelete').addEventListener('click', () => {
      confirmBox('删除这次记录？', '删除后无法恢复。', '删除', async () => {
        await DB.delSports(this.f.id);
        S.sports = S.sports.filter(x => x.id !== this.f.id);
        Nav.back();
      });
    });

    /* 力量表单 */
    $('#ssParts').addEventListener('click', e => {
      const b = e.target.closest('[data-part]');
      if (!b) return;
      this.part = b.dataset.part;
      this.renderParts();
      this.renderLifts();
    });
    $('#ssMeta').addEventListener('click', e => {
      if (e.target.closest('[data-ssm="date"]')) {
        openDateSheet({
          date: this.f.date, clearLabel: false,
          onPick: d => { if (!d) return; this.f.date = d; this.renderMeta(); }
        });
      }
      if (e.target.closest('[data-ssm="dur"]')) {
        const vals = Array.from({ length: 178 }, (_, i) => String(i + 3));
        openWheelSheet({
          title: '时长', cols: [{ values: vals.map(v => v + ' 分钟'), idx: (this.f.duration || 45) - 3 }],
          quick: [30, 45, 60, 90].map(v => ({ label: String(v), idxs: [v - 3] })),
          allowClear: false,
          onOk: idxs => { this.f.duration = idxs[0] + 3; this.renderMeta(); }
        });
      }
    });
    $('#ssLifts').addEventListener('click', e => {
      const x = e.target.closest('[data-del-lift]');
      if (x) {
        this.f.lifts.splice(Number(x.dataset.delLift), 1);
        this.renderLifts();
        return;
      }
      const num = e.target.closest('[data-lift-num]');
      if (num) this.openLiftWheel(Number(num.dataset.liftNum));
    });
    $('#ssAddLift').addEventListener('click', () => Nav.push('sportLib', {}));
    $('#ssSave').addEventListener('click', () => this.saveStrength());
    $('#ssDelete').addEventListener('click', () => {
      confirmBox('删除这次训练？', '删除后无法恢复。', '删除', async () => {
        await DB.delSports(this.f.id);
        S.sports = S.sports.filter(x => x.id !== this.f.id);
        Nav.back();
      });
    });

    /* 动作库 */
    $('#slList').addEventListener('click', e => {
      const row = e.target.closest('[data-lib]');
      if (!row) return;
      const name = row.dataset.lib;
      if (this.libPending.has(name)) this.libPending.delete(name);
      else this.libPending.add(name);
      this.renderLib();
    });
    $('#slDone').addEventListener('click', () => {
      const metaOf = n => SPORT_LIB[this.part].find(m => m.n === n) || {};
      for (const name of this.libPending) {
        if (this.f.lifts.some(l => l.name === name && l.part === this.part)) continue;
        const m = metaOf(name);
        const last = this.lastLift(name);
        this.f.lifts.push({
          part: this.part, name, bw: !!m.bw, secs: !!m.secs,
          weight: m.bw ? null : (last ? last.weight : 20),
          reps: m.secs ? null : (last ? last.reps : 10),
          seconds: m.secs ? (last && last.seconds ? last.seconds : 60) : null,
          sets: last ? last.sets : 3
        });
      }
      // 取消勾选的移除（仅本部位、未有数值改动的判断从简：直接按勾选集同步）
      this.f.lifts = this.f.lifts.filter(l => l.part !== this.part || this.libPending.has(l.name));
      Nav.back();
    });
  },

  rec(id) { return S.sports.find(x => x.id === id); },
  async save(r) {
    r.updatedAt = Date.now();
    await DB.putSports(r);
    const i = S.sports.findIndex(x => x.id === r.id);
    if (i >= 0) S.sports[i] = r; else S.sports.push(r);
  },

  /* ── 首页 ── */
  renderHome() {
    const ym = todayStr().slice(0, 7);
    const n = S.sports.filter(s => !s.planned && s.date.startsWith(ym)).length;
    $('#shMonthCount').textContent = n ? '本月 ' + n + ' 次' : '';
    this.cal.render();
    this.renderDay();
  },
  sportTitle(r) {
    if (r.kind === 'strength') return '力量训练';
    if (r.distance) return r.type + ' ' + r.distance.toFixed(1).replace(/\.0$/, '') + ' 公里';
    return r.type;
  },
  sportSub(r) {
    if (r.kind === 'strength') {
      const parts = [...new Set((r.lifts || []).map(l => l.part))];
      return [parts.join(' + ') || '还没记动作', r.duration ? r.duration + ' 分钟' : ''].filter(Boolean).join(' · ');
    }
    return [r.duration + ' 分钟', r.feel ? '感受 ' + r.feel : ''].filter(Boolean).join(' · ');
  },
  dayCards(ds) {
    const list = S.sports.filter(s => s.date === ds).sort((a, b) => a.createdAt - b.createdAt);
    return list.map(r => {
      if (r.planned && ds >= todayStr()) {
        const canDone = ds === todayStr();
        return `
          <div class="sh-card plan" data-sport="${r.id}">
            <div class="sh-row1">
              <div style="min-width:0">
                <div class="sh-title">${esc(r.type)} · 计划中</div>
                <div class="sh-sub">${esc(this.sportSub(r)).replace('感受 正常', '预计 ' + r.duration + ' 分钟') || '预计 ' + r.duration + ' 分钟'}</div>
              </div>
              ${canDone ? `<button class="sh-done-btn" data-plan-done="${r.id}">完成</button>` : '<span class="sh-arrow">›</span>'}
            </div>
          </div>`;
      }
      if (r.planned) {
        return `
          <div class="sh-card expired" data-sport="${r.id}">
            <div class="sh-title" style="font-size:15.5px">${esc(r.type)} · 已过期</div>
            <div class="sh-row1" style="margin-top:5px">
              <span class="sh-sub" style="margin:0">那天没做，留在原地</span>
              <button class="mini-btn" data-plan-redate="${r.id}">改期</button>
            </div>
          </div>`;
      }
      return `
        <div class="sh-card" data-sport="${r.id}">
          <div class="sh-row1">
            <div style="min-width:0">
              <div class="sh-title">${esc(this.sportTitle(r))} ${r.doneFromPlan ? '<small>· 按计划完成</small>' : ''}</div>
              <div class="sh-sub">${esc(this.sportSub(r))}</div>
            </div>
            <span class="sh-arrow">›</span>
          </div>
        </div>`;
    }).join('');
  },
  renderDay() {
    const sel = this.cal.sel || todayStr();
    let html = `<div class="sh-day-head">${cnMD(sel)}${sel === todayStr() ? ' · 今天' : ''}</div>`;
    html += this.dayCards(sel) || '<div class="t-empty">这天没练也没安排</div>';
    // 已过期的计划：留在原日期，单独列出
    const expired = S.sports.filter(s => s.planned && s.date < todayStr() && s.date !== sel)
      .sort((a, b) => b.date.localeCompare(a.date));
    const byDate = {};
    for (const r of expired) (byDate[r.date] = byDate[r.date] || []).push(r);
    for (const d of Object.keys(byDate)) {
      html += `<div class="sh-day-head" style="color:rgba(255,255,255,0.7)">${cnMD(d)}</div>` + this.dayCards(d);
    }
    $('#shList').innerHTML = html;
  },

  /* ── 类型选择 ── */
  openType(p) {
    this._typeMode = p.mode;
    $('#stTitle').textContent = p.mode === 'plan' ? '安排一次' : '记一次';
    $('#stGroups').innerHTML = `
      <div class="st-label">计时类</div>
      <div class="st-grid">${SPORT_TYPES.timed.map(t => `<button data-type="${t}" data-kind="timed">${t}</button>`).join('')}</div>
      <div class="st-label">球类</div>
      <div class="st-grid">${SPORT_TYPES.ball.map(t => `<button data-type="${t}" data-kind="ball">${t}</button>`).join('')}</div>
      <div class="st-label">力量</div>
      <div class="st-grid"><button data-type="力量训练" data-kind="strength">力量训练</button></div>`;
  },

  /* ── 计时/球类表单 ── */
  lastTimedText() {
    const prev = S.sports.filter(s => !s.planned && s.kind !== 'strength' && s.type === this.f.type && s.id !== this.f.id)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    return prev ? '上次 ' + prev.duration + ' 分钟' + (prev.distance ? ' · ' + prev.distance.toFixed(1) + ' 公里' : '') : '';
  },
  openTimed(p) {
    if (p.id) {
      const r = this.rec(p.id);
      this.f = { ...r };
    } else {
      this.f = {
        id: uid(), kind: p.kind, type: p.type, date: p.date,
        planned: false, doneFromPlan: false,
        duration: 30, distance: null, feel: '正常', lifts: [],
        createdAt: Date.now(), updatedAt: Date.now(), _new: true
      };
    }
    $('#sfBack').textContent = '‹ ' + this.f.type;
    $('#sfDistRow').classList.toggle('hidden', !DIST_TYPES.includes(this.f.type));
    $$('#sfFeel button').forEach(x => x.classList.toggle('on', x.dataset.f === (this.f.feel || '正常')));
    const srcRow = $('#sfSrcRow');
    if (this.f.doneFromPlan) {
      srcRow.classList.remove('hidden');
      $('#sfSrcVal').textContent = '按计划完成 · ' + cnMD(this.f.date) + '的计划';
    } else srcRow.classList.add('hidden');
    $('#sfDelete').classList.toggle('hidden', !!this.f._new);
    this.syncTimed();
  },
  syncTimed() {
    $('#sfDurVal').textContent = this.f.duration + ' 分钟 ›';
    const dv = $('#sfDistVal');
    dv.textContent = (this.f.distance != null ? this.f.distance.toFixed(1).replace(/\.0$/, '') + ' 公里' : '不记') + ' ›';
    dv.classList.toggle('dim3', this.f.distance == null);
    $('#sfDateVal').textContent = dateLabel(this.f.date) + ' ›';
  },
  async saveTimed() {
    this.f.planned = this.f.date > todayStr();
    delete this.f._new;
    await this.save(this.f);
    Nav.back();
  },

  /* ── 力量表单 ── */
  openStrength(p) {
    if (p.id) {
      const r = this.rec(p.id);
      this.f = { ...r, lifts: (r.lifts || []).map(l => ({ ...l })) };
      $('#ssBack').textContent = '‹ 返回';
    } else {
      this.f = {
        id: uid(), kind: 'strength', type: '力量训练', date: p.date,
        planned: false, doneFromPlan: false,
        duration: 45, distance: null, feel: null, lifts: [],
        createdAt: Date.now(), updatedAt: Date.now(), _new: true
      };
      $('#ssBack').textContent = '取消';
    }
    this.part = this.f.lifts.length ? this.f.lifts[0].part : '胸';
    $('#ssDelete').classList.toggle('hidden', !!this.f._new);
    this.renderMeta();
    this.renderParts();
    this.renderLifts();
  },
  renderMeta() {
    $('#ssMeta').innerHTML = `
      <span class="ss-meta-btn"><button data-ssm="date" style="color:inherit">${cnMD(this.f.date)}</button> · <button data-ssm="dur" style="color:inherit">${this.f.duration || 45} 分钟</button></span>
      ${this.f.doneFromPlan ? '<span class="green-note">按计划完成</span>' : ''}`;
  },
  renderParts() {
    $('#ssParts').innerHTML = PARTS.map(pt => {
      const n = this.f.lifts.filter(l => l.part === pt).length;
      return `<button data-part="${pt}" class="${pt === this.part ? 'on' : ''}">${pt}${n ? ' ' + n : ''}</button>`;
    }).join('');
  },
  lastLift(name) {
    const prev = S.sports.filter(s => s.kind === 'strength' && !s.planned && s.id !== (this.f && this.f.id))
      .sort((a, b) => b.date.localeCompare(a.date));
    for (const r of prev) {
      const l = (r.lifts || []).find(x => x.name === name);
      if (l) return l;
    }
    return null;
  },
  liftLastText(name) {
    const l = this.lastLift(name);
    if (!l) return '';
    if (l.secs) return '上次 ' + l.seconds + ' 秒 × ' + l.sets;
    return '上次 ' + (l.bw ? '自重' : l.weight + ' kg') + ' × ' + l.reps;
  },
  renderLifts() {
    const lifts = this.f.lifts.map((l, i) => ({ l, i })).filter(x => x.l.part === this.part);
    $('#ssPartInfo').textContent = this.part + ' · 本次已记 ' + lifts.length + ' 个动作';
    $('#ssLifts').innerHTML = lifts.map(({ l, i }) => {
      const w = l.secs ? l.seconds + ' 秒' : (l.bw ? '自重' : l.weight + ' kg');
      const r = l.secs ? '—' : l.reps + ' 次';
      return `
        <div class="lift-card">
          <div class="lift-head">
            <span class="lift-name">${esc(l.name)}</span>
            <span class="lift-last">${this.liftLastText(l.name)}</span>
            <button class="lift-x" data-del-lift="${i}">✕</button>
          </div>
          <div class="lift-nums" data-lift-num="${i}">
            <button class="lift-num">${w}</button><em>×</em>
            <button class="lift-num">${r}</button><em>×</em>
            <button class="lift-num">${l.sets} 组</button>
          </div>
        </div>`;
    }).join('') || '<div class="at-none">还没记动作 · 从动作库添加</div>';
    this.renderParts();
  },
  openLiftWheel(i) {
    const l = this.f.lifts[i];
    const sets = Array.from({ length: 50 }, (_, k) => String(k + 1));
    let cols, apply;
    if (l.secs) {
      const secVals = Array.from({ length: 59 }, (_, k) => String((k + 1) * 5));
      cols = [
        { label: '秒数', values: secVals, idx: Math.max(0, Math.round((l.seconds || 60) / 5) - 1) },
        { label: '组数', values: sets, idx: (l.sets || 3) - 1 }
      ];
      apply = idxs => { l.seconds = (idxs[0] + 1) * 5; l.sets = idxs[1] + 1; };
    } else if (l.bw) {
      const reps = Array.from({ length: 50 }, (_, k) => String(k + 1));
      cols = [
        { label: '次数', values: reps, idx: (l.reps || 10) - 1 },
        { label: '组数', values: sets, idx: (l.sets || 3) - 1 }
      ];
      apply = idxs => { l.reps = idxs[0] + 1; l.sets = idxs[1] + 1; };
    } else {
      const kg = Array.from({ length: 200 }, (_, k) => String(k + 1));
      const reps = Array.from({ length: 50 }, (_, k) => String(k + 1));
      cols = [
        { label: '重量 kg', values: kg, idx: (l.weight || 20) - 1 },
        { label: '次数', values: reps, idx: (l.reps || 10) - 1 },
        { label: '组数', values: sets, idx: (l.sets || 3) - 1 }
      ];
      apply = idxs => { l.weight = idxs[0] + 1; l.reps = idxs[1] + 1; l.sets = idxs[2] + 1; };
    }
    openWheelSheet({
      title: l.name, cols,
      last: this.liftLastText(l.name),
      onOk: idxs => { apply(idxs); this.renderLifts(); },
      onClear: () => { this.f.lifts.splice(i, 1); this.renderLifts(); }
    });
  },
  async saveStrength() {
    if (!this.f.lifts.length) { toast('至少记一个动作'); return; }
    this.f.planned = this.f.date > todayStr();
    delete this.f._new;
    await this.save(this.f);
    Nav.back();
  },

  /* ── 动作库 ── */
  openLib() {
    this.libPending = new Set(this.f.lifts.filter(l => l.part === this.part).map(l => l.name));
    $('#slTitle').textContent = '动作库 · ' + this.part;
    $('#slCount').textContent = this.part + ' · 共 ' + SPORT_LIB[this.part].length + ' 个动作';
    this.renderLib();
  },
  renderLib() {
    $('#slDone').textContent = '完成 ' + this.libPending.size;
    $('#slList').innerHTML = SPORT_LIB[this.part].map(m => {
      const on = this.libPending.has(m.n);
      const last = this.liftLastText(m.n);
      const note = last || (m.bw ? '自重' : '');
      return `
        <button class="lib-row ${on ? 'on' : ''}" data-lib="${esc(m.n)}">
          <i class="stage-check">✓</i>
          <span class="lib-name">${esc(m.n)}</span>
          <span class="lib-note">${esc(on && !last ? '已加入' : note)}</span>
        </button>`;
    }).join('');
  }
};
