// 同步接口（Cloudflare Pages Function）
// POST /api/sync  body: { code, op: 'push'|'pull', changes?, since? }
// - push: 上传一批变更，逐条按 updated_at「新的覆盖旧的」
// - pull: 拉取游标 since 之后的变更（游标 = 服务器写入序号 rowid）

const STORES = new Set(['todos', 'topics', 'books', 'shows', 'episodes', 'sports', 'meals']);

async function nsOf(code) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('dusk:' + code));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

const json = (obj, status) => new Response(JSON.stringify(obj), {
  status: status || 200,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
});

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
  const { code, op } = body || {};
  if (typeof code !== 'string' || code.length < 8 || code.length > 64) return json({ error: 'bad code' }, 400);
  const ns = await nsOf(code);
  const db = env.DB;

  if (op === 'push') {
    const changes = Array.isArray(body.changes) ? body.changes.slice(0, 200) : [];
    let applied = 0;
    for (const c of changes) {
      if (!STORES.has(c.store) || typeof c.id !== 'string' || c.id.length > 128) continue;
      const updatedAt = Number(c.updatedAt) || 0;
      const deleted = c.deleted ? 1 : 0;
      const data = deleted ? '' : String(c.data || '');
      if (data.length > 200000) continue;   // 单条 200KB 上限（照片不走同步）
      // 新的覆盖旧的：只有比库里新才写入
      const cur = await db.prepare('SELECT updated_at FROM records WHERE ns=? AND store=? AND id=?')
        .bind(ns, c.store, c.id).first();
      if (cur && cur.updated_at > updatedAt) continue;
      await db.prepare('REPLACE INTO records (ns, store, id, data, updated_at, deleted) VALUES (?,?,?,?,?,?)')
        .bind(ns, c.store, c.id, data, updatedAt, deleted).run();
      applied++;
    }
    const row = await db.prepare('SELECT MAX(rowid) AS c FROM records WHERE ns=?').bind(ns).first();
    return json({ ok: true, applied, cursor: row && row.c || 0 });
  }

  if (op === 'pull') {
    const since = Number(body.since) || 0;
    const rs = await db.prepare(
      'SELECT rowid AS rev, store, id, data, updated_at AS updatedAt, deleted FROM records WHERE ns=? AND rowid>? ORDER BY rowid LIMIT 300'
    ).bind(ns, since).all();
    const rows = rs.results || [];
    const cursor = rows.length ? rows[rows.length - 1].rev : since;
    return json({ ok: true, changes: rows, cursor, more: rows.length === 300 });
  }

  return json({ error: 'bad op' }, 400);
}
