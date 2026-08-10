import { describe, expect, it } from 'vitest';
import { isSurveyVisualizationRow } from './validateSurveyVisualizationRow';

const baseAttendee = {
  first_name: 'Ada',
  last_name: 'Lovelace',
  is_anonymous: false,
};

describe('isSurveyVisualizationRow', () => {
  it('accepts Sync Session v2 rows with null v1-only fields', () => {
    expect(
      isSurveyVisualizationRow({
        id: 'resp-1',
        attendee_id: 'att-1',
        session_type: 'profile',
        questionnaire_version: 'v2',
        tenure_years: null,
        learning_style: 'visual',
        shaped_by: 'mentor',
        peak_performance: null,
        motivation: null,
        unique_quality: 'Builds bridges',
        harness_profile_id: null,
        status: 'pending',
        moderated_at: null,
        test_data: false,
        created_at: '2026-08-01T00:00:00Z',
        updated_at: '2026-08-01T00:00:00Z',
        attendee: baseAttendee,
        moderation: null,
      })
    ).toBe(true);
  });

  it('still accepts classic v1 rows with numeric tenure', () => {
    expect(
      isSurveyVisualizationRow({
        id: 'resp-2',
        attendee_id: 'att-2',
        session_type: 'profile',
        questionnaire_version: 'v1',
        tenure_years: 7,
        learning_style: 'kinesthetic',
        shaped_by: 'peer',
        peak_performance: 'Introvert, Morning',
        motivation: 'autonomy',
        unique_quality: 'Focus',
        harness_profile_id: null,
        status: 'approved',
        moderated_at: null,
        test_data: false,
        created_at: '2026-08-01T00:00:00Z',
        updated_at: '2026-08-01T00:00:00Z',
        attendee: baseAttendee,
        moderation: null,
      })
    ).toBe(true);
  });

  it('rejects negative tenure and missing attendee', () => {
    expect(
      isSurveyVisualizationRow({
        id: 'resp-3',
        attendee_id: 'att-3',
        tenure_years: -1,
        updated_at: '2026-08-01T00:00:00Z',
        attendee: baseAttendee,
      })
    ).toBe(false);

    expect(
      isSurveyVisualizationRow({
        id: 'resp-4',
        attendee_id: 'att-4',
        tenure_years: null,
        updated_at: '2026-08-01T00:00:00Z',
      })
    ).toBe(false);
  });
});
