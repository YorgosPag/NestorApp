/**
 * @fileoverview **Το όνομα ενός συντελεστή** («Όροφος (επίπεδο 2)») — το ΕΝΑ, για την ανάλυση της οθόνης, την εξαγωγή XLSX
 *   (ADR-898 Φ4β) και το PDF πληροφοριακού υπολογισμού (ADR-947 Φ2β). Καθαρό: ο καλών δίνει τον μεταφραστή (i18next στην
 *   οθόνη, `createBundleTranslate` στον server).
 * @module lib/objective-value/objective-value-factor-label
 * @related components/objective-value/ObjectiveValueResult.tsx (`useObjectiveValueFactorLabel`)
 *
 * ⚠️ Τα κλειδιά γράφονται με **στατικό** πρόθεμα (`${NS}:result.…`): ο γεννήτορας του i18n slice (ADR-744) διαβάζει τις
 *    κλήσεις `t(…)` ανά αρχείο.
 */

import type { PriceLabelT } from '@/lib/listings/listing-price-label';

import type { AppliedFactor } from './objective-value-types';

const NS = 'objective-value';

export function objectiveValueFactorLabel(t: PriceLabelT, factor: AppliedFactor): string {
  const level = factor.level === undefined ? '' : ` ${t(`${NS}:result.levelSuffix`, { number: factor.level + 1 })}`;
  return `${t(`${NS}:result.factors.${factor.key}`)}${level}`;
}
