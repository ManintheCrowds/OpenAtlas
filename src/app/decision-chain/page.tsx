'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Decision = {
  id: string;
  date: string | null;
  area: string | null;
  decision: string;
  rationale: string | null;
};

type Edge = { source_id: string; target_id: string; type: string };

type Callout = { id: string; summary: string; paths?: string[] };

type GraphPayload = {
  status: string;
  message?: string;
  decisions: Decision[];
  edges: Edge[];
  callouts?: Callout[];
  meta?: Record<string, string>;
};

/**
 * PURPOSE: Decision-chain pane with timeline scrub + conflict callout slots (U4/U5)
 */
export default function DecisionChainPage() {
  const [data, setData] = useState<GraphPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chain, setChain] = useState<Decision[]>([]);
  const [chainEdges, setChainEdges] = useState<Edge[]>([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/decision-graph', { cache: 'no-store' });
      const json = (await res.json()) as GraphPayload;
      if (res.status >= 500) {
        setError(json.message ?? 'Failed to load decision graph');
        setData(json);
        return;
      }
      setData(json);
      if (json.decisions?.length && !selectedId) {
        setSelectedId(json.decisions[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [selectedId]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setChain([]);
      setChainEdges([]);
      return;
    }
    void (async () => {
      const res = await fetch(`/api/decision-graph?id=${encodeURIComponent(selectedId)}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      setChain(json.chain ?? []);
      setChainEdges(json.edges ?? []);
    })();
  }, [selectedId]);

  const datesPresent = useMemo(() => {
    const dates = (data?.decisions ?? [])
      .map((d) => d.date)
      .filter((d): d is string => Boolean(d));
    return dates.length > 0;
  }, [data]);

  const filtered = useMemo(() => {
    const list = data?.decisions ?? [];
    if (!datesPresent) return list;
    return list.filter((d) => {
      if (!d.date) return true;
      if (fromDate && d.date < fromDate) return false;
      if (toDate && d.date > toDate) return false;
      return true;
    });
  }, [data, fromDate, toDate, datesPresent]);

  const callouts = data?.callouts ?? [];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold">Decision chain</h1>
        <Link href="/brain-map" className="text-sm underline">
          Context atlas / brain-map
        </Link>
      </header>

      {error ? (
        <p className="rounded border border-red-400 bg-red-50 p-3 text-sm text-red-900" role="alert">
          {error}
        </p>
      ) : null}

      {data?.status === 'missing' ? (
        <p className="rounded border border-amber-400 bg-amber-50 p-3 text-sm">
          {data.message ?? 'No decision graph yet.'} Atlas still works at{' '}
          <Link href="/brain-map" className="underline">
            /brain-map
          </Link>
          .
        </p>
      ) : null}

      <section aria-label="Conflict and entity callouts" className="rounded border p-3">
        <h2 className="mb-2 text-sm font-medium">Callouts</h2>
        {callouts.length === 0 ? (
          <p className="text-sm opacity-70">No conflict flags (slot ready for Phase D).</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {callouts.map((c) => (
              <li key={c.id}>
                {c.summary}
                {c.paths?.length ? (
                  <span className="opacity-70"> — {c.paths.join(', ')}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Timeline scrub" className="flex flex-wrap items-end gap-3 rounded border p-3">
        <h2 className="w-full text-sm font-medium">Timeline</h2>
        {!datesPresent ? (
          <p className="text-sm opacity-70">No dates on decisions — scrub disabled; showing all.</p>
        ) : (
          <>
            <label className="text-sm">
              From{' '}
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="ml-1 border px-1"
              />
            </label>
            <label className="text-sm">
              To{' '}
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="ml-1 border px-1"
              />
            </label>
          </>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section aria-label="Decisions" className="rounded border p-3">
          <h2 className="mb-2 text-sm font-medium">Decisions ({filtered.length})</h2>
          <ul className="max-h-96 space-y-2 overflow-auto text-sm">
            {filtered.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  className={`w-full rounded px-2 py-1 text-left hover:bg-black/5 ${
                    selectedId === d.id ? 'bg-black/10 font-medium' : ''
                  }`}
                  onClick={() => setSelectedId(d.id)}
                >
                  <span className="opacity-70">{d.date ?? '—'}</span> [{d.area}] {d.decision}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Selected chain" className="rounded border p-3">
          <h2 className="mb-2 text-sm font-medium">Chain</h2>
          {chain.length === 0 ? (
            <p className="text-sm opacity-70">Select a decision to see causal ancestry.</p>
          ) : (
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              {chain.map((d) => (
                <li key={d.id}>
                  <strong>[{d.area}]</strong> {d.decision}
                  {d.rationale ? <div className="opacity-70">Rationale: {d.rationale}</div> : null}
                </li>
              ))}
            </ol>
          )}
          {chainEdges.length > 0 ? (
            <ul className="mt-3 space-y-1 text-xs opacity-80">
              {chainEdges.map((e, i) => (
                <li key={`${e.source_id}-${e.target_id}-${e.type}-${i}`}>
                  {e.type}: {e.source_id.slice(0, 10)}… → {e.target_id.slice(0, 10)}…
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </div>
  );
}
