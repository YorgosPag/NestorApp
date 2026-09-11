/**
 * ADR-711 · ADR-241 — **C1: ό,τι είναι έξω από την επιφάνεια γίνεται αδρανές — εκτός από τους συνοδούς.**
 *
 * Η πλωτή παλέτα του DXF αιωρείται **σκόπιμα** πάνω από την πλήρη οθόνη και ζει **μέσα** στη ρίζα της εφαρμογής
 * (μετρημένο ζωντανά 2026-09-11) — ένα σκέτο «αδρανές όλο το υπόλοιπο `body`» θα τη νέκρωνε. Οι ειδοποιήσεις (sonner)
 * ζουν σε `SECTION` παιδί του `body`· ούτε αυτές επιτρέπεται να σβήσουν.
 */

import { inertOutside } from '../inert-outside';

interface Page {
  readonly appRoot: HTMLElement;
  readonly sidebar: HTMLElement;
  readonly main: HTMLElement;
  readonly palette: HTMLElement;
  readonly canvas: HTMLElement;
  readonly surface: HTMLElement;
  readonly toaster: HTMLElement;
  readonly alreadyInert: HTMLElement;
}

function el(tag: string, parent: HTMLElement, attrs: Record<string, string> = {}): HTMLElement {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  parent.appendChild(node);
  return node;
}

function buildPage(): Page {
  document.body.innerHTML = '';
  const appRoot = el('div', document.body);
  const sidebar = el('nav', appRoot);
  const main = el('main', appRoot);
  const palette = el('aside', main, { 'data-fullscreen-companion': '' });
  const canvas = el('div', main);
  const surface = el('section', document.body, { role: 'dialog' });
  const toaster = el('section', document.body, { 'data-sonner-toaster': '' });
  const alreadyInert = el('div', document.body, { inert: '' });
  return { appRoot, sidebar, main, palette, canvas, surface, toaster, alreadyInert };
}

const isInert = (node: Element): boolean => node.hasAttribute('inert');

describe('C1 — αδρανές ό,τι είναι έξω, ζωντανοί οι συνοδοί', () => {
  test('το ΠΕΡΙΕΧΟΜΕΝΟ της επιφάνειας και του συνοδού μένει ζωντανό (όχι μόνο το ίδιο το στοιχείο)', () => {
    // Ο κρατούμενος ανήκει στη «διαδρομή»: ένας αλγόριθμος που δεν τον σταματά θα κατέβαινε μέσα του και θα
    // νέκρωνε τα παιδιά του — η επιφάνεια θα φαινόταν ζωντανή ενώ κανένα κουμπί της δεν θα πατιόταν.
    const p = buildPage();
    const insideSurface = el('button', p.surface);
    const insidePalette = el('button', p.palette);
    const release = inertOutside([p.surface]);
    expect(isInert(insideSurface)).toBe(false);
    expect(isInert(insidePalette)).toBe(false);
    release();
  });

  test('η επιφάνεια, ο ένθετος συνοδός και ο toaster μένουν ζωντανά· τα αδέλφια σβήνουν', () => {
    const p = buildPage();
    const release = inertOutside([p.surface]);
    expect(isInert(p.sidebar)).toBe(true);
    expect(isInert(p.canvas)).toBe(true);
    expect(isInert(p.appRoot)).toBe(false); // περιέχει συνοδό ⇒ κατεβαίνουμε, δεν σβήνει ολόκληρη
    expect(isInert(p.main)).toBe(false);
    expect(isInert(p.palette)).toBe(false);
    expect(isInert(p.surface)).toBe(false);
    expect(isInert(p.toaster)).toBe(false);
    release();
  });

  test('η αποδέσμευση επαναφέρει ΜΟΝΟ ό,τι άγγιξε — το ήδη αδρανές μένει αδρανές', () => {
    const p = buildPage();
    const release = inertOutside([p.surface]);
    release();
    expect(isInert(p.sidebar)).toBe(false);
    expect(isInert(p.canvas)).toBe(false);
    expect(isInert(p.alreadyInert)).toBe(true);
  });

  test('ιδempotent αποδέσμευση', () => {
    const p = buildPage();
    const release = inertOutside([p.surface]);
    release();
    const second = inertOutside([p.surface]);
    release(); // δεύτερη κλήση της ΠΑΛΙΑΣ αποδέσμευσης: δεν επιτρέπεται να ξεκλειδώσει τη νέα
    expect(isInert(p.sidebar)).toBe(true);
    second();
  });

  test('δύο επιφάνειες: η αποδέσμευση της μίας δεν ξεκλειδώνει ό,τι κρατά η άλλη (μέτρηση αναφορών)', () => {
    const p = buildPage();
    const first = inertOutside([p.surface]);
    const second = inertOutside([p.surface]);
    first();
    expect(isInert(p.sidebar)).toBe(true);
    second();
    expect(isInert(p.sidebar)).toBe(false);
  });

  test('ό,τι προσαρτηθεί ΜΕΤΑ (διάλογος με portal στο body) μένει ζωντανό', () => {
    const p = buildPage();
    const release = inertOutside([p.surface]);
    const dialog = el('div', document.body, { role: 'dialog' });
    expect(isInert(dialog)).toBe(false);
    release();
  });
});
