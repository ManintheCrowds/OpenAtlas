import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const repositoryMocks = vi.hoisted(() => ({
  createAttendee: vi.fn(),
  createSurveyResponse: vi.fn(),
  getHarnessProfileById: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/lib/storage/repositories/survey', () => ({
  createAttendee: repositoryMocks.createAttendee,
  createSurveyResponse: repositoryMocks.createSurveyResponse,
}));

vi.mock('@/lib/storage/repositories/harness-profiles', () => ({
  getHarnessProfileById: repositoryMocks.getHarnessProfileById,
}));

describe('POST /api/survey', () => {
  const harnessProfileId = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    vi.stubEnv('SURVEY_POST_REQUIRE_TOKEN', 'false');
    vi.stubEnv('SURVEY_POST_CAPTCHA_REQUIRED', 'false');
    vi.stubEnv('TURNSTILE_SECRET_KEY', '');
    repositoryMocks.createAttendee.mockReturnValue({
      id: 'attendee-1',
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'ada@example.com',
      is_anonymous: false,
      created_at: '2026-07-16T00:00:00.000Z',
      updated_at: '2026-07-16T00:00:00.000Z',
    });
    repositoryMocks.createSurveyResponse.mockReturnValue({
      id: 'response-1',
      attendee_id: 'attendee-1',
      session_type: 'profile',
      questionnaire_version: 'v1',
      tenure_years: null,
      learning_style: null,
      shaped_by: null,
      peak_performance: null,
      motivation: null,
      unique_quality: 'Analytical',
      harness_profile_id: null,
      status: 'pending',
      moderated_at: null,
      test_data: false,
      created_at: '2026-07-16T00:00:00.000Z',
      updated_at: '2026-07-16T00:00:00.000Z',
    });
    repositoryMocks.getHarnessProfileById.mockReturnValue({
      id: harnessProfileId,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('persists the validated harness profile selection', async () => {
    const response = await POST(
      new Request('http://localhost/api/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: 'ada@example.com',
          isAnonymous: false,
          sessionType: 'profile',
          questionnaireVersion: 'v1',
          harnessProfileId,
          answers: [{ questionId: 'unique_quality', answer: 'Analytical' }],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(repositoryMocks.createSurveyResponse).toHaveBeenCalledWith(
      expect.objectContaining({ harness_profile_id: harnessProfileId }),
    );
  });

  it('returns 409 when createAttendee hits a duplicate email unique constraint', async () => {
    const { default: Database } = await import('better-sqlite3');
    const err = new Database.SqliteError(
      'UNIQUE constraint failed: attendees.email',
      'SQLITE_CONSTRAINT_UNIQUE'
    );
    repositoryMocks.createAttendee.mockImplementation(() => {
      throw err;
    });

    const response = await POST(
      new Request('http://localhost/api/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: 'Mallory',
          lastName: 'Overwrite',
          email: 'ada@example.com',
          isAnonymous: false,
          sessionType: 'profile',
          questionnaireVersion: 'v1',
          answers: [{ questionId: 'unique_quality', answer: 'Analytical' }],
        }),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      message:
        'An account with this email already exists. Use a different email or submit anonymously.',
    });
    expect(repositoryMocks.createSurveyResponse).not.toHaveBeenCalled();
  });
});
