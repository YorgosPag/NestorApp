import { SectionCategory, ObligationStatus } from '@/types/obligations';

export const SECTION_CATEGORIES: Record<SectionCategory, {
  label: string;
  color: string;
  icon: string;
  description: string;
}> = {
  general: {
    label: 'Γενικά',
    color: '#6B7280',
    icon: 'FileText',
    description: 'Γενικές πληροφορίες και όροι'
  },
  construction: {
    label: 'Κατασκευή',
    color: '#DC2626',
    icon: 'Hammer',
    description: 'Όροι και προδιαγραφές κατασκευής'
  },
  materials: {
    label: 'Υλικά',
    color: '#059669',
    icon: 'Package',
    description: 'Προδιαγραφές υλικών και ποιότητας'
  },
  systems: {
    label: 'Συστήματα',
    color: '#7C2D12',
    icon: 'Settings',
    description: 'Μηχανολογικά και ηλεκτρολογικά συστήματα'
  },
  finishes: {
    label: 'Φινιρίσματα',
    color: '#7C3AED',
    icon: 'Palette',
    description: 'Τελειώματα και εσωτερική διακόσμηση'
  },
  installations: {
    label: 'Εγκαταστάσεις',
    color: '#B91C1C',
    icon: 'Zap',
    description: 'Εγκαταστάσεις και δίκτυα'
  },
  safety: {
    label: 'Ασφάλεια',
    color: '#DC2626',
    icon: 'Shield',
    description: 'Όροι ασφαλείας και προστασίας'
  },
  environment: {
    label: 'Περιβάλλον',
    color: '#16A34A',
    icon: 'Leaf',
    description: 'Περιβαλλοντικοί όροι και βιωσιμότητα'
  }
};

import { QUALITY_THRESHOLD, PROGRESS_THRESHOLDS } from '@/core/configuration/business-rules';

export { QUALITY_THRESHOLD, PROGRESS_THRESHOLDS };

export const DEFAULT_SECTION_TEMPLATES = {
  general: {
    title: 'Γενικοί Όροι',
    content: 'Εισαγωγή γενικών όρων και προϋποθέσεων...'
  },
  construction: {
    title: 'Κατασκευαστικές Προδιαγραφές',
    content: 'Τεχνικές προδιαγραφές κατασκευής...'
  },
  materials: {
    title: 'Προδιαγραφές Υλικών',
    content: 'Ποιότητα και χαρακτηριστικά υλικών...'
  },
  systems: {
    title: 'Συστήματα & Εγκαταστάσεις',
    content: 'Μηχανολογικές και ηλεκτρολογικές εγκαταστάσεις...'
  },
  finishes: {
    title: 'Φινιρίσματα & Τελειώματα',
    content: 'Προδιαγραφές τελειωμάτων...'
  },
  installations: {
    title: 'Ειδικές Εγκαταστάσεις',
    content: 'Εγκαταστάσεις υγιεινής, κλιματισμού...'
  },
  safety: {
    title: 'Ασφάλεια & Προστασία',
    content: 'Μέτρα ασφαλείας και προστασίας...'
  },
  environment: {
    title: 'Περιβαλλοντικοί Όροι',
    content: 'Περιβαλλοντική συμμόρφωση...'
  }
} as const;

export function getCategoryLabel(category: SectionCategory): string {
  return SECTION_CATEGORIES[category]?.label || category;
}

export function getCategoryColor(category: SectionCategory): string {
  return SECTION_CATEGORIES[category]?.color || '#6B7280';
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