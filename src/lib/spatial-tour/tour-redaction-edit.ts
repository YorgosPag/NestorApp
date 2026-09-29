/**
 * @fileoverview **ΟΙ ΘΟΛΩΜΕΝΕΣ ΠΕΡΙΟΧΕΣ ΜΙΑΣ ΛΗΨΗΣ** — θόλωση, αλλαγή, αφαίρεση: καθαρές συναρτήσεις που παίρνουν τις περιοχές
 * της λήψης και επιστρέφουν τις νέες, ή ονομασμένη άρνηση (ADR-884 Φ2ζ · §4.15 · Α8).
 * @related `tour-graph-edit.ts` (`TourGraphCommand` — ίδιος γραφέας, ίδια διαδρομή) · `tour-space-edit.ts` (`judgeShapeIntent` —
 *   ο ΕΝΑΣ κριτής πρόθεσης για id πελάτη) · `tileset/tour-redaction-mask.ts` (η απόδοση) ·
 *   `server/spatial-tour/tour-redaction-apply.ts` (κλειδί πλακιδίων + επανα-ψήση)
 * @module lib/spatial-tour/tour-redaction-edit
 *
 * 🔑 **Δεδομένα, όχι pixel** (πάνω από τη Matterport, όπου «cannot unblur»): οι περιοχές ζουν στη λήψη, το πρωτότυπο μένει
 *   ανέπαφο και ιδιωτικό, ο ψήστης τις εφαρμόζει σε ό,τι σερβίρεται. Διόρθωση και αναίρεση κοστίζουν μια επανα-ψήση, ποτέ τη φωτογραφία.
 * 🔑 **Το id το κόβει ο πελάτης, το κρίνει ο διακομιστής** (πρότυπο χώρων Γ3γ-2α): `create` με ίδιο περιεχόμενο = ιδεμπότητη
 *   επανάληψη · `create` σε id που υπάρχει με άλλο = `redaction-exists` · `replace` σε ανύπαρκτο = `redaction-absent`.
 * 🔑 **Η γεωμετρία κανονικοποιείται εδώ, μία φορά** (yaw στο (−π, π]): το κλειδί των πλακιδίων παράγεται από αυτήν — δύο
 *   ισοδύναμα yaw (0 και 2π) δεν πρέπει να δώσουν δύο κλειδιά για τα ίδια pixel.
 */

import {
  MAX_TOUR_REDACTIONS,
  TOUR_REDACTION_MAX_RADIUS_RAD,
  TOUR_REDACTION_MIN_RADIUS_RAD,
  type TourShapeMode,
} from '@/constants/spatial-tour-vocabulary';
import { normalizeAngleDiff } from '@/lib/geometry/angle';
import { ENTERPRISE_ID_PREFIXES } from '@/services/enterprise-id-prefixes';
import type { TourCapture, TourRedaction, TourRedactionRegion } from '@/types/spatial-tour';

import { TOUR_REDACTION_RENDER_VERSION } from './tileset/tour-redaction-mask';
import type { TourGraphCommand, TourGraphEditRefusal, TourRedactionEdit } from './tour-graph-edit';
import type { TourEditStamp } from './tour-plan-edit';
import { judgeShapeIntent } from './tour-space-edit';

/** Κάτω από αυτό (ακτίνια), δύο γωνίες είναι ίδιες — ιδεμποτία χωρίς ψεύτικη «αλλαγή» από στρογγύλευση. */
const EPSILON = 1e-9;
/** Ψηφία της γεωμετρίας στο κλειδί των πλακιδίων: 1e-6 rad ≈ 0,004 pixel σε 8K — ίδια pixel ⇒ ίδιο κλειδί. */
const KEY_DIGITS = 6;

export interface TourRedactionInput {
  readonly redactionId: string;
  readonly mode: TourShapeMode;
  readonly region: TourRedactionRegion;
}

/** Μια περιοχή με την ταυτότητά της — ό,τι χρειάζεται μια διαφορά συνόλων (εφαρμοσμένη **ή** πρόχειρη). */
export type TourRedactionRegionWithId = TourRedactionRegion & { readonly id: string };

export type TourRedactionEditResult =
  | { readonly kind: 'edited'; readonly redactions: readonly TourRedaction[] }
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'refused'; readonly reason: TourGraphEditRefusal };

const refused = (reason: TourGraphEditRefusal): TourRedactionEditResult => ({ kind: 'refused', reason });
const UNCHANGED: TourRedactionEditResult = { kind: 'unchanged' };

/** Οι περιοχές μιας λήψης — απούσες ⇒ καμία. */
export function redactionsOf(capture: Pick<TourCapture, 'redactions'>): readonly TourRedaction[] {
  return capture.redactions ?? [];
}

/** Η περιοχή κανονικοποιημένη (yaw στο (−π, π]) — ή `null` αν δεν είναι έγκυρη (εκτός σφαίρας · ακτίνα εκτός ορίων). */
export function normalizeRedactionRegion(region: TourRedactionRegion): TourRedactionRegion | null {
  const { yawRad, pitchRad, radiusRad } = region;
  if (![yawRad, pitchRad, radiusRad].every(Number.isFinite)) return null;
  if (Math.abs(pitchRad) > Math.PI / 2) return null;
  if (radiusRad < TOUR_REDACTION_MIN_RADIUS_RAD || radiusRad > TOUR_REDACTION_MAX_RADIUS_RAD) return null;
  return { yawRad: normalizeAngleDiff(yawRad), pitchRad, radiusRad };
}

function sameRegion(a: TourRedactionRegion, b: TourRedactionRegion): boolean {
  return Math.abs(normalizeAngleDiff(a.yawRad - b.yawRad)) < EPSILON
    && Math.abs(a.pitchRad - b.pitchRad) < EPSILON
    && Math.abs(a.radiusRad - b.radiusRad) < EPSILON;
}

/**
 * **Θόλωσε (ή άλλαξε) μια περιοχή.** Η περιοχή που γράφεται είναι του ανθρώπου αυτής της εντολής (`manual`, η σφραγίδα της) —
 * και όταν διορθώνει μια αυτόματη: τη γεωμετρία που μένει την αποφάσισε πλέον εκείνος.
 */
export function upsertRedaction(
  current: readonly TourRedaction[],
  input: TourRedactionInput,
  stamp: TourEditStamp,
): TourRedactionEditResult {
  const previous = current.find((redaction) => redaction.id === input.redactionId);
  const intent = judgeShapeIntent(
    input.redactionId, input.mode, previous !== undefined, ENTERPRISE_ID_PREFIXES.TOUR_REDACTION, 'redaction-absent', 'redaction-invalid',
  );
  if (intent !== null) return refused(intent);
  const region = normalizeRedactionRegion(input.region);
  if (region === null) return refused('redaction-invalid');
  if (previous !== undefined && sameRegion(previous, region)) return UNCHANGED;
  if (previous !== undefined && input.mode === 'create') return refused('redaction-exists');
  if (previous === undefined && current.length >= MAX_TOUR_REDACTIONS) return refused('redaction-limit');
  const next: TourRedaction = { id: input.redactionId, ...region, source: 'manual', createdBy: stamp.uid, createdAt: stamp.at };
  const redactions = previous === undefined ? [...current, next] : current.map((r) => (r.id === next.id ? next : r));
  return { kind: 'edited', redactions };
}

/** **Βγάλε** μια περιοχή — ανύπαρκτη ⇒ ίδιες περιοχές (όπως το `unspace`). */
export function removeRedaction(current: readonly TourRedaction[], redactionId: string): TourRedactionEditResult {
  if (!current.some((redaction) => redaction.id === redactionId)) return UNCHANGED;
  return { kind: 'edited', redactions: current.filter((redaction) => redaction.id !== redactionId) };
}

/**
 * **Το hash του πρωτοτύπου** μιας λήψης — ό,τι επαληθεύει ο ψήστης. Λήψη που δεν θολώθηκε ποτέ δεν έχει `originalHash`: εκεί το
 * κλειδί των πλακιδίων **είναι** το hash του πρωτοτύπου (σύμβαση πριν τη Φ2ζ).
 */
export function originalHashOf(capture: Pick<TourCapture, 'originalHash' | 'tileset'>): string | null {
  return capture.originalHash ?? capture.tileset.contentHash;
}

/** Αριθμός στο κλειδί — `−0.000000` και `0.000000` είναι τα **ίδια** pixel, άρα ίδιο κείμενο (`-0 + 0 === +0`). */
function keyNumber(value: number): string {
  return (Number(value.toFixed(KEY_DIGITS)) + 0).toFixed(KEY_DIGITS);
}

/**
 * **Το υλικό του κλειδιού των πλακιδίων** — `null` ⇒ καμία περιοχή, κλειδί = το hash του πρωτοτύπου (τα υπάρχοντα πλακίδια
 * μένουν όπως είναι). Κανονικό: η **σειρά** των περιοχών, τα id τους και το «ποιος/πότε» δεν αλλάζουν ούτε ένα pixel, άρα
 * δεν αλλάζουν ούτε το κλειδί· η έκδοση απόδοσης το αλλάζει.
 */
export function redactionKeyMaterial(originalHash: string, redactions: readonly TourRedactionRegion[]): string | null {
  if (redactions.length === 0) return null;
  const regions = redactions
    .map((r) => [r.yawRad, r.pitchRad, r.radiusRad].map(keyNumber).join(','))
    .sort();
  return [TOUR_REDACTION_RENDER_VERSION, originalHash, ...regions].join('|');
}

// ── Δέσμη (ζ3 — το «Apply» της Matterport) ────────────────────────────────────

/** Οι θολωμένες εντολές του γράφου — η μονή εντολή είναι δέσμη ενός. */
type RedactionCommand = Extract<TourGraphCommand, { op: 'redact' | 'unredact' | 'redactions' }>;

/** **Οι αλλαγές μιας εντολής θολώματος** — ο ΕΝΑΣ δρόμος για γραφέα και αναίρεση: μονή εντολή = δέσμη ενός. */
export function redactionEditsOf(command: RedactionCommand): readonly TourRedactionEdit[] {
  switch (command.op) {
    case 'redact': return [{ op: 'redact', redactionId: command.redactionId, mode: command.mode, region: command.region }];
    case 'unredact': return [{ op: 'unredact', redactionId: command.redactionId }];
    case 'redactions': return command.edits;
  }
}

/**
 * **Εφάρμοσε μια δέσμη, ατομικά** — με τους ΙΔΙΟΥΣ κριτές (`upsertRedaction` · `removeRedaction`), με τη σειρά. Μία άρνηση ⇒ η
 * δέσμη αρνείται **ολόκληρη** με τον λόγο της (ποτέ «μισό θόλωμα»)· καμία πραγματική αλλαγή ⇒ `unchanged`. Κενή δέσμη ⇒ `unchanged`.
 */
export function applyRedactionEdits(
  current: readonly TourRedaction[],
  edits: readonly TourRedactionEdit[],
  stamp: TourEditStamp,
): TourRedactionEditResult {
  let redactions = current;
  let changed = false;
  for (const edit of edits) {
    const step = edit.op === 'redact'
      ? upsertRedaction(redactions, { redactionId: edit.redactionId, mode: edit.mode, region: edit.region }, stamp)
      : removeRedaction(redactions, edit.redactionId);
    if (step.kind === 'refused') return step;
    if (step.kind === 'edited') { redactions = step.redactions; changed = true; }
  }
  return changed ? { kind: 'edited', redactions } : UNCHANGED;
}

const byId = (a: { readonly id: string }, b: { readonly id: string }) => a.id.localeCompare(b.id);
const regionOf = (r: TourRedactionRegion): TourRedactionRegion => ({ yawRad: r.yawRad, pitchRad: r.pitchRad, radiusRad: r.radiusRad });

/**
 * **Η δέσμη που πάει από το `before` στο `after`** — ό,τι στέλνει το πρόχειρο, και η αναίρεση μιας δέσμης (`after → before`).
 * Σειρά: πρώτα **αφαιρέσεις** (ελευθερώνουν το όριο), μετά αλλαγές, μετά νέες — κάθε ομάδα κατά id (ντετερμινιστικό).
 */
export function redactionEditsBetween(
  before: readonly TourRedactionRegionWithId[],
  after: readonly TourRedactionRegionWithId[],
): TourRedactionEdit[] {
  const was = new Map(before.map((r) => [r.id, r]));
  const is = new Map(after.map((r) => [r.id, r]));
  const removed = [...before].sort(byId).filter((r) => !is.has(r.id))
    .map((r): TourRedactionEdit => ({ op: 'unredact', redactionId: r.id }));
  const replaced = [...after].sort(byId).filter((r) => {
    const previous = was.get(r.id);
    return previous !== undefined && !sameRegion(previous, r);
  }).map((r): TourRedactionEdit => ({ op: 'redact', redactionId: r.id, mode: 'replace', region: regionOf(r) }));
  const created = [...after].sort(byId).filter((r) => !was.has(r.id))
    .map((r): TourRedactionEdit => ({ op: 'redact', redactionId: r.id, mode: 'create', region: regionOf(r) }));
  return [...removed, ...replaced, ...created];
}
