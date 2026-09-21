/**
 * **Ποιο στοιχείο της στήλης είναι η τρέχουσα σελίδα;** — ΜΙΑ απάντηση για ΟΛΟ τον κατάλογο.
 *
 * ADR-871 §10.5 Υ11. Μέχρι τώρα κάθε στοιχείο ρωτούσε μόνο του «ταιριάζει το href μου ως
 * πρόθεμα;» — και ο γονιός έδινε το ίδιο `isActive` σε **όλα** τα παιδιά του. Αποτέλεσμα:
 * στο `/crm/customers` φωτίζονταν μαζί «Επισκόπηση» (`/crm`) και «Πελάτες», ενώ στο
 * `/obligations` ο γονιός «Νομικά» (`/legal-documents`) **δεν** φωτιζόταν καθόλου.
 *
 * Ο κανόνας (WAI-ARIA APG · Primer NavList · Carbon SideNav):
 *  1. **ακριβώς ένα** ενεργό — υποψήφια κάθε href στοιχείου **και** υπο-στοιχείου,
 *     σε **όλες** τις ενότητες μαζί·
 *  2. αντιστοίχιση σε **όριο τμήματος** (`/crm` ταιριάζει `/crm/x`, όχι `/crmx`)·
 *  3. κερδίζει η **μακρύτερη**· σε ισοπαλία (γονιός `/crm` + παιδί `/crm`) το **παιδί**·
 *  4. ο γονιός βγαίνει από τη **δηλωμένη** σχέση του καταλόγου — **ποτέ** από το URL
 *     (τα `/admin/setup` ανήκουν στις «Ρυθμίσεις», όχι κάτω από το `/settings`).
 *
 * Καθαρή συνάρτηση, χωρίς React — ελέγχεται με jest απευθείας.
 *
 * @module components/sidebar/active-navigation
 */

import type { MenuItem } from '@/types/sidebar';
import type { WorkspaceHref } from '@/lib/workspace/route-worlds';

export interface ActiveNavigation {
  /** Το href του **ενός** ενεργού στοιχείου, ή `null` όταν η σελίδα δεν είναι στον κατάλογο. */
  readonly activeHref: WorkspaceHref | null;
  /** Ο τίτλος (= κλειδί ανοίγματος) του γονιού του, όταν το ενεργό είναι υπο-στοιχείο. */
  readonly activeParentTitle: string | null;
}

interface Candidate {
  readonly href: WorkspaceHref;
  readonly parentTitle: string | null;
}

const NO_ACTIVE: ActiveNavigation = { activeHref: null, activeParentTitle: null };

function matchesSegment(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Κάθε γονιός **πριν** από τα παιδιά του — η σειρά που κάνει το παιδί νικητή της ισοπαλίας. */
function collectCandidates(items: readonly MenuItem[]): Candidate[] {
  return items.flatMap((item) => [
    { href: item.href, parentTitle: null },
    ...(item.subItems ?? []).map((sub) => ({ href: sub.href, parentTitle: item.title })),
  ]);
}

export function resolveActiveNavigation(
  items: readonly MenuItem[],
  pathname: string,
): ActiveNavigation {
  let winner: Candidate | null = null;
  for (const candidate of collectCandidates(items)) {
    if (!matchesSegment(pathname, candidate.href)) continue;
    if (winner === null || candidate.href.length >= winner.href.length) {
      // `>=`: ίδιο μήκος σημαίνει ίδιο href — το μεταγενέστερο (το παιδί) κερδίζει.
      winner = candidate;
    }
  }
  return winner === null
    ? NO_ACTIVE
    : { activeHref: winner.href, activeParentTitle: winner.parentTitle };
}

/** Περιέχει αυτό το στοιχείο (ή κάποιο παιδί του) την τρέχουσα σελίδα; */
export function containsActive(item: MenuItem, activeHref: WorkspaceHref | null): boolean {
  if (activeHref === null) return false;
  return item.href === activeHref || (item.subItems ?? []).some((sub) => sub.href === activeHref);
}
