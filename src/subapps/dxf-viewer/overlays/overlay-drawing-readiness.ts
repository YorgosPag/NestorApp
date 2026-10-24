/**
 * overlay-drawing-readiness — μπορεί το τρέχον επίπεδο να δεχτεί ζώνες (overlays); (ADR-921)
 *
 * ## Το πρόβλημα
 *
 * Το εργαλείο «Σχεδίαση Επιπέδων» ενεργοποιούνταν πάντα· ο έλεγχος «υπάρχει όροφος + αναφορά;»
 * ζούσε ΜΟΝΟ στην αποθήκευση (`overlay-store.add`). Ο χρήστης σχεδίαζε ολόκληρο πολύγωνο και στο
 * κλείσιμο έπαιρνε σφάλμα — δουλειά χαμένη. Χειρότερα, κάθε αποτυχία (ακόμη και «χωρίς όροφο»)
 * εμφανιζόταν ως «Δεν βρέθηκε αρχείο αναφοράς» — λάθος αιτία, λάθος διόρθωση.
 *
 * ## Η αρχή (Revit/ArchiCAD: command availability)
 *
 * ΜΙΑ καθαρή απόφαση, ρωτημένη από ΟΛΟΥΣ: την πύλη ενεργοποίησης εργαλείου, το κουμπί του
 * ribbon και την αποθήκευση (άμυνα σε βάθος). Ίδια είσοδος ⇒ ίδια απάντηση· δύο ορισμοί του
 * «έτοιμο» θα ξανάνοιγαν το ίδιο κενό.
 *
 * ## Τι σημαίνει «αναφορά»
 *
 * Εικόνα/PDF κάτοψης του ορόφου **ή** το `sceneFileId` του επιπέδου. Ένα σχέδιο που γεννήθηκε
 * μέσα στην εφαρμογή (ADR-913) αποκτά `sceneFileId` στην πρώτη αποθήκευση με περιεχόμενο, άρα
 * μετρά αυτόματα — ένα κενό επίπεδο όχι (δεν υπάρχει τίποτα να «ιχνηλατηθεί»).
 *
 * Pure: καμία πρόσβαση σε React/Firebase.
 *
 * @module subapps/dxf-viewer/overlays/overlay-drawing-readiness
 * @see docs/centralized-systems/reference/adrs/ADR-921-overlay-drawing-readiness.md
 */

/** Γιατί δεν μπορεί να σχεδιαστεί ζώνη — με τη σειρά που ελέγχεται. */
export type OverlayDrawingBlockReason = 'no-level' | 'no-floor' | 'no-background' | 'no-auth';

/** Ό,τι χρειάζεται μια εγγραφή στο `floorplan_overlays` (αμετάβλητα πεδία, Firestore rules D6). */
export interface OverlayPersistContext {
  readonly floorId: string;
  readonly backgroundId: string;
}

export type OverlayDrawingReadiness =
  | { readonly ready: true; readonly context: OverlayPersistContext }
  | { readonly ready: false; readonly reason: OverlayDrawingBlockReason };

export interface OverlayDrawingReadinessInput {
  readonly levelId: string | null;
  readonly floorId: string | null;
  /** `floorplan_backgrounds` id του ορόφου (εικόνα/PDF), αν υπάρχει. */
  readonly backgroundImageId: string | null;
  /** Το DXF του επιπέδου (εισαγμένο ή γεννημένο στην εφαρμογή — ADR-913). */
  readonly sceneFileId: string | null;
  readonly userId: string | null;
}

export function resolveOverlayDrawingReadiness(input: OverlayDrawingReadinessInput): OverlayDrawingReadiness {
  if (!input.levelId) return { ready: false, reason: 'no-level' };
  if (!input.floorId) return { ready: false, reason: 'no-floor' };
  const backgroundId = input.backgroundImageId ?? input.sceneFileId;
  if (!backgroundId) return { ready: false, reason: 'no-background' };
  if (!input.userId) return { ready: false, reason: 'no-auth' };
  return { ready: true, context: { floorId: input.floorId, backgroundId } };
}

/** i18n κλειδιά (`dxf-viewer-shell`) — ένα ανά αιτία· ίδιο κείμενο σε tooltip, πύλη και αποθήκευση. */
export const OVERLAY_DRAWING_BLOCK_MESSAGE_KEYS: Readonly<Record<OverlayDrawingBlockReason, string>> = {
  'no-level': 'overlayReadiness.noLevel',
  'no-floor': 'overlayReadiness.noFloor',
  'no-background': 'overlayReadiness.noBackground',
  'no-auth': 'overlayReadiness.noAuth',
};

/** Μόνο η «χωρίς αναφορά» έχει άμεση διόρθωση: άνοιγμα της εισαγωγής κάτοψης (ribbon action). */
export const OVERLAY_DRAWING_REMEDY_ACTIONS: Readonly<Partial<Record<OverlayDrawingBlockReason, string>>> = {
  'no-background': 'import-floorplan-wizard',
};

/** Τυποποιημένη απόρριψη αποθήκευσης — ο καλών διαβάζει την αιτία αντί να τη μαντεύει. */
export class OverlayPersistBlockedError extends Error {
  readonly reason: OverlayDrawingBlockReason;

  constructor(reason: OverlayDrawingBlockReason) {
    super(`Overlay persist blocked: ${reason}`);
    this.name = 'OverlayPersistBlockedError';
    this.reason = reason;
  }
}
