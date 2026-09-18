/**
 * Η «Διάθεση & τιμή» ενός χώρου (θέση στάθμευσης · αποθήκη) — ό,τι χρειάζεται μια Γενική
 * καρτέλα, σε **μία** εισαγωγή (ADR-777 §8.60.18).
 *
 * ⚠️ Μόνο όσα ζητούν πράγματι οι καρτέλες: τα υπόλοιπα κομμάτια του επεξεργαστή εισάγονται
 * από το δικό τους αρχείο — barrel με εξαγωγές που κανείς δεν διαβάζει είναι νεκρός κώδικας
 * (ADR-700, CHECK 3.30).
 *
 * @module components/shared/commercial
 */

export { SpaceCommercialCard } from './SpaceCommercialCard';
export { useSpaceCommercial } from './useCommercialDraft';
