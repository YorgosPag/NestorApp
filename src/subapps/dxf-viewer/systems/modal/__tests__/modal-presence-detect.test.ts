/**
 * Tests for the pure modal-presence detector (ADR-040 cursor-lag Φ6).
 */

import { detectOpenModal, MODAL_Z_INDEX_THRESHOLD } from '../modal-presence-detect';
import { zIndexScale } from '@/styles/design-tokens/generated/tokens';

/**
 * 🔑 Η ΤΙΜΗ ΒΓΑΙΝΕΙ ΑΠΟ ΤΗΝ ΚΛΙΜΑΚΑ, ΟΧΙ ΩΜΗ (ADR-780 Φάση Γ).
 *
 * Μέχρι σήμερα εδώ έγραφε `'10000'` με σχόλιο «e.g. PromptDialog 10000». Ήταν αληθές τη
 * μέρα που γράφτηκε και **έπαψε** να είναι μόλις η κλίμακα συμπιέστηκε — δηλαδή ένα test
 * που τεκμηριώνει τον εαυτό του με αριθμό τον οποίο **κανείς δεν του λέει όταν αλλάζει**.
 * Διαβάζοντας τον ρόλο, το test γίνεται **άγκυρα**: αν ο `viewerPrompt` πέσει ποτέ κάτω
 * από το `MODAL_Z_INDEX_THRESHOLD`, ο ανιχνευτής θα σταματούσε σιωπηλά να βλέπει τον
 * διάλογο εντολών — και το κοκκίνισμα συμβαίνει **εδώ**, όχι στην οθόνη του χρήστη.
 */
const PROMPT_DIALOG_Z = String(zIndexScale.viewerPrompt);

function makeOverlay(opts: { zIndex?: string; display?: string; className?: string }): HTMLDivElement {
  const el = document.createElement('div');
  el.className = opts.className ?? 'fixed inset-0';
  if (opts.zIndex !== undefined) el.style.zIndex = opts.zIndex;
  if (opts.display !== undefined) el.style.display = opts.display;
  document.body.appendChild(el);
  return el;
}

describe('detectOpenModal', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('returns false when no overlay exists', () => {
    expect(detectOpenModal(document, window)).toBe(false);
  });

  it('returns false for a fixed inset-0 overlay below the z-index threshold', () => {
    makeOverlay({ zIndex: String(MODAL_Z_INDEX_THRESHOLD - 1) });
    expect(detectOpenModal(document, window)).toBe(false);
  });

  it('returns true for an overlay at the z-index threshold', () => {
    makeOverlay({ zIndex: String(MODAL_Z_INDEX_THRESHOLD) });
    expect(detectOpenModal(document, window)).toBe(true);
  });

  it('returns true for a high z-index modal overlay (the command prompt rung)', () => {
    makeOverlay({ zIndex: PROMPT_DIALOG_Z });
    expect(detectOpenModal(document, window)).toBe(true);
  });

  it('ignores a qualifying overlay that is display:none', () => {
    makeOverlay({ zIndex: PROMPT_DIALOG_Z, display: 'none' });
    expect(detectOpenModal(document, window)).toBe(false);
  });

  it('ignores elements that are not fixed inset-0', () => {
    const el = document.createElement('div');
    el.className = 'absolute inset-0';
    el.style.zIndex = PROMPT_DIALOG_Z;
    document.body.appendChild(el);
    expect(detectOpenModal(document, window)).toBe(false);
  });

  it('returns true if at least one of several overlays qualifies', () => {
    makeOverlay({ zIndex: '10' });
    makeOverlay({ zIndex: '60' });
    expect(detectOpenModal(document, window)).toBe(true);
  });
});
