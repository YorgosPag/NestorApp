/**
 * Οι **παρενέργειες** μιας πράξης κύκλου ζωής — ό,τι οφείλει να συμβεί σε **άλλο** σημείο
 * του συστήματος όταν μια εγγραφή αποσύρεται ή επιστρέφει.
 *
 * Η μηχανή (`soft-delete-engine`: `retire` · `reinstate`) είναι μία για όλες τις οντότητες
 * και δεν ξέρει τι είναι αγγελία. Εδώ κάθε οντότητα **δηλώνει** τι την ακολουθεί, και η
 * μηχανή το ρωτά **μία** φορά — άρα καλύπτεται κάθε πόρτα (διαγραφή, επαναφορά,
 * αρχειοθέτηση, επαναφορά από το αρχείο, εκκαθάριση) χωρίς πέντε σημεία κλήσης.
 *
 * ⚠️ Χωριστό από το `soft-delete-config.ts`: εκείνο είναι **δεδομένα**· αυτό εισάγει
 * υπηρεσίες που γράφουν.
 *
 * @module lib/firestore/lifecycle-effects
 * @enterprise ADR-281 — SSOT Soft-Delete System · ADR-329 §3.9
 */

import "server-only";

import { propertyLifecycleEffects } from "@/services/property/property-lifecycle-effects";
import type { Retirement } from "./lifecycle-retirements";
import type { AuditFieldChange } from "@/types/audit-trail";
import type { LifecycleOutcome, SoftDeletableEntityType } from "@/types/soft-deletable";

/** Επιπλέον πεδία που γράφονται **στην ίδια** εγγραφή με την επαναφορά, και οι γραμμές τους. */
export interface ReinstatePatch {
  readonly fields: Record<string, unknown>;
  readonly changes: readonly AuditFieldChange[];
  /** Τι σημαίνει αυτή η αλλαγή για τον άνθρωπο — φτάνει ως την απάντηση της διαδρομής. */
  readonly outcome?: LifecycleOutcome;
  /**
   * Η **ζωντανή** κατάσταση στην οποία επιστρέφει η εγγραφή, όταν η οντότητα δένει το
   * `status` της με άλλο πεδίο που αλλάζει στην ίδια γραφή (ακίνητο: `status` ≡
   * `commercialStatus`). Απουσία ⇒ η τελευταία ζωντανή κατάσταση (`previousStatus`).
   *
   * Το `status` το γράφει **μόνο** η μηχανή: δηλώνεται εδώ, ποτέ μέσα στα `fields`.
   */
  readonly restoredStatus?: string;
}

/** Ό,τι δηλώνει μια οντότητα για τον κύκλο ζωής της. Και τα δύο προαιρετικά. */
export interface LifecycleEffects {
  /**
   * Τι **άλλο** αλλάζει στο έγγραφο όταν επιστρέφει. Καθαρή απόφαση — η μηχανή γράφει.
   * `null` ⇒ τίποτα.
   *
   * @param lastLiveStatus η τελευταία ζωντανή κατάσταση (`previousStatus` ή η προεπιλογή του
   *                       μητρώου) — εκεί επιστρέφει η εγγραφή, εκτός αν η δήλωση ορίσει άλλη
   */
  readonly reinstatePatch?: (
    from: Retirement,
    data: FirebaseFirestore.DocumentData,
    lastLiveStatus: string,
  ) => ReinstatePatch | null;
  /**
   * Τρέχει **μετά** από κάθε επιτυχημένη μετάβαση, με το έγγραφο όπως είναι πλέον.
   * Η μηχανή το περιμένει και **καταπίνει** την αποτυχία του: η πράξη του ανθρώπου έγινε.
   */
  readonly afterLifecycleChange?: (
    db: FirebaseFirestore.Firestore,
    entityId: string,
    data: FirebaseFirestore.DocumentData,
  ) => Promise<void>;
}

export const LIFECYCLE_EFFECTS: Partial<Record<SoftDeletableEntityType, LifecycleEffects>> = {
  property: propertyLifecycleEffects,
};
