/**
 * @fileoverview **ΤΟ ΣΥΝΟΡΟ ΤΗΣ ΖΗΤΗΣΗΣ, ΕΚΤΕΛΕΣΜΕΝΟ** — ADR-864 §7 Α15 · CHECK 3.74.
 * @related lib/demand/property-demand-from-document.ts · ADR-842 §7.6.12
 *
 * 🔴 **ΤΙ ΚΡΙΝΕΤΑΙ ΕΔΩ, ΚΑΙ ΤΙ ΟΧΙ.** Δεν κρίνεται ότι «το ταίριασμα δουλεύει» — αυτό
 * το φυλάνε οι δικές του άγκυρες. Κρίνεται ότι **καμία ελλιπής ζήτηση δεν περνά για
 * πλήρης**, ότι το «δεν ξέρω» φτάνει στον άνθρωπο **με όνομα** αντί για προεπιλογή, και
 * ότι η **δηλωμένη** ουδέτερη τιμή (Avro) δεν μπερδεύεται με **εφευρημένη** (AIP-216).
 *
 * ⚠️ **Το λεξιλόγιο ΕΚΤΕΛΕΙΤΑΙ, δεν αντιγράφεται**: η ομάδα Κ2 διατρέχει το ίδιο το
 * `DEMAND_GAPS`, άρα νέο κενό χωρίς κριτή **κοκκινίζει εδώ** — δεν παλιώνει σιωπηλά.
 */

import {
  propertyDemandFromDocument,
  readStoredDemand,
} from '@/lib/demand/property-demand-from-document';
import {
  DEMAND_GAPS,
  NO_DEMAND_FEATURES,
  type DemandGap,
  type PropertyDemand,
} from '@/types/property-demand';

import { demand } from './demand-fixtures';

/** Ό,τι θα γύριζε η Firestore: το έγγραφο **χωρίς** την ταυτότητά του. */
function storedDoc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const { id: _ignored, ...body } = demand();
  return { ...body, ...overrides };
}

/** Το έγγραφο **χωρίς** ένα συγκεκριμένο πεδίο — η μετάλλαξη του παλιού εγγράφου. */
function withoutField(field: string): Record<string, unknown> {
  const body = storedDoc();
  delete body[field];
  return body;
}

describe('Κ1 — πλήρες έγγραφο περνά, και η ταυτότητα έρχεται ΑΠΟ ΕΞΩ', () => {
  it('γνωστό σχήμα ⇒ `complete`', () => {
    const read = readStoredDemand(storedDoc(), 'dmnd_a');
    expect(read?.kind).toBe('complete');
  });

  it('το `id` του εγγράφου υπερισχύει ενός `id` μέσα στο περιεχόμενο', () => {
    const read = readStoredDemand(storedDoc({ id: 'dmnd_ΑΝΤΙΓΡΑΦΟ' }), 'dmnd_πραγματικό');
    expect(read?.kind === 'complete' && read.demand.id).toBe('dmnd_πραγματικό');
  });
});

describe('Κ2 — ΚΑΘΕ κενό του λεξιλογίου πιάνεται, ΜΕ ΤΟ ΟΝΟΜΑ ΤΟΥ', () => {
  // 🔑 Ο πίνακας **εκτελείται**: νέο `DemandGap` χωρίς κριτή κοκκινίζει εδώ.
  it.each(DEMAND_GAPS)('απόν «%s» ⇒ incomplete με ακριβώς αυτό το κενό', (gap: DemandGap) => {
    const read = readStoredDemand(withoutField(gap), 'dmnd_a');

    expect(read?.kind).toBe('incomplete');
    expect(read?.kind === 'incomplete' && read.gaps).toEqual([gap]);
    // 🔴 Η μετάλλαξη που πιάνει την επιστροφή του ελαττώματος: καμία σιωπηλή προεπιλογή.
    expect(read?.kind).not.toBe('complete');
  });

  it('δύο κενά αναφέρονται **και τα δύο**, με τη σειρά του λεξιλογίου', () => {
    const body = storedDoc();
    delete body.place;
    delete body.timing;

    const read = readStoredDemand(body, 'dmnd_a');
    expect(read?.kind === 'incomplete' && read.gaps).toEqual(['place', 'timing']);
  });
});

describe('Κ3 — AIP-216: άγνωστη τιμή ΔΕΝ βαφτίζεται, ονομάζεται', () => {
  it('`lifecycle` εκτός λεξιλογίου ⇒ incomplete, ΠΟΤΕ «active»', () => {
    const read = readStoredDemand(storedDoc({ lifecycle: 'zombie' }), 'dmnd_a');

    expect(read?.kind === 'incomplete' && read.gaps).toEqual(['lifecycle']);
    // Το ρητά απαγορευμένο: «χωρίς αναγνωρίσιμη κατάσταση ⇒ ψάχνει».
    expect(read?.kind === 'complete' && (read.demand as PropertyDemand).lifecycle).not.toBe(
      'active',
    );
  });

  it('`place`/`timing`/`mandate` χωρίς `kind` ⇒ incomplete (όχι «anywhere»/«whenever»)', () => {
    expect(readStoredDemand(storedDoc({ place: {} }), 'dmnd_a')?.kind).toBe('incomplete');
    expect(readStoredDemand(storedDoc({ timing: 42 }), 'dmnd_a')?.kind).toBe('incomplete');
    expect(readStoredDemand(storedDoc({ mandate: null }), 'dmnd_a')?.kind).toBe('incomplete');
  });
});

describe('Κ4 — Avro: ΔΗΛΩΜΕΝΗ ουδέτερη τιμή επιτρέπεται, εφευρημένη όχι', () => {
  it('χωρίς `features` ⇒ πλήρης, με τη σταθερά του σχήματος', () => {
    const read = readStoredDemand(withoutField('features'), 'dmnd_a');

    expect(read?.kind).toBe('complete');
    expect(read?.kind === 'complete' && read.demand.features).toEqual(NO_DEMAND_FEATURES);
    // Χωρίς αυτό, το `demand-match-axes.ts:61` πετά στην αποδόμηση.
    expect(() => {
      const { types } = (read as { demand: PropertyDemand }).demand.features;
      return types.length;
    }).not.toThrow();
  });

  it('χωρίς `proximity` ⇒ πλήρης, με κενό πίνακα («καμία απαίτηση»)', () => {
    const read = readStoredDemand(withoutField('proximity'), 'dmnd_a');

    expect(read?.kind).toBe('complete');
    expect(read?.kind === 'complete' && read.demand.proximity).toEqual([]);
  });

  it('χωρίς `lifeContext` ⇒ `null` — ο τύπος **ήδη** το δηλώνει', () => {
    const read = readStoredDemand(withoutField('lifeContext'), 'dmnd_a');
    expect(read?.kind === 'complete' && read.demand.lifeContext).toBeNull();
  });

  it('υπαρκτές τιμές περνούν ΑΥΤΟΥΣΙΕΣ', () => {
    const features = { ...NO_DEMAND_FEATURES, priceMax: 180_000 };
    const read = readStoredDemand(storedDoc({ features }), 'dmnd_a');
    expect(read?.kind === 'complete' && read.demand.features).toEqual(features);
  });
});

describe('Κ5 — αναγνωσιμότητα ≠ εγκυρότητα, και τα δύο έχουν δικό τους σπίτι', () => {
  it('`seeks: []` ΔΙΑΒΑΖΕΤΑΙ (το κρίνει ο `seeks-empty`, όχι το σύνορο)', () => {
    const read = readStoredDemand(storedDoc({ seeks: [] }), 'dmnd_a');
    expect(read?.kind).toBe('complete');
  });

  it('`seeks` που δεν είναι πίνακας ⇒ κενό ανάγνωσης', () => {
    expect(readStoredDemand(storedDoc({ seeks: 'sell' }), 'dmnd_a')?.kind).toBe('incomplete');
  });
});

describe('Κ6 — τι σημαίνει `null` από το ίδιο το σύνορο', () => {
  it('`null` ΜΟΝΟ όταν τα δεδομένα δεν είναι καν αντικείμενο', () => {
    expect(readStoredDemand(null, 'dmnd_a')).toBeNull();
    expect(readStoredDemand(undefined, 'dmnd_a')).toBeNull();
    expect(readStoredDemand('κείμενο', 'dmnd_a')).toBeNull();
    expect(readStoredDemand([1, 2, 3], 'dmnd_a')).toBeNull();
  });

  it('🔴 ελλιπές έγγραφο ΔΕΝ γίνεται `null` — η ζήτηση ΖΕΙ και διορθώνεται', () => {
    expect(readStoredDemand({}, 'dmnd_a')).not.toBeNull();
    expect(readStoredDemand({}, 'dmnd_a')?.kind).toBe('incomplete');
  });
});

describe('Κ7 — η ΚΑΡΑΝΤΙΝΑ: ο διακομιστής δεν βλέπει ποτέ ελλιπή ζήτηση', () => {
  it('το λεπτό περιτύλιγμα δίνει `null` για ελλιπές', () => {
    expect(propertyDemandFromDocument(withoutField('place'), 'dmnd_a')).toBeNull();
  });

  it('και τη ζήτηση για πλήρες', () => {
    expect(propertyDemandFromDocument(storedDoc(), 'dmnd_a')?.id).toBe('dmnd_a');
  });
});

describe('Κ8 — ιδιοδυναμία: δεύτερη διέλευση δίνει το ίδιο', () => {
  it('το αποτέλεσμα ξαναπερασμένο από το σύνορο δεν αλλάζει', () => {
    const first = propertyDemandFromDocument(withoutField('features'), 'dmnd_a');
    const second = propertyDemandFromDocument(first, 'dmnd_a');
    expect(second).toEqual(first);
  });
});
