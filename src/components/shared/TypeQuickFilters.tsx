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
  type LucideIcon
} from 'lucide-react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

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
 * 🏢 ENTERPRISE: Labels and tooltips use i18n keys (filters.unitTypes.*)
 */
export const UNIT_TYPE_OPTIONS: TypeFilterOption[] = [
  { value: 'all', label: 'filters.unitTypes.all', icon: LayoutGrid, tooltip: 'filters.unitTypes.allTooltip' },
  { value: 'studio', label: 'filters.unitTypes.studio', icon: BedSingle, tooltip: 'filters.unitTypes.studioTooltip' },
  { value: 'apartment', label: 'filters.unitTypes.apartment', icon: Building2, tooltip: 'filters.unitTypes.apartmentTooltip' },
  { value: 'maisonette', label: 'filters.unitTypes.maisonette', icon: NAVIGATION_ENTITIES.building.icon, tooltip: 'filters.unitTypes.maisonetteTooltip' },
  { value: 'shop', label: 'filters.unitTypes.shop', icon: Store, tooltip: 'filters.unitTypes.shopTooltip' },
  { value: 'office', label: 'filters.unitTypes.office', icon: Briefcase, tooltip: 'filters.unitTypes.officeTooltip' },
];

/**
 * Contact Type Options (για Επαφές)
 * 🏢 ENTERPRISE: Using centralized NAVIGATION_ENTITIES for consistency
 * 🏢 ENTERPRISE: Labels and tooltips use i18n keys (filters.contactTypes.*)
 */
export const CONTACT_TYPE_OPTIONS: TypeFilterOption[] = [
  { value: 'all', label: 'filters.contactTypes.all', icon: Users, tooltip: 'filters.contactTypes.allTooltip' },
  { value: 'individual', label: 'filters.contactTypes.individual', icon: NAVIGATION_ENTITIES.contactIndividual.icon, tooltip: 'contactTypes.individual' },
  { value: 'company', label: 'filters.contactTypes.company', icon: NAVIGATION_ENTITIES.contactCompany.icon, tooltip: 'contactTypes.company' },
  { value: 'service', label: 'filters.contactTypes.service', icon: NAVIGATION_ENTITIES.contactService.icon, tooltip: 'contactTypes.service' },
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
  const { t } = useTranslation('common');
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
    <nav
      className={cn(
        'flex flex-wrap items-center gap-1 px-4 py-2',
        colors.bg.secondary,
        'border-b border-border/50',
        className
      )}
      aria-label={displayAriaLabel}
      role="group"
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
    </nav>
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
  const { t } = useTranslation('common');
  return (
    <TypeQuickFilters
      {...props}
      options={UNIT_TYPE_OPTIONS}
      ariaLabel={props.ariaLabel ?? t('filters.unitTypes.ariaLabel')}
    />
  );
}

/**
 * Contact Type Quick Filters - Pre-configured for Contacts
 */
export function ContactTypeQuickFilters(props: Omit<TypeQuickFiltersProps, 'options'>) {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('common');
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
  const { t } = useTranslation('common');
  return (
    <TypeQuickFilters
      {...props}
      options={CHANNEL_OPTIONS}
      ariaLabel={props.ariaLabel ?? t('filters.channels.ariaLabel', 'Φίλτρα καναλιών')}
    />
  );
}

// =============================================================================
// 🏢 ENTERPRISE: Exports
// =============================================================================

export default TypeQuickFilters;
