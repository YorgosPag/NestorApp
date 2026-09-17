/**
 * Η στοίβα εκδόσεων στο σύρμα — ΕΝΑ συμβόλαιο για διαδρομή και οθόνη (ADR-862 Φ0).
 *
 * ⚠️ Κλειστό σχήμα, όχι ολόκληρο το FileRecord: η οθόνη ιστορικού δεν χρειάζεται (και δεν
 * πρέπει να λαμβάνει) πεδία κατάστασης CDE, κρατήσεις ή ίχνη ingestion.
 */

import type { ContainerPhase } from '@/types/container-access';

export interface FileVersionEntry {
  readonly id: string;
  readonly displayName: string;
  readonly originalFilename: string;
  readonly ext: string;
  readonly storagePath: string;
  readonly downloadUrl: string | null;
  readonly sizeBytes: number | null;
  /** ISO — όπως το κανονικοποίησε ο θεματοφύλακας. */
  readonly createdAt: string | null;
  readonly createdBy: string;
  readonly uploaderName: string | null;
  /** Η **τρέχουσα** έκδοση (η κεφαλή της αλυσίδας). */
  readonly isCurrent: boolean;
  /** «Η v4 είναι η v2 ξανά» — η προέλευση μιας επαναφοράς, αν υπάρχει. */
  readonly promotedFromFileId: string | null;
  readonly phase: ContainerPhase;
}

export interface FileVersionStackResponse {
  readonly headFileId: string;
  /** Κεφαλή πρώτη, μετά νεότερη → παλαιότερη. Μόνο όσες **βλέπει** ο αιτών. */
  readonly versions: readonly FileVersionEntry[];
}

/** Οι αρνήσεις της προώθησης που μεταφράζει η οθόνη — κλειστό σύνολο. */
export const VERSION_PROMOTION_REFUSALS = [
  'head-moved',
  'source-not-ready',
  'not-capable',
  'predecessor-not-active',
  'identity-mismatch',
  'identity-absent',
  'wrong-phase',
  'unreadable',
] as const;

export type VersionPromotionRefusal = (typeof VERSION_PROMOTION_REFUSALS)[number];
