/**
 * @fileoverview **ΤΑ ΚΛΕΙΔΙΑ ΤΟΥ ΘΕΑΤΗ** — `spatial-tour:viewer.*` που ανήκουν **μόνο** στον θεατή (ADR-884 Φ1 · §4.8).
 * @related `../tour-access-labels.ts` (`VIEWER_KEYS` — τα κλειδιά της **επιφάνειας** θέασης: τίτλος, βάση, «ετοιμάζεται»)
 * @module components/spatial-tour/viewer/tour-viewer-labels
 *
 * 🔑 **Χωριστό αντικείμενο από το `VIEWER_KEYS`, επίτηδες** (μετρημένο 2026-09-27): ο γεννήτορας των route slices
 *   (ADR-744 §15) κουβαλά **όλο** το αντικείμενο κλειδιών που αγγίζει μια σελίδα. Το `TourViewSurface` αγγίζει το
 *   `VIEWER_KEYS` ⇒ αν τα κλειδιά του θεατή ζούσαν εκεί, το slice του `/listing/[id]/tour` θα μεγάλωνε με λέξεις που η
 *   σελίδα **δεν** δείχνει ακόμη. Ο θεατής φορτώνεται πίσω από `next/dynamic`: οι λέξεις του ταξιδεύουν μαζί του (Φ2).
 */

import type { TourDeclaredAreaSource, TourRoomType } from '@/constants/spatial-tour-vocabulary';

/** Η πηγή ενός δηλωμένου εμβαδού στη γλώσσα του επισκέπτη (Δ8.6) — ένα κλειδί ανά τιμή του `TOUR_DECLARED_AREA_SOURCES`. */
export const TOUR_DECLARED_SOURCE_KEY: Readonly<Record<TourDeclaredAreaSource, string>> = {
  'engineer-study': 'spatial-tour:viewer.declaredSource.engineerStudy',
  'site-measurement': 'spatial-tour:viewer.declaredSource.siteMeasurement',
  'owner-declared': 'spatial-tour:viewer.declaredSource.ownerDeclared',
};

export const TOUR_VIEWER_KEYS = {
  panorama: 'spatial-tour:viewer.panorama',
  point: 'spatial-tour:viewer.point',
  goTo: 'spatial-tour:viewer.goTo',
  placeOnFloor: 'spatial-tour:viewer.placeOnFloor',
  goToOnFloor: 'spatial-tour:viewer.goToOnFloor',
  panelTitle: 'spatial-tour:viewer.panelTitle',
  panelHint: 'spatial-tour:viewer.panelHint',
  openPanel: 'spatial-tour:viewer.openPanel',
  floors: 'spatial-tour:viewer.floors',
  floorNumbered: 'spatial-tour:viewer.floorNumbered',
  plan: 'spatial-tour:viewer.plan',
  youAreHere: 'spatial-tour:viewer.youAreHere',
  zoomIn: 'spatial-tour:viewer.zoomIn',
  zoomOut: 'spatial-tour:viewer.zoomOut',
  /** Η μεγέθυνση της **κάτοψης** (Φ2στ-γ Γ2) — άλλα κλειδιά από τα `zoomIn/zoomOut` του **πανοράματος**. */
  planZoom: 'spatial-tour:viewer.planZoom',
  planZoomIn: 'spatial-tour:viewer.planZoomIn',
  planZoomOut: 'spatial-tour:viewer.planZoomOut',
  planExpand: 'spatial-tour:viewer.planExpand',
  planColumnHide: 'spatial-tour:viewer.planColumnHide',
  planColumnShow: 'spatial-tour:viewer.planColumnShow',
  resizeColumn: 'spatial-tour:viewer.resizeColumn',
  // ── Σχήματα χώρων πάνω στην κάτοψη (Φ2στ-γ Γ3γ-1 · Δ8.4) ──
  spaceAreaMeasured: 'spatial-tour:viewer.spaceAreaMeasured',
  spaceAreaDeclared: 'spatial-tour:viewer.spaceAreaDeclared',
  spaceAreaNote: 'spatial-tour:viewer.spaceAreaNote',
  spaceDeclaredFrom: 'spatial-tour:viewer.spaceDeclaredFrom',
  loading: 'spatial-tour:viewer.loading',
  loadFailed: 'spatial-tour:viewer.loadFailed',
  noWebgl: 'spatial-tour:viewer.noWebgl',
} as const;

/** Ο τύπος χώρου στη γλώσσα του επισκέπτη (ADR-884 Φ2στ · §4.12) — ένα κλειδί ανά τιμή του `TOUR_ROOM_TYPES`. */
export const TOUR_ROOM_TYPE_KEY: Readonly<Record<TourRoomType, string>> = {
  'living-room': 'spatial-tour:rooms.types.living-room',
  kitchen: 'spatial-tour:rooms.types.kitchen',
  'dining-room': 'spatial-tour:rooms.types.dining-room',
  bedroom: 'spatial-tour:rooms.types.bedroom',
  bathroom: 'spatial-tour:rooms.types.bathroom',
  wc: 'spatial-tour:rooms.types.wc',
  entrance: 'spatial-tour:rooms.types.entrance',
  hallway: 'spatial-tour:rooms.types.hallway',
  office: 'spatial-tour:rooms.types.office',
  closet: 'spatial-tour:rooms.types.closet',
  storage: 'spatial-tour:rooms.types.storage',
  laundry: 'spatial-tour:rooms.types.laundry',
  'utility-room': 'spatial-tour:rooms.types.utility-room',
  balcony: 'spatial-tour:rooms.types.balcony',
  terrace: 'spatial-tour:rooms.types.terrace',
  patio: 'spatial-tour:rooms.types.patio',
  garage: 'spatial-tour:rooms.types.garage',
  basement: 'spatial-tour:rooms.types.basement',
  loft: 'spatial-tour:rooms.types.loft',
  staircase: 'spatial-tour:rooms.types.staircase',
  pantry: 'spatial-tour:rooms.types.pantry',
  'family-room': 'spatial-tour:rooms.types.family-room',
  'game-room': 'spatial-tour:rooms.types.game-room',
  'exercise-room': 'spatial-tour:rooms.types.exercise-room',
  other: 'spatial-tour:rooms.types.other',
};

/**
 * Τα κλειδιά του **ονόματος χώρου** εκτός από τους τύπους. Αντικείμενο και όχι σκέτη σταθερά, επίτηδες: ο αναλυτής του i18n
 * slice (ADR-744) επιλύει `t(OBJ.prop)`, όχι `t(ΣΤΑΘΕΡΑ)` — η σκέτη σταθερά έκανε κάθε σελίδα που φέρνει το `roomDisplayText`
 * (τα εισερχόμενα λήψεων, ADR-904 Κ8) να **αρνείται** slice.
 */
export const TOUR_ROOM_KEYS = {
  /** «Υπνοδωμάτιο 2» — η αρίθμηση όμοιων χώρων στον ίδιο όροφο (παράγεται στο `tourRoomDisplay`). */
  numbered: 'spatial-tour:rooms.numbered',
} as const;
