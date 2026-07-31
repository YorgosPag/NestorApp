/**
 * Ο **ένας** έλεγχος ιδιοκτησίας για γραμμή BOQ που ζητήθηκε με id
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΧΩΡΙΣΤΟ MODULE ΓΙΑ ΤΕΣΣΕΡΙΣ ΓΡΑΜΜΕΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * Τα δύο μονοπάτια ανάγνωσης του BOQ — client SDK (`boq-repository.ts`) και
 * Admin SDK (`admin/boq-admin-read-service.ts`) — κάνουν την **ίδια** ερώτηση με
 * διαφορετικό SDK. Γραμμένη δύο φορές είναι ακριβώς το «sibling clone» που
 * περιγράφει το ADR-584: το ένα αντίγραφο θα διορθωθεί, το άλλο θα μείνει, και
 * η απόκλιση θα είναι σε **έλεγχο πρόσβασης**.
 *
 * Το repo έχει ήδη πέντε ανεξάρτητες εκδοχές αυτής της ερώτησης
 * (`text-template.service`, `custom-dictionary.service`,
 * `dxf-layer-state-template.service`, `floorplan-background.service`,
 * `boq-tenant-guard`) με **τρεις** διαφορετικές σημασιολογίες αστοχίας. Η
 * ενοποίησή τους είναι δουλειά άλλου εύρους (4+ domains) και είναι καταγεγραμμένη
 * ως χρέος· εδώ **δεν προστίθεται έκτη**: υιοθετείται το σχήμα που ήδη επέλεξαν
 * τα δύο πιο πρόσφατα σημεία (`floorplan-background.service.ts:188`,
 * `boq-tenant-guard.ts`).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΓΙΑΤΙ `null` ΚΑΙ ΟΧΙ ΣΦΑΛΜΑ ΑΡΝΗΣΗΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * «Δεν υπάρχει» και «ανήκει σε άλλον» επιστρέφουν **το ίδιο** αποτέλεσμα. Ένα
 * ξεχωριστό `PERMISSION_DENIED` θα επιβεβαίωνε ότι το id υπάρχει, δηλαδή θα
 * λειτουργούσε ως **μαντείο ύπαρξης** για όποιον δοκιμάζει ids — και ο πράκτορας
 * ΤΝ είναι ακριβώς τέτοιος καλών. Η απόπειρα όμως **καταγράφεται**: είναι σήμα
 * ασφαλείας, όχι θόρυβος.
 *
 * @module services/measurements/boq-tenant-ownership
 * @see ADR-734 §7 (το κενό), ADR-175 (BOQ)
 */

import type { BOQItem } from '@/types/boq';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('BoqTenantOwnership');

/** Ποιο SDK έκανε την ανάγνωση — μπαίνει στο log ώστε η απόπειρα να εντοπίζεται. */
export type BoqReadPath = 'client' | 'admin';

/**
 * Επιστρέφει τη γραμμή **μόνο** αν ανήκει στον `companyId` του καλούντος.
 *
 * Καμία εξαίρεση για super-admin: το μονοπάτι υπεργραφείου διαβάζει με ρητά
 * δηλωμένο tenant (`companyId` του στόχου), δεν παρακάμπτει τον έλεγχο. Μια
 * σιωπηλή εξαίρεση εδώ θα ίσχυε για **κάθε** καλούντα που τυχαίνει να έχει τον
 * ρόλο, σε κάθε μελλοντική διαδρομή — δηλαδή θα ήταν το κενό, ξαναγραμμένο.
 */
export function ownedItemOrNull(
  item: BOQItem | null,
  companyId: string,
  itemId: string,
  path: BoqReadPath,
): BOQItem | null {
  if (item === null) return null;

  if (item.companyId !== companyId) {
    logger.warn('Cross-tenant BOQ item access blocked', {
      itemId,
      callerCompanyId: companyId,
      path,
    });
    return null;
  }

  return item;
}
