/**
 * ADR-833 §1.3 — άγκυρες της δρομολόγησης των δύο εντολών `.xlsx`.
 *
 * 🔴 **Η ερώτηση που απαντούν**: «πατάω *Εισαγωγή* — μήπως εκπέμπεται το *Άνοιγμα*;»
 * Δεν είναι υποθετικό: οι δύο εντολές διαφέρουν **μόνο** στο ποιο συμβάν στέλνουν, και το
 * λάθος συμβάν σημαίνει ότι η «Εισαγωγή» **αντικαθιστά** τον πίνακα του χρήστη ενώ υποσχέθηκε
 * ότι δεν αγγίζει τίποτα. Καμία εξαίρεση δεν θα πεταχτεί και το κουμπί θα φαίνεται ότι δουλεύει
 * — η ακριβής υπογραφή των τεσσάρων περιστατικών «λάθος κλάδου» του §56/§57/§59.
 */

import { EventBus } from '../../../../../systems/events/EventBus';
import { writeTableXlsxCommand } from '../table-format-field-routing';
import {
  TABLE_PROPERTIES_RIBBON_KEYS,
  TABLE_FORMAT_RIBBON_KEYS,
  isTablePropertiesActionKey,
} from '../table-format-command-keys';

/** Καταγράφει ό,τι εκπέμπεται σε ΟΛΑ τα συμβάντα που μας αφορούν, με τη σειρά. */
function recordEmissions(): { readonly seen: string[]; readonly stop: () => void } {
  const seen: string[] = [];
  const offs = [
    EventBus.on('dxf:table-open-xlsx-requested', () => seen.push('open')),
    EventBus.on('dxf:table-import-xlsx-requested', () => seen.push('import')),
  ];
  return { seen, stop: () => offs.forEach((off) => off()) };
}

describe('writeTableXlsxCommand — κάθε εντολή στο ΔΙΚΟ της συμβάν', () => {
  it('«Άνοιγμα» ⇒ ΜΟΝΟ το συμβάν ανοίγματος', () => {
    const rec = recordEmissions();
    const handled = writeTableXlsxCommand(TABLE_PROPERTIES_RIBBON_KEYS.actions.openXlsx);
    rec.stop();
    expect(handled).toBe(true);
    expect(rec.seen).toEqual(['open']);
  });

  it('🔴 «Εισαγωγή αρχείου» ⇒ ΜΟΝΟ το συμβάν εισαγωγής (ποτέ του ανοίγματος)', () => {
    const rec = recordEmissions();
    const handled = writeTableXlsxCommand(TABLE_PROPERTIES_RIBBON_KEYS.actions.importXlsx);
    rec.stop();
    expect(handled).toBe(true);
    // Αν αυτό γίνει `['open']`, η «Εισαγωγή» σβήνει τα δεδομένα του χρήστη.
    expect(rec.seen).toEqual(['import']);
  });

  it('ξένο κλειδί ⇒ `false` και ΚΑΝΕΝΑ συμβάν (ο bridge συνεχίζει τη ζυγαριά του)', () => {
    const rec = recordEmissions();
    const handled = writeTableXlsxCommand(TABLE_PROPERTIES_RIBBON_KEYS.actions.refreshBinding);
    const alsoForeign = writeTableXlsxCommand(TABLE_FORMAT_RIBBON_KEYS.actions.copy);
    rec.stop();
    expect(handled).toBe(false);
    expect(alsoForeign).toBe(false);
    expect(rec.seen).toEqual([]);
  });
});

describe('τα δύο κλειδιά είναι ΔΗΛΩΜΕΝΑ — αλλιώς ο dispatcher δεν φτάνει ποτέ εδώ', () => {
  it('περνούν τον φύλακα `isTablePropertiesActionKey`', () => {
    // 🔴 Χωρίς αυτό, το `useRibbonCommands-action.ts` στέλνει το κλειδί στον γενικό
    // `wrappedHandleAction` και ο bridge **δεν καλείται καν** — κουμπί που δεν κάνει τίποτα.
    expect(isTablePropertiesActionKey(TABLE_PROPERTIES_RIBBON_KEYS.actions.openXlsx)).toBe(true);
    expect(isTablePropertiesActionKey(TABLE_PROPERTIES_RIBBON_KEYS.actions.importXlsx)).toBe(true);
  });

  it('τα δύο κλειδιά είναι ΔΙΑΦΟΡΕΤΙΚΑ μεταξύ τους', () => {
    expect(TABLE_PROPERTIES_RIBBON_KEYS.actions.openXlsx).not.toBe(
      TABLE_PROPERTIES_RIBBON_KEYS.actions.importXlsx,
    );
  });
});
