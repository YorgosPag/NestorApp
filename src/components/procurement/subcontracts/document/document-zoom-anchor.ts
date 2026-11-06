/**
 * **Το ζουμ που δεν σε χάνει** (ADR-928 §5.25) — ό,τι κοιτάς πριν το ζουμ, το κοιτάς και μετά.
 *
 * 🔑 Ctrl+ροδέλα / pinch: ακίνητο μένει το σημείο **κάτω από τον δείκτη** (Figma · Google Maps).
 *    Κουμπιά / μενού: ακίνητη μένει **η παράγραφος που διαβάζεις** — η πρώτη ορατή γραμμή της σελίδας (Word).
 * 🔑 Άγκυρα σε **κλάσματα** της σελίδας (0..1), όχι σε px: δεν εξαρτάται από το αν το `getBoundingClientRect` μετρά με ή
 *    χωρίς το CSS `zoom` του στοιχείου — μετά την αλλαγή, το ίδιο κλάσμα της νέας σελίδας ξαναπηγαίνει στο ίδιο σημείο.
 * 🔑 Κάθετα κυλά ο πλησιέστερος πρόγονος που **κυλά** (στήλη επεξεργαστή ή η ίδια η σελίδα)· οριζόντια, το πλαίσιο της
 *    στήλης (μεγάλο χειροκίνητο ζουμ ⇒ οριζόντια κύλιση, όπως σε προβολέα PDF).
 */

import { clamp01 } from '@/lib/geometry/scalar';
import type { Vec2 } from '@/lib/geometry/zoom-pan-math';

/** Η άγκυρα της «παραγράφου ανάγνωσης» αφήνει χώρο κάτω από κολλημένες κεφαλίδες (καρτέλες, μπάρα εργαλείων). */
const READING_LINE_OFFSET_PX = 64;

export interface ZoomAnchor {
  readonly page: HTMLElement;
  readonly frame: HTMLElement;
  /** Το σημείο της οθόνης που πρέπει να δείχνει το ίδιο κομμάτι της σελίδας. */
  readonly point: Vec2;
  /** Πού πέφτει το σημείο μέσα στη σελίδα, ως κλάσμα πλάτους/ύψους. */
  readonly fraction: Vec2;
}

/**
 * Ο πλησιέστερος πρόγονος που **κυλά κάθετα**. ⚠️ Όχι «που κόβει» (`useFillViewportHeight.boundaryOf`): ένα
 * `overflow-hidden` κουτί δεν κυλά, και η διόρθωση θα χανόταν.
 */
function verticalScrollerOf(element: HTMLElement): HTMLElement {
  for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) {
    const { overflowY } = window.getComputedStyle(node);
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) return node;
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}

function viewportTopOf(scroller: HTMLElement): number {
  return scroller === document.scrollingElement ? 0 : scroller.getBoundingClientRect().top;
}

export function captureZoomAnchor(page: HTMLElement, frame: HTMLElement, point: Vec2): ZoomAnchor {
  const rect = page.getBoundingClientRect();
  const fraction = {
    x: rect.width > 0 ? clamp01((point.x - rect.left) / rect.width) : 0,
    y: rect.height > 0 ? clamp01((point.y - rect.top) / rect.height) : 0,
  };
  return { page, frame, point, fraction };
}

/** Η «παράγραφος ανάγνωσης»: η πρώτη ορατή γραμμή της σελίδας, στο κέντρο του ορατού πλάτους της στήλης. */
export function readingPointOf(page: HTMLElement, frame: HTMLElement): Vec2 {
  const rect = page.getBoundingClientRect();
  const frameRect = frame.getBoundingClientRect();
  const visibleTop = Math.max(rect.top, viewportTopOf(verticalScrollerOf(page)));
  const y = Math.min(visibleTop + READING_LINE_OFFSET_PX, rect.bottom);
  return { x: frameRect.left + frameRect.width / 2, y };
}

/** Μετά την αλλαγή ζουμ: κύλιση ώστε το ίδιο κλάσμα της σελίδας να ξαναβρεθεί κάτω από το ίδιο σημείο. */
export function restoreZoomAnchor(anchor: ZoomAnchor): void {
  const rect = anchor.page.getBoundingClientRect();
  const dx = rect.left + anchor.fraction.x * rect.width - anchor.point.x;
  const dy = rect.top + anchor.fraction.y * rect.height - anchor.point.y;
  if (Math.abs(dy) >= 1) verticalScrollerOf(anchor.page).scrollTop += dy;
  if (Math.abs(dx) >= 1) anchor.frame.scrollLeft += dx;
}
