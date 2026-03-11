/**
 * @fileoverview Sales Icon Colors — SSoT for commercial concept colors
 * @description Semantic color palette for sales detail panels
 * @note Different from NAVIGATION_ENTITIES (entity-level) — this is concept-level
 */

export const SALES_ICON_COLORS = {
  // Pricing concepts
  askingPrice: 'text-green-600',
  finalPrice: 'text-blue-600',
  pricePerSqm: 'text-purple-600',
  deposit: 'text-amber-600',

  // People
  buyer: 'text-violet-600',

  // Date concepts
  listedDate: 'text-blue-600',
  reservationDate: 'text-violet-600',
  saleDate: 'text-green-600',
  cancellationDate: 'text-red-600',
  daysOnMarket: 'text-gray-500',

  // Section headers
  pricingSection: 'text-green-600',
  reservationSection: 'text-violet-600',
  datesSection: 'text-orange-600',
  financialSection: 'text-green-600',
  basicInfoSection: 'text-muted-foreground',
} as const;
