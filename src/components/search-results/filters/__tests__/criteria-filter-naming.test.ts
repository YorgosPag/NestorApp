/**
 * 🔴 **ΚΑΘΕ ΑΞΟΝΑΣ ΕΧΕΙ ΟΝΟΜΑ, ΚΑΘΕ ΕΠΙΛΟΓΗ ΕΧΕΙ ΟΝΟΜΑ, ΚΑΙ ΚΑΝΕΝΑ ΔΕΝ ΕΙΝΑΙ ΩΜΟ
 * ΚΛΕΙΔΙ** — άγκυρα (ADR-777 §8.51).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΓΙΑΤΙ ΑΥΤΗ Η ΑΓΚΥΡΑ ΕΙΝΑΙ ΑΠΑΡΑΙΤΗΤΗ, ΚΑΙ ΔΕΝ ΤΗΝ ΚΑΝΕΙ ΚΑΜΙΑ ΠΥΛΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Οι ετικέτες ζητιούνται με **κυριολεκτικό πρόθεμα + μεταβλητή**
 * (`` t(`listing-detail:attributes.label.${key}`) ``) — γραφή που είναι **σωστή** για
 * τον γεννήτορα του shell slice, αλλά **αόρατη** στον στατικό σαρωτή της **CHECK 3.8**:
 * ο σαρωτής βλέπει `t()` με πρότυπο, **δεν βλέπει κλειδί**. Άρα ένα κλειδί που λείπει
 * περνά την πύλη και φτάνει στην οθόνη ως **ωμό κείμενο κλειδιού** μπροστά στον
 * ανώνυμο επισκέπτη — η ακριβής οικογένεια που κυνηγά το CHECK 3.51, από άλλη πόρτα.
 *
 * 🔑 Η θεραπεία είναι να **διαβαστούν τα ίδια τα locale JSON** και να επαληθευτεί ότι
 * **κάθε** κλειδί που θα ζητήσει η οθόνη υπάρχει — **και στις δύο γλώσσες**. Ίδιο
 * ιδίωμα με το `listing-attribute-value.test.ts`, που το έκανε ήδη για τις τιμές.
 */

import fs from 'fs';
import path from 'path';

import type { TFunction } from 'i18next';

import {
  LISTING_CRITERION_ASKING,
  LISTING_CRITERION_KEYS,
  type ValueSetCriterionKey,
} from '@/lib/criteria/listing-criterion-asking';
import { CRITERION_VALUES } from '@/lib/criteria/listing-criterion-values';
import {
  criteriaGroupLabel,
  criterionLabel,
  criterionValueLabel,
} from '@/lib/criteria/listing-criterion-labels';

import {
  CRITERIA_FILTER_GROUPS,
  PRIMARY_CRITERION_KEYS,
} from '../criteria-filter-groups';

// =============================================================================
// ΤΑ ΟΡΓΑΝΑ — ένας μεταφραστής που ΚΑΤΑΓΡΑΦΕΙ, και τα αληθινά locale
// =============================================================================

const LANGUAGES = ['el', 'en'] as const;

/** Φορτώνει ένα αληθινό locale JSON — **όχι** αντίγραφο. */
function locale(language: string, namespace: string): Record<string, unknown> {
  const file = path.join(
    __dirname, '..', '..', '..', '..', 'i18n', 'locales', language, `${namespace}.json`
  );
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
}

/** Υπάρχει αυτό το `ns:a.b.c` στα φορτωμένα locale; */
function resolves(language: string, fullKey: string): boolean {
  const [namespace, dotted] = fullKey.split(':');
  if (dotted === undefined) return false;
  let node: unknown = locale(language, namespace);
  for (const part of dotted.split('.')) {
    if (typeof node !== 'object' || node === null) return false;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string';
}

/**
 * Μεταφραστής που **επιστρέφει το κλειδί και το θυμάται**.
 *
 * 🔑 Έτσι κάθε δοκιμή ελέγχει ότι ζητήθηκε το **σωστό** κλειδί — και ένα κλειδί
 * συναρμολογημένο λάθος φαίνεται **αμέσως**.
 */
function recordingT(): { t: TFunction; keys: string[] } {
  const keys: string[] = [];
  const t = ((key: string) => {
    keys.push(key);
    return key;
  }) as unknown as TFunction;
  return { t, keys };
}

// =============================================================================
// Α — Η ΔΙΑΤΑΞΗ: ΚΑΘΕ ΑΞΟΝΑΣ ΣΕ **ΑΚΡΙΒΩΣ ΜΙΑ** ΟΜΑΔΑ
// =============================================================================

describe('Α — η διάταξη παράγεται, και δεν χάνει κανέναν', () => {
  it('🔴 ΚΑΘΕ άξονας εμφανίζεται σε ΑΚΡΙΒΩΣ ΜΙΑ ομάδα — κανένας χαμένος, κανένας διπλός', () => {
    // Ο πίνακας ομάδων παράγεται με φιλτράρισμα. Αν κάποιος τον ξαναγράψει χειρόγραφα
    // (ή προσθέσει άξονα χωρίς ομάδα), ο άξονας θα **έλειπε σιωπηλά από την οθόνη**:
    // ο μεταγλωττιστής θα τον απαιτούσε στους τρεις πίνακες, όχι στη διάταξη.
    const placed = CRITERIA_FILTER_GROUPS.flatMap((g) => g.keys);
    expect([...placed].sort()).toEqual([...LISTING_CRITERION_KEYS].sort());
    expect(new Set(placed).size).toBe(placed.length);
  });

  it('τα τέσσερα του πρώτου επιπέδου είναι όντως άξονες', () => {
    for (const key of PRIMARY_CRITERION_KEYS) {
      expect(LISTING_CRITERION_KEYS).toContain(key);
    }
  });

  it('η σειρά μέσα σε κάθε ομάδα είναι η σειρά του ΕΝΟΣ καταλόγου', () => {
    // Δεύτερη δήλωση σειράς = δύο οθόνες που δείχνουν τα ίδια πεδία αλλιώς.
    for (const { keys } of CRITERIA_FILTER_GROUPS) {
      const canonical = LISTING_CRITERION_KEYS.filter((key) => keys.includes(key));
      expect(keys).toEqual(canonical);
    }
  });
});

// =============================================================================
// Β — 🔴 ΚΑΘΕ ΕΤΙΚΕΤΑ ΑΞΟΝΑ ΛΥΝΕΤΑΙ, ΚΑΙ ΣΤΙΣ ΔΥΟ ΓΛΩΣΣΕΣ
// =============================================================================

describe('Β — οι 31 ετικέτες αξόνων', () => {
  it.each([...LANGUAGES])('🔴 κάθε άξονας έχει ετικέτα που ΥΠΑΡΧΕΙ στα locale (%s)', (language) => {
    const missing: string[] = [];
    for (const key of LISTING_CRITERION_KEYS) {
      const { t, keys } = recordingT();
      criterionLabel(t, key);
      if (!resolves(language, keys[0])) missing.push(`${key} → ${keys[0]}`);
    }
    expect(missing).toEqual([]);
  });

  it('οι 27 δανείζονται τις ετικέτες της ΟΘΟΝΗΣ 3 — καμία δεύτερη γραφή', () => {
    // Αν κάποιος γεννήσει `search-filters:filters.axis.energyClass`, εδώ θα φανεί:
    // θα ήταν δεύτερο μητρώο για λέξη που ήδη υπάρχει.
    const { t } = recordingT();
    expect(criterionLabel(t, 'energyClass')).toBe('listing-detail:attributes.label.energyClass');
    expect(criterionLabel(t, 'amenities')).toBe('listing-detail:attributes.label.amenities');
  });

  it('οι 4 ειδικοί έχουν δικές τους — γιατί ΔΕΝ είναι δημόσια στοιχεία', () => {
    const { t } = recordingT();
    expect(criterionLabel(t, 'price')).toBe('search-filters:filters.axis.price');
    expect(criterionLabel(t, 'hasPhotos')).toBe('search-filters:filters.axis.hasPhotos');
  });
});

// =============================================================================
// Γ — 🔴 ΚΑΘΕ ΕΤΙΚΕΤΑ ΤΙΜΗΣ ΛΥΝΕΤΑΙ — ΟΛΕΣ, ΚΑΙ ΣΤΙΣ ΔΥΟ ΓΛΩΣΣΕΣ
// =============================================================================

describe('Γ — οι ετικέτες των επιλογών', () => {
  const valueSetKeys = LISTING_CRITERION_KEYS.filter(
    (key) => LISTING_CRITERION_ASKING[key] !== 'range' && LISTING_CRITERION_ASKING[key] !== 'flag'
  ) as readonly ValueSetCriterionKey[];

  it.each([...LANGUAGES])(
    '🔴 ΚΑΘΕ τιμή ΚΑΘΕ λεξιλογίου ονομάζεται από κλειδί που υπάρχει (%s)',
    (language) => {
      const missing: string[] = [];
      for (const key of valueSetKeys) {
        for (const value of CRITERION_VALUES[key]) {
          const { t, keys } = recordingT();
          const label = criterionValueLabel(t, key, value);
          // Το `verbatim` (ενεργειακή κλάση) δεν ζητά κλειδί — είναι σύμβολο κανονισμού.
          if (keys.length === 0) {
            expect(label).toBe(value);
            continue;
          }
          if (!resolves(language, keys[0])) missing.push(`${key}/${value} → ${keys[0]}`);
        }
      }
      expect(missing).toEqual([]);
    }
  );

  it('οι διαθέσεις χρησιμοποιούν ΤΑ ΙΔΙΑ κλειδιά με την κάρτα', () => {
    const { t } = recordingT();
    expect(criterionValueLabel(t, 'offerKind', 'leaseOut')).toBe(
      'search-results:listing.offer.leaseOut'
    );
  });

  it('⚠️ είδος εκτός λεξιλογίου ⇒ Η ΩΜΗ ΤΙΜΗ, ποτέ ωμό κλειδί', () => {
    // Μια παλιά ελληνική τιμή της βάσης δεν έχει γραμμή στο `PROPERTY_TYPE_I18N_KEYS`.
    // Χωρίς τον έλεγχο κανονικότητας, η οθόνη θα ζωγράφιζε `properties-enums:undefined`.
    const { t, keys } = recordingT();
    expect(criterionValueLabel(t, 'type', 'Οικόπεδο')).toBe('Οικόπεδο');
    expect(keys).toEqual([]);
  });
});

// =============================================================================
// Δ — ΟΙ ΕΞΙ ΚΕΦΑΛΙΔΕΣ ΟΜΑΔΩΝ
// =============================================================================

describe('Δ — οι κεφαλίδες των ομάδων', () => {
  it.each([...LANGUAGES])('κάθε ομάδα έχει κεφαλίδα που υπάρχει στα locale (%s)', (language) => {
    const missing: string[] = [];
    for (const { group } of CRITERIA_FILTER_GROUPS) {
      const { t, keys } = recordingT();
      criteriaGroupLabel(t, group);
      if (!resolves(language, keys[0])) missing.push(`${group} → ${keys[0]}`);
    }
    expect(missing).toEqual([]);
  });

  it('οι πέντε δανείζονται τις ομάδες της οθόνης 3', () => {
    const { t } = recordingT();
    expect(criteriaGroupLabel(t, 'systemsFinishes')).toBe(
      'listing-detail:attributes.group.systemsFinishes'
    );
  });
});
