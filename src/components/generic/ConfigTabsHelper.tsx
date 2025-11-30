'use client';

import React from 'react';
import { Info, FileText, Users, History, User, CreditCard, Briefcase, Phone, MapPin, Gavel, UserCheck, Megaphone, Activity, DollarSign, Calendar, Construction, Building, Car, Landmark, Map, Settings, Home, Camera, Video, Clock, TrendingUp, Package, Ruler, BarChart, Target, MessageCircle, Cake, Globe, Badge, Clipboard, Hash, Wrench, Factory, Smartphone, Shield, ClipboardList, Image, Mail, Lock, AlertTriangle, CheckCircle, XCircle, Star, Search, Edit, Save, Upload, Download } from 'lucide-react';
import type { SectionConfig } from '@/config/company-gemi-config';
import type { IndividualSectionConfig } from '@/config/individual-config';
import type { ServiceSectionConfig } from '@/config/service-config';
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
  'handshake': UserCheck,
  'target': Target,
  'message-circle': MessageCircle,
  // Individual config icons
  'user-check': UserCheck,
  'cake': Cake,
  'globe': Globe,
  'badge': Badge,
  'clipboard': Clipboard,
  'hash': Hash,
  'wrench': Wrench,
  'factory': Factory,
  'smartphone': Smartphone,
  // Service config icons
  'shield': Shield,
  'clipboard-list': ClipboardList,
  'image': Image,
  // Common utility icons
  'mail': Mail,
  'lock': Lock,
  'alert-triangle': AlertTriangle,
  'check-circle': CheckCircle,
  'x-circle': XCircle,
  'star': Star,
  'search': Search,
  'edit': Edit,
  'save': Save,
  'upload': Upload,
  'download': Download,
  // All emoji have been replaced with Lucide icon names
  // No backward compatibility needed since all configs use Lucide names now
} as const;

/**
 * Gets the appropriate Lucide icon component for an icon name or emoji
 */
export function getIconComponent(iconName: string) {
  const iconComponent = ICON_MAPPING[iconName as keyof typeof ICON_MAPPING];
  if (iconComponent) {
    return iconComponent;
  }

  // If not found, return Info as fallback
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
 * Creates tab configuration objects from Service config sections
 */
export function createServiceTabsFromConfig(
  sections: ServiceSectionConfig[],
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