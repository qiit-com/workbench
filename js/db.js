// IndexedDB 封装
// v1: todos + meta
// v2: + topics / books / shows / episodes / sports / meals；todos.source 字符串迁移为 src 对象
const DB = (() => {
  let d = null;

  const STORES = ['todos', 'meta', 'topics', 'books', 'shows', 'episodes', 'sports', 'meals'];

  function open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('workbench', 2);
      r.onupgradeneeded = e => {
        const x = r.result;
        for (const s of STORES) {
          if (!x.objectStoreNames.contains(s)) x.createObjectStore(s, s === 'meta' ? undefined : { keyPath: 'id' });
        }
        if (e.oldVersion === 1) {
          // 迁移：source 字符串 → src 对象
          const tx = r.transaction;
          const st = tx.objectStore('todos');
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

  const api = { open };
  for (const s of STORES) {
    if (s === 'meta') continue;
    const cap = s[0].toUpperCase() + s.slice(1);
    api['all' + cap] = () => wrap(store(s).getAll());
    api['put' + cap] = v => wrap(store(s, 'readwrite').put(v));
    api['del' + cap] = id => wrap(store(s, 'readwrite').delete(id));
    api['clear' + cap] = () => wrap(store(s, 'readwrite').clear());
  }
  api.getMeta = k => wrap(store('meta').get(k));
  api.setMeta = (k, v) => wrap(store('meta', 'readwrite').put(v, k));
  api.delMeta = k => wrap(store('meta', 'readwrite').delete(k));
  return api;
})();
