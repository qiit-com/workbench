// IndexedDB 封装
// v1: todos + meta
// v2: + topics / books / shows / episodes / sports / meals；todos.source 字符串迁移为 src 对象
// v3: + outbox（同步变更记录：本机每次增删改都记一笔，推送成功后清掉）
const DB = (() => {
  let d = null;

  const STORES = ['todos', 'meta', 'topics', 'books', 'shows', 'episodes', 'sports', 'meals', 'outbox'];
  const SYNCED = new Set(['todos', 'topics', 'books', 'shows', 'episodes', 'sports', 'meals']);
  let silent = false;   // 应用云端变更时置真，避免把拉下来的数据又记进 outbox（回声）

  function open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('workbench', 3);
      r.onupgradeneeded = e => {
        const x = r.result;
        for (const s of STORES) {
          if (!x.objectStoreNames.contains(s)) {
            x.createObjectStore(s, (s === 'meta' || s === 'outbox') ? undefined : { keyPath: 'id' });
          }
        }
        if (e.oldVersion === 1) {
          const st = r.transaction.objectStore('todos');
          st.openCursor().onsuccess = ev => {
            const cur = ev.target.result;
            if (!cur) return;
            const t = cur.value;
            if (typeof t.source === 'string') {
              t.src = t.source === '手动' ? null : { type: null, id: null, label: t.source === '自媒体' ? '选题库' : t.source };
              delete t.source;
              t.focusMin = t.focusMin || 0;
              t.focusRounds = t.focusRounds || 0;
              cur.update(t);
            }
            cur.continue();
          };
        }
      };
      r.onsuccess = () => { d = r.result; res(); };
      r.onerror = () => rej(r.error);
    });
  }

  const store = (name, mode) => d.transaction(name, mode || 'readonly').objectStore(name);
  const wrap = req => new Promise((res, rej) => {
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });

  // 记一笔变更（键 = store|id，重复修改同一条只留最后一笔）
  function track(s, id, deleted) {
    if (silent || !SYNCED.has(s)) return;
    store('outbox', 'readwrite').put({ store: s, id, deleted: deleted ? 1 : 0, at: Date.now() }, s + '|' + id);
    if (typeof Sync !== 'undefined' && Sync.schedule) Sync.schedule();
  }

  const api = {
    open,
    setSilent(v) { silent = v; },
    getOne: (s, id) => wrap(store(s).get(id)),
    outboxAll: () => new Promise((res, rej) => {
      const st = store('outbox');
      const keys = [], vals = [];
      const req = st.openCursor();
      req.onsuccess = () => {
        const cur = req.result;
        if (!cur) return res(vals);
        vals.push({ key: cur.key, ...cur.value });
        cur.continue();
      };
      req.onerror = () => rej(req.error);
    }),
    outboxClear: keys => Promise.all(keys.map(k => wrap(store('outbox', 'readwrite').delete(k)))),
    outboxMark: (s, id) => wrap(store('outbox', 'readwrite').put({ store: s, id, deleted: 0, at: Date.now() }, s + '|' + id)),
  };

  for (const s of STORES) {
    if (s === 'meta' || s === 'outbox') continue;
    const cap = s[0].toUpperCase() + s.slice(1);
    api['all' + cap] = () => wrap(store(s).getAll());
    api['put' + cap] = v => { track(s, v.id, false); return wrap(store(s, 'readwrite').put(v)); };
    api['del' + cap] = id => { track(s, id, true); return wrap(store(s, 'readwrite').delete(id)); };
    api['clear' + cap] = () => wrap(store(s, 'readwrite').clear());
  }
  api.getMeta = k => wrap(store('meta').get(k));
  api.setMeta = (k, v) => wrap(store('meta', 'readwrite').put(v, k));
  api.delMeta = k => wrap(store('meta', 'readwrite').delete(k));
  return api;
})();
