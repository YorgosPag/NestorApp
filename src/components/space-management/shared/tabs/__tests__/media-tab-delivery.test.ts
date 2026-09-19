/**
 * Α39.1 — ADR-866 §2.10.8 Β5: «ό,τι μόλις ανέβηκε, φαίνεται — χωρίς "Ανανέωση"».
 *
 * 🔴 Η βλάβη (επανάληψη Ε6 στην παραγωγή, 2026-09-19 · 4/4 ανεβάσματα): το αρχείο γραφόταν σωστά (`ready`) αλλά η
 * καρτέλα κρατούσε την **προηγούμενη** λίστα. Αιτία μετρημένη με το ίδιο το SDK: οι καρτέλες με εμβέλειες στέλνουν
 * **το ίδιο** canonical ερώτημα (`readQueryNarrowing` ⇒ χωρίς domain/category)· το «γράφω και ξαναρωτώ» απαντιόταν
 * από την όψη του **ήδη ζωντανού** ακροατή της καρτέλας κάτοψης — `fromCache: false`, αλλά ~100ms **πριν** φτάσει η
 * εγγραφή (`getDocs` τη στιγμή του `ready` ⇒ 3 έγγραφα · ακροατής 97ms μετά ⇒ 4).
 *
 * 🔑 Η άγκυρα ρωτά **μόνο** συναρτήσεις παραγωγής: τη ρύθμιση κάθε καρτέλας του φακέλου (`propertyDossierMediaTab`),
 * την πολιτική εμβέλειας που δίνει το κέλυφος (`mediaTabScopePolicy`) και τον ΕΝΑ κανόνα παράδοσης (`fileListIsLive`) —
 * ακριβώς ό,τι συνθέτει το `EntityFilesManager` (το ίδιο το δέσιμο το κλειδώνει η Α39.4).
 *
 * | Μετάλλαξη | Αποτέλεσμα |
 * |---|---|
 * | `fileListIsLive` ⇒ μόνο `floorplan-gallery` (η πριν-Β5 συμπεριφορά) | «κάθε καρτέλα του φακέλου ζωντανή» ⇒ 🔴 6 |
 * | `fileListIsLive` ⇒ πάντα `true` | «καρτέλες χωρίς εμβέλειες: όπως πριν» ⇒ 🔴 3 |
 */

import { fileListIsLive, readQueryNarrowing } from '@/components/shared/files/utils/upload-scope';
import { propertyDossierMediaTab } from '@/components/property-dossier/property-dossier-media';
import type { PropertyDossierFileTab } from '@/config/upload-entry-points/entries-property-dossier';
import type { PropertyDossier } from '@/types/property-dossier';
import { propertyDossierMediaBinding } from '../entity-media-binding';
import {
  DOCUMENTS_MEDIA_CONFIG,
  FLOORPLAN_MEDIA_CONFIG,
  PHOTOS_MEDIA_CONFIG,
  VIDEOS_MEDIA_CONFIG,
  type MediaTabConfig,
} from '../media-tab-configs';
import { mediaTabScopePolicy } from '../media-tab-scope';

const DOSSIER = propertyDossierMediaBinding({ id: 'pdos_test', label: 'Δοκιμή', userId: 'uid_owner' });
const TABS: readonly PropertyDossierFileTab[] = ['floorplan', 'documents', 'photos', 'videos'];
const KINDS: readonly NonNullable<PropertyDossier['type']>[] = ['apartment', 'plot'];

/** Η σύνθεση του `EntityFilesManager`: `realtime = fileListIsLive(displayStyle, scopePolicy?.readScopes)`. */
function deliversLive(media: MediaTabConfig): boolean {
  return fileListIsLive(media.displayStyle, mediaTabScopePolicy(DOSSIER, media)?.readScopes);
}

describe.each(KINDS)('Α39.1 — φάκελος «%s»: η λίστα την κατέχει ο ακροατής', (kind) => {
  it.each(TABS)('καρτέλα «%s» ⇒ ζωντανή (κανένα «γράφω και ξαναρωτώ»)', (tab) => {
    expect(deliversLive(propertyDossierMediaTab(tab, kind))).toBe(true);
  });

  it('ΓΙΑΤΙ: όλες οι καρτέλες στέλνουν ΤΟ ΙΔΙΟ ερώτημα (κανένα στένεμα) ⇒ μία ανάγνωση θα απαντιόταν από τον ακροατή', () => {
    const narrowings = TABS.map((tab) => {
      const media = propertyDossierMediaTab(tab, kind);
      return readQueryNarrowing({ domain: media.domain, category: media.category }, mediaTabScopePolicy(DOSSIER, media)?.readScopes);
    });
    expect(narrowings).toEqual(TABS.map(() => ({})));
  });
});

describe('Α39.1 — καρτέλες ΧΩΡΙΣ εμβέλειες: όπως πριν (ζωντανή μόνο η κάτοψη)', () => {
  it.each([
    ['κάτοψη', FLOORPLAN_MEDIA_CONFIG, true],
    ['έγγραφα', DOCUMENTS_MEDIA_CONFIG, false],
    ['φωτογραφίες', PHOTOS_MEDIA_CONFIG, false],
    ['βίντεο', VIDEOS_MEDIA_CONFIG, false],
  ] as const)('%s ⇒ %s', (_label, media, live) => {
    expect(fileListIsLive(media.displayStyle, undefined)).toBe(live);
  });
});
