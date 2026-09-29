/**
 * @fileoverview **ΤΑ ΣΧΗΜΑΤΑ ΤΩΝ ΧΩΡΩΝ ΟΠΩΣ ΤΑΞΙΔΕΥΟΥΝ ΣΤΟ ΜΑΝΙΦΕΣΤΟ** — η προβολή περιγραμμάτων και νοητών γραμμών ενός ορόφου
 * για τον θεατή και τον επεξεργαστή, και το αντίστροφό της (ADR-884 Φ2στ-γ Γ3γ-1 · §4.14 · §12 Δ8). Καθαρό.
 * @related `tour-viewer-graph.ts` (`TourViewerLevel`, `viewerLevelsOf` / `graphLevelsOfViewer`) · `tour-graph-inverse.ts`
 *   (`draftOf` — η προβολή κρατά **ακριβώς** ό,τι χρειάζεται) · `server/spatial-tour/tour-view-session.ts` (ο ΕΝΑΣ καλών)
 * @module lib/spatial-tour/viewer/tour-viewer-shapes
 *
 * 🔒 **Κανένα «ποιος/πότε» στο κοινό**: `approvedBy/approvedAt` και `declaredBy/declaredAt` **δεν** ταξιδεύουν — ο επισκέπτης δεν
 *   μαθαίνει ποιος ενέκρινε ή δήλωσε (ίδια αρχή με το `TourViewerPlan`, που δεν κουβαλά `approvedBy`).
 * 🔑 **Η προβολή είναι πλήρης για την αναίρεση**: σημεία, πηγή, όνομα, δηλωμένη τιμή + πηγή — το `draftOf` της αντίστροφης δεν
 *   ρωτά τίποτε άλλο, άρα η «Αναίρεση» αλλαγής/αφαίρεσης από την οθόνη ξαναγράφει **το ίδιο** σχήμα.
 * 🔒 **Κρυφά εμβαδά = επιβολή στον διακομιστή** (Φ0.4 · Δ8.4): `areas: 'hidden'` ⇒ το **δηλωμένο** εμβαδόν **δεν** φεύγει (δεν
 *   παράγεται από τη γεωμετρία). Το μετρημένο παράγεται από τις κορυφές — αυτό το κρύβει ο θεατής· δηλωμένο όριο, όχι ψεύτικη επιβολή.
 */

import type { TourDeclaredAreaSource, TourSpaceSource } from '@/constants/spatial-tour-vocabulary';
import type { PlanarPoint } from '@/lib/geometry/planar-polygon';
import type { TourLevel, TourRoom, TourSeparationLine, TourSpaceOutline } from '@/types/spatial-tour';

/** Δηλωμένο εμβαδόν όπως το βλέπει ο θεατής — τιμή + πηγή (Δ8.6), χωρίς «ποιος/πότε». */
export interface TourViewerDeclaredArea {
  readonly areaM2: number;
  readonly source: TourDeclaredAreaSource;
}

/** Περίγραμμα χώρου για τον θεατή (Γ3β `TourSpaceOutline` χωρίς σφραγίδες). */
export interface TourViewerSpace {
  readonly id: string;
  /** Μέτρα κάτοψης (πλαίσιο `imagePixelToPlan`: x ανατολή, y βορράς) — χωρίς επανάληψη της πρώτης. */
  readonly points: readonly PlanarPoint[];
  readonly source: TourSpaceSource;
  readonly room?: TourRoom | null;
  readonly declaredArea?: TourViewerDeclaredArea | null;
}

/** Νοητή διαχωριστική γραμμή για τον θεατή (Δ8.2) — χωρίς σφραγίδες. */
export interface TourViewerSeparation {
  readonly id: string;
  readonly a: PlanarPoint;
  readonly b: PlanarPoint;
}

/** Τι μέρος των σχημάτων φεύγει στο μανιφέστο. */
export interface ShapeProjection {
  /** `hidden` ⇒ χωρίς δηλωμένα εμβαδά (επισκέπτης, με τον διακόπτη κλειστό). */
  readonly areas: 'shown' | 'hidden';
}

export interface TourViewerShapes {
  readonly spaces?: readonly TourViewerSpace[];
  readonly separations?: readonly TourViewerSeparation[];
}

const xy = (p: PlanarPoint): PlanarPoint => ({ x: p.x, y: p.y });

function viewerSpaceOf(space: TourSpaceOutline, projection: ShapeProjection): TourViewerSpace {
  const declared = projection.areas === 'shown' ? space.declaredArea ?? null : null;
  return {
    id: space.id,
    points: space.points.map(xy),
    source: space.source,
    ...(space.room == null ? {} : { room: space.room }),
    ...(declared === null ? {} : { declaredArea: { areaM2: declared.areaM2, source: declared.source } }),
  };
}

/** Τα σχήματα ενός ορόφου για το μανιφέστο — κενή λίστα ⇒ το πεδίο λείπει (ίδια σύμβαση με το έγγραφο). */
export function viewerShapesOf(level: TourLevel, projection: ShapeProjection): TourViewerShapes {
  const spaces = (level.spaces ?? []).map((space) => viewerSpaceOf(space, projection));
  const separations = (level.separations ?? []).map((line) => ({ id: line.id, a: xy(line.a), b: xy(line.b) }));
  return {
    ...(spaces.length > 0 ? { spaces } : {}),
    ...(separations.length > 0 ? { separations } : {}),
  };
}

/**
 * **Το αντίστροφο** για τις καθαρές εντολές του επεξεργαστή: σχήματα `TourLevel` με **κενές** σφραγίδες (ίδιο πρότυπο με το
 * `scale.calibratedBy: ''` του `graphLevelsOfViewer`) — καμία εντολή και καμία αντίστροφη δεν τις ρωτά.
 */
export function graphShapesOfViewer(shapes: TourViewerShapes): Pick<TourLevel, 'spaces' | 'separations'> {
  const spaces = (shapes.spaces ?? []).map((space): TourSpaceOutline => {
    const { declaredArea, ...rest } = space;
    return {
      ...rest,
      approvedBy: '',
      approvedAt: '',
      ...(declaredArea == null ? {} : { declaredArea: { ...declaredArea, declaredBy: '', declaredAt: '' } }),
    };
  });
  const separations = (shapes.separations ?? []).map((line): TourSeparationLine => ({ ...line, approvedBy: '', approvedAt: '' }));
  return {
    ...(spaces.length > 0 ? { spaces } : {}),
    ...(separations.length > 0 ? { separations } : {}),
  };
}
