/**
 * ADR-871 §10.6 — **ΕΝΑ** σημείο για τα στημένα δέντρα πλοήγησης των tests: σύνδεσμος /
 * ομάδα με το ελάχιστο δομικό σχήμα (`navigation-node.ts`). Τα φίλτρα δουλειάς, ικανότητας
 * και πρότασης ρωτούν μόνο αυτό — τα tests δεν χρειάζονται εικονίδια ή τίτλους.
 */

import type { NavGroupNode, NavLinkNode } from '@/config/navigation-node';
import { filterItemsByJob } from '@/config/jobs-visibility';
import type { JobSelection } from '@/config/jobs-access';

export type NavFixture = NavLinkNode | NavGroupNode;

export const link = (href: string): NavLinkNode => ({ kind: 'link', href });

export const group = (id: string, ...hrefs: string[]): NavGroupNode => ({
  kind: 'group',
  id,
  items: hrefs.map(link),
});

/** Κλειδί κόμβου σε αναγνώσιμη μορφή — για συγκρίσεις λιστών. */
export const keyOf = (node: NavFixture): string => (node.kind === 'link' ? node.href : node.id);

/** Τα hrefs των παιδιών μιας ομάδας (κενό για σύνδεσμο). */
export const childHrefs = (node: NavFixture | undefined): string[] =>
  node?.kind === 'group' ? node.items.map((l) => l.href) : [];

/** Το φίλτρο δουλειάς πάνω στο δομικό σχήμα — οι παράμετροι τύπου δηλωμένες μία φορά. */
export const filterFixtures = (items: readonly NavFixture[], job: JobSelection) =>
  filterItemsByJob<NavLinkNode, NavGroupNode>(items, job);
