-- 同步数据表：所有模块的记录都存这一张表
-- ns = 同步码的 SHA-256（命名空间，一个同步码一份数据）
-- store = 模块名（todos/topics/books/shows/episodes/sports/meals）
-- data = 记录的 JSON（不含照片）
-- updated_at = 客户端修改时间，冲突时新的覆盖旧的
-- deleted = 删除标记（墓碑），让删除动作能传到其他设备
-- rowid（SQLite 自带）当同步游标用：每次写入自动递增
CREATE TABLE IF NOT EXISTS records (
  ns TEXT NOT NULL,
  store TEXT NOT NULL,
  id TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ns, store, id)
);
CREATE INDEX IF NOT EXISTS idx_ns ON records (ns);
