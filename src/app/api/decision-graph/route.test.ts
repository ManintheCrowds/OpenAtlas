import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { GET } from './route';

describe('GET /api/decision-graph', () => {
  let dir: string;
  let dbPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'dg-'));
    dbPath = join(dir, 'decision-graph.sqlite');
    process.env.DECISION_GRAPH_DB = dbPath;
    process.env.DECISION_CONFLICT_FLAGS = join(dir, 'conflict-flags.json');
  });

  afterEach(() => {
    delete process.env.DECISION_GRAPH_DB;
    delete process.env.DECISION_CONFLICT_FLAGS;
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns missing status when db absent', async () => {
    const res = await GET(new Request('http://localhost/api/decision-graph'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('missing');
    expect(body.decisions).toEqual([]);
  });

  it('returns chain for fixture decisions', async () => {
    const db = new Database(dbPath);
    db.exec(`
      CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE decisions (
        id TEXT PRIMARY KEY, date TEXT, area TEXT, decision TEXT NOT NULL,
        rationale TEXT, plan_ref TEXT, source_path TEXT, created_at TEXT
      );
      CREATE TABLE edges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id TEXT NOT NULL, target_id TEXT NOT NULL, edge_type TEXT NOT NULL
      );
    `);
    db.prepare(
      `INSERT INTO decisions (id, date, area, decision) VALUES (?, ?, ?, ?)`
    ).run('d_a', '2026-08-01', 'A', 'First');
    db.prepare(
      `INSERT INTO decisions (id, date, area, decision) VALUES (?, ?, ?, ?)`
    ).run('d_b', '2026-08-02', 'B', 'Second');
    db.prepare(
      `INSERT INTO edges (source_id, target_id, edge_type) VALUES (?, ?, ?)`
    ).run('d_a', 'd_b', 'CAUSED');
    db.close();

    const list = await GET(new Request('http://localhost/api/decision-graph'));
    const listBody = await list.json();
    expect(listBody.status).toBe('ok');
    expect(listBody.decisions).toHaveLength(2);

    const chainRes = await GET(
      new Request('http://localhost/api/decision-graph?id=d_b')
    );
    const chainBody = await chainRes.json();
    expect(chainBody.status).toBe('ok');
    expect(chainBody.chain.map((d: { id: string }) => d.id)).toEqual(['d_a', 'd_b']);
  });

  it('returns 500 for corrupt db without stack leak shape', async () => {
    writeFileSync(dbPath, 'not-a-sqlite-file');
    const res = await GET(new Request('http://localhost/api/decision-graph'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.status).toBe('error');
    expect(body.message).toMatch(/Corrupt|unreadable/i);
  });
});
