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
// 🏢 SOCIAL RENDERER - ENTERPRISE RENDERER COMPONENT
// ============================================================================

interface SocialRendererProps {
  item: CommunicationItem;
  index: number;
  isDesktop: boolean;
  config: CommunicationConfig;
  disabled?: boolean;
  updateItem: (index: number, field: string, value: any) => void;
  removeItem: (index: number) => void;
}

/**
 * 📱 ENTERPRISE SOCIAL RENDERER
 *
 * Specialized renderer για social media communication items
 * Supports desktop table layout και mobile vertical layout
 * Note: Social media δεν έχει Primary functionality
 */
export const SocialRenderer: React.FC<SocialRendererProps> = ({
  item,
  index,
  isDesktop,
  config,
  disabled = false,
  updateItem,
  removeItem
}) => {
  // 🎯 ΜΟΝΟ ΓΙΑ DESKTOP: Οριζόντιο layout σε γραμμή για social media
  if (isDesktop) {
    return (
      <div key={index} className="grid grid-cols-6 gap-3 items-center py-2 border-b border-gray-100 last:border-b-0">
        {/* 1. Τύπος (Προσωπικό, Επαγγελματικό, κτλ.) */}
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

        {/* 2. Πλατφόρμα */}
        <div>
          <Select
            value={item.platform || item.type || config.defaultType}
            onValueChange={(value) => updateItem(index, 'platform', value)}
            disabled={disabled}
          >
            <SelectTrigger className={`w-full ${COMMUNICATION_STYLES.groupedTable.input}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(config.platformTypes || config.types).map(type => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 3. Username */}
        <div>
          <Input
            value={item.username || ''}
            onChange={(e) => updateItem(index, 'username', e.target.value)}
            placeholder="john-doe"
            disabled={disabled}
            className={`w-full ${COMMUNICATION_STYLES.groupedTable.input}`}
          />
        </div>

        {/* 4. Auto-generated URL */}
        <div>
          <Input
            value={item.url || ''}
            onChange={(e) => updateItem(index, 'url', e.target.value)}
            placeholder="https://..."
            disabled={disabled}
            className={`w-full text-sm ${COMMUNICATION_STYLES.groupedTable.input}`}
          />
        </div>

        {/* 5. Ετικέτα */}
        <div>
          <Input
            value={item.label || ''}
            onChange={(e) => updateItem(index, 'label', e.target.value)}
            placeholder={config.labelPlaceholder}
            disabled={disabled}
            className={`w-full ${COMMUNICATION_STYLES.groupedTable.input}`}
          />
        </div>

        {/* 6. Actions - Μόνο Κάδος (δεν υπάρχει Primary για social) */}
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