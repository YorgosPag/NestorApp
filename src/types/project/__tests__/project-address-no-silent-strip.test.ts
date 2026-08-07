/**
 * @fileoverview 🔴 **Καμία σιωπηλή διαγραφή πεδίου διεύθυνσης** (ADR-759 Φ3, ADR-167/332).
 *
 * ## Το μετρημένο περιστατικό
 *
 * Το `projectAddressSchema` είναι `z.object`, δηλαδή **πετάει κάθε αδήλωτο κλειδί**, και είναι
 * το σχήμα του `ProjectUpdateSchema.addresses` — άρα **κάθε** PATCH διεύθυνσης έργου περνά από
 * μέσα. Μετρημένο 2026-08-05: από αντικείμενο με 10 κλειδιά **επέζησαν 7**. Έλειπαν πεδία που
 * δηλώνουν **δύο ADR** και τα οποία γράφει **ζωντανός κώδικας**:
 *
 * | Πεδίο | Ποιος το γράφει | Τι έσπαγε |
 * |---|---|---|
 * | `frontageIndex` | `FrontageAddressCreateDialog:68` | ο **αντίστροφος** δεσμός `PlotFrontage.index` (ADR-186 Φ2.5) |
 * | `source` | ADR-332 Φ8 · **και το `'titleblock'` του ADR-745 §6.4** | το `<AddressSourceLabel>` δεν είχε ποτέ τι να δείξει |
 * | `verifiedAt` | γεωκωδικοποίηση | το `<AddressFreshnessIndicator>` έδειχνε μόνιμα «ποτέ» |
 * | `geocodingMetadata` | γεωκωδικοποίηση | ακρίβεια/εμπιστοσύνη χάνονταν σε κάθε αποθήκευση |
 *
 * Οι υπάρχουσες άγκυρες (`validation/__tests__/address-schemas.test.ts`) ελέγχουν **αναλλοίωτα**
 * — ένα primary, μοναδικά id — και **κανένα** δεν ρωτούσε «**επιβιώνει το πεδίο;**». Γι' αυτό η
 * απώλεια ήταν αόρατη: κάθε test ήταν πράσινο και τα δεδομένα εξαφανίζονταν.
 *
 * ## Γιατί το fixture είναι `Required<ProjectAddress>`
 *
 * Ο τύπος **επιβάλλει** ενημέρωση: πεδίο που μπαίνει στο `ProjectAddress` και ξεχνιέται εδώ
 * **δεν μεταγλωττίζεται**. Χωρίς αυτό, το test θα ήταν άλλη μια χειρόγραφη λίστα που αποκλίνει
 * σιωπηλά — ακριβώς το σχήμα των δύο λιστών namespace του CHECK 3.34.
 */

/* global describe, it, expect */
import { projectAddressSchema } from '@/types/project/address-schemas';
import type { ProjectAddress } from '@/types/project/addresses';

/** Κάθε πεδίο του τύπου, με τιμή. Νέο πεδίο ⇒ σφάλμα μεταγλώττισης εδώ. */
const FULL_ADDRESS: Required<ProjectAddress> = {
  id: 'addr_1',
  street: 'Προέκταση Σμύρνης',
  number: '16',
  city: 'Εύοσμος',
  postalCode: '56224',
  region: 'Κεντρική Μακεδονία',
  regionalUnit: 'Π.Ε. Θεσσαλονίκης',
  country: 'Greece',
  type: 'frontage',
  isPrimary: false,
  label: 'Πρόσωπο 1',
  frontageIndex: 1,
  blockSide: 'north',
  blockSideDescription: 'Πρόσοψη επί Σμύρνης',
  cadastralCode: '190401509001',
  municipality: 'Δήμος Κορδελιού - Ευόσμου',
  municipalUnit: 'Δ.Ε. ΕΥΟΣΜΟΥ',
  neighborhood: 'ΠΕΡΙΟΧΗ ΕΠΕΚΤΑΣΗΣ ΕΥΟΣΜΟΥ',
  // ADR-772 — τα δύο ανώτερα επίπεδα και οι ταυτότητες. Ο τύπος τα **επέβαλε** εδώ τη
  // στιγμή που μπήκαν στο `ProjectAddress`: αυτός ακριβώς είναι ο μηχανισμός.
  decentAdmin: 'Α.Δ. Μακεδονίας - Θράκης',
  majorGeo: 'Βόρεια Ελλάδα',
  settlementId: 'stl_12345',
  municipalUnitId: 'mu_678',
  municipalityId: 'mun_901',
  regionalUnitId: 'ru_234',
  regionId: 'reg_567',
  decentAdminId: 'da_890',
  majorGeoId: 'mg_123',
  coordinates: { lat: 40.67, lng: 22.9 },
  source: 'titleblock',
  verifiedAt: 1_754_400_000_000,
  geocodingMetadata: { confidence: 0.9, accuracy: 'exact', variantUsed: 1, osmType: 'way' },
  sortOrder: 2,
};

describe('🔴 projectAddressSchema — κανένα δηλωμένο πεδίο δεν πετιέται σιωπηλά', () => {
  it('επιβιώνει ΚΑΘΕ κλειδί του `ProjectAddress`, χωρίς εξαίρεση', () => {
    const parsed = projectAddressSchema.parse(FULL_ADDRESS) as Record<string, unknown>;
    const lost = Object.keys(FULL_ADDRESS).filter((key) => !(key in parsed));
    expect(lost).toEqual([]);
  });

  it('και οι ΤΙΜΕΣ επιβιώνουν ακέραιες — όχι μόνο τα κλειδιά', () => {
    expect(projectAddressSchema.parse(FULL_ADDRESS)).toEqual(FULL_ADDRESS);
  });

  it.each([
    ['frontageIndex', 'ADR-186 Φ2.5 — ο δεσμός προς PlotFrontage.index'],
    ['municipalUnit', 'ADR-759 Φ3 — Δημοτική Ενότητα'],
    ['source', 'ADR-332 Φ8 — προέλευση (και το «titleblock» του ADR-745)'],
    ['verifiedAt', 'ADR-332 Φ8 — φρεσκάδα'],
    ['geocodingMetadata', 'ADR-332 Φ8 — ακρίβεια γεωκωδικοποίησης'],
  ])('ονομαστικά: το «%s» φτάνει στη βάση (%s)', (field) => {
    const parsed = projectAddressSchema.parse(FULL_ADDRESS) as Record<string, unknown>;
    expect(parsed[field]).toEqual((FULL_ADDRESS as Record<string, unknown>)[field]);
  });

  it('🔑 ο φρουρός του φρουρού: αδήλωτο κλειδί ΕΞΑΚΟΛΟΥΘΕΙ να πετιέται', () => {
    // Το σχήμα δεν έγινε `.passthrough()` — η αυστηρότητα είναι το χαρακτηριστικό, η **ελλιπής
    // δήλωση** ήταν το ελάττωμα. Χωρίς αυτόν τον έλεγχο, ο επόμενος «θα διόρθωνε» την απώλεια
    // ανοίγοντας το σχήμα, και θα έγραφε στη βάση ό,τι στείλει ο πελάτης.
    const parsed = projectAddressSchema.parse({
      ...FULL_ADDRESS,
      totallyUnknownField: 'x',
    }) as Record<string, unknown>;
    expect('totallyUnknownField' in parsed).toBe(false);
  });
});
