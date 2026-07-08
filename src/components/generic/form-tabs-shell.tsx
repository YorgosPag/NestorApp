'use client';

/**
 * Form tab-shell primitives — SSoT (ADR-595).
 *
 * The three tabbed form renderers (`GenericFormTabRenderer`,
 * `ServiceFormTabRenderer`, `IndividualFormTabRenderer`) each re-implemented an
 * identical `<TabsOnlyTriggers>` + `TabsContent` main shell, the same
 * "dot → t() → last-segment fallback" i18n-key resolver, and (Generic/Service)
 * the same single-slot logo upload block. Those were the tab-family token
 * clones flagged by jscpd (CHECK 3.28).
 *
 * This module owns those uniform pieces once. Each renderer keeps its own
 * `createTabsFromConfig` (inner renderer + genuinely-divergent special sections
 * stay per-variant — no God-shell) and just renders through `<FormTabsShell>`.
 *
 * @module components/generic/form-tabs-shell
 * @see components/ui/navigation/state-tabs (StateTabs)
 */

import React from 'react';
import { StateTabs } from '@/components/ui/navigation/state-tabs';
import { TabsContent } from '@/components/ui/tabs';
import type { TabDefinition } from '@/components/ui/navigation/tabs-types';
import {
  MultiplePhotosUpload,
  type PhotoSlot,
} from '@/components/ui/MultiplePhotosUpload';
import type { ContactFormData } from '@/types/ContactFormTypes';

// ============================================================================
// TAB CUSTOM-RENDERER CONTRACTS (SSoT)
// ============================================================================

/** Loose field descriptor passed to tab-level field custom renderers. */
export interface TabCustomFieldData {
  name: string;
  type?: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  [key: string]: unknown;
}

/** Field-aware custom renderer used at the tab level. */
export type TabFieldCustomRenderer = (
  field: TabCustomFieldData,
  formData: ContactFormData,
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void,
  onSelectChange: (name: string, value: string) => void,
  disabled: boolean,
) => React.ReactNode;

/** Parameterless custom renderer for a whole special section. */
export type TabSectionCustomRenderer = () => React.ReactNode;

// ============================================================================
// I18N KEY RESOLVER
// ============================================================================

/**
 * Resolve a label that may be an i18n key. Keys are detected by containing a
 * '.' (e.g. `sections.basicInfoGemi`). If translation returns the key itself
 * (not found) the last path segment is used as a graceful fallback. Plain
 * strings pass through unchanged.
 */
export function resolveI18nKeyLabel(
  text: string | undefined,
  t: (key: string) => string,
): string {
  if (!text) return '';
  if (!text.includes('.')) return text;

  const translated = t(text);
  if (translated === text) {
    const parts = text.split('.');
    return parts[parts.length - 1];
  }
  return translated;
}

// ============================================================================
// TAB SHELL
// ============================================================================

export interface FormTabsShellProps {
  /** Fully-built tab descriptors (id / label / icon / content). */
  tabs: TabDefinition[];
  /** Initial active tab id (survives remounts via sessionStorage upstream). */
  initialTab?: string;
  /** Notified when the active tab changes (parent state management). */
  onActiveTabChange?: (tabId: string) => void;
  /** className applied to each `TabsContent` panel. */
  contentClassName?: string;
}

/**
 * Uniform tabbed-form shell: the `StateTabs` (fill-height) + per-tab `TabsContent`
 * wiring shared by every `*FormTabRenderer`.
 */
export function FormTabsShell({
  tabs,
  initialTab,
  onActiveTabChange,
  contentClassName = '',
}: FormTabsShellProps): React.ReactNode {
  return (
    <div className="w-full">
      <StateTabs
        tabs={tabs}
        defaultTab={initialTab || tabs[0]?.id || 'basicInfo'}
        theme="clean"
        onTabChange={onActiveTabChange}
        fillHeight
      >
        {tabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className={contentClassName}>
            {tab.content}
          </TabsContent>
        ))}
      </StateTabs>
    </div>
  );
}

// ============================================================================
// LOGO UPLOAD SECTION (single slot)
// ============================================================================

export interface FormLogoUploadSectionProps {
  /** Stable React key / upload key for the underlying uploader. */
  uploadKey: string;
  /** Current photo slots (0 or 1 for a logo). */
  photos: PhotoSlot[];
  onPhotosChange?: (photos: PhotoSlot[]) => void;
  disabled: boolean;
  /** Contact data forwarded to the FileNamingService. */
  contactData: ContactFormData;
  /** Keep the upload slot visible in read-only mode. */
  showPhotosWhenDisabled?: boolean;
}

/**
 * Single-slot logo upload block shared by the service/company tab renderers.
 */
export function FormLogoUploadSection({
  uploadKey,
  photos,
  onPhotosChange,
  disabled,
  contactData,
  showPhotosWhenDisabled,
}: FormLogoUploadSectionProps): React.ReactNode {
  return (
    <div className="flex flex-col items-center space-y-4 p-6 min-h-[360px]">
      <MultiplePhotosUpload
        key={uploadKey}
        photos={photos}
        maxPhotos={1}
        onPhotosChange={onPhotosChange}
        disabled={disabled}
        purpose="logo"
        contactData={contactData}
        compact
        showPhotosWhenDisabled={showPhotosWhenDisabled}
        className=""
      />
    </div>
  );
}
