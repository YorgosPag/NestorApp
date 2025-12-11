'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';
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
  type CommunicationConfig
} from '../';

// ============================================================================
// 🏢 EMAIL RENDERER - ENTERPRISE RENDERER COMPONENT
// ============================================================================

interface EmailRendererProps {
  item: CommunicationItem;
  index: number;
  isDesktop: boolean;
  config: CommunicationConfig;
  disabled?: boolean;
  updateItem: (index: number, field: string, value: any) => void;
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
  // 🎯 ΜΟΝΟ ΓΙΑ DESKTOP: Οριζόντιο layout σε γραμμή για emails
  if (isDesktop) {
    return (
      <div key={index} className="grid grid-cols-4 gap-3 items-center py-2 border-b border-gray-100 last:border-b-0">
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
                  {type.label}
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
            placeholder={config.labelPlaceholder}
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
                  className="cursor-pointer hover:opacity-80"
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
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // 🎯 ΓΙΑ ΚΙΝΗΤΑ: Κανονικό κάθετο layout
  return null; // Θα χρησιμοποιηθεί το κανονικό renderItemFields
};