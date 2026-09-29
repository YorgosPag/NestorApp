/**
 * @fileoverview **`PointerEvent` ΓΙΑ ΤΟ jsdom** — το jsdom δεν το ορίζει, οπότε το `fireEvent.pointerDown(…, { clientX, pointerId })`
 * φτιάχνει γενικό `Event` και χάνονται `button`/`clientX`/`pointerId` (όριο περιβάλλοντος, όχι κώδικα).
 * @module test-utils/pointer-event
 *
 * 🔑 **Ένα αντίγραφο, όχι τρία** (N.0.2): ζούσε χειρόγραφο στα `TourArrowTools.test` και `TourViewer.test`· ο επεξεργαστής χώρων
 *   (ADR-884 Γ3γ-2β) θα ήταν το τρίτο. Το `setPointerCapture` λείπει κι αυτό από το jsdom — ορίζεται στο `Element`, ώστε να
 *   καλύπτει καμβά, SVG και HTML.
 */

export class TestPointerEvent extends MouseEvent {
  readonly pointerId: number;
  readonly pointerType: string;
  constructor(type: string, init: MouseEventInit & { pointerId?: number; pointerType?: string } = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    this.pointerType = init.pointerType ?? 'mouse';
  }
}

/** Καλείται σε `beforeAll`: `PointerEvent` + `setPointerCapture`/`releasePointerCapture` που δεν κάνουν τίποτα. */
export function installPointerEvents(): void {
  globalThis.PointerEvent = TestPointerEvent as unknown as typeof PointerEvent;
  Element.prototype.setPointerCapture = () => undefined;
  Element.prototype.releasePointerCapture = () => undefined;
}
