/**
 * ΑΓΚΥΡΑ — **κάθε κλάση των SSoT συνδέσμων μπορεί να τη ΔΕΙ το Tailwind** (ADR-242 Βήμα 4).
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ (μετρημένο ζωντανά στο nestorconstruct.gr, 2026-10-22): το `lib/ui/link-style.ts` είναι `.ts` μέσα στο
 * `src/lib`, που το Tailwind σαρώνει μόνο για `.tsx`. Οι κλάσεις που ζουν ΜΟΝΟ εκεί (`decoration-1`,
 * `hover:decoration-2`) δεν είχαν CSS από τη μέρα που γράφτηκε το αρχείο (ADR-890, 29/09) — η υπογράμμιση έβγαινε
 * επειδή το `underline` υπάρχει και αλλού. Ίδιο σχήμα με το `design-system-status-classes.test.ts` (ADR-910 §6.3).
 * Το jsdom δεν έχει CSS, άρα το ερώτημα που απαντιέται χωρίς browser είναι: **σαρώνει το Tailwind τα αρχεία που
 * κρατούν τις κλάσεις, και είναι κάθε κλάση γραμμένη αυτούσια σε ένα από αυτά;**
 */

import { readRepoFile } from '@/test-utils/read-source';
import { TOUCH_TARGET_MIN } from '@/design-system/touch-target';
import { BACK_LINK_CLASS, ENTITY_LINK_CLASS, VISIBLE_LINK_CLASS } from '../link-style';

const LINK_STYLE = 'src/lib/ui/link-style.ts';
const TOUCH_TARGET = 'src/design-system/touch-target.ts';

describe('link-style — κλάσεις ορατές στο Tailwind', () => {
  // Ωμό, ΟΧΙ `readRepoCode`: το `/**/` του glob μοιάζει με σχόλιο και το `stripComments` το τρώει.
  const config = readRepoFile('tailwind.config.ts');

  it('το Tailwind σαρώνει τα `.ts` του `src/lib/ui` και του `src/design-system`', () => {
    expect(config).toContain(`'./src/lib/ui/**/*.ts'`);
    expect(config).toContain(`'./src/design-system/**/*.ts'`);
  });

  const sources = [readRepoFile(LINK_STYLE), readRepoFile(TOUCH_TARGET)].join('\n');
  const tokens = [...new Set(`${VISIBLE_LINK_CLASS} ${ENTITY_LINK_CLASS} ${BACK_LINK_CLASS} ${TOUCH_TARGET_MIN}`.split(/\s+/))]
    .filter(Boolean);

  it.each(tokens)('`%s` είναι γραμμένη αυτούσια σε σαρωμένο αρχείο (όχι συντεθειμένη)', (token) => {
    expect(sources).toContain(token);
  });
});
