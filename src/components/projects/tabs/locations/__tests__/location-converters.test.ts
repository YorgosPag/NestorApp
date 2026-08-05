/**
 * @fileoverview 🔴 **Ό,τι δείχνει ο επιλογέας, γυρίζει πίσω** (ADR-167 / ADR-759 Φ3).
 *
 * ## Το μετρημένο περιστατικό
 *
 * Το `AddressWithHierarchy` ζωγραφίζει **έξι** επίπεδα της διοικητικής ιεραρχίας, ανάμεσά τους
 * τη **Δημοτική Ενότητα** (επίπεδο 6, `address-with-hierarchy-config.ts:116`), και η καρτέλα
 * τοποθεσιών του έργου το χρησιμοποιεί αυτούσιο. Ο χρήστης το συμπλήρωνε κανονικά.
 *
 * Και οι **δύο** κατευθύνσεις το πετούσαν:
 * - `fromHierarchyValue` δεν χαρτογραφούσε το `municipalUnitName` πουθενά ⇒ **χανόταν στην
 *   αποθήκευση**·
 * - `toHierarchyValue` επέστρεφε σταθερά `municipalUnitName: ''` ⇒ **ξαναφαινόταν άδειο**.
 *
 * Δηλαδή η οθόνη ρωτούσε κάτι που η εφαρμογή δεν κρατούσε πουθενά, **χωρίς κανένα μήνυμα** — και
 * το «γιατί δεν αποθηκεύεται;» ήταν αδύνατο να απαντηθεί από τα symptoms: η αποθήκευση πετύχαινε.
 *
 * ⚠️ Χρειάζονταν **τρεις** διορθώσεις μαζί (οι δύο εδώ + το Zod του `address-schemas.ts`).
 * Οποιαδήποτε **μία** από αυτές θα άφηνε τη ροή σπασμένη ενώ θα *φαινόταν* διορθωμένη — γι' αυτό
 * ο έλεγχος παρακάτω είναι **κύκλος**, όχι δύο ξεχωριστές κατευθύνσεις.
 */

/* global describe, it, expect */
import type { ProjectAddress } from '@/types/project/addresses';
import { projectAddressSchema } from '@/types/project/address-schemas';
import { EMPTY_HIERARCHY, fromHierarchyValue, toHierarchyValue } from '../location-converters';

const ADDRESS: ProjectAddress = {
  id: 'addr_1',
  street: 'Σμύρνης',
  city: 'Εύοσμος',
  postalCode: '56224',
  country: 'Greece',
  type: 'site',
  isPrimary: true,
  municipality: 'Δήμος Κορδελιού - Ευόσμου',
  municipalUnit: 'Δ.Ε. ΕΥΟΣΜΟΥ',
  neighborhood: 'ΠΕΡΙΟΧΗ ΕΠΕΚΤΑΣΗΣ ΕΥΟΣΜΟΥ',
  regionalUnit: 'Π.Ε. Θεσσαλονίκης',
};

describe('🔴 Δημοτική Ενότητα — ο πλήρης κύκλος', () => {
  it('η αποθηκευμένη τιμή φτάνει στον επιλογέα', () => {
    expect(toHierarchyValue(ADDRESS).municipalUnitName).toBe('Δ.Ε. ΕΥΟΣΜΟΥ');
  });

  it('η επιλογή του χρήστη φτάνει στη διεύθυνση', () => {
    const fields = fromHierarchyValue({
      ...EMPTY_HIERARCHY,
      settlementName: 'Εύοσμος',
      municipalUnitName: 'Δ.Ε. ΕΥΟΣΜΟΥ',
    });
    expect(fields.municipalUnit).toBe('Δ.Ε. ΕΥΟΣΜΟΥ');
  });

  it('🔴 ΚΥΚΛΟΣ: διεύθυνση → επιλογέας → διεύθυνση → **Zod** → η τιμή ζει ακόμη', () => {
    // Το τελευταίο σκέλος είναι το κρίσιμο: χωρίς αυτό ο κύκλος ήταν πράσινος στη μνήμη και η
    // τιμή πέθαινε στο PATCH. Δύο σωστοί converters + αυστηρό σχήμα = ίδια σιωπηλή απώλεια.
    const roundTripped = fromHierarchyValue({
      ...EMPTY_HIERARCHY,
      ...toHierarchyValue(ADDRESS),
    });
    const persisted = projectAddressSchema.parse({ ...ADDRESS, ...roundTripped });
    expect(persisted.municipalUnit).toBe('Δ.Ε. ΕΥΟΣΜΟΥ');
  });

  it('κενή επιλογή δεν γράφει κενό κλειδί — «δεν δηλώθηκε» ≠ «δηλώθηκε κενό»', () => {
    expect('municipalUnit' in fromHierarchyValue(EMPTY_HIERARCHY)).toBe(false);
  });
});

describe('τα αδέλφια επίπεδα δεν παλινδρόμησαν', () => {
  it.each([
    ['municipalityName', 'municipality'],
    ['communityName', 'neighborhood'],
    ['regionalUnitName', 'regionalUnit'],
  ])('«%s» ↔ «%s»', (hierarchyKey, addressKey) => {
    const hierarchy = toHierarchyValue(ADDRESS) as Record<string, unknown>;
    expect(hierarchy[hierarchyKey]).toBe((ADDRESS as Record<string, unknown>)[addressKey]);

    const back = fromHierarchyValue({ ...EMPTY_HIERARCHY, ...hierarchy } as never) as Record<
      string,
      unknown
    >;
    expect(back[addressKey]).toBe((ADDRESS as Record<string, unknown>)[addressKey]);
  });
});
