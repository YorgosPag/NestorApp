/**
 * SCALAR MATH — επανεξαγωγή του SSoT `@/lib/geometry/scalar` (ADR-071 · ADR-884 Φ2στ-γ §4.14).
 *
 * Η οικογένεια `clamp` προωθήθηκε στο `src/lib/geometry/scalar.ts` ώστε να τη μοιράζονται και οι κώδικες έξω από το
 * subapp (ο δημόσιος θεατής περιήγησης δεν επιτρέπεται να εισάγει από εδώ — CHECK 3.62). Οι ~50 εισαγωγείς του subapp
 * μένουν αμετάβλητοι· η δήλωση είναι **μία**. Ίδιο πρότυπο με το `lib/geometry/angle.ts`.
 */

export { clamp, clamp01, clamp255 } from '@/lib/geometry/scalar';
