/**
 * Το μοντέλο MFP και οι **7 παραλλαγές** του, με τις **πραγματικές** τιμές της σελ. 60 του
 * καταλόγου Aries (χειρόγραφη αλήθεια της Φάσης 0, ADR-923 §21 — `spike/data.mjs`) — το κριτήριο
 * εξόδου της Φάσης 2 (§9) ως δεδομένα. Ποσά **όπως τα γράφει ο κατάλογος**: ισχύς σε W, παροχή σε m³/h.
 *
 * Δύο **πραγματικές** αστοχίες για τα σενάρια:
 *   - `AI_SHIFTED_HEATING`: ό,τι διάβασε το gpt-4o από την εικόνα (§21.3) — η θέρμανση H πήρε τις
 *     τιμές της M και η M της **επόμενης** στήλης (μαζί με το «6493» αντί «6439»), σε **7/7** παραλλαγές·
 *   - `ARIES_DUPLICATE_CODE`: ο κωδικός 016-15-001 που ο κατάλογος δίνει σε **δύο** είδη (σελ. 200).
 */

import type { HumanLanguage } from '@/i18n/languages';
import type { InheritanceLink } from '../../values/resolve-inherited';
import type {
  AttributeValue,
  CatalogProductDefinition,
  CatalogProductModelDefinition,
  ValueSlots,
} from '../../types/product';
import type { CatalogSettingsDefinition } from '../../types/catalog-settings';
import { mapCatalogChannels } from '../../vocabulary/channels';
import { MFP_SIZES } from './mfp-fan-coil.fixture';

const one = (value: AttributeValue): ValueSlots => ({ '*': { '*': value } });
const watts = (amount: number): ValueSlots => one({ type: 'measurement', amount: String(amount), unitCode: 'W' });
const flow = (amount: number): ValueSlots => one({ type: 'measurement', amount: String(amount), unitCode: 'm3_h' });

/** Οι στήλες της σελ. 60, ανά ιδιότητα, με τη σειρά των μεγεθών. */
export const MFP_PAGE_60 = {
  code: ['099-01-001', '099-01-002', '099-01-003', '099-01-004', '099-01-005', '099-01-006', '099-01-007'],
  airflow_h: [340, 510, 680, 850, 1020, 1360, 1700],
  airflow_m: [280, 380, 515, 660, 785, 1040, 1280],
  airflow_l: [180, 280, 340, 430, 520, 710, 860],
  cooling_h: [1800, 2700, 3600, 4500, 5400, 7200, 9000],
  cooling_m: [1458, 2187, 2915, 3645, 4374, 5832, 7290],
  cooling_l: [1134, 1701, 2268, 2835, 3402, 4536, 5670],
  heating_h: [2700, 4050, 5400, 6750, 8100, 10800, 13500],
  heating_m: [1950, 2770, 3935, 4900, 6439, 8318, 10395],
  heating_l: [1290, 1774, 2800, 3505, 4536, 6534, 8168],
  noise_h: [37, 39, 41, 43, 45, 46, 48],
  weight: ['15.4', '18', '20', '22', '24', '32', '36'],
  length_mm: [858, 908, 1058, 1208, 1258, 1608, 1758],
} as const;

/** Η θέρμανση H/M όπως τη διάβασε το gpt-4o από την εικόνα (μετρημένο, §21.3). */
export const AI_SHIFTED_HEATING = {
  heating_h: [1950, 2770, 3935, 4900, 6493, 8318, 10395],
  heating_m: [2770, 3935, 4900, 6493, 8318, 10395, 13590],
} as const;

export const ARIES_DUPLICATE_CODE = '016-15-001';

export const MFP_MODEL_ID = 'cpm_mfp';

export const MFP_MODEL: CatalogProductModelDefinition = {
  code: 'mfp_tm',
  familyId: 'fan_coil',
  variantSchemeCode: 'by_size',
  parentId: null,
  categoryIds: ['cat_fan_coils'],
  noValueReasons: {},
  values: {
    description: {
      '*': {
        el: { type: 'richText', html: '<p>Fan coil δαπέδου με διπλό ανεμιστήρα. Χειριστήριο περιλαμβάνεται.</p>' },
        en: { type: 'richText', html: '<p>Floor-standing fan coil with twin fan. Controller included.</p>' },
      },
    },
    power_supply: one({ type: 'text', text: '230V-50Hz-1Ph' }),
    water_connections: one({ type: 'text', text: '3/4″-3/4″' }),
    photo: one({ type: 'asset', assetIds: ['cas_mfp_hero'] }),
  },
};

export type MfpColumns = { readonly [K in keyof typeof MFP_PAGE_60]: ReadonlyArray<(typeof MFP_PAGE_60)[K][number]> };

/** Μία παραλλαγή από τη στήλη `index`· `columns` επιτρέπει να «χαλάσει» ένα σενάριο μια στήλη. */
export function mfpVariant(index: number, columns: Partial<Pick<MfpColumns, 'code' | 'heating_h' | 'heating_m'>> = {}): CatalogProductDefinition {
  const page = { ...MFP_PAGE_60, ...columns };
  return {
    modelId: MFP_MODEL_ID,
    familyId: 'fan_coil',
    categoryIds: [],
    noValueReasons: {},
    values: {
      size: one({ type: 'select', optionCode: MFP_SIZES[index] }),
      model_code: one({ type: 'text', text: page.code[index] }),
      cooling_h: watts(page.cooling_h[index]),
      cooling_m: watts(page.cooling_m[index]),
      cooling_l: watts(page.cooling_l[index]),
      heating_h: watts(page.heating_h[index]),
      heating_m: watts(page.heating_m[index]),
      heating_l: watts(page.heating_l[index]),
      airflow_h: flow(page.airflow_h[index]),
      airflow_m: flow(page.airflow_m[index]),
      airflow_l: flow(page.airflow_l[index]),
      sound_pressure: one({ type: 'measurement', amount: String(page.noise_h[index]), unitCode: 'dBA' }),
      weight: one({ type: 'measurement', amount: page.weight[index], unitCode: 'kg' }),
      dimensions: one({ type: 'text', text: `${page.length_mm[index]}x596x250` }),
    },
  };
}

export const MFP_VARIANTS: readonly CatalogProductDefinition[] = MFP_SIZES.map((_, index) => mfpVariant(index));

export const mfpVariantId = (index: number): string => `cpr_${MFP_SIZES[index]}`;

/** Η αλυσίδα κληρονομιάς μιας παραλλαγής: μοντέλο → SKU. */
export function mfpChain(variant: CatalogProductDefinition, index: number, revisions = { model: 1, product: 1 }): InheritanceLink[] {
  return [
    { id: MFP_MODEL_ID, kind: 'productModel', revision: revisions.model, holder: MFP_MODEL },
    { id: mfpVariantId(index), kind: 'product', revision: revisions.product, holder: variant },
  ];
}

/** Έντυπο μόνο ελληνικά · βιτρίνα ελληνικά + αγγλικά (Δ6). */
export const MFP_SETTINGS: CatalogSettingsDefinition = {
  channelLocales: mapCatalogChannels<HumanLanguage[]>((channel) => (channel === 'storefront' ? ['el', 'en'] : ['el'])),
};

/** Τα μέσα του χώρου που αναφέρει το μοντέλο. */
export const MFP_ASSETS = new Map([['cas_mfp_hero', { kind: 'image' as const }]]);
