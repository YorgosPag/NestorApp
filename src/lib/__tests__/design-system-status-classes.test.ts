/**
 * ΑΓΚΥΡΑ — **κάθε κλάση που επιστρέφει η `getStatusColor` μπορεί να τη ΔΕΙ το Tailwind.**
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ (μετρημένο στον browser, 2026-10-10, ADR-910 §6.3): το όνομα της κλάσης συντίθετο με παρεμβολή
 * (πρόθεμα + μεταβλητή σε template literal). Το Tailwind σαρώνει κείμενο, άρα δεν την παρήγαγε ποτέ: 7 από τους 15
 * συνδυασμούς δεν είχαν CSS, και το μήνυμα «δύο όροφοι με τον ίδιο αριθμό» έβγαινε λευκό, ίδιο με προειδοποίηση.
 * Κανένα test δεν το έπιανε, γιατί το jsdom δεν έχει CSS: η κλάση «υπήρχε» στο DOM.
 *
 * Το ερώτημα εδώ είναι το μόνο που μπορεί να απαντηθεί χωρίς browser: **υπάρχει η συμβολοσειρά αυτούσια σε αρχείο
 * που σαρώνει το Tailwind;**
 */

import { readRepoCode, readRepoFile } from '@/test-utils/read-source';
import { isScannedByTailwind } from '@/test-utils/tailwind-content';
import {
  getStatusBadgeClass,
  getStatusBadgeVariant,
  getStatusColor,
  getStatusSolidClass,
  getStatusSurfaceClass,
} from '../design-system';
import { COLOR_BRIDGE, SOLID_FILL_INK, type SolidFillKey } from '@/design-system/color-bridge';

const SOURCE = 'src/lib/design-system.ts';
const VARIANTS = ['bg', 'text', 'border'] as const;
/** Ένα αντιπροσωπευτικό status ανά χρώμα, συν ένα άγνωστο (εφεδρεία). */
const STATUSES = ['success', 'available', 'info', 'pending', 'warning', 'reserved', 'error', 'sold', 'owner', '__unknown__'];

describe('getStatusColor — κλάσεις ορατές στο Tailwind', () => {
  const code = readRepoCode(SOURCE);

  it.each(STATUSES.flatMap((status) => VARIANTS.map((variant) => [status, variant] as const)))(
    '%s / %s ⇒ η κλάση υπάρχει ΑΥΤΟΥΣΙΑ στο αρχείο που τη δηλώνει',
    (status, variant) => {
      const cls = getStatusColor(status, variant);
      expect(cls).toMatch(new RegExp(`^${variant}-\\[hsl\\(var\\(--status-[a-z]+\\)\\)\\]$`));
      expect(code).toContain(`'${cls}'`);
    },
  );

  it('🔴 καμία κλάση με παρεμβολή — ΟΥΤΕ ΣΕ ΣΧΟΛΙΟ (το Tailwind σαρώνει και τα σχόλια)', () => {
    // Ωμό αρχείο, όχι `readRepoCode`: ένα σχόλιο που ανέφερε το παλιό όνομα γέννησε άκυρο CSS και έριξε όλο το
    // `globals.css` («Unexpected token Delim('$')») την ίδια μέρα που γράφτηκε αυτή η άγκυρα.
    expect(readRepoFile(SOURCE)).not.toMatch(/-\[[^\]\s]*\$\{/);
  });

  it('το Tailwind σαρώνει το αρχείο που κρατά τις κλάσεις', () => {
    expect(isScannedByTailwind(SOURCE)).toBe(true);
  });

  it('κάθε κατάσταση παίρνει το ΔΙΚΟ της χρώμα — το `success` δεν πέφτει στην εφεδρεία', () => {
    expect(getStatusColor('error', 'text')).toBe('text-[hsl(var(--status-error))]');
    expect(getStatusColor('warning', 'border')).toBe('border-[hsl(var(--status-warning))]');
    expect(getStatusColor('success', 'bg')).toBe('bg-[hsl(var(--status-success))]');
    expect(getStatusColor('info', 'text')).toBe('text-[hsl(var(--status-info))]');
    expect(getStatusColor('__unknown__')).toBe('text-[hsl(var(--status-info))]');
  });
});

/**
 * ΡΟΛΟΙ ΚΑΤΑΣΤΑΣΗΣ (ADR-770, 2026-10-29) — γέμισμα και μελάνι ΠΟΤΕ από το ίδιο token.
 * Μετρημένο στον browser (PO-0001): `getStatusColor(x,'bg')` + `getStatusColor(x,'text')` ⇒ `color` = `background-color`.
 */
describe('ρόλοι κατάστασης — badge · solid · surface', () => {
  const ALL = ['success', 'available', 'info', 'pending', 'warning', 'reserved', 'error', 'sold', 'owner', '__unknown__'];
  const statusToken = (cls: string) => /--status-([a-z]+)/.exec(cls)?.[1];

  it.each(ALL)('%s ⇒ η παραλλαγή Badge ακολουθεί το ΙΔΙΟ token με το getStatusColor', (status) => {
    const token = statusToken(getStatusColor(status, 'bg'));
    expect(getStatusBadgeVariant(status)).toBe(token);
  });

  it.each(ALL)('%s ⇒ το συμπαγές παίρνει το ΜΕΤΡΗΜΕΝΟ μελάνι (SOLID_FILL_INK), όχι το ίδιο token', (status) => {
    const [fill, ink] = getStatusSolidClass(status).split(' ');
    expect(fill).toBe(getStatusColor(status, 'bg'));
    const fillKey = (Object.keys(SOLID_FILL_INK) as SolidFillKey[]).find((k) => COLOR_BRIDGE.bg[k] === fill);
    expect(fillKey).toBeDefined();
    expect(ink).toBe(COLOR_BRIDGE.text[SOLID_FILL_INK[fillKey as SolidFillKey]]);
  });

  it.each(ALL)('%s ⇒ η απαλή επιφάνεια ΔΕΝ χρησιμοποιεί --status-* ως μελάνι', (status) => {
    expect(getStatusSurfaceClass(status)).not.toMatch(/text-\[hsl\(var\(--status-/);
  });

  it('απαλό ζεύγος = `--bg-X` + `--text-X` (μετρημένο 5,78…7,84:1 και στα δύο θέματα)', () => {
    expect(getStatusSurfaceClass('success')).toBe('bg-[hsl(var(--bg-success))] text-[hsl(var(--text-success))]');
    expect(getStatusSurfaceClass('reserved')).toBe('bg-[hsl(var(--bg-warning))] text-[hsl(var(--text-warning))]');
    expect(getStatusSurfaceClass('sold')).toBe('bg-[hsl(var(--bg-error))] text-[hsl(var(--text-error))]');
  });

  it('purple ΔΕΝ έχει απαλό ζεύγος ⇒ πέφτει ΡΗΤΑ στο συμπαγές (όχι σιωπηλά σε άλλο χρώμα)', () => {
    expect(getStatusSurfaceClass('owner')).toBe(getStatusSolidClass('owner'));
  });

  it('getStatusBadgeClass: το συμπαγές σήμα δεν φοράει πια `text-white` σε success/warning (2,30 / 3,16:1)', () => {
    expect(getStatusBadgeClass('success')).toContain(COLOR_BRIDGE.text.onSolidDark);
    expect(getStatusBadgeClass('warning')).toContain(COLOR_BRIDGE.text.onSolidDark);
    expect(getStatusBadgeClass('error')).toContain(COLOR_BRIDGE.text.onSolid);
  });
});
