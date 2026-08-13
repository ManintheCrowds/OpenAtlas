# Decision graph schema (local DI store)

**PURPOSE:** Typed decision nodes + causal edges projected from harness markdown. Not a Semantica runtime; adapt-not-adopt.

**SSOT:** Human append remains OpenHarness / MiscRepos `decision-log.md`. SQLite is a **projection** + edge store (KTD1).

**DB path:** `data/decision-graph.sqlite` under OpenGrimoire (gitignored). Override with `DECISION_GRAPH_DB`.

**Projector:** `MiscRepos/.cursor/scripts/project_decision_graph.py`

---

## Edge types (closed enum)

Only:

| Type | Meaning |
|------|---------|
| `CAUSED` | Source decision directly caused the target |
| `INFLUENCED` | Source influenced the target |
| `PRECEDENT_FOR` | Source is a precedent for the target |

Any other type is **rejected** (no write).

---

## SQLite tables

### `meta`

| Column | Type | Notes |
|--------|------|-------|
| `key` | TEXT PK | e.g. `generated`, `schema_version`, `source_log` |
| `value` | TEXT | |

`schema_version` = `1`. `generated` = ISO-8601 UTC when last projected.

### `decisions`

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | Stable id (see below) |
| `date` | TEXT | `YYYY-MM-DD` from section heading |
| `area` | TEXT | Bracket area from entry |
| `decision` | TEXT NOT NULL | One-line decision text |
| `rationale` | TEXT | Optional |
| `plan_ref` | TEXT | Optional `(plan: …)` |
| `source_path` | TEXT | Path of decision-log file |
| `created_at` | TEXT | Projection timestamp (ISO UTC) |

### `edges`

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK AUTOINCREMENT | |
| `source_id` | TEXT NOT NULL | FK-like to `decisions.id` |
| `target_id` | TEXT NOT NULL | |
| `edge_type` | TEXT NOT NULL | CHECK enum above |
| UNIQUE(`source_id`, `target_id`, `edge_type`) | | |

---

## Stable decision ID

```
id = "d_" + sha256(f"{date}\n{area}\n{decision}").hexdigest()[:16]
```

Same prose under the same date/area → same id across idempotent rebuilds. Changing the decision line creates a new id (old row removed on full rebuild).

---

## decision-log.md mapping

Per [OpenHarness `state/README.md`](../../OpenHarness/state/README.md) (sibling):

- Section: `## YYYY-MM-DD`
- Entry: `- **[Area]** Decision: <one-line>. Rationale: <optional>.` Optional: `(plan: <name or path>)`

Critic / intent-alignment JSON may be mapped in a later projector version; v1 projects **decision-log prose only**.

---

## Edges JSONL sidecar

Path: `DECISION_EDGES_JSONL` or `<state-dir>/decision-graph-edges.jsonl`.

One JSON object per line:

```json
{"source_id":"d_abc…","target_id":"d_def…","type":"CAUSED"}
```

Aliases accepted: `from`/`to`, `source`/`target`, `relationship_type` for `type`.

Edges whose endpoints are missing after projection are skipped with a warning (not a hard fail). Invalid `type` → hard fail, no DB write.

---

## Non-goals

- Semantica / Neo4j / Rete / Datalog / lakehouse connectors
- Replacing SCP quarantine
- Making Arcforge / LLM-Wiki a graph database
- Second write-primary for operators (do not require SQL to log decisions)

---

## Related

- Brain-map co-access: [BRAIN_MAP_SCHEMA.md](./BRAIN_MAP_SCHEMA.md)
- Program plan: `local-proto/docs/plans/2026-08-12-001-feat-decision-graph-adapt-program-plan.md`
- Comparison: `local-proto/docs/adhoc/2026-08-12-semantica-portfolio-comparison.md`
