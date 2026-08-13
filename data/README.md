# OpenGrimoire `data/` (local only)

This directory holds **gitignored** local SQLite files:

- `decision-graph.sqlite` — decision graph projection (see [DECISION_GRAPH_SCHEMA.md](../docs/DECISION_GRAPH_SCHEMA.md))
- Other app SQLite (alignment / survey) as already used by the server

**Do not commit** `*.sqlite`. Rebuild the decision graph:

```bash
# From MiscRepos (adjust paths)
set DECISION_LOG_PATH=...\.cursor\state\decision-log.md
set DECISION_GRAPH_DB=%CD%\..\OpenGrimoire\data\decision-graph.sqlite
python .cursor\scripts\project_decision_graph.py
```

Markdown `decision-log.md` remains the human-append SSOT.
