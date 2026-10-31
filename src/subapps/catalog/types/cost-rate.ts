/**
 * Το **βιβλίο τιμών κόστους** που βλέπει ο προϋπολογισμός (ADR-923 §5.11 «3ε»): ό,τι ισχύει τώρα στις λίστες `cost` του
 * χώρου και του έργου, και ό,τι έρχεται με δημοσιευμένη μελλοντική έκδοση.
 *
 * @module subapps/catalog/types/cost-rate
 */

import type { LocalizedText } from '@/i18n/localized-text';
import type { MinorAmount } from '@/lib/money/money';
import type { BasisPoints } from '@/lib/pricing/discount-rule';
import type { ViewFreshness } from '@/types/server-view';
import type { CostBreakdown } from './price-list';
import type { PriceQuantity } from '../vocabulary/pricing';

/** Μια γραμμή εργασίας έτοιμη για κατανάλωση: η γραμμή + η λίστα και η έκδοση από τις οποίες προέρχεται. */
export interface CostRate {
  readonly priceListId: string;
  readonly priceListCode: string;
  readonly priceListLabels: LocalizedText;
  /** `null` = master του χώρου. */
  readonly projectId: string | null;
  readonly versionId: string;
  readonly versionNumber: number;
  readonly validFrom: string;
  readonly lineId: string;
  readonly subjectKey: string;
  readonly atoeCode: string;
  readonly region: string | null;
  readonly unitCode: string;
  readonly priceQuantity: PriceQuantity;
  readonly netPrice: MinorAmount;
  readonly breakdown: CostBreakdown;
  /** Ο φράχτης της λίστας: πάνω από αυτόν η ανανέωση θέλει ρητή επιβεβαίωση. */
  readonly fenceBp: BasisPoints;
}

/** `GET /api/catalog/cost-rates?projectId=…` */
export interface CostRateBook {
  readonly freshness: ViewFreshness;
  readonly asOf: string;
  /** Οι λίστες που εξετάστηκαν: λίστα εκτός συνόλου ⇒ διαγράφηκε, διαφορετικό από «χάθηκε η γραμμή». */
  readonly priceListIds: readonly string[];
  readonly current: readonly CostRate[];
  /** Η επόμενη δημοσιευμένη έκδοση κάθε λίστας που έχει μελλοντική ισχύ. */
  readonly upcoming: readonly CostRate[];
}
