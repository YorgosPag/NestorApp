import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ICU from 'i18next-icu';

import { createModuleLogger } from '@/lib/telemetry';
import { getNamespaceLoader, type TranslationData } from './namespace-loaders';

const logger = createModuleLogger('i18n-lazy-config');

/**
 * Lazy-loading i18n configuration
 * Loads translation files on demand for better performance
 */

// Available languages
export const SUPPORTED_LANGUAGES = ['el', 'en', 'pseudo'] as const;
export type Language = typeof SUPPORTED_LANGUAGES[number];

// Default language (SSoT)
export const DEFAULT_LANGUAGE: Language = 'el';

// Available namespaces
export const SUPPORTED_NAMESPACES = [
  'common',
  'common-actions',
  'common-navigation',
  'common-status',
  'common-validation',
  'common-empty-states',
  'filters',   // 🏢 ENTERPRISE: Generic filter labels (domain separation - ADR-032)
  'dxf-viewer',
  'geo-canvas', // Added geo-canvas namespace
  'forms',
  'toasts',
  'errors',
  'properties',
  'properties-detail',
  'properties-enums',
  'properties-viewer',
  'crm',
  'navigation',
  'auth',
  'dashboard',
  'projects',
  'obligations', // ?? Obligations module (obligations/new, live preview, PDF export)
  'toolbars',
  'compositions',
  'tasks',
  'users',
  'building',
  'contacts',
  'communications',
  'landing',
  'telegram',  // Telegram bot templates - PR1 centralization
  'files',     // File storage display names (ADR-031)
  'storage',   // 🏢 Storage management module
  'parking',   // 🏢 Parking management module - added 2026-01-24
  'admin',     // 🏢 Admin tools (units, claims repair)
  'tool-hints', // 🏢 DXF Viewer: Step-by-step tool hints (ADR-082)
  'accounting', // 🏢 Accounting subapp (invoices, journal, VAT, tax, assets, documents)
  'accounting-tax-offices', // 🏢 ΔΟΥ names + regions (DoyPicker component)
  'banking',    // 🏢 Banking module — bank accounts, IBAN, selectors (ADR-172)
  'addresses',  // 🏢 Shared address system — forms, cards, maps (ADR-172)
  'payments',   // 🏢 Payment plans, installments, loans, cheques, reports (ADR-234)
  'attendance', // 🏢 Worker attendance check-in/out (ADR-170)
  'legal',      // 🏢 Legal pages — privacy policy, terms, data deletion
  'reports',    // 🏢 Enterprise Reports System (ADR-265)
  'report-builder',         // 🏢 Dynamic Report Builder UI (ADR-268)
  'report-builder-domains', // 🏢 Report Builder domain/field labels (ADR-268)
  'cash-flow',              // 🏢 Cash Flow Forecast (ADR-268 Phase 8)
  'procurement',            // 🏢 Procurement / Purchase Orders
  'saved-reports',          // 🏢 Saved Reports management
  'building-storage',       // 🏢 Building storage/parking/spaces (split from building — ADR-280)
  'building-address',       // 🏢 Building address/associations/photos (split from building — ADR-280)
  'building-filters',       // 🏢 Building filters (split from building — ADR-280)
  'building-timeline',      // 🏢 Building timeline/analytics (split from building — ADR-280)
  'building-tabs',          // 🏢 Building tab content (split from building — ADR-280)
  'buildingCode',           // 🏢 Building Code Module — ΝΟΚ Phase 2 (ADR-186)
  'common-sales',           // 🏢 Sales/e-commerce domain (split from common — ADR-280)
  'common-account',         // 🏢 User account/2FA (split from common — ADR-280)
  'common-photos',          // 🏢 Photo management (split from common — ADR-280)
  'common-shared',          // 🏢 Shared UI: toolbar, filters, contacts, sharing (split from common — ADR-280)
  'dxf-viewer-shell',       // 🏢 DXF viewer chrome/toolbar (split from dxf-viewer — ADR-280)
  'dxf-schedule',           // 🏢 BIM schedule column headers + entity type labels (ADR-363 §6)
  'dxf-viewer-panels',      // 🏢 DXF viewer panels/layers (split from dxf-viewer — ADR-280)
  'dxf-viewer-settings',    // 🏢 DXF viewer settings (split from dxf-viewer — ADR-280)
  'dxf-viewer-wizard',      // 🏢 DXF viewer wizard/import (split from dxf-viewer — ADR-280)
  'dxf-viewer-guides',      // 🏢 DXF viewer guides/AI assistant (split from dxf-viewer — ADR-280)
  'contacts-core',          // 🏢 Contacts core UI (split from contacts — ADR-280)
  'contacts-form',          // 🏢 Contacts form/validation (split from contacts — ADR-280)
  'contacts-relationships', // 🏢 Contacts relationships/personas (split from contacts — ADR-280)
  'contacts-banking',       // 🏢 Contacts banking tab (split from contacts — ADR-280)
  'contacts-lifecycle',     // 🏢 Contacts trash/identity impact (split from contacts — ADR-280)
  'projects-data',          // 🏢 Projects data tabs (split from projects — ADR-280)
  'projects-ika',           // 🏢 Projects IKA labor compliance (split from projects — ADR-280)
  'payments-loans',         // 🏢 Loan tracking/cheques (split from payments — ADR-280)
  'payments-cost-calc',     // 🏢 Construction cost calculator (split from payments — ADR-280)
  'geo-canvas-drawing',     // 🏢 Geo-canvas drawing interfaces (split from geo-canvas — ADR-280)
  'crm-inbox',              // 🏢 CRM calendar/inbox (split from crm — ADR-280)
  'accounting-setup',       // 🏢 Accounting setup/reconciliation (split from accounting — ADR-280)
  'files-media',            // 🏢 Files floorplan/media/capture (split from files — ADR-280)
  'floorplan-overlays',     // 🏢 Multi-kind overlay roles + geometry labels (ADR-340 Phase 9)
  'navigation-entities',    // 🏢 Navigation entities/filters (split from navigation — ADR-280)
  'reports-extended',       // 🏢 Reports CRM/spaces (split from reports — ADR-280)
  'trash',                  // 🗑️ Centralized trash/soft-delete strings (ADR-281)
  'showcase',               // 🏢 Property showcase public page (ADR-312)
  'org-structure',          // 🏢 Tenant organisation structure / departments / routing (ADR-326)
  'quotes',                 // 🏢 Quotes & RFQ management (ADR-327)
  'vendor-portal',          // 🏢 Public vendor portal (ADR-327 §7)
  'onboarding',             // 🏢 New tenant onboarding wizard (ADR-326 Phase 8)
  'settings',               // 🏢 App settings pages (shortcuts, etc.)
  'textToolbar',            // 🏢 DXF text toolbar / Properties panel (ADR-344)
  'textFindReplace',        // 🏢 DXF text Find & Replace dialog (ADR-344 Phase 9)
  'bim3d',                  // 🏢 BIM 3D Viewer (ADR-366)
  'bim-3d-aria',            // 🏢 BIM 3D ARIA entity descriptions (ADR-366 Phase 8.1)
  'bim-materials',          // 🏢 BIM Material Library editor UI (ADR-363 Phase 6.5)
  'iso19650',               // 🏢 ISO 19650 metadata labels — discipline/series/CDE/suitability (ADR-373 Phase 2)
] as const;
export type Namespace = typeof SUPPORTED_NAMESPACES[number];

// Cache for loaded translations
const translationCache = new Map<string, TranslationData>();

/**
 * Dynamic translation loader — delegates to namespace-loaders.ts for webpack-compatible imports
 */
async function loadTranslations(language: Language, namespace: Namespace, forceReload = false): Promise<TranslationData> {
  const cacheKey = `${language}:${namespace}`;

  if (!forceReload && translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey) as TranslationData;
  }

  try {
    const loader = getNamespaceLoader(language, namespace);

    if (!loader) {
      if (language !== 'el') {
        return loadTranslations('el', namespace, forceReload);
      }
      logger.warn(`Namespace ${namespace} not found for language ${language}`);
      return {};
    }

    const translations = await loader();
    const data = translations.default || translations;
    if (!forceReload) {
      translationCache.set(cacheKey, data as TranslationData);
    }
    return data as TranslationData;
  } catch (error) {
    logger.warn(`Failed to load translations for ${language}:${namespace}`, { error });

    if (language !== 'el') {
      try {
        return await loadTranslations('el', namespace, forceReload);
      } catch (fallbackError) {
        logger.error(`Fallback failed for ${namespace}`, { error: fallbackError });
      }
    }

    return {};
  }
}


/**
 * Load namespace on demand
 */
export async function loadNamespace(namespace: Namespace, language?: Language, forceReload = false) {
  const currentLanguage = (language || i18n.language || 'el') as Language;
  
  // Check if already loaded
  if (!forceReload && i18n.hasResourceBundle(currentLanguage, namespace)) {
    return;
  }
  
  const translations = await loadTranslations(currentLanguage, namespace, forceReload);
  
  // Add to i18n instance
  i18n.addResourceBundle(currentLanguage, namespace, translations, true, true);
  
  // console.log(`✅ Loaded namespace: ${namespace} for language: ${currentLanguage}`);
}

/**
 * 🏢 SSoT — namespaces loaded eagerly at app boot (SAP/Salesforce pattern).
 *
 * ⚠️ THIS IS THE ONLY LIST. `config.ts` (boot preload) and
 * {@link preloadCriticalNamespaces} (language switch) both read it. Until
 * 2026-07-25 the two kept **separate** literal arrays which had silently
 * diverged by 5 entries — `admin`/`procurement`/`settings` were missing from
 * the language-switch path, so those surfaces fell back to raw keys after a
 * language change. Never reintroduce a second array. (ADR-547 Boy-Scout flag.)
 *
 * ## Admission rule (ADR-279 §9 — raw keys must never reach the user)
 *
 * A namespace belongs here when its strings can appear inside a surface that is
 * **already mounted** — a tab, card, or dialog reached without a route change.
 * Those renders have no loading boundary, so a lazy fetch paints the raw key
 * (`locations.newAddress`) for one frame. Gating the render instead is
 * forbidden: `if (!isNamespaceReady) return …` trades the key flash for a blank
 * flash on every remount and is blocked by CHECK 3.25 (ADR-267/ADR-300).
 *
 * A namespace scoped to its own route stays lazy — route transitions carry
 * their own loading state, and eager-loading all 94 would defeat code
 * splitting.
 */
export const CRITICAL_NAMESPACES: readonly Namespace[] = [
  // Shared UI shell — every screen renders these
  'common',
  'common-sales',
  'common-account',
  'common-photos',
  'common-shared',
  'filters',
  'errors',
  'toasts',
  'auth',
  'forms',
  'navigation',
  'navigation-entities',
  'settings',
  'admin',
  'toolbars',           // ⬅️ 2026-07-25: ActionButtons/ToolbarButtons — shared UI primitives
  'trash',              // ⬅️ 2026-07-25: soft-delete dialogs on projects/storage/parking (ADR-281)

  // Buildings
  'building',
  'building-storage',
  'building-address',
  'building-filters',
  'building-timeline',
  'building-tabs',
  'buildingCode',
  'showcase',           // ⬅️ 2026-07-25: BuildingDetailsHeader action + storage/parking details

  // Projects & obligations
  'projects',
  'projects-data',
  'projects-ika',
  'obligations',

  // Contacts
  'contacts',
  'contacts-core',
  'contacts-form',
  'contacts-relationships',
  'contacts-banking',
  'contacts-lifecycle',
  'communications',
  'banking',            // ⬅️ 2026-07-25: ContactBankingTab + sales payment dialogs

  // Properties & spaces
  'properties',
  'properties-detail',
  'properties-enums',
  'properties-viewer',
  'storage',
  'parking',
  'addresses',          // ⬅️ 2026-07-25: address cards/editor embedded in contacts, projects, buildings, POs

  // DXF viewer + BIM
  'dxf-viewer',
  'dxf-viewer-shell',
  'dxf-viewer-panels',
  'dxf-viewer-settings',
  'dxf-viewer-wizard',
  'dxf-viewer-guides',
  'dxf-schedule',       // 🏢 BIM schedule headers + entity labels (ADR-363 §6)
  'tool-hints',         // 🏢 DXF step-by-step tool hints (ADR-082)
  'bim3d',
  'bim-3d-aria',
  'bim-materials',
  'textToolbar',
  'textFindReplace',
  'geo-canvas',
  'geo-canvas-drawing',

  // Files
  'files',
  'files-media',

  // Accounting & payments
  'accounting',
  'accounting-setup',
  'accounting-tax-offices',
  'payments',
  'payments-loans',
  'payments-cost-calc',

  // CRM & reports
  'crm',
  'crm-inbox',
  'reports',
  'reports-extended',

  // Procurement
  'procurement',
  'quotes',             // ⬅️ 2026-07-25: ContactQuotesSection/RfqInvites — tabs inside the contact card
];

/**
 * Preload critical namespaces
 * 🏢 ENTERPRISE: These namespaces are loaded at app startup for instant availability
 */
export async function preloadCriticalNamespaces(language: Language = 'el') {
  await Promise.all(
    CRITICAL_NAMESPACES.map(namespace => loadNamespace(namespace, language))
  );
}

/**
 * Change language with automatic namespace loading
 */
export async function changeLanguage(language: Language) {
  // Load critical namespaces for new language
  await preloadCriticalNamespaces(language);
  
  // Change language
  await i18n.changeLanguage(language);
  
  // console.log(`🌍 Language changed to: ${language}`);
}


export default i18n;

