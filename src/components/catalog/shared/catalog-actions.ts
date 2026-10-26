/**
 * @fileoverview **Αποθήκευση και διαγραφή ορισμού, αισιόδοξα** — η μία σύνθεση «πρόχειρο → εγγραφή» για όλα τα είδη
 *   που γράφονται ως ολόκληρος ορισμός (ADR-923 Φάση 1γ).
 * @module components/catalog/shared/catalog-actions
 *
 * 🔑 **Νέα οντότητα ⇒ κλειδί `new:<κωδικός>`**: το id το δίνει ο διακομιστής (ντετερμινιστικό από χώρο + κωδικό), άρα
 *    η οθόνη δεν το μαντεύει. Η αισιόδοξη εγγραφή ζει με αυτό το κλειδί ώσπου να απαντήσει ο γραφέας.
 * 🔑 Η αισιόδοξη εγγραφή **δεν** είναι αλήθεια: `revision 0`, κενός χώρος — τη συμφιλιώνει η απάντηση και το
 *    στιγμιότυπο (`useCatalogOptimistic`).
 */

import { nowISO } from '@/lib/date-local';
import type { CatalogOperation, CatalogOptimistic, CatalogOutcome } from '@/hooks/catalog/useCatalogOptimistic';
import {
  createCatalogDefinition,
  deleteCatalogDefinition,
  replaceCatalogDefinition,
  type CatalogDefinitionKind,
  type DefinitionOf,
  type RecordOf,
} from '@/services/catalog/catalog-api.client';
import type { CatalogWire } from '@/subapps/catalog/types/catalog-record';

export const newEntityKey = (code: string): string => `new:${code}`;

/** Ο ορισμός ντυμένος ως εγγραφή για την οθόνη — πάνω στην υπάρχουσα, ή καινούργια με προσωρινό κλειδί. */
export function optimisticWire<D extends object>(stored: D, existing: CatalogWire<D> | null, key: string): CatalogWire<D> {
  const now = nowISO();
  if (existing) return { ...existing, ...stored, updatedAt: now };
  return {
    ...stored,
    id: key,
    companyId: '',
    revision: 0,
    isDeleted: false,
    createdAt: now,
    createdBy: '',
    updatedAt: now,
    updatedBy: '',
    deletedAt: null,
    deletedBy: null,
  };
}

/**
 * Η ταυτότητα μιας **νέας** εγγραφής. Είδη με κωδικό ⇒ ντετερμινιστικό id από τον κωδικό (ο διακομιστής το παράγει).
 * Είδη **χωρίς** κωδικό (SKU, Δ3: τυχαίο id) ⇒ το id γεννιέται **στον πελάτη** και ο διακομιστής το **επαληθεύει**
 * (ADR-866 επίπεδο Β) — έτσι η αισιόδοξη και η αποθηκευμένη εγγραφή έχουν το **ίδιο** id (η επιλογή δεν αναβοσβήνει).
 */
export type NewIdentity<K extends CatalogDefinitionKind> = DefinitionOf<K> extends { readonly code: string }
  ? { readonly id?: undefined }
  : { readonly id: string };

interface SaveDefinitionBase<K extends CatalogDefinitionKind> {
  readonly kind: K;
  readonly existing: RecordOf<K> | null;
  readonly definition: DefinitionOf<K>;
  /** Τι δείχνει η οθόνη μέχρι την απάντηση (με τα παράγωγα πεδία του είδους). */
  readonly optimistic: RecordOf<K>;
  /**
   * Η αναθεώρηση πάνω στην οποία χτίστηκε ο ορισμός (CAS). Επεξεργαστής ⇒ η βάση του **προχείρου** (`editor.baseRevision`)·
   * άμεση πράξη πάνω σε ό,τι δείχνει η οθόνη τώρα (αναδιάταξη, επεξεργασία γραμμής) ⇒ παράλειψη = `existing.revision`.
   */
  readonly baseRevision?: number | null;
  readonly onSettled?: (outcome: CatalogOutcome<RecordOf<K>>) => void;
}

export type SaveDefinitionRequest<K extends CatalogDefinitionKind> = SaveDefinitionBase<K> & NewIdentity<K>;

function creationKey<K extends CatalogDefinitionKind>(request: SaveDefinitionRequest<K>): string {
  if (typeof request.id === 'string') return request.id;
  const { definition } = request;
  return 'code' in definition && typeof definition.code === 'string' ? newEntityKey(definition.code) : newEntityKey('');
}

/** Δημιουργία (χωρίς υπάρχουσα) ή αντικατάσταση με CAS. */
export function saveDefinition<K extends CatalogDefinitionKind>(ops: CatalogOptimistic<RecordOf<K>>, request: SaveDefinitionRequest<K>): void {
  const { kind, existing, definition } = request;
  const operation: CatalogOperation<RecordOf<K>> = {
    key: existing?.id ?? creationKey(request),
    optimistic: request.optimistic,
    baseRevision: existing ? request.baseRevision ?? existing.revision : null,
    send: (revision) =>
      existing && revision !== null
        ? replaceCatalogDefinition(kind, existing.id, revision, definition)
        : createCatalogDefinition(kind, definition, request.id),
    onSettled: request.onSettled,
  };
  ops.submit(operation);
}

/** Soft delete — εξαφανίζεται αμέσως, επιστρέφει αν ο γραφέας αρνηθεί (π.χ. «χρησιμοποιείται»). */
export function deleteDefinition<K extends CatalogDefinitionKind>(
  ops: CatalogOptimistic<RecordOf<K>>,
  kind: K,
  record: RecordOf<K>,
  onSettled?: (outcome: CatalogOutcome<RecordOf<K>>) => void,
): void {
  ops.submit({
    key: record.id,
    optimistic: null,
    baseRevision: record.revision,
    send: (revision) => deleteCatalogDefinition(kind, record.id, revision ?? record.revision),
    onSettled,
  });
}
