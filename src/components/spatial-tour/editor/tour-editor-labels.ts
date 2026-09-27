/**
 * @fileoverview **ΤΑ ΚΛΕΙΔΙΑ ΤΗΣ ΟΘΟΝΗΣ ΤΟΠΟΘΕΤΗΣΗΣ** — `spatial-tour:editor.*` (ADR-884 Φ2δ · §4.10).
 * @related `../viewer/tour-viewer-labels.ts` (τα κλειδιά του θεατή — ίδιο σκεπτικό χωριστού αντικειμένου) ·
 *   `../spatial-tour-labels.ts` (`TOUR_REFUSAL_KEY` — οι αρνήσεις του γράφου ζουν εκεί, στο ΕΝΑ λεξιλόγιο)
 * @module components/spatial-tour/editor/tour-editor-labels
 *
 * 🔑 **Χωριστό αντικείμενο**: η οθόνη φορτώνεται πίσω από `next/dynamic` μόνο για τον υπεύθυνο — οι λέξεις της δεν
 *   ταξιδεύουν στο slice της σελίδας του ακινήτου (ADR-744 §15).
 */

export const TOUR_EDITOR_KEYS = {
  open: 'spatial-tour:editor.open',
  title: 'spatial-tour:editor.title',
  description: 'spatial-tour:editor.description',
  inbox: 'spatial-tour:editor.inbox',
  inboxEmpty: 'spatial-tour:editor.inboxEmpty',
  baking: 'spatial-tour:editor.baking',
  failed: 'spatial-tour:editor.failed',
  points: 'spatial-tour:editor.points',
  noPoints: 'spatial-tour:editor.noPoints',
  missingArrows: 'spatial-tour:editor.missingArrows',
  selectPrompt: 'spatial-tour:editor.selectPrompt',
  notReadyHint: 'spatial-tour:editor.notReadyHint',
  failedHint: 'spatial-tour:editor.failedHint',
  placeHeading: 'spatial-tour:editor.placeHeading',
  floor: 'spatial-tour:editor.floor',
  newFloor: 'spatial-tour:editor.newFloor',
  mode: 'spatial-tour:editor.mode',
  modeNew: 'spatial-tour:editor.modeNew',
  modeNextTo: 'spatial-tour:editor.modeNextTo',
  modeSameAs: 'spatial-tour:editor.modeSameAs',
  neighbour: 'spatial-tour:editor.neighbour',
  place: 'spatial-tour:editor.place',
  placed: 'spatial-tour:editor.placed',
  remove: 'spatial-tour:editor.remove',
  removeTitle: 'spatial-tour:editor.removeTitle',
  removeLast: 'spatial-tour:editor.removeLast',
  removeOne: 'spatial-tour:editor.removeOne',
  removed: 'spatial-tour:editor.removed',
  arrows: 'spatial-tour:editor.arrows',
  arrowsHint: 'spatial-tour:editor.arrowsHint',
  arrowHere: 'spatial-tour:editor.arrowHere',
  arrowHereFor: 'spatial-tour:editor.arrowHereFor',
  dragArrow: 'spatial-tour:editor.dragArrow',
  arrowMissing: 'spatial-tour:editor.arrowMissing',
  arrowSaved: 'spatial-tour:editor.arrowSaved',
  otherPoints: 'spatial-tour:editor.otherPoints',
  unlink: 'spatial-tour:editor.unlink',
  unlinked: 'spatial-tour:editor.unlinked',
  undo: 'spatial-tour:editor.undo',
  saveFailed: 'spatial-tour:editor.saveFailed',
  roomTitle: 'spatial-tour:editor.roomTitle',
  roomType: 'spatial-tour:editor.roomType',
  roomTypePlaceholder: 'spatial-tour:editor.roomTypePlaceholder',
  roomAlsoType: 'spatial-tour:editor.roomAlsoType',
  roomAddType: 'spatial-tour:editor.roomAddType',
  roomRemoveType: 'spatial-tour:editor.roomRemoveType',
  roomLabel: 'spatial-tour:editor.roomLabel',
  roomLabelHint: 'spatial-tour:editor.roomLabelHint',
  roomPreview: 'spatial-tour:editor.roomPreview',
  roomSave: 'spatial-tour:editor.roomSave',
  roomClear: 'spatial-tour:editor.roomClear',
  roomSaved: 'spatial-tour:editor.roomSaved',
} as const;
