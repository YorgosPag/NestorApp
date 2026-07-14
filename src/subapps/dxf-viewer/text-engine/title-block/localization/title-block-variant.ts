/**
 * ADR-651 Φάση Κ (§8 #7) — «ποια είναι η **αγγλική** μου πινακίδα;»
 *
 * ## Η αρχή: εναλλάσσουμε ΜΟΝΟ σε εγκεκριμένη παραλλαγή
 *
 * Τα built-in presets αλλάζουν γλώσσα ελεύθερα (`templates.el` / `templates.en` — Φάση Γ): είναι
 * δικά μας, μεταφρασμένα από εμάς. Ένα **αποθηκευμένο** πρότυπο όμως είναι κείμενο **του
 * γραφείου**. Η εναλλαγή γλώσσας δεν επιτρέπεται να το μεταφράσει μηχανικά επιτόπου: βρίσκει τη
 * γλωσσική **παραλλαγή** που ο χρήστης έφτιαξε και **ενέκρινε** (§5.10, Δρόμος Β) — και αν δεν
 * υπάρχει, **δεν αλλάζει τίποτα**. Καμία μηχανική μετάφραση δεν μπαίνει σε σχέδιο μόνη της.
 *
 * ## Βάθος 1, όπως και η υπόλοιπη κληρονομιά
 *
 * Οι παραλλαγές δένονται με `parentId` (ο ΙΔΙΟΣ μηχανισμός απόσπασης της Φάσης Θ — μηδέν νέο
 * μοντέλο). Ψάχνουμε τρεις θέσεις γύρω από το ενεργό πρότυπο, ποτέ αναδρομικά:
 *
 *   ελληνικό master ──parentId──► αγγλική παραλλαγή     (παιδί)
 *   αγγλική παραλλαγή ──parentId──► ελληνικό master     (γονιός)
 *   αγγλική ◄──ίδιος parentId──► γαλλική                (αδελφή· μελλοντικές γλώσσες)
 */

import type { TextTemplate } from '../../templates/template.types';
import type { TitleBlockLocale } from '../title-block-presets';

/** Η γλώσσα του **περιεχομένου** ενός προτύπου, ή `null` όταν δεν τη δηλώνει (πριν τη Φάση Κ). */
export function titleBlockTemplateLocale(template: TextTemplate): TitleBlockLocale | null {
  return template.locale === 'el' || template.locale === 'en' ? template.locale : null;
}

/**
 * Το πρότυπο-αδελφάκι σε ΑΥΤΗ τη γλώσσα, ή `null`. Βάθος 1 (παιδί / γονιός / αδελφή) —
 * η ίδια «ρηχή» κληρονομιά με το `template-inheritance.ts` (καμία αλυσίδα, κανένας κύκλος).
 */
export function findTitleBlockVariant(
  templates: readonly TextTemplate[],
  active: TextTemplate,
  target: TitleBlockLocale,
): TextTemplate | null {
  if (titleBlockTemplateLocale(active) === target) return active;

  const child = templates.find(
    (candidate) =>
      candidate.parentId === active.id && titleBlockTemplateLocale(candidate) === target,
  );
  if (child) return child;

  if (!active.parentId) return null;

  const relative = templates.find(
    (candidate) =>
      candidate.id !== active.id &&
      (candidate.id === active.parentId || candidate.parentId === active.parentId) &&
      titleBlockTemplateLocale(candidate) === target,
  );
  return relative ?? null;
}

/**
 * Υπάρχει ήδη παραλλαγή σε αυτή τη γλώσσα; Το UI το ρωτά για να μην προσφέρει δεύτερη
 * μεταγλώττιση του ίδιου πράγματος (N.7.2 #3: idempotent — ποτέ δύο αγγλικά αντίγραφα).
 */
export function hasTitleBlockVariant(
  templates: readonly TextTemplate[],
  active: TextTemplate,
  target: TitleBlockLocale,
): boolean {
  return findTitleBlockVariant(templates, active, target) !== null;
}
