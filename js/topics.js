'use strict';
/* 选题库：列表 + 详情（详情=编辑=新建）+ 阶段待办 */

const STAGES = ['写脚本', '拍摄', '剪辑', '发布'];
const TP_STATES = ['全部', '想法', '进行中', '已发布'];

const Topics = {
  filter: '全部',
  cur: null,          // 当前详情 {mode:'edit'|'new', id, draft}
  stageUI: null,      // 阶段区块状态 {checked:Set, scheme, pickDate}
  stageCal: null,

  init() {
    Nav.register('topicsList', { open: () => this.renderList(), refresh: () => this.renderList() });
    Nav.register('topicDetail', { open: p => this.openDetail(p), refresh: () => this.renderStageBlock(), close: () => this.onClose() });

    $('#tpSeg').addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      this.filter = b.dataset.f;
      this.renderList();
    });
    $('#tpList').addEventListener('click', e => {
      const card = e.target.closest('[data-topic]');
      if (card) Nav.push('topicDetail', { id: card.dataset.topic });
    });
    $('#tpNew').addEventListener('click', () => Nav.push('topicDetail', {}));

    $('#tdTitle').addEventListener('input', e => { autoGrow(e.target); this.syncStageBtn(); this.autoSave(); });
    $('#tdNotes').addEventListener('input', () => this.autoSave());
    $('#tdPublish').addEventListener('click', async () => {
      const t = this.topic();
      if (!t) return;
      t.status = '已发布';
      t.publishedAt = Date.now();
      await this.save(t);
      this.renderStatus();
    });
    $('#tdLinks').addEventListener('click', async e => {
      const x = e.target.closest('[data-delink]');
      if (x) {
        const t = this.topic();
        t.links.splice(Number(x.dataset.delink), 1);
        await this.save(t);
        this.renderLinks();
        return;
      }
      if (e.target.closest('#tdPaste')) this.pasteLink();
    });
    $('#tdShots').addEventListener('click', e => {
      if (e.target.closest('.shot-add')) {
        pickImages(9, async blobs => {
          const t = this.topic();
          t.shots = (t.shots || []).concat(blobs).slice(0, 9);
          await this.save(t);
          this.renderShots();
        });
      }
    });
    attachLongPress($('#tdShots'), '.shot', el => {
      const i = Number(el.dataset.i);
      confirmBox('删除这张截图？', '删除后无法恢复。', '删除', async () => {
        const t = this.topic();
        t.shots.splice(i, 1);
        await this.save(t);
        this.renderShots();
      });
    });
    $('#tdDelete').addEventListener('click', () => {
      confirmBox('删除这个选题？', '关联生成的待办会一并删除，无法恢复。', '删除', async () => {
        const t = this.topic();
        for (const td of this.stageTodos(t.id)) await removeTodo(td.id);
        await DB.delTopics(t.id);
        S.topics = S.topics.filter(x => x.id !== t.id);
        Nav.back();
      });
    });
    $('#tdStageBlock').addEventListener('click', e => this.onStageClick(e));
  },

  topic() { return this.cur ? S.topics.find(t => t.id === this.cur.id) : null; },
  stageTodos(id) { return S.todos.filter(t => t.src && t.src.type === 'topic' && t.src.id === id); },
  stageTodo(id, stage) { return this.stageTodos(id).find(t => t.src.stage === stage); },

  async save(t) {
    t.updatedAt = Date.now();
    await DB.putTopics(t);
    const i = S.topics.findIndex(x => x.id === t.id);
    if (i >= 0) S.topics[i] = t; else S.topics.push(t);
  },

  /* ── 列表 ── */
  renderList() {
    const counts = { '全部': S.topics.length };
    for (const st of ['想法', '进行中', '已发布']) counts[st] = S.topics.filter(t => t.status === st).length;
    $('#tpSeg').innerHTML = TP_STATES.map(s =>
      `<button data-f="${s}" class="${this.filter === s ? 'on' : ''}">${s} ${counts[s]}</button>`).join('');
    const list = (this.filter === '全部' ? S.topics : S.topics.filter(t => t.status === this.filter))
      .slice().sort((a, b) => b.updatedAt - a.updatedAt);
    const chipCls = { '想法': 'c1', '进行中': 'c2', '已发布': 'c3' };
    $('#tpList').innerHTML = list.map(t => {
      const lines = (t.notes || '').split('\n').filter(s => s.trim()).length;
      const parts = [];
      if (lines) parts.push(lines + ' 条要点');
      if ((t.links || []).length) parts.push(t.links.length + ' 个链接');
      if ((t.shots || []).length) parts.push(t.shots.length + ' 张截图');
      const tds = this.stageTodos(t.id);
      const done = tds.filter(x => x.done).length;
      const prog = tds.length ? `
        <div class="tp-prog"><i><b style="width:${Math.round(done / tds.length * 100)}%"></b></i><span>待办 ${done}/${tds.length}</span></div>` : '';
      return `
        <div class="tp-card" data-topic="${t.id}">
          <div class="tp-top">
            <div style="flex:1;min-width:0">
              <div class="tp-title">${esc(t.title)}</div>
              <div class="tp-meta">${parts.join(' · ') || '还没有内容'}</div>
            </div>
            <span class="state-chip ${chipCls[t.status]}">${t.status}</span>
          </div>
          ${prog}
        </div>`;
    }).join('') || '<div class="t-empty">还没有选题 · 点下方「新建选题」</div>';
  },

  /* ── 详情 ── */
  async openDetail(p) {
    if (!p.id) {
      // 新建即落库空白选题（详情=编辑=新建，返回时若完全为空则自动清掉）
      const t = { id: uid(), title: '', status: '想法', notes: '', links: [], shots: [], createdAt: Date.now(), updatedAt: Date.now() };
      await this.save(t);
      this.cur = { mode: 'new', id: t.id };
    } else {
      this.cur = { mode: 'edit', id: p.id };
    }
    this.stageUI = null;
    const t = this.topic();
    $('#tdTitle').value = t.title;
    $('#tdNotes').value = t.notes || '';
    autoGrow($('#tdTitle'));
    this.renderStatus();
    this.renderLinks();
    this.renderShots();
    this.renderStageBlock();
    if (this.cur.mode === 'new') setTimeout(() => $('#tdTitle').focus(), 300);
  },

  async onClose() {
    const t = this.topic();
    if (t && !t.title.trim() && !(t.notes || '').trim() && !(t.links || []).length && !(t.shots || []).length && !this.stageTodos(t.id).length) {
      await DB.delTopics(t.id);
      S.topics = S.topics.filter(x => x.id !== t.id);
    }
    this.cur = null;
  },

  autoSave: debounce(async function () {
    const self = Topics;
    const t = self.topic();
    if (!t) return;
    const hadTitle = !!t.title;
    t.title = $('#tdTitle').value.trim();
    t.notes = $('#tdNotes').value;
    await self.save(t);
    $('#tdHint').textContent = '已自动保存';
    // 标题从无到有（或反之）时，「添加待办」按钮的可用态要跟着变
    if (hadTitle !== !!t.title && !self.stageTodos(t.id).length) self.renderStageBlock();
  }, 500),

  renderStatus() {
    const t = this.topic();
    const dot = { '想法': 'rgba(255,255,255,0.6)', '进行中': '#E89A72', '已发布': '#8FDDB4' };
    $('#tdDot').style.background = dot[t.status];
    $('#tdState').textContent = t.status;
    $('#tdStateHint').textContent = t.status === '想法' ? '默认状态' : t.status === '进行中' ? '生成待办后自动' : '';
    $('#tdPublish').classList.toggle('hidden', t.status === '已发布');
  },

  renderLinks() {
    const t = this.topic();
    $('#tdLinks').innerHTML = (t.links || []).map((l, i) => `
      <div class="link-row">
        <span class="link-main">
          <span class="link-title">${esc(l.title)}</span>
          <span class="link-dom" style="display:block">${esc(l.domain)}</span>
        </span>
        <button class="link-x" data-delink="${i}">✕</button>
      </div>`).join('') + `
      <button class="link-paste" id="tdPaste"><i>⎘</i><span>粘贴板一键贴入</span></button>`;
  },

  async pasteLink() {
    let url = '';
    try { url = (await navigator.clipboard.readText()).trim(); } catch (e) { }
    if (!/^https?:\/\//.test(url)) {
      url = prompt('粘贴板读不到链接，手动贴一下：') || '';
      url = url.trim();
      if (!/^https?:\/\//.test(url)) { if (url) toast('这不是一个链接'); return; }
    }
    let domain = '', title = url;
    try {
      const u = new URL(url);
      domain = u.hostname.replace(/^www\./, '');
      title = decodeURIComponent((u.pathname.split('/').filter(Boolean).pop() || domain)).replace(/[-_]/g, ' ').slice(0, 60) || domain;
    } catch (e) { }
    const t = this.topic();
    t.links = (t.links || []).concat({ url, domain, title });
    await this.save(t);
    this.renderLinks();
  },

  renderShots() {
    const t = this.topic();
    $('#tdShots').innerHTML = (t.shots || []).map((b, i) =>
      `<div class="shot" data-i="${i}" style="background-image:url('${blobUrl(b)}')"></div>`).join('') +
      ((t.shots || []).length < 9 ? '<button class="shot-add">+</button>' : '');
  },

  /* ── 阶段待办区块 ── */
  renderStageBlock() {
    const t = this.topic();
    if (!t) return;
    const tds = this.stageTodos(t.id);
    const added = tds.length > 0;
    if (!this.stageUI) {
      this.stageUI = {
        checked: new Set(added ? tds.map(x => x.src.stage) : ['写脚本', '拍摄', '剪辑']),
        scheme: 'seq', pickDate: null
      };
    }
    const ui = this.stageUI;
    const doneN = tds.filter(x => x.done).length;

    const rows = STAGES.map(st => {
      const td = this.stageTodo(t.id, st);
      const checked = td ? true : ui.checked.has(st);
      let hint = '', hintCls = '', locked = false, dateTxt = '—', dateCls = 'dim';
      if (td && td.done) { locked = true; hint = '不可取消'; dateTxt = (td.date ? cnMD(td.date) : '') + ' · 已完成'; }
      else if (td) { hint = '取消即删除'; hintCls = 'warn'; dateTxt = td.date ? cnMD(td.date) : '未排期'; }
      else if (added) { hint = '勾选即添加'; if (checked) dateTxt = this.previewDate(st); }
      else if (checked) dateTxt = this.previewDate(st);
      return `
        <button class="stage-row ${checked ? 'on' : ''} ${locked ? 'locked' : ''}" data-stage="${st}" ${locked ? 'disabled' : ''}>
          <i class="stage-check">✓</i>
          <span class="stage-label">${st}</span>
          <span class="stage-date">${dateTxt}</span>
          ${added ? `<span class="stage-hint ${hintCls}">${hint}</span>` : ''}
        </button>`;
    }).join('');

    const schemes = `
      <div class="scheme-chips" id="tdSchemes">
        ${SCHEMES.map(s => `<button data-scheme="${s.key}" class="${s.key === 'seq' ? 'w2' : s.key === 'pick' ? 'w3' : ''} ${ui.scheme === s.key ? 'on' : ''}">${s.label}</button>`).join('')}
      </div>`;
    const calBox = ui.scheme === 'pick' ? '<div class="mcal mini" id="tdPickCal"></div>' : '';

    const newChecked = STAGES.filter(st => !this.stageTodo(t.id, st) && ui.checked.has(st));
    let btn;
    if (!added) {
      const n = newChecked.length;
      // 实时取输入框里的标题（自动保存有延迟，不能只看已存的）
      const liveTitle = ($('#tdTitle').value || '').trim();
      const dim = !liveTitle || n === 0;
      btn = `<button class="btn-glass ${dim ? 'dim' : ''}" id="tdStageGo">添加 ${n} 条待办</button>`;
    } else {
      btn = `<button class="btn-glass" id="tdStageGo">保存修改</button>`;
    }

    $('#tdStageBlock').innerHTML = `
      <div class="stage-head">
        <b>${added ? '修改待办' : '添加待办'}</b>
        ${added ? `<span>已添加 ${tds.length} 条 · 完成 ${doneN}</span>` : ''}
      </div>
      ${added ? `<div class="stage-prog"><i style="width:${tds.length ? Math.round(doneN / tds.length * 100) : 0}%"></i></div>` : ''}
      <div class="stage-rows">${rows}</div>
      ${schemes}${calBox}${btn}`;

    if (ui.scheme === 'pick') {
      const init = ui.pickDate || todayStr();
      const d = parseD(init);
      this.stageCal = MonthCal($('#tdPickCal'), {
        y: d.getFullYear(), m: d.getMonth(), sel: ui.pickDate, cellH: 32,
        onPick: ds => { ui.pickDate = ds; this.renderStageBlock(); }
      });
      this.stageCal.render();
    }
  },

  // 输入标题时实时更新「添加 N 条待办」按钮的可用态
  syncStageBtn() {
    const btn = $('#tdStageGo');
    const t = this.topic();
    if (!btn || !t || this.stageTodos(t.id).length || !this.stageUI) return;
    const live = ($('#tdTitle').value || '').trim();
    const n = STAGES.filter(st => this.stageUI.checked.has(st)).length;
    btn.classList.toggle('dim', !live || !n);
  },

  previewDate(stage) {
    const ui = this.stageUI;
    const t = this.topic();
    const pendingNew = STAGES.filter(st => !this.stageTodo(t.id, st) && ui.checked.has(st));
    const idx = pendingNew.indexOf(stage);
    if (idx < 0) return '—';
    return cnMD(schemeDate(ui.scheme, ui.pickDate, idx));
  },

  async onStageClick(e) {
    const t = this.topic();
    const ui = this.stageUI;
    const row = e.target.closest('[data-stage]');
    if (row && !row.disabled) {
      const st = row.dataset.stage;
      const td = this.stageTodo(t.id, st);
      if (td && !td.done) {
        // 已添加未完成：取消勾选＝删除这条待办
        confirmBox('取消「' + st + '」？', '会删除这条已生成的待办。', '取消并删除', async () => {
          await removeTodo(td.id);
          ui.checked.delete(st);
          await this.refreshStatus();
          this.renderStageBlock();
        });
        return;
      }
      if (ui.checked.has(st)) ui.checked.delete(st); else ui.checked.add(st);
      this.renderStageBlock();
      return;
    }
    const sch = e.target.closest('[data-scheme]');
    if (sch) {
      ui.scheme = sch.dataset.scheme;
      if (ui.scheme === 'pick' && !ui.pickDate) ui.pickDate = todayStr();
      this.renderStageBlock();
      return;
    }
    if (e.target.closest('#tdStageGo')) {
      // 立刻落盘当前输入，消除自动保存的延迟竞态
      t.title = ($('#tdTitle').value || '').trim();
      t.notes = $('#tdNotes').value;
      if (!t.title) { toast('先给选题起个标题'); return; }
      await this.save(t);
      const pendingNew = STAGES.filter(st => !this.stageTodo(t.id, st) && ui.checked.has(st));
      if (!this.stageTodos(t.id).length && !pendingNew.length) { toast('先勾选要添加的阶段'); return; }
      let n = 0;
      for (const st of pendingNew) {
        const date = schemeDate(ui.scheme, ui.pickDate, n);
        await saveTodo({
          id: uid(), title: st + '：' + t.title, note: '',
          date, time: null,
          src: { type: 'topic', id: t.id, label: '选题库', stage: st },
          done: false, doneAt: null, focusMin: 0, focusRounds: 0,
          createdAt: Date.now(), updatedAt: Date.now()
        });
        n++;
      }
      if (n && t.status === '想法') { t.status = '进行中'; await this.save(t); this.renderStatus(); }
      toast(n ? '已添加 ' + n + ' 条待办' : '已保存');
      this.renderStageBlock();
    }
  },

  async refreshStatus() {
    const t = this.topic();
    if (!t) return;
    if (t.status === '进行中' && !this.stageTodos(t.id).length) {
      t.status = '想法';
      await this.save(t);
      this.renderStatus();
    }
  },

  /* 待办勾完成时回调（app.js 的 toggleTodo 调）：最后的「发布」勾完 → 自动已发布 */
  async onStageDone(td) {
    if (!td.src || td.src.type !== 'topic') return;
    const t = S.topics.find(x => x.id === td.src.id);
    if (!t || t.status === '已发布') return;
    if (td.src.stage === '发布') {
      const prev = t.status;
      t.status = '已发布';
      t.publishedAt = Date.now();
      await this.save(t);
      this.undoToast('「' + t.title + '」已自动转为已发布', async () => {
        t.status = prev;
        t.publishedAt = null;
        await this.save(t);
      });
    }
  },

  undoToast(msg, cb) {
    const el = $('#toast');
    el.innerHTML = esc(msg) + ' <b style="margin-left:8px;color:#8FDDB4;font-weight:600">撤销</b>';
    el.classList.remove('hidden');
    const h = () => { cb(); el.classList.add('hidden'); el.removeEventListener('click', h); };
    el.addEventListener('click', h);
    setTimeout(() => { el.classList.add('hidden'); el.removeEventListener('click', h); }, 5000);
  }
};
