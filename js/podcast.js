'use strict';
/* 播客：Apple Podcasts 数据（JSONP）+ 应用内播放 + 时间戳笔记 */

const Podcast = {
  tab: '单集',
  curShowId: null,
  curEpId: null,
  noteEd: null,        // {mode, noteId, at}
  audio: null,
  speeds: [0.8, 1.0, 1.25, 1.5, 2.0],
  speed: 1.0,
  _liveEps: [],        // 节目页在线单集缓存
  searchSeq: 0,

  init() {
    Nav.register('podList', { open: () => this.renderList(), refresh: () => this.renderList() });
    Nav.register('podSearch', { open: () => this.openSearch() });
    Nav.register('showPage', { open: p => this.openShow(p), refresh: () => this.renderShowEps() });
    Nav.register('epPage', { open: p => this.openEp(p), refresh: () => this.renderEp() });
    Nav.register('noteEdit', { open: p => this.openNote(p) });

    this.audio = new Audio();
    this.audio.preload = 'metadata';
    this.audio.addEventListener('timeupdate', () => this.onTime());
    this.audio.addEventListener('ended', () => this.onEnded());
    this.audio.addEventListener('play', () => this.syncPlayBtn());
    this.audio.addEventListener('pause', () => this.syncPlayBtn());

    $('#pdSearchBtn').addEventListener('click', () => Nav.push('podSearch'));
    $('#pdSeg').addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      this.tab = b.dataset.f;
      this.renderList();
    });
    $('#pdList').addEventListener('click', e => {
      const ep = e.target.closest('[data-ep]');
      if (ep) { Nav.push('epPage', { id: ep.dataset.ep }); return; }
      const sh = e.target.closest('[data-show]');
      if (sh) Nav.push('showPage', { id: Number(sh.dataset.show) });
    });

    const doSearch = debounce(() => this.search(), 800);
    $('#psInput').addEventListener('input', () => {
      $('#psClear').classList.toggle('hidden', !$('#psInput').value);
      this.searchSeq++;
      $('#psProg').classList.add('hidden');
      doSearch();
    });
    $('#psClear').addEventListener('click', () => { $('#psInput').value = ''; $('#psList').innerHTML = ''; $('#psClear').classList.add('hidden'); });
    $('#psList').addEventListener('click', async e => {
      const sub = e.target.closest('[data-sub]');
      if (sub) { await this.toggleSubscribe(this._searchShows[Number(sub.dataset.sub)]); this.search(true); return; }
      const want = e.target.closest('[data-want]');
      if (want) { await this.addToList(this._searchEps[Number(want.dataset.want)]); this.search(true); return; }
      const row = e.target.closest('[data-show]');
      if (row) Nav.push('showPage', { id: Number(row.dataset.show) });
    });

    $('#spSub').addEventListener('click', () => this.toggleSubFromShow());
    $('#spEps').addEventListener('click', async e => {
      const want = e.target.closest('[data-want-ep]');
      if (want) {
        await this.addToList(this._liveEps[Number(want.dataset.wantEp)]);
        this.renderShowEps();
        return;
      }
      const row = e.target.closest('[data-open-ep]');
      if (row) {
        const live = this._liveEps[Number(row.dataset.openEp)];
        await this.ensureEpisode(live);
        Nav.push('epPage', { id: live.id });
      }
    });

    $('#epPlay').addEventListener('click', () => this.togglePlay());
    $('#epBack10').addEventListener('click', () => this.seekBy(-10));
    $('#epFwd10').addEventListener('click', () => this.seekBy(10));
    $('#epBar').addEventListener('click', e => {
      const ep = this.ep();
      if (!ep || !ep.duration) return;
      const r = $('#epBar').getBoundingClientRect();
      this.seekTo(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * ep.duration);
    });
    $('#epSpeeds').addEventListener('click', e => {
      const b = e.target.closest('[data-sp]');
      if (!b) return;
      this.speed = Number(b.dataset.sp);
      this.audio.playbackRate = this.speed;
      this.renderSpeeds();
    });
    $('#epListBtn').addEventListener('click', () => this.toggleWant());
    $('#epNotes').addEventListener('click', e => {
      const ts = e.target.closest('[data-seek]');
      if (ts) { this.seekTo(Number(ts.dataset.seek)); this.play(); return; }
      const card = e.target.closest('[data-note]');
      if (card) Nav.push('noteEdit', { noteId: card.dataset.note });
    });
    $('#epAddNote').addEventListener('click', () => Nav.push('noteEdit', {}));

    $('#neSave').addEventListener('click', () => this.saveNote());
    $('#neDelete').addEventListener('click', () => {
      confirmBox('删除这条笔记？', '删除后无法恢复。', '删除', async () => {
        const ep = this.ep();
        ep.notes = ep.notes.filter(n => n.id !== this.noteEd.noteId);
        await this.saveEp(ep);
        Nav.back();
      });
    });
    $('#neM5').addEventListener('click', () => this.bumpTs(-5));
    $('#neP5').addEventListener('click', () => this.bumpTs(5));
    $('#neNow').addEventListener('click', () => { this.noteEd.at = Math.floor(this.audio.currentTime || 0); this.renderNoteTs(); });
  },

  ep() { return S.episodes.find(e => e.id === this.curEpId); },
  async saveEp(ep) {
    ep.updatedAt = Date.now();
    await DB.putEpisodes(ep);
    const i = S.episodes.findIndex(x => x.id === ep.id);
    if (i >= 0) S.episodes[i] = ep; else S.episodes.push(ep);
    if (Nav.top().id === 'epPage') this.renderEp();
  },

  /* ── 数据换算 ── */
  mapShow(r) {
    return {
      id: r.collectionId, name: r.collectionName || r.trackName, artist: r.artistName || '',
      artwork: (r.artworkUrl600 || r.artworkUrl100 || ''), feedUrl: r.feedUrl || '',
      total: r.trackCount || 0, updatedStr: r.releaseDate ? cnMD(r.releaseDate.slice(0, 10)) : '',
      subscribedAt: Date.now()
    };
  },
  mapEp(r) {
    return {
      id: String(r.trackId), showId: r.collectionId, showName: r.collectionName || '',
      title: r.trackName || '', artwork: r.artworkUrl600 || r.artworkUrl160 || r.artworkUrl100 || '',
      audioUrl: r.episodeUrl || r.previewUrl || '',
      duration: r.trackTimeMillis ? Math.round(r.trackTimeMillis / 1000) : 0,
      dateStr: r.releaseDate ? cnMD(r.releaseDate.slice(0, 10)) : '',
      inList: false, state: '未听', pos: 0, notes: [], addedAt: Date.now(), updatedAt: Date.now()
    };
  },
  async ensureEpisode(epLike) {
    if (!S.episodes.some(e => e.id === epLike.id)) await this.saveEp({ ...epLike });
  },
  async addToList(epLike) {
    await this.ensureEpisode(epLike);
    const ep = S.episodes.find(e => e.id === epLike.id);
    ep.inList = true;
    ep.addedAt = Date.now();
    await this.saveEp(ep);
    toast('已加入想听');
  },

  epDurText(ep) {
    if (!ep.duration) return '';
    const m = Math.round(ep.duration / 60);
    return m >= 60 ? Math.floor(m / 60) + ' 小时 ' + pad(m % 60) + ' 分' : m + ' 分';
  },

  /* ── 列表页 ── */
  renderList() {
    $('#pdSeg').innerHTML = ['单集', '订阅节目'].map(s =>
      `<button data-f="${s}" class="${this.tab === s ? 'on' : ''}">${s}</button>`).join('');
    if (this.tab === '单集') {
      const eps = S.episodes.filter(e => e.inList).sort((a, b) => b.addedAt - a.addedAt);
      $('#pdList').innerHTML = eps.map(e => {
        let body;
        if (e.state === '在听' && e.duration) {
          const pct = Math.round(e.pos / e.duration * 100);
          const left = Math.max(1, Math.round((e.duration - e.pos) / 60));
          body = `<div class="ep-progline"><i><b style="width:${pct}%"></b></i><span>剩 ${left} 分</span></div>`;
        } else {
          const cls = e.state === '听完' ? 'state-chip c3' : 'state-chip c1';
          body = `<span class="ep-chip ${cls}">${e.state}</span>`;
        }
        return `
          <div class="ep-card" data-ep="${e.id}">
            <div class="ep-art" ${e.artwork ? `style="background-image:url('${esc(e.artwork)}')"` : ''}></div>
            <div class="ep-main">
              <div class="ep-t">${esc(e.title)}</div>
              <div class="ep-sub">${esc(e.showName)}${e.duration ? ' · ' + this.epDurText(e) : ''}</div>
              ${body}
            </div>
          </div>`;
      }).join('') || '<div class="t-empty">清单还是空的 · 搜节目或单集加进来</div>';
    } else {
      $('#pdList').innerHTML = S.shows.slice().sort((a, b) => b.subscribedAt - a.subscribedAt).map(s => {
        // 未听 = 总集数 − 已听完的集数（与想听清单无关）
        const finished = S.episodes.filter(e => e.showId === s.id && e.state === '听完').length;
        const unheard = Math.max(0, (s.total || 0) - finished);
        return `
          <div class="ep-card" data-show="${s.id}">
            <div class="ep-art big" ${s.artwork ? `style="background-image:url('${esc(s.artwork)}')"` : ''}></div>
            <div class="ep-main" style="align-self:center">
              <div class="ep-t" style="font-size:15.5px">${esc(s.name)}</div>
              <div class="ep-sub">共 ${s.total} 集${s.updatedStr ? ' · 最近更新 ' + s.updatedStr : ''}</div>
            </div>
            <span class="state-chip ${unheard ? 'c2' : 'c1'}" style="align-self:center">${unheard ? unheard + ' 集未听' : '已听完'}</span>
          </div>`;
      }).join('') || '<div class="t-empty">还没订阅节目 · 去搜索里找找</div>';
    }
  },

  /* ── 搜索 ── */
  openSearch() {
    $('#psInput').value = '';
    $('#psList').innerHTML = '';
    $('#psClear').classList.add('hidden');
    setTimeout(() => $('#psInput').focus(), 300);
  },
  _searchShows: [], _searchEps: [],
  async search(keep) {
    const q = $('#psInput').value.trim();
    if (!q) { $('#psList').innerHTML = ''; return; }
    const seq = ++this.searchSeq;
    if (!keep) $('#psProg').classList.remove('hidden');
    try {
      const [shows, eps] = await Promise.all([
        jsonp(`https://itunes.apple.com/search?media=podcast&entity=podcast&country=CN&limit=6&term=${encodeURIComponent(q)}`),
        jsonp(`https://itunes.apple.com/search?media=podcast&entity=podcastEpisode&country=CN&limit=8&term=${encodeURIComponent(q)}`)
      ]);
      if (seq !== this.searchSeq) return;
      this._searchShows = (shows.results || []).map(r => this.mapShow(r));
      this._searchEps = (eps.results || []).filter(r => r.trackId).map(r => this.mapEp(r));
      $('#psProg').classList.add('hidden');
      const sHtml = this._searchShows.map((s, i) => {
        const subbed = S.shows.some(x => x.id === s.id);
        return `
          <div class="ep-card" data-show="${s.id}">
            <div class="ep-art" style="width:48px;height:48px;${s.artwork ? `background-image:url('${esc(s.artwork)}')` : ''}"></div>
            <div class="ep-main" style="align-self:center">
              <div class="ep-t">${esc(s.name)}</div>
              <div class="ep-sub">共 ${s.total} 集 · ${esc(s.artist)}</div>
            </div>
            <button class="bk-btn ${subbed ? 'added' : ''}" style="background:${subbed ? 'transparent' : '#FBF8F5'};color:${subbed ? 'rgba(255,255,255,0.75)' : '#33403C'}" data-sub="${i}">${subbed ? '已订阅' : '订阅'}</button>
          </div>`;
      }).join('');
      const eHtml = this._searchEps.map((e, i) => {
        const inList = S.episodes.some(x => x.id === e.id && x.inList);
        return `
          <div class="ep-card" style="cursor:default">
            <div class="ep-main">
              <div class="ep-t" style="font-weight:500">${esc(e.title)}</div>
              <div class="ep-sub">${esc(e.showName)}${e.dateStr ? ' · ' + e.dateStr : ''}${e.duration ? ' · ' + this.epDurText(e) : ''}</div>
            </div>
            <button class="bk-btn ${inList ? 'added' : ''}" data-want="${i}">${inList ? '已想听' : '想听'}</button>
          </div>`;
      }).join('');
      $('#psList').innerHTML =
        (sHtml ? '<div class="sec-label">节目</div>' + sHtml : '') +
        (eHtml ? '<div class="sec-label">单集</div>' + eHtml : '') ||
        '<div class="t-empty">没搜到 · 换个词试试</div>';
    } catch (err) {
      if (seq !== this.searchSeq) return;
      $('#psProg').classList.add('hidden');
      $('#psList').innerHTML = '<div class="t-empty">搜索服务连不上 · 稍后再试</div>';
    }
  },
  async toggleSubscribe(show) {
    const i = S.shows.findIndex(x => x.id === show.id);
    if (i >= 0) {
      await DB.delShows(show.id);
      S.shows.splice(i, 1);
      toast('已取消订阅');
    } else {
      await DB.putShows(show);
      S.shows.push(show);
      toast('已订阅');
    }
  },

  /* ── 节目页 ── */
  async openShow(p) {
    this.curShowId = p.id;
    this._liveEps = [];
    let show = S.shows.find(s => s.id === p.id) || (this._searchShows || []).find(s => s.id === p.id);
    if (show) this.renderShowHead(show);
    $('#spEps').innerHTML = '<div class="at-none">加载中…</div>';
    try {
      const j = await jsonp(`https://itunes.apple.com/lookup?id=${p.id}&entity=podcastEpisode&limit=200&country=CN`);
      const rs = j.results || [];
      const showR = rs.find(r => r.wrapperType === 'track' && r.kind === 'podcast') || rs[0];
      if (showR && !show) show = this.mapShow(showR);
      if (showR && show) { show.total = showR.trackCount || show.total; }
      this._liveEps = rs.filter(r => r.wrapperType === 'podcastEpisode' || r.kind === 'podcast-episode')
        .map(r => this.mapEp(r))
        .sort((a, b) => 0);   // iTunes 已按时间倒序
      if (show) this.renderShowHead(show);
      this.renderShowEps();
    } catch (e) {
      $('#spEps').innerHTML = '<div class="t-empty">加载不了这个节目 · 稍后再试</div>';
    }
  },
  renderShowHead(show) {
    this._curShow = show;
    $('#spCover').style.backgroundImage = show.artwork ? `url('${show.artwork}')` : '';
    $('#spName').textContent = show.name;
    const finished = S.episodes.filter(e => e.showId === show.id && e.state === '听完').length;
    const unheard = Math.max(0, (show.total || 0) - finished);
    $('#spMeta').textContent = '共 ' + show.total + ' 集' + (unheard ? ' · ' + unheard + ' 集未听' : ' · 已听完');
    const subbed = S.shows.some(x => x.id === show.id);
    $('#spSub').textContent = subbed ? '已订阅' : '订阅';
    $('#spSub').classList.toggle('lit', !subbed);
  },
  async toggleSubFromShow() {
    if (!this._curShow) return;
    await this.toggleSubscribe(this._curShow);
    this.renderShowHead(this._curShow);
  },
  renderShowEps() {
    if (!this._liveEps.length) return;
    $('#spEps').innerHTML = this._liveEps.map((le, i) => {
      const st = S.episodes.find(e => e.id === le.id);
      let stTxt = '未听', stCls = '', right = `<button class="bk-btn" data-want-ep="${i}">想听</button>`;
      if (st) {
        if (st.state === '在听') {
          const pct = st.duration ? Math.round(st.pos / st.duration * 100) : 0;
          stTxt = '在听 · ' + pct + '%'; stCls = 'play';
          right = '<span class="lab">继续听 ›</span>';
        } else if (st.state === '听完') {
          stTxt = '听完'; stCls = 'done';
          right = '<span class="lab">已听完</span>';
        } else if (st.inList) {
          right = '<span class="lab">已想听</span>';
        }
      }
      return `
        <div class="sp-ep" data-open-ep="${i}">
          <div class="sp-ep-main">
            <div class="sp-ep-t">${esc(le.title)}</div>
            <div class="sp-ep-sub"><span class="st ${stCls}">${stTxt}</span><span class="dt">${le.dateStr}${le.duration ? ' · ' + this.epDurText(le) : ''}</span></div>
          </div>
          ${right}
        </div>`;
    }).join('');
  },

  /* ── 单集页 ── */
  openEp(p) {
    this.curEpId = p.id;
    const ep = this.ep();
    if (!ep) { Nav.back(); return; }
    $('#epBack').textContent = '‹ ' + (ep.showName || '播客').slice(0, 8);
    // 切换单集：换音源
    if (this.audio.dataset.epId !== ep.id) {
      this.audio.pause();
      this.audio.src = ep.audioUrl || '';
      this.audio.dataset.epId = ep.id;
      this.audio.currentTime = ep.pos || 0;
      this.audio.playbackRate = this.speed;
    }
    this.renderEp();
    this.renderSpeeds();
  },
  renderEp() {
    const ep = this.ep();
    if (!ep) return;
    $('#epTitle').textContent = ep.title;
    $('#epMeta').textContent = [ep.dateStr, this.epDurText(ep)].filter(Boolean).join(' · ');
    const btn = $('#epListBtn');
    btn.textContent = ep.inList ? '移出想听' : '＋ 想听';
    btn.className = 'mini-btn fixed ' + (ep.inList ? 'warn' : '');
    this.renderPos();
    this.renderNotes();
    this.syncPlayBtn();
  },
  renderPos() {
    const ep = this.ep();
    if (!ep) return;
    const pos = this.audio.dataset.epId === ep.id ? (this.audio.currentTime || ep.pos) : ep.pos;
    const dur = ep.duration || this.audio.duration || 0;
    $('#epPos').textContent = fmtTs(pos);
    $('#epLeft').textContent = dur ? '-' + fmtTs(Math.max(0, dur - pos)) : '';
    $('#epFill').style.width = dur ? (pos / dur * 100) + '%' : '0';
    $('#epAddNoteLabel').textContent = '在 ' + fmtTs(pos) + ' 记一条…';
  },
  renderSpeeds() {
    $('#epSpeeds').innerHTML = this.speeds.map(s =>
      `<button data-sp="${s}" class="${s === this.speed ? 'on' : ''}">${s.toFixed(s === 1.25 ? 2 : 1)}×</button>`).join('');
  },
  renderNotes() {
    const ep = this.ep();
    const notes = (ep.notes || []).slice().sort((a, b) => a.at - b.at);
    $('#epNoteCount').textContent = '笔记 ' + notes.length + ' 条';
    $('#epNotes').innerHTML = notes.map(n => `
      <div class="note-card" data-note="${n.id}">
        <button class="ts-chip" data-seek="${n.at}">${fmtTs(n.at)}</button>
        <div class="note-text">${esc(n.text)}</div>
      </div>`).join('') || '<div class="at-none">听到想记的就点下面记一条</div>';
  },
  syncPlayBtn() {
    const playing = !this.audio.paused;
    $('#epIcoPlay').classList.toggle('hidden', playing);
    $('#epIcoPause').classList.toggle('hidden', !playing);
  },

  play() {
    const ep = this.ep();
    if (!ep) return;
    if (!ep.audioUrl) { toast('这一集拿不到音频地址'); return; }
    this.audio.play().catch(() => toast('播放失败 · 音频源可能不可用'));
  },
  togglePlay() {
    if (this.audio.paused) this.play();
    else this.audio.pause();
  },
  seekBy(s) { this.seekTo((this.audio.currentTime || 0) + s); },
  seekTo(sec) {
    const ep = this.ep();
    if (this.audio.dataset.epId !== (ep && ep.id)) return;
    this.audio.currentTime = Math.max(0, sec);
    this.renderPos();
  },

  _lastSave: 0,
  async onTime() {
    const ep = this.ep();
    if (!ep || this.audio.dataset.epId !== ep.id) return;
    if (!ep.duration && this.audio.duration) ep.duration = Math.round(this.audio.duration);
    ep.pos = this.audio.currentTime;
    if (ep.pos > 5 && ep.state === '未听') ep.state = '在听';
    if (Nav.top().id === 'epPage') this.renderPos();
    if (Date.now() - this._lastSave > 5000) {
      this._lastSave = Date.now();
      await this.saveEpQuiet(ep);
    }
  },
  async saveEpQuiet(ep) {
    ep.updatedAt = Date.now();
    await DB.putEpisodes(ep);
  },
  async onEnded() {
    const ep = this.ep();
    if (!ep) return;
    ep.state = '听完';
    ep.pos = ep.duration;
    await this.saveEp(ep);
  },

  toggleWant() {
    const ep = this.ep();
    if (!ep.inList) {
      ep.inList = true;
      ep.addedAt = Date.now();
      this.saveEp(ep);
      return;
    }
    const n = (ep.notes || []).length;
    if (n > 0) {
      confirmBox('移出想听？', `这一集有 ${n} 条笔记，移出后笔记会一并清空，且无法恢复。`, '移出并清空', async () => {
        ep.inList = false;
        ep.notes = [];
        await this.saveEp(ep);
      });
    } else {
      ep.inList = false;
      this.saveEp(ep);
    }
  },

  /* ── 笔记 ── */
  openNote(p) {
    const ep = this.ep();
    const note = p.noteId ? ep.notes.find(n => n.id === p.noteId) : null;
    this.noteEd = {
      mode: note ? 'edit' : 'new',
      noteId: note ? note.id : null,
      at: note ? note.at : Math.floor(this.audio.currentTime || 0)
    };
    $('#neTitle').textContent = note ? '编辑笔记' : '新建笔记';
    $('#neText').value = note ? note.text : '';
    $('#neEp').textContent = ep.title.slice(0, 18) + ' · ' + ep.showName;
    $('#neDelete').classList.toggle('hidden', !note);
    this.renderNoteTs();
    if (!note) setTimeout(() => $('#neText').focus(), 300);
  },
  renderNoteTs() { $('#neTs').textContent = fmtTs(this.noteEd.at); },
  bumpTs(d) {
    this.noteEd.at = Math.max(0, this.noteEd.at + d);
    this.renderNoteTs();
  },
  async saveNote() {
    const text = $('#neText').value.trim();
    if (!text) { toast('写点内容再保存'); return; }
    const ep = this.ep();
    if (this.noteEd.mode === 'edit') {
      const n = ep.notes.find(x => x.id === this.noteEd.noteId);
      n.text = text;
      n.at = this.noteEd.at;
    } else {
      ep.notes = (ep.notes || []).concat({ id: uid(), at: this.noteEd.at, text, createdAt: Date.now() });
    }
    await this.saveEp(ep);
    Nav.back();
  }
};
