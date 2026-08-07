/**
 * ADR-771 Φ.3 — **η άγκυρα της σιωπηλής παράδοσης**.
 *
 * Αποδεικνύει ότι ο κλάδος αποτυχίας της `adaptColorToBackground` **δεν είναι θεωρητικός**:
 * τρέχει τον πραγματικό κώδικα πάνω στις **πραγματικές** επιφάνειες των preset θεμάτων —
 * διαβασμένες από το `variables.css`, όχι γραμμένες με το χέρι — και απαιτεί ότι το
 * `WALL_LINE_CONTRAST` αποτυγχάνει σε **ακριβώς ένα** από αυτά.
 *
 * ⚠️ **Κάθε ετυμηγορία εδώ προηγείται από βαθμονόμηση** (Κ0): ένας έλεγχος που δεν έχει
 * επαληθεύσει το όργανό του μπορεί να τυπώσει «ΑΝΕΦΙΚΤΟ» από `NaN` — συνέβη, γράφοντας το
 * handoff αυτής της φάσης.
 */

import fs from 'fs';
import path from 'path';

import {
  adaptInkForSurface,
  adaptStructuralLineColorForCanvas,
  adaptStructuralLineInkForCanvas,
  MIN_ENTITY_CONTRAST,
  SATURATED_LINE_THRESHOLD,
  _clearAdaptiveColorCache,
} from '../adaptive-entity-color';
import { contrastRatio } from '../color-math';
import { DEFAULT_CUSTOM_COLOR, PRESET_THEMES } from '../canvas-theme';
import { WALL_LINE_CONTRAST } from '../../bim/walls/wall-render-palette';

const WHITE = '#ffffff';
const BLACK = '#000000';

/** Το γκρι που το ίδιο το `#5b5b5b`/`#868686` εύρος περιβάλλει — φόντο του `cinema4d`. */
const CINEMA4D_SURFACE = '#555555';

// ── Επίλυση επιφανειών από το SSoT (ΔΕΥΤΕΡΗ ΦΩΝΗ, χειρόγραφη επίτηδες) ───────────────────
//
// Η πύλη CHECK 3.45 λύνει τα ίδια ονόματα με AST. Εδώ γίνεται ανεξάρτητα, με regex πάνω στο
// ίδιο αρχείο: αν οι δύο διαβάσεις αποκλίνουν, κάποια από τις δύο κάνει λάθος — και θέλουμε
// να το μάθουμε από test, όχι από στιγμιότυπο (ADR-587 §6.1).

const VARIABLES_CSS = path.join(
  process.cwd(), 'src', 'styles', 'design-system', 'generated', 'variables.css',
);

function cssCustomProperties(): ReadonlyMap<string, string> {
  const text = fs.readFileSync(VARIABLES_CSS, 'utf8');
  const out = new Map<string, string>();
  for (const m of text.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)[;}]/g)) out.set(m[1], m[2].trim());
  return out;
}

/** `#hex` → αυτούσιο· `var(--x)` → η τιμή του `--x`· ό,τι άλλο → `null` (fail-closed). */
function resolveSurface(cssValue: string, vars: ReadonlyMap<string, string>): string | null {
  if (cssValue.startsWith('#')) return cssValue.toLowerCase();
  const ref = /^var\((--[\w-]+)\)$/.exec(cssValue.trim());
  const value = ref ? vars.get(ref[1]) : undefined;
  return value && value.startsWith('#') ? value.toLowerCase() : null;
}

interface PresentableSurface { readonly key: string; readonly hex: string }

function presentableSurfaces(): readonly PresentableSurface[] {
  const vars = cssCustomProperties();
  const out: PresentableSurface[] = [];
  for (const theme of PRESET_THEMES) {
    const hex = resolveSurface(theme.cssValue, vars);
    if (hex === null) throw new Error(`Ανεπίλυτη επιφάνεια θέματος «${theme.key}»: ${theme.cssValue}`);
    out.push({ key: theme.key, hex });
  }
  out.push({ key: 'custom(default)', hex: DEFAULT_CUSTOM_COLOR.toLowerCase() });
  return out;
}

/** Το μέγιστο δυνατό contrast πάνω σε μια επιφάνεια: το καλύτερο από τα δύο άκρα. */
function maxAchievable(surfaceHex: string): number {
  return Math.max(contrastRatio(WHITE, surfaceHex), contrastRatio(BLACK, surfaceHex));
}

beforeEach(() => _clearAdaptiveColorCache());

// ── Κ0 — ΒΑΘΜΟΝΟΜΗΣΗ ────────────────────────────────────────────────────────────────────

describe('Κ0 — βαθμονόμηση πριν από κάθε ετυμηγορία', () => {
  it('λευκό vs μαύρο = 21,00 ακριβώς (αλλιώς το όργανο δεν μετρά αυτό που νομίζουμε)', () => {
    expect(contrastRatio(WHITE, BLACK)).toBeCloseTo(21, 2);
  });

  it('κάθε μέτρηση είναι πεπερασμένη — ποτέ ετυμηγορία από NaN', () => {
    for (const s of presentableSurfaces()) {
      expect(Number.isFinite(maxAchievable(s.hex))).toBe(true);
    }
  });

  it('και οι 9 επιφάνειες των preset θεμάτων επιλύονται σε hex (fail-closed)', () => {
    const surfaces = presentableSurfaces();
    expect(surfaces).toHaveLength(PRESET_THEMES.length + 1);
    for (const s of surfaces) expect(s.hex).toMatch(/^#[0-9a-f]{6}$/);
  });
});

// ── Α — Ο ΖΩΝΤΑΝΟΣ ΚΛΑΔΟΣ ───────────────────────────────────────────────────────────────

describe('Α — η σιωπηλή παράδοση είναι ΖΩΝΤΑΝΗ σήμερα', () => {
  it('cinema4d (#555555): το WALL_LINE_CONTRAST=9.0 είναι ΑΝΕΦΙΚΤΟ — μέγιστο 7,46:1', () => {
    const max = maxAchievable(CINEMA4D_SURFACE);
    expect(max).toBeLessThan(WALL_LINE_CONTRAST);
    expect(max).toBeCloseTo(7.46, 1);
  });

  it('η ετυμηγορία το ΛΕΕΙ: kind=shortfall, με achieved ΚΑΙ required', () => {
    const v = adaptInkForSurface('#2b2f36', CINEMA4D_SURFACE, WALL_LINE_CONTRAST);
    expect(v.kind).toBe('shortfall');
    if (v.kind !== 'shortfall') throw new Error('αδύνατο');
    expect(v.required).toBe(WALL_LINE_CONTRAST);
    expect(v.achieved).toBeCloseTo(7.46, 1);
    expect(v.achieved).toBeLessThan(v.required);
  });

  it('το μελάνι της αποτυχίας είναι το ΑΚΡΟ — καλύτερη δυνατή προσέγγιση, όχι παραίτηση', () => {
    const v = adaptInkForSurface('#2b2f36', CINEMA4D_SURFACE, WALL_LINE_CONTRAST);
    expect([WHITE, BLACK]).toContain(v.ink);
    expect(contrastRatio(v.ink, CINEMA4D_SURFACE)).toBeCloseTo(maxAchievable(CINEMA4D_SURFACE), 6);
  });

  it('ΑΚΡΙΒΩΣ ΕΝΑ preset θέμα αποτυγχάνει στο WALL_LINE_CONTRAST — και είναι το cinema4d', () => {
    const failing = presentableSurfaces()
      .filter((s) => adaptInkForSurface('#2b2f36', s.hex, WALL_LINE_CONTRAST).kind === 'shortfall')
      .map((s) => s.key);
    expect(failing).toEqual(['cinema4d']);
  });

  it('τα κατώφλια 3.0 / 2.0 είναι ΠΑΝΤΑ εφικτά — η αποτυχία δεν είναι γενική', () => {
    for (const s of presentableSurfaces()) {
      expect(adaptInkForSurface('#2b2f36', s.hex, MIN_ENTITY_CONTRAST).kind).toBe('sufficient');
    }
  });
});

// ── Β — ΟΙ ΤΡΕΙΣ ΚΑΤΑΣΤΑΣΕΙΣ, ΚΑΜΙΑ ΣΙΩΠΗΛΗ ────────────────────────────────────────────

describe('Β — τρεις ρητές καταστάσεις', () => {
  it('sufficient: κρατάει τη μέτρηση, δεν την κρύβει (θέση APCA)', () => {
    const v = adaptInkForSurface('#2b2f36', '#1d283a', WALL_LINE_CONTRAST);
    expect(v.kind).toBe('sufficient');
    if (v.kind !== 'sufficient') throw new Error('αδύνατο');
    expect(v.achieved).toBeGreaterThanOrEqual(v.required);
    expect(v.achieved).toBeCloseTo(contrastRatio(v.ink, '#1d283a'), 6);
  });

  it('unmeasurable: μη αναγνωρίσιμο μελάνι ⇒ ΚΑΜΙΑ αξίωση, ούτε επιτυχίας ούτε αποτυχίας', () => {
    const v = adaptInkForSurface('rgba(1,2,3,0.5)', '#1d283a', MIN_ENTITY_CONTRAST);
    expect(v.kind).toBe('unmeasurable');
    expect(v.ink).toBe('rgba(1,2,3,0.5)');
  });

  it('unmeasurable: άκυρη ΕΠΙΦΑΝΕΙΑ ⇒ επίσης αμέτρητο (και οι δύο πλευρές μετράνε)', () => {
    expect(adaptInkForSurface('#2b2f36', 'zzz', MIN_ENTITY_CONTRAST).kind).toBe('unmeasurable');
  });

  it('η ετυμηγορία ΜΕΤΡΑ το μελάνι που επέστρεψε — ποτέ δεν θυμάται κλάδο', () => {
    for (const s of presentableSurfaces()) {
      for (const color of ['#2b2f36', '#6b7280', '#ff0000', WHITE, BLACK]) {
        const v = adaptInkForSurface(color, s.hex, WALL_LINE_CONTRAST);
        if (v.kind === 'unmeasurable') continue;
        expect(v.achieved).toBeCloseTo(contrastRatio(v.ink, s.hex), 6);
        expect(v.kind === 'sufficient').toBe(v.achieved >= v.required);
      }
    }
  });
});

// ── Γ — ΜΙΑ ΜΝΗΜΗ, ΔΥΟ ΠΟΡΤΕΣ: ΟΙ ΔΥΟ ΥΠΟΓΡΑΦΕΣ ΔΕΝ ΜΠΟΡΟΥΝ ΝΑ ΑΠΟΚΛΙΝΟΥΝ ───────────

describe('Γ — ο wrapper δεν μπορεί να αποκλίνει από την ετυμηγορία', () => {
  it('adaptStructuralLineColorForCanvas === adaptStructuralLineInkForCanvas(...).ink, παντού', () => {
    for (const color of ['#2b2f36', '#6b7280', '#ff0000', '#b07d1f', 'rgba(1,2,3,0.5)', 'zzz']) {
      expect(adaptStructuralLineColorForCanvas(color, WALL_LINE_CONTRAST))
        .toBe(adaptStructuralLineInkForCanvas(color, WALL_LINE_CONTRAST).ink);
    }
  });

  it('κορεσμένο χρώμα ζητά το STANDARD κατώφλι — η ετυμηγορία το λέει στο required', () => {
    const v = adaptStructuralLineInkForCanvas('#ff0000', WALL_LINE_CONTRAST);
    expect(v.required).toBe(MIN_ENTITY_CONTRAST);
    expect(v.required).not.toBe(WALL_LINE_CONTRAST);
  });

  it('ουδέτερο γκρι (κάτω από το κατώφλι κορεσμού) ζητά το ΕΠΙΘΕΤΙΚΟ κατώφλι', () => {
    expect(adaptStructuralLineInkForCanvas('#2b2f36', WALL_LINE_CONTRAST).required)
      .toBe(WALL_LINE_CONTRAST);
    expect(SATURATED_LINE_THRESHOLD).toBeGreaterThan(0);
  });

  it('η μνήμη επιστρέφει την ΙΔΙΑ αναφορά — μηδέν δέσμευση στον βρόχο καρέ', () => {
    const a = adaptInkForSurface('#2b2f36', CINEMA4D_SURFACE, WALL_LINE_CONTRAST);
    const b = adaptInkForSurface('#2b2f36', CINEMA4D_SURFACE, WALL_LINE_CONTRAST);
    expect(a).toBe(b);
  });
});
