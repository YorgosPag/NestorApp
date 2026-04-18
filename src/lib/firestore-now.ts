import { Timestamp } from 'firebase/firestore';

/**
 * Current moment as a Firestore client `Timestamp`.
 *
 * Single source of truth for `Timestamp.fromDate(new Date())` — one place to
 * change if we ever need to (a) inject a clock for tests, (b) switch to a
 * server-derived clock, or (c) normalise timezone handling.
 *
 * NOTE: client SDK only (`firebase/firestore`). For server/admin code use
 * the admin-specific helper next to the admin SDK import.
 *
 * @see ADR-314 Phase C.2
 */
export const nowTimestamp = (): Timestamp => Timestamp.fromDate(new Date());
