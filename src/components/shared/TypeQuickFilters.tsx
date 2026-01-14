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
 */
export const UNIT_TYPE_OPTIONS: TypeFilterOption[] = [
  { value: 'all', label: 'Όλες', icon: LayoutGrid, tooltip: 'Εμφάνιση όλων των τύπων' },
  { value: 'studio', label: 'Studio', icon: BedSingle, tooltip: 'Studio / Γκαρσονιέρα' },
  { value: 'apartment', label: 'Διαμέρισμα', icon: Building2, tooltip: 'Διαμέρισμα' },
  { value: 'maisonette', label: 'Μεζονέτα', icon: NAVIGATION_ENTITIES.building.icon, tooltip: 'Μεζονέτα' },
  { value: 'shop', label: 'Κατάστημα', icon: Store, tooltip: 'Κατάστημα' },
  { value: 'office', label: 'Γραφείο', icon: Briefcase, tooltip: 'Γραφείο' },
];

/**
 * Contact Type Options (για Επαφές)
 * 🏢 ENTERPRISE: Using centralized NAVIGATION_ENTITIES for consistency
 * - individual: Φυσικό Πρόσωπο
 * - company: Νομικό Πρόσωπο / Εταιρεία
 * - service: Δημόσια Υπηρεσία
 */
export const CONTACT_TYPE_OPTIONS: TypeFilterOption[] = [
  { value: 'all', label: 'Όλες', icon: Users, tooltip: 'Εμφάνιση όλων των επαφών' },
  { value: 'individual', label: 'Φυσικό', icon: NAVIGATION_ENTITIES.contactIndividual.icon, tooltip: NAVIGATION_ENTITIES.contactIndividual.label },
  { value: 'company', label: 'Εταιρεία', icon: NAVIGATION_ENTITIES.contactCompany.icon, tooltip: NAVIGATION_ENTITIES.contactCompany.label },
  { value: 'service', label: 'Υπηρεσία', icon: NAVIGATION_ENTITIES.contactService.icon, tooltip: NAVIGATION_ENTITIES.contactService.label },
];

/**
 * Channel Type Options (για Communications)
 * 🏢 ENTERPRISE: Channels for filtering communications
 * - all: Όλα τα κανάλια
 * - email: Email
 * - sms: SMS
 * - telegram: Telegram
 */
export const CHANNEL_OPTIONS: TypeFilterOption[] = [
  { value: 'all', label: 'Όλα', icon: LayoutGrid, tooltip: 'Εμφάνιση όλων των καναλιών' },
  { value: 'email', label: 'Email', icon: Mail, tooltip: 'Email μηνύματα' },
  { value: 'sms', label: 'SMS', icon: Phone, tooltip: 'SMS μηνύματα' },
  { value: 'telegram', label: 'Telegram', icon: MessageSquare, tooltip: 'Telegram μηνύματα' },
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
                aria-label={`${t('filters.filterBy')} ${option.tooltip}`}
              >
                <Icon
                  className={cn(
                    'h-3.5 w-3.5',
                    !compact && 'mr-1'
                  )}
                />
                {!compact && (
                  <span className="hidden sm:inline">{option.label}</span>
                )}
                {compact && option.value === 'all' && (
                  <span className="ml-1">{t('filters.all')}</span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {option.tooltip}
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
