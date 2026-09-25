/**
 * ⚓ **ΜΟΝΑΔΙΚΟΤΗΤΑ ΤΩΝ ΠΡΟΘΕΜΑΤΩΝ** — ένα πρόθεμα, μία οντότητα (ADR-884 §4.1, Boy Scout N.0.2).
 *
 * Μέχρι σήμερα η μοναδικότητα των τιμών του `ENTERPRISE_ID_PREFIXES` φυλαγόταν **μόνο** από σχόλια
 * και ανασκόπηση. Ένα δεύτερο `'stour'` θα έκανε το `getIdType(id)` να απαντά **λάθος οντότητα** για
 * κάθε έγγραφο της πρώτης — σιωπηλά, χωρίς κανένα σφάλμα γέννησης.
 *
 * 🔶 **Κλειστή λίστα γνωστών ψευδωνύμων** — μετρημένο 2026-09-25: **ένα**. Το `msg` το κρατούν
 * `MESSAGE` και `MESSAGE_DOC` (omnichannel) με ζωντανά δεδομένα από πίσω· η μετονομασία θα άλλαζε
 * ταυτότητες αποθηκευμένων εγγράφων. Η λίστα **μόνο μικραίνει**: νέο ψευδώνυμο ⇒ κόκκινο, και
 * ψευδώνυμο που έπαψε να υπάρχει ⇒ επίσης κόκκινο (μπαγιάτικη εξαίρεση = λευκή επιταγή).
 */

import { ENTERPRISE_ID_PREFIXES } from '../enterprise-id-prefixes';

const KNOWN_ALIASES: Readonly<Record<string, readonly string[]>> = {
  msg: ['MESSAGE', 'MESSAGE_DOC'],
};

function keysByPrefix(): Map<string, string[]> {
  const byPrefix = new Map<string, string[]>();
  for (const [key, prefix] of Object.entries(ENTERPRISE_ID_PREFIXES)) {
    byPrefix.set(prefix, [...(byPrefix.get(prefix) ?? []), key].sort());
  }
  return byPrefix;
}

describe('ENTERPRISE_ID_PREFIXES — ένα πρόθεμα, μία οντότητα', () => {
  it('δεν δίνει το ίδιο πρόθεμα σε δύο κλειδιά, πέρα από τα δηλωμένα ψευδώνυμα', () => {
    const shared = [...keysByPrefix()]
      .filter(([prefix, keys]) => keys.length > 1 && !(prefix in KNOWN_ALIASES))
      .map(([prefix, keys]) => `${prefix}: ${keys.join(', ')}`);

    expect(shared).toEqual([]);
  });

  it('κάθε δηλωμένο ψευδώνυμο ισχύει ΑΚΡΙΒΩΣ όπως γράφτηκε — ούτε νέο κλειδί, ούτε μπαγιάτικο', () => {
    const byPrefix = keysByPrefix();

    for (const [prefix, keys] of Object.entries(KNOWN_ALIASES)) {
      expect(byPrefix.get(prefix)).toEqual([...keys].sort());
    }
  });

  it('η σάρωση βλέπει και τα προθέματα DXF/BIM που μπαίνουν με spread (μάρτυρας)', () => {
    expect(Object.keys(ENTERPRISE_ID_PREFIXES).length).toBeGreaterThan(200);
  });
});
