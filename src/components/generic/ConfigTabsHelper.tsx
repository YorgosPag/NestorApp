'use client';

import React from 'react';
import { Info, FileText, Users, History } from 'lucide-react';
import type { SectionConfig } from '@/config/company-gemi-config';
import { GenericTabRenderer } from './GenericTabRenderer';

// ============================================================================
// ICON MAPPING
// ============================================================================

/**
 * Maps emoji icons to Lucide components
 */
const ICON_MAPPING = {
  '🏢': Info,
  '📋': FileText,
  '💰': FileText,
  '📅': History,
  'ℹ️': Info,
  '👥': Users,
  '📄': FileText,
  '🗂️': FileText,
} as const;

/**
 * Gets the appropriate Lucide icon component for an emoji
 */
export function getIconComponent(emoji: string) {
  return ICON_MAPPING[emoji as keyof typeof ICON_MAPPING] || Info;
}

// ============================================================================
// TAB CREATION HELPER
// ============================================================================

export interface TabConfig {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  content: React.ReactNode;
}

/**
 * Creates tab configuration objects from GEMI config sections
 *
 * @example
 * ```tsx
 * import { getSortedSections } from '@/config/company-gemi-config';
 * import { createTabsFromConfig } from '@/components/generic/ConfigTabsHelper';
 *
 * function ContactDetails({ contact }) {
 *   const sections = getSortedSections();
 *   const tabs = contact.type === 'company'
 *     ? createTabsFromConfig(sections, contact)
 *     : [...individualTabs];
 *
 *   return <TabsComponent tabs={tabs} />;
 * }
 * ```
 */
export function createTabsFromConfig(
  sections: SectionConfig[],
  data: Record<string, any>,
  customRenderers?: Record<string, any>,
  valueFormatters?: Record<string, any>
): TabConfig[] {
  return sections.map(section => ({
    id: section.id,
    label: section.title,
    icon: getIconComponent(section.icon),
    content: (
      <GenericTabRenderer
        section={section}
        data={data}
        mode="display"
        customRenderers={customRenderers}
        valueFormatters={valueFormatters}
      />
    ),
  }));
}

/**
 * Creates a single tab from a section config
 */
export function createTabFromSection(
  section: SectionConfig,
  data: Record<string, any>,
  customRenderers?: Record<string, any>,
  valueFormatters?: Record<string, any>
): TabConfig {
  return {
    id: section.id,
    label: section.title,
    icon: getIconComponent(section.icon),
    content: (
      <GenericTabRenderer
        section={section}
        data={data}
        mode="display"
        customRenderers={customRenderers}
        valueFormatters={valueFormatters}
      />
    ),
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  createTabsFromConfig,
  createTabFromSection,
  getIconComponent,
};