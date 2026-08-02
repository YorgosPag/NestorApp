'use client';

import {
  Library,
  Users,
  Briefcase,
  Building,
  Layout,
  DollarSign,
  AppWindow,
  Calculator,
  FolderTree,
  FileText,
  MapPin,
  Construction,
} from 'lucide-react';
import { useAuth } from '@/auth';
import { useTranslation } from '@/i18n';
import { filterTilesByJob } from '@/config/jobs-access';
import { useActiveJob } from '@/contexts/ActiveJobContext';
import { HiddenItemsBadge } from '@/components/job/HiddenItemsBadge';
import { DashboardWelcome } from './DashboardWelcome';
import { QuickActionsStrip } from './QuickActionsStrip';
import { NavigationGrid, type NavigationTile } from './NavigationGrid';
import { OnboardingBanner } from './OnboardingBanner';
import '@/lib/design-system';

// ============================================================================
// Dashboard Home — SAP Fiori-inspired Navigation Launchpad (ADR-179)
//
// Hybrid navigation: sidebar (always visible) + dashboard tile grid.
// Static cards — no Firestore queries. Phase 1 implementation.
// ============================================================================

function useMainMenuTiles(t: (key: string) => string): NavigationTile[] {
  return [
    {
      title: t('home.modules.properties.title'),
      description: t('home.modules.properties.description'),
      icon: Library,
      href: '/properties',
      colorVariant: 'blue',
    },
    {
      title: t('home.modules.contacts.title'),
      description: t('home.modules.contacts.description'),
      icon: Users,
      href: '/contacts',
      colorVariant: 'green',
    },
    {
      title: t('home.modules.projects.title'),
      description: t('home.modules.projects.description'),
      icon: Briefcase,
      href: '/projects',
      colorVariant: 'purple',
    },
    {
      title: t('home.modules.buildings.title'),
      description: t('home.modules.buildings.description'),
      icon: Building,
      href: '/buildings',
      colorVariant: 'orange',
    },
    {
      title: t('home.modules.spaces.title'),
      description: t('home.modules.spaces.description'),
      icon: Layout,
      href: '/spaces',
      colorVariant: 'teal',
      subItemCount: 4,
    },
    {
      title: t('home.modules.sales.title'),
      description: t('home.modules.sales.description'),
      icon: DollarSign,
      href: '/sales',
      colorVariant: 'yellow',
      subItemCount: 4,
    },
    {
      title: t('home.modules.crm.title'),
      description: t('home.modules.crm.description'),
      icon: AppWindow,
      href: '/crm',
      badge: 'PRO',
      colorVariant: 'indigo',
      subItemCount: 11,
    },
    {
      title: t('home.modules.accounting.title'),
      description: t('home.modules.accounting.description'),
      icon: Calculator,
      href: '/accounting',
      colorVariant: 'pink',
      subItemCount: 9,
    },
  ];
}

function useToolsTiles(t: (key: string) => string): NavigationTile[] {
  return [
    {
      title: t('home.modules.files.title'),
      description: t('home.modules.files.description'),
      icon: FolderTree,
      href: '/files',
      colorVariant: 'blue',
    },
    {
      title: t('home.modules.legal.title'),
      description: t('home.modules.legal.description'),
      icon: FileText,
      href: '/legal-documents',
      colorVariant: 'purple',
    },
    {
      title: t('home.modules.geoCanvas.title'),
      description: t('home.modules.geoCanvas.description'),
      icon: MapPin,
      href: '/geo/canvas',
      badge: 'ENTERPRISE',
      colorVariant: 'green',
    },
    {
      title: t('home.modules.dxfViewer.title'),
      description: t('home.modules.dxfViewer.description'),
      icon: Construction,
      href: '/dxf/viewer',
      colorVariant: 'orange',
    },
  ];
}

export function DashboardHome() {
  const { user } = useAuth();
  const { t } = useTranslation('dashboard');
  // ADR-748 Φάση 3 (§14.2): τα πλακίδια είναι πλέον **της ενεργής δουλειάς**.
  // Οι ορισμοί παραμένουν εδώ επίτηδες — το μητρώο απαντά *ποια* πλακίδια, όχι
  // *πώς* δείχνουν (εικονίδιο/χρώμα/περιγραφή). Δεύτερη λίστα εμφάνισης μέσα
  // στο μητρώο θα ήταν διπλότυπο που αποκλίνει.
  const { activeJob, resetToAll } = useActiveJob();

  const mainTiles = useMainMenuTiles(t);
  const toolsTiles = useToolsTiles(t);

  const main = filterTilesByJob(mainTiles, activeJob);
  const tools = filterTilesByJob(toolsTiles, activeJob);
  const hiddenCount = main.hiddenCount + tools.hiddenCount;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <DashboardWelcome displayName={user?.displayName ?? null} />
      <OnboardingBanner />
      <QuickActionsStrip />
      {/* Α-3 / NN/g: ο δείκτης στέκει **εκεί που λείπουν** τα πλακίδια — όχι
          μόνο στο header, όπου μετρά τα στοιχεία του sidebar. */}
      <HiddenItemsBadge count={hiddenCount} onRestore={resetToAll} className="mb-2 inline-block" />
      <NavigationGrid
        sectionLabel={t('home.sections.mainMenu')}
        tiles={[...main.visible]}
      />
      <NavigationGrid
        sectionLabel={t('home.sections.tools')}
        tiles={[...tools.visible]}
      />
    </main>
  );
}
