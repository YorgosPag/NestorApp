/**
 * Ομάδες ορατότητας του καταλόγου — ΕΝΑ σημείο για την ελαχιστοποίηση (ADR-901 §5.10).
 *
 * - `EVERYONE`       — έγγραφα ακινήτου/συναλλαγής: όλοι οι νομικοί **και** τα μέρη (Ε-7)
 * - `SELLER_PRIVATE` — προσωπικά έγγραφα πωλητή: ⛔ ποτέ αγοραστής ή δικηγόρος αγοραστή (Α4)
 * - `BUYER_PRIVATE`  — προσωπικά έγγραφα αγοραστή: ⛔ ποτέ πωλητής ή δικηγόρος πωλητή
 * - `LAWYERS_ONLY`   — έκθεση νομικού ελέγχου (μαζί με `ownSideOnly`)
 *
 * @module config/conveyance-checklist/visibility
 */

import type { ConveyanceRole } from './types';

export const EVERYONE: readonly ConveyanceRole[] = ['seller', 'buyer', 'seller_lawyer', 'buyer_lawyer', 'notary'];
export const SELLER_PRIVATE: readonly ConveyanceRole[] = ['seller', 'seller_lawyer', 'notary'];
export const BUYER_PRIVATE: readonly ConveyanceRole[] = ['buyer', 'buyer_lawyer', 'notary'];
export const LAWYERS_ONLY: readonly ConveyanceRole[] = ['seller_lawyer', 'buyer_lawyer'];
