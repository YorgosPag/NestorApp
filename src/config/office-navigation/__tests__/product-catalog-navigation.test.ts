/**
 * ADR-923 Φάση 1γ — **ο κατάλογος προϊόντων στη στήλη του γραφείου**, εκτελώντας τη μηχανή.
 *
 *   Π1 — με `catalog:schema:view` η ομάδα εμφανίζεται, με τα τέσσερα παιδιά στη σειρά της δήλωσης
 *   Π2 — χωρίς το δικαίωμα **η ομάδα φεύγει ολόκληρη** (κενή ομάδα = κουμπί που ανοίγει το τίποτα, Υ19)
 *   Π3 — ο ρόλος **bypass** τη βλέπει χωρίς κανένα permission — ίδιο με τον κριτή (`decideCapability`, βήμα 4).
 *        🔴 Πριν: ο super_admin (claims: μόνο `admin_access`) δεν θα την έβλεπε ΠΟΤΕ.
 *   Π4 — το **περιβάλλον** ΔΕΝ παρακάμπτεται από τον bypass (Υ18: «Debug» μόνο στην ανάπτυξη)
 *   Π5 — οι διευθύνσεις είναι **οι** διαδρομές του `CATALOG_PAGES` — μία ονομασία, ένα σημείο
 *   Π6 — οι **ρυθμίσεις** (δομή: κανάλια × γλώσσες) θέλουν `catalog:schema:manage` — το `view` δεν τις δείχνει
 *        (Akeneo «manage structure» ≠ «view»). Με `manage` εμφανίζονται **τελευταίες**.
 */

import type { MenuEntry, MenuGroup } from '@/types/sidebar';
import { CATALOG_PAGES } from '@/subapps/catalog/catalog-routes';
import { getMainMenuItems, getSettingsMenuItems } from '../resolve-office-navigation';

const GROUP_ID = 'productCatalog';

function catalogGroup(entries: readonly MenuEntry[]): MenuGroup | undefined {
  return entries.find((entry): entry is MenuGroup => entry.kind === 'group' && entry.id === GROUP_ID);
}

describe('ADR-923 Φάση 1γ — η ομάδα «Κατάλογος προϊόντων»', () => {
  it('Π1 — με `catalog:schema:view`: προϊόντα πρώτα (η κύρια οθόνη, Akeneo), βιβλιοθήκη μέσων τελευταία', () => {
    const group = catalogGroup(getMainMenuItems(['catalog:schema:view'], 'production'));
    expect(group?.items.map((item) => item.href)).toEqual([
      CATALOG_PAGES.products,
      CATALOG_PAGES.families,
      CATALOG_PAGES.attributes,
      CATALOG_PAGES.categories,
      CATALOG_PAGES.measurements,
      CATALOG_PAGES.assets,
    ]);
  });

  it('Π2 — χωρίς το δικαίωμα η ομάδα δεν υπάρχει καθόλου', () => {
    expect(catalogGroup(getMainMenuItems([], 'production'))).toBeUndefined();
    expect(catalogGroup(getMainMenuItems(['admin_access'], 'production'))).toBeUndefined();
  });

  it('Π3 — ο ρόλος bypass τη βλέπει χωρίς κανένα permission — ΟΛΕΣ τις σελίδες του CATALOG_PAGES', () => {
    const hrefs = catalogGroup(getMainMenuItems([], 'production', true))?.items.map((item) => item.href);
    expect([...(hrefs ?? [])].sort()).toEqual(Object.values(CATALOG_PAGES).sort());
  });

  it('Π6 — οι ρυθμίσεις θέλουν catalog:schema:manage · με αυτό εμφανίζονται τελευταίες', () => {
    const viewOnly = catalogGroup(getMainMenuItems(['catalog:schema:view'], 'production'))?.items.map((item) => item.href);
    expect(viewOnly).not.toContain(CATALOG_PAGES.settings);
    const managing = catalogGroup(getMainMenuItems(['catalog:schema:view', 'catalog:schema:manage'], 'production'))?.items;
    expect(managing?.[managing.length - 1]?.href).toBe(CATALOG_PAGES.settings);
  });

  it('Π4 — ο bypass ΔΕΝ παρακάμπτει το περιβάλλον', () => {
    const hrefs = (entries: readonly MenuEntry[]) =>
      entries.flatMap((entry) => (entry.kind === 'group' ? entry.items.map((item) => item.href) : [entry.href]));
    expect(hrefs(getSettingsMenuItems([], 'production', true))).not.toContain('/debug');
    expect(hrefs(getSettingsMenuItems([], 'development', true))).toContain('/debug');
  });
});
