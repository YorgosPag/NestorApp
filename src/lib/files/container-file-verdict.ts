/**
 * @module lib/files/container-file-verdict
 * @description **Είναι αυτό το αρχείο ΤΟΥ δοχείου που ρωτά, έτοιμο και του σωστού τύπου;** — καθαρή συνάρτηση, πριν
 * διαβαστεί ένα byte. Ο ΕΝΑΣ κριτής για κάθε ροή που παίρνει `fileId` από τον πελάτη και αναλύει το αρχείο στον
 * server (ΠΚΑ · ADR-900 §3.8, ΠΕΑ · ADR-777 §8.96).
 *
 * 🔑 **Το id έρχεται από τον πελάτη — ποτέ δεν το εμπιστευόμαστε**: το έγγραφο του αρχείου πρέπει να ανήκει στον
 * **ίδιο** κάτοχο (άνθρωπο ή εταιρεία) **και** στο **ίδιο** δοχείο (`entityType` · `entityId`). Αλλιώς ένα ξένο
 * `fileId` θα διάβαζε έγγραφο άλλου.
 * 🔑 Κριτής πάνω στα δεδομένα, όχι στο I/O — το διάβασμα του εγγράφου το κάνει ο καλών.
 */

import { FILE_STATUS } from '@/config/domain-constants';

export const CONTAINER_FILE_REFUSALS = ['file-missing', 'file-not-yours', 'file-not-ready', 'file-wrong-type'] as const;
export type ContainerFileRefusal = (typeof CONTAINER_FILE_REFUSALS)[number];

/** Ο κάτοχος του αρχείου: ιδιωτικός (`files_personal`, `userId`) ή εταιρικός (`files`, `companyId`). */
export type ContainerFileOwner =
  | { readonly kind: 'personal'; readonly userId: string }
  | { readonly kind: 'company'; readonly companyId: string };

export interface ExpectedContainer {
  readonly owner: ContainerFileOwner;
  readonly entityType: string;
  /** `null` = το δοχείο δεν υπάρχει (π.χ. αγγελία χωρίς φάκελο) ⇒ κανένα αρχείο δεν του ανήκει. */
  readonly entityId: string | null;
  readonly contentType: string;
}

export interface ContainerFileRef {
  readonly fileId: string;
  readonly storagePath: string;
  readonly storagePlacement: unknown;
}

export type ContainerFileVerdict =
  | { readonly kind: 'accepted'; readonly file: ContainerFileRef }
  | { readonly kind: 'refused'; readonly reason: ContainerFileRefusal };

function stringField(data: Readonly<Record<string, unknown>>, key: string): string | null {
  const value = data[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function ownedBy(data: Readonly<Record<string, unknown>>, owner: ContainerFileOwner): boolean {
  return owner.kind === 'personal'
    ? stringField(data, 'userId') === owner.userId
    : stringField(data, 'companyId') === owner.companyId;
}

function inContainer(data: Readonly<Record<string, unknown>>, expected: ExpectedContainer): boolean {
  return (
    expected.entityId !== null &&
    ownedBy(data, expected.owner) &&
    stringField(data, 'entityType') === expected.entityType &&
    stringField(data, 'entityId') === expected.entityId
  );
}

/**
 * @param data — το έγγραφο του αρχείου (ή `null` αν δεν υπάρχει)
 *
 * ⚠️ Αρχείο στον κάδο (`isDeleted`) = «δεν υπάρχει»: ο άνθρωπος το πέταξε, άρα δεν είναι πια απόδειξη για τίποτα.
 * ⚠️ «Δεν υπάρχει» και «δεν είναι δικό σου» μένουν διακριτά μόνο προς τον ίδιο: το id ήρθε από τη δική του οθόνη.
 */
export function judgeContainerFile(
  fileId: string,
  data: Readonly<Record<string, unknown>> | null,
  expected: ExpectedContainer,
): ContainerFileVerdict {
  if (data === null || data.isDeleted === true) return { kind: 'refused', reason: 'file-missing' };
  if (!inContainer(data, expected)) return { kind: 'refused', reason: 'file-not-yours' };
  if (stringField(data, 'status') !== FILE_STATUS.READY) return { kind: 'refused', reason: 'file-not-ready' };
  if (stringField(data, 'contentType') !== expected.contentType) return { kind: 'refused', reason: 'file-wrong-type' };

  const storagePath = stringField(data, 'storagePath');
  if (storagePath === null) return { kind: 'refused', reason: 'file-not-ready' };
  return { kind: 'accepted', file: { fileId, storagePath, storagePlacement: data.storagePlacement } };
}
