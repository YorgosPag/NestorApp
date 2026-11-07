import 'server-only';

/**
 * **Το outbox της δημόσιας προβολής** (ADR-923 §5.13 Δ3): ένα έγγραφο ανά `{ companyId, scope }`, γραμμένο **μέσα** στη
 * συναλλαγή της αλλαγής. Αλλαγή χωρίς σημείωση είναι δομικά αδύνατη.
 *
 * 🔑 Ο κύριος καλών είναι η μηχανή (`runCatalogTransaction`), από το `noteWrite`: το βλέπουν και τα `stageDerived`,
 *    `stageCopied`, που το `scope.changes` δεν τα βλέπει.
 * 🔑 Αλήθεια είναι το ζεύγος `revision` / `drainedRevision`. Το `dirty` είναι μόνο ο δείκτης αναζήτησης, γιατί η Firestore
 *    δεν συγκρίνει δύο πεδία μεταξύ τους. Το `queuedAt` είναι η θέση στην ουρά: ό,τι αποτυγχάνει πάει πίσω και δεν
 *    μπλοκάρει τους επόμενους.
 *
 * @module server/catalog/public/public-outbox.server
 */

import { FieldValue, type DocumentReference, type Firestore, type Transaction } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { generateDeterministicCatalogPublicOutboxId } from '@/services/enterprise-id.service';
import type { KnownPublicationCondition } from '@/subapps/catalog/public/public-publication-condition';
import { publicScopeKey, type PublicScope } from '@/subapps/catalog/public/public-scopes-of-write';

/** Πού έφτασε το τμηματικό πέρασμα ολόκληρου του καταλόγου. */
export interface PublicCatalogPass {
  readonly revision: number;
  readonly phase: 'models' | 'products';
  readonly afterId: string | null;
}

export interface PublicOutboxRecord {
  readonly companyId: string;
  readonly scope: string;
  readonly revision: number;
  readonly drainedRevision?: number;
  readonly dirty?: boolean;
  /** Μόνο στο scope `catalog`: η τελευταία **γνώση** της σάρωσης για τη συνθήκη. Το `unknown` δεν γράφεται ποτέ. */
  readonly seenCondition?: KnownPublicationCondition;
  /** Μόνο στο scope `catalog`: πότε **ζήτησε** η σάρωση το ημερήσιο πλήρες πέρασμα. Ρολόι του προγραμματισμού, όχι ένδειξη. */
  readonly fullPassAtMs?: number;
  /**
   * Μόνο στο scope `catalog`: πότε **έκλεισε** το τελευταίο πέρασμα, όποιος κι αν το ζήτησε (ημερήσιο, αλλαγή κανόνα,
   * δημοσίευση). Αυτό δείχνει η οθόνη ως «Τελευταίος πλήρης έλεγχος» (§5.13 Σ9).
   */
  readonly passClosedAtMs?: number;
  readonly pass?: PublicCatalogPass;
}

export const PUBLIC_CATALOG_SCOPE: PublicScope = { kind: 'catalog' };

export function publicOutboxRef(db: Firestore, companyId: string, scope: PublicScope): DocumentReference {
  const id = generateDeterministicCatalogPublicOutboxId(companyId, publicScopeKey(scope));
  return db.collection(COLLECTIONS.CATALOG_PUBLIC_OUTBOX).doc(id);
}

/** Τα πεδία μιας σημείωσης: ο ένας τρόπος να γίνει ένα scope βρώμικο, μέσα ή έξω από συναλλαγή. */
export function publicOutboxSignal(companyId: string, scope: PublicScope): Readonly<Record<string, unknown>> {
  const now = FieldValue.serverTimestamp();
  return { companyId, scope: publicScopeKey(scope), revision: FieldValue.increment(1), dirty: true, changedAt: now, queuedAt: now };
}

/** Μία αύξηση ανά προβολή, **μετά** από όλες τις αναγνώσεις της συναλλαγής (κανόνας Firestore). */
export function signalPublicScopesInTx(tx: Transaction, db: Firestore, companyId: string, scopes: readonly PublicScope[]): void {
  for (const scope of scopes) {
    tx.set(publicOutboxRef(db, companyId, scope), publicOutboxSignal(companyId, scope), { merge: true });
  }
}

/**
 * Βάζει τον χώρο στην κυκλική κρίση της σάρωσης, χωρίς να λερώσει τίποτα. Η σάρωση βρίσκει τους χώρους από το έγγραφο `catalog`:
 * χώρος με προφίλ και χωρίς καμία γραφή καταλόγου δεν θα κρινόταν ποτέ, και η ανάκλησή του δεν θα έσβηνε το δημόσιο προφίλ.
 */
export function enrolCompanyInPublicSweepInTx(tx: Transaction, db: Firestore, companyId: string): void {
  const record = { companyId, scope: publicScopeKey(PUBLIC_CATALOG_SCOPE), queuedAt: FieldValue.serverTimestamp() };
  tx.set(publicOutboxRef(db, companyId, PUBLIC_CATALOG_SCOPE), record, { merge: true });
}

/** Πίσω στην ουρά, χωρίς να αλλάξει η αλήθεια: το scope μένει βρώμικο. */
export function requeuePublicOutbox(ref: DocumentReference): Promise<unknown> {
  return ref.set({ queuedAt: FieldValue.serverTimestamp() }, { merge: true });
}
