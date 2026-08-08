/**
 * ADR-739 §61 — **η θύρα μορφοποίησης που ΑΡΝΕΙΤΑΙ ό,τι δεν της ζητήθηκε ρητά.**
 *
 * ## Γιατί υπάρχει, και γιατί «αρνείται» αντί για no-op
 * Το §61 έδωσε στον διάλογο **έναν** ξενιστή, που παίρνει το «ΟΚ» και το παραδίδει στο
 * `TableFormatPort.commitModel`. Δύο σουίτες χρειάζονται πλέον ζωντανή θύρα για να ασκήσουν τον
 * πραγματικό βρόχο (υποδοχή → store → ξενιστής → θύρα) αντί για παράκαμψη που θα έμενε πράσινη
 * ακόμη κι αν το καλώδιο είχε κοπεί.
 *
 * Κάθε μέλος που **δεν** δηλώθηκε πετά με το όνομά του. Ένα σιωπηλό `undefined` ή ένα no-op θα
 * έκρυβε μια κλήση σε **λάθος** μέθοδο πίσω από πράσινο test — ακριβώς η «παγίδα των `actions`»
 * που χτύπησε τέσσερις φορές σε αυτή την εκστρατεία (§56/§57/§58/§59).
 *
 * ⚠️ **ΔΕΝ είναι δίδυμο** του `fakePort` στο `useRibbonTableFormatBridge.test.tsx`, και δεν
 * ενοποιείται μαζί του: εκείνο **καταγράφει** δεκαπέντε μεθόδους επειδή ελέγχει *ποια* καλείται·
 * αυτό υλοποιεί **μία** και αρνείται τις υπόλοιπες, επειδή ελέγχει ότι ο ξενιστής **δεν** ρωτά
 * τίποτε άλλο. Αντίθετα συμβόλαια, αντίθετη προεπιλογή.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/__tests__/fake-table-format-port
 */

import type { TableFormatPort } from '../table-format-port';

type Refusable = Record<string, unknown>;

/** Κάθε μη-δηλωμένο μέλος πετά με το όνομά του — ποτέ σιωπηλό `undefined`. */
function refuse(name: string): () => never {
  return (): never => {
    throw new Error(`Η δοκιμαστική θύρα μορφοποίησης δεν έπρεπε να ρωτηθεί για «${name}»`);
  };
}

const REFUSED_METHODS = [
  'table', 'scope', 'bounds', 'state', 'colorState', 'toggle', 'setField', 'stepTextHeight',
  'textHeightMm', 'numberFormat', 'overflow', 'setOverflow', 'fontNames', 'reset', 'canReset',
  'commitModel', 'formatTarget',
] as const;

const REFUSED_GROUPS = ['borders', 'merge', 'structure', 'binding', 'painter', 'clipboard'] as const;

/**
 * Θύρα όπου **μόνο** τα `overrides` απαντούν.
 *
 * Ο τύπος επιστροφής είναι ο πραγματικός {@link TableFormatPort}: ο μοναδικός `as` ζει εδώ, σε
 * αρχείο δοκιμών, και είναι αναπόφευκτος — μια δομή που πετά για 23 μέλη δεν μπορεί να
 * αποδειχθεί στον μεταγλωττιστή ότι τα *έχει*. Οι καταναλωτές μένουν καθαροί.
 */
export function fakeTableFormatPort(overrides: Partial<TableFormatPort>): TableFormatPort {
  const port: Refusable = {};
  for (const name of REFUSED_METHODS) port[name] = refuse(name);
  // Τα υπο-αντικείμενα δεν είναι συναρτήσεις: ένα `Proxy` που πετά σε **κάθε** ανάγνωση κρατά
  // την ίδια υπόσχεση ένα επίπεδο βαθύτερα, χωρίς να απαριθμηθούν δεκάδες μέλη που κανείς εδώ
  // δεν αγγίζει.
  for (const group of REFUSED_GROUPS) {
    port[group] = new Proxy({}, {
      get: (_t, key) => refuse(`${group}.${String(key)}`)(),
    });
  }
  return Object.assign(port, overrides) as unknown as TableFormatPort;
}
