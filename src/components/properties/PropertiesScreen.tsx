'use client';

/**
 * 🏢 Η ΜΙΑ ΟΘΟΝΗ ΑΚΙΝΗΤΩΝ του χώρου εργασίας — `/o/[workspace]/properties` (ADR-840 Σ3, Α1–Α5).
 *
 * Τρεις **φακοί** της ίδιας οθόνης (`?view=`): πλέγμα (κάρτες) · λίστα (κατάλογος + πλήρης επιθεωρητής) · κάτοψη.
 * Ένα σύνολο φίλτρων, μία επιλογή, ένα ταμπλό, ένας κάδος — όλα στη διεύθυνση ή σε μία μηχανή.
 *
 * Ως το Σ3 ήταν **δύο** σελίδες με **δύο** μηχανές: η «Διαθέσιμα Ακίνητα» (πλέγμα/κάτοψη, μόνο ό,τι περνούσε την
 * πύλη πωλήσεων, επεξεργασία κλειδωμένη) και το `/spaces/properties` (λίστα, όλο το απόθεμα, επεξεργασία, κάδος). Το
 * αν μπορούσες να επεξεργαστείς εξαρτιόταν από **ποιο κουμπί του μενού πάτησες** (§3). Τώρα το `/spaces/properties`
 * είναι ανακατεύθυνση εδώ, και τη δυνατότητα την αποφασίζει ο **ρόλος** (Α4).
 *
 * Η σύνθεση ζει στον `usePropertiesScreen`· εδώ μόνο η τοποθέτηση.
 */

import dynamic from 'next/dynamic';
import { ResponsiveFiltersPanel } from '@/components/core/AdvancedFilters';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { ListContainer, PageContainer } from '@/core/containers';
import { PageLoadingState } from '@/core/states';
import { PropertyCardGrid } from '@/features/property-grid/PropertyCardGrid';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { DEFAULT_FILTERS } from '@/types/property-viewer';
import { selectedViewerItem } from '@/features/read-only-viewer/viewer-panes';
import { cn } from '@/lib/utils';
import { isCatalogPending } from './detail/property-page-state';
import { PropertiesHeader } from './page/PropertiesHeader';
import { PropertyPageBody } from './page/PropertyPageBody';
import { PropertyPageDashboard } from './page/PropertyPageDashboard';
import { usePropertiesScreen, type PropertiesScreenState } from './page/usePropertiesScreen';
import '@/lib/design-system';

/**
 * Η κάτοψη φορτώνεται **μόνο όταν ζητηθεί** (καμβάς, επικαλύψεις — ADR-237): όποιος δεν την ανοίγει δεν πληρώνει
 * τον κώδικά της. `ssr: false` όπως ήταν — ο θεατής μετρά τον καμβά του στον browser.
 */
const PropertyFloorplanView = dynamic(
  () => import('./page/PropertyFloorplanView').then((mod) => ({ default: mod.PropertyFloorplanView })),
  { ssr: false },
);

/** Το σώμα της ενεργής όψης. Κάδος/αρχείο σκεπάζουν **κάθε** όψη (η κεφαλίδα δείχνει τότε καμία πατημένη). */
function PropertiesScreenBody({ screen, urlTab, detailFocused }: {
  screen: PropertiesScreenState; urlTab: string | null; detailFocused: boolean;
}) {
  const { engine, view, creation, retired, viewedProperty, canDelete, viewOnFloorplan } = screen;

  if (view === 'grid' && !retired.retiredView) {
    return <PropertyCardGrid properties={engine.filteredProperties} onViewFloorPlan={viewOnFloorplan} />;
  }
  if (view === 'floorplan' && !retired.retiredView) {
    return (
      <PropertyFloorplanView
        isLoading={engine.loading}
        properties={engine.properties}
        filteredProperties={engine.filteredProperties}
        selectedPropertyIds={engine.selectedPropertyIds}
        hoveredPropertyId={engine.hoveredPropertyId}
        onHoverProperty={engine.onHoverProperty}
        onSelectProperty={engine.handlePolygonSelect}
        onSelectFloor={engine.onSelectFloor}
        detailFocused={detailFocused}
      />
    );
  }
  return (
    <PropertyPageBody
      retiredView={retired.retiredView}
      searchFilteredProperties={engine.filteredProperties}
      // 🗄️ ADR-329 §3.9 (3γ): σε κάδο/αρχείο το πλαίσιο ανοίγει ΠΛΗΡΕΣ ΚΑΙ ΚΛΕΙΔΩΜΕΝΟ — το κλείδωμα το θέτει η
      //    επιφάνεια (`RetiredRecordProvider`) από το ίδιο το ακίνητο, όχι αυτή η οθόνη.
      selectedProperty={viewedProperty ?? null}
      selectedPropertyIds={engine.selectedPropertyIds}
      isCreatingNewUnit={creation.isCreating}
      newUnitTemplate={creation.template}
      viewerProps={{
        properties: engine.properties,
        selectedFloorId: engine.selectedFloorId,
        onSelectFloor: engine.onSelectFloor,
        selectedPropertyIds: engine.selectedPropertyIds,
        hoveredPropertyId: engine.hoveredPropertyId,
        handleUpdateProperty: engine.handleUpdateProperty,
      }}
      safeFloors={engine.floors}
      urlTab={urlTab}
      onSelectProperty={engine.handlePolygonSelect}
      setShowHistoryPanel={engine.setShowHistoryPanel}
      onAssignmentSuccess={() => { engine.forceDataRefresh(); engine.setSelectedProperties([]); }}
      onPropertyCreated={creation.created}
      onCancelCreate={creation.cancel}
      onNewProperty={creation.start}
      // Α5 — «Μεταφορά στον κάδο» ρωτά το `:delete`, όχι το `canEdit`· χωρίς handler η λίστα δεν το προσφέρει.
      onDeleteProperty={canDelete ? engine.handleDelete : undefined}
    />
  );
}

export function PropertiesScreen({ urlTab = null }: { urlTab?: string | null }) {
  const { t } = useTranslation(['properties', 'trash']);
  const screen = usePropertiesScreen();
  const { engine, view, setView, creation, retired } = screen;
  const layout = useLayoutClasses();
  const detailFocused = view === 'floorplan' && !retired.retiredView
    && selectedViewerItem(engine.filteredProperties, engine.selectedPropertyIds) !== null;

  // ADR-229 — φρουρός φόρτωσης δεδομένων· όχι κατά τη δημιουργία (θα έσβηνε φόρμα στη μέση της συμπλήρωσης).
  // ADR-777 §8.30 — «δεν απάντησε» ≠ «άδειο»: το `loading` μόνο του είναι `false` και ΠΡΙΝ ρωτήσει κανείς.
  if (isCatalogPending(engine) && !creation.isCreating && engine.properties.length === 0) {
    return (
      <PageContainer ariaLabel={t('page.pageLabel')}>
        <PageLoadingState icon={NAVIGATION_ENTITIES.property.icon} message={t('page.loading')} layout="contained" />
      </PageContainer>
    );
  }

  return (
    <PageContainer ariaLabel={t('page.pageLabel')}>
      {/*
        ADR-912 §12.17 — **στο στενό η λεπτομέρεια είναι ΔΙΚΗ ΤΗΣ οθόνη** (Gmail · Zillow · Idealista): με επιλεγμένο
        ακίνητο στην κάτοψη, τίτλος + προβολές/φίλτρα/κάδος της ΛΙΣΤΑΣ δεν φαίνονται — μετρημένα ~135px στα 390×844. Το
        ‹ πίσω της μπάρας του θεατή γυρίζει στη λίστα, όπου ξαναεμφανίζονται. Μόνο ορατότητα ⇒ CSS `max-md:` (το ίδιο 768
        με το `MOBILE_BREAKPOINT`), σωστό από το πρώτο καρέ, αμετάβλητο σε desktop (§12.14 κανόνας 4).
      */}
      <div className={cn('contents', detailFocused && 'max-md:hidden')}>
        <PropertiesHeader
          viewMode={view}
          setViewMode={(next) => setView(next)}
          showDashboard={engine.showDashboard}
          setShowDashboard={engine.setShowDashboard}
          searchTerm={engine.filters.searchTerm}
          setSearchTerm={screen.setSearchTerm}
          showFilters={screen.showFilters}
          setShowFilters={screen.setShowFilters}
          visibleCount={engine.filteredProperties.length}
          {...retired.headerProps}
        />

        {engine.showDashboard && (
          <PropertyPageDashboard stats={engine.dashboardStats} filters={engine.filters} onFiltersChange={screen.updateFilters} />
        )}

        <ResponsiveFiltersPanel
          config={screen.filtersConfig}
          filters={engine.filters}
          onFiltersChange={screen.onFiltersChange}
          defaultFilters={DEFAULT_FILTERS}
          showMobile={screen.showFilters}
        />

        {/* 🗑️🗄️ Κάδος ή Αρχείο: η μπάρα της ανοιχτής προβολής (μόνο με `:delete`) + οι γραμμές της */}
        {retired.actionsBar}
      </div>

      <ListContainer className={detailFocused ? layout.listPaddingDetailFlush : undefined}>
        <PropertiesScreenBody screen={screen} urlTab={urlTab} detailFocused={detailFocused} />
      </ListContainer>

      {engine.PropertyMutationImpactDialog}
      {engine.PropertyDeletionDialogs}
      {retired.dialogs}
    </PageContainer>
  );
}
