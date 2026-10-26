/**
 * @fileoverview **Η εισαγωγή αρχείων στη βιβλιοθήκη μέσων** — προτάσεις και μηχανή καταστάσεων, καθαρά (ADR-923 §5.10.4).
 * @related use-asset-intake.ts (η εκτέλεση) · subapps/catalog/schema/judge-asset-file.ts (`judgeAssetUpload`, ο προέλεγχος) ·
 *   subapps/catalog/vocabulary/asset-roles.ts · vocabulary/suggest-catalog-code.ts
 * @module components/catalog/assets/asset-intake-model
 *
 * Ρίψη πολλών αρχείων ⇒ μία **γραμμή** ανά αρχείο, με πρόταση κωδικού (από το όνομα αρχείου, Akeneo Asset Manager),
 * ρόλου και είδους (από τον τύπο αρχείου), και **προέλεγχο πριν από κάθε byte** (`judgeAssetUpload` — η κρίση του διακομιστή).
 *
 * 🔑 **Τρία στάδια, ρητά** (`create → upload → attach`): η αποτυχία καταγράφεται **με το στάδιο** και η επανάληψη
 *    ξεκινά **από εκεί** — ένα BIM 400 MB που ανέβηκε δεν ξανανεβαίνει επειδή απέτυχε η σύνδεση. Το μέσο που δημιουργήθηκε
 *    (`assetId`, αναθεώρηση) και το αρχείο που ανέβηκε (`fileId`) κρατιούνται στη γραμμή.
 * 🔑 **Κωδικός μοναδικός ΠΡΙΝ σταλεί**: απέναντι στη βιβλιοθήκη **και** στις άλλες γραμμές της δέσμης (`_2`, `_3` …) —
 *    το id του μέσου είναι ντετερμινιστικό από τον κωδικό, άρα δύο ίδιοι κωδικοί θα ήταν το ίδιο μέσο.
 */

import type { AssetRecord } from '@/services/catalog/catalog-api.client';
import type { FileRecord } from '@/types/file-record';
import type { CatalogFailureKind } from '@/services/catalog/catalog-failure';
import { judgeAssetUpload } from '@/subapps/catalog/schema/judge-asset-file';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import { ASSET_ROLE_KINDS, type CatalogAssetRole } from '@/subapps/catalog/vocabulary/asset-roles';
import { assetKindAcceptsFile, type AssetFileTypeFacts } from '@/subapps/catalog/vocabulary/asset-files';
import { ASSET_KINDS, type AssetKind } from '@/subapps/catalog/vocabulary/attribute-types';
import { isCatalogCode } from '@/subapps/catalog/vocabulary/catalog-limits';
import { suggestCatalogCode } from '@/subapps/catalog/vocabulary/suggest-catalog-code';

/** Ο ρόλος που προτείνεται για κάθε είδος αρχείου — ο άνθρωπος τον αλλάζει (π.χ. PDF ⇒ πιστοποιητικό). */
const DEFAULT_ROLE_OF_KIND: Readonly<Record<AssetKind, CatalogAssetRole>> = {
  image: 'photo',
  document: 'datasheet',
  bim: 'bim',
  video: 'video',
};

export const INTAKE_STAGES = ['create', 'upload', 'attach'] as const;
export type IntakeStage = (typeof INTAKE_STAGES)[number];

/** Πού βρίσκεται η γραμμή. `failed` κρατά το στάδιο, το είδος της άρνησης και τα ευρήματά της (δίπλα στο πεδίο). */
export type IntakeStatus =
  | { readonly kind: 'draft' }
  | { readonly kind: 'queued' }
  | { readonly kind: 'running'; readonly stage: IntakeStage; readonly progress: number }
  | { readonly kind: 'failed'; readonly stage: IntakeStage; readonly reason: CatalogFailureKind; readonly issues: readonly CatalogIssue[] }
  | { readonly kind: 'done' };

export interface IntakeRow {
  /** Τοπικό κλειδί γραμμής (όχι ταυτότητα μέσου). */
  readonly key: string;
  readonly file: File;
  readonly code: string;
  readonly label: string;
  readonly role: CatalogAssetRole;
  readonly kind: AssetKind;
  readonly status: IntakeStatus;
  /** Το μέσο όπως το επέστρεψε ο γραφέας — η επανάληψη δεν το ξαναδημιουργεί, η σύνδεση χτίζει πάνω στην αναθεώρησή του. */
  readonly asset: AssetRecord | null;
  /** Το αρχείο, μόλις ανέβει — η επανάληψη δεν το ξανανεβάζει. */
  readonly fileId: string | null;
}

/** Κατάληξη + MIME ενός `File` του browser — ίδια μορφή με ό,τι κρίνει ο διακομιστής στο `FileRecord`. */
export function fileFactsOf(file: File): AssetFileTypeFacts {
  const dot = file.name.lastIndexOf('.');
  const ext = dot > 0 ? file.name.slice(dot + 1).toLowerCase() : undefined;
  return { ext, contentType: file.type };
}

/** Κατάληξη + MIME μιας εγγραφής αρχείου — τα ίδια πεδία που διαβάζει ο γραφέας (`assetFileTypeFactsOf`). */
export function fileFactsOfRecord(file: Pick<FileRecord, 'ext' | 'contentType'>): AssetFileTypeFacts {
  return { ext: file.ext, contentType: file.contentType };
}

/** Το όνομα χωρίς κατάληξη — η πρώτη ετικέτα του μέσου. */
export function baseNameOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return (dot > 0 ? fileName.slice(0, dot) : fileName).trim();
}

/** Το είδος που δέχεται το αρχείο, ή `null` όταν κανένα (π.χ. `.zip`) — τότε η γραμμή μένει με εύρημα. */
export function kindOfFile(facts: AssetFileTypeFacts): AssetKind | null {
  return ASSET_KINDS.find((kind) => assetKindAcceptsFile(kind, facts) === 'accepted') ?? null;
}

/** Ρόλος για ένα είδος. Αν ο ρόλος δέχεται πολλά είδη (σχέδιο: εικόνα ή PDF), το είδος του αρχείου κερδίζει. */
export function kindForRole(role: CatalogAssetRole, fileKind: AssetKind | null): AssetKind {
  const allowed = ASSET_ROLE_KINDS[role];
  return fileKind !== null && allowed.includes(fileKind) ? fileKind : allowed[0];
}

/** Ο πρώτος ελεύθερος κωδικός: η πρόταση, αλλιώς `<πρόταση>_2`, `_3` … (μέσα στο όριο μήκους). */
export function uniqueCode(base: string, taken: ReadonlySet<string>): string {
  const root = base.length > 0 ? base : 'asset';
  if (!taken.has(root)) return root;
  for (let n = 2; ; n += 1) {
    const suffix = `_${n}`;
    const candidate = `${root.slice(0, 64 - suffix.length)}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Νέες γραμμές για τα αρχεία που ρίχτηκαν — με κωδικούς μοναδικούς απέναντι στη βιβλιοθήκη **και** μεταξύ τους. */
export function intakeRowsFor(
  files: readonly File[],
  takenCodes: ReadonlySet<string>,
  keyOf: (index: number) => string,
): readonly IntakeRow[] {
  const taken = new Set(takenCodes);
  return files.map((file, index) => {
    const fileKind = kindOfFile(fileFactsOf(file));
    const role = DEFAULT_ROLE_OF_KIND[fileKind ?? 'image'];
    const label = baseNameOf(file.name);
    const code = uniqueCode(suggestCatalogCode(label), taken);
    taken.add(code);
    return { key: keyOf(index), file, code, label, role, kind: kindForRole(role, fileKind), status: { kind: 'draft' }, asset: null, fileId: null };
  });
}

/**
 * Τα ευρήματα μιας γραμμής **πριν** σταλεί: κωδικός (μορφή · διπλός στη βιβλιοθήκη ή στη δέσμη) και αρχείο (τύπος ·
 * μέγεθος, με τη `judgeAssetUpload`). Οι διαδρομές: `code` · `fileId` — ίδιες με τον γραφέα.
 */
export function intakeRowIssues(row: IntakeRow, takenCodes: ReadonlySet<string>, batchCodes: readonly string[]): readonly CatalogIssue[] {
  const issues: CatalogIssue[] = [];
  // Ο κωδικός κρίνεται μόνο όσο η γραμμή **επεξεργάζεται** (πρόχειρο · αποτυχία). Όσο τρέχει, η αισιόδοξη εγγραφή της ΙΔΙΑΣ
  // γραμμής είναι ήδη στη βιβλιοθήκη — θα την έβλεπε ως «άλλον» κωδικό (μετρημένο ζωντανά, 2026-10-26).
  if (row.asset === null && isStartable(row)) {
    if (!isCatalogCode(row.code)) issues.push({ code: 'invalidCode', path: 'code' });
    else if (takenCodes.has(row.code) || batchCodes.filter((code) => code === row.code).length > 1) {
      issues.push({ code: 'duplicateCode', path: 'code', params: { code: row.code } });
    }
  }
  if (row.fileId === null) issues.push(...judgeAssetUpload(row.kind, { ...fileFactsOf(row.file), sizeBytes: row.file.size }));
  return issues;
}

/** Από πού συνεχίζει η γραμμή: το πρώτο στάδιο που **δεν** έχει αποτέλεσμα. */
export function nextStageOf(row: IntakeRow): IntakeStage | null {
  if (row.status.kind === 'done') return null;
  if (row.asset === null) return 'create';
  if (row.fileId === null) return 'upload';
  return 'attach';
}

/** Γραμμές που μπορούν να ξεκινήσουν (ή να ξαναδοκιμάσουν) τώρα. */
export function isStartable(row: IntakeRow): boolean {
  return row.status.kind === 'draft' || row.status.kind === 'failed';
}
