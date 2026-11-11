/**
 * SOLAR POSITION — επανεξαγωγή του SSoT `@/lib/solar/solar-position` (ADR-937 Φάση 0).
 *
 * Ο αλγόριθμος προωθήθηκε στο `src/lib/solar/` ώστε να τον χρησιμοποιεί και η δημόσια αγγελία (ηλιασμός), που δεν
 * επιτρέπεται να εισάγει από το subapp (CHECK 3.62). Οι εισαγωγείς του subapp μένουν αμετάβλητοι· η δήλωση είναι
 * **μία**. Ίδιο πρότυπο με το `utils/scalar-math.ts`.
 */

export { computeSolarPosition, timeOfDayToDate, type SolarAngles } from '@/lib/solar/solar-position';
