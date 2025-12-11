'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';
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
// 🏢 WEBSITE RENDERER - ENTERPRISE RENDERER COMPONENT
// ============================================================================

interface WebsiteRendererProps {
  item: CommunicationItem;
  index: number;
  isDesktop: boolean;
  config: CommunicationConfig;
  disabled?: boolean;
  updateItem: (index: number, field: string, value: any) => void;
  removeItem: (index: number) => void;
}

/**
 * 🌐 ENTERPRISE WEBSITE RENDERER
 *
 * Specialized renderer για website communication items
 * Supports desktop table layout και mobile vertical layout
 * Note: Websites δεν έχουν Primary functionality
 */
export const WebsiteRenderer: React.FC<WebsiteRendererProps> = ({
  item,
  index,
  isDesktop,
  config,
  disabled = false,
  updateItem,
  removeItem
}) => {
  // 🎯 ΜΟΝΟ ΓΙΑ DESKTOP: Οριζόντιο layout σε γραμμή για websites
  if (isDesktop) {
    return (
      <div key={index} className="grid grid-cols-4 gap-3 items-center py-2 border-b border-gray-100 last:border-b-0">
        {/* 1. Τύπος (Προσωπική, Εταιρική, κτλ.) */}
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

        {/* 2. URL */}
        <div>
          <Input
            type="url"
            value={item.url || ''}
            onChange={(e) => updateItem(index, 'url', e.target.value)}
            placeholder="https://example.com"
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

        {/* 4. Actions - Μόνο Κάδος (δεν υπάρχει Primary για websites) */}
        <div className="flex items-center justify-end gap-2">
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