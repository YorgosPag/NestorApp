'use client';

import React, { useCallback, useState, useEffect } from 'react';
import { Plus, Trash2, Phone, Mail, Globe, LucideIcon } from 'lucide-react';
import { CommonBadge } from '@/core/badges';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { PhoneInfo, EmailInfo, WebsiteInfo, SocialMediaInfo } from '@/types/contacts';

// ============================================================================
// 🏢 ENTERPRISE UNIVERSAL COMMUNICATION MANAGER
// ============================================================================

/**
 * 🚀 ENTERPRISE ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΟΣ COMMUNICATION MANAGER
 *
 * Αντικαθιστά τα 4 ξεχωριστά managers:
 * - PhoneManager ❌ → UniversalCommunicationManager ✅
 * - EmailManager ❌ → UniversalCommunicationManager ✅
 * - WebsiteManager ❌ → UniversalCommunicationManager ✅
 * - SocialMediaManager ❌ → UniversalCommunicationManager ✅
 *
 * SINGLE SOURCE OF TRUTH για όλη την επικοινωνία!
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type CommunicationType = 'phone' | 'email' | 'website' | 'social';

export interface CommunicationItem {
  // Common fields για όλους τους τύπους
  type: string;
  label?: string;
  isPrimary?: boolean;

  // Specific fields ανάλογα με τον τύπο
  number?: string; // phones
  countryCode?: string; // phones
  email?: string; // emails
  url?: string; // websites, social
  username?: string; // social
  platform?: string; // social
}

export interface TypeOption {
  value: string;
  label: string;
}

export interface CommunicationConfig {
  type: CommunicationType;
  title: string;
  icon: LucideIcon;
  fields: {
    primary: string; // main field name (number, email, url, username)
    secondary?: string; // optional secondary field
  };
  types: TypeOption[];
  platformTypes?: TypeOption[]; // Optional: Ξεχωριστές πλατφόρμες για social media
  defaultType: string;
  placeholder: string;
  labelPlaceholder: string; // Placeholder για το label field
  supportsPrimary: boolean; // phones & emails support isPrimary
  emptyStateText: string;
  addButtonText: string; // Text για το add button
}

export interface UniversalCommunicationManagerProps {
  config: CommunicationConfig;
  items: CommunicationItem[];
  disabled?: boolean;
  onChange: (items: CommunicationItem[]) => void;
}

// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================

export const COMMUNICATION_CONFIGS: Record<CommunicationType, CommunicationConfig> = {
  phone: {
    type: 'phone',
    title: 'Τηλέφωνα',
    icon: Phone,
    fields: { primary: 'number', secondary: 'countryCode' },
    types: [
      { value: 'mobile', label: 'Κινητό' },
      { value: 'home', label: 'Σπίτι' },
      { value: 'work', label: 'Εργασία' },
      { value: 'fax', label: 'Φαξ' },
      { value: 'other', label: 'Άλλο' }
    ],
    defaultType: 'mobile',
    placeholder: 'π.χ. 2310 123456',
    labelPlaceholder: 'π.χ. Προσωπικό τηλέφωνο',
    supportsPrimary: true,
    emptyStateText: 'Δεν έχουν οριστεί τηλέφωνα',
    addButtonText: 'Προσθήκη Τηλεφώνου'
  },

  email: {
    type: 'email',
    title: 'E-mails',
    icon: Mail,
    fields: { primary: 'email' },
    types: [
      { value: 'personal', label: 'Προσωπικό' },
      { value: 'work', label: 'Εργασία' },
      { value: 'other', label: 'Άλλο' }
    ],
    defaultType: 'personal',
    placeholder: 'π.χ. john@example.com',
    labelPlaceholder: 'π.χ. Προσωπικό e-mail',
    supportsPrimary: true,
    emptyStateText: 'Δεν έχουν οριστεί e-mails',
    addButtonText: 'Προσθήκη E-mail'
  },

  website: {
    type: 'website',
    title: 'Ιστοσελίδες',
    icon: Globe,
    fields: { primary: 'url' },
    types: [
      { value: 'personal', label: 'Προσωπική' },
      { value: 'company', label: 'Εταιρική' },
      { value: 'portfolio', label: 'Χαρτοφυλάκιο' },
      { value: 'blog', label: 'Blog' },
      { value: 'other', label: 'Άλλη' }
    ],
    defaultType: 'personal',
    placeholder: 'π.χ. https://example.com',
    labelPlaceholder: 'π.χ. Προσωπική ιστοσελίδα',
    supportsPrimary: false,
    emptyStateText: 'Δεν έχουν οριστεί ιστοσελίδες',
    addButtonText: 'Προσθήκη Ιστοσελίδας'
  },

  social: {
    type: 'social',
    title: 'Social Media',
    icon: Globe,
    fields: { primary: 'username', secondary: 'platform' },
    // 🎯 ΤΥΠΟΙ ΧΡΗΣΗΣ για το "Τύπος" dropdown
    types: [
      { value: 'personal', label: 'Προσωπικό' },
      { value: 'professional', label: 'Επαγγελματικό' },
      { value: 'business', label: 'Επιχειρησιακό' },
      { value: 'other', label: 'Άλλο' }
    ],
    // 🎯 ΠΛΑΤΦΟΡΜΕΣ για το "Πλατφόρμα" dropdown
    platformTypes: [
      { value: 'linkedin', label: 'LinkedIn' },
      { value: 'facebook', label: 'Facebook' },
      { value: 'instagram', label: 'Instagram' },
      { value: 'twitter', label: 'Twitter/X' },
      { value: 'youtube', label: 'YouTube' },
      { value: 'github', label: 'GitHub' },
      { value: 'tiktok', label: 'TikTok' },
      { value: 'whatsapp', label: 'WhatsApp' },
      { value: 'telegram', label: 'Telegram' },
      { value: 'other', label: 'Άλλη Πλατφόρμα' }
    ],
    defaultType: 'personal',
    placeholder: 'π.χ. john-doe',
    labelPlaceholder: 'π.χ. Προσωπικό κοινωνικό δίκτυο',
    supportsPrimary: false,
    emptyStateText: 'Δεν έχουν οριστεί social media',
    addButtonText: 'Προσθήκη Social Media'
  }
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function UniversalCommunicationManager({
  config,
  items = [],
  disabled = false,
  onChange
}: UniversalCommunicationManagerProps) {

  // 🎯 RESPONSIVE STATE για desktop detection
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkIsDesktop = () => setIsDesktop(window.innerWidth >= 768);
    checkIsDesktop();
    window.addEventListener('resize', checkIsDesktop);
    return () => window.removeEventListener('resize', checkIsDesktop);
  }, []);

  // ============================================================================
  // CRUD OPERATIONS
  // ============================================================================

  const addItem = useCallback(() => {
    const newItem: CommunicationItem = {
      type: config.defaultType,
      label: '',
      ...(config.supportsPrimary && { isPrimary: items.length === 0 }),

      // Type-specific defaults
      ...(config.type === 'phone' && {
        number: '',
        countryCode: '+30'
      }),
      ...(config.type === 'email' && {
        email: ''
      }),
      ...(config.type === 'website' && {
        url: ''
      }),
      ...(config.type === 'social' && {
        username: '',
        url: '',
        platform: config.platformTypes?.[0]?.value || 'linkedin' // Πρώτη διαθέσιμη πλατφόρμα
      })
    };

    onChange([...items, newItem]);
  }, [items, config, onChange]);

  const updateItem = useCallback((index: number, field: string, value: any) => {
    const updated = items.map((item, i) => {
      if (i !== index) return item;

      const updatedItem = { ...item, [field]: value };

      // Auto-generate URL για social media
      if (config.type === 'social' && (field === 'username' || field === 'platform')) {
        const username = field === 'username' ? value : item.username;
        const platform = field === 'platform' ? value : (item.platform || item.type);
        updatedItem.url = generateSocialUrl(platform, username);
      }

      return updatedItem;
    });

    onChange(updated);
  }, [items, config.type, onChange]);

  const removeItem = useCallback((index: number) => {
    const updated = items.filter((_, i) => i !== index);

    // Handle primary reassignment για phones & emails
    if (config.supportsPrimary && items[index]?.isPrimary && updated.length > 0) {
      updated[0] = { ...updated[0], isPrimary: true };
    }

    onChange(updated);
  }, [items, config.supportsPrimary, onChange]);

  const setPrimary = useCallback((index: number) => {
    if (!config.supportsPrimary) return;

    const updated = items.map((item, i) => ({
      ...item,
      isPrimary: i === index
    }));
    onChange(updated);
  }, [items, config.supportsPrimary, onChange]);

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  const generateSocialUrl = (platform: string, username: string): string => {
    if (!username.trim()) return '';

    const templates: Record<string, string> = {
      linkedin: 'https://linkedin.com/in/{username}',
      facebook: 'https://facebook.com/{username}',
      instagram: 'https://instagram.com/{username}',
      twitter: 'https://x.com/{username}',
      youtube: 'https://youtube.com/@{username}',
      github: 'https://github.com/{username}',
      tiktok: 'https://tiktok.com/@{username}'
    };

    const template = templates[platform];
    return template ? template.replace('{username}', username.trim()) : '';
  };

  // ============================================================================
  // RENDER FUNCTIONS
  // ============================================================================

  const renderPhoneItemRow = (item: CommunicationItem, index: number, isDesktop: boolean) => {
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
              <SelectTrigger className="w-full">
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
              className="w-full"
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
              className="w-full"
            />
          </div>

          {/* 4. Ετικέτα */}
          <div>
            <Input
              value={item.label || ''}
              onChange={(e) => updateItem(index, 'label', e.target.value)}
              placeholder={config.labelPlaceholder}
              disabled={disabled}
              className="w-full"
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
                    className="cursor-pointer hover:opacity-80"
                    onClick={() => setPrimary(index)}
                  />
                )}
              </div>
            )}

            {/* Delete Button */}
            <Button
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

  const renderEmailItemRow = (item: CommunicationItem, index: number, isDesktop: boolean) => {
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
              <SelectTrigger className="w-full">
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
              className="w-full"
            />
          </div>

          {/* 3. Ετικέτα */}
          <div>
            <Input
              value={item.label || ''}
              onChange={(e) => updateItem(index, 'label', e.target.value)}
              placeholder={config.labelPlaceholder}
              disabled={disabled}
              className="w-full"
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

  const renderWebsiteItemRow = (item: CommunicationItem, index: number, isDesktop: boolean) => {
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
              <SelectTrigger className="w-full">
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
              className="w-full"
            />
          </div>

          {/* 3. Ετικέτα */}
          <div>
            <Input
              value={item.label || ''}
              onChange={(e) => updateItem(index, 'label', e.target.value)}
              placeholder={config.labelPlaceholder}
              disabled={disabled}
              className="w-full"
            />
          </div>

          {/* 4. Actions - Μόνο Κάδος (δεν υπάρχει Primary για websites) */}
          <div className="flex items-center justify-end gap-2">
            <Button
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

  const renderSocialItemRow = (item: CommunicationItem, index: number, isDesktop: boolean) => {
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
              <SelectTrigger className="w-full">
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
              <SelectTrigger className="w-full">
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
              className="w-full"
            />
          </div>

          {/* 4. Auto-generated URL */}
          <div>
            <Input
              value={item.url || ''}
              onChange={(e) => updateItem(index, 'url', e.target.value)}
              placeholder="https://..."
              disabled={disabled}
              className="w-full text-sm"
            />
          </div>

          {/* 5. Ετικέτα */}
          <div>
            <Input
              value={item.label || ''}
              onChange={(e) => updateItem(index, 'label', e.target.value)}
              placeholder={config.labelPlaceholder}
              disabled={disabled}
              className="w-full"
            />
          </div>

          {/* 6. Actions - Μόνο Κάδος (δεν υπάρχει Primary για social) */}
          <div className="flex items-center justify-end gap-2">
            <Button
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

  const renderItemFields = (item: CommunicationItem, index: number) => {
    // 🎯 Ειδικό grouped layout για όλους τους τύπους στον desktop
    if (isDesktop) {
      return null; // Handled in main render με grouped layout
    }

    // 🎯 Κανονικό layout για όλα τα άλλα (emails, websites, social)
    const IconComponent = config.icon;

    return (
      <div className="w-full max-w-none min-w-full space-y-4">
        {/* Primary Field */}
        <div className="w-full max-w-none min-w-full">
          <Label>{getPrimaryFieldLabel()}</Label>
          <div className="flex items-center gap-1">
            <IconComponent className="w-4 h-4 text-gray-500" />
            <Input
              type={getInputType()}
              value={item[config.fields.primary] || ''}
              onChange={(e) => updateItem(index, config.fields.primary, e.target.value)}
              placeholder={config.placeholder}
              disabled={disabled}
              className="flex-1"
            />
          </div>
        </div>

        {/* Secondary Field (για phones = countryCode, για social = platform) */}
        {config.fields.secondary && (
          <div className="w-full max-w-none min-w-full">
            <Label>{getSecondaryFieldLabel()}</Label>
            {config.type === 'phone' ? (
              <Input
                value={item[config.fields.secondary] || '+30'}
                onChange={(e) => updateItem(index, config.fields.secondary, e.target.value)}
                placeholder="+30"
                disabled={disabled}
                className="w-full"
              />
            ) : (
              <Select
                value={item[config.fields.secondary] || item.type || config.defaultType}
                onValueChange={(value) => updateItem(index, config.fields.secondary, value)}
                disabled={disabled}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* 🎯 Χρησιμοποιούμε platformTypes αν υπάρχει (για social media), αλλιώς types */}
                  {(config.platformTypes || config.types).map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {/* Type Field */}
        <div className="w-full max-w-none min-w-full">
          <Label>Τύπος</Label>
          <Select
            value={item.type}
            onValueChange={(value) => updateItem(index, 'type', value)}
            disabled={disabled}
          >
            <SelectTrigger className="w-full">
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

        {/* Auto-generated URL (για social media) */}
        {config.type === 'social' && (
          <div className="w-full max-w-none min-w-full">
            <Label>URL (Auto-generated)</Label>
            <Input
              value={item.url || ''}
              onChange={(e) => updateItem(index, 'url', e.target.value)}
              placeholder="https://..."
              disabled={disabled}
              className="w-full text-sm"
            />
          </div>
        )}

        {/* Label Field */}
        <div className="w-full max-w-none min-w-full">
          <Label>Ετικέτα</Label>
          <Input
            value={item.label || ''}
            onChange={(e) => updateItem(index, 'label', e.target.value)}
            placeholder={config.labelPlaceholder}
            disabled={disabled}
            className="w-full"
          />
        </div>
      </div>
    );
  };

  const getPrimaryFieldLabel = (): string => {
    switch (config.type) {
      case 'phone': return 'Αριθμός Τηλεφώνου';
      case 'email': return 'Διεύθυνση E-mail';
      case 'website': return 'URL';
      case 'social': return 'Username';
      default: return 'Τιμή';
    }
  };

  const getSecondaryFieldLabel = (): string => {
    switch (config.type) {
      case 'phone': return 'Κωδικός Χώρας';
      case 'social': return 'Πλατφόρμα';
      default: return '';
    }
  };

  const getInputType = (): string => {
    switch (config.type) {
      case 'email': return 'email';
      case 'website': return 'url';
      case 'phone': return 'tel';
      default: return 'text';
    }
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  const IconComponent = config.icon;

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <IconComponent className="h-4 w-4" />
        {config.title}
      </div>

      {/* 🎯 ΕΙΔΙΚΟ GROUPED LAYOUT ΓΙΑ ΤΗΛΕΦΩΝΑ ΣΤΟ DESKTOP */}
      {config.type === 'phone' && isDesktop && items.length > 0 ? (
        <div className="w-full max-w-none min-w-full border rounded-lg">
          {/* Header Row με τίτλους στηλών για τηλέφωνα */}
          <div className="grid grid-cols-5 gap-3 p-4 bg-gray-50 border-b font-medium text-sm text-gray-700">
            <div>Τύπος</div>
            <div>Κωδικός</div>
            <div>Αριθμός</div>
            <div>Ετικέτα</div>
            <div className="text-right">Ενέργειες</div>
          </div>

          {/* Phone Rows - Όλα τα τηλέφωνα σε γραμμές */}
          <div className="p-4 space-y-0">
            {items.map((item, index) => renderPhoneItemRow(item, index, isDesktop))}
          </div>
        </div>
      ) : config.type === 'email' && isDesktop && items.length > 0 ? (
        <div className="w-full max-w-none min-w-full border rounded-lg">
          {/* Header Row με τίτλους στηλών για emails */}
          <div className="grid grid-cols-4 gap-3 p-4 bg-gray-50 border-b font-medium text-sm text-gray-700">
            <div>Τύπος</div>
            <div>Διεύθυνση E-mail</div>
            <div>Ετικέτα</div>
            <div className="text-right">Ενέργειες</div>
          </div>

          {/* Email Rows - Όλα τα emails σε γραμμές */}
          <div className="p-4 space-y-0">
            {items.map((item, index) => renderEmailItemRow(item, index, isDesktop))}
          </div>
        </div>
      ) : config.type === 'website' && isDesktop ? (
        <div className="w-full max-w-none min-w-full border rounded-lg">
          {/* Header Row με τίτλους στηλών για websites */}
          <div className="grid grid-cols-4 gap-3 p-4 bg-gray-50 border-b font-medium text-sm text-gray-700">
            <div>Τύπος</div>
            <div>URL</div>
            <div>Ετικέτα</div>
            <div className="text-right">Ενέργειες</div>
          </div>

          {/* Website Rows - Όλες οι ιστοσελίδες σε γραμμές */}
          <div className="p-4 space-y-0">
            {items.map((item, index) => renderWebsiteItemRow(item, index, isDesktop))}
          </div>
        </div>
      ) : config.type === 'social' && isDesktop ? (
        <div className="w-full max-w-none min-w-full border rounded-lg">
          {/* Header Row με τίτλους στηλών για social media */}
          <div className="grid grid-cols-6 gap-3 p-4 bg-gray-50 border-b font-medium text-sm text-gray-700">
            <div>Τύπος</div>
            <div>Πλατφόρμα</div>
            <div>Username</div>
            <div>URL</div>
            <div>Ετικέτα</div>
            <div className="text-right">Ενέργειες</div>
          </div>

          {/* Social Media Rows - Όλα τα social media σε γραμμές */}
          <div className="p-4 space-y-0">
            {items.map((item, index) => renderSocialItemRow(item, index, isDesktop))}
          </div>
        </div>
      ) : (
        /* ΚΑΝΟΝΙΚΟ LAYOUT για όλα τα άλλα (emails, websites, social) και phones σε mobile */
        items.map((item, index) => (
          <div key={index} className="w-full max-w-none min-w-full p-4 border rounded-lg">
            {renderItemFields(item, index)}

            {/* Action buttons row - Μόνο για mobile layout (όταν ΔΕΝ είναι desktop) */}
            {!isDesktop && (
              <div className="flex items-center justify-between mt-4 pt-3 border-t">
                <div className="flex items-center gap-2">
                  {/* Primary Badge (μόνο για phones & emails) */}
                  {config.supportsPrimary && (
                    <div className="flex items-center gap-2">
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
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeItem(index)}
                  disabled={disabled}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        ))
      )}

      {/* Empty State */}
      {items.length === 0 && (
        <div className="text-center text-gray-500 py-8 border rounded-lg bg-gray-50/30">
          <IconComponent className="w-8 h-8 mb-2 mx-auto" />
          <p>{config.emptyStateText}</p>
          <p className="text-sm mt-1">Προσθέστε τις πληροφορίες επικοινωνίας σας</p>
        </div>
      )}

      {/* Add Button */}
      <Button
        variant="outline"
        onClick={addItem}
        disabled={disabled}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" />
        {config.addButtonText}
      </Button>
    </div>
  );
}

export default UniversalCommunicationManager;