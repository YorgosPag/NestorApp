'use client';

/**
 * Η **ΜΙΑ** σελίδα-hub του procurement: χρώμιο + master-detail σώμα.
 *
 * Πέντε σελίδες (`agreements` · `materials` · `purchase-orders` · `quotes` ·
 * `vendors`) έγραφαν **ταυτόσημο** σκελετό: `PageContainer` με `ariaLabel` τον
 * τίτλο, `ProcurementSubNav` στο ίδιο wrapper, `PageHeader` με γράμμα προς γράμμα
 * ίδιο `variant`/`layout`/`spacing`/`actions`, προαιρετικό dashboard, και ένα
 * `ListContainer` με **desktop split** + **mobile λίστα** + **mobile slide-in**.
 * Διέφεραν μόνο σε εικονίδιο, κλειδιά i18n, στήλες και τα ίδια τα components
 * λίστας/λεπτομέρειας. Το CHECK 3.28 τα μετρούσε ως **τέσσερα ζεύγη κλώνων**.
 *
 * 🔴 **ΤΟ ΚΡΙΣΙΜΟ ΜΑΘΗΜΑ — Η ΠΡΩΤΗ ΕΚΔΟΧΗ ΜΕΤΑΚΙΝΗΣΕ ΤΟΝ ΚΛΩΝΟ ΣΤΑ PROPS.**
 * Εξήγαγα πρώτα μόνο το χρώμιο, με ξεχωριστά `viewMode` / `onViewModeChange` /
 * `showDashboard` / `onDashboardToggle`. Το jscpd ξαναχτύπησε **αμέσως**: τα
 * τέσσερα prop lines ήταν πλέον **ταυτόσημα σε πέντε σημεία κλήσης** — ο ίδιος
 * κλώνος, σε νέα διεύθυνση. Γι' αυτό το state ταξιδεύει ως **ΕΝΑ** αντικείμενο
 * ({@link ProcurementHubChrome}): είναι **μία** έννοια — «τι βλέπω και πώς» —
 * και ένα prop δεν μπορεί να ξαναγίνει τέσσερις πανομοιότυπες γραμμές.
 *
 * 🔑 **ΤΟ ΣΥΜΒΟΛΑΙΟ ΤΟΥ STATE ΕΙΝΑΙ ΔΑΝΕΙΚΟ, ΟΧΙ ΚΑΙΝΟΥΡΓΙΟ**: παράγεται με
 * `Pick` από το `ListPageHeaderProps` του `@/core/headers` (ADR-584), που ήδη
 * ονομάζει **ακριβώς** αυτά τα τέσσερα πεδία. Νέο ομώνυμο interface εδώ θα ήταν
 * δεύτερο λεξιλόγιο για την ίδια έννοια — το σχήμα του ADR-749.
 *
 * ⚠️ **Το `aria-label` ΔΕΝ είναι ξεχωριστό prop.** Και στις πέντε σελίδες ήταν
 * **η ίδια συμβολοσειρά** με τον τίτλο, σε **τρία** σημεία (container, desktop
 * section, mobile section). Ξεχωριστό prop θα τους επέτρεπε να αποκλίνουν
 * σιωπηλά — δηλαδή θα ξαναγεννούσε το πρόβλημα σε άλλη μορφή.
 *
 * ⚠️ **Το `list` αποδίδεται ΔΥΟ φορές** (desktop + mobile), όπως ακριβώς και πριν.
 * Είναι ασφαλές γιατί ένα React element είναι **αμετάβλητος περιγραφέας**, όχι
 * στιγμιότυπο· και οι δύο θέσεις έπαιρναν ήδη το **ίδιο** `{...listProps}`.
 *
 * ⚠️ **Ο τύπος των stats παράγεται** από το ίδιο το `UnifiedDashboard`
 * (`ComponentProps`), γιατί το `DashboardStat` δεν εξάγεται. Χειρόγραφο
 * αντίγραφο του σχήματος θα ήταν δεύτερη αλήθεια που αποκλίνει αθόρυβα.
 *
 * @module components/procurement/hub/ProcurementHubPage
 */

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { PageContainer, ListContainer, DetailsContainer } from '@/core/containers';
import { MobileDetailsSlideIn } from '@/core/layouts';
import {
  PageHeader,
  LIST_GRID_VIEW_MODES,
  type ListGridViewMode,
  type ListPageHeaderProps,
} from '@/core/headers';
import { ProcurementSubNav } from '@/subapps/procurement/components/ProcurementSubNav';
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';

type DashboardStats = React.ComponentProps<typeof UnifiedDashboard>['stats'];

/**
 * Η κατάσταση προβολής μιας σελίδας-hub — **ένα** αντικείμενο, όχι τέσσερα props.
 * Δανείζεται τα ονόματα από το SSoT των headers· βλ. κεφαλίδα του module.
 */
export type ProcurementHubChrome = Pick<
  ListPageHeaderProps<ListGridViewMode>,
  'viewMode' | 'setViewMode' | 'showDashboard' | 'setShowDashboard'
>;

/**
 * Η κατάσταση προβολής μιας σελίδας-hub, έτοιμη για το `chrome` prop.
 *
 * Και οι πέντε σελίδες έγραφαν **τις ίδιες δύο** `useState` γραμμές. Ο hook τις
 * κάνει μία και εγγυάται ότι το αρχικό view mode είναι το ίδιο παντού — αλλιώς
 * μια σελίδα θα μπορούσε να ξεκινά σε `grid` χωρίς κανείς να το αποφασίσει,
 * δηλαδή θα αποκλίνει η ίδια η προεπιλογή που κανείς δεν θυμάται να ελέγξει.
 */
export function useProcurementHubChrome(): ProcurementHubChrome {
  const [viewMode, setViewMode] = React.useState<ListGridViewMode>('list');
  const [showDashboard, setShowDashboard] = React.useState(false);
  return { viewMode, setViewMode, showDashboard, setShowDashboard };
}

export interface ProcurementHubPageProps {
  readonly icon: LucideIcon;
  /** Τίτλος **και** `aria-label` του container και των δύο sections. */
  readonly title: string;
  readonly subtitle: string;
  readonly chrome: ProcurementHubChrome;
  readonly dashboardStats: DashboardStats;
  readonly dashboardColumns: number;
  /** Το component λίστας — αποδίδεται σε desktop **και** mobile. */
  readonly list: React.ReactNode;
  /** Η λεπτομέρεια, ή `null` όταν δεν υπάρχει επιλογή. */
  readonly detail: React.ReactNode | null;
  readonly emptyState: {
    readonly icon: LucideIcon;
    readonly title: string;
    readonly description: string;
  };
  readonly onCreateAction?: () => void;
  readonly detailOpen: boolean;
  readonly detailTitle: string;
  readonly onDetailClose: () => void;
  /** Κουμπιά στην κεφαλίδα του mobile slide-in (π.χ. «επεξεργασία»). */
  readonly detailActions?: React.ReactNode;
  /** Διάλογοι και ό,τι άλλο ζει κάτω από το σώμα. */
  readonly children?: React.ReactNode;
}

export function ProcurementHubPage({
  icon,
  title,
  subtitle,
  chrome,
  dashboardStats,
  dashboardColumns,
  list,
  detail,
  emptyState,
  onCreateAction,
  detailOpen,
  detailTitle,
  onDetailClose,
  detailActions,
  children,
}: ProcurementHubPageProps) {
  const { viewMode, setViewMode, showDashboard, setShowDashboard } = chrome;

  return (
    <PageContainer ariaLabel={title}>
      <div className="px-2 mt-2">
        <ProcurementSubNav className="mb-0" />
      </div>

      <PageHeader
        variant="sticky-rounded"
        layout="compact"
        spacing="compact"
        title={{ icon, title, subtitle }}
        actions={{
          showDashboard,
          onDashboardToggle: () => setShowDashboard(!showDashboard),
          viewMode,
          onViewModeChange: setViewMode,
          viewModes: LIST_GRID_VIEW_MODES,
        }}
      />

      {showDashboard && (
        <section role="region" aria-label={title}>
          <UnifiedDashboard stats={dashboardStats} columns={dashboardColumns} />
        </section>
      )}

      <ListContainer>
        <>
          {/* ── Desktop: split λίστα + λεπτομέρεια ─────────────────────────── */}
          <section
            className="hidden md:flex flex-1 gap-2 min-h-0 min-w-0 overflow-hidden"
            aria-label={title}
          >
            {list}

            {detail ? (
              <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-card border rounded-lg shadow-sm p-4">
                {detail}
              </div>
            ) : (
              <DetailsContainer emptyStateProps={emptyState} onCreateAction={onCreateAction} />
            )}
          </section>

          {/* ── Mobile: λίστα, κρυφή όταν υπάρχει επιλογή ──────────────────── */}
          <section
            className={`md:hidden flex-1 min-h-0 overflow-hidden ${detailOpen ? 'hidden' : 'block'}`}
            aria-label={title}
          >
            {list}
          </section>

          {/* ── Mobile: slide-in λεπτομέρειας ──────────────────────────────── */}
          <MobileDetailsSlideIn
            isOpen={detailOpen}
            onClose={onDetailClose}
            title={detailTitle}
            actionButtons={detailActions}
          >
            {detail}
          </MobileDetailsSlideIn>
        </>
      </ListContainer>

      {children}
    </PageContainer>
  );
}
