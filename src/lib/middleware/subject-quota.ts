/**
 * @fileoverview **ΧΩΡΑΕΙ ΑΚΟΜΗ ΜΙΑ ΠΡΑΞΗ ΓΙΑ ΑΥΤΟ ΤΟ ΥΠΟΚΕΙΜΕΝΟ;** — ο ένας πυρήνας κάθε ποσόστωσης ανά υποκείμενο.
 * @related lib/middleware/recipient-quota.ts (ανά παραλήπτη) · lib/middleware/rate-limit-config.ts (οι ποσοστώσεις) ·
 *   app/api/demand/prospect-interest/route.ts (ανά καλούντα, σε σκιά — ADR-900 §8 #4)
 * @module lib/middleware/subject-quota
 *
 * 🔴 **ΕΞΗΧΘΗ ΤΗ ΣΤΙΓΜΗ ΠΟΥ ΧΡΕΙΑΣΤΗΚΕ ΔΕΥΤΕΡΟ ΕΙΔΟΣ ΥΠΟΚΕΙΜΕΝΟΥ** (N.0.2): ζούσε μέσα στο
 * `recipient-quota.ts`, όπου το υποκείμενο είναι πάντα γραμματοκιβώτιο. Η ημερήσια ποσόστωση του
 * `/api/demand/prospect-interest` ρωτά **την ίδια** ερώτηση για **καλούντα** — και ένα αντίγραφο θα ήταν
 * δεύτερη ευκαιρία να ξεχαστεί το **hash** του κλειδιού ή η πολιτική «αποτυχία ⇒ επιτρέπει».
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΣΚΙΑ (`enforcement: 'shadow'`) — ΜΕΤΡΑ ΧΩΡΙΣ ΝΑ ΚΟΒΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 * Ένα όριο που δεν μετρήθηκε ποτέ είναι **μαντεψιά**: χαμηλό κόβει ανθρώπους, ψηλό δεν κόβει
 * κανέναν. Οι μεγάλοι το λύνουν με λειτουργία **σκιάς** (Envoy ratelimit `shadow_mode` · Cloudflare
 * WAF «Log»): ο κανόνας εκτελείται **ολόκληρος**, η υπέρβαση **καταγράφεται**, το αίτημα **περνά**.
 * Όταν τα ίχνη δείξουν κατάχρηση, η αλλαγή σε `'enforce'` είναι **μία λέξη** στη δήλωση — όχι νέος
 * κώδικας, όχι νέα διαδρομή.
 *
 * ⚠️ **Το υποκείμενο φτάνει ΗΔΗ κανονικοποιημένο.** Ο πυρήνας **δεν** ξέρει τι είναι: το email
 *    θέλει πεζά (`recipient-quota`), το Firebase uid **όχι** — είναι διάκριση πεζών/κεφαλαίων, και
 *    ένα `toLowerCase()` εδώ θα ένωνε δύο ανθρώπους σε ένα όριο.
 * ⚠️ **Αποτυχία του store ⇒ επιτρέπει** — ίδια πολιτική με το `withRateLimit`: η διαθεσιμότητα μιας
 *    πράξης δεν εξαρτάται από το Redis· το όριο ρυθμού της διαδρομής μένει ως δεύτερος φρουρός.
 */

import 'server-only';

import { createHash } from 'crypto';

import { getErrorMessage } from '@/lib/error-utils';
import { checkQuota } from '@/lib/middleware/rate-limiter';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('SUBJECT_QUOTA');

/** `enforce` ⇒ η υπέρβαση **αρνείται**· `shadow` ⇒ η υπέρβαση **καταγράφεται** και η πράξη περνά. */
export type QuotaEnforcement = 'enforce' | 'shadow';

export interface SubjectQuota {
  readonly limit: number;
  readonly windowMs: number;
  /** Απουσία ⇒ `'enforce'`: ό,τι δηλώθηκε πριν τη σκιά κρατά τη συμπεριφορά του. */
  readonly enforcement?: QuotaEnforcement;
}

/**
 * **Το κλειδί του store** — ποτέ το ωμό υποκείμενο (email ή uid σε store ορίων είναι προσωπικό δεδομένο
 * εκεί όπου δεν χρειάζεται). Το ίδιο hash γράφεται και στα ίχνη της σκιάς, ώστε μια υπέρβαση να
 * αντιστοιχίζεται σε άνθρωπο **μόνο** από όποιον ήδη ξέρει ποιον ψάχνει.
 */
export function subjectQuotaKey(scope: string, subject: string): string {
  return `${scope}:${createHash('sha256').update(subject).digest('hex')}`;
}

/**
 * Καταναλώνει μία μονάδα και απαντά **«προχωρά;»**.
 *
 * @param scope Ποιο είδος πράξης μετράει — δύο είδη **δεν** τρώνε το ένα το όριο του άλλου.
 * @param subject Ο άνθρωπος ή το γραμματοκιβώτιο, **ήδη κανονικοποιημένο** από τον καλούντα.
 */
export async function withinSubjectQuota(scope: string, subject: string, quota: SubjectQuota): Promise<boolean> {
  const key = subjectQuotaKey(scope, subject);
  try {
    const verdict = await checkQuota(key, quota.limit, quota.windowMs);
    if (verdict.allowed) return true;
    if (quota.enforcement !== 'shadow') return false;
    logger.warn('Υπέρβαση ποσόστωσης σε ΣΚΙΑ — η πράξη περνά, η υπέρβαση καταγράφεται', {
      scope,
      key,
      current: verdict.current,
      limit: quota.limit,
      windowMs: quota.windowMs,
    });
    return true;
  } catch (error: unknown) {
    logger.warn('Ο έλεγχος ποσόστωσης απέτυχε — επιτρέπεται', { scope, error: getErrorMessage(error) });
    return true;
  }
}
