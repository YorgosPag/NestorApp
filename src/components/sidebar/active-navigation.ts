/**
 * **Ποιο στοιχείο της στήλης είναι η τρέχουσα σελίδα;** — ΜΙΑ απάντηση για ΟΛΟ τον κατάλογο.
 *
 * ADR-871 §10.5 Υ11. Μέχρι τότε κάθε στοιχείο ρωτούσε μόνο του «ταιριάζει το href μου ως
 * πρόθεμα;» — και ο γονιός έδινε το ίδιο `isActive` σε **όλα** τα παιδιά του.
 *
 * Ο κανόνας (WAI-ARIA APG · Primer NavList · Carbon SideNav):
 *  1. **ακριβώς ένα** ενεργό — υποψήφιοι **μόνο οι σύνδεσμοι** (και μέσα σε ομάδες), σε
 *     **όλες** τις ενότητες μαζί. Η ομάδα **δεν** είναι υποψήφια: δεν έχει διεύθυνση
 *     (ADR-871 §10.6 Υ13) — είναι «ενεργή» μόνο επειδή **περιέχει** το ενεργό (Carbon
 *     `hasActiveDescendant`)·
 *  2. αντιστοίχιση σε **όριο τμήματος** (`/crm` ταιριάζει `/crm/x`, όχι `/crmx`)·
 *  3. κερδίζει η **μακρύτερη** — μια βαθιά σελίδα χωρίς δικό της στοιχείο φωτίζει τον
 *     πλησιέστερο πρόγονο (`/spaces/x` → «Επισκόπηση» των Χώρων)·
 *  4. η ομάδα του ενεργού βγαίνει από τη **δηλωμένη** σχέση του καταλόγου — **ποτέ** από το
 *     URL (τα `/admin/setup` ανήκουν στις «Ρυθμίσεις», όχι κάτω από το `/settings`).
 *
 * Καθαρή συνάρτηση, χωρίς React — ελέγχεται με jest απευθείας.
 *
 * @module components/sidebar/active-navigation
 */

import type { MenuEntry } from '@/types/sidebar';
import type { WorkspaceHref } from '@/lib/workspace/route-worlds';

export interface ActiveNavigation {
  /** Το href του **ενός** ενεργού συνδέσμου, ή `null` όταν η σελίδα δεν είναι στον κατάλογο. */
  readonly activeHref: WorkspaceHref | null;
  /** Το `id` της ομάδας που τον περιέχει (= κλειδί ανοίγματος), ή `null`. Υ20: ταυτότητα, όχι τίτλος. */
  readonly activeGroupId: string | null;
}

interface Candidate {
  readonly href: WorkspaceHref;
  readonly groupId: string | null;
}

const NO_ACTIVE: ActiveNavigation = { activeHref: null, activeGroupId: null };

function matchesSegment(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Οι σύνδεσμοι — πρώτου επιπέδου και μέσα σε ομάδες, με την ομάδα τους. */
function collectCandidates(entries: readonly MenuEntry[]): Candidate[] {
  return entries.flatMap((entry): Candidate[] =>
    entry.kind === 'link'
      ? [{ href: entry.href, groupId: null }]
      : entry.items.map((link) => ({ href: link.href, groupId: entry.id })),
  );
}

export function resolveActiveNavigation(
  entries: readonly MenuEntry[],
  pathname: string,
): ActiveNavigation {
  let winner: Candidate | null = null;
  for (const candidate of collectCandidates(entries)) {
    if (!matchesSegment(pathname, candidate.href)) continue;
    if (winner === null || candidate.href.length > winner.href.length) winner = candidate;
  }
  return winner === null
    ? NO_ACTIVE
    : { activeHref: winner.href, activeGroupId: winner.groupId };
}

/** Είναι αυτός ο κόμβος το ενεργό — ή, για ομάδα, το **περιέχει**; */
export function containsActive(entry: MenuEntry, activeHref: WorkspaceHref | null): boolean {
  if (activeHref === null) return false;
  return entry.kind === 'link'
    ? entry.href === activeHref
    : entry.items.some((link) => link.href === activeHref);
}
