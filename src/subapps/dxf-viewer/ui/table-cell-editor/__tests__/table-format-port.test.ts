/**
 * 🔴 ADR-739 §52 — **το κανάλι της θύρας**: πότε ειδοποιεί, και —κυρίως— πότε ΔΕΝ ειδοποιεί.
 *
 * Το δεύτερο είναι το επικίνδυνο. Οι καταναλωτές συνδράμουν με `useSyncExternalStore`, οπότε
 * κάθε ειδοποίηση είναι re-render της κορδέλας → του `DxfViewerContent` → του `CanvasSection`
 * → **νέα θύρα**. Αν η δημοσίευση ειδοποιούσε άνευ όρων, ο κύκλος δεν θα έκλεινε ποτέ:
 * άπειρος βρόχος απόδοσης, όχι απλώς σπατάλη.
 *
 * @see ui/table-cell-editor/table-format-port.ts
 */

import {
  __resetTableFormatPortForTests,
  getTableFormatPort,
  getTableFormatRevision,
  notifyTableFormatPort,
  setTableFormatPort,
  subscribeTableFormatPort,
  type TableFormatPort,
} from '../table-format-port';

/** Δύο διαφορετικά αντικείμενα-θύρας — μας ενδιαφέρει μόνο η **ταυτότητά** τους. */
const portA = {} as TableFormatPort;
const portB = {} as TableFormatPort;

describe('table-format-port — το κανάλι', () => {
  beforeEach(() => { __resetTableFormatPortForTests(); });
  afterEach(() => { __resetTableFormatPortForTests(); });

  it('η ανάγνωση δίνει ό,τι δημοσιεύτηκε τελευταίο', () => {
    setTableFormatPort(portA);
    expect(getTableFormatPort()).toBe(portA);
    setTableFormatPort(null);
    expect(getTableFormatPort()).toBeNull();
  });

  it('mount (`null` → θύρα) ΕΙΔΟΠΟΙΕΙ — κανένα άλλο σήμα δεν το λέει', () => {
    const listener = jest.fn();
    subscribeTableFormatPort(listener);
    setTableFormatPort(portA);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('unmount (θύρα → `null`) ΕΙΔΟΠΟΙΕΙ — οι αναγνώστες πρέπει να σβήσουν', () => {
    setTableFormatPort(portA);
    const listener = jest.fn();
    subscribeTableFormatPort(listener);
    setTableFormatPort(null);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('🔴 ΑΝΤΙΚΑΤΑΣΤΑΣΗ θύρας με άλλη ΔΕΝ ειδοποιεί — εδώ ζει ο άπειρος βρόχος', () => {
    // Κάθε μέθοδος είναι getter, άρα μια θύρα με νέα ταυτότητα και ίδιο περιεχόμενο δίνει τις
    // ίδιες απαντήσεις: δεν υπάρχει τίποτα να ξαναρωτηθεί. Ένα emit εδώ θα ξανα-απέδιδε την
    // κορδέλα, που ξανα-αποδίδει τον ξενιστή, που φτιάχνει νέα θύρα, που ειδοποιεί ξανά…
    setTableFormatPort(portA);
    const listener = jest.fn();
    subscribeTableFormatPort(listener);
    setTableFormatPort(portB);
    setTableFormatPort(portA);
    expect(listener).not.toHaveBeenCalled();
    expect(getTableFormatPort()).toBe(portA);
  });

  it('ο ρητός παλμός ειδοποιεί ΠΑΝΤΑ και ανεβάζει την έκδοση', () => {
    setTableFormatPort(portA);
    const before = getTableFormatRevision();
    const listener = jest.fn();
    subscribeTableFormatPort(listener);
    notifyTableFormatPort();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getTableFormatRevision()).toBeGreaterThan(before);
  });

  it('η αποδέσμευση σταματά τις ειδοποιήσεις', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeTableFormatPort(listener);
    unsubscribe();
    notifyTableFormatPort();
    expect(listener).not.toHaveBeenCalled();
  });
});
