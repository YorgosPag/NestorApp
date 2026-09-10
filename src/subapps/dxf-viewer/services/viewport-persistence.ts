/**
 * viewport-persistence.ts — Viewport State Persistence SSoT (ADR-400).
 *
 * Restores the user's camera (pan/zoom) + active floor on page refresh instead
 * of always re-running fit-to-view. Industry pattern (Figma / Google Maps /
 * Autodesk Forge): the view lives in the URL as a shareable deep-link, with a
 * per-document localStorage fallback when the query string is absent.
 *
 * URL schema:  /dxf/viewer?s=<scale>&ox=<offsetX>&oy=<offsetY>&lvl=<levelId>
 *
 * ADR-040 compliance: writes go through `window.history.replaceState` — no React
 * re-render and no Next router remount, so the pan/zoom hot path stays at 60fps.
 * Reads use `window.location.search` (the page is already `ssr:false`), so no
 * Next `useSearchParams`/`<Suspense>` coupling is introduced.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-400-viewport-state-persistence.md
 */

import { currentSearchParams, replaceUrlSearchParams } from '@/lib/url-query-state';
import type { ViewTransform } from '../rendering/types/Types';
import {
  STORAGE_KEYS,
  storageGet,
  storageSet,
  storageRemove,
} from '../utils/storage-utils';

/** Short URL query keys (kept terse so shared links stay compact). */
const URL_KEYS = { scale: 's', offsetX: 'ox', offsetY: 'oy', level: 'lvl', building: 'bldg' } as const;

/** Significant figures retained for the scale factor in URL/storage. */
const SCALE_SIG_FIGS = 5;

export interface PersistedViewport {
  /** Camera transform (pan/zoom). */
  readonly transform: ViewTransform;
  /** Active floor's level id, or null when not applicable. */
  readonly levelId: string | null;
}

// ─── Guards ──────────────────────────────────────────────────────────────────

/** Shared finite-number guard (reused by the 3D `camera3d-persistence` sibling). */
export function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

/** A transform is restorable only when all components are finite and scale > 0. */
function isValidTransform(
  t: Partial<ViewTransform> | null | undefined,
): t is ViewTransform {
  return (
    !!t &&
    isFiniteNumber(t.scale) &&
    t.scale > 0 &&
    isFiniteNumber(t.offsetX) &&
    isFiniteNumber(t.offsetY)
  );
}

// ─── Rounding (keep URL/storage payloads small + stable) ─────────────────────

/** Round a scalar to `SCALE_SIG_FIGS` (5) significant figures — shared by the 2D scale and
 *  the 3D camera zoom (`camera3d-persistence`) so the rounding rule has ONE home. */
export function roundToSignificantFigures(value: number): number {
  return Number(value.toPrecision(SCALE_SIG_FIGS));
}
function roundScale(scale: number): number {
  return roundToSignificantFigures(scale);
}

function roundOffset(value: number): number {
  return Math.round(value);
}

// ─── URL serialization ───────────────────────────────────────────────────────

/**
 * Write the viewport keys onto an existing params object, in place.
 *
 * The ONE place that decides which keys carry the viewport and how each is
 * rounded. `serializeViewportToParams` (copy) and `writeViewportToUrl` (live URL)
 * both delegate here — they used to carry line-for-line twins of these four
 * `set`s, so a new key or a rounding change had to be remembered twice.
 */
function applyViewportToParams(
  params: URLSearchParams,
  transform: ViewTransform,
  levelId: string | null,
): void {
  params.set(URL_KEYS.scale, String(roundScale(transform.scale)));
  params.set(URL_KEYS.offsetX, String(roundOffset(transform.offsetX)));
  params.set(URL_KEYS.offsetY, String(roundOffset(transform.offsetY)));
  if (levelId) params.set(URL_KEYS.level, levelId);
  else params.delete(URL_KEYS.level);
}

/**
 * Merge the viewport state into a (copy of the) base search params, preserving
 * any unrelated query keys already present.
 */
export function serializeViewportToParams(
  transform: ViewTransform,
  levelId: string | null,
  base?: URLSearchParams,
): URLSearchParams {
  const params = new URLSearchParams(base ? base.toString() : undefined);
  applyViewportToParams(params, transform, levelId);
  return params;
}

/** Parse + validate viewport state from search params. Missing/invalid → omitted. */
export function parseViewportFromParams(
  params: URLSearchParams,
): Partial<PersistedViewport> {
  const candidate: ViewTransform = {
    scale: Number(params.get(URL_KEYS.scale)),
    offsetX: Number(params.get(URL_KEYS.offsetX)),
    offsetY: Number(params.get(URL_KEYS.offsetY)),
  };
  const levelId = params.get(URL_KEYS.level);
  const result: { -readonly [K in keyof PersistedViewport]?: PersistedViewport[K] } = {};
  // Reject unless ALL three transform components are present + valid.
  if (
    params.has(URL_KEYS.scale) &&
    params.has(URL_KEYS.offsetX) &&
    params.has(URL_KEYS.offsetY) &&
    isValidTransform(candidate)
  ) {
    result.transform = candidate;
  }
  if (levelId) result.levelId = levelId;
  return result;
}

/**
 * Live URL search params + the no-navigation `replaceState` writer.
 *
 * These moved to `@/lib/url-query-state` when the Contacts page adopted the same
 * URL-as-SSoT pattern for its selected contact (ADR-332 D21): a second copy here
 * would have been a textbook sibling clone (N.18). They are re-exported so the 2D
 * transform, the 3D camera deep-link (`camera3d-persistence.ts`) and their tests
 * keep importing from ONE place.
 */
export { currentSearchParams, replaceUrlSearchParams };

/** Read viewport state from the current page URL. */
export function readViewportFromUrl(): Partial<PersistedViewport> {
  return parseViewportFromParams(currentSearchParams());
}

// ─── Εμβέλεια κτηρίου (ADR-845 §7.15, Ο-18/Ο-32) ─────────────────────────────

/**
 * **Ποιο κτήριο δηλώνει η διεύθυνση;**
 *
 * Ίδιο ιδίωμα με το `lvl` από πάνω — *«the view lives in the URL as a shareable
 * deep-link»* (ADR-400: Figma / Google Maps / Autodesk Forge) — αλλά **άλλο
 * πράγμα**: το κτήριο δεν είναι κατάσταση κάμερας, είναι **εμβέλεια εγγράφου**.
 * Γι' αυτό ζει έξω από το `applyViewportToParams`: ένα fit-to-view δεν επιτρέπεται
 * ποτέ να σβήσει το κτήριο, όπως σβήνει νόμιμα το `lvl`.
 *
 * ⚠️ Το κλειδί μένει **εδώ** και όχι σε δεύτερο αρχείο: αυτό είναι το ΕΝΑ σημείο
 * που ξέρει ποια κλειδιά κουβαλά η διεύθυνση του viewer.
 */
export function readActiveBuildingFromUrl(): string | null {
  return currentSearchParams().get(URL_KEYS.building) || null;
}

/**
 * Γράψε (ή σβήσε) το δηλωμένο κτήριο **χωρίς πλοήγηση** — `history.replaceState`,
 * όπως όλη η υπόλοιπη κατάσταση της διεύθυνσης (ADR-040: μηδέν re-render).
 *
 * 🔑 Ο λόγος που υπάρχει ο γραφέας: μόλις η εμβέλεια γίνει **γνωστή** (από το
 * ενεργό επίπεδο), η διεύθυνση τη **μαθαίνει** — άρα το link που θα μοιραστεί ο
 * μηχανικός κουβαλά το κτήριο, χωρίς να χρειαστεί να το επιλέξει κανείς. Αυτό
 * είναι που δίνει το «ένα μοντέλο ανά κτήριο» του Revit **χωρίς** χωριστά αρχεία.
 */
export function writeActiveBuildingToUrl(buildingId: string | null): void {
  replaceUrlSearchParams((params) => {
    if (buildingId) params.set(URL_KEYS.building, buildingId);
    else params.delete(URL_KEYS.building);
  });
}

/**
 * Write viewport state to the URL via `history.replaceState` — no navigation,
 * no React re-render, preserves pathname + hash + unrelated query keys.
 */
export function writeViewportToUrl(
  transform: ViewTransform,
  levelId: string | null,
): void {
  replaceUrlSearchParams((params) => applyViewportToParams(params, transform, levelId));
}

// ─── localStorage fallback (per FileRecord) ──────────────────────────────────

function storageKeyFor(fileRecordId: string): string {
  return `${STORAGE_KEYS.VIEWPORT_STATE_PREFIX}:${fileRecordId}`;
}

/** Read the per-document persisted viewport (validates the stored transform). */
export function readViewportFromStorage(
  fileRecordId: string | null,
): Partial<PersistedViewport> {
  if (!fileRecordId) return {};
  const raw = storageGet<Partial<PersistedViewport> | null>(
    storageKeyFor(fileRecordId),
    null,
  );
  if (!raw) return {};
  const result: { -readonly [K in keyof PersistedViewport]?: PersistedViewport[K] } = {};
  if (isValidTransform(raw.transform)) result.transform = raw.transform;
  if (typeof raw.levelId === 'string') result.levelId = raw.levelId;
  return result;
}

/** Persist the viewport for a document to localStorage. No-op without an id. */
export function writeViewportToStorage(
  fileRecordId: string | null,
  transform: ViewTransform,
  levelId: string | null,
): void {
  if (!fileRecordId || !isValidTransform(transform)) return;
  storageSet<PersistedViewport>(storageKeyFor(fileRecordId), { transform, levelId });
}

/** Remove the per-document persisted viewport. */
export function clearViewportStorage(fileRecordId: string | null): void {
  if (!fileRecordId) return;
  storageRemove(storageKeyFor(fileRecordId));
}

// ─── Combined facade (used by restore + sync) ────────────────────────────────

/**
 * Resolve the viewport to restore on load: URL wins when it carries a valid
 * transform; otherwise fall back to per-document localStorage. The level id
 * prefers the URL value when present, else the stored one.
 */
export function readPersistedViewport(
  fileRecordId: string | null,
): Partial<PersistedViewport> {
  const fromUrl = readViewportFromUrl();
  if (fromUrl.transform) return fromUrl;
  const fromStorage = readViewportFromStorage(fileRecordId);
  const levelId = fromUrl.levelId ?? fromStorage.levelId;
  return levelId !== undefined
    ? { transform: fromStorage.transform, levelId }
    : { transform: fromStorage.transform };
}

/** Resolve only the persisted active level id (URL first, then storage). */
export function readPersistedLevelId(fileRecordId: string | null): string | null {
  return readViewportFromUrl().levelId ?? readViewportFromStorage(fileRecordId).levelId ?? null;
}

/** Persist to BOTH sinks (URL deep-link + localStorage fallback) in one call. */
export function persistViewport(
  fileRecordId: string | null,
  transform: ViewTransform,
  levelId: string | null,
): void {
  if (!isValidTransform(transform)) return;
  writeViewportToUrl(transform, levelId);
  writeViewportToStorage(fileRecordId, transform, levelId);
}
