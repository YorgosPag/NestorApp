/**
 * @fileoverview Sales Icon Colors — SSoT for commercial concept colors
 * @description Semantic color palette for sales detail panels
 * @note Different from NAVIGATION_ENTITIES (entity-level) — this is concept-level
 */

export const SALES_ICON_COLORS = {
  // Pricing concepts
  askingPrice: 'text-green-707',
  finalPrice: 'text-primary',
  pricePerSqm: 'text-primary',
  deposit: 'text-[hsl(var(--text-warning))]',

  // People
  buyer: 'text-primary',

  // Date concepts
  listedDate: 'text-primary',
  reservationDate: 'text-primary',
  saleDate: 'text-green-707',
  cancellationDate: 'text-destructive',
  daysOnMarket: 'text-muted-foreground',

  // Basic info field icons
  type: 'text-primary',
  building: 'text-primary',
  floor: 'text-[hsl(var(--text-warning))]',
  area: 'text-primary',
  millesimalShares: 'text-primary',
  locationZone: 'text-[hsl(var(--text-warning))]',

  // Section headers
  pricingSection: 'text-green-707',
  reservationSection: 'text-primary',
  datesSection: 'text-[hsl(var(--text-warning))]',
  financialSection: 'text-green-707',
  basicInfoSection: 'text-primary',
} as const;
