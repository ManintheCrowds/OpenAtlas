import { describe, expect, it } from 'vitest';
import type { VisualizationSurveyRow } from '@/lib/types/database';
import { processVisualizationData } from './processData';

function row(partial: Partial<VisualizationSurveyRow> & Pick<VisualizationSurveyRow, 'id' | 'attendee_id'>): VisualizationSurveyRow {
  return {
    session_type: 'profile',
    questionnaire_version: 'v2',
    tenure_years: null,
    learning_style: 'visual',
    shaped_by: 'mentor',
    peak_performance: null,
    motivation: null,
    unique_quality: null,
    harness_profile_id: null,
    status: 'pending',
    moderated_at: null,
    test_data: false,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    attendee: { first_name: 'Ada', last_name: null, is_anonymous: false },
    moderation: null,
    ...partial,
  };
}

describe('processVisualizationData', () => {
  it('keeps Sync Session v2 rows that lack tenure_years', () => {
    const { nodes } = processVisualizationData(
      [
        row({ id: 'a', attendee_id: 'att-a' }),
        row({ id: 'b', attendee_id: 'att-b', learning_style: 'auditory' }),
      ],
      {
        mode: 'learning_style',
        filters: {
          yearsCategory: null,
          learningStyle: null,
          shapedBy: null,
          peakPerformance: null,
          motivation: null,
        },
        sortBy: null,
        sortDirection: 'asc',
      }
    );

    expect(nodes).toHaveLength(2);
    expect(nodes.map((n) => n.id).sort()).toEqual(['a', 'b']);
  });

  it('does not connect nodes solely because a mode field is null', () => {
    const { nodes, edges } = processVisualizationData(
      [
        row({ id: 'a', attendee_id: 'att-a' }),
        row({ id: 'b', attendee_id: 'att-b' }),
      ],
      {
        mode: 'peak_performance',
        filters: {
          yearsCategory: null,
          learningStyle: null,
          shapedBy: null,
          peakPerformance: null,
          motivation: null,
        },
        sortBy: null,
        sortDirection: 'asc',
      }
    );

    expect(nodes).toHaveLength(2);
    expect(edges).toHaveLength(0);
  });
});
