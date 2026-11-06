import 'server-only';

/**
 * **Η ανάγνωση κάτοψης ενός υποβάθρου** (ADR-929 Φ3, Δ11): ο ένας κάτοχος της ροής από το «έλαβα μια όψη» ως το
 * «έγραψα ανάγνωση και κόστος». Η διαδρομή μόνο αποκωδικοποιεί και χαρτογραφεί· η απόφαση ζει εδώ.
 *
 * Σειρά, και γιατί έτσι:
 * 1. **Ιδιοκτησία** του υποβάθρου στην εταιρεία (Δ11): η εικόνα δεν φεύγει ποτέ για ξένο ή ανύπαρκτο υπόβαθρο.
 * 2. **Εταιρεία** (Δ15 #1): διακόπτης του διαχειριστή + νομική πύλη, **πριν** από την κρυφή μνήμη (Φ5.3α, πρακτική
 *    Figma: κλειστό AI = καμία λειτουργία AI, ούτε επιστροφή ήδη πληρωμένης ανάγνωσης).
 * 3. **Κλειδί** από ό,τι **έλαβε** ο διακομιστής (bytes + τμήματα), το αρχείο και τη σελίδα του υποβάθρου, το μοντέλο και
 *    το σχήμα. Τίποτα από αυτά δεν το δηλώνει ο πελάτης.
 * 4. **Κρυφή μνήμη πριν από το κόστος**: μια ήδη πληρωμένη ανάγνωση επιστρέφεται ακόμη κι αν το όριο του μήνα τελείωσε.
 * 5. **Όριο κόστους** από την εκτίμηση (Δ16), **πριν** από κάθε μίσθωση.
 * 6. **Μία-πτήση** και κλήση· τελικό έγγραφο + δαπάνη σε μία δέσμη.
 * Ο **προέλεγχος** (`previewPlanReadingForBackground`) κάνει τα 1, 2, 5 χωρίς καμία εγγραφή.
 * 🔒 Καμία εγγραφή στη σκηνή: η ανάγνωση είναι **πρόταση** (αρχή 1). Η εγγραφή είναι η Φ5.
 *
 * @module server/plan-recognition/plan-reading.service
 */

import { sha256Hex, sha256HexOfText } from '@/lib/hash/sha256';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import { BackgroundNotFoundError } from '@/services/floorplan-background/background-ownership';
import { FloorplanBackgroundService } from '@/services/floorplan-background/floorplan-background.service';
import { planReadingKey } from '@/subapps/dxf-viewer/bim/plan-recognition/plan-reading-key';
import type { PlanReader, PlanReaderImage, PlanReaderInput } from '@/subapps/dxf-viewer/bim/plan-recognition/reading/plan-reader-port';
import type {
  PlanReadingPreflightRequest,
  PlanReadingPreflightResult,
  PlanReadingRequest,
  PlanReadingRouteResult,
} from '@/subapps/dxf-viewer/bim/plan-recognition/reading/plan-reading-contract';
import type { PlanReadingUnavailableReason } from '@/subapps/dxf-viewer/bim/plan-recognition/plan-recognition-types';
import { PLAN_READING_SCHEMA_VERSION } from '@/subapps/dxf-viewer/bim/plan-recognition/reading/plan-reading-wire';
import { createPlanReader } from './openai-plan-reader.server';
import {
  resolvePlanReadingAllowance,
  resolvePlanReadingCompanyRefusal,
  resolvePlanReadingCostAllowance,
  type PlanReadingAllowance,
} from './plan-reading-allowance.server';
import {
  claimPlanReading,
  recordPlanReadingCacheHit,
  settlePlanReading,
  type PlanReadingClaim,
  type PlanReadingIdentity,
  type PlanReadingSentProof,
  type StoredPlanReading,
} from './plan-reading-store.server';

export interface PlanReadingCommand {
  readonly companyId: string;
  readonly uid: string;
  readonly backgroundId: string;
  readonly image: PlanReaderImage;
  readonly request: PlanReadingRequest;
}

/** Εξαρτήσεις — ορατές μόνο για τις άγκυρες. */
export interface PlanReadingDeps {
  readonly background: (id: string, companyId: string) => Promise<{ readonly fileId: string; readonly pageNumber: number } | null>;
  readonly reader: () => PlanReader | null;
  /** Βήμα εταιρείας (διακόπτης + νομική πύλη): `null` = επιτρέπει. Ρωτιέται **πριν** από την κρυφή μνήμη (Φ5.3α). */
  readonly companyRefusal: (companyId: string) => Promise<PlanReadingUnavailableReason | null>;
  /** Βήμα κόστους (όριο σελίδας + μήνα): **μετά** την κρυφή μνήμη, γιατί η αποθηκευμένη ανάγνωση είναι ήδη πληρωμένη. */
  readonly costAllowance: (companyId: string, estimateUsd: number | null) => Promise<PlanReadingAllowance>;
  readonly claim: typeof claimPlanReading;
  readonly settle: typeof settlePlanReading;
  readonly cacheHit: (companyId: string) => Promise<void>;
  readonly now: () => number;
}

const DEFAULT_DEPS: PlanReadingDeps = {
  background: async (id, companyId) => {
    const bg = await FloorplanBackgroundService.getById(id, companyId);
    return bg && { fileId: bg.fileId, pageNumber: bg.providerMetadata.pdfPageNumber ?? 1 };
  },
  reader: () => createPlanReader(),
  companyRefusal: (companyId) => resolvePlanReadingCompanyRefusal(companyId),
  costAllowance: (companyId, estimateUsd) => resolvePlanReadingCostAllowance(companyId, estimateUsd),
  claim: claimPlanReading,
  settle: settlePlanReading,
  cacheHit: recordPlanReadingCacheHit,
  now: Date.now,
};

async function sentProofOf(cmd: PlanReadingCommand): Promise<PlanReadingSentProof> {
  const { image, request } = cmd;
  return {
    imageSha256: await sha256Hex(image.bytes),
    mimeType: image.mimeType,
    widthPx: image.widthPx,
    heightPx: image.heightPx,
    bytes: image.bytes.byteLength,
    segmentCount: request.segments.length,
    // Το σχήμα zod δίνει σταθερή σειρά κλειδιών ⇒ ίδιος πίνακας, ίδιο hash.
    segmentsSha256: await sha256HexOfText(JSON.stringify(request.segments)),
    view: request.view,
  };
}

/** `status: 'read'` χωρίς ανάγνωση θα ήταν χαλασμένο έγγραφο: ποτέ σιωπηλά «κενή ανάγνωση», πάντα ρητή αποτυχία. */
function cachedResult(s: StoredPlanReading): PlanReadingRouteResult {
  if (!s.reading || !s.dropped) return { status: 'unavailable', reason: 'reader-failed', readingId: s.readingId };
  return { status: 'read', readingId: s.readingId, model: s.model, schemaVersion: s.schemaVersion, reading: s.reading, dropped: s.dropped, cacheHit: true };
}

async function fromClaim(claim: PlanReadingClaim, identity: PlanReadingIdentity, deps: PlanReadingDeps): Promise<PlanReadingRouteResult | null> {
  if (claim.kind === 'in-flight') return { status: 'unavailable', reason: 'reading-in-progress', readingId: identity.readingId };
  if (claim.kind === 'cached') {
    // Η καταγραφή της εξοικονόμησης δεν αλλάζει την απάντηση: η ανάγνωση υπάρχει ήδη.
    await deps.cacheHit(identity.companyId).catch(() => undefined);
    return cachedResult(claim.stored);
  }
  return null;
}

async function readAndSettle(reader: PlanReader, input: PlanReaderInput, identity: PlanReadingIdentity, deps: PlanReadingDeps): Promise<PlanReadingRouteResult> {
  const outcome = await reader.read(input);
  const read = outcome.kind === 'read';
  await deps.settle(identity, {
    status: read ? 'read' : 'failed',
    reading: read ? outcome.reading : null,
    dropped: read ? outcome.dropped : null,
    failure: read ? null : outcome.failure,
    usage: outcome.usage,
    latencyMs: outcome.latencyMs,
  }, deps.now());
  if (!read) return { status: 'unavailable', reason: 'reader-failed', readingId: identity.readingId };
  return { status: 'read', readingId: identity.readingId, model: outcome.model, schemaVersion: PLAN_READING_SCHEMA_VERSION, reading: outcome.reading, dropped: outcome.dropped, cacheHit: false };
}

/** @throws {BackgroundNotFoundError} για ξένο ή ανύπαρκτο υπόβαθρο (η διαδρομή το μεταμφιέζει, ADR-742). */
export async function readPlanForBackground(cmd: PlanReadingCommand, deps: PlanReadingDeps = DEFAULT_DEPS): Promise<PlanReadingRouteResult> {
  const background = await deps.background(cmd.backgroundId, cmd.companyId);
  if (!background) throw new BackgroundNotFoundError(cmd.backgroundId);
  const reader = deps.reader();
  if (!reader) return { status: 'unavailable', reason: 'reader-unconfigured', readingId: null };
  // Βήμα 2: η εταιρεία, ΠΡΙΝ από την κρυφή μνήμη (Figma: κλειστό AI = καμία λειτουργία AI, ούτε πληρωμένη ανάγνωση).
  const refusal = await deps.companyRefusal(cmd.companyId);
  if (refusal !== null) return { status: 'unavailable', reason: refusal, readingId: null };
  const sent = await sentProofOf(cmd);
  const inputHash = await sha256HexOfText(`${sent.imageSha256}:${sent.segmentsSha256}`);
  const readingKey = planReadingKey({ ...background, inputHash, model: reader.model, schemaVersion: PLAN_READING_SCHEMA_VERSION });
  const identity: PlanReadingIdentity = {
    readingId: enterpriseIdService.generateDeterministicPlanReadingId(cmd.companyId, readingKey),
    readingKey,
    companyId: cmd.companyId,
    backgroundId: cmd.backgroundId,
    fileId: background.fileId,
    pageNumber: background.pageNumber,
    model: reader.model,
    schemaVersion: PLAN_READING_SCHEMA_VERSION,
  };
  const input: PlanReaderInput = { image: cmd.image, segments: cmd.request.segments };
  // Ήδη πληρωμένη; Η μία-πτήση το ξαναρωτά μέσα στη συναλλαγή, αλλά εδώ κρίνεται πριν από το όριο (βήμα 4).
  const early = await fromClaim(await deps.claim(identity, sent, cmd.uid, deps.now(), { probeOnly: true }), identity, deps);
  if (early) return early;
  const allowance = await deps.costAllowance(cmd.companyId, reader.estimateCostUsd(input));
  if (!allowance.allowed) return { status: 'unavailable', reason: allowance.reason, readingId: null };
  const claimed = await fromClaim(await deps.claim(identity, sent, cmd.uid, deps.now()), identity, deps);
  return claimed ?? readAndSettle(reader, input, identity, deps);
}

export interface PlanReadingPreflightCommand {
  readonly companyId: string;
  readonly backgroundId: string;
  readonly request: PlanReadingPreflightRequest;
}

/** Ό,τι χρειάζεται ο προέλεγχος από τις εξαρτήσεις της ροής: οι **ίδιες** συναρτήσεις, κανένας δεύτερος κανόνας. */
export type PlanReadingPreflightDeps = Pick<PlanReadingDeps, 'background' | 'reader'> & {
  readonly allowance: (companyId: string, estimateUsd: number | null) => Promise<PlanReadingAllowance>;
};

const DEFAULT_PREFLIGHT_DEPS: PlanReadingPreflightDeps = {
  background: DEFAULT_DEPS.background,
  reader: DEFAULT_DEPS.reader,
  allowance: (companyId, estimateUsd) => resolvePlanReadingAllowance(companyId, estimateUsd),
};

/**
 * **Προέλεγχος** (ADR-929 Φ5.3α): «επιτρέπεται, πόσο θα κοστίσει, τι μένει;» **πριν** από την αποστολή, με την ίδια
 * εκτίμηση και τον ίδιο κανόνα με την ανάγνωση. 🔒 **Μηδέν εγγραφές**: ούτε μίσθωση, ούτε δαπάνη, ούτε έγγραφο.
 * @throws {BackgroundNotFoundError} για ξένο ή ανύπαρκτο υπόβαθρο, όπως η ανάγνωση (ADR-742).
 */
export async function previewPlanReadingForBackground(
  cmd: PlanReadingPreflightCommand,
  deps: PlanReadingPreflightDeps = DEFAULT_PREFLIGHT_DEPS,
): Promise<PlanReadingPreflightResult> {
  const background = await deps.background(cmd.backgroundId, cmd.companyId);
  if (!background) throw new BackgroundNotFoundError(cmd.backgroundId);
  const reader = deps.reader();
  if (!reader) return { status: 'unavailable', reason: 'reader-unconfigured' };
  const estimateUsd = reader.estimateCostUsd(cmd.request);
  const allowance = await deps.allowance(cmd.companyId, estimateUsd);
  if (!allowance.allowed) return { status: 'unavailable', reason: allowance.reason };
  // `allowed` ⇒ η εκτίμηση υπήρχε (`null` δίνει `cost-unknown`)· ο έλεγχος κρατά τον τύπο τίμιο χωρίς `!`.
  if (estimateUsd === null) return { status: 'unavailable', reason: 'cost-unknown' };
  return { status: 'allowed', model: reader.model, estimateUsd, remainingUsd: allowance.remainingUsd, monthlyCapUsd: allowance.monthlyCapUsd };
}
