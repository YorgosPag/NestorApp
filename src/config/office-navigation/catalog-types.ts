/**
 * ADR-871 §10.6 — οι τύποι του καταλόγου πλοήγησης του **γραφείου**.
 *
 * Ο κατάλογος = το συμβόλαιο απόδοσης (`@/types/sidebar`) **+ πολιτική ορατότητας**. Η
 * πολιτική ζει μόνο εδώ: η μηχανή (`resolve-office-navigation.ts`) την εφαρμόζει και την
 * **αφαιρεί**, οπότε καμία στήλη δεν τη βλέπει ποτέ.
 */

import type { MenuGroup, MenuLink } from '@/types/sidebar';
import type { StaticAppHref } from '@/lib/workspace/route-worlds';

/** Οι ομάδες του γραφείου. **Κλειστή** ένωση, χωρίς `/` ⇒ δομικά ξένη προς κάθε href (Υ14). */
export const OFFICE_GROUP_IDS = [
  'spaces',
  'sales',
  'crm',
  'reports',
  'accounting',
  'legal',
  'settings',
] as const;

export type OfficeGroupId = (typeof OFFICE_GROUP_IDS)[number];

/**
 * **Κλειδί κόμβου της στήλης** — ό,τι ταξινομεί το σύστημα δουλειών (ADR-748): ομάδα με
 * το `id` της, σύνδεσμος με τη διεύθυνσή του. Το ζεύγος το λύνει ο `navNodeKey`.
 */
export type SidebarNodeKey = OfficeGroupId | StaticAppHref;

export type NavigationEnvironment = 'development' | 'production';

/** Πολιτική ορατότητας. Ό,τι δηλώνεται εδώ **επιβάλλεται** (Υ18) — αλλιώς δεν δηλώνεται. */
export interface NavPolicy {
  /** Απαιτούνται **όλα**. */
  readonly permissions?: readonly string[];
  /** Απόν = σε κάθε περιβάλλον. */
  readonly environments?: readonly NavigationEnvironment[];
}

export interface CatalogLink extends MenuLink {
  readonly policy?: NavPolicy;
}

export interface CatalogGroup extends Omit<MenuGroup, 'id' | 'items'> {
  readonly id: OfficeGroupId;
  readonly items: readonly CatalogLink[];
}

export type CatalogEntry = CatalogLink | CatalogGroup;

/** Πολιτική που επαναλαμβάνεται — μία φορά γραμμένη. */
export const ADMIN_ONLY: NavPolicy = { permissions: ['admin_access'] };
