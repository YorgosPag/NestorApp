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

import {
  COMMUNICATION_STYLES,
  type CommunicationItem,
  type CommunicationConfig,
  type CommunicationFieldValue // 🏢 ENTERPRISE: Type-safe field values
} from '../';
import { HOVER_COLOR_EFFECTS, HOVER_TEXT_EFFECTS } from '@/components/ui/effects';

// ============================================================================
// 🏢 EMAIL RENDERER - ENTERPRISE RENDERER COMPONENT
// ============================================================================

interface EmailRendererProps {
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
 * 📧 ENTERPRISE EMAIL RENDERER
 *
 * Specialized renderer για email communication items
 * Supports desktop table layout και mobile vertical layout
 */
export const EmailRenderer: React.FC<EmailRendererProps> = ({
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
  const { quick } = useBorderTokens();
  const { t } = useTranslation('contacts');

  // 🎯 ΜΟΝΟ ΓΙΑ DESKTOP: Οριζόντιο layout σε γραμμή για emails
  if (isDesktop) {
    return (
      <div key={index} className={`grid grid-cols-4 gap-2 items-center py-2 ${quick.separatorH} last:border-b-0`}>
        {/* 1. Τύπος (Προσωπικό, Εργασία, κτλ.) */}
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
                  {t(type.label)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 2. Διεύθυνση E-mail */}
        <div>
          <Input
            type="email"
            value={item.email || ''}
            onChange={(e) => updateItem(index, 'email', e.target.value)}
            placeholder="john@example.com"
            disabled={disabled}
            className={`w-full ${COMMUNICATION_STYLES.groupedTable.input}`}
          />
        </div>

        {/* 3. Ετικέτα */}
        <div>
          <Input
            value={item.label || ''}
            onChange={(e) => updateItem(index, 'label', e.target.value)}
            placeholder={t(config.labelPlaceholder)}
            disabled={disabled}
            className={`w-full ${COMMUNICATION_STYLES.groupedTable.input}`}
          />
        </div>

        {/* 4. Actions - Κάδος & Primary */}
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