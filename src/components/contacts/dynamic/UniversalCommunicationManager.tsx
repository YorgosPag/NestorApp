'use client';

import React, { useCallback, useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { CommonBadge } from '@/core/badges';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';

// ============================================================================
// 🏢 ENTERPRISE IMPORTS - ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΑ SYSTEMS
// ============================================================================

// Import centralized types και configurations από το νέο modular system
import {
  COMMUNICATION_CONFIGS,
  COMMUNICATION_STYLES,
  type CommunicationType,
  type CommunicationItem,
  type CommunicationConfig,
  type CommunicationFieldValue, // 🏢 ENTERPRISE: Type-safe field values
  type TypeOption,
  type UniversalCommunicationManagerProps,
  PhoneRenderer,
  EmailRenderer,
  WebsiteRenderer,
  SocialRenderer,
  generateSocialUrl,
  getPrimaryFieldLabel,
  getSecondaryFieldLabel,
  getInputType
} from './communication';

// ============================================================================
// 🏢 ENTERPRISE UNIVERSAL COMMUNICATION MANAGER - REFACTORED
// ============================================================================

/**
 * 🚀 ENTERPRISE ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΟΣ COMMUNICATION MANAGER
 *
 * ✅ REFACTORED: Types & Configs κεντρικοποιήθηκαν στο ./communication/ module
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
// 🏢 ENTERPRISE UNIVERSAL COMMUNICATION MANAGER
// ============================================================================

export function UniversalCommunicationManager({
  config,
  items = [],
  disabled = false,
  onChange
}: UniversalCommunicationManagerProps) {
  const iconSizes = useIconSizes();

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

  const updateItem = useCallback((index: number, field: string, value: CommunicationFieldValue) => {
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
  // 🏢 ENTERPRISE CENTRALIZED UTILITIES
  // ============================================================================

  // 🎯 Όλες οι helper functions έχουν κεντρικοποιηθεί στο ./communication/utils/
  // - generateSocialUrl στο socialUrlGenerator.ts
  // - getPrimaryFieldLabel, getSecondaryFieldLabel, getInputType στο fieldLabelUtils.ts
  //
  // Αυτό επιτρέπει:
  // ✅ Reusability across components
  // ✅ Centralized business logic
  // ✅ Easy testing και maintenance
  // ✅ Single source of truth

  // ============================================================================
  // ΕΝΤΕΡΠΡΑΙΣ RENDERERS ΓΙΑ DESKTOP TABLE LAYOUTS
  // ============================================================================

  // 🏢 Οι render functions έχουν εξαχθεί σε ξεχωριστά enterprise renderer components:
  // - PhoneRenderer για phone communications
  // - EmailRenderer για email communications
  // - WebsiteRenderer για website communications
  // - SocialRenderer για social media communications
  //
  // Αυτό επιτρέπει:
  // ✅ Better separation of concerns
  // ✅ Easier testing και maintenance
  // ✅ Reusable components across the app
  // ✅ Cleaner, more modular architecture

  const renderItemFields = (item: CommunicationItem, index: number) => {
    // 🎯 Ειδικό grouped layout για όλους τους τύπους στον desktop
    if (isDesktop) {
      return null; // Handled in main render με grouped layout
    }

    // 🎯 Κανονικό layout για όλα τα άλλα (emails, websites, social)
    const IconComponent = config.icon;

    return (
      <fieldset className="w-full max-w-none min-w-full space-y-4" aria-label={`${config.title} details`}>
        {/* Primary Field */}
        <div className="w-full max-w-none min-w-full">
          <Label>{getPrimaryFieldLabel(config.type)}</Label>
          <div className="flex items-center gap-1">
            <IconComponent className={`${iconSizes.sm} text-gray-500`} />
            <Input
              type={getInputType(config.type)}
              value={item[config.fields.primary] || ''}
              onChange={(e) => updateItem(index, config.fields.primary, e.target.value)}
              placeholder={config.placeholder}
              disabled={disabled}
              className={`flex-1 ${COMMUNICATION_STYLES.groupedTable.input}`}
            />
          </div>
        </div>

        {/* Secondary Field (για phones = countryCode, για social = platform) */}
        {config.fields.secondary && (
          <div className="w-full max-w-none min-w-full">
            <Label>{getSecondaryFieldLabel(config.type)}</Label>
            {config.type === 'phone' ? (
              <Input
                value={item[config.fields.secondary] || '+30'}
                onChange={(e) => updateItem(index, config.fields.secondary, e.target.value)}
                placeholder="+30"
                disabled={disabled}
                className={`w-full ${COMMUNICATION_STYLES.groupedTable.input}`}
              />
            ) : (
              <Select
                value={item[config.fields.secondary] || item.type || config.defaultType}
                onValueChange={(value) => updateItem(index, config.fields.secondary, value)}
                disabled={disabled}
              >
                <SelectTrigger className={`w-full ${COMMUNICATION_STYLES.groupedTable.input}`}>
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

        {/* Auto-generated URL (για social media) */}
        {config.type === 'social' && (
          <div className="w-full max-w-none min-w-full">
            <Label>URL (Auto-generated)</Label>
            <Input
              value={item.url || ''}
              onChange={(e) => updateItem(index, 'url', e.target.value)}
              placeholder="https://..."
              disabled={disabled}
              className={`w-full text-sm ${COMMUNICATION_STYLES.groupedTable.input}`}
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
            className={`w-full ${COMMUNICATION_STYLES.groupedTable.input}`}
          />
        </div>
      </fieldset>
    );
  };


  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  const IconComponent = config.icon;

  return (
    <section className="w-full max-w-none min-w-full space-y-4" aria-labelledby="comm-manager-title">
      {/* Header */}
      <header className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <IconComponent className={iconSizes.sm} />
        <h3 id="comm-manager-title">{config.title}</h3>
      </header>

      {/* 🎯 ΕΙΔΙΚΟ GROUPED LAYOUT ΓΙΑ ΤΗΛΕΦΩΝΑ ΣΤΟ DESKTOP */}
      {config.type === 'phone' && isDesktop && items.length > 0 ? (
        <section className="w-full max-w-none min-w-full border rounded-lg" aria-label="Phone communications table">
          {/* Header Row με τίτλους στηλών για τηλέφωνα */}
          <header className="grid grid-cols-5 gap-3 p-4 bg-muted border-b font-medium text-sm text-muted-foreground" role="columnheader">
            <div>Τύπος</div>
            <div>Κωδικός</div>
            <div>Αριθμός</div>
            <div>Ετικέτα</div>
            <div className="text-right">Ενέργειες</div>
          </header>

          {/* Phone Rows - Όλα τα τηλέφωνα σε γραμμές */}
          <main className="p-4 space-y-0" role="grid">
            {items.map((item, index) =>
              <PhoneRenderer
                key={index}
                item={item}
                index={index}
                isDesktop={isDesktop}
                config={config}
                disabled={disabled}
                updateItem={updateItem}
                setPrimary={setPrimary}
                removeItem={removeItem}
              />
            )}
          </main>
        </section>
      ) : config.type === 'email' && isDesktop && items.length > 0 ? (
        <section className="w-full max-w-none min-w-full border rounded-lg" aria-label="Email communications table">
          {/* Header Row με τίτλους στηλών για emails */}
          <header className="grid grid-cols-4 gap-3 p-4 bg-muted border-b font-medium text-sm text-muted-foreground" role="columnheader">
            <div>Τύπος</div>
            <div>Διεύθυνση E-mail</div>
            <div>Ετικέτα</div>
            <div className="text-right">Ενέργειες</div>
          </header>

          {/* Email Rows - Όλα τα emails σε γραμμές */}
          <main className="p-4 space-y-0" role="grid">
            {items.map((item, index) =>
              <EmailRenderer
                key={index}
                item={item}
                index={index}
                isDesktop={isDesktop}
                config={config}
                disabled={disabled}
                updateItem={updateItem}
                setPrimary={setPrimary}
                removeItem={removeItem}
              />
            )}
          </main>
        </section>
      ) : config.type === 'website' && isDesktop ? (
        <section className="w-full max-w-none min-w-full border rounded-lg" aria-label="Website communications table">
          {/* Header Row με τίτλους στηλών για websites */}
          <header className="grid grid-cols-4 gap-3 p-4 bg-muted border-b font-medium text-sm text-muted-foreground" role="columnheader">
            <div>Τύπος</div>
            <div>URL</div>
            <div>Ετικέτα</div>
            <div className="text-right">Ενέργειες</div>
          </header>

          {/* Website Rows - Όλες οι ιστοσελίδες σε γραμμές */}
          <main className="p-4 space-y-0" role="grid">
            {items.map((item, index) =>
              <WebsiteRenderer
                key={index}
                item={item}
                index={index}
                isDesktop={isDesktop}
                config={config}
                disabled={disabled}
                updateItem={updateItem}
                removeItem={removeItem}
              />
            )}
          </main>
        </section>
      ) : config.type === 'social' && isDesktop ? (
        <section className="w-full max-w-none min-w-full border rounded-lg" aria-label="Social media communications table">
          {/* Header Row με τίτλους στηλών για social media */}
          <header className="grid grid-cols-6 gap-3 p-4 bg-muted border-b font-medium text-sm text-muted-foreground" role="columnheader">
            <div>Τύπος</div>
            <div>Πλατφόρμα</div>
            <div>Username</div>
            <div>URL</div>
            <div>Ετικέτα</div>
            <div className="text-right">Ενέργειες</div>
          </header>

          {/* Social Media Rows - Όλα τα social media σε γραμμές */}
          <main className="p-4 space-y-0" role="grid">
            {items.map((item, index) =>
              <SocialRenderer
                key={index}
                item={item}
                index={index}
                isDesktop={isDesktop}
                config={config}
                disabled={disabled}
                updateItem={updateItem}
                removeItem={removeItem}
              />
            )}
          </main>
        </section>
      ) : (
        /* ΚΑΝΟΝΙΚΟ LAYOUT για όλα τα άλλα (emails, websites, social) και phones σε mobile */
        items.map((item, index) => (
          <article key={index} className="w-full max-w-none min-w-full p-4 border rounded-lg" aria-label={`${config.title} item ${index + 1}`}>
            {renderItemFields(item, index)}

            {/* Action buttons row - Μόνο για mobile layout (όταν ΔΕΝ είναι desktop) */}
            {!isDesktop && (
              <footer className="flex items-center justify-between mt-4 pt-3 border-t" role="toolbar" aria-label="Item actions">
                <div className="flex items-center gap-2">
                  {/* Primary Badge (μόνο για phones & emails) */}
                  {config.supportsPrimary && (
                    <>
                      {item.isPrimary ? (
                        <CommonBadge status="primary" size="sm" />
                      ) : (
                        <CommonBadge
                          status="secondary"
                          size="sm"
                          className={`cursor-pointer ${INTERACTIVE_PATTERNS.FADE_HOVER}`}
                          onClick={() => setPrimary(index)}
                        />
                      )}
                    </>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeItem(index)}
                  disabled={disabled}
                  className={`text-red-600 ${INTERACTIVE_PATTERNS.TEXT_DESTRUCTIVE}`}
                >
                  <Trash2 className={iconSizes.sm} />
                </Button>
              </footer>
            )}
          </article>
        ))
      )}

      {/* Empty State */}
      {items.length === 0 && (
        <section className={COMMUNICATION_STYLES.groupedTable.emptyState} aria-label="Empty state" role="status">
          <IconComponent className={`${iconSizes.xl} mb-2 mx-auto`} />
          <p>{config.emptyStateText}</p>
          <p className="text-sm mt-1">Προσθέστε τις πληροφορίες επικοινωνίας σας</p>
        </section>
      )}

      {/* Add Button */}
      <Button
        type="button"
        variant="outline"
        onClick={addItem}
        disabled={disabled}
        className={`w-full ${COMMUNICATION_STYLES.groupedTable.input}`}
      >
        <Plus className={`${iconSizes.sm} mr-2`} />
        {config.addButtonText}
      </Button>
    </section>
  );
}

export default UniversalCommunicationManager;