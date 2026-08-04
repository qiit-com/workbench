'use strict';
/* 多设备同步：同步码 + 推拉 + 记录级「新的覆盖旧的」
   - 本机每次增删改由 db.js 记入 outbox，这里负责推送
   - 拉取用服务器游标（rowid），照片字段不上云、合并时保留本地 */

const SYNC_STORES = ['todos', 'topics', 'books', 'shows', 'episodes', 'sports', 'meals'];
const CAP = s => s[0].toUpperCase() + s.slice(1);

const Sync = {
  code: null,
  cursor: 0,
  busy: false,
  status: '',      // '' | 'syncing' | 'ok' | 'error'
  _timer: null,

  async init() {
    this.code = (await DB.getMeta('syncCode')) || null;
    this.cursor = (await DB.getMeta('syncCursor')) || 0;
    this.lastAt = (await DB.getMeta('syncLastAt')) || null;
    this.renderCard();
    $('#syncCard').addEventListener('click', e => this.onClick(e));
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.code) this.syncNow();
    });
    if (this.code) this.syncNow();
  },

  /* db.js 每次记账后调这里：3 秒内的连续改动合并成一次推送 */
  schedule() {
    if (!this.code) return;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.syncNow(), 3000);
  },

  genCode() {
    const AB = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const grp = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), b => AB[b % AB.length]).join('');
    return 'dusk-' + grp() + '-' + grp() + '-' + grp();
  },

  async enable(code) {
    this.code = code.trim();
    this.cursor = 0;
    await DB.setMeta('syncCode', this.code);
    await DB.setMeta('syncCursor', 0);
    // 现有全部本地数据标记待推送（合并进云端）
    for (const s of SYNC_STORES) {
      for (const rec of await DB['all' + CAP(s)]()) await DB.outboxMark(s, rec.id);
    }
    await this.syncNow();
  },

  async disable() {
    this.code = null;
    this.cursor = 0;
    this.status = '';
    await DB.delMeta('syncCode');
    await DB.delMeta('syncCursor');
    await DB.delMeta('syncLastAt');
    this.renderCard();
  },

  strip(store, rec) {
    const c = { ...rec };
    if (store === 'topics') c.shots = [];
    if (store === 'meals') c.photos = [];
    return c;
  },

  async api(body) {
    const r = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: this.code, ...body })
    });
    if (!r.ok) throw new Error('sync http ' + r.status);
    return r.json();
  },

  async push() {
    const box = await DB.outboxAll();
    for (let i = 0; i < box.length; i += 100) {
      const chunk = box.slice(i, i + 100);
      const changes = [];
      for (const e of chunk) {
        if (e.deleted) {
          changes.push({ store: e.store, id: e.id, deleted: 1, updatedAt: e.at });
        } else {
          const rec = await DB.getOne(e.store, e.id);
          if (!rec) continue;   // 已被删，删除墓碑会另有一笔
          changes.push({
            store: e.store, id: e.id, deleted: 0,
            updatedAt: rec.updatedAt || e.at,
            data: JSON.stringify(this.strip(e.store, rec))
          });
        }
      }
      if (changes.length) await this.api({ op: 'push', changes });
      await DB.outboxClear(chunk.map(e => e.key));
    }
  },

  async pull() {
    let changed = false;
    for (let guard = 0; guard < 40; guard++) {
      const resp = await this.api({ op: 'pull', since: this.cursor });
      DB.setSilent(true);
      try {
        for (const c of resp.changes || []) {
          const local = await DB.getOne(c.store, c.id);
          if (c.deleted) {
            if (local && (local.updatedAt || 0) <= c.updatedAt) { await DB['del' + CAP(c.store)](c.id); changed = true; }
            continue;
          }
          if (local && (local.updatedAt || 0) >= c.updatedAt) continue;   // 本地更新（或回声），跳过
          let data;
          try { data = JSON.parse(c.data); } catch (e) { continue; }
          if (c.store === 'topics') data.shots = local ? (local.shots || []) : [];
          if (c.store === 'meals') data.photos = local ? (local.photos || []) : [];
          await DB['put' + CAP(c.store)](data);
          changed = true;
        }
      } finally { DB.setSilent(false); }
      this.cursor = resp.cursor || this.cursor;
      await DB.setMeta('syncCursor', this.cursor);
      if (!resp.more) break;
    }
    if (changed) {
      await this.reloadState();
      Nav.refreshTop();
    }
  },

  async reloadState() {
    [S.todos, S.topics, S.books, S.shows, S.episodes, S.sports, S.meals] = await Promise.all([
      DB.allTodos(), DB.allTopics(), DB.allBooks(), DB.allShows(), DB.allEpisodes(), DB.allSports(), DB.allMeals()
    ]);
  },

  async syncNow() {
    if (!this.code || this.busy || !navigator.onLine) return;
    this.busy = true;
    this.status = 'syncing';
    this.renderCard();
    try {
      await this.push();
      await this.pull();
      this.status = 'ok';
      this.lastAt = Date.now();
      await DB.setMeta('syncLastAt', this.lastAt);
    } catch (e) {
      this.status = 'error';
    }
    this.busy = false;
    this.renderCard();
  },

  /* ── 设置页卡片 ── */
  lastText() {
    if (!this.lastAt) return '还没同步过';
    const m = Math.round((Date.now() - this.lastAt) / 60000);
    return '上次同步 ' + (m < 1 ? '刚刚' : m < 60 ? m + ' 分钟前' : Math.round(m / 60) + ' 小时前');
  },

  renderCard() {
    const el = $('#syncCard');
    if (!el) return;
    if (!this.code) {
      el.innerHTML = `
        <div class="sec-label in">同步</div>
        <p class="set-desc">多设备同步：数据存到云端，换设备输入同步码即可接上；本机离线仍然可用。</p>
        <div class="btn-pair in">
          <button class="btn-sec strong3" data-sync="create">生成同步码</button>
          <button class="btn-sec" data-sync="join">输入同步码</button>
        </div>`;
      return;
    }
    const st = this.status === 'syncing' ? '同步中…'
      : this.status === 'error' ? '同步失败 · 检查网络后点「立即同步」'
      : '已开启 · ' + this.lastText();
    el.innerHTML = `
      <div class="sec-label in">同步</div>
      <button class="sync-code" data-sync="copy" title="点击复制">${esc(this.code)}</button>
      <div class="set-sub">${esc(st)}</div>
      <div class="btn-pair in">
        <button class="btn-sec strong3" data-sync="now">立即同步</button>
        <button class="btn-sec" data-sync="off">关闭同步</button>
      </div>`;
  },

  async onClick(e) {
    const b = e.target.closest('[data-sync]');
    if (!b) return;
    const act = b.dataset.sync;
    if (act === 'create') {
      const code = this.genCode();
      confirmBox('开启同步', '你的同步码：\n\n' + code + '\n\n请立刻抄下或截图保存——它是找回数据的唯一凭证，丢了没有任何办法找回。其他设备输入这个码即可同步。', '已保存，开启', async () => {
        await this.enable(code);
        toast('同步已开启');
      });
    }
    if (act === 'join') {
      const code = (prompt('输入另一台设备上的同步码：') || '').trim();
      if (!code) return;
      if (code.length < 8) { toast('同步码不对'); return; }
      confirmBox('接入同步？', '本机现有数据会与云端数据合并（同一条记录以较新的修改为准）。', '合并并同步', async () => {
        await this.enable(code);
        toast('已接入同步');
      });
    }
    if (act === 'copy') {
      try { await navigator.clipboard.writeText(this.code); toast('同步码已复制'); }
      catch (err) { toast(this.code); }
    }
    if (act === 'now') this.syncNow();
    if (act === 'off') {
      confirmBox('关闭同步？', '仅断开本机与云端的连接，本机和云端数据都保留，其他设备不受影响。', '关闭', () => this.disable());
    }
  }
};
