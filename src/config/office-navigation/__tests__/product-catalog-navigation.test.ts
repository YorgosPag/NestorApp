/**
 * ADR-923 Φάση 1γ — **ο κατάλογος προϊόντων στη στήλη του γραφείου**, εκτελώντας τη μηχανή.
 *
 *   Π1 — με `catalog:schema:view` η ομάδα εμφανίζεται, με τα τέσσερα παιδιά στη σειρά της δήλωσης
 *   Π2 — χωρίς το δικαίωμα **η ομάδα φεύγει ολόκληρη** (κενή ομάδα = κουμπί που ανοίγει το τίποτα, Υ19)
 *   Π3 — ο ρόλος **bypass** τη βλέπει χωρίς κανένα permission — ίδιο με τον κριτή (`decideCapability`, βήμα 4).
 *        🔴 Πριν: ο super_admin (claims: μόνο `admin_access`) δεν θα την έβλεπε ΠΟΤΕ.
 *   Π4 — το **περιβάλλον** ΔΕΝ παρακάμπτεται από τον bypass (Υ18: «Debug» μόνο στην ανάπτυξη)
 *   Π5 — οι διευθύνσεις είναι **οι** διαδρομές του `CATALOG_PAGES` — μία ονομασία, ένα σημείο
 */

import type { MenuEntry, MenuGroup } from '@/types/sidebar';
import { CATALOG_PAGES } from '@/subapps/catalog/catalog-routes';
import { getMainMenuItems, getSettingsMenuItems } from '../resolve-office-navigation';

const GROUP_ID = 'productCatalog';

function catalogGroup(entries: readonly MenuEntry[]): MenuGroup | undefined {
  return entries.find((entry): entry is MenuGroup => entry.kind === 'group' && entry.id === GROUP_ID);
}

describe('ADR-923 Φάση 1γ — η ομάδα «Κατάλογος προϊόντων»', () => {
  it('Π1 — με `catalog:schema:view`: τέσσερα παιδιά, οικογένειες πρώτα', () => {
    const group = catalogGroup(getMainMenuItems(['catalog:schema:view'], 'production'));
    expect(group?.items.map((item) => item.href)).toEqual([
      CATALOG_PAGES.families,
      CATALOG_PAGES.attributes,
      CATALOG_PAGES.categories,
      CATALOG_PAGES.measurements,
    ]);
  });

  it('Π2 — χωρίς το δικαίωμα η ομάδα δεν υπάρχει καθόλου', () => {
    expect(catalogGroup(getMainMenuItems([], 'production'))).toBeUndefined();
    expect(catalogGroup(getMainMenuItems(['admin_access'], 'production'))).toBeUndefined();
  });

  it('Π3 — ο ρόλος bypass τη βλέπει χωρίς κανένα permission', () => {
    expect(catalogGroup(getMainMenuItems([], 'production', true))?.items).toHaveLength(4);
  });

  it('Π4 — ο bypass ΔΕΝ παρακάμπτει το περιβάλλον', () => {
    const hrefs = (entries: readonly MenuEntry[]) =>
      entries.flatMap((entry) => (entry.kind === 'group' ? entry.items.map((item) => item.href) : [entry.href]));
    expect(hrefs(getSettingsMenuItems([], 'production', true))).not.toContain('/debug');
    expect(hrefs(getSettingsMenuItems([], 'development', true))).toContain('/debug');
  });
});
