/**
 * 🏢 ENTERPRISE: Generic Type Quick Filters Component
 *
 * Segmented controls για γρήγορο φιλτράρισμα τύπων entities
 * Per local_4.log architecture decision:
 * - Filters (not tabs) for same entity with different attributes
 * - State-based filtering, not navigation-based
 * - No route/breadcrumb changes
 *
 * @version 2.0.0 - Centralized from UnitTypeQuickFilters
 * @author Enterprise Team
 * @date 2026-01-09
 * @compliance CLAUDE.md Protocol - Enterprise UI Pattern
 */

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  LayoutGrid,
  BedSingle,
  Building2,
  Store,
  Briefcase,
  Users,
  Mail,
  MessageSquare,
  Phone,
  FileEdit,
  CheckCircle,
  Send,
  PackageOpen,
  PackageCheck,
  CircleCheck,
  XCircle,
  Inbox,
  Eye,
  Clock,
  Archive,
  Sparkles,
  AlertTriangle,
  UserX,
  Star,
  type LucideIcon
} from 'lucide-react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import '@/lib/design-system';

// =============================================================================
// 🏢 ENTERPRISE: Type Definitions
// =============================================================================

export interface TypeFilterOption {
  value: string;
  label: string;
  icon: LucideIcon;
  tooltip: string;
}

export interface TypeQuickFiltersProps {
  /** Available filter options */
  options: TypeFilterOption[];
  /** Currently selected type(s) - array to support multi-select in future */
  selectedTypes: string[];
  /** Callback when selection changes */
  onTypeChange: (types: string[]) => void;
  /** Optional className for container */
  className?: string;
  /** Compact mode for smaller screens */
  compact?: boolean;
  /** Label prefix (e.g., "Τύπος:") */
  label?: string;
  /** Aria label for accessibility */
  ariaLabel?: string;
}

// =============================================================================
// 🏢 ENTERPRISE: Pre-configured Options for Different Entities
// =============================================================================

/**
 * Unit Type Options (για Μονάδες/Διαμερίσματα)
 * Icons follow enterprise standards (Zillow, Rightmove, JLL patterns)
 * 🏢 ENTERPRISE: Labels and tooltips use i18n keys (filters.propertyTypes.*)
 */
export const PROPERTY_TYPE_OPTIONS: TypeFilterOption[] = [
  { value: 'all', label: 'filters.propertyTypes.all', icon: LayoutGrid, tooltip: 'filters.propertyTypes.allTooltip' },
  { value: 'studio', label: 'filters.propertyTypes.studio', icon: BedSingle, tooltip: 'filters.propertyTypes.studioTooltip' },
  { value: 'apartment', label: 'filters.propertyTypes.apartment', icon: Building2, tooltip: 'filters.propertyTypes.apartmentTooltip' },
  { value: 'maisonette', label: 'filters.propertyTypes.maisonette', icon: NAVIGATION_ENTITIES.building.icon, tooltip: 'filters.propertyTypes.maisonetteTooltip' },
  { value: 'shop', label: 'filters.propertyTypes.shop', icon: Store, tooltip: 'filters.propertyTypes.shopTooltip' },
  { value: 'office', label: 'filters.propertyTypes.office', icon: Briefcase, tooltip: 'filters.propertyTypes.officeTooltip' },
];

/**
 * Contact Type Options (για Επαφές)
 * 🏢 ENTERPRISE: Using centralized NAVIGATION_ENTITIES for consistency
 * 🏢 ENTERPRISE: Labels and tooltips use i18n keys (filters.contactTypes.*)
 */
export const CONTACT_TYPE_OPTIONS: TypeFilterOption[] = [
  { value: 'all', label: 'filters.contactTypes.all', icon: Users, tooltip: 'filters.contactTypes.allTooltip' },
  { value: 'individual', label: 'filters.contactTypes.individual', icon: NAVIGATION_ENTITIES.contactIndividual.icon, tooltip: 'filters.contactTypes.individual' },
  { value: 'company', label: 'filters.contactTypes.company', icon: NAVIGATION_ENTITIES.contactCompany.icon, tooltip: 'filters.contactTypes.company' },
  { value: 'service', label: 'filters.contactTypes.service', icon: NAVIGATION_ENTITIES.contactService.icon, tooltip: 'filters.contactTypes.service' },
];

/**
 * Channel Type Options (για Communications)
 * 🏢 ENTERPRISE: Channels for filtering communications
 * 🏢 ENTERPRISE: Labels and tooltips use i18n keys (filters.channels.*)
 */
export const CHANNEL_OPTIONS: TypeFilterOption[] = [
  { value: 'all', label: 'filters.channels.all', icon: LayoutGrid, tooltip: 'filters.channels.allTooltip' },
  { value: 'email', label: 'filters.channels.email', icon: Mail, tooltip: 'filters.channels.emailTooltip' },
  { value: 'sms', label: 'filters.channels.sms', icon: Phone, tooltip: 'filters.channels.smsTooltip' },
  { value: 'telegram', label: 'filters.channels.telegram', icon: MessageSquare, tooltip: 'filters.channels.telegramTooltip' },
];

/**
 * PO Status Options (για Παραγγελίες/Procurement)
 * 🏢 ENTERPRISE: Mirrors PO_STATUS_META (src/types/procurement/purchase-order.ts)
 * 🏢 ENTERPRISE: Labels via procurement namespace (filters.poStatus.*)
 */
export const PO_STATUS_OPTIONS: TypeFilterOption[] = [
  { value: 'all', label: 'procurement:filters.poStatus.all', icon: LayoutGrid, tooltip: 'procurement:filters.poStatus.allTooltip' },
  { value: 'draft', label: 'procurement:filters.poStatus.draft', icon: FileEdit, tooltip: 'procurement:filters.poStatus.draftTooltip' },
  { value: 'approved', label: 'procurement:filters.poStatus.approved', icon: CheckCircle, tooltip: 'procurement:filters.poStatus.approvedTooltip' },
  { value: 'ordered', label: 'procurement:filters.poStatus.ordered', icon: Send, tooltip: 'procurement:filters.poStatus.orderedTooltip' },
  { value: 'partially_delivered', label: 'procurement:filters.poStatus.partially_delivered', icon: PackageOpen, tooltip: 'procurement:filters.poStatus.partially_deliveredTooltip' },
  { value: 'delivered', label: 'procurement:filters.poStatus.delivered', icon: PackageCheck, tooltip: 'procurement:filters.poStatus.deliveredTooltip' },
  { value: 'closed', label: 'procurement:filters.poStatus.closed', icon: CircleCheck, tooltip: 'procurement:filters.poStatus.closedTooltip' },
  { value: 'cancelled', label: 'procurement:filters.poStatus.cancelled', icon: XCircle, tooltip: 'procurement:filters.poStatus.cancelledTooltip' },
];

// =============================================================================
// 🏢 ENTERPRISE: Generic Type Quick Filters Component
// =============================================================================

export function TypeQuickFilters({
  options,
  selectedTypes,
  onTypeChange,
  className,
  compact = false,
  label,
  ariaLabel
}: TypeQuickFiltersProps) {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation']);
  const colors = useSemanticColors();

  // Use translations as defaults if props not provided
  const displayLabel = label ?? t('filters.typeLabel');
  const displayAriaLabel = ariaLabel ?? t('filters.typeAriaLabel');

  // 🎯 Handle filter selection
  const handleFilterClick = (typeValue: string) => {
    if (typeValue === 'all') {
      // Clear all filters - show all items
      onTypeChange([]);
    } else {
      // Toggle single filter (enterprise UX: single selection for quick filters)
      if (selectedTypes.includes(typeValue)) {
        // Deselect = show all
        onTypeChange([]);
      } else {
        // Select this type only
        onTypeChange([typeValue]);
      }
    }
  };

  // 🎨 Determine if a button is active
  const isActive = (typeValue: string): boolean => {
    if (typeValue === 'all') {
      return selectedTypes.length === 0;
    }
    return selectedTypes.includes(typeValue);
  };

  return (
    <div
      role="toolbar"
      className={cn(
        'flex flex-wrap items-center gap-1 px-4 py-2',
        colors.bg.secondary,
        'border-b border-border/50',
        className
      )}
      aria-label={displayAriaLabel}
    >
      {/* 📋 Filter Label (desktop only) */}
      {!compact && displayLabel && (
        <span className={cn('text-xs font-medium mr-2', colors.text.muted)}>
          {displayLabel}
        </span>
      )}

      {/* 🔘 Filter Buttons with Tooltips */}
      {options.map((option) => {
        const Icon = option.icon;
        const active = isActive(option.value);
        // 🏢 ENTERPRISE: Translate labels and tooltips via i18n
        const translatedLabel = t(option.label);
        const translatedTooltip = t(option.tooltip);

        return (
          <Tooltip key={option.value}>
            <TooltipTrigger asChild>
              <Button
                variant={active ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleFilterClick(option.value)}
                className={cn(
                  'h-7 px-2 text-xs font-medium transition-all',
                  compact ? 'px-1.5' : 'px-3',
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : cn(
                        'bg-transparent hover:bg-muted/50',
                        colors.text.secondary,
                        'border-muted-foreground/20'
                      )
                )}
                aria-pressed={active}
                aria-label={`${t('filters.filterBy')} ${translatedTooltip}`}
              >
                <Icon
                  className={cn(
                    'h-3.5 w-3.5',
                    !compact && 'mr-1'
                  )}
                />
                {!compact && (
                  <span className="hidden sm:inline">{translatedLabel}</span>
                )}
                {compact && option.value === 'all' && (
                  <span className="ml-1">{t('filters.all')}</span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {translatedTooltip}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

// =============================================================================
// 🏢 ENTERPRISE: Pre-configured Components for Specific Entities
// =============================================================================

/**
 * Unit Type Quick Filters - Pre-configured for Units/Apartments
 */
export function UnitTypeQuickFilters(props: Omit<TypeQuickFiltersProps, 'options'>) {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation']);
  return (
    <TypeQuickFilters
      {...props}
      options={PROPERTY_TYPE_OPTIONS}
      ariaLabel={props.ariaLabel ?? t('filters.propertyTypes.ariaLabel')}
    />
  );
}

/**
 * Contact Type Quick Filters - Pre-configured for Contacts
 */
export function ContactTypeQuickFilters(props: Omit<TypeQuickFiltersProps, 'options'>) {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation']);
  return (
    <TypeQuickFilters
      {...props}
      options={CONTACT_TYPE_OPTIONS}
      ariaLabel={props.ariaLabel ?? t('filters.contactTypes.ariaLabel')}
    />
  );
}

/**
 * Channel Quick Filters - Pre-configured for Communications
 */
export function ChannelQuickFilters(props: Omit<TypeQuickFiltersProps, 'options'>) {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation']);
  return (
    <TypeQuickFilters
      {...props}
      options={CHANNEL_OPTIONS}
      ariaLabel={props.ariaLabel ?? t('filters.channels.ariaLabel')}
    />
  );
}

/**
 * PO Status Quick Filters - Pre-configured for Procurement / Purchase Orders
 * 🏢 ENTERPRISE: aria label resolved via procurement namespace
 */
export function POStatusQuickFilters(props: Omit<TypeQuickFiltersProps, 'options'>) {
  const { t } = useTranslation(['procurement']);
  return (
    <TypeQuickFilters
      {...props}
      options={PO_STATUS_OPTIONS}
      ariaLabel={props.ariaLabel ?? t('filters.poStatusAriaLabel')}
    />
  );
}

/**
 * Quote Status Options (για Προσφορές)
 * 🏢 ENTERPRISE: Mirrors QUOTE_STATUS_META (src/subapps/procurement/types/quote.ts)
 * 🏢 ENTERPRISE: Labels via quotes namespace (filters.quoteStatus.*)
 */
export const QUOTE_STATUS_OPTIONS: TypeFilterOption[] = [
  { value: 'all', label: 'quotes:filters.quoteStatus.all', icon: LayoutGrid, tooltip: 'quotes:filters.quoteStatus.allTooltip' },
  { value: 'draft', label: 'quotes:filters.quoteStatus.draft', icon: FileEdit, tooltip: 'quotes:filters.quoteStatus.draftTooltip' },
  { value: 'sent_to_vendor', label: 'quotes:filters.quoteStatus.sent_to_vendor', icon: Send, tooltip: 'quotes:filters.quoteStatus.sent_to_vendorTooltip' },
  { value: 'submitted', label: 'quotes:filters.quoteStatus.submitted', icon: Inbox, tooltip: 'quotes:filters.quoteStatus.submittedTooltip' },
  { value: 'under_review', label: 'quotes:filters.quoteStatus.under_review', icon: Eye, tooltip: 'quotes:filters.quoteStatus.under_reviewTooltip' },
  { value: 'accepted', label: 'quotes:filters.quoteStatus.accepted', icon: CheckCircle, tooltip: 'quotes:filters.quoteStatus.acceptedTooltip' },
  { value: 'rejected', label: 'quotes:filters.quoteStatus.rejected', icon: XCircle, tooltip: 'quotes:filters.quoteStatus.rejectedTooltip' },
  { value: 'expired', label: 'quotes:filters.quoteStatus.expired', icon: Clock, tooltip: 'quotes:filters.quoteStatus.expiredTooltip' },
  { value: 'archived', label: 'quotes:filters.quoteStatus.archived', icon: Archive, tooltip: 'quotes:filters.quoteStatus.archivedTooltip' },
];

/**
 * Quote Status Quick Filters - Pre-configured for Quotes
 * 🏢 ENTERPRISE: aria label resolved via quotes namespace
 */
export function QuoteStatusQuickFilters(props: Omit<TypeQuickFiltersProps, 'options'>) {
  const { t } = useTranslation(['quotes']);
  return (
    <TypeQuickFilters
      {...props}
      options={QUOTE_STATUS_OPTIONS}
      ariaLabel={props.ariaLabel ?? t('filters.quoteStatusAriaLabel')}
    />
  );
}

/**
 * Vendor Quick Filters (Procore Directory + SAP MM Vendor Master pattern)
 * 🏢 ENTERPRISE: All / Active (orders last 12mo) / Preferred (high spend) / Inactive / New (last 30d)
 */
export const VENDOR_STATUS_OPTIONS: TypeFilterOption[] = [
  { value: 'all', label: 'procurement:filters.vendorStatus.all', icon: LayoutGrid, tooltip: 'procurement:filters.vendorStatus.allTooltip' },
  { value: 'active', label: 'procurement:filters.vendorStatus.active', icon: CheckCircle, tooltip: 'procurement:filters.vendorStatus.activeTooltip' },
  { value: 'preferred', label: 'procurement:filters.vendorStatus.preferred', icon: Star, tooltip: 'procurement:filters.vendorStatus.preferredTooltip' },
  { value: 'inactive', label: 'procurement:filters.vendorStatus.inactive', icon: UserX, tooltip: 'procurement:filters.vendorStatus.inactiveTooltip' },
  { value: 'new', label: 'procurement:filters.vendorStatus.new', icon: Sparkles, tooltip: 'procurement:filters.vendorStatus.newTooltip' },
];

export function VendorStatusQuickFilters(props: Omit<TypeQuickFiltersProps, 'options'>) {
  const { t } = useTranslation(['procurement']);
  return (
    <TypeQuickFilters
      {...props}
      options={VENDOR_STATUS_OPTIONS}
      ariaLabel={props.ariaLabel ?? t('filters.vendorStatusAriaLabel')}
    />
  );
}

/**
 * Material Quick Filters (Procore Materials + SAP MM Material Master pattern)
 * 🏢 ENTERPRISE: All / Recently Used (last 90d) / Inactive (180d+ or never) / No Supplier (no preferred FK)
 */
export const MATERIAL_STATUS_OPTIONS: TypeFilterOption[] = [
  { value: 'all', label: 'procurement:filters.materialStatus.all', icon: LayoutGrid, tooltip: 'procurement:filters.materialStatus.allTooltip' },
  { value: 'recently_used', label: 'procurement:filters.materialStatus.recently_used', icon: Sparkles, tooltip: 'procurement:filters.materialStatus.recently_usedTooltip' },
  { value: 'inactive', label: 'procurement:filters.materialStatus.inactive', icon: Clock, tooltip: 'procurement:filters.materialStatus.inactiveTooltip' },
  { value: 'no_supplier', label: 'procurement:filters.materialStatus.no_supplier', icon: AlertTriangle, tooltip: 'procurement:filters.materialStatus.no_supplierTooltip' },
];

export function MaterialStatusQuickFilters(props: Omit<TypeQuickFiltersProps, 'options'>) {
  const { t } = useTranslation(['procurement']);
  return (
    <TypeQuickFilters
      {...props}
      options={MATERIAL_STATUS_OPTIONS}
      ariaLabel={props.ariaLabel ?? t('filters.materialStatusAriaLabel')}
    />
  );
}

/**
 * Agreement Quick Filters (SAP MM Outline Agreements + Procore Contracts pattern)
 * 🏢 ENTERPRISE: All / Active / Expiring (30d) / Expired / Draft
 */
export const AGREEMENT_STATUS_OPTIONS: TypeFilterOption[] = [
  { value: 'all', label: 'procurement:filters.agreementStatus.all', icon: LayoutGrid, tooltip: 'procurement:filters.agreementStatus.allTooltip' },
  { value: 'active', label: 'procurement:filters.agreementStatus.active', icon: CheckCircle, tooltip: 'procurement:filters.agreementStatus.activeTooltip' },
  { value: 'expiring', label: 'procurement:filters.agreementStatus.expiring', icon: AlertTriangle, tooltip: 'procurement:filters.agreementStatus.expiringTooltip' },
  { value: 'expired', label: 'procurement:filters.agreementStatus.expired', icon: Clock, tooltip: 'procurement:filters.agreementStatus.expiredTooltip' },
  { value: 'draft', label: 'procurement:filters.agreementStatus.draft', icon: FileEdit, tooltip: 'procurement:filters.agreementStatus.draftTooltip' },
];

export function AgreementStatusQuickFilters(props: Omit<TypeQuickFiltersProps, 'options'>) {
  const { t } = useTranslation(['procurement']);
  return (
    <TypeQuickFilters
      {...props}
      options={AGREEMENT_STATUS_OPTIONS}
      ariaLabel={props.ariaLabel ?? t('filters.agreementStatusAriaLabel')}
    />
  );
}

// =============================================================================
// 🏢 ENTERPRISE: Exports
// =============================================================================

export default TypeQuickFilters;
