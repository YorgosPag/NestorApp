'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { CommonBadge } from '@/core/badges';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslation } from 'react-i18next';
import '@/lib/design-system';

// ============================================================================
// 🏢 ENTERPRISE IMPORTS - ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΑ SYSTEMS
// ============================================================================

import { COMMUNICATION_STYLES } from '../../config';
import type {
  CommunicationItem,
  CommunicationConfig,
  CommunicationFieldValue,
  TypeOption
} from '../../types';
import { HOVER_COLOR_EFFECTS, HOVER_TEXT_EFFECTS } from '@/components/ui/effects';

// ============================================================================
// 🏢 COMMUNICATION ROW PRIMITIVES (SSoT — ADR-593)
// ----------------------------------------------------------------------------
// Shared shell + typed primitive cells για ΟΛΟΥΣ τους desktop-row renderers
// (Email/Phone/Website/Social). Το κάθε channel renderer ενίει ΜΟΝΟ τα δικά
// του middle cells μέσω `children` — καμία διακλάδωση ανά channel εδώ.
// ============================================================================

/** i18n namespaces — κοινά για όλους τους communication renderers. */
const COMMUNICATION_I18N_NS = [
  'contacts',
  'contacts-banking',
  'contacts-core',
  'contacts-form',
  'contacts-lifecycle',
  'contacts-relationships'
] as const;

/** Static Tailwind grid classes (όχι dynamic string — απαιτεί το JIT). */
const GRID_COLS: Record<number, string> = {
  4: 'grid-cols-4',
  6: 'grid-cols-6'
};

type UpdateItemFn = (index: number, field: string, value: CommunicationFieldValue) => void;

// ----------------------------------------------------------------------------
// SHARED RENDERER PROP CONTRACTS (SSoT — ADR-593)
// ----------------------------------------------------------------------------

/** Κοινό contract για channel renderers ΧΩΡΙΣ Primary (Website, Social). */
export interface CommunicationRendererProps {
  item: CommunicationItem;
  index: number;
  isDesktop: boolean;
  config: CommunicationConfig;
  disabled?: boolean;
  updateItem: UpdateItemFn;
  removeItem: (index: number) => void;
}

/** Contract για channel renderers ΜΕ Primary (Email, Phone). */
export interface PrimaryCommunicationRendererProps extends CommunicationRendererProps {
  setPrimary: (index: number) => void;
}

// ----------------------------------------------------------------------------
// SELECT CELL — Type / Platform dropdown
// ----------------------------------------------------------------------------

interface CommunicationSelectCellProps {
  value: string;
  options: TypeOption[];
  disabled?: boolean;
  onValueChange: (value: string) => void;
}

/** Dropdown cell (χρησιμοποιείται για Type & Social platform). */
export const CommunicationSelectCell: React.FC<CommunicationSelectCellProps> = ({
  value,
  options,
  disabled,
  onValueChange
}) => {
  const { t } = useTranslation([...COMMUNICATION_I18N_NS]);
  return (
    <div>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className={`w-full ${COMMUNICATION_STYLES.groupedTable.input}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {t(option.label)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

// ----------------------------------------------------------------------------
// INPUT CELL — generic text/email/tel/url cell (+ Label)
// ----------------------------------------------------------------------------

interface CommunicationInputCellProps {
  value: string;
  placeholder: string;
  disabled?: boolean;
  onValueChange: (value: string) => void;
  inputType?: string;
  className?: string;
}

/** Text-input cell· καλύπτει όλα τα middle inputs και το Label. */
export const CommunicationInputCell: React.FC<CommunicationInputCellProps> = ({
  value,
  placeholder,
  disabled,
  onValueChange,
  inputType,
  className
}) => (
  <div>
    <Input
      type={inputType}
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={`w-full ${className ?? ''} ${COMMUNICATION_STYLES.groupedTable.input}`}
    />
  </div>
);

// ----------------------------------------------------------------------------
// ACTIONS CELL — Primary badge (gated) + Delete
// ----------------------------------------------------------------------------

interface CommunicationActionsCellProps {
  config: CommunicationConfig;
  item: CommunicationItem;
  index: number;
  disabled?: boolean;
  removeItem: (index: number) => void;
  setPrimary?: (index: number) => void;
}

/** Actions cell· το Primary εμφανίζεται μόνο όταν `config.supportsPrimary`. */
export const CommunicationActionsCell: React.FC<CommunicationActionsCellProps> = ({
  config,
  item,
  index,
  disabled,
  removeItem,
  setPrimary
}) => {
  const iconSizes = useIconSizes();
  return (
    <div className="flex items-center justify-end gap-2">
      {config.supportsPrimary && setPrimary && (
        <div className="flex items-center">
          {item.isPrimary ? (
            <CommonBadge status="primary" size="sm" />
          ) : (
            <CommonBadge
              status="secondary"
              size="sm"
              className={`cursor-pointer ${HOVER_COLOR_EFFECTS.FADE_OUT}`}
              onClick={() => setPrimary(index)}
            />
          )}
        </div>
      )}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => removeItem(index)}
        disabled={disabled}
        className={HOVER_TEXT_EFFECTS.RED}
      >
        <Trash2 className={iconSizes.sm} />
      </Button>
    </div>
  );
};

// ----------------------------------------------------------------------------
// ROW SHELL — frame + Type + {middle cells} + Label + Actions
// ----------------------------------------------------------------------------

interface CommunicationRowShellProps extends CommunicationRendererProps {
  columns: 4 | 6;
  setPrimary?: (index: number) => void;
  children: React.ReactNode;
}

/**
 * 🏢 ENTERPRISE ROW SHELL
 *
 * Uniform desktop-row frame για όλους τους communication renderers.
 * Layout: [Type] → {channel middle cells} → [Label] → [Actions].
 * Στο mobile επιστρέφει `null` (χρησιμοποιείται το κανονικό renderItemFields).
 */
export const CommunicationRowShell: React.FC<CommunicationRowShellProps> = ({
  item,
  index,
  isDesktop,
  columns,
  config,
  disabled = false,
  updateItem,
  removeItem,
  setPrimary,
  children
}) => {
  const { quick } = useBorderTokens();
  const { t } = useTranslation([...COMMUNICATION_I18N_NS]);

  // 🎯 ΓΙΑ ΚΙΝΗΤΑ: Κανονικό κάθετο layout
  if (!isDesktop) {
    return null;
  }

  // 🎯 ΜΟΝΟ ΓΙΑ DESKTOP: Οριζόντιο layout σε γραμμή
  return (
    <div
      key={index}
      className={`grid ${GRID_COLS[columns]} gap-2 items-center py-2 ${quick.separatorH} last:border-b-0`}
    >
      {/* 1. Τύπος */}
      <CommunicationSelectCell
        value={item.type}
        options={config.types}
        disabled={disabled}
        onValueChange={(value) => updateItem(index, 'type', value)}
      />

      {/* 2..N-2. Channel-specific middle cells */}
      {children}

      {/* N-1. Ετικέτα */}
      <CommunicationInputCell
        value={item.label || ''}
        placeholder={t(config.labelPlaceholder)}
        disabled={disabled}
        onValueChange={(value) => updateItem(index, 'label', value)}
      />

      {/* N. Actions */}
      <CommunicationActionsCell
        config={config}
        item={item}
        index={index}
        disabled={disabled}
        removeItem={removeItem}
        setPrimary={setPrimary}
      />
    </div>
  );
};
