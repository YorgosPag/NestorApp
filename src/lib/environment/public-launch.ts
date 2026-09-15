/**
 * @fileoverview **ΤΟ ΔΗΜΟΣΙΟ ΑΝΟΙΓΜΑ** — «έχει δηλωθεί ότι η εφαρμογή ανοίγει στο κοινό;» (ADR-861 Φ1)
 * @module lib/environment/public-launch
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ ΕΓΓΡΑΦΗ ΤΟΥ `ENVIRONMENT_CONTRACT`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το συμβόλαιο περιβάλλοντος μετρά ρυθμίσεις των οποίων η **απουσία είναι βλάβη** — και το
 * `/api/health/config` απαντά **503** για κάθε απούσα. Εδώ η απουσία είναι η **κανονική**
 * κατάσταση (η εφαρμογή δεν έχει ανοίξει στο κοινό). Εγγραφή εκεί θα έκανε την αναφορά
 * ετοιμότητας **μονίμως κόκκινη** μέχρι το άνοιγμα, δηλαδή θόρυβο που μαθαίνεις να αγνοείς.
 *
 * ⚠️ **Το κατηγόρημα «υπάρχει;» ΔΕΝ ξαναγράφεται**: διαβάζεται με το `readConfiguredValue`
 * (`environment-audit.ts`), τη μία απάντηση του δέντρου.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΡΕΙΣ ΚΑΤΑΣΤΑΣΕΙΣ, ΟΧΙ BOOLEAN — ΚΑΙ Η ΤΡΙΤΗ ΠΕΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ένα `NESTOR_PUBLIC_LAUNCH=false` **μοιάζει** με «όχι». Με έλεγχο «υπάρχει;» θα διαβαζόταν
 * ως **«ναι»**. Γι' αυτό: `1`/`true` = δηλωμένο · απούσα/`0`/`false` = όχι · **οτιδήποτε άλλο =
 * `unrecognized`**, που η εκκίνηση **αρνείται** — μια σημαία που ο διακομιστής δεν καταλαβαίνει
 * δεν επιτρέπεται να μαντευτεί προς καμία κατεύθυνση.
 *
 * **Layering**: leaf — καθαρή, το περιβάλλον είναι **όρισμα**.
 */

import { readConfiguredValue, type EnvironmentSource } from './environment-audit';

/** Το όνομα της σημαίας, όπως ορίζεται στο περιβάλλον παραγωγής (Coolify). */
export const PUBLIC_LAUNCH_ENV = 'NESTOR_PUBLIC_LAUNCH';

/** Η δήλωση ανοίγματος, **ονομασμένη**. */
export type PublicLaunchDeclaration = 'not-declared' | 'declared' | 'unrecognized';

const DECLARED_VALUES: ReadonlySet<string> = new Set(['1', 'true']);
const NOT_DECLARED_VALUES: ReadonlySet<string> = new Set(['0', 'false']);

/** Τι δηλώνει το περιβάλλον για το δημόσιο άνοιγμα. */
export function readPublicLaunch(env: EnvironmentSource): PublicLaunchDeclaration {
  const value = readConfiguredValue(env, PUBLIC_LAUNCH_ENV);
  if (value === null) return 'not-declared';
  const normalized = value.toLowerCase();
  if (DECLARED_VALUES.has(normalized)) return 'declared';
  if (NOT_DECLARED_VALUES.has(normalized)) return 'not-declared';
  return 'unrecognized';
}
