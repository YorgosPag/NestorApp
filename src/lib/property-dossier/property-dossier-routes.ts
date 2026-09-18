/**
 * @fileoverview **Οι διευθύνσεις του φακέλου ακινήτου** — γραμμένες μία φορά.
 * @related ADR-866 Φ1.2 · §2.9.2 (Δ1 · Δ4) · lib/owner-property/owner-property-routes.ts · workspace-scope.ts
 * @module lib/property-dossier/property-dossier-routes
 *
 * 🔑 **`/dossiers` — ουσιαστικό, όχι ρήμα, και είναι σωστό.** Οι αδελφές `/demands` («ζητώ») και `/offers` («προσφέρω»)
 * ονομάζουν **πράξη αγοράς**· ο φάκελος **δεν** είναι πράξη, είναι **το σπίτι** — υπάρχει πριν, κατά και μετά από κάθε
 * αγγελία (ADR-866 §5.1). Ζει στο route group `(me)` και **εκτός** προθέματος χώρου (`OUTSIDE_WORKSPACE`, CHECK 3.60).
 *
 * ⚠️ **Χωριστό από το `owner-property-routes.ts`**, με τον ίδιο λόγο που εκείνο είναι χωριστό από το `demand-routes.ts`:
 * άλλη οντότητα, άλλος κύκλος ζωής — και η Φ1.3 θα συνδέσει τις δύο οθόνες **με σύνδεσμο**, όχι με κοινό αρχείο.
 *
 * **Layering**: leaf — μόνο σταθερές και σύνθεση συμβολοσειρών.
 */

import { typedHref } from '@/lib/workspace/route-worlds';

/** **Οι φάκελοί μου** — ο κατάλογος του ανθρώπου (πληθυντικός: ο κληρονόμος με τρία σπίτια είναι ο κανόνας). */
export const MY_DOSSIERS_ROUTE = '/dossiers' as const;

/**
 * Η σελίδα **ενός** φακέλου.
 *
 * ⚠️ `encodeURIComponent` παρότι οι enterprise ταυτότητες είναι ασφαλείς χαρακτήρες: η ταυτότητα έρχεται από
 * **δεδομένα**, και μια διεύθυνση που σπάει σε ένα `#` θα αστοχούσε **σιωπηλά** — ίδιο σκεπτικό με το `offerDetailHref`.
 */
export function dossierDetailHref(dossierId: string) {
  return typedHref(`${MY_DOSSIERS_ROUTE}/${encodeURIComponent(dossierId)}`);
}
