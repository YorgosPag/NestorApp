'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { CommonBadge } from '@/core/badges';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// ============================================================================
// 🏢 ENTERPRISE IMPORTS - ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΑ SYSTEMS
// ============================================================================

import {
  COMMUNICATION_STYLES,
  type CommunicationItem,
  type CommunicationConfig,
  type CommunicationFieldValue // 🏢 ENTERPRISE: Type-safe field values
} from '../';
import { HOVER_TEXT_EFFECTS, HOVER_COLOR_EFFECTS } from '@/components/ui/effects';

// ============================================================================
// 🏢 PHONE RENDERER - ENTERPRISE RENDERER COMPONENT
// ============================================================================

interface PhoneRendererProps {
  item: CommunicationItem;
  index: number;
  isDesktop: boolean;
  config: CommunicationConfig;
  disabled?: boolean;
  updateItem: (index: number, field: string, value: CommunicationFieldValue) => void;
  setPrimary: (index: number) => void;
  removeItem: (index: number) => void;
}

/**
 * 📞 ENTERPRISE PHONE RENDERER
 *
 * Specialized renderer για phone communication items
 * Supports desktop table layout και mobile vertical layout
 */
export const PhoneRenderer: React.FC<PhoneRendererProps> = ({
  item,
  index,
  isDesktop,
  config,
  disabled = false,
  updateItem,
  setPrimary,
  removeItem
}) => {
  const iconSizes = useIconSizes();

  // 🎯 ΜΟΝΟ ΓΙΑ DESKTOP: Οριζόντιο layout σε γραμμή
  if (isDesktop) {
    return (
      <div key={index} className="grid grid-cols-5 gap-3 items-center py-2 border-b border-gray-100 last:border-b-0">
        {/* 1. Τύπος (Κινητό, Σπίτι, κτλ.) */}
        <div>
          <Select
            value={item.type}
            onValueChange={(value) => updateItem(index, 'type', value)}
            disabled={disabled}
          >
            <SelectTrigger className={`w-full ${COMMUNICATION_STYLES.groupedTable.input}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {config.types.map(type => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 2. Κωδικός Χώρας */}
        <div>
          <Input
            value={item.countryCode || '+30'}
            onChange={(e) => updateItem(index, 'countryCode', e.target.value)}
            placeholder="+30"
            disabled={disabled}
            className={`w-full ${COMMUNICATION_STYLES.groupedTable.input}`}
          />
        </div>

        {/* 3. Αριθμός Τηλεφώνου */}
        <div>
          <Input
            type="tel"
            value={item.number || ''}
            onChange={(e) => updateItem(index, 'number', e.target.value)}
            placeholder="2310 123456"
            disabled={disabled}
            className={`w-full ${COMMUNICATION_STYLES.groupedTable.input}`}
          />
        </div>

        {/* 4. Ετικέτα */}
        <div>
          <Input
            value={item.label || ''}
            onChange={(e) => updateItem(index, 'label', e.target.value)}
            placeholder={config.labelPlaceholder}
            disabled={disabled}
            className={`w-full ${COMMUNICATION_STYLES.groupedTable.input}`}
          />
        </div>

        {/* 5. Actions - Κάδος & Primary */}
        <div className="flex items-center justify-end gap-2">
          {/* Primary Badge/Button */}
          {config.supportsPrimary && (
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

          {/* Delete Button */}
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
      </div>
    );
  }

  // 🎯 ΓΙΑ ΚΙΝΗΤΑ: Κανονικό κάθετο layout
  return null; // Θα χρησιμοποιηθεί το κανονικό renderItemFields
};