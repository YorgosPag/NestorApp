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

export const TOUR_VIEWER_KEYS = {
  panorama: 'spatial-tour:viewer.panorama',
  point: 'spatial-tour:viewer.point',
  goTo: 'spatial-tour:viewer.goTo',
  pointOnFloor: 'spatial-tour:viewer.pointOnFloor',
  goToOnFloor: 'spatial-tour:viewer.goToOnFloor',
  nearby: 'spatial-tour:viewer.nearby',
  floors: 'spatial-tour:viewer.floors',
  floorNumbered: 'spatial-tour:viewer.floorNumbered',
  plan: 'spatial-tour:viewer.plan',
  youAreHere: 'spatial-tour:viewer.youAreHere',
  zoomIn: 'spatial-tour:viewer.zoomIn',
  zoomOut: 'spatial-tour:viewer.zoomOut',
  loading: 'spatial-tour:viewer.loading',
  loadFailed: 'spatial-tour:viewer.loadFailed',
  noWebgl: 'spatial-tour:viewer.noWebgl',
} as const;
