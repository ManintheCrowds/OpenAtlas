import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_DB_PATH = process.env.OPENGRIMOIRE_DB_PATH;

let tempDir: string | null = null;

vi.mock('server-only', () => ({}));

afterEach(() => {
  if (ORIGINAL_DB_PATH === undefined) {
    delete process.env.OPENGRIMOIRE_DB_PATH;
  } else {
    process.env.OPENGRIMOIRE_DB_PATH = ORIGINAL_DB_PATH;
  }
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
  vi.resetModules();
});

async function loadSurveyModules(dbPath: string) {
  vi.resetModules();
  process.env.OPENGRIMOIRE_DB_PATH = dbPath;
  const [{ getSqlite }, { createAttendee, createSurveyResponse }] = await Promise.all([
    import('@/db/client'),
    import('./survey'),
  ]);
  return { getSqlite, createAttendee, createSurveyResponse };
}

describe('createAttendee', () => {
  it('rejects a second non-anonymous attendee with the same email without overwriting the first', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opengrimoire-attendee-email-'));
    const dbPath = path.join(tempDir, 'opengrimoire.sqlite');
    const { getSqlite, createAttendee } = await loadSurveyModules(dbPath);
    const sqlite = getSqlite();

    const first = createAttendee({
      first_name: 'Alice',
      last_name: 'Original',
      email: 'shared@example.com',
      is_anonymous: false,
    });

    expect(() =>
      createAttendee({
        first_name: 'Mallory',
        last_name: 'Overwrite',
        email: 'shared@example.com',
        is_anonymous: false,
      })
    ).toThrow(/UNIQUE constraint failed: attendees\.email/);

    const row = sqlite
      .prepare(`SELECT id, first_name, last_name, email FROM attendees WHERE email = ?`)
      .get('shared@example.com') as {
      id: string;
      first_name: string;
      last_name: string | null;
      email: string;
    };

    expect(row.id).toBe(first.id);
    expect(row.first_name).toBe('Alice');
    expect(row.last_name).toBe('Original');
    expect(
      (sqlite.prepare(`SELECT COUNT(*) AS n FROM attendees`).get() as { n: number }).n
    ).toBe(1);

    sqlite.close();
  });
});

describe('createSurveyResponse', () => {
  it('rolls back the parent response when a category insert fails mid-write', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opengrimoire-survey-'));
    const dbPath = path.join(tempDir, 'opengrimoire.sqlite');
    const { getSqlite, createAttendee, createSurveyResponse } = await loadSurveyModules(dbPath);

    const sqlite = getSqlite();
    const attendee = createAttendee({
      first_name: 'Ada',
      last_name: 'Lovelace',
      is_anonymous: true,
    });

    // Fail on the second category insert so a non-transactional write would leave
    // survey_responses (and possibly one category) committed while the API returns 500.
    sqlite.exec(`
      CREATE TRIGGER fail_second_category
      BEFORE INSERT ON survey_response_intent_categories
      WHEN (SELECT COUNT(*) FROM survey_response_intent_categories) >= 1
      BEGIN
        SELECT RAISE(ABORT, 'forced category failure');
      END;
    `);

    expect(() =>
      createSurveyResponse({
        attendee_id: attendee.id,
        session_type: 'profile',
        questionnaire_version: 'v2',
        unique_quality: 'Ship OG-HV',
        categories: [
          { category: 'signals', content: 'Ship OG-HV' },
          { category: 'needs', content: 'Local dev only' },
          { category: 'constraints', content: 'No prod secrets' },
        ],
      })
    ).toThrow(/forced category failure/);

    const responseCount = sqlite.prepare('SELECT COUNT(*) AS n FROM survey_responses').get() as {
      n: number;
    };
    const categoryCount = sqlite
      .prepare('SELECT COUNT(*) AS n FROM survey_response_intent_categories')
      .get() as { n: number };

    expect(responseCount.n).toBe(0);
    expect(categoryCount.n).toBe(0);

    sqlite.close();
  });

  it('persists response and categories together on success', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opengrimoire-survey-ok-'));
    const dbPath = path.join(tempDir, 'opengrimoire.sqlite');
    const { getSqlite, createAttendee, createSurveyResponse } = await loadSurveyModules(dbPath);

    const sqlite = getSqlite();
    const attendee = createAttendee({
      first_name: 'Grace',
      last_name: 'Hopper',
      is_anonymous: true,
    });

    const response = createSurveyResponse({
      attendee_id: attendee.id,
      session_type: 'profile',
      questionnaire_version: 'v2',
      unique_quality: 'Clarify agent context',
      categories: [
        { category: 'signals', content: 'Clarify agent context' },
        { category: 'needs', content: 'Local SQLite' },
        { category: 'constraints', content: 'No secrets in prompts' },
      ],
    });

    const categories = sqlite
      .prepare(
        `SELECT category, content FROM survey_response_intent_categories
         WHERE response_id = ? ORDER BY category`
      )
      .all(response.id) as { category: string; content: string }[];

    expect(categories).toEqual([
      { category: 'constraints', content: 'No secrets in prompts' },
      { category: 'needs', content: 'Local SQLite' },
      { category: 'signals', content: 'Clarify agent context' },
    ]);

    sqlite.close();
  });
});
