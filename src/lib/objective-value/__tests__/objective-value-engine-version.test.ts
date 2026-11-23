/**
 * Άγκυρα της ταυτότητας της μηχανής (ADR-947 Δ3 · Φ2): η **έκδοση** και το **αποτύπωμα των πινάκων** καρφώνονται ΜΑΖΙ.
 *
 * 🔴 Αν κοκκίνισε το αποτύπωμα: άλλαξε αριθμός στο `objective-value-tables.ts`. **ΜΗΝ** ενημερώσεις μόνο το hash —
 *    αύξησε το `OBJECTIVE_VALUE_ENGINE_VERSION`, γράψε γραμμή στο changelog του ADR-898 με την απόφαση, και **τότε**
 *    καρφώσε το νέο ζεύγος. Τα στιγμιότυπα που ήδη υπάρχουν θα δείξουν «νέα μηχανή» στην απόκλιση — αυτό είναι το νόημα.
 *
 * Το hash υπολογίστηκε 2026-11-23 με την ίδια κανονικοποίηση (`sortKeysDeep` + `canonicalJson`) πάνω στα 23 exports.
 */

import { OBJECTIVE_VALUE_ENGINE_VERSION, objectiveValueEngineIdentity } from '../objective-value-engine-version';

const PINNED = {
  version: '2024.1',
  tablesSha256: '9a72b808337a67552d8b0d99a9a039f33b01716c43d39faead627d571a1a7cd4',
} as const;

describe('objectiveValueEngineIdentity', () => {
  it('🔑 η έκδοση και το αποτύπωμα των πινάκων αλλάζουν ΜΑΖΙ', async () => {
    await expect(objectiveValueEngineIdentity()).resolves.toEqual(PINNED);
  });

  it('η έκδοση της ταυτότητας είναι η δηλωμένη σταθερά', async () => {
    expect((await objectiveValueEngineIdentity()).version).toBe(OBJECTIVE_VALUE_ENGINE_VERSION);
  });
});
