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
import { getStatusColor } from '../design-system';

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
