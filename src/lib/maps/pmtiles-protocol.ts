/**
 * @fileoverview **Το πρωτόκολλο `pmtiles://`** — καταχωρίζεται **μία** φορά ανά σελίδα, από το σύνορο `maplibre.ts`.
 * @related ADR-891 §9 (Φ3) · CHECK 3.75 (σύνορο χάρτη) · `basemap-catalog.ts` (`PMTILES_URL_SCHEME`)
 * @module lib/maps/pmtiles-protocol
 *
 * Το `addProtocol` της MapLibre είναι **καθολικό** (μητρώο σε επίπεδο module, όχι ανά χάρτη) και η τεκμηρίωση του
 * `pmtiles` ζητά ρητά μία καταχώριση. Ο φρουρός κρατά την υπόσχεση και όταν το module ξαναεκτελείται (HMR, tests).
 *
 * 🔑 **Το `addProtocol` έρχεται ως όρισμα.** Ωμή εισαγωγή του `maplibre-gl` επιτρέπεται **μόνο** στο σύνορο
 * (CHECK 3.75)· έτσι αυτό το φύλλο μένει καθαρό, και το test περνά δικό του καταγραφέα.
 *
 * `metadata: false`: η απόδοση έρχεται από τον κατάλογο (`source.attribution`), οπότε το επιπλέον αίτημα
 * μεταδεδομένων ανά αρχείο θα ήταν σκέτη καθυστέρηση.
 */

import { Protocol } from 'pmtiles';
import { PMTILES_URL_SCHEME } from './basemap-catalog';

/** Η υπογραφή που χρειαζόμαστε από το `maplibregl.addProtocol`. */
export type RegisterMapProtocol = (scheme: string, loader: Protocol['tile']) => void;

/** `pmtiles://` → `pmtiles`: το όνομα που δέχεται το `addProtocol`. */
export const PMTILES_PROTOCOL_NAME = PMTILES_URL_SCHEME.replace('://', '');

let registered: Protocol | null = null;

/** Καταχωρίζει το πρωτόκολλο αν δεν έχει καταχωριστεί· επιστρέφει το **ένα** αντικείμενο `Protocol`. */
export function ensurePmtilesProtocol(register: RegisterMapProtocol): Protocol {
  if (registered !== null) return registered;
  const protocol = new Protocol({ metadata: false });
  register(PMTILES_PROTOCOL_NAME, protocol.tile);
  registered = protocol;
  return protocol;
}

/** **Μόνο για tests** — ξεχνά την καταχώριση ώστε κάθε test να ξεκινά καθαρό. */
export function resetPmtilesProtocolForTests(): void {
  registered = null;
}
