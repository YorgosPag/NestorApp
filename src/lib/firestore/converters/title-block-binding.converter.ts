/**
 * @fileoverview Firestore converter για τις εγκεκριμένες συνδέσεις πινακίδας (ADR-745 Φ3β).
 *
 * Πρότυπο: `association.converter.ts`. Το μάθημα που αντιγράφεται μαζί με το σχήμα είναι το
 * **§9.1/§13(στ)**: ο seeder του `contact_links` έγραφε `companyId` που ο converter **δεν
 * εξέπεμπε ποτέ**, οπότε 12 πράσινα κελιά κάλυπταν σκέλος κανόνα που **κανένα πραγματικό έγγραφο
 * δεν μπορούσε να φτάσει**. Εδώ το `companyId` εκπέμπεται **άνευ όρων** και ο seeder της μήτρας
 * ταυτίζεται με αυτό ακριβώς το σχήμα.
 *
 * @module lib/firestore/converters/title-block-binding.converter
 */

import type {
  DocumentData,
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
} from 'firebase/firestore';
import type { BindingTarget, TitleBlockBinding } from '@/types/title-block-binding';
import { normalizeToISO, nowISO } from '@/lib/date-local';

/**
 * Το σχήμα εγγράφου **παράγεται** από τον τύπο του τομέα, δεν επαναλαμβάνεται.
 *
 * Το `ContactLinkFirestoreDoc` ήταν αρχικά χειρόγραφο δίδυμο και απαιτούσε διπλή επεξεργασία σε
 * κάθε αλλαγή· διορθώθηκε στο §9.1 και δεν το ξαναφτιάχνουμε.
 */
export type TitleBlockBindingFirestoreDoc = Omit<TitleBlockBinding, 'confirmedAt'> & {
  readonly confirmedAt: Date | string | { toDate(): Date } | null;
};

export const titleBlockBindingConverter: FirestoreDataConverter<TitleBlockBinding> = {
  toFirestore(binding: TitleBlockBinding): DocumentData {
    return {
      id: binding.id,
      // 🔒 Το πεδίο που διαβάζουν τα `firestore.rules`. Άνευ όρων — μια σύνδεση χωρίς μισθωτή
      // απορρίπτεται από τον κανόνα CREATE, και σιωπηλή παράλειψη εδώ θα εμφανιζόταν στον χρήστη
      // ως ανεξήγητο permission-denied (ADR-745 §9.1).
      companyId: binding.companyId,
      // Αποκανονικοποιημένο: το Firestore δεν ερωτά μέσα σε ένωση, και ο φύλακας διαγραφής του
      // έργου πρέπει να μπορεί να βρει τα bindings του.
      projectId: binding.projectId,
      fileRecordId: binding.fileRecordId,
      levelId: binding.levelId,
      layerName: binding.layerName,
      titleBlockIndex: binding.titleBlockIndex,
      fieldKey: binding.fieldKey,
      sourceHandle: binding.sourceHandle,
      labelHandle: binding.labelHandle,
      slot: binding.slot,
      target: binding.target as unknown as DocumentData,
      snapshotValue: binding.snapshotValue,
      status: binding.status,
      confirmedBy: binding.confirmedBy,
      confirmedAt:
        typeof binding.confirmedAt === 'string' ? new Date(binding.confirmedAt) : binding.confirmedAt,
    };
  },

  fromFirestore(
    snapshot: QueryDocumentSnapshot<TitleBlockBindingFirestoreDoc>,
    options?: SnapshotOptions,
  ): TitleBlockBinding {
    const data = snapshot.data(options);

    return {
      id: data.id,
      companyId: data.companyId,
      projectId: data.projectId,
      fileRecordId: data.fileRecordId,
      levelId: data.levelId,
      layerName: data.layerName,
      titleBlockIndex: data.titleBlockIndex,
      fieldKey: data.fieldKey,
      sourceHandle: data.sourceHandle,
      labelHandle: data.labelHandle,
      slot: data.slot,
      target: data.target as BindingTarget,
      snapshotValue: data.snapshotValue,
      status: data.status,
      confirmedBy: data.confirmedBy,
      confirmedAt: normalizeToISO(data.confirmedAt) ?? nowISO(),
    };
  },
};
