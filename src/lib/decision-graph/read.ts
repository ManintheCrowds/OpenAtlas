/**
 * PURPOSE: Read-only access to decision-graph.sqlite projection
 * DEPENDENCIES: better-sqlite3
 * MODIFICATION NOTES: Adapt program U4 — separate from app survey SQLite
 */

import Database from 'better-sqlite3';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export type DecisionRow = {
  id: string;
  date: string | null;
  area: string | null;
  decision: string;
  rationale: string | null;
  plan_ref: string | null;
  source_path: string | null;
  created_at: string | null;
};

export type EdgeRow = {
  source_id: string;
  target_id: string;
  type: string;
};

export type ConflictCallout = {
  id: string;
  summary: string;
  paths?: string[];
};

export function decisionGraphDbPath(): string {
  if (process.env.DECISION_GRAPH_DB) return process.env.DECISION_GRAPH_DB;
  return join(process.cwd(), 'data', 'decision-graph.sqlite');
}

export function conflictFlagsPath(): string {
  if (process.env.DECISION_CONFLICT_FLAGS) return process.env.DECISION_CONFLICT_FLAGS;
  return join(process.cwd(), 'data', 'conflict-flags.json');
}

export function readDecisionGraph(): {
  status: 'ok' | 'missing' | 'error';
  error?: string;
  decisions: DecisionRow[];
  edges: EdgeRow[];
  meta: Record<string, string>;
  callouts: ConflictCallout[];
} {
  const dbPath = decisionGraphDbPath();
  if (!existsSync(dbPath)) {
    return { status: 'missing', decisions: [], edges: [], meta: {}, callouts: readCallouts() };
  }
  try {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    try {
      const decisions = db
        .prepare(
          `SELECT id, date, area, decision, rationale, plan_ref, source_path, created_at
           FROM decisions ORDER BY date DESC, area ASC`
        )
        .all() as DecisionRow[];
      const edges = db
        .prepare(
          `SELECT source_id, target_id, edge_type AS type FROM edges ORDER BY id ASC`
        )
        .all() as EdgeRow[];
      const metaRows = db.prepare(`SELECT key, value FROM meta`).all() as {
        key: string;
        value: string;
      }[];
      const meta: Record<string, string> = {};
      for (const row of metaRows) meta[row.key] = row.value;
      return { status: 'ok', decisions, edges, meta, callouts: readCallouts() };
    } finally {
      db.close();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: 'error',
      error: message,
      decisions: [],
      edges: [],
      meta: {},
      callouts: [],
    };
  }
}

export function traceDecisionChain(leafId: string): {
  status: 'ok' | 'missing' | 'unknown' | 'error';
  error?: string;
  chain: DecisionRow[];
  edges: EdgeRow[];
} {
  const graph = readDecisionGraph();
  if (graph.status === 'missing') return { status: 'missing', chain: [], edges: [] };
  if (graph.status === 'error') {
    return { status: 'error', error: graph.error, chain: [], edges: [] };
  }
  const byId = new Map(graph.decisions.map((d) => [d.id, d]));
  if (!byId.has(leafId)) return { status: 'unknown', chain: [], edges: [] };

  const visited: string[] = [];
  const seen = new Set<string>();
  const queue = [leafId];
  const usedEdges: EdgeRow[] = [];
  while (queue.length) {
    const current = queue.shift()!;
    if (seen.has(current)) continue;
    seen.add(current);
    visited.push(current);
    for (const e of graph.edges) {
      if (e.target_id === current) {
        usedEdges.push(e);
        if (!seen.has(e.source_id)) queue.push(e.source_id);
      }
    }
  }
  const chainIds = [...visited].reverse();
  return {
    status: 'ok',
    chain: chainIds.map((id) => byId.get(id)!).filter(Boolean),
    edges: usedEdges,
  };
}

function readCallouts(): ConflictCallout[] {
  const path = conflictFlagsPath();
  if (!existsSync(path)) return [];
  try {
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as
      | { flags?: ConflictCallout[] }
      | ConflictCallout[];
    if (Array.isArray(raw)) return raw;
    return raw.flags ?? [];
  } catch {
    return [];
  }
}
