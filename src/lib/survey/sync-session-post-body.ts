import { SYNC_SESSION_QUESTIONNAIRE_VERSION } from '@/lib/survey/sync-session-v2-questions';
import type { SyncSessionFormData } from '@/lib/hooks/types';

export type SyncSessionPostBody = {
  firstName: string;
  lastName: string;
  email: string;
  isAnonymous: boolean;
  sessionType: 'profile';
  questionnaireVersion: string;
  answers: Array<{ questionId: string; answer: string }>;
  harnessProfileId?: string;
  turnstileToken?: string;
};

/** Body shape for `POST /api/survey` from the Sync Session UI. */
export function buildSyncSessionPostBody(
  formData: SyncSessionFormData,
  opts?: { turnstileToken?: string | null }
): SyncSessionPostBody {
  const lastName = formData.last_name?.trim() || '—';
  const answers = [
    { questionId: 'session_intent', answer: formData.session_intent ?? '' },
    { questionId: 'session_context', answer: formData.session_context ?? '' },
    { questionId: 'shaped_by', answer: formData.shaped_by ?? '' },
    { questionId: 'working_style', answer: formData.working_style ?? '' },
    { questionId: 'constraints', answer: formData.constraints ?? '' },
    { questionId: 'unique_quality', answer: formData.unique_quality ?? '' },
  ];
  const body: SyncSessionPostBody = {
    firstName: formData.first_name,
    lastName,
    email: formData.is_anonymous ? '' : formData.email ?? '',
    isAnonymous: formData.is_anonymous,
    sessionType: 'profile',
    questionnaireVersion: SYNC_SESSION_QUESTIONNAIRE_VERSION,
    answers,
    harnessProfileId: formData.harness_profile_id,
  };
  const token = opts?.turnstileToken?.trim();
  if (token) {
    body.turnstileToken = token;
  }
  return body;
}
