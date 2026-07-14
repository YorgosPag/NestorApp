/**
 * ADR-654 M6 — Τα δύο entourage selection stores (People, Vehicles) ως module singletons.
 *
 * Ένα αρχείο, δύο instances από το ΚΟΙΝΟ factory ⇒ μηδέν near-identical clone (N.18). Κάθε store
 * είναι ανεξάρτητος: η επιλογή ανθρώπου δεν επηρεάζει την επιλογή οχήματος.
 *
 * @see ./entourage-selection-store.ts — το factory
 */

import { createEntourageSelectionStore } from './entourage-selection-store';

/** «Ποιος άνθρωπος τοποθετείται» SSoT. */
export const peoplePlanSelection = createEntourageSelectionStore();

/** «Ποιο όχημα τοποθετείται» SSoT. */
export const vehiclesPlanSelection = createEntourageSelectionStore();
