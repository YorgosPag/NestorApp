import { SectionCategory, ObligationStatus } from '@/types/obligations';
import { designTokens } from '@/styles/design-tokens';

// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
export const SECTION_CATEGORIES: Record<SectionCategory, {
  label: string;
  color: string;
  icon: string;
  description: string;
}> = {
  general: {
    label: 'obligations.categories.general',
    color: designTokens.colors.gray['500'],
    icon: 'FileText',
    description: 'obligations.categories.generalDescription'
  },
  construction: {
    label: 'obligations.categories.construction',
    color: designTokens.colors.red['600'],
    icon: 'Hammer',
    description: 'obligations.categories.constructionDescription'
  },
  materials: {
    label: 'obligations.categories.materials',
    color: designTokens.colors.green['600'],
    icon: 'Package',
    description: 'obligations.categories.materialsDescription'
  },
  systems: {
    label: 'obligations.categories.systems',
    color: designTokens.colors.orange['900'],
    icon: 'Settings',
    description: 'obligations.categories.systemsDescription'
  },
  finishes: {
    label: 'obligations.categories.finishes',
    color: designTokens.colors.purple['600'],
    icon: 'Palette',
    description: 'obligations.categories.finishesDescription'
  },
  installations: {
    label: 'obligations.categories.installations',
    color: designTokens.colors.red['700'],
    icon: 'Zap',
    description: 'obligations.categories.installationsDescription'
  },
  safety: {
    label: 'obligations.categories.safety',
    color: designTokens.colors.red['600'],
    icon: 'Shield',
    description: 'obligations.categories.safetyDescription'
  },
  environment: {
    label: 'obligations.categories.environment',
    color: designTokens.colors.green['600'],
    icon: 'Leaf',
    description: 'obligations.categories.environmentDescription'
  }
};

import { QUALITY_THRESHOLD, PROGRESS_THRESHOLDS } from '@/core/configuration/business-rules';

export { QUALITY_THRESHOLD, PROGRESS_THRESHOLDS };

// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
export const DEFAULT_SECTION_TEMPLATES = {
  general: {
    title: 'obligations.templates.general.title',
    content: 'obligations.templates.general.content'
  },
  construction: {
    title: 'obligations.templates.construction.title',
    content: 'obligations.templates.construction.content'
  },
  materials: {
    title: 'obligations.templates.materials.title',
    content: 'obligations.templates.materials.content'
  },
  systems: {
    title: 'obligations.templates.systems.title',
    content: 'obligations.templates.systems.content'
  },
  finishes: {
    title: 'obligations.templates.finishes.title',
    content: 'obligations.templates.finishes.content'
  },
  installations: {
    title: 'obligations.templates.installations.title',
    content: 'obligations.templates.installations.content'
  },
  safety: {
    title: 'obligations.templates.safety.title',
    content: 'obligations.templates.safety.content'
  },
  environment: {
    title: 'obligations.templates.environment.title',
    content: 'obligations.templates.environment.content'
  }
} as const;

export function getCategoryLabel(category: SectionCategory): string {
  return SECTION_CATEGORIES[category]?.label || category;
}

export function getCategoryColor(category: SectionCategory): string {
  return SECTION_CATEGORIES[category]?.color || designTokens.colors.gray['500'];
}

export function getCategoryIcon(category: SectionCategory): string {
  return SECTION_CATEGORIES[category]?.icon || 'FileText';
}

export function getCategoryDescription(category: SectionCategory): string {
  return SECTION_CATEGORIES[category]?.description || '';
}

export function getDefaultTemplate(category: SectionCategory) {
  return DEFAULT_SECTION_TEMPLATES[category] || DEFAULT_SECTION_TEMPLATES.general;
}
