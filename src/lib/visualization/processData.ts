import { Vector3 } from 'three';
import type { NodeData, EdgeData, YearsCategory } from '@/types/visualization';
import type { VisualizationSurveyRow } from '@/lib/types/database';

interface ProcessOptions {
  mode: 'learning_style' | 'shaped_by' | 'peak_performance' | 'motivation';
  filters: {
    yearsCategory: YearsCategory | null;
    learningStyle: VisualizationSurveyRow['learning_style'] | null;
    shapedBy: VisualizationSurveyRow['shaped_by'] | null;
    peakPerformance: VisualizationSurveyRow['peak_performance'] | null;
    motivation: VisualizationSurveyRow['motivation'] | null;
  };
  sortBy: 'years' | 'connections' | null;
  sortDirection: 'asc' | 'desc';
}

const getYearsCategory = (years: number): YearsCategory => {
  if (years >= 0 && years <= 5) return '0-5';
  if (years >= 6 && years <= 10) return '6-10';
  if (years >= 11 && years <= 15) return '11-15';
  if (years >= 16 && years <= 20) return '16-20';
  return '20+';
};

const getNodeColor = (yearsCategory: YearsCategory): string => {
  const colors = {
    '0-5': '#FFB6C1', // Light pink
    '6-10': '#87CEEB', // Sky blue
    '11-15': '#98FB98', // Pale green
    '16-20': '#DDA0DD', // Plum
    '20+': '#F0E68C', // Khaki
  };
  return colors[yearsCategory];
};

const calculateNodePosition = (index: number, total: number): Vector3 => {
  const radius = 5;
  const angle = (index / total) * Math.PI * 2;
  return new Vector3(
    Math.cos(angle) * radius,
    Math.sin(angle) * radius,
    0
  );
};

const findConnections = (
  response: VisualizationSurveyRow,
  allResponses: VisualizationSurveyRow[],
  mode: ProcessOptions['mode']
): string[] => {
  return allResponses
    .filter((other) => {
      if (other.id === response.id) return false;
      // Sync Session v2 leaves peak_performance/motivation null — do not treat null===null as a link.
      if (response[mode] == null || other[mode] == null) return false;
      return other[mode] === response[mode];
    })
    .map((other) => other.id);
};

function isValidNode(
  response: VisualizationSurveyRow
): response is VisualizationSurveyRow & { attendee: NonNullable<VisualizationSurveyRow['attendee']> } {
  // Tenure is optional for Sync Session v2; constellation still needs an attendee to render.
  return Boolean(response.attendee);
}

export const processVisualizationData = (
  data: VisualizationSurveyRow[],
  options: ProcessOptions
): { nodes: NodeData[]; edges: EdgeData[] } => {
  let filteredData = data.filter((response) => {
    if (
      options.filters.yearsCategory &&
      (typeof response.tenure_years !== 'number' ||
        getYearsCategory(response.tenure_years as number) !== options.filters.yearsCategory)
    ) {
      return false;
    }
    if (options.filters.learningStyle && response.learning_style !== options.filters.learningStyle) {
      return false;
    }
    if (options.filters.shapedBy && response.shaped_by !== options.filters.shapedBy) {
      return false;
    }
    if (options.filters.peakPerformance && response.peak_performance !== options.filters.peakPerformance) {
      return false;
    }
    if (options.filters.motivation && response.motivation !== options.filters.motivation) {
      return false;
    }
    return true;
  });

  if (options.sortBy) {
    filteredData.sort((a, b) => {
      const aValue =
        options.sortBy === 'years' ? (a.tenure_years ?? 0) : findConnections(a, filteredData, options.mode).length;
      const bValue =
        options.sortBy === 'years' ? (b.tenure_years ?? 0) : findConnections(b, filteredData, options.mode).length;
      return options.sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    });
  }

  const validResponses = filteredData.filter(isValidNode);
  const nodes: NodeData[] = validResponses.map((response, index) => {
    // NodeData.tenure_years is numeric for layout/color; null v2 tenure buckets as 0-5
    // (same fallback chord/alluvial already use via `tenure_years || 0`).
    const tenure_years = typeof response.tenure_years === 'number' ? response.tenure_years : 0;
    const yearsCategory = getYearsCategory(tenure_years);
    const connections = findConnections(response, filteredData, options.mode);
    return {
      id: response.id,
      position: calculateNodePosition(index, validResponses.length),
      attendee: response.attendee,
      tenure_years,
      yearsCategory,
      learning_style: response.learning_style,
      shaped_by: response.shaped_by,
      peak_performance: response.peak_performance,
      motivation: response.motivation,
      unique_quality: response.unique_quality,
      connections,
      opacity: 1,
      scale: 1,
    };
  });
  console.log('Filtered out nodes without attendee:', filteredData.length - nodes.length);

  const edges: EdgeData[] = [];
  const edgeMap = new Set<string>();

  nodes.forEach((node) => {
    node.connections.forEach((targetId) => {
      const edgeId = [node.id, targetId].sort().join('-');
      if (!edgeMap.has(edgeId)) {
        edgeMap.add(edgeId);
        edges.push({
          id: edgeId,
          source: node.id,
          target: targetId,
          strength: 1,
          opacity: 0.5,
        });
      }
    });
  });

  return { nodes, edges };
};
