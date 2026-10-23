import 'server-only';

/**
 * @fileoverview **«ΔΗΜΙΟΥΡΓΟΣ + ΔΙΑΧΕΙΡΙΣΤΕΣ ΧΩΡΟΥ»** — ο οικοδεσπότης ως παραλήπτες ειδοποίησης, σε **ένα** σημείο.
 * @related lib/workspace/workspace-administrators.ts (`activeWorkspaceAdministrators` — «ποιοι διοικούν;») ·
 *   config/domain-constants.ts (`isSystemActorId` — «είναι μηχανή;»)
 * @module lib/workspace/workspace-host-recipients
 *
 * 🔑 **N.0.2 (ADR-916 Φ-Δ.2, 2026-10-23)**: ζούσε μόνο μέσα στο conveyance (`caseHostRecipients`)· η ειδοποίηση απάντησης
 *    σε πρόσκληση παράδοσης θα ήταν το δεύτερο αντίγραφο.
 * 🔑 **Η μηχανή δεν ειδοποιείται**: η πρόσκληση που εξέδωσε η νυχτερινή συμφιλίωση έχει δράστη `system` — χωρίς το φίλτρο
 *    θα γραφόταν ειδοποίηση για «χρήστη» που δεν υπάρχει.
 * ⚠️ Χωριστό module από τους διαχειριστές **επίτηδες**: οι σουίτες αντικαθιστούν το `activeWorkspaceAdministrators` με
 *    `jest.mock` — εδώ το διαβάζουμε μέσω import, άρα η αντικατάσταση φτάνει και σε αυτή τη συνάρτηση.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { isSystemActorId } from '@/config/domain-constants';
import { activeWorkspaceAdministrators } from '@/lib/workspace/workspace-administrators';

/** Ποιοι μιλούν για το γραφείο **σε αυτό το γεγονός**. */
export interface WorkspaceHostAudience {
  /** Όσοι προκάλεσαν το γεγονός (δημιουργός · αποστολέας). Η **μηχανή** (`system` · `system:<διεργασία>`) αγνοείται. */
  readonly actors: readonly (string | null | undefined)[];
  /** Ο άνθρωπος που **απάντησε** — δεν ειδοποιείται για τη δική του πράξη. */
  readonly exclude?: string | null;
}

/**
 * **Οι ανθρώπινοι δράστες ∪ οι ενεργοί διαχειριστές του χώρου**, χωρίς διπλά. Η βλάβη ανάγνωσης μελών **πετά** — την κρίνει
 * ο καλών (ένας αγωγός ειδοποίησης την καταγράφει, δεν τη μετατρέπει σιωπηλά σε «κανένας»).
 */
export async function workspaceHostRecipients(db: Firestore, companyId: string, audience: WorkspaceHostAudience): Promise<string[]> {
  const humans = audience.actors.filter((uid): uid is string => typeof uid === 'string' && uid !== '' && !isSystemActorId(uid));
  const recipients = new Set([...humans, ...(await activeWorkspaceAdministrators(db, companyId))]);
  if (audience.exclude) recipients.delete(audience.exclude);
  return [...recipients];
}
