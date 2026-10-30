/**
 * @fileoverview Σύνοψη μητρώου παγίων — οι κάρτες της οθόνης πάνω σε ΟΛΗ την εμβέλεια των φίλτρων
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ (2026-10-30, ADR-ACC-010 §2.1.1): οι κάρτες άθροιζαν τις ΦΟΡΤΩΜΕΝΕΣ γραμμές, μαζί με τα
 *   **εκποιημένα** πάγια (πωλημένα / διαγραμμένα / δωρισμένα), και υπολόγιζαν την αναπόσβεστη αξία ως «κόστος − αποσβέσεις»
 *   στην οθόνη. Πλέον:
 *   - αξίες μόνο των παγίων **στην κατοχή** της επιχείρησης (Xero / SAP Asset Accounting: το εκποιημένο φεύγει από το
 *     μητρώο αξιών· μένει στη λίστα και μετρά στο πλήθος γραμμών)·
 *   - αναπόσβεστη = το **αποθηκευμένο** `netBookValue` (το γράφει η καταχώριση αποσβέσεων — `depreciation-booking`),
 *     όχι δεύτερος υπολογισμός που θα απέκλινε από το μητρώο.
 *
 * @see ADR-ACC-010 §2.1.1
 */

import type { FixedAsset } from '../../types/assets';
import { roundToTwo } from '../../utils/math';

export interface FixedAssetListSummary {
  /** Όσες γραμμές έχει η λίστα με αυτά τα φίλτρα (και εκποιημένα). */
  readonly assetCount: number;
  /** Σ κόστους κτήσης των παγίων στην κατοχή. */
  readonly totalCost: number;
  /** Σ σωρευμένων αποσβέσεων των παγίων στην κατοχή. */
  readonly totalAccumulatedDepreciation: number;
  /** Σ αναπόσβεστης αξίας (αποθηκευμένης) των παγίων στην κατοχή. */
  readonly netBookValue: number;
}

/** Στην κατοχή της επιχείρησης — ό,τι δεν εκποιήθηκε. Πλήρως αποσβεσμένο / ανενεργό μένει στο μητρώο. */
export function isHeldAsset(asset: Pick<FixedAsset, 'status'>): boolean {
  return asset.status !== 'disposed';
}

export function summarizeFixedAssetList(assets: readonly FixedAsset[]): FixedAssetListSummary {
  let totalCost = 0;
  let totalAccumulatedDepreciation = 0;
  let netBookValue = 0;
  for (const asset of assets) {
    if (!isHeldAsset(asset)) continue;
    totalCost += asset.acquisitionCost;
    totalAccumulatedDepreciation += asset.accumulatedDepreciation;
    netBookValue += asset.netBookValue;
  }
  return {
    assetCount: assets.length,
    totalCost: roundToTwo(totalCost),
    totalAccumulatedDepreciation: roundToTwo(totalAccumulatedDepreciation),
    netBookValue: roundToTwo(netBookValue),
  };
}
