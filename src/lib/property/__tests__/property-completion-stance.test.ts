/**
 * @fileoverview ΑΓΚΥΡΑ — **η στάση πληρότητας ανά διάθεση** (ADR-842 Φ5 · §8 #1).
 * @related lib/property/property-completion-stance.ts
 *
 * 🔑 **Τι φυλάει, με μία πρόταση**: ότι το ερώτημα *«είναι αποπερατωμένο;»* απαντιέται
 * για **κάθε** τιμή που μπορεί πραγματικά να φτάσει στο `commercialStatus` — και ότι
 * **καμία** απάντηση δεν κρύβει τον δείκτη.
 */

import { COMMERCIAL_STATUSES } from '@/constants/commercial-statuses';
import { PROPERTY_STATUS_LABELS } from '@/constants/domains/property-status-core';
import { OPERATIONAL_STATUSES } from '@/constants/operational-statuses';
import {
  completionStanceFor,
  operationalStatusForListing,
} from '../property-completion-stance';

/**
 * Ο κατάλογος του **υπερσυνόλου**, παραγόμενος από τον πίνακα ετικετών — που είναι
 * `Record<PropertyStatus, string>`, δηλαδή **εξαντλητικός εξ ορισμού**.
 *
 * ⚠️ **Χειρόγραφη λίστα εδώ θα ήταν δεύτερη αλήθεια** και θα πάλιωνε σιωπηλά: μια νέα
 * τιμή θα έμενε αδοκίμαστη ενώ το test θα ήταν πράσινο.
 */
const ALL_PROPERTY_STATUSES = Object.keys(PROPERTY_STATUS_LABELS);

describe('completionStanceFor — κάθε διάθεση έχει απάντηση', () => {
  it.each(ALL_PROPERTY_STATUSES)('«%s» απαντά με γνωστή στάση', (status) => {
    expect(['full', 'pre-completion']).toContain(completionStanceFor(status));
  });

  it('η μόνη προ-αποπεράτωσης είναι το «σύντομα διαθέσιμο» (απόφαση Giorgio 2026-09-02)', () => {
    const preCompletion = ALL_PROPERTY_STATUSES.filter(
      (status) => completionStanceFor(status) === 'pre-completion',
    );
    expect(preCompletion).toEqual(['coming-soon']);
  });

  it('«landowner» είναι ιδιοκτησία, ΟΧΙ αποπεράτωση — δες την κεφαλίδα', () => {
    expect(completionStanceFor('landowner')).toBe('full');
  });
});

describe('🔴 CommercialStatus ⊆ PropertyStatus — αλλιώς ο πίνακας έχει τρύπα', () => {
  /**
   * 🔴 **Ο ΛΟΓΟΣ ΠΟΥ ΥΠΑΡΧΕΙ**: ο πίνακας είναι κλειδωμένος στο `PropertyStatus`, ενώ
   * το πεδίο που τον τροφοδοτεί είναι τυπωμένο `CommercialStatus`. Αν οι δύο ενώσεις
   * αποκλίνουν, μια **ζωντανή** εμπορική κατάσταση θα έπεφτε στην προεπιλογή χωρίς να
   * το πάρει είδηση κανείς — γραμμή που **λείπει** αντί για γραμμή που **λέει λάθος**.
   */
  it.each(COMMERCIAL_STATUSES)('η εμπορική «%s» έχει γραμμή στο υπερσύνολο', (status) => {
    expect(ALL_PROPERTY_STATUSES).toContain(status);
  });
});

describe('operationalStatusForListing — ο μεταφραστής προς τη μηχανή', () => {
  it('«σύντομα διαθέσιμο» ⇒ under-construction', () => {
    expect(operationalStatusForListing('coming-soon')).toBe('under-construction');
  });

  it('κάθε άλλη διάθεση ⇒ undefined (πλήρης παρονομαστής)', () => {
    expect(operationalStatusForListing('for-sale')).toBeUndefined();
    expect(operationalStatusForListing('sold')).toBeUndefined();
    expect(operationalStatusForListing('unavailable')).toBeUndefined();
  });

  /**
   * ⛔ **Η ΓΡΑΜΜΗ ΠΟΥ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΠΟΤΕ.** Το `draft` δεν εξαιρεί πεδία — **σβήνει
   * τον δείκτη** (`shouldHide`). Μια δημοσιευμένη αγγελία που βαθμολογείται ως
   * πρόχειρη θα εξαφάνιζε το κίνητρο, σιωπηλά, για όλους.
   */
  it('🔴 ΚΑΜΙΑ διάθεση δεν χαρτογραφείται σε «draft»', () => {
    const produced = ALL_PROPERTY_STATUSES.map(operationalStatusForListing);
    expect(produced).not.toContain('draft');
  });

  it('ό,τι παράγει είναι γνωστή λειτουργική κατάσταση ή undefined', () => {
    for (const status of ALL_PROPERTY_STATUSES) {
      const produced = operationalStatusForListing(status);
      if (produced !== undefined) {
        expect(OPERATIONAL_STATUSES as readonly string[]).toContain(produced);
      }
    }
  });
});

describe('άγνωστη είσοδος — η προεπιλογή είναι η ΑΥΣΤΗΡΗ', () => {
  it.each([null, undefined, '', '   ', 'κάτι τυχαίο', 'COMING-SOON'])(
    '%p ⇒ πλήρης παρονομαστής',
    (input) => {
      expect(completionStanceFor(input as string | null | undefined)).toBe('full');
      expect(operationalStatusForListing(input as string | null | undefined)).toBeUndefined();
    },
  );
});
