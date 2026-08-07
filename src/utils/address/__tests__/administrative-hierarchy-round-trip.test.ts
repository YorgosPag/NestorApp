/**
 * @fileoverview 🔴 **Ό,τι ρωτά η οθόνη, επιστρέφει από την αποθήκευση** (ADR-772).
 *
 * ## Γιατί αυτό το test δεν μοιάζει με τα προηγούμενα
 *
 * Το ADR-759 Φ3 είχε ήδη άγκυρα για τη **Δημοτική Ενότητα** — και ήταν **πράσινη** ενώ ο
 * `BuildingAddressesEditor` πετούσε το ίδιο πεδίο, γιατί το fixture της ονόμαζε **τα πεδία
 * που ήξερε ο μετατροπέας**. Ένα test που ρωτά τον μετατροπέα αν συμφωνεί με τον εαυτό του
 * είναι πράσινο και άχρηστο (ADR-587 §6.1· το πλήρωσε το ADR-758 με 21/21 πριν **και** μετά).
 *
 * Η άγκυρα εδώ ξεκινά από τον **τύπο**: `Required<AddressWithHierarchyValue>`. Ο compiler
 * απαιτεί **και τα 20** πεδία στο fixture — νέο επίπεδο στην οθόνη ⇒ αυτό το αρχείο **δεν
 * μεταγλωττίζεται** ⇒ κανείς δεν μπορεί να προσθέσει επίπεδο και να ξεχάσει τη μεταφορά του.
 *
 * ## Τι καλύπτει, ονομαστικά
 *
 * Ο **κύκλος**: φόρμα → δοχείο → φόρμα, και για τα έργα **με το Zod στη μέση** — γιατί δύο
 * σωστοί μετατροπείς + ελλιπές σχήμα δίνουν **ακριβώς την ίδια** σιωπηλή απώλεια.
 */

/* global describe, it, expect */
import type { AddressWithHierarchyValue } from '@/components/shared/addresses/address-with-hierarchy-config';
import { projectAddressSchema } from '@/types/project/address-schemas';
import type { ProjectAddress } from '@/types/project/addresses';
import { createProjectAddress } from '@/types/project/address-helpers';
import {
  ADMIN_LEVEL_VOCABULARY,
  HIERARCHY_ADJACENT_VOCABULARY,
  POSTAL_FIELD_VOCABULARY,
  NOT_STORED,
  type AddressVocabulary,
  type AdminLevelKey,
} from '../administrative-hierarchy-vocabulary';
import {
  hierarchyToResolvedAddress,
  projectAddressVocabulary,
  resolveCityFromHierarchy,
} from '../administrative-hierarchy';

/**
 * Κάθε πεδίο της οθόνης, με **διακριτή** τιμή.
 *
 * ⚠️ Οι τιμές είναι σκόπιμα διαφορετικές μεταξύ τους: ίδιες τιμές θα έκαναν μια λάθος
 * αντιστοίχιση (π.χ. Δήμος → Περιφέρεια) να περνά πράσινη.
 */
const FULL_FORM: Required<AddressWithHierarchyValue> = {
  street: 'Σμύρνης',
  number: '16',
  postalCode: '56224',
  country: 'Greece',
  settlementName: 'Εύοσμος',
  settlementId: 'stl_8',
  communityName: 'ΠΕΡΙΟΧΗ ΕΠΕΚΤΑΣΗΣ ΕΥΟΣΜΟΥ',
  communityId: 'com_7',
  municipalUnitName: 'Δ.Ε. ΕΥΟΣΜΟΥ',
  municipalUnitId: 'mu_6',
  municipalityName: 'Δήμος Κορδελιού - Ευόσμου',
  municipalityId: 'mun_5',
  regionalUnitName: 'Π.Ε. Θεσσαλονίκης',
  regionalUnitId: 'ru_4',
  regionName: 'Κεντρική Μακεδονία',
  regionId: 'reg_3',
  decentAdminName: 'Α.Δ. Μακεδονίας - Θράκης',
  decentAdminId: 'da_2',
  majorGeoName: 'Βόρεια Ελλάδα',
  majorGeoId: 'mg_1',
};

const LEVELS = Object.keys(ADMIN_LEVEL_VOCABULARY) as AdminLevelKey[];

const VOCABULARIES: readonly AddressVocabulary[] = [
  'form', 'projectAddress', 'companyAddress', 'addressInfo', 'contactFlat',
];

/** Τα επίπεδα που το δοχείο **δηλώνει** ότι κρατά — η δήλωση είναι το συμβόλαιο. */
function storedLevels(vocabulary: AddressVocabulary): AdminLevelKey[] {
  return LEVELS.filter((level) => ADMIN_LEVEL_VOCABULARY[level][vocabulary].name !== NOT_STORED);
}

function roundTrip(vocabulary: AddressVocabulary): Partial<AddressWithHierarchyValue> {
  const stored = projectAddressVocabulary(FULL_FORM, 'form', vocabulary, {
    includePostal: true,
    clearedIdsAsNull: true,
  });
  return projectAddressVocabulary(stored, vocabulary, 'form', {
    includePostal: true,
    clearedIdsAsNull: true,
  }) as Partial<AddressWithHierarchyValue>;
}

describe('🔴 ΤΙ ΟΦΕΙΛΕΙ να κρατά η αποθήκευση — ανεξάρτητα από τον πίνακα', () => {
  /**
   * 🔑 **Γιατί αυτή η λίστα είναι γραμμένη με το χέρι, εν γνώσει μου.**
   *
   * Ο κύκλος παρακάτω ρωτά «μεταφέρεται ό,τι ο πίνακας **δηλώνει**;». Αυτό αφήνει μια
   * τρύπα: όποιος υποβαθμίσει μια δήλωση σε `NOT_STORED` κάνει τον κύκλο να **αγνοήσει**
   * το επίπεδο και το test μένει πράσινο ενώ τα δεδομένα χάνονται — δηλαδή ακριβώς το
   * «τεστ που ρωτά τον εαυτό του» (ADR-587 §6.1).
   *
   * Η λίστα εδώ είναι **δεύτερη, ανεξάρτητη φωνή**: λέει τι απαιτεί ο **τομέας**, όχι τι
   * λέει ο κώδικας. Αν αποκλίνει από τον πίνακα, αυτό είναι το **σήμα**, όχι το ελάττωμα.
   * ⚠️ Αλλαγή εδώ = συνειδητή απόφαση τομέα, τεκμηριωμένη στο ADR-772 — ποτέ «για να
   * γίνει πράσινο».
   */
  const PROJECT_ADDRESS_MUST_STORE: readonly AdminLevelKey[] = [
    'settlement', 'community', 'municipalUnit', 'municipality',
    'regionalUnit', 'region', 'decentAdmin', 'majorGeo',
  ];

  it('η διεύθυνση έργου κρατά ΚΑΙ ΤΑ ΟΚΤΩ διοικητικά επίπεδα', () => {
    const missing = PROJECT_ADDRESS_MUST_STORE.filter(
      (level) => ADMIN_LEVEL_VOCABULARY[level].projectAddress.name === NOT_STORED,
    );
    expect(missing).toEqual([]);
  });

  it('η οθόνη κρατά όνομα ΚΑΙ ταυτότητα για κάθε επίπεδο — αλλιώς δεν έχει τι να στείλει', () => {
    const incomplete = LEVELS.filter((level) => {
      const form = ADMIN_LEVEL_VOCABULARY[level].form;
      return form.name === NOT_STORED || form.id === NOT_STORED;
    });
    expect(incomplete).toEqual([]);
  });

  /**
   * 🔴 **Κανένα πεδίο με δύο διεκδικητές** — δομική αναλλοίωτη, όχι δείγμα.
   *
   * Το βρήκε ο έλεγχος μετάλλαξης: το `neighborhood` το διεκδικούσαν **δύο** γραμμές στα
   * έργα (η Κοινότητα και η ομώνυμη γραμμή συνοικίας). Η μετάλλαξη Μ11 άλλαζε τη μία και
   * **28/28 έμεναν πράσινα** — ο ορισμός του νεκρού κανόνα. Με δύο διεκδικητές, ο νικητής
   * είναι η **σειρά του βρόχου**, δηλαδή τύχη που θα άλλαζε σιωπηλά σε μια αναδιάταξη.
   */
  it('🔴 σε κάθε λεξιλόγιο, κανένα πεδίο δεν γράφεται από δύο κανόνες', () => {
    const collisions: string[] = [];

    for (const vocabulary of VOCABULARIES) {
      const owner = new Map<string, string>();
      const claim = (field: string, rule: string) => {
        const existing = owner.get(field);
        if (existing) collisions.push(`${vocabulary}.${field}: «${existing}» + «${rule}»`);
        else owner.set(field, rule);
      };

      for (const level of LEVELS) {
        const binding = ADMIN_LEVEL_VOCABULARY[level][vocabulary];
        if (binding.name !== NOT_STORED) claim(binding.name[0], `${level}.name`);
        if (binding.id !== NOT_STORED) claim(binding.id[0], `${level}.id`);
      }
      for (const [field, binding] of Object.entries(HIERARCHY_ADJACENT_VOCABULARY)) {
        const slot = binding[vocabulary];
        if (slot !== NOT_STORED) claim(slot[0], field);
      }
      for (const [field, binding] of Object.entries(POSTAL_FIELD_VOCABULARY)) {
        const slot = binding[vocabulary];
        if (slot !== NOT_STORED) claim(slot[0], field);
      }
    }

    expect(collisions).toEqual([]);
  });

  it('🔴 το `communityId` των έργων είναι ΔΗΛΩΜΕΝΑ εκτός — όχι ξεχασμένο', () => {
    // Άγκυρα της **ανοιχτής** απόφασης (ADR-772 §5): η Κοινότητα των έργων ζει στο
    // `neighborhood`, που είναι ελεύθερο κείμενο. Αν κάποιος προσθέσει `communityId`
    // χωρίς να λύσει τη σύγκρουση, θα το δει εδώ και θα διαβάσει το γιατί.
    expect(ADMIN_LEVEL_VOCABULARY.community.projectAddress.id).toBe(NOT_STORED);
    expect(ADMIN_LEVEL_VOCABULARY.community.projectAddress.name).toEqual(['neighborhood']);
  });
});

describe('🔴 ο κύκλος: οθόνη → αποθήκευση → οθόνη', () => {
  it.each<AddressVocabulary>(['projectAddress', 'companyAddress', 'addressInfo', 'contactFlat'])(
    'το «%s» επιστρέφει ΚΑΘΕ όνομα επιπέδου που δηλώνει ότι κρατά',
    (vocabulary) => {
      const back = roundTrip(vocabulary);
      const lost = storedLevels(vocabulary).filter((level) => {
        const formName = ADMIN_LEVEL_VOCABULARY[level].form.name;
        if (formName === NOT_STORED) return false;
        return back[formName[0]] !== FULL_FORM[formName[0]];
      });
      expect(lost).toEqual([]);
    },
  );

  it.each<AddressVocabulary>(['projectAddress', 'companyAddress', 'addressInfo', 'contactFlat'])(
    'το «%s» επιστρέφει ΚΑΘΕ ταυτότητα που δηλώνει ότι κρατά',
    (vocabulary) => {
      const back = roundTrip(vocabulary);
      const lost = LEVELS.filter((level) => {
        const binding = ADMIN_LEVEL_VOCABULARY[level];
        if (binding[vocabulary].id === NOT_STORED || binding.form.id === NOT_STORED) return false;
        return back[binding.form.id[0]] !== FULL_FORM[binding.form.id[0]];
      });
      expect(lost).toEqual([]);
    },
  );

  /**
   * 🔴 **Ο κύκλος ΜΟΝΟΣ ΤΟΥ δεν αρκεί — μετρημένο με έλεγχο μετάλλαξης.**
   *
   * Μετάλλαξη Μ5: `regionalUnit` → γράψε στο `label` αντί στο `regionalUnit`. Ο κύκλος
   * έκλεισε **τέλεια** (γράφει `label`, διαβάζει `label`) και **26/26 έμειναν πράσινα**,
   * ενώ η Περιφερειακή Ενότητα του χρήστη θα αποθηκευόταν στην ετικέτα της διεύθυνσης.
   *
   * Ένας round-trip αποδεικνύει **συνέπεια**, όχι **ορθότητα προορισμού**. Γι' αυτό εδώ
   * γράφονται τα πραγματικά ονόματα πεδίων, μία φορά, ρητά.
   */
  it('🔴 η ιεραρχία προσγειώνεται στα ΣΩΣΤΑ πεδία του `ProjectAddress`', () => {
    expect(
      projectAddressVocabulary(FULL_FORM, 'form', 'projectAddress', {
        includePostal: true,
        clearedIdsAsNull: true,
      }),
    ).toEqual({
      street: 'Σμύρνης',
      number: '16',
      postalCode: '56224',
      country: 'Greece',
      city: 'Εύοσμος',
      neighborhood: 'ΠΕΡΙΟΧΗ ΕΠΕΚΤΑΣΗΣ ΕΥΟΣΜΟΥ',
      municipalUnit: 'Δ.Ε. ΕΥΟΣΜΟΥ',
      municipality: 'Δήμος Κορδελιού - Ευόσμου',
      regionalUnit: 'Π.Ε. Θεσσαλονίκης',
      region: 'Κεντρική Μακεδονία',
      decentAdmin: 'Α.Δ. Μακεδονίας - Θράκης',
      majorGeo: 'Βόρεια Ελλάδα',
      settlementId: 'stl_8',
      municipalUnitId: 'mu_6',
      municipalityId: 'mun_5',
      regionalUnitId: 'ru_4',
      regionId: 'reg_3',
      decentAdminId: 'da_2',
      majorGeoId: 'mg_1',
    });
  });

  it('🔴 …και στα ΣΩΣΤΑ πεδία του `CompanyAddress` (άλλο λεξιλόγιο, ίδιος πίνακας)', () => {
    expect(
      projectAddressVocabulary(FULL_FORM, 'form', 'companyAddress', {
        includePostal: true,
        clearedIdsAsNull: false,
      }),
    ).toEqual({
      street: 'Σμύρνης',
      number: '16',
      postalCode: '56224',
      country: 'Greece',
      city: 'Εύοσμος',
      // ⚠️ ΚΑΜΙΑ `neighborhood` εδώ, και είναι το σημείο: η φόρμα δεν έχει δικό της πεδίο
      // συνοικίας, οπότε στις **επαφές** η τιμή πάει μόνο στο `communityName` (ιεραρχία).
      // Στα **έργα** η ίδια τιμή πάει στο `neighborhood`, γιατί εκεί ζει η Κοινότητα.
      // Οι δύο γραμμές δίπλα-δίπλα είναι η σύγκρουση του ADR-772 §5, ορατή σε test.
      communityName: 'ΠΕΡΙΟΧΗ ΕΠΕΚΤΑΣΗΣ ΕΥΟΣΜΟΥ',
      municipalUnitName: 'Δ.Ε. ΕΥΟΣΜΟΥ',
      municipalityName: 'Δήμος Κορδελιού - Ευόσμου',
      regionalUnitName: 'Π.Ε. Θεσσαλονίκης',
      regionName: 'Κεντρική Μακεδονία',
      decentAdminName: 'Α.Δ. Μακεδονίας - Θράκης',
      majorGeoName: 'Βόρεια Ελλάδα',
      settlementId: 'stl_8',
      municipalityId: 'mun_5',
    });
  });

  it('τα ταχυδρομικά πεδία επιβιώνουν — και το «number» λέγεται «streetNumber» στις επαφές', () => {
    const flat = projectAddressVocabulary(FULL_FORM, 'form', 'contactFlat', {
      includePostal: true,
      clearedIdsAsNull: false,
    });
    expect(flat.streetNumber).toBe('16');
    expect(flat.street).toBe('Σμύρνης');
    expect(flat.postalCode).toBe('56224');
  });
});

describe('🔴 ονομαστικά ανά επίπεδο — η αποτυχία λέει ΠΟΙΟ έσπασε', () => {
  it.each(LEVELS)('«%s»: διεύθυνση έργου → οθόνη → διεύθυνση έργου', (level) => {
    const binding = ADMIN_LEVEL_VOCABULARY[level];
    const projectSlot = binding.projectAddress.name;
    const formSlot = binding.form.name;
    if (projectSlot === NOT_STORED || formSlot === NOT_STORED) return;

    const back = roundTrip('projectAddress');
    expect(back[formSlot[0]]).toBe(FULL_FORM[formSlot[0]]);
  });
});

describe('🔴 ο πλήρης κύκλος ΜΕ το Zod — εκεί πέθαινε η τιμή', () => {
  it('η διεύθυνση έργου επιβιώνει από το PATCH με όλη την ιεραρχία', () => {
    const stored = projectAddressVocabulary(FULL_FORM, 'form', 'projectAddress', {
      includePostal: true,
      clearedIdsAsNull: true,
    }) as Partial<ProjectAddress>;

    const persisted = projectAddressSchema.parse({
      ...stored,
      id: 'addr_1',
      city: resolveCityFromHierarchy(FULL_FORM),
      type: 'site',
      isPrimary: true,
    });

    const back = projectAddressVocabulary(persisted, 'projectAddress', 'form', {
      includePostal: true,
      clearedIdsAsNull: true,
    }) as Partial<AddressWithHierarchyValue>;

    expect(back.municipalUnitName).toBe('Δ.Ε. ΕΥΟΣΜΟΥ');
    expect(back.decentAdminName).toBe('Α.Δ. Μακεδονίας - Θράκης');
    expect(back.majorGeoName).toBe('Βόρεια Ελλάδα');
    expect(back.majorGeoId).toBe('mg_1');
    expect(back.country).toBe('Greece');
  });

  it('🔑 ο φρουρός του φρουρού: αδήλωτο κλειδί ΕΞΑΚΟΛΟΥΘΕΙ να πετιέται', () => {
    const parsed = projectAddressSchema.parse({
      id: 'addr_1', street: 'Σμύρνης', city: 'Εύοσμος', postalCode: '56224',
      country: 'Greece', type: 'site', isPrimary: true,
      totallyUnknownField: 'x',
    }) as Record<string, unknown>;
    expect('totallyUnknownField' in parsed).toBe(false);
  });
});

describe('🔴 το εργοστάσιο δεν είναι δεύτερη λίστα επιτρεπτών πεδίων', () => {
  it('το `createProjectAddress` περνά την ιεραρχία που του δίνεις', () => {
    const created = createProjectAddress({
      ...(projectAddressVocabulary(FULL_FORM, 'form', 'projectAddress', {
        includePostal: true,
        clearedIdsAsNull: false,
      }) as Partial<ProjectAddress>),
      city: resolveCityFromHierarchy(FULL_FORM),
      type: 'frontage',
      frontageIndex: 1,
    });

    // Πριν το ADR-772 η χειρόγραφη λίστα πετούσε **και τα τρία** παρακάτω.
    expect(created.municipalUnit).toBe('Δ.Ε. ΕΥΟΣΜΟΥ');
    expect(created.decentAdmin).toBe('Α.Δ. Μακεδονίας - Θράκης');
    expect(created.majorGeoId).toBe('mg_1');
    // …και δεν έσπασε τα υποχρεωτικά με προεπιλογή.
    expect(created.city).toBe('Εύοσμος');
    expect(created.type).toBe('frontage');
    expect(created.id).toMatch(/.+/);
  });

  it('δεν γράφει κενά/`null` σε νέα εγγραφή — δεν υπάρχει τι να σβηστεί', () => {
    const created = createProjectAddress({ city: 'Εύοσμος' }) as Record<string, unknown>;
    expect('municipalUnit' in created).toBe(false);
    expect('settlementId' in created).toBe(false);
  });
});

describe('ο κανόνας «οικισμός, αλλιώς Δήμος» — ένα σημείο, δύο καταναλωτές', () => {
  it('πέφτει στον Δήμο όταν λείπει ο οικισμός', () => {
    const noSettlement = { ...FULL_FORM, settlementName: '' };
    expect(resolveCityFromHierarchy(noSettlement)).toBe('Δήμος Κορδελιού - Ευόσμου');
  });

  it('🔴 ο γεωκωδικοποιητής παίρνει ΤΗΝ ΙΔΙΑ πόλη με την αποθήκευση', () => {
    // Τα δύο αντίγραφα είχαν αποκλίνει: το ένα δεν είχε το fallback, οπότε ένα χωριό
    // έστελνε διεύθυνση **χωρίς πόλη** στον γεωκωδικοποιητή.
    const noSettlement = { ...FULL_FORM, settlementName: '' };
    expect(hierarchyToResolvedAddress(noSettlement).city).toBe(
      resolveCityFromHierarchy(noSettlement),
    );
  });
});
