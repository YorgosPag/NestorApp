'use client';

import React from 'react';
import { Info, FileText, Users, History, User, CreditCard, Briefcase, Phone, MapPin, Gavel, UserCheck, Megaphone, Activity, DollarSign, Calendar, Construction, Building, Car, Landmark, Map, Settings, Home, Camera, Video, Clock, TrendingUp, Package, Ruler, BarChart, Handshake, Target, MessageCircle } from 'lucide-react';
import type { SectionConfig } from '@/config/company-gemi-config';
import type { IndividualSectionConfig } from '@/config/individual-config';
import { GenericTabRenderer } from './GenericTabRenderer';

// ============================================================================
// ICON MAPPING
// ============================================================================

/**
 * Maps emoji icons to Lucide components
 */
const ICON_MAPPING = {
  // Company GEMI icons - All using icon names now
  'info': Info,
  'file-text': FileText,
  'dollar-sign': DollarSign,
  'calendar': Calendar,
  // Individual contact icons - Converted to Lucide names
  'user': User,
  'credit-card': CreditCard,
  'briefcase': Briefcase,
  'phone': Phone,
  // GEMI categories - Using kebab-case naming
  'map-pin': MapPin,
  'users': Users,
  'gavel': Gavel,
  'history': History,
  'user-check': UserCheck,
  'megaphone': Megaphone,
  'activity': Activity,
  // Project/Building icons
  'construction': Construction,
  'building': Building,
  'car': Car,
  'landmark': Landmark,
  'map': Map,
  'settings': Settings,
  'home': Home,
  'camera': Camera,
  'video': Video,
  'clock': Clock,
  'trending-up': TrendingUp,
  'package': Package,
  'ruler': Ruler,
  'bar-chart': BarChart,
  'handshake': Handshake,
  'target': Target,
  'message-circle': MessageCircle,
  // Legacy emoji support (fallback) - Keep for backward compatibility
  '🏢': Building,
  '🏗️': Construction,
  '🅿️': Car,
  '🏛️': Landmark,
  '🗺️': Map,
  '⚙️': Settings,
  '🏠': Home,
  '📸': Camera,
  '🎬': Video,
  '🕐': Clock,
  '📈': TrendingUp,
  '📦': Package,
  '📐': Ruler,
  '📊': BarChart,
  '🤝': Handshake,
  '🎯': Target,
  '💬': MessageCircle,
  '📋': FileText,
  '💰': DollarSign,
  '📅': Calendar,
  'ℹ️': Info,
  '👥': Users,
  '📄': FileText,
  '🗂️': FileText,
  '👤': User,
  '💳': CreditCard,
  '💼': Briefcase,
  '📞': Phone,
} as const;

/**
 * Gets the appropriate Lucide icon component for an icon name or emoji
 */
export function getIconComponent(iconName: string) {
  const iconComponent = ICON_MAPPING[iconName as keyof typeof ICON_MAPPING];
  if (iconComponent) {
    return iconComponent;
  }

  // If not found, log for debugging and return Info as fallback
  console.warn(`Icon not found in mapping: "${iconName}". Available icons:`, Object.keys(ICON_MAPPING));
  return Info;
}

// ============================================================================
// TAB CREATION HELPER
// ============================================================================

export interface TabConfig {
  id: string;
  label: string;
  icon: React.ComponentType<any> | React.FC<any>;
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
 * Creates tab configuration objects from Individual config sections
 */
export function createIndividualTabsFromConfig(
  sections: IndividualSectionConfig[],
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