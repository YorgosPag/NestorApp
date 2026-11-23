/**
 * @fileoverview **Ο browser μιλά στην πόρτα για το περίγραμμα οικοπέδου** — κατάσταση · επιβεβαίωση · αλλαγή (ADR-920 §14.11 Ζ4).
 * @related app/api/owner-properties/[ownerPropertyId]/terrain (GET · PUT · PATCH — η ΙΔΙΑ πόρτα εδάφους) ·
 *   ./publish-listing-terrain.client (η αδελφή αποστολή ισοϋψών: ίδια διεύθυνση, ίδιος κατάλογος αρνήσεων) ·
 *   lib/terrain/plot-outline/plot-outline-status (η απάντηση του GET)
 * @module services/listings/plot-outline.client
 *
 * 🔑 **Ο browser ονομάζει υποψήφιο, ποτέ δακτύλιο** (Ζ3): στέλνει το σχέδιο **ως έχει** + `{ candidateId, showInListing }`· ο
 *    server ξαναδιαβάζει τα bytes με τον ίδιο πυρήνα και κρατά **τον δικό του** δακτύλιο.
 * 🔑 **Ένα `Idempotency-Key` ανά πρόθεση, όχι ανά κλικ** (ADR-872): ίδιο αρχείο + ίδια επιλογή ⇒ ίδιο κλειδί ⇒ χαμένη απάντηση
 *    και δεύτερο κλικ αναπαράγεται από το σύνορο, αντί να γεννήσει δεύτερο σχέδιο στον φάκελο.
 * 🔑 Κάθε αποτυχία επιστρέφει **ονομασμένη** άρνηση από τον κλειστό κατάλογο της πόρτας (`terrain-survey:publish.refusals`).
 */

import { namedRefusalOf, type NamedRefusal } from '@/lib/api/api-client-types';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { IDEMPOTENCY_KEY_HEADER } from '@/lib/api/idempotency/idempotency-contract';
import type { PlotOutlineAmendment } from '@/lib/terrain/plot-outline/plot-outline-confirmation';
import { parsePlotOutlineStatus, type PlotOutlineStatus } from '@/lib/terrain/plot-outline/plot-outline-status';
import {
  isTerrainRefusalCode,
  PLOT_OUTLINE_CONFIRM_FIELDS,
  type TerrainRefusalCode,
} from '@/lib/terrain/publication/terrain-publication-contract';
import type { TerrainPublishTarget } from '@/lib/terrain/publication/terrain-publish-target';
import type { TopoUnit } from '@/lib/terrain/survey-import/topo-import-types';
import { generateIdempotencyKey } from '@/services/enterprise-id.service';
import { announceSupersededFiles, archivedFileIdsOf } from '@/services/filesystem/announce-superseded-files';

import { terrainEndpointOf, type TerrainListingOutcome } from './publish-listing-terrain.client';

export type PlotOutlineRefusal = NamedRefusal<TerrainRefusalCode>;

/** Μόνο η πόρτα του ιδιοκτήτη έχει φάκελο, άρα και περίγραμμα (Ζ3). */
export type OwnerTerrainTarget = Extract<TerrainPublishTarget, { kind: 'owner-property' }>;

/** Π6 — πόσο από το περίγραμμα καλύπτει το ανάγλυφο, όπως το μέτρησε ο server. */
export interface PlotOutlineCoverageReport {
  readonly coverage: 'covered' | 'partial';
  readonly coveredFraction: number;
}

export type PlotOutlineStatusOutcome =
  | { readonly ok: true; readonly status: PlotOutlineStatus }
  | { readonly ok: false; readonly refusal: PlotOutlineRefusal };

export type PlotOutlineConfirmOutcome =
  | {
    readonly ok: true;
    readonly drawingFileId: string;
    readonly areaM2: number;
    /** `null` = δεν υπάρχει ακόμη ανάγλυφο: το περίγραμμα περιμένει τις πρώτες ισοϋψείς (Π2). */
    readonly coverage: PlotOutlineCoverageReport | null;
    readonly listing: TerrainListingOutcome | null;
  }
  | { readonly ok: false; readonly refusal: PlotOutlineRefusal };

export type PlotOutlineAmendOutcome =
  | { readonly ok: true; readonly changed: boolean; readonly listing: TerrainListingOutcome | null }
  | { readonly ok: false; readonly refusal: PlotOutlineRefusal };

/** Μια επιβεβαίωση, παγωμένη μαζί με το κλειδί της: ίδιο αρχείο + ίδια επιλογή ⇔ ίδιο κλειδί. */
export interface PreparedPlotOutlineConfirmation {
  readonly drawing: File;
  readonly candidateId: string;
  readonly showInListing: boolean;
  /** Μόνο για DXF χωρίς `$INSUNITS` — η μονάδα που επιβεβαίωσε ο άνθρωπος. */
  readonly drawingUnit: TopoUnit | null;
  readonly idempotencyKey: string;
}

type ConfirmationChoice = Omit<PreparedPlotOutlineConfirmation, 'idempotencyKey'>;

/** Ίδια πρόθεση ⇒ η ΙΔΙΑ προετοιμασία· οτιδήποτε άλλο ⇒ νέα (νέο κλειδί). */
export function reusePlotOutlineConfirmation(
  previous: PreparedPlotOutlineConfirmation | null,
  next: ConfirmationChoice,
): PreparedPlotOutlineConfirmation {
  const same = previous !== null && previous.drawing === next.drawing && previous.candidateId === next.candidateId &&
    previous.showInListing === next.showInListing && previous.drawingUnit === next.drawingUnit;
  return same ? previous : { ...next, idempotencyKey: generateIdempotencyKey() };
}

const LISTING_OUTCOMES: ReadonlySet<string> = new Set<TerrainListingOutcome>(['published', 'withdrawn', 'failed', 'absent']);

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}

/** Η επαναδημοσίευση της απάντησης → τι έγινε στη δημόσια αγγελία (`null` = καμία επαναδημοσίευση). */
function listingOutcomeOf(terrain: unknown): TerrainListingOutcome | null {
  if (!isRecord(terrain)) return null;
  const listing = terrain.listing;
  return typeof listing === 'string' && LISTING_OUTCOMES.has(listing) ? (listing as TerrainListingOutcome) : 'unknown';
}

function coverageOf(terrain: unknown): PlotOutlineCoverageReport | null {
  if (!isRecord(terrain) || !isRecord(terrain.terrain)) return null;
  const outline = terrain.terrain.plotOutline;
  if (!isRecord(outline) || typeof outline.coveredFraction !== 'number') return null;
  return { coverage: outline.coverage === 'partial' ? 'partial' : 'covered', coveredFraction: outline.coveredFraction };
}

/** Σχήμα που δεν αναγνωρίζεται ⇒ `rejected`, ποτέ «κατάσταση χωρίς περιεχόμενο». */
function statusOf(data: unknown): PlotOutlineStatusOutcome {
  const status = parsePlotOutlineStatus(data);
  return status === null ? { ok: false, refusal: 'rejected' } : { ok: true, status };
}

/** **Τι ξέρει ο φάκελος για το περίγραμμα** — ο server κρίνει ποια απόφαση ισχύει, ο browser μόνο δείχνει. */
export async function fetchPlotOutlineStatus(target: OwnerTerrainTarget): Promise<PlotOutlineStatusOutcome> {
  try {
    return statusOf(await apiClient.get<unknown>(terrainEndpointOf(target)));
  } catch (cause) {
    return { ok: false, refusal: namedRefusalOf(cause, isTerrainRefusalCode) };
  }
}

function confirmationBodyOf(prepared: PreparedPlotOutlineConfirmation): FormData {
  const body = new FormData();
  body.append(PLOT_OUTLINE_CONFIRM_FIELDS.drawing, prepared.drawing, prepared.drawing.name);
  body.append(PLOT_OUTLINE_CONFIRM_FIELDS.choice, JSON.stringify({
    candidateId: prepared.candidateId,
    showInListing: prepared.showInListing,
  }));
  if (prepared.drawingUnit !== null) body.append(PLOT_OUTLINE_CONFIRM_FIELDS.drawingUnit, prepared.drawingUnit);
  return body;
}

function confirmOutcomeOf(data: unknown): PlotOutlineConfirmOutcome {
  if (!isRecord(data) || typeof data.drawingFileId !== 'string' || !isRecord(data.outline)) {
    return { ok: false, refusal: 'rejected' };
  }
  const areaM2 = data.outline.areaM2;
  if (typeof areaM2 !== 'number') return { ok: false, refusal: 'rejected' };
  announceSupersededFiles(archivedFileIdsOf(data.archived), data.drawingFileId);
  return {
    ok: true,
    drawingFileId: data.drawingFileId,
    areaM2,
    coverage: coverageOf(data.terrain),
    listing: listingOutcomeOf(data.terrain),
  };
}

/** **Επιβεβαίωσε το περίγραμμα** (`PUT`): το σχέδιο ως έχει + ποιο υποψήφιο + Π9. */
export async function confirmPlotOutline(
  target: OwnerTerrainTarget,
  prepared: PreparedPlotOutlineConfirmation,
): Promise<PlotOutlineConfirmOutcome> {
  try {
    const data = await apiClient.put<unknown>(terrainEndpointOf(target), confirmationBodyOf(prepared), {
      headers: { [IDEMPOTENCY_KEY_HEADER]: prepared.idempotencyKey },
    });
    return confirmOutcomeOf(data);
  } catch (cause) {
    return { ok: false, refusal: namedRefusalOf(cause, isTerrainRefusalCode) };
  }
}

/** **Άλλαξε το περίγραμμα χωρίς νέο σχέδιο** (`PATCH`): Π9 ή ρητή αφαίρεση. Ταυτοδύναμο στον server (`changed: false`). */
export async function amendPlotOutline(
  target: OwnerTerrainTarget,
  amendment: PlotOutlineAmendment,
): Promise<PlotOutlineAmendOutcome> {
  try {
    const data = await apiClient.patch<unknown>(terrainEndpointOf(target), amendment, {
      headers: { [IDEMPOTENCY_KEY_HEADER]: generateIdempotencyKey() },
    });
    if (!isRecord(data) || typeof data.changed !== 'boolean') return { ok: false, refusal: 'rejected' };
    return { ok: true, changed: data.changed, listing: listingOutcomeOf(data.terrain) };
  } catch (cause) {
    return { ok: false, refusal: namedRefusalOf(cause, isTerrainRefusalCode) };
  }
}
