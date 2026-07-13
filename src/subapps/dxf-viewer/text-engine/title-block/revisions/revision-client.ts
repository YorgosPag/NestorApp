'use client';

/**
 * ADR-651 Φάση Η — client cache + fetch helpers της ιστορίας αναθεωρήσεων.
 *
 * Ίδιο μοτίβο με το `placeholder-scope-client.ts` (Φάση Β): η **τρέχουσα** αναθεώρηση πρέπει
 * να διαβάζεται **σύγχρονα** τη στιγμή του κλικ / του ghost / της εκτύπωσης (ADR-040: getters,
 * όχι snapshots· μηδέν `await` στο commit path). Άρα φορτώνεται **μία φορά** (idempotent,
 * per-project) και παρκάρεται σε module singleton — μηδέν React state, κανένας subscriber
 * (αλλάζει μόνο όταν ο χρήστης καταχωρεί αναθεώρηση: πολύ χαμηλή συχνότητα).
 *
 * Αποτυχία δικτύου ⇒ **κενή ιστορία**, όχι μπλοκαρισμένη πινακίδα (τα `{{revision.*}}` μένουν
 * κενά, ακριβώς όπως πριν τη Φάση Η).
 *
 * @see ./drawing-revision.service.ts — ο server-only ιδιοκτήτης της ιστορίας
 * @see ../active-title-block.ts — ο καταναλωτής (γεμίζει τα `{{revision.*}}`)
 */

import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import type { PlaceholderScopeRevision } from '../../templates/resolver/scope.types';
import type { TitleBlockLocale } from '../title-block-presets';
import { formatRevisionNumber } from './revision-numbering';
import type { DrawingRevisionSummary, RevisionDiff, RevisionSnapshot } from './revision.types';
import type { AiRevisionChangelog } from '../ai/ai-revision-changelog-schema';

const logger = createModuleLogger('RevisionClient');

const REVISIONS_ENDPOINT = '/api/dxf/revisions';
const CHANGELOG_ENDPOINT = '/api/dxf/text-templates/ai/revision-changelog';

const NO_PROJECT_KEY = '';

let cachedKey: string | null = null;
let cachedRevisions: readonly DrawingRevisionSummary[] = [];
let pending: { readonly key: string; readonly promise: Promise<readonly DrawingRevisionSummary[]> } | null =
  null;

async function requestRevisions(projectId: string): Promise<readonly DrawingRevisionSummary[]> {
  const response = await fetch(`${REVISIONS_ENDPOINT}?projectId=${encodeURIComponent(projectId)}`);
  if (!response.ok) throw new Error(`Revisions request failed: ${response.status}`);
  const payload = (await response.json()) as { readonly revisions?: readonly DrawingRevisionSummary[] };
  return payload.revisions ?? [];
}

/** Φόρτωση + cache της ιστορίας του έργου (idempotent — cached ή in-flight key επαναχρησιμοποιείται). */
export async function loadProjectRevisions(
  projectId?: string,
): Promise<readonly DrawingRevisionSummary[]> {
  const key = projectId ?? NO_PROJECT_KEY;
  if (cachedKey === key) return cachedRevisions;
  if (pending?.key === key) return pending.promise;
  if (!projectId) {
    cachedKey = key;
    cachedRevisions = [];
    return cachedRevisions;
  }

  const promise = requestRevisions(projectId)
    .catch((error: unknown) => {
      logger.warn('Revision history unavailable — title block keeps empty revision fields', {
        projectId,
        error: getErrorMessage(error),
      });
      return [] as readonly DrawingRevisionSummary[];
    })
    .then((revisions) => {
      cachedKey = key;
      cachedRevisions = revisions;
      pending = null;
      return revisions;
    });

  pending = { key, promise };
  return promise;
}

/** Event-time read: όλη η ιστορία (πίνακας αναθεωρήσεων). */
export function getProjectRevisions(): readonly DrawingRevisionSummary[] {
  return cachedRevisions;
}

/** Η **τρέχουσα** αναθεώρηση (η τελευταία καταχωρημένη) — αυτή που τυπώνεται στην πινακίδα. */
export function getCurrentRevision(): DrawingRevisionSummary | null {
  return cachedRevisions.length > 0 ? cachedRevisions[cachedRevisions.length - 1] : null;
}

/**
 * Τα `{{revision.*}}` του **ενεργού** σχεδίου (event-time read) — ο **παραγωγός** που έλειπε:
 * τα placeholders υπήρχαν από το ADR-344, απλώς δεν τα γέμιζε κανείς (ίδιο μοτίβο με το
 * `drawing.sheetNumber` πριν τη Φάση Ζ).
 *
 * `undefined` όταν δεν έχει καταχωρηθεί καμία αναθεώρηση ⇒ ο resolver αφήνει τα πεδία κενά.
 */
export function getActiveRevisionFacts(locale: TitleBlockLocale): PlaceholderScopeRevision | undefined {
  const current = getCurrentRevision();
  if (!current) return undefined;
  return {
    number: formatRevisionNumber(current.number, locale),
    date: new Date(current.issuedAt),
    author: current.authorName,
    description: current.description,
  };
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export interface RevisionChangelogResult {
  readonly diff: RevisionDiff;
  /** `null` ⇒ το AI δεν απάντησε (χωρίς κλειδί/δίκτυο/LLM) — ο χρήστης γράφει την περιγραφή. */
  readonly suggestion: AiRevisionChangelog | null;
}

/** «Τι άλλαξε;» — ο server συγκρίνει με την προηγούμενη έκδοση και το AI το διατυπώνει. */
export async function requestRevisionChangelog(
  projectId: string,
  snapshot: RevisionSnapshot,
  locale: TitleBlockLocale,
): Promise<RevisionChangelogResult | null> {
  try {
    const response = await fetch(CHANGELOG_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, snapshot, locale }),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as Partial<RevisionChangelogResult>;
    return payload.diff ? { diff: payload.diff, suggestion: payload.suggestion ?? null } : null;
  } catch (error) {
    logger.warn('Revision changelog request failed', { error: getErrorMessage(error) });
    return null;
  }
}

/**
 * Καταχώρηση αναθεώρησης (μετά την **έγκριση** του χρήστη). Το cache ανανεώνεται αμέσως ⇒ η
 * επόμενη πινακίδα/ghost/εκτύπωση δείχνει τη νέα αναθεώρηση χωρίς να περιμένει νέο fetch
 * (ίδιο μοτίβο με το `applyStampImageUrl` της Φάσης Ε).
 */
export async function createProjectRevision(
  projectId: string,
  description: string,
  snapshot: RevisionSnapshot,
): Promise<DrawingRevisionSummary | null> {
  try {
    const response = await fetch(REVISIONS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, description, snapshot }),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { readonly revision?: DrawingRevisionSummary };
    if (!payload.revision) return null;

    const others = cachedRevisions.filter((rev) => rev.id !== payload.revision?.id);
    cachedRevisions = [...others, payload.revision].sort((a, b) => a.number - b.number);
    cachedKey = projectId;
    return payload.revision;
  } catch (error) {
    logger.warn('Revision creation failed', { projectId, error: getErrorMessage(error) });
    return null;
  }
}

/** Test seam — reset the singleton between cases. */
export function __resetRevisionsForTests(): void {
  cachedKey = null;
  cachedRevisions = [];
  pending = null;
}
