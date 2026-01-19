'use client';

import React from 'react';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from 'react-i18next';

// 🏢 ENTERPRISE: New modular hooks
import { useResponsiveLayout, useCommunicationOperations } from './hooks';

// 🏢 ENTERPRISE: New layout components
import {
  MobileCommunicationLayout,
  DesktopTableLayout,
  CommunicationEmptyState
} from './layouts';

// ============================================================================
// 🏢 ENTERPRISE IMPORTS - ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΑ SYSTEMS
// ============================================================================

// Import centralized types και configurations από το νέο modular system
import {
  type CommunicationItem,
  type CommunicationConfig,
  type UniversalCommunicationManagerProps
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
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('contacts');

  // 🏢 ENTERPRISE: Modular hooks (extracted)
  const { isDesktop } = useResponsiveLayout();
  const { addItem, updateItem, removeItem, setPrimary } = useCommunicationOperations({
    items,
    config,
    onChange
  });

  // ============================================================================
  // 🏢 ENTERPRISE CENTRALIZED UTILITIES
  // ============================================================================

  // 🎯 Utilities και business logic έχουν κεντρικοποιηθεί:
  // - CRUD operations → ./hooks/useCommunicationOperations.ts
  // - Responsive logic → ./hooks/useResponsiveLayout.ts
  // - Helper functions → ./communication/utils/
  //
  // Αυτό επιτρέπει:
  // ✅ Modular architecture με hooks pattern
  // ✅ Enhanced business logic validation
  // ✅ Performance optimization
  // ✅ Reusability και maintainability

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

  // ============================================================================
  // 🚀 ENTERPRISE REFACTOR: Mobile field rendering extracted to MobileCommunicationLayout
  // ============================================================================
  //
  // 🗑️ LEGACY CODE REMOVED: renderItemFields function (85 lines)
  // ✅ REPLACED BY: MobileCommunicationLayout component
  // 📍 LOCATION: ./layouts/MobileCommunicationLayout.tsx
  //
  // Benefits:
  // ✅ Semantic HTML (fieldset, no div soup)
  // ✅ Enhanced accessibility (ARIA labels)
  // ✅ Reusable across application
  // ✅ Better testing isolation
  // ✅ Single Responsibility Principle
  //
  // OLD FUNCTION: Lines 114-222 (85 lines) → EXTRACTED


  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  const IconComponent = config.icon;

  return (
    <section className="w-full max-w-none min-w-full space-y-4" aria-labelledby="comm-manager-title">
      {/* Header */}
      <header className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <IconComponent className={iconSizes.sm} />
        <h3 id="comm-manager-title">{t(config.title)}</h3>
      </header>

      {/* 🏢 ENTERPRISE: Conditional rendering με extracted layout components */}
      {isDesktop && items.length > 0 ? (
        // 🎯 DESKTOP: Table layout για όλους τους τύπους
        <DesktopTableLayout
          items={items}
          config={config}
          disabled={disabled}
          updateItem={updateItem}
          removeItem={removeItem}
          setPrimary={setPrimary}
        />
      ) : items.length > 0 ? (
        // 🎯 MOBILE: Card layout για όλους τους τύπους
        <MobileCommunicationLayout
          items={items}
          config={config}
          disabled={disabled}
          updateItem={updateItem}
          removeItem={removeItem}
          setPrimary={setPrimary}
        />
      ) : null}

      {/* 🏢 ENTERPRISE: Empty state και add button */}
      {items.length === 0 && (
        <CommunicationEmptyState
          config={config}
          disabled={disabled}
          onAddItem={addItem}
        />
      )}
    </section>
  );
}

export default UniversalCommunicationManager;