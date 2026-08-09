import { randomUUID } from 'crypto';
import { and, desc, eq } from 'drizzle-orm';
import {
  attendees,
  moderation,
  peakPerformanceDefinitions,
  surveyResponseIntentCategories,
  surveyResponses,
} from '@/db/schema';
import { getDb, getSqlite } from '@/db/client';
import type {
  AttendeeRow,
  LearningStyle,
  ModerationRow,
  ModerationStatus,
  MotivationType,
  IntentCategory,
  PeakPerformanceDefinitionRow,
  PeakPerformanceType,
  ShapedBy,
  SurveyResponseRow,
  VisualizationSurveyRow,
} from '@/lib/types/database';

function nowIso() {
  return new Date().toISOString();
}

function rowToAttendee(row: typeof attendees.$inferSelect): AttendeeRow {
  return {
    id: row.id,
    first_name: row.firstName,
    last_name: row.lastName,
    email: row.email,
    is_anonymous: row.isAnonymous,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

function rowToSurvey(row: typeof surveyResponses.$inferSelect): SurveyResponseRow {
  return {
    id: row.id,
    attendee_id: row.attendeeId,
    session_type: row.sessionType as SurveyResponseRow['session_type'],
    questionnaire_version: row.questionnaireVersion as SurveyResponseRow['questionnaire_version'],
    tenure_years: row.tenureYears,
    learning_style: row.learningStyle as LearningStyle | null,
    shaped_by: row.shapedBy as ShapedBy | null,
    peak_performance: row.peakPerformance as PeakPerformanceType | null,
    motivation: row.motivation as MotivationType | null,
    unique_quality: row.uniqueQuality,
    harness_profile_id: row.harnessProfileId,
    status: row.status as ModerationStatus,
    moderated_at: row.moderatedAt,
    test_data: row.testData,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export type VisualizationRow = SurveyResponseRow & {
  attendee: {
    first_name: string;
    last_name: string | null;
    is_anonymous: boolean;
  };
  moderation: { status: ModerationStatus }[] | null;
};

export function createAttendee(data: {
  first_name: string;
  last_name?: string;
  email?: string;
  is_anonymous?: boolean;
}): AttendeeRow {
  const db = getDb();
  const ts = nowIso();

  // Do not upsert on email. Duplicate non-anonymous emails must hit the UNIQUE
  // constraint so POST /api/survey can return 409. Silent name overwrite would
  // corrupt attendee PII and attribute later Sync Session responses to the
  // original attendee id (see docs/agent/SYNC_SESSION_HANDOFF.md §7.2).
  const id = randomUUID();
  db.insert(attendees)
    .values({
      id,
      firstName: data.first_name,
      lastName: data.last_name ?? null,
      email: data.email ?? null,
      isAnonymous: data.is_anonymous ?? false,
      createdAt: ts,
      updatedAt: ts,
    })
    .run();
  const row = db.select().from(attendees).where(eq(attendees.id, id)).get();
  if (!row) throw new Error('Attendee insert failed');
  return rowToAttendee(row);
}

export function createSurveyResponse(data: {
  attendee_id: string;
  session_type?: SurveyResponseRow['session_type'];
  questionnaire_version?: SurveyResponseRow['questionnaire_version'];
  tenure_years?: number;
  learning_style?: LearningStyle | null;
  shaped_by?: ShapedBy | null;
  peak_performance?: PeakPerformanceType | null;
  motivation?: MotivationType | null;
  unique_quality?: string;
  harness_profile_id?: string | null;
  test_data?: boolean;
  categories?: { category: IntentCategory; content: string }[];
}): SurveyResponseRow {
  const db = getDb();
  const sqlite = getSqlite();
  const id = randomUUID();
  const ts = nowIso();

  // Keep the parent response and intent categories atomic. Sync Session v2 stores
  // session_intent/context/constraints in categories; a mid-loop failure must not
  // leave an orphan survey_responses row that looks "saved" while omitting payload.
  const insertResponse = sqlite.transaction(() => {
    db.insert(surveyResponses)
      .values({
        id,
        attendeeId: data.attendee_id,
        sessionType: data.session_type ?? 'profile',
        questionnaireVersion: data.questionnaire_version ?? 'v1',
        tenureYears: data.tenure_years ?? null,
        learningStyle: data.learning_style ?? null,
        shapedBy: data.shaped_by ?? null,
        peakPerformance: data.peak_performance ?? null,
        motivation: data.motivation ?? null,
        uniqueQuality: data.unique_quality ?? null,
        harnessProfileId: data.harness_profile_id ?? null,
        status: 'pending',
        moderatedAt: null,
        testData: data.test_data ?? false,
        createdAt: ts,
        updatedAt: ts,
      })
      .run();

    if (data.categories && data.categories.length > 0) {
      for (const category of data.categories) {
        db.insert(surveyResponseIntentCategories)
          .values({
            id: randomUUID(),
            responseId: id,
            category: category.category,
            content: category.content,
            createdAt: ts,
            updatedAt: ts,
          })
          .onConflictDoUpdate({
            target: [surveyResponseIntentCategories.responseId, surveyResponseIntentCategories.category],
            set: { content: category.content, updatedAt: ts },
          })
          .run();
      }
    }

    const row = db.select().from(surveyResponses).where(eq(surveyResponses.id, id)).get();
    if (!row) throw new Error('Survey response insert failed');
    return rowToSurvey(row);
  });

  return insertResponse();
}

export function getPeakPerformanceDefinitions(): PeakPerformanceDefinitionRow[] {
  const db = getDb();
  const rows = db
    .select()
    .from(peakPerformanceDefinitions)
    .orderBy(peakPerformanceDefinitions.type)
    .all();
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    description: r.description,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  }));
}

export type ModerationQueueRow = SurveyResponseRow & {
  attendee: {
    first_name: string;
    last_name: string | null;
    is_anonymous: boolean;
  };
  moderation: { status: ModerationStatus; notes: string | null }[] | null;
};

export function getModerationQueue(): ModerationQueueRow[] {
  const sqlite = getSqlite();
  const rows = sqlite
    .prepare(
      `SELECT sr.*, a.first_name AS afn, a.last_name AS aln, a.is_anonymous AS aan
       FROM survey_responses sr
       JOIN attendees a ON a.id = sr.attendee_id
       WHERE sr.unique_quality IS NOT NULL AND TRIM(sr.unique_quality) != ''
       ORDER BY sr.created_at DESC`
    )
    .all() as Record<string, unknown>[];

  const out: ModerationQueueRow[] = [];
  for (const raw of rows) {
    const id = String(raw.id);
    const mods = sqlite
      .prepare(`SELECT status, notes FROM moderation WHERE response_id = ?`)
      .all(id) as { status: string; notes: string | null }[];

    const sr: SurveyResponseRow = {
      id,
      attendee_id: String(raw.attendee_id),
      session_type: raw.session_type == null ? 'profile' : (String(raw.session_type) as SurveyResponseRow['session_type']),
      questionnaire_version:
        raw.questionnaire_version == null
          ? 'v1'
          : (String(raw.questionnaire_version) as SurveyResponseRow['questionnaire_version']),
      tenure_years: raw.tenure_years == null ? null : Number(raw.tenure_years),
      learning_style: raw.learning_style as LearningStyle | null,
      shaped_by: raw.shaped_by as ShapedBy | null,
      peak_performance: raw.peak_performance as PeakPerformanceType | null,
      motivation: raw.motivation as MotivationType | null,
      unique_quality: raw.unique_quality == null ? null : String(raw.unique_quality),
      harness_profile_id: raw.harness_profile_id == null ? null : String(raw.harness_profile_id),
      status: raw.status as ModerationStatus,
      moderated_at: raw.moderated_at == null ? null : String(raw.moderated_at),
      test_data: Boolean(raw.test_data),
      created_at: String(raw.created_at),
      updated_at: String(raw.updated_at),
    };

    const moderationArr =
      mods.length > 0
        ? mods.map((m) => ({
            status: m.status as ModerationStatus,
            notes: m.notes,
          }))
        : null;

    out.push({
      ...sr,
      attendee: {
        first_name: String(raw.afn),
        last_name: raw.aln == null ? null : String(raw.aln),
        is_anonymous: Boolean(raw.aan),
      },
      moderation: moderationArr,
    });
  }

  return out.filter((response) => {
    if (!response.moderation || response.moderation.length === 0) return true;
    return response.moderation[0]?.status === 'pending';
  });
}

export function updateModerationStatus(
  responseId: string,
  data: {
    status: ModerationStatus;
    moderator_id: string;
    notes?: string;
  }
): ModerationRow {
  const sqlite = getSqlite();
  const ts = nowIso();
  const modId = randomUUID();

  sqlite
    .prepare(
      `INSERT INTO moderation (id, response_id, field_name, status, moderator_id, notes, created_at, updated_at)
       VALUES (?, ?, 'unique_quality', ?, ?, ?, ?, ?)
       ON CONFLICT(response_id, field_name) DO UPDATE SET
         status = excluded.status,
         moderator_id = excluded.moderator_id,
         notes = excluded.notes,
         updated_at = excluded.updated_at`
    )
    .run(modId, responseId, data.status, data.moderator_id, data.notes ?? null, ts, ts);

  sqlite
    .prepare(
      `UPDATE survey_responses SET status = ?, moderated_at = ?, updated_at = ? WHERE id = ?`
    )
    .run(data.status, ts, ts, responseId);

  const row = sqlite
    .prepare(`SELECT * FROM moderation WHERE response_id = ? AND field_name = 'unique_quality'`)
    .get(responseId) as Record<string, unknown>;

  return {
    id: String(row.id),
    response_id: String(row.response_id),
    field_name: 'unique_quality',
    status: row.status as ModerationStatus,
    moderator_id: String(row.moderator_id),
    notes: row.notes == null ? null : String(row.notes),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

/**
 * @param showTestData true/false filters rows; `null` returns all rows (for client-side test_data filtering).
 */
export function getVisualizationData(showTestData: boolean | null): VisualizationSurveyRow[] {
  const db = getDb();
  const filter =
    showTestData === true
      ? eq(surveyResponses.testData, true)
      : showTestData === false
        ? eq(surveyResponses.testData, false)
        : undefined;

  const base = db.select().from(surveyResponses).orderBy(desc(surveyResponses.createdAt));
  const srs = (filter ? base.where(filter) : base).all();

  const sqlite = getSqlite();
  const out: VisualizationSurveyRow[] = [];
  for (const sr of srs) {
    const a = db.select().from(attendees).where(eq(attendees.id, sr.attendeeId)).get();
    if (!a) continue;
    const mods = sqlite
      .prepare(`SELECT status FROM moderation WHERE response_id = ?`)
      .all(sr.id) as { status: string }[];
    const moderationShape =
      mods.length > 0 ? mods.map((m) => ({ status: m.status as ModerationStatus })) : null;
    out.push({
      ...rowToSurvey(sr),
      attendee: {
        first_name: a.firstName,
        last_name: a.lastName,
        is_anonymous: a.isAnonymous,
      },
      moderation: moderationShape,
    });
  }
  return out;
}

export function getApprovedUniqueQualities(): {
  unique_quality: string | null;
  attendee: { first_name: string; last_name: string | null; is_anonymous: boolean };
}[] {
  const sqlite = getSqlite();
  const rows = sqlite
    .prepare(
      `SELECT sr.unique_quality, a.first_name AS afn, a.last_name AS aln, a.is_anonymous AS aan
       FROM survey_responses sr
       JOIN attendees a ON a.id = sr.attendee_id
       INNER JOIN moderation m ON m.response_id = sr.id AND m.field_name = 'unique_quality'
       WHERE m.status = 'approved'
         AND sr.unique_quality IS NOT NULL AND TRIM(sr.unique_quality) != ''
       ORDER BY m.created_at DESC`
    )
    .all() as { unique_quality: string; afn: string; aln: string | null; aan: number }[];

  return rows
    .filter((r) => r.unique_quality && r.unique_quality.trim() !== '')
    .map((r) => ({
      unique_quality: r.unique_quality,
      attendee: {
        first_name: r.afn,
        last_name: r.aln,
        is_anonymous: Boolean(r.aan),
      },
    }));
}

export function getSurveyResponseById(id: string): SurveyResponseRow | null {
  const row = getDb().select().from(surveyResponses).where(eq(surveyResponses.id, id)).get();
  return row ? rowToSurvey(row) : null;
}

export function debugSurveyResponses() {
  const sqlite = getSqlite();
  const allResponses = sqlite
    .prepare(`SELECT * FROM survey_responses ORDER BY created_at DESC`)
    .all();
  const withQuality = sqlite
    .prepare(
      `SELECT * FROM survey_responses WHERE unique_quality IS NOT NULL AND TRIM(unique_quality) != '' ORDER BY created_at DESC`
    )
    .all();
  const moderationRecords = sqlite
    .prepare(`SELECT * FROM moderation ORDER BY created_at DESC`)
    .all();
  console.log('All survey responses:', allResponses);
  console.log('Total responses:', allResponses?.length ?? 0);
  console.log('Responses with unique_quality:', withQuality);
  console.log('Moderation records:', moderationRecords);
  return { allResponses, withQuality, moderationRecords };
}
