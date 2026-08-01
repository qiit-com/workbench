'use strict';
/* 读书：书架 + 搜索（Google Books / OpenLibrary 双源）+ 书详情 + 添加待办浮层 */

const BK_STATES = ['全部', '想读', '在读', '读完'];

const Books = {
  filter: '全部',
  curId: null,
  dirty: false,
  searchSeq: 0,
  readUI: { dur: 30, scheme: 'today', pickDate: null },
  readCal: null,

  init() {
    Nav.register('booksList', { open: () => this.renderList(), refresh: () => this.renderList() });
    Nav.register('bookSearch', { open: () => this.openSearch() });
    Nav.register('bookDetail', { open: p => this.openDetail(p), refresh: () => this.renderDetail() });

    $('#bkSearchBtn').addEventListener('click', () => Nav.push('bookSearch'));
    $('#bkSeg').addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      this.filter = b.dataset.f;
      this.renderList();
    });
    $('#bkList').addEventListener('click', e => {
      const card = e.target.closest('[data-book]');
      if (card) Nav.push('bookDetail', { id: card.dataset.book });
    });

    const doSearch = debounce(() => this.search(), 800);
    $('#bsInput').addEventListener('input', () => {
      $('#bsClear').classList.toggle('hidden', !$('#bsInput').value);
      this.searchSeq++;          // 输入变化即作废上一次请求
      $('#bsProg').classList.add('hidden');
      doSearch();
    });
    $('#bsClear').addEventListener('click', () => { $('#bsInput').value = ''; $('#bsList').innerHTML = ''; $('#bsClear').classList.add('hidden'); });
    $('#bsList').addEventListener('click', async e => {
      const b = e.target.closest('[data-add]');
      if (!b || b.classList.contains('added')) return;
      const r = this._results[Number(b.dataset.add)];
      const book = { ...r, status: '想读', rating: null, summary: '', addedAt: Date.now(), finishedAt: null, updatedAt: Date.now() };
      await this.save(book);
      b.classList.add('added');
      b.textContent = '已在书架';
      toast('已加入想读');
    });

    $('#bdStates').addEventListener('click', async e => {
      const b = e.target.closest('[data-st]');
      if (!b) return;
      const book = this.book();
      book.status = b.dataset.st;
      if (b.dataset.st === '读完' && !book.finishedAt) book.finishedAt = Date.now();
      await this.save(book);
      this.renderDetail();
    });
    $('#bdStars').addEventListener('click', e => {
      const star = e.target.closest('.star');
      if (!star) return;
      const n = Number(star.dataset.n);
      const rect = star.getBoundingClientRect();
      const half = (e.clientX - rect.left) < rect.width / 2;
      let v = half ? n - 0.5 : n;
      if (this._rating === v) v = null;   // 点同一档＝清空
      this._rating = v;
      this.markDirty();
      this.renderStars();
    });
    $('#bdSummary').addEventListener('input', () => this.markDirty());
    $('#bdSaveRate').addEventListener('click', async () => {
      const book = this.book();
      book.rating = this._rating;
      book.summary = $('#bdSummary').value.trim();
      await this.save(book);
      this.dirty = false;
      $('#bdSaveRate').classList.add('hidden');
      toast('已保存');
    });
    $('#bdAddTodo').addEventListener('click', () => this.openReadSheet());
    $('#bdRemove').addEventListener('click', () => {
      confirmBox('从书架移除？', '这本书和它生成的待办都会删除，无法恢复。', '移除', async () => {
        const book = this.book();
        for (const td of S.todos.filter(t => t.src && t.src.type === 'book' && t.src.id === book.id)) await removeTodo(td.id);
        await DB.delBooks(book.id);
        S.books = S.books.filter(x => x.id !== book.id);
        Nav.back();
      });
    });

    $('#rsDur').addEventListener('click', e => {
      const b = e.target.closest('[data-d]');
      if (!b) return;
      this.readUI.dur = Number(b.dataset.d);
      $$('#rsDur button').forEach(x => x.classList.toggle('on', x === b));
    });
    $('#rsScheme').addEventListener('click', e => {
      const b = e.target.closest('[data-scheme]');
      if (!b) return;
      this.readUI.scheme = b.dataset.scheme;
      if (this.readUI.scheme === 'pick' && !this.readUI.pickDate) this.readUI.pickDate = todayStr();
      this.renderReadSheet();
    });
    $('#rsAdd').addEventListener('click', () => this.addReadTodos());
  },

  book() { return S.books.find(b => b.id === this.curId); },
  async save(b) {
    b.updatedAt = Date.now();
    await DB.putBooks(b);
    const i = S.books.findIndex(x => x.id === b.id);
    if (i >= 0) S.books[i] = b; else S.books.push(b);
  },

  /* ── 书架 ── */
  renderList() {
    const counts = { '全部': S.books.length };
    for (const st of ['想读', '在读', '读完']) counts[st] = S.books.filter(b => b.status === st).length;
    $('#bkSeg').innerHTML = BK_STATES.map(s =>
      `<button data-f="${s}" class="${this.filter === s ? 'on' : ''}">${s} ${counts[s]}</button>`).join('');
    const chipCls = { '想读': 'c1', '在读': 'c2', '读完': 'c3' };
    const list = (this.filter === '全部' ? S.books : S.books.filter(b => b.status === this.filter))
      .slice().sort((a, b) => b.updatedAt - a.updatedAt);
    $('#bkList').innerHTML = list.map(b => {
      let extra = '';
      if (b.status === '想读') { const d = daysBetween(dstr(new Date(b.addedAt)), todayStr()); extra = d <= 0 ? '今天加入' : '加入 ' + d + ' 天前'; }
      if (b.status === '在读') extra = b.pages ? b.pages + ' 页' : '在读中';
      if (b.status === '读完') extra = b.rating ? '我的评分 ' + b.rating : '未评分';
      return `
        <div class="bk-card" data-book="${b.id}">
          <div class="bk-cover" ${b.cover ? `style="background-image:url('${esc(b.cover)}')"` : ''}></div>
          <div class="bk-main">
            <div class="bk-title">${esc(b.title)}</div>
            <div class="bk-author">${esc(b.author)}</div>
            <div class="bk-tags">
              <span class="state-chip ${chipCls[b.status]}">${b.status}</span>
              <span class="bk-extra">${esc(extra)}</span>
            </div>
          </div>
        </div>`;
    }).join('') || '<div class="t-empty">书架还是空的 · 搜书名加书</div>';
  },

  /* ── 搜索 ── */
  openSearch() {
    $('#bsInput').value = '';
    $('#bsList').innerHTML = '';
    $('#bsClear').classList.add('hidden');
    setTimeout(() => $('#bsInput').focus(), 300);
  },

  _results: [],
  async search() {
    const q = $('#bsInput').value.trim();
    if (!q) { $('#bsList').innerHTML = ''; return; }
    const seq = ++this.searchSeq;
    $('#bsProg').classList.remove('hidden');
    const results = [];
    // 书目数据源：iTunes 电子书（JSONP 纯前端可调，中文覆盖好，自带封面）
    try {
      const j = await jsonp(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=ebook&country=US&limit=25`);
      for (const r of j.results || []) {
        if (!r.trackName) continue;
        results.push({
          id: 'itb:' + r.trackId, title: r.trackName, author: r.artistName || '',
          publisher: '', year: (r.releaseDate || '').slice(0, 4), pages: null,
          cover: (r.artworkUrl100 || '').replace('100x100', '300x300')
        });
      }
    } catch (e) { }
    if (seq !== this.searchSeq) return;   // 已作废
    $('#bsProg').classList.add('hidden');
    // 去重 + 有标题的排前
    const seen = new Set();
    this._results = results.filter(r => {
      if (!r.title) return false;
      const k = r.title + '|' + r.author;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).sort((a, b) => (a.cover ? 0 : 1) - (b.cover ? 0 : 1)).slice(0, 20);
    $('#bsList').innerHTML = '<div class="sec-label">搜索结果</div>' + (this._results.map((r, i) => {
      const inShelf = S.books.some(b => b.id === r.id);
      const pub = [r.publisher, r.year, r.pages ? r.pages + ' 页' : ''].filter(Boolean).join(' · ');
      return `
        <div class="bk-card" style="cursor:default">
          <div class="bk-cover sm" ${r.cover ? `style="background-image:url('${esc(r.cover)}')"` : ''}></div>
          <div class="bk-main">
            <div class="bk-title" style="font-size:15px">${esc(r.title)}</div>
            <div class="bk-author">${esc(r.author)}</div>
            <div class="bk-pub">${esc(pub)}</div>
          </div>
          <button class="bk-btn ${inShelf ? 'added' : ''}" data-add="${i}">${inShelf ? '已在书架' : '想读'}</button>
        </div>`;
    }).join('') || '<div class="t-empty">没搜到 · 换个书名试试</div>');
  },

  /* ── 书详情 ── */
  openDetail(p) {
    this.curId = p.id;
    const b = this.book();
    this._rating = b.rating;
    this.dirty = false;
    $('#bdSummary').value = b.summary || '';
    this.renderDetail();
  },
  renderDetail() {
    const b = this.book();
    if (!b) return;
    $('#bdCover').style.backgroundImage = b.cover ? `url('${b.cover}')` : '';
    $('#bdTitle').textContent = b.title;
    $('#bdAuthor').textContent = b.author;
    $('#bdPub').textContent = [b.publisher, b.year, b.pages ? b.pages + ' 页' : ''].filter(Boolean).join(' · ');
    $$('#bdStates button').forEach(x => x.classList.toggle('on', x.dataset.st === b.status));
    $('#bdDoneArea').classList.toggle('hidden', b.status !== '读完');
    $('#bdSaveRate').classList.toggle('hidden', !this.dirty);
    this.renderStars();
  },
  markDirty() {
    this.dirty = true;
    $('#bdSaveRate').classList.remove('hidden');
  },
  renderStars() {
    const v = this._rating || 0;
    $('#bdStars').innerHTML = [1, 2, 3, 4, 5].map(n => {
      const full = v >= n, half = !full && v >= n - 0.5;
      return `<button class="star ${full ? 'full' : ''} ${half ? 'half-on' : ''}" data-n="${n}">★<span class="half">★</span></button>`;
    }).join('');
  },

  /* ── 添加待办浮层 ── */
  openReadSheet() {
    this.readUI = { dur: 30, scheme: 'today', pickDate: null };
    $$('#rsDur button').forEach(x => x.classList.toggle('on', x.dataset.d === '30'));
    this.renderReadSheet();
    $('#readSheetWrap').classList.remove('hidden');
  },
  renderReadSheet() {
    const ui = this.readUI;
    $('#rsScheme').innerHTML = SCHEMES.map(s =>
      `<button data-scheme="${s.key}" class="${s.key === 'seq' ? 'w2' : s.key === 'pick' ? 'w3' : ''} ${ui.scheme === s.key ? 'on' : ''}">${s.label}</button>`).join('');
    const cal = $('#rsCal');
    if (ui.scheme === 'pick') {
      cal.classList.remove('hidden');
      const d = parseD(ui.pickDate || todayStr());
      this.readCal = MonthCal(cal, {
        y: d.getFullYear(), m: d.getMonth(), sel: ui.pickDate, cellH: 32,
        onPick: ds => { ui.pickDate = ds; }
      });
      this.readCal.render();
    } else cal.classList.add('hidden');
    const b = this.book();
    const durLabel = ui.dur === 60 ? '1 小时' : ui.dur + ' 分钟';
    $('#rsAdd').textContent = ui.scheme === 'seq'
      ? `添加 · 连续 7 天，每天读 ${durLabel}`
      : `添加 · 读《${b.title.slice(0, 12)}》${durLabel}`;
  },
  async addReadTodos() {
    const ui = this.readUI;
    const b = this.book();
    const durLabel = ui.dur === 60 ? '1 小时' : ui.dur + ' 分钟';
    const days = ui.scheme === 'seq' ? 7 : 1;
    for (let i = 0; i < days; i++) {
      await saveTodo({
        id: uid(), title: '读《' + b.title + '》' + durLabel, note: '',
        date: schemeDate(ui.scheme, ui.pickDate, i), time: null,
        src: { type: 'book', id: b.id, label: '读书' },
        done: false, doneAt: null, focusMin: 0, focusRounds: 0,
        createdAt: Date.now(), updatedAt: Date.now()
      });
    }
    if (b.status === '想读') { b.status = '在读'; await this.save(b); this.renderDetail(); }
    $('#readSheetWrap').classList.add('hidden');
    toast(days > 1 ? '已添加 7 条阅读待办' : '已添加 1 条待办');
  }
};
