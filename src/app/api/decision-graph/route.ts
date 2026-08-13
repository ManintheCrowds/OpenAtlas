import { NextResponse } from 'next/server';
import { readDecisionGraph, traceDecisionChain } from '@/lib/decision-graph/read';

/**
 * GET /api/decision-graph — list decisions/edges or ?id= for a chain.
 * Reads gitignored data/decision-graph.sqlite when present.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (id) {
    const result = traceDecisionChain(id);
    if (result.status === 'missing') {
      return NextResponse.json(
        {
          status: 'missing',
          message: 'No decision-graph.sqlite yet. Run project_decision_graph.py',
          chain: [],
          edges: [],
        },
        { status: 200 }
      );
    }
    if (result.status === 'unknown') {
      return NextResponse.json(
        { status: 'unknown', message: 'Unknown decision id', chain: [], edges: [] },
        { status: 404 }
      );
    }
    if (result.status === 'error') {
      return NextResponse.json(
        { status: 'error', message: 'Corrupt or unreadable decision graph', error: result.error },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { status: 'ok', chain: result.chain, edges: result.edges },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const graph = readDecisionGraph();
  if (graph.status === 'error') {
    return NextResponse.json(
      {
        status: 'error',
        message: 'Corrupt or unreadable decision graph',
        error: graph.error,
        decisions: [],
        edges: [],
        callouts: [],
      },
      { status: 500 }
    );
  }
  return NextResponse.json(
    {
      status: graph.status,
      decisions: graph.decisions,
      edges: graph.edges,
      meta: graph.meta,
      callouts: graph.callouts,
      message:
        graph.status === 'missing'
          ? 'No decision-graph.sqlite yet. Run MiscRepos/.cursor/scripts/project_decision_graph.py'
          : undefined,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
