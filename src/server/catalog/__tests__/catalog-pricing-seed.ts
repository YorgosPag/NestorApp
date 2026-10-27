/**
 * Ο **σπόρος** των tests τιμολόγησης (ADR-923 §5.11 «3β») — τα σενάρια αποδοχής του fixture MFP χτισμένα **μέσα από
 * τους γραφείς** (όχι γραμμένα στο χέρι στη βάση): ομάδες, λίστα, ανάθεση, συνθήκες, και οι γραμμές της έκδοσης 1
 * με τα **πραγματικά** ids που έδωσαν οι γραφείς στη θέση των ids του fixture.
 *
 * Ό,τι δεν ανήκει στην τιμολόγηση (τα SKU που τιμολογούνται, η επαφή του συνεργάτη) σπέρνεται απευθείας: είναι
 * εξωτερικές αναφορές, όχι αυτό που δοκιμάζεται.
 *
 * ⚠️ Τα mocks (`firebaseAdmin`, ίχνος) τα δηλώνει **το ίδιο το test** πριν φορτώσει τους γραφείς.
 */

import type { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import {
  MFP_CONDITIONS,
  MFP_PRICE_LIST,
  PARTNER,
  SIMPLE_VARIANT_ID,
  TOSH_CARR,
  VERSION_1_LINES,
  WHOLESALE,
} from '@/subapps/catalog/__tests__/fixtures/mfp-price-list.fixture';
import { MFP_SIZES } from '@/subapps/catalog/__tests__/fixtures/mfp-fan-coil.fixture';
import { mfpVariantId } from '@/subapps/catalog/__tests__/fixtures/mfp-fan-coil-products.fixture';
import type { DiscountConditionDefinition, PriceAudience } from '@/subapps/catalog/types/price-list';
import type { PriceLineInput } from '@/subapps/catalog/types/price-list-requests';
import { createCustomerAssignment } from '../customer-assignment-writer.server';
import { createDiscountCondition } from '../discount-condition-writer.server';
import { createCatalogPriceList } from '../price-list-writer.server';
import { createPricingGroup } from '../pricing-group-writer.server';
import { ARIES } from './catalog-writer-seed';

/** Τα SKU που τιμολογεί το fixture — ενεργά προϊόντα του χώρου της Aries. */
export function seedPricedProducts(fake: FakeFirestore, companyId = ARIES.companyId): void {
  const ids = [...MFP_SIZES.map((_, index) => mfpVariantId(index)), SIMPLE_VARIANT_ID];
  for (const id of ids) fake.seed('catalog_products', id, { id, companyId, isDeleted: false, revision: 1 });
  if (PARTNER.kind === 'contact') fake.seed('contacts', PARTNER.contactId, { id: PARTNER.contactId, companyId });
}

export interface SeededPricing {
  readonly priceListId: string;
  readonly toshCarrId: string;
  readonly wholesaleId: string;
  readonly conditionIds: readonly string[];
}

/** Τα ids του fixture → τα πραγματικά (ό,τι δεν είναι γνωστό μένει ως έχει). */
function realAudience(audience: PriceAudience, wholesaleId: string): PriceAudience {
  return audience.kind === 'customerGroup' && audience.customerGroupId === WHOLESALE ? { ...audience, customerGroupId: wholesaleId } : audience;
}

export function realCondition(condition: DiscountConditionDefinition, seeded: Pick<SeededPricing, 'toshCarrId' | 'wholesaleId'>): DiscountConditionDefinition {
  return {
    ...condition,
    discountGroupId: condition.discountGroupId === TOSH_CARR ? seeded.toshCarrId : condition.discountGroupId,
    audience: realAudience(condition.audience, seeded.wholesaleId),
  };
}

/** Οι γραμμές της έκδοσης 1, χωρίς έκδοση (τη δίνει η διαδρομή) και με το πραγματικό id της ομάδας. */
export function version1Inputs(toshCarrId: string, factorPercent = 100): PriceLineInput[] {
  return VERSION_1_LINES.map(({ versionId: _versionId, ...line }) => ({
    ...line,
    netPrice: Math.round((line.netPrice * factorPercent) / 100),
    discountGroupId: line.discountGroupId === TOSH_CARR ? toshCarrId : line.discountGroupId,
  }));
}

/** Ομάδες → λίστα → ανάθεση συνεργάτη → συνθήκες, όλα μέσα από τους γραφείς. */
export async function seedPricing(fake: FakeFirestore): Promise<SeededPricing> {
  seedPricedProducts(fake);
  const toshCarr = await createPricingGroup(ARIES, 'discountGroup', { code: 'tosh_carr', labels: { el: 'TOSH-CARR' } });
  const wholesale = await createPricingGroup(ARIES, 'customerGroup', { code: 'wholesale', labels: { el: 'Χονδρέμπορος' } });
  const list = await createCatalogPriceList(ARIES, MFP_PRICE_LIST.definition);
  await createCustomerAssignment(ARIES, { party: PARTNER, customerGroupId: wholesale.id });
  const seeded = { toshCarrId: toshCarr.id, wholesaleId: wholesale.id };
  const conditionIds: string[] = [];
  for (const condition of MFP_CONDITIONS) {
    conditionIds.push((await createDiscountCondition(ARIES, realCondition(condition.definition, seeded))).id);
  }
  return { priceListId: list.id, ...seeded, conditionIds };
}
