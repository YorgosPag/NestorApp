'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PROPERTY_TYPE_LABELS } from '@/constants/property-statuses-enterprise';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// 🏢 ENTERPRISE: Property type keys for i18n translation
const PROPERTY_TYPE_KEYS = Object.keys(PROPERTY_TYPE_LABELS) as Array<keyof typeof PROPERTY_TYPE_LABELS>;

// ============================================================================
// PROPERTY GRID: PURE RADIX UI TYPE SELECT
// ============================================================================
//
// 🏢 ΕΠΑΓΓΕΛΜΑΤΙΚΟ: Pure Radix UI implementation για enterprise-grade architecture
// ♿ WAI-ARIA compliant, professional keyboard navigation, battle-tested
// 📱 Mobile ready, touch-friendly, industry standard solution
//
// ============================================================================

/**
 * 🏢 Pure Radix UI Type Select Component for Property Grid
 *
 * Enterprise-grade dropdown για property type filtering.
 * Uses industry standard Radix UI Select with professional accessibility.
 */
export function TypeSelect({
  selected,
  onChange,
}: {
  selected: string | undefined;
  onChange: (v: string) => void;
}) {
  const { quick, radius } = useBorderTokens();
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('properties');

  // 🏢 ENTERPRISE: Dynamic options with i18n translation
  const typeOptions = [
    { value: 'all', label: t('filters.allTypes') },
    ...PROPERTY_TYPE_KEYS.map((key) => ({
      value: key,
      label: t(`filters.types.${key}`)
    }))
  ];

  return (
    <Select value={selected || 'all'} onValueChange={onChange}>
      <SelectTrigger className={`px-4 py-2.5 ${quick.input} dark:bg-muted/30 ${radius.lg} focus:outline-none focus:ring-2 focus:ring-ring ${colors.bg.primary}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {typeOptions.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}