/**
 * @fileoverview **ΜΙΑ ανανέωση ανά νέα έκδοση** — ο φρουρός που κάνει τον βρόχο δομικά αδύνατο.
 * @related ADR-860 §Ε3
 * @module lib/app-version/chunk-recovery/reload-guard
 *
 * 🔑 **ΓΙΑΤΙ ΚΛΕΙΔΙ ΤΟ deploymentId ΤΟΥ SERVER, ΚΑΙ ΟΧΙ ΧΡΟΝΟΣ**: ένας φρουρός «όχι δεύτερη
 * ανανέωση μέσα σε 10s» σπάει σε αργό δίκτυο (η ανανέωση κράτησε 11s ⇒ βρόχος) και μπλοκάρει
 * δίκαιη ανανέωση σε γρήγορο (δεύτερο deploy σε 9s). Το κλειδί-έκδοση απαντά την **πραγματική**
 * ερώτηση: «ανανέωσα ήδη για **αυτήν** την έκδοση;» Αν μετά την ανανέωση αποτύχει ξανά chunk με
 * τον **ίδιο** server id, η ανανέωση **δεν** το έλυσε ⇒ καμία δεύτερη, πάει σε οθόνη σφάλματος.
 *
 * 🔑 **ΚΑΝΕΝΑ ΔΙΚΑΙΩΜΑ ΧΩΡΙΣ ΜΝΗΜΗ**: αν η εγγραφή στο `sessionStorage` αποτύχει (private mode,
 * αποκλεισμένος χώρος), το `claimReloadFor` αρνείται. Χωρίς μνήμη η υπόσχεση «μία φορά» δεν
 * μπορεί να τηρηθεί — και μια οθόνη σφάλματος είναι καλύτερη από ατέρμονες ανανεώσεις.
 *
 * 🔑 **ΤΑΥΤΟΧΡΟΝΕΣ ΑΠΟΤΥΧΙΕΣ**: μετά από deploy μια σελίδα χάνει συχνά **πολλά** chunks μαζί.
 * Ο πρώτος παίρνει το δικαίωμα· οι υπόλοιποι βλέπουν `isReloadPending()` και **περιμένουν
 * σιωπηλά** την ανανέωση αντί να σκάσουν οθόνη σφάλματος μισό δευτερόλεπτο πριν χαθεί η σελίδα.
 */

import type { DeploymentId } from '@/lib/app-version/deployment-identity';
import {
  STORAGE_KEYS,
  safeSessionGetItem,
  safeSessionSetItem,
} from '@/lib/storage/safe-storage';

let reloadPending = false;

/**
 * Διεκδικεί τη **μία** ανανέωση για την έκδοση `serverDeploymentId`.
 * `true` ⇒ ο καλών **πρέπει** να ανανεώσει τώρα. `false` ⇒ απαγορεύεται.
 */
export function claimReloadFor(serverDeploymentId: DeploymentId): boolean {
  if (reloadPending) return false;
  if (safeSessionGetItem(STORAGE_KEYS.CHUNK_RECOVERY_RELOADED_FOR) === serverDeploymentId) return false;
  if (!safeSessionSetItem(STORAGE_KEYS.CHUNK_RECOVERY_RELOADED_FOR, serverDeploymentId)) return false;
  reloadPending = true;
  return true;
}

/** Έχει ήδη ξεκινήσει ανανέωση σε αυτή τη σελίδα; */
export function isReloadPending(): boolean {
  return reloadPending;
}
