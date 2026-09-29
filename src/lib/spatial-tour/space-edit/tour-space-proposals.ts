/**
 * @fileoverview **ΟΙ ΠΡΟΤΑΣΕΙΣ ΧΩΡΩΝ ΤΟΥ ΕΠΕΞΕΡΓΑΣΤΗ** — για ποια σημεία ζητείται ανίχνευση, πότε ένα σημείο «απορροφάται» από
 * πρόταση άλλου, και τι στέλνεται στην έγκριση (ADR-884 Φ2στ-γ Γ3γ-2β · §4.14 · §12 Δ8.1 · Δ9.2). Καθαρό.
 * @related `space-detect/space-detect-plan.ts` (η ερώτηση/απάντηση του ανιχνευτή, σε μέτρα κάτοψης) ·
 *   `viewer/tour-space-view.ts` (`spaceAt` — ποιο σημείο έχει ήδη χώρο) · `tour-graph-edit.ts` (`TourSpaceDraft`)
 * @module lib/spatial-tour/space-edit/tour-space-proposals
 *
 * 🔑 **Αυτόματες προτάσεις, ποτέ αυτόματη δημοσίευση** (Matterport Property Layout · Revit «Place Rooms Automatically» — Δ8.1):
 *   κάθε σημείο χωρίς χώρο παίρνει πρόταση που ο άνθρωπος εγκρίνει **μία-μία**.
 * 🔑 **Ένας ενιαίος χώρος = ΜΙΑ πρόταση** (Δ8.2): αν η πρόταση του σαλονιού περιέχει και το σημείο της κουζίνας, η κουζίνα **δεν**
 *   παίρνει δική της (θα ήταν δύο αλληλοεπικαλυπτόμενα σχήματα που ο γραφέας αρνείται) — η πρόταση φέρνει τη **γραμμή
 *   διαχωρισμού** στο στενότερο σημείο, και μετά την έγκρισή της η ανίχνευση ξανατρέχει και για τα δύο.
 */

import type { TourDeclaredAreaSource, TourSpaceSource } from '@/constants/spatial-tour-vocabulary';
import { pointInPolygon, polygonArea } from '@/lib/geometry/planar-polygon';
import type { TourRoomInput } from '@/lib/spatial-tour/tour-room';

import type { TourPlanXY, TourSpaceDraft } from '../tour-graph-edit';
import type { PlanDetectRequest, PlanSegment, PlanSeparationSuggestion } from '../space-detect/space-detect-plan';
import type { PlacedPoint } from '../viewer/tour-space-view';

/** Μια πρόταση που περιμένει έγκριση — τοπική στην οθόνη ως την «Έγκριση» (Δ9.3). */
export interface SpaceProposal {
  /** Σταθερό κλειδί: το σημείο λήψης (`node:<id>`) ή το κλικ (`seed:<x>,<y>`) — ίδια ερώτηση ⇒ ίδιο κλειδί. */
  readonly key: string;
  /**
   * Το **οριστικό** id του χώρου που θα γίνει (`tspc_…`, N.6) — κόβεται όταν **γεννιέται** η πρόταση (Figma/Linear) και μένει ίδιο
   * σε κάθε επανανίχνευση του ίδιου κλειδιού· έτσι ο προέλεγχος (Δ9.6) κρίνει την **ίδια** εντολή που θα σταλεί.
   */
  readonly spaceId: string;
  readonly seed: TourPlanXY;
  readonly seedNodeId: string | null;
  /** `detected` = από την ανίχνευση (όσο κι αν διορθωθεί) · `manual` = σχεδιάστηκε με την πένα (Δ9.5). */
  readonly source: Extract<TourSpaceSource, 'detected' | 'manual'>;
  readonly outline: readonly TourPlanXY[];
  readonly orthogonal: boolean;
  /** Το **μετρημένο** εμβαδόν (m²) — «≈» (Δ8.4). */
  readonly areaM2: number;
  readonly separation: PlanSeparationSuggestion | null;
}

/** Η ερώτηση του επεξεργαστή χωρίς ό,τι ξέρει η κάτοψη (κλίμακα, πλάτος πρωτοτύπου) — βλ. `useSpaceDetector`. */
export type ProposalAsk = Omit<PlanDetectRequest, 'metresPerPixel' | 'imageWidth'>;

/** Ακρίβεια του κλειδιού κλικ — ένα εκατοστό: δύο κλικ στο ίδιο σημείο δεν γεννούν δύο προτάσεις. */
const SEED_KEY_PRECISION = 100;

export const proposalKeyOfNode = (nodeId: string): string => `node:${nodeId}`;

export function proposalKeyOfSeed(seed: TourPlanXY): string {
  const r = (v: number) => Math.round(v * SEED_KEY_PRECISION) / SEED_KEY_PRECISION;
  return `seed:${r(seed.x)},${r(seed.y)}`;
}

/**
 * **Η ερώτηση για έναν σπόρο**: όλα τα **άλλα** σημεία του ορόφου (ώστε ο ανιχνευτής να προτείνει διαχωρισμό όταν δύο σημεία
 * μοιράζονται χώρο) και όλες οι εγκεκριμένες νοητές γραμμές (τις βλέπει ως τοίχο).
 */
export function proposalAsk(
  seed: TourPlanXY,
  seedNodeId: string | null,
  placed: readonly PlacedPoint[],
  separations: readonly PlanSegment[],
  doorWidthM: number,
): ProposalAsk {
  const otherStops = placed.filter((p) => p.nodeId !== seedNodeId).map((p) => ({ x: p.point.x, y: p.point.y }));
  return { seed, otherStops, separations, doorWidthM };
}

/**
 * **Ποια ακάλυπτα σημεία θέλουν ακόμη δική τους πρόταση** — όσα δεν πέφτουν μέσα σε πρόταση που υπάρχει ήδη (Δ8.2: ένας ενιαίος
 * χώρος = μία πρόταση). Με τη σειρά που δόθηκαν.
 */
export function seedsStillNeeded(
  missing: readonly PlacedPoint[],
  proposals: readonly SpaceProposal[],
): readonly PlacedPoint[] {
  return missing.filter(({ nodeId, point }) => !proposals.some((p) =>
    p.seedNodeId === nodeId || pointInPolygon(point, p.outline)));
}

/** Ό,τι ορίζει ο άνθρωπος πάνω σε ένα σχήμα πριν την έγκριση (Δ8.5 · Δ8.6). */
export interface SpaceDraftDetails {
  readonly room: TourRoomInput | null;
  readonly declaredArea: { readonly areaM2: number; readonly source: TourDeclaredAreaSource } | null;
}

/**
 * **Τι στέλνεται στην έγκριση** — κορυφές όπως τις άφησε ο άνθρωπος, πηγή (`detected` αν ξεκίνησε από ανίχνευση, `manual` αν
 * σχεδιάστηκε με την πένα — ένα διορθωμένο «detected» μένει «detected»: η πρόταση ήταν η αρχή του), όνομα και δήλωση.
 */
export function spaceDraftOf(
  points: readonly TourPlanXY[],
  source: Extract<TourSpaceSource, 'detected' | 'manual'>,
  details: SpaceDraftDetails,
): TourSpaceDraft {
  return {
    points: points.map((p) => ({ x: p.x, y: p.y })),
    source,
    room: details.room,
    declaredArea: details.declaredArea,
  };
}

/**
 * **Το σχήμα της πένας ως πρόταση** (Δ9.5): κλείνει ⇒ περιμένει κι αυτό «Έγκριση» όπως κάθε πρόταση (Δ8.1 — ένα κλικ λάθος στην
 * πένα δεν δημοσιεύεται). Εμβαδόν μετρημένο από τις κορυφές· καμία πρόταση διαχωρισμού (ο άνθρωπος χάραξε τα όρια).
 */
export function penProposal(points: readonly TourPlanXY[], spaceId: string): SpaceProposal {
  const outline = points.map((p) => ({ x: p.x, y: p.y }));
  return {
    key: `pen:${spaceId}`, spaceId, seed: outline[0], seedNodeId: null, source: 'manual', outline,
    orthogonal: true, areaM2: polygonArea(outline), separation: null,
  };
}
