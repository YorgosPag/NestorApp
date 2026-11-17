/**
 * @fileoverview **Οι ετικέτες του φακέλου ιδιώτη στην πλευρά του επαγγελματία** (ADR-916 Φ-Ε1) — κλειστοί πίνακες κλειδιών.
 * @related `issuance-space-labels.ts` (ο αδελφός της ανάθεσης) · `case-invite-labels.ts` (η πρόσκληση) · ADR-744 (slice)
 * @module components/conveyance/my-cases/dossier-space-labels
 *
 * ⚠️ **Μέλη αντικειμένων με ρητό τύπο, ποτέ `${…}` ή `satisfies`**: ο εξαγωγέας του slice (ADR-744) ακολουθεί μέλη
 * πινάκων ετικετών. `Record` πάνω σε κλειστά σύνολα: νέος ρόλος ή νέα καρτέλα δεν μεταγλωττίζεται χωρίς τα λόγια του.
 * 🔑 Όλα στο namespace `conveyance` — το ίδιο που φορτώνουν ήδη οι σελίδες «Οι υποθέσεις μου» και `/case-invite`
 *    (κανένα δεύτερο, βαρύ namespace στη σελίδα για τέσσερις ετικέτες καρτέλας).
 */

import type { PropertyDossierFileTab } from '@/config/upload-entry-points/entries-property-dossier';
import type { DossierEngagementRole } from '@/types/engagement';

export const DOSSIER_SPACE_KEYS = {
  kindLabel: 'conveyance:engagement.dossier.kindLabel',
  untitled: 'conveyance:engagement.dossier.untitled',
  roleLine: 'conveyance:engagement.dossier.roleLine',
  expiresLine: 'conveyance:engagement.dossier.expiresLine',
  open: 'conveyance:engagement.dossier.open',
  empty: 'conveyance:engagement.dossier.empty',
  addedOn: 'conveyance:engagement.dossier.addedOn',
  openFile: 'conveyance:engagement.dossier.openFile',
  download: 'conveyance:engagement.dossier.download',
  auditNotice: 'conveyance:engagement.dossier.auditNotice',
} as const;

export const DOSSIER_INVITE_KEYS = {
  tabsLabel: 'conveyance:engagement.invite.dossier.tabsLabel',
  durationLabel: 'conveyance:engagement.invite.dossier.durationLabel',
  duration: 'conveyance:engagement.invite.dossier.duration',
} as const;

/** Ο ρόλος στον φάκελο — **δικό του** λεξιλόγιο (ο δικηγόρος είναι του κατόχου, όχι πλευράς συναλλαγής). */
export const DOSSIER_ROLE_KEY: Readonly<Record<DossierEngagementRole, string>> = {
  owner_lawyer: 'conveyance:engagement.dossier.roles.owner_lawyer',
  notary: 'conveyance:engagement.dossier.roles.notary',
};

/** Η καρτέλα — η κάτοψη λέγεται «Τοπογραφικό» σε οικόπεδο (ο κριτής `floorplanTabKind`, όπως στη σελίδα του κατόχου). */
export const DOSSIER_TAB_KEY: Readonly<Record<PropertyDossierFileTab | 'topographic', string>> = {
  floorplan: 'conveyance:engagement.dossier.tabs.floorplan',
  topographic: 'conveyance:engagement.dossier.tabs.topographic',
  documents: 'conveyance:engagement.dossier.tabs.documents',
  photos: 'conveyance:engagement.dossier.tabs.photos',
  videos: 'conveyance:engagement.dossier.tabs.videos',
};
