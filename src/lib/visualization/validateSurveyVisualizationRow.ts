import type { VisualizationSurveyRow } from '@/lib/types/database';

/**
 * Client-side gate for cohort/constellation viz rows.
 * Sync Session v2 persists null tenure_years / peak_performance / motivation;
 * rejecting those fields drops the entire live cohort after v2 intake.
 */
export function isSurveyVisualizationRow(response: unknown): response is VisualizationSurveyRow {
  if (!response || typeof response !== 'object') return false;
  const r = response as Record<string, unknown>;

  if (!r.attendee || typeof r.attendee !== 'object') return false;
  const attendee = r.attendee as Record<string, unknown>;
  if (typeof attendee.first_name !== 'string') return false;

  if (r.tenure_years != null) {
    if (typeof r.tenure_years !== 'number' || Number.isNaN(r.tenure_years) || r.tenure_years < 0) {
      return false;
    }
  }

  if (r.learning_style != null && typeof r.learning_style !== 'string') return false;
  if (r.shaped_by != null && typeof r.shaped_by !== 'string') return false;
  if (r.peak_performance != null && typeof r.peak_performance !== 'string') return false;
  if (r.motivation != null && typeof r.motivation !== 'string') return false;

  if (typeof r.id !== 'string' || typeof r.attendee_id !== 'string') return false;
  if (typeof r.updated_at !== 'string') return false;

  return true;
}
