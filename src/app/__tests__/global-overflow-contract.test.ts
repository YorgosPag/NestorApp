/**
 * ADR-750 §21.10 · ADR-780 §5quater.5 #6 — **Ο ΚΑΘΟΛΙΚΟΣ ΚΑΝΟΝΑΣ ΥΠΕΡΧΕΙΛΙΣΗΣ ΔΕΝ ΦΤΙΑΧΝΕΙ SCROLL CONTAINERS**.
 *
 * 🔴 **Δύο ζωντανές βλάβες, μία ρίζα** (`globals.css`, «Prevent horizontal overflow on mobile»):
 *   1. **2026-08-07 (ADR-750 §21.10)**: το popup χρωμάτων άνοιγε κάθε φορά — ορθογώνιο 246×217 στο y=989 μέσα σε
 *      `<section>` που τελείωνε στο y=985. **Ψαλιδισμένο στο μηδέν**, με 717 πράσινα tests.
 *   2. **2026-09-11 (ADR-332 D27, Ζ8)**: στην πλήρη οθόνη του Πίνακα Ελέγχου Χρονοδιαγράμματος η `<header>` με
 *      Ανανέωση / έξοδο / Export μετρήθηκε **ύψος 0** (scrollHeight 36) — τα κουμπιά δεν πατιούνταν.
 *
 * 🔑 **Ο μηχανισμός (CSS Overflow 3)**: `overflow-x: hidden` μετατρέπει το `visible` του **άλλου** άξονα σε `auto` ⇒
 * κάθε `header` / `main` / `section` της εφαρμογής γινόταν **scroll container** ⇒ (α) κόβει τους `absolute` απογόνους
 * του, (β) ως στοιχείο flex το αυτόματο ελάχιστο μέγεθός του γίνεται **0** (css-flexbox-1 §4.5) και συρρικνώνεται ως
 * το μηδέν μέσα σε στήλη που ξεχειλίζει. Πείραμα στη ζωντανή σελίδα: `flex-shrink: 0` ⇒ 36px.
 *
 * ✅ **Η θεραπεία**: `overflow-x: clip` — κόβει οριζόντια (η αρχική πρόθεση) **χωρίς** να φτιάχνει scroll container
 * και **χωρίς** να αγγίζει τον άλλο άξονα — και επιλογέας **`:where(...)`** (μηδενική ειδικότητα), ώστε **κάθε**
 * ρητή utility `overflow-*` του ίδιου του στοιχείου να νικά τον καθολικό κανόνα.
 *
 * ⚠️ **ΤΙ ΔΕΝ ΜΠΟΡΕΙ ΝΑ ΔΕΙ ΑΥΤΗ Η ΑΓΚΥΡΑ**: το jsdom δεν έχει διάταξη — δεν υπολογίζει `overflow`, δεν κόβει, δεν
 * συρρικνώνει. Εδώ κρίνεται η **δήλωση**· η **συνέπεια** μετριέται ζωντανά με το όργανο εύρους του ADR-750 §21.10
 * (στοιχεία που κυλούν *μόνο* χάρη στον κανόνα).
 *
 * @jest-environment node
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const GLOBALS_CSS = path.join(__dirname, '..', 'globals.css');
const RIBBON_CSS = path.join(
  __dirname, '..', '..', 'subapps', 'dxf-viewer', 'ui', 'ribbon', 'styles', 'ribbon-tokens.css',
);

const BLOCK_COMMENT = new RegExp(String.raw`/\*[\s\S]*?\*/`, 'g');

interface CssRule {
  readonly selector: string;
  readonly body: string;
  /** Το `@layer` που περικλείει τον κανόνα, ή `null` αν ζει εκτός layer (Υ4). */
  readonly layer: string | null;
}

/**
 * Οι κανόνες ενός stylesheet **χωρίς σχόλια**, ως επιλογέας / σώμα / layer. Σάρωση με στοίβα αγκίστρων:
 * κάθε `{` ανοίγει το κείμενο που προηγείται (επιλογέας ή at-rule), κάθε `}` το κλείνει· τα at-rules
 * (`@media`, `@layer`) ξεδιπλώνονται και μένουν ως πλαίσιο.
 */
function rulesOf(file: string): readonly CssRule[] {
  const css = fs.readFileSync(file, 'utf8').replace(BLOCK_COMMENT, '');
  const stack: string[] = [];
  const rules: CssRule[] = [];
  let text = '';
  for (const ch of css) {
    if (ch === '{') {
      stack.push(text.trim());
      text = '';
    } else if (ch === '}') {
      const selector = stack.pop() ?? '';
      if (!selector.startsWith('@')) {
        const layer = [...stack].reverse().find((s) => s.startsWith('@layer'));
        rules.push({ selector, body: text, layer: layer ? layer.replace('@layer', '').trim() : null });
      }
      text = '';
    } else {
      text += ch;
    }
  }
  return rules;
}

/** Η τιμή του `overflow-x` σε ένα σώμα κανόνα, ή `null`. */
function overflowXOf(body: string): string | null {
  const found = /(?:^|;)\s*overflow-x\s*:\s*([^;]+)/.exec(body);
  return found ? found[1].trim() : null;
}

/** Οι επιλογείς ενός κανόνα που **αναφέρουν** το δοσμένο στοιχείο ως γυμνό τύπο (όχι π.χ. `.fc-popover-header`). */
function targetsBareElement(selector: string, element: string): boolean {
  return new RegExp(String.raw`(^|[\s,(>+~])${element}(?=$|[\s,):>+~.[#])`).test(selector);
}

const GLOBAL_TARGETS = ['header', 'main', 'section'] as const;

describe('Υ1 — ο καθολικός κανόνας σε header / main / section κόβει με `clip`, ποτέ με `hidden`', () => {
  const rules = rulesOf(GLOBALS_CSS);
  const global = rules.filter(
    (r) => GLOBAL_TARGETS.some((el) => targetsBareElement(r.selector, el)) && overflowXOf(r.body) !== null,
  );

  test('υπάρχει ο κανόνας (η άγκυρα δεν επιτρέπεται να περάσει επειδή δεν βρήκε τίποτα)', () => {
    expect(global.length).toBeGreaterThan(0);
  });

  test.each(global.map((r) => [r.selector]))('`%s` → overflow-x: clip', (selector) => {
    const rule = global.find((r) => r.selector === selector);
    expect(overflowXOf(rule?.body ?? '')).toBe('clip');
  });

  test.each(global.map((r) => [r.selector]))('`%s` → μηδενική ειδικότητα (`:where(...)`)', (selector) => {
    expect(selector.startsWith(':where(')).toBe(true);
  });
});

describe('Υ2 — ο κανόνας κινητού σε .flex / .grid δεν ακυρώνει τις utilities', () => {
  const rules = rulesOf(GLOBALS_CSS).filter(
    (r) => /(^|[\s,(])\.(flex|grid)(?=$|[\s,)])/.test(r.selector) && overflowXOf(r.body) !== null,
  );

  test('υπάρχει ο κανόνας', () => {
    expect(rules.length).toBeGreaterThan(0);
  });

  test.each(rules.map((r) => [r.selector]))('`%s` → clip, χωρίς !important, μέσα σε :where(...)', (selector) => {
    const rule = rules.find((r) => r.selector === selector);
    const value = overflowXOf(rule?.body ?? '') ?? '';
    expect(value).toBe('clip');
    expect(selector.startsWith(':where(')).toBe(true);
  });
});

describe('Υ4 — οι καθολικοί κανόνες ζουν ΕΞΩ από κάθε `@layer` (εκεί το Tailwind δεν τους παράγει παραλλαγές)', () => {
  // 🔴 2026-09-25 (ADR-797 §Φ.Ρ.1): στο `@layer utilities` το Tailwind v3 διάβασε το `if (!container)` του
  // κώδικα JS ως important modifier και παρήγαγε `:where(.\!container, …, header, main, section)
  // { overflow-x: clip !important }` — ακύρωνε ΚΑΘΕ `overflow-x-auto`. Υ1/Υ2 έμεναν πράσινες: κρίνουν τη
  // δήλωση, και η δήλωση ήταν σωστή. Αυτό που ψεύδεται είναι η θέση της.
  // ⚠️ ΟΥΤΕ `@layer base`: μετρήθηκε ότι ο `.\!grid` παραγόταν και από εκεί — το Tailwind v3 καταχωρεί
  // τις κλάσεις ΚΑΘΕ layer. Μόνο το CSS εκτός layer στέλνεται όπως γράφτηκε.
  const global = rulesOf(GLOBALS_CSS).filter(
    (r) =>
      overflowXOf(r.body) !== null &&
      (GLOBAL_TARGETS.some((el) => targetsBareElement(r.selector, el)) ||
        /(^|[\s,(])\.(flex|grid)(?=$|[\s,)])/.test(r.selector)),
  );

  test('βρέθηκαν οι κανόνες (Υ1 + Υ2)', () => {
    expect(global.length).toBeGreaterThanOrEqual(2);
  });

  test.each(global.map((r) => [r.selector, r.layer]))('`%s` → εκτός layer (βρέθηκε: %s)', (_selector, layer) => {
    expect(layer).toBeNull();
  });
});

describe('Υ3 — ό,τι στηριζόταν στο τυχαίο κάθετο κόψιμο το δηλώνει ρητά', () => {
  test('`.dxf-ribbon-panel` κόβει μόνο του (μετρημένο: 110px ορατά έναντι 160/377/132 περιεχομένου)', () => {
    const panel = rulesOf(RIBBON_CSS).find((r) => r.selector === '.dxf-ribbon-panel');
    expect(panel).toBeDefined();
    expect(/(?:^|;)\s*overflow\s*:\s*clip/.test(panel?.body ?? '')).toBe(true);
  });
});
