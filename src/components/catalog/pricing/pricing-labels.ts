/**
 * @fileoverview **Οι λέξεις της τιμολόγησης** — κάθε χάρτης δεμένος στη ρίζα του λεξιλογίου (ADR-923 §5.11 «3δ»).
 * @related subapps/catalog/vocabulary/pricing.ts (οι ρίζες) · components/catalog/shared/catalog-labels.ts (το ιδίωμα)
 * @module components/catalog/pricing/pricing-labels
 *
 * 🔑 **`Record<Ρίζα, …>`** (CHECK 3.73): νέο είδος λίστας, κοινό ή κατάσταση έκδοσης **δεν μεταγλωττίζεται** χωρίς λέξη —
 *    και εικονίδιο, ώστε η κατάσταση να αναγνωρίζεται χωρίς χρώμα (CHECK 3.41).
 * ⚠️ Κυριολεκτικά κλειδιά (όχι template): οι γεννήτορες i18n (route slice · CHECK 3.8) τα λύνουν στατικά.
 */

import { Archive, CircleDot, Clock, Globe, Handshake, Layers, Link2, Minus, PencilLine, Percent, Plus, RefreshCw, Tags, Trash2, UserCheck, Users, type LucideIcon } from 'lucide-react';

import type { BadgeVariantProps } from '@/components/ui/badge';
import type { DiscountRuleKind, DiscountTierBasis } from '@/lib/pricing/discount-rule';
import type { ValidityVerdict } from '@/lib/pricing/validity';
import type { PriceLineChangeKind } from '@/subapps/catalog/pricing/diff-price-versions';
import type { AudienceKind, PriceListKind, PriceListVersionStatus, PriceType, PriceVersionBasis, PricingGroupKind } from '@/subapps/catalog/vocabulary/pricing';
import type { TimelinePhase } from './price-list-summary';

type BadgeVariant = NonNullable<BadgeVariantProps['variant']>;

export const PRICE_LIST_KIND_KEYS: Readonly<Record<PriceListKind, string>> = {
  sales: 'pricing.kinds.sales',
  cost: 'pricing.kinds.cost',
};

export const PRICE_LIST_KIND_HINT_KEYS: Readonly<Record<PriceListKind, string>> = {
  sales: 'pricing.kinds.salesHint',
  cost: 'pricing.kinds.costHint',
};

export const PRICE_TYPE_KEYS: Readonly<Record<PriceType, string>> = {
  net_list: 'pricing.priceTypes.netList',
  net_customer: 'pricing.priceTypes.netCustomer',
};

export const PRICE_TYPE_HINT_KEYS: Readonly<Record<PriceType, string>> = {
  net_list: 'pricing.priceTypes.netListHint',
  net_customer: 'pricing.priceTypes.netCustomerHint',
};

export const AUDIENCE_KIND_KEYS: Readonly<Record<AudienceKind, string>> = {
  anonymous: 'pricing.audience.anonymous',
  signedIn: 'pricing.audience.signedIn',
  customerGroup: 'pricing.audience.customerGroup',
  partner: 'pricing.audience.partner',
};

export const AUDIENCE_KIND_ICONS: Readonly<Record<AudienceKind, LucideIcon>> = {
  anonymous: Globe,
  signedIn: UserCheck,
  customerGroup: Users,
  partner: Handshake,
};

export const VERSION_STATUS_KEYS: Readonly<Record<PriceListVersionStatus, string>> = {
  draft: 'pricing.versionStatus.draft',
  published: 'pricing.versionStatus.published',
  superseded: 'pricing.versionStatus.superseded',
  discarded: 'pricing.versionStatus.discarded',
};

export const VERSION_STATUS_ICONS: Readonly<Record<PriceListVersionStatus, LucideIcon>> = {
  draft: PencilLine,
  published: CircleDot,
  superseded: Archive,
  discarded: Trash2,
};

export const VERSION_BASIS_KEYS: Readonly<Record<PriceVersionBasis, string>> = {
  empty: 'pricing.versions.basis.empty',
  latestPublished: 'pricing.versions.basis.latestPublished',
};

/** Η φάση μιας δημοσιευμένης έκδοσης στη χρονογραμμή — λέξη, εικονίδιο και απόχρωση σήματος. */
export const TIMELINE_PHASE_KEYS: Readonly<Record<TimelinePhase, string>> = {
  past: 'pricing.versions.phase.past',
  current: 'pricing.versions.phase.current',
  future: 'pricing.versions.phase.future',
};

export const TIMELINE_PHASE_ICONS: Readonly<Record<TimelinePhase, LucideIcon>> = {
  past: Archive,
  current: CircleDot,
  future: Clock,
};

export const TIMELINE_PHASE_BADGES: Readonly<Record<TimelinePhase, BadgeVariant>> = {
  past: 'outline',
  current: 'default',
  future: 'secondary',
};

/** Το είδος μιας αλλαγής στη διαφορά δημοσίευσης — λέξη και εικονίδιο (η αλλαγή αναγνωρίζεται χωρίς χρώμα). */
export const CHANGE_KIND_KEYS: Readonly<Record<PriceLineChangeKind, string>> = {
  added: 'pricing.publish.kind.added',
  removed: 'pricing.publish.kind.removed',
  changed: 'pricing.publish.kind.changed',
};

export const CHANGE_KIND_ICONS: Readonly<Record<PriceLineChangeKind, LucideIcon>> = {
  added: Plus,
  removed: Minus,
  changed: RefreshCw,
};

/** Η ισχύς μιας συνθήκης έκπτωσης τη στιγμή της όψης — λέξη, εικονίδιο, απόχρωση (ίδια γλώσσα με τη χρονογραμμή εκδόσεων). */
export const VALIDITY_VERDICT_KEYS: Readonly<Record<ValidityVerdict, string>> = {
  valid: 'pricing.discounts.verdict.valid',
  notYetValid: 'pricing.discounts.verdict.notYetValid',
  expired: 'pricing.discounts.verdict.expired',
};

export const VALIDITY_VERDICT_ICONS: Readonly<Record<ValidityVerdict, LucideIcon>> = {
  valid: CircleDot,
  notYetValid: Clock,
  expired: Archive,
};

export const VALIDITY_VERDICT_BADGES: Readonly<Record<ValidityVerdict, BadgeVariant>> = {
  valid: 'default',
  notYetValid: 'secondary',
  expired: 'outline',
};

export const DISCOUNT_RULE_KIND_KEYS: Readonly<Record<DiscountRuleKind, string>> = {
  chain: 'pricing.discounts.rule.kind.chain',
  tiers: 'pricing.discounts.rule.kind.tiers',
};

export const DISCOUNT_RULE_KIND_ICONS: Readonly<Record<DiscountRuleKind, LucideIcon>> = {
  chain: Link2,
  tiers: Layers,
};

export const TIER_BASIS_KEYS: Readonly<Record<DiscountTierBasis, string>> = {
  quantity: 'pricing.discounts.rule.basis.quantity',
  amount: 'pricing.discounts.rule.basis.amount',
};

/** Τα δύο είδη ομάδας τιμολόγησης — ενότητα της λίστας, «νέα», υπόδειξη, εικονίδιο. */
export const PRICING_GROUP_KIND_KEYS: Readonly<Record<PricingGroupKind, string>> = {
  discountGroup: 'pricing.discounts.groups.discountGroups',
  customerGroup: 'pricing.discounts.groups.customerGroups',
};

export const PRICING_GROUP_NEW_KEYS: Readonly<Record<PricingGroupKind, string>> = {
  discountGroup: 'pricing.discounts.groups.newDiscountGroup',
  customerGroup: 'pricing.discounts.groups.newCustomerGroup',
};

export const PRICING_GROUP_HINT_KEYS: Readonly<Record<PricingGroupKind, string>> = {
  discountGroup: 'pricing.discounts.groups.discountHint',
  customerGroup: 'pricing.discounts.groups.customerHint',
};

export const PRICING_GROUP_ICONS: Readonly<Record<PricingGroupKind, LucideIcon>> = {
  discountGroup: Tags,
  customerGroup: Users,
};

/** Το εικονίδιο της έκπτωσης (σελίδα, κενή κατάσταση). */
export const DISCOUNT_ICON: LucideIcon = Percent;
