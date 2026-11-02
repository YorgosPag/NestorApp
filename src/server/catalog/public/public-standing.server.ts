import 'server-only';

/**
 * **Το ένα σημείο σύνδεσης της επιβεβαίωσης προμηθευτή με τη βιτρίνα** (ADR-923 §5.13 Δ6).
 *
 * ⏳ Ο αναγνώστης με τις τρεις εκβάσεις ζει στο `supplier-review.server.ts` και δεν έχει μπει ακόμη στο κλαδί. Ως τότε η
 *    ζωντανή τιμή είναι `unknown`: τίποτα δεν δημοσιεύεται και τίποτα δεν σβήνεται.
 *
 * @module server/catalog/public/public-standing.server
 */

import type { SupplierStandingReader } from '@/subapps/catalog/public/public-publication-condition';

export const readLiveSupplierStanding: SupplierStandingReader = async () => ({ kind: 'unknown' });
