/**
 * 🏢 PROPERTY STATUS SELECTOR
 *
 * Enterprise-class selector component για επεξεργασία καταστάσεων ακινήτων
 * Με intelligent business rules, validation, και user-friendly interface
 *
 * @created 2025-12-14
 * @author Claude AI Assistant
 * @version 1.0.0
 * @enterprise Production-ready status selection component
 */

'use client';

import React, { useState, useMemo } from 'react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

import {
  EnhancedPropertyStatus,
  STATUS_CATEGORIES,
  getEnhancedStatusLabel,
  getStatusCategory,
  getAllEnhancedStatuses
} from '@/constants/property-statuses-enterprise';

import {
  propertyStatusEngine,
  EnhancedProperty,
  canChangeStatus
} from '@/services/property-status/PropertyStatusEngine';

import { UnifiedPropertyStatusBadge } from './UnifiedPropertyStatusBadge';

// Icons
import { Check, AlertTriangle, Info } from 'lucide-react';

// ============================================================================
// INTERFACES & TYPES
// ============================================================================

export interface PropertyStatusSelectorProps {
  /** Current property status */
  currentStatus: EnhancedPropertyStatus;

  /** Property data για validation */
  property?: Partial<EnhancedProperty>;

  /** User role for permission checks */
  userRole?: 'agent' | 'manager' | 'admin';

  /** Show only specific categories */
  allowedCategories?: Array<keyof typeof STATUS_CATEGORIES>;

  /** Show reason field */
  requireReason?: boolean;

  /** Group by categories */
  groupByCategory?: boolean;

  /** Show status descriptions */
  showDescriptions?: boolean;

  /** Show business rules warnings */
  showValidation?: boolean;

  /** Size variant */
  size?: 'sm' | 'md' | 'lg';

  /** Disabled state */
  disabled?: boolean;

  /** Custom className */
  className?: string;

  /** Custom placeholders for internationalization */
  placeholders?: {
    selectNewStatus?: string;
    reasonPlaceholder?: string;
  };

  /** Change handler */
  onStatusChange: (
    newStatus: EnhancedPropertyStatus,
    reason?: string
  ) => void | Promise<void>;

  /** Validation handler */
  onValidate?: (status: EnhancedPropertyStatus) => Promise<boolean>;
}

interface StatusOption {
  status: EnhancedPropertyStatus;
  label: string;
  category: string;
  isAllowed: boolean;
  requiresApproval: boolean;
  description?: string;
  warning?: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * 🎯 Property Status Selector
 *
 * Intelligent selector με business rules validation
 */
export function PropertyStatusSelector({
  currentStatus,
  property,
  userRole = 'agent',
  allowedCategories,
  requireReason = false,
  groupByCategory = true,
  showDescriptions = true,
  showValidation = true,
  size = 'md',
  disabled = false,
  className,
  placeholders,
  onStatusChange,
  onValidate
}: PropertyStatusSelectorProps) {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('properties');

  // ========================================================================
  // STATE
  // ========================================================================

  const [selectedStatus, setSelectedStatus] = useState<EnhancedPropertyStatus | null>(null);
  const [reason, setReason] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [showReasonField, setShowReasonField] = useState(false);
  const badgeSize: 'default' | 'sm' | 'lg' = size === 'md' ? 'default' : size;

  // ========================================================================
  // COMPUTED VALUES
  // ========================================================================

  /**
   * 📋 Generate available status options με business rules
   */
  const statusOptions: StatusOption[] = useMemo(() => {
    const allStatuses = getAllEnhancedStatuses();
    const options: StatusOption[] = [];

    for (const status of allStatuses) {
      if (status === currentStatus) continue; // Skip current status

      const category = getStatusCategory(status);
      const label = getEnhancedStatusLabel(status);

      // 🏢 ENTERPRISE: Filter by allowed categories with proper type casting
      // getStatusCategory returns string, but allowedCategories expects keyof typeof STATUS_CATEGORIES
      if (allowedCategories && !allowedCategories.includes(category as keyof typeof STATUS_CATEGORIES)) {
        continue;
      }

      // Check business rules
      const isAllowed = canChangeStatus(currentStatus, status, userRole);

      // Check if requires approval
      const requiresApproval = userRole === 'agent' &&
        ['company-owned', 'not-for-sale', 'family-reserved'].includes(status);

      let description = '';
      let warning = '';

      // 🏢 ENTERPRISE: Get i18n keys and translate
      if (showDescriptions) {
        const descKey = getStatusDescriptionKey(status);
        description = descKey ? t(descKey) : '';
      }

      if (showValidation && !isAllowed) {
        const warnKey = getValidationWarningKey(currentStatus, status, userRole);
        warning = warnKey ? t(warnKey) : '';
      }

      options.push({
        status,
        label,
        category,
        isAllowed,
        requiresApproval,
        description,
        warning
      });
    }

    // Sort by category and then by label
    return options.sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return a.label.localeCompare(b.label);
    });
  }, [currentStatus, allowedCategories, userRole, showDescriptions, showValidation, t]);

  /**
   * 📊 Group options by category
   */
  const groupedOptions = useMemo(() => {
    if (!groupByCategory) return { [t('statusSelector.allStatuses')]: statusOptions };

    const groups: Record<string, StatusOption[]> = {};

    for (const option of statusOptions) {
      const categoryKey = getCategoryKey(option.category);
      const categoryLabel = t(categoryKey);
      if (!groups[categoryLabel]) {
        groups[categoryLabel] = [];
      }
      groups[categoryLabel].push(option);
    }

    return groups;
  }, [statusOptions, groupByCategory, t]);

  // ========================================================================
  // EVENT HANDLERS
  // ========================================================================

  /**
   * ✅ Handle status selection
   */
  const handleStatusSelect = async (status: EnhancedPropertyStatus) => {
    setSelectedStatus(status);
    setValidationMessage(null);

    // Validate selection
    if (showValidation && property) {
      setIsValidating(true);

      const testProperty = { ...property, status };
      const validation = propertyStatusEngine.validateProperty(testProperty as EnhancedProperty);

      if (!validation.isValid) {
        setValidationMessage(validation.errors.join(', '));
        setIsValidating(false);
        return;
      }

      // Custom validation
      if (onValidate) {
        const isValid = await onValidate(status);
        if (!isValid) {
          setValidationMessage('Custom validation failed');
          setIsValidating(false);
          return;
        }
      }

      setIsValidating(false);
    }

    // Check if reason is required
    const option = statusOptions.find(opt => opt.status === status);
    if (requireReason || option?.requiresApproval) {
      setShowReasonField(true);
    } else {
      // Apply change immediately
      await handleConfirmChange(status, '');
    }
  };

  /**
   * 💾 Handle change confirmation
   */
  const handleConfirmChange = async (status: EnhancedPropertyStatus, changeReason: string) => {
    try {
      await onStatusChange(status, changeReason);

      // Reset state
      setSelectedStatus(null);
      setReason('');
      setShowReasonField(false);
      setValidationMessage(null);
    } catch (error) {
      setValidationMessage(
        error instanceof Error ? error.message : t('statusSelector.errors.changeError')
      );
    }
  };

  /**
   * ❌ Handle change cancellation
   */
  const handleCancelChange = () => {
    setSelectedStatus(null);
    setReason('');
    setShowReasonField(false);
    setValidationMessage(null);
  };

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <div className={cn('space-y-4', className)}>

      {/* Current Status Display */}
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{t('statusSelector.currentStatus')}</Label>
        <UnifiedPropertyStatusBadge
          status={currentStatus}
          size={badgeSize}
          showIcon
        />
      </div>

      {/* Status Selector */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">{t('statusSelector.changeStatus')}</Label>

        <Select
          value={selectedStatus || ''}
          onValueChange={(value) => handleStatusSelect(value as EnhancedPropertyStatus)}
          disabled={disabled || isValidating}
        >
          <SelectTrigger className={cn(
            'w-full',
            size === 'sm' && 'h-8 text-sm',
            size === 'lg' && 'h-12 text-base'
          )}>
            <SelectValue placeholder={placeholders?.selectNewStatus || t('statusSelector.selectPlaceholder')} />
          </SelectTrigger>

          <SelectContent className="max-h-80">
            {Object.entries(groupedOptions).map(([groupLabel, options]) => (
              <SelectGroup key={groupLabel}>
                {groupByCategory && (
                  <SelectLabel className="text-xs font-medium text-muted-foreground px-2 py-1">
                    {groupLabel}
                  </SelectLabel>
                )}

                {options.map((option) => (
                  <SelectItem
                    key={option.status}
                    value={option.status}
                    disabled={!option.isAllowed}
                    className={cn(
                      'flex flex-col items-start gap-1 p-3',
                      !option.isAllowed && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-medium">{option.label}</span>

                      {/* Status badges */}
                      <div className="flex items-center gap-1">
                        {option.requiresApproval && (
                          <Badge variant="outline" className="text-xs">
                            {t('statusSelector.badges.approval')}
                          </Badge>
                        )}
                        {!option.isAllowed && (
                          <Badge variant="destructive" className="text-xs">
                            {t('statusSelector.badges.notAvailable')}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    {option.description && (
                      <p className="text-xs text-muted-foreground">
                        {option.description}
                      </p>
                    )}

                    {/* Warning */}
                    {option.warning && (
                      <div className="flex items-center gap-1 text-xs text-destructive">
                        <AlertTriangle className={iconSizes.xs} />
                        <span>{option.warning}</span>
                      </div>
                    )}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Validation Message */}
      {validationMessage && (
        <div className={`flex items-center gap-2 p-3 bg-destructive/10 ${quick.error}`}>
          <AlertTriangle className={`${iconSizes.sm} text-destructive flex-shrink-0`} />
          <span className="text-sm text-destructive">{validationMessage}</span>
        </div>
      )}

      {/* Reason Field */}
      {showReasonField && selectedStatus && (
        <div className={`space-y-3 p-4 bg-muted/50 ${quick.card}`}>
          <div className="flex items-center gap-2">
            <Info className={`${iconSizes.sm} text-blue-500`} />
            <Label className="text-sm font-medium">
              {t('statusSelector.reasonLabel')} {requireReason && '*'}
            </Label>
          </div>

          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('statusSelector.reasonPlaceholder')}
            rows={3}
            className="resize-none"
          />

          {/* Action Buttons */}
          <div className="flex items-center gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancelChange}
            >
              {t('statusSelector.buttons.cancel')}
            </Button>

            <Button
              size="sm"
              onClick={() => handleConfirmChange(selectedStatus, reason)}
              disabled={requireReason && !reason.trim()}
            >
              <Check className={`${iconSizes.sm} mr-1`} />
              {t('statusSelector.buttons.confirm')}
            </Button>
          </div>
        </div>
      )}

      {/* Quick Actions για συνηθισμένες αλλαγές */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleStatusSelect('for-sale')}
          disabled={!canChangeStatus(currentStatus, 'for-sale', userRole)}
        >
          {t('statusSelector.quickActions.forSale')}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => handleStatusSelect('for-rent')}
          disabled={!canChangeStatus(currentStatus, 'for-rent', userRole)}
        >
          {t('statusSelector.quickActions.forRent')}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => handleStatusSelect('reserved')}
          disabled={!canChangeStatus(currentStatus, 'reserved', userRole)}
        >
          {t('statusSelector.quickActions.reserve')}
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// 🏢 ENTERPRISE: Returns i18n key for category label
function getCategoryKey(category: string): string {
  const keys: Record<string, string> = {
    'AVAILABLE': 'statusSelector.categories.available',
    'COMMITTED': 'statusSelector.categories.committed',
    'OFF_MARKET': 'statusSelector.categories.offMarket',
    'IN_PROCESS': 'statusSelector.categories.inProcess',
    'OTHER': 'statusSelector.categories.other'
  };
  return keys[category] || category;
}

// 🏢 ENTERPRISE: Returns i18n key for status description
function getStatusDescriptionKey(status: EnhancedPropertyStatus): string {
  const keys: Partial<Record<EnhancedPropertyStatus, string>> = {
    'rental-only': 'statusSelector.descriptions.rentalOnly',
    'reserved-pending': 'statusSelector.descriptions.reservedPending',
    'contract-signed': 'statusSelector.descriptions.contractSigned',
    'company-owned': 'statusSelector.descriptions.companyOwned',
    'urgent-sale': 'statusSelector.descriptions.urgentSale',
    'under-renovation': 'statusSelector.descriptions.underRenovation'
  };
  return keys[status] || '';
}

// 🏢 ENTERPRISE: Returns i18n key for validation warning
function getValidationWarningKey(
  from: EnhancedPropertyStatus,
  to: EnhancedPropertyStatus,
  userRole: string
): string {
  if (from === 'sold') {
    return 'statusSelector.warnings.soldCannotChange';
  }

  if (userRole === 'agent' && to === 'company-owned') {
    return 'statusSelector.warnings.managerApprovalRequired';
  }

  return 'statusSelector.warnings.notAllowed';
}

// ============================================================================
// EXPORTS
// ============================================================================

export default PropertyStatusSelector;
