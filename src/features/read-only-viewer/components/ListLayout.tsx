// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
'use client';

/**
 * **Ο ΘΕΑΤΗΣ — ΤΡΕΙΣ ΣΤΗΛΕΣ ΣΕ ΕΥΡΕΙΑ ΟΘΟΝΗ, ΕΝΑ ΠΑΝΕΛ ΤΗ ΦΟΡΑ ΣΕ ΣΤΕΝΗ.**
 * ADR-777 §8.20 (Α8) · SPEC-777D §26.6β · §26.8.
 *
 * Το σκεπτικό, οι μετρήσεις και οι πηγές ζουν ολόκληρα στο {@link ../viewer-panes}. Εδώ
 * μένουν **τρεις** κανόνες που δεν επιτρέπεται να σπάσουν:
 *
 * 1. **Η γεωμετρία δεν ρωτά ποτέ το `useViewportClass`.** «Πόσα πάνελ;» το απαντά το CSS στο
 *    `md`· «ποιο πάνελ;» το απαντά η **κατάσταση επιλογής**, που δεν είναι μέτρηση παραθύρου.
 *    Άρα το `measuring` δεν διαλέγει **τίποτα** γεωμετρικό, και το CLS είναι μηδέν εκ κατασκευής.
 * 2. **Το πλάτος οδηγεί μόνο ΣΥΜΠΕΡΙΦΟΡΑ**: το πίσω κουμπί, και το κλείσιμο του φύλλου όταν η
 *    οθόνη γίνει ευρεία. Και **αναφορά** (`data-viewer-pane`), που δεν αποφασίζει τίποτα.
 * 3. **Ένας αριθμός**: το `md` του Tailwind **είναι** το `MOBILE_BREAKPOINT`, και το κλειδώνει
 *    άγκυρα που ρωτά το ίδιο το Tailwind.
 */

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PropertyList } from '@/components/property-viewer/PropertyList';
import { PropertyDetailsPanel } from '@/components/property-viewer/PropertyDetailsPanel';
import { PropertyHoverInfo } from '@/components/property-viewer/PropertyHoverInfo';
import { PropertyStatusLegend } from '@/components/property-viewer/PropertyStatusLegend';
import { ReadOnlyMediaViewer, MEDIA_TAB_PARAM, parseMediaTabParam } from './ReadOnlyMediaViewer';
import { ViewerDetailsSheet } from './ViewerDetailsSheet';
import { ViewerNarrowBar } from './ViewerNarrowBar';
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { cn } from '@/lib/utils';
import { useSheetBackDismiss } from '@/hooks/media/useSheetBackDismiss';
import type { ViewportClass } from '@/hooks/media/useViewportClass';
import {
  VIEWER_DETAIL_HISTORY_KEY,
  VIEWER_PANE_ATTRIBUTE,
  reportedViewerPane,
} from '../viewer-panes';
import type { Property } from '@/types/property-viewer';
import type { ReadOnlyViewerContextProps } from '../types';
import '@/lib/design-system';
import { formatCurrency } from '@/lib/intl-formatting';
import type { OverlayLabel } from '@/components/shared/files/media/overlay-polygon-renderer';
import { PROPERTY_STATUS_LABELS } from '@/constants/domains/property-status-core';
import type { PropertyStatus } from '@/constants/domains/property-status-core';
import { getEffectivePrice } from '@/lib/properties/price-resolver';

export function ListLayout({
  isLoading,
  filteredProperties,
  selectedPropertyIds,
  handlePolygonSelect,
  hoveredPropertyId,
  onHoverProperty,
  viewport,
  viewerProps,
}: {
  isLoading: boolean;
  filteredProperties: Property[];
  selectedPropertyIds: string[];
  handlePolygonSelect: (id: string, isShiftClick: boolean) => void;
  hoveredPropertyId: string | null;
  /** SPEC-237C: Hover callback for bidirectional sync */
  onHoverProperty?: (propertyId: string | null) => void;
  /** Η **μία** ερώτηση πλάτους της οθόνης. Οδηγεί **συμπεριφορά**, ποτέ σχήμα. */
  viewport: ViewportClass;
  viewerProps: ReadOnlyViewerContextProps;
}) {
  const { t } = useTranslation(['properties', 'properties-detail', 'properties-enums', 'properties-viewer']);
  // 🏢 ENTERPRISE: Centralized spacing tokens - NO hardcoded values
  const layout = useLayoutClasses();
  const spacing = useSpacingTokens();

  // ==========================================================================
  // 🏢 ENTERPRISE: URL-Based State for PropertyHoverInfo visibility
  // ==========================================================================
  // PropertyHoverInfo is only relevant for floorplan tab (has polygons to hover).
  // Photos/Videos tabs don't have hoverable regions, so hide the info panel.
  const searchParams = useSearchParams();
  const activeMediaTab = parseMediaTabParam(searchParams.get(MEDIA_TAB_PARAM));
  // 🏢 ADR-258D: PropertyHoverInfo visible ONLY on floor floorplan tabs
  // Unit floorplan (Κάτοψη Μονάδας) → δεν έχει overlay polygons, δεν χρειάζεται hover info
  // Floor floorplan (Κάτοψη Ορόφου) → έχει overlay polygons, χρειάζεται hover info
  const showPropertyHoverInfo = activeMediaTab === 'floorplan-floor'
    || activeMediaTab.startsWith('floorplan-floor-');
  const properties = viewerProps.properties ?? [];

  /**
   * **Το επιλεγμένο ακίνητο, λυμένο ΜΙΑ φορά.**
   *
   * 🔴 Μέχρι τις 2026-08-11 η **ίδια** αναζήτηση ήταν γραμμένη **έξι** φορές μέσα στις
   * ιδιότητες του προβολέα — έξι γραμμικές σαρώσεις σε κάθε απόδοση, και έξι σημεία που
   * έπρεπε να αλλάξουν μαζί. Δεν ήταν διακοσμητικό: η μία από τις έξι είχε ήδη αποκλίνει
   * σε μορφή (τυλιγμένη σε αμέσως καλούμενη συνάρτηση για το `companyId`).
   */
  const selectedProperty = React.useMemo<Property | null>(() => {
    const id = selectedPropertyIds[0];
    return id ? filteredProperties.find((p) => p.id === id) ?? null : null;
  }, [filteredProperties, selectedPropertyIds]);

  const hasSelection = selectedProperty !== null;

  /**
   * Το `companyId` δεν είναι δηλωμένο στον τύπο `Property` — διαβάζεται με **δύο** ονόματα,
   * όπως ακριβώς και πριν. Η ανάγνωση έμεινε ίδια· απλώς έπαψε να είναι έκτη αναζήτηση.
   */
  const selectedCompanyId = React.useMemo<string | null>(() => {
    const record = selectedProperty as Record<string, unknown> | null;
    return (record?.companyId as string | undefined)
      ?? (record?.linkedCompanyId as string | undefined)
      ?? null;
  }, [selectedProperty]);

  // ADR-340 §3.6 — pre-formatted in-polygon hover labels for FloorplanGallery.
  // Locale-agnostic strings: caller formats with i18n + currency, the canvas
  // renderer just draws them. Three lines per property: code (small),
  // gross sqm (small), sale price (emphasis / larger).
  const sqmUnit = t('units.sqm', { ns: 'properties-enums' });
  const propertyLabels = React.useMemo(() => {
    const map = new Map<string, OverlayLabel>();
    for (const p of properties) {
      const grossSqm = p.areas?.gross ?? p.area;
      const hasSqm = typeof grossSqm === 'number' && Number.isFinite(grossSqm);
      const effectivePrice = getEffectivePrice(p);
      const statusKey = (p.commercialStatus ?? p.status) as PropertyStatus | undefined;
      const statusI18nKey = statusKey ? PROPERTY_STATUS_LABELS[statusKey] : undefined;
      const statusText = statusI18nKey ? t(statusI18nKey).toUpperCase() : undefined;
      map.set(p.id, {
        statusText,
        primaryText: p.code || undefined,
        secondaryText: hasSqm ? `${grossSqm} ${sqmUnit}` : undefined,
        emphasisText: effectivePrice ? formatCurrency(effectivePrice.amount) : undefined,
      });
    }
    return map;
  }, [properties, sqmUnit, t]);

  const handleSelectFloor = React.useCallback(
    (floorId: string | null) => {
      viewerProps.onSelectFloor?.(floorId);
    },
    [viewerProps.onSelectFloor]
  );

  /**
   * **Επιστροφή στη λίστα** — και είναι **ταυτοδύναμη**, όπως απαιτεί ρητά ο
   * `useSheetBackDismiss` (τη φωνάζουν **δύο** δρόμοι: το ορατό κουμπί και το `popstate`).
   *
   * ⚠️ **Ο μόνος γραφέας της επιλογής καθαρίζει σε κάθε ψευδή ταυτότητα** — η πρώτη γραμμή
   * του `handlePolygonSelect` είναι `if (!propertyId) → []`. Γι' αυτό **δεν** χρησιμοποιείται
   * το «ξανα-πάτα το επιλεγμένο», που *φαίνεται* ισοδύναμο: εκείνο είναι **εναλλαγή**, άρα
   * δεύτερη κλήση θα **ξανα-επέλεγε** το ακίνητο — δηλαδή το πίσω κουμπί θα άνοιγε ξανά αυτό
   * που μόλις έκλεισε. Άγκυρα: `Θ6`.
   */
  const backToList = React.useCallback(() => handlePolygonSelect('', false), [handlePolygonSelect]);

  const [detailsRequested, setDetailsRequested] = React.useState(false);

  /**
   * ⚠️ **Το φύλλο κλείνει όταν η οθόνη γίνει ευρεία, και δεν είναι πολυτέλεια.** Το
   * `SheetContent` φέρει `md:hidden`, αλλά το **σκοτεινό στρώμα** του Radix αποδίδεται από τη
   * βιβλιοθήκη και **δεν** το φέρει: ένα ανοιχτό φύλλο που «κρύφτηκε» στο desktop θα άφηνε
   * επικάλυψη πάνω σε τρεις κανονικές στήλες. **Συμπεριφορά**, άρα σωστά κρέμεται από τη μέτρηση.
   */
  React.useEffect(() => {
    if (viewport === 'wide') setDetailsRequested(false);
  }, [viewport]);

  useSheetBackDismiss({
    historyKey: VIEWER_DETAIL_HISTORY_KEY,
    active: viewport === 'narrow',
    expanded: hasSelection,
    dismiss: backToList,
  });

  /**
   * Το πάνελ λεπτομερειών γράφεται **μία** φορά και τοποθετείται σε **δύο** θέσεις — στήλη
   * στην ευρεία, φύλλο στη στενή. Δύο γραμμένες κλήσεις θα ήταν δίδυμο (CHECK 3.28) και,
   * χειρότερα, δύο σημεία που θα αποκλίνουν σιωπηλά.
   */
  const detailsPanel = (
    <PropertyDetailsPanel
      propertyIds={selectedPropertyIds}
      onSelectFloor={handleSelectFloor}
      properties={properties}
      isReadOnly
    />
  );

  return (
    // 🏢 ENTERPRISE: gap-2 (8px) from centralized tokens
    <div
      {...{ [VIEWER_PANE_ATTRIBUTE]: reportedViewerPane(viewport, hasSelection) }}
      className={`flex-1 flex ${layout.listGapResponsive} min-h-0`}
    >
      {/*
        ΛΙΣΤΑ — στήλη 360 px στην ευρεία· **ολόκληρη η οθόνη** στη στενή, και υποχωρεί μόλις
        υπάρξει επιλογή. Material 3: *«selection of a list item displays the detail in place
        of the list»*.
      */}
      <div
        className={cn(
          'w-full shrink-0 flex-col md:w-[360px]',
          layout.listGapResponsive,
          hasSelection ? 'hidden md:flex' : 'flex'
        )}
      >
        <Card className="flex-1 flex flex-col min-h-0">
          {/* 🏢 ENTERPRISE: 8px padding from centralized tokens */}
          <CardHeader className={`${spacing.padding.sm} shrink-0`}>
            <CardTitle className="text-base">{t('viewer.availableProperties')}</CardTitle>
          </CardHeader>
          {/* 🏢 ENTERPRISE: No padding - list items handle their own spacing */}
          <CardContent className={`flex-1 ${spacing.padding.none} overflow-hidden`}>
            <ScrollArea className="h-full">
              <PropertyList
                properties={filteredProperties}
                selectedPropertyIds={selectedPropertyIds}
                onSelectProperty={handlePolygonSelect}
                isLoading={isLoading}
                hoveredPropertyId={hoveredPropertyId}
                onHoverProperty={onHoverProperty}
              />
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/*
        ΠΡΟΒΟΛΕΑΣ ΜΕΣΩΝ — το κύριο περιεχόμενο. 🔴 Στη στενή οθόνη ήταν `flex-1` ανάμεσα σε δύο
        `shrink-0` των 360 px, δηλαδή **ακριβώς 0 px**: αποδιδόταν με περιεχόμενο και ήταν
        αόρατος (μετρημένο ζωντανά στα 515 px). Πλέον στη στενή είτε **λείπει** είτε έχει
        **ολόκληρο** το πλάτος — ποτέ μηδέν.
      */}
      <div
        className={cn(
          'flex-1 flex-col min-h-0 min-w-0 relative',
          hasSelection ? 'flex' : 'hidden md:flex'
        )}
      >
        <ViewerNarrowBar
          title={selectedProperty?.name}
          onBack={backToList}
          onShowDetails={() => setDetailsRequested(true)}
        />

        {showPropertyHoverInfo && (
          <PropertyStatusLegend
            properties={filteredProperties}
            className="absolute bottom-2 left-2 z-10"
          />
        )}
        <ReadOnlyMediaViewer
          propertyId={selectedPropertyIds[0] ?? null}
          propertyName={selectedProperty?.name}
          floorId={selectedProperty?.floorId ?? null}
          buildingId={selectedProperty?.buildingId ?? null}
          floorNumber={selectedProperty?.floor ?? null}
          companyId={selectedCompanyId}
          levels={selectedProperty?.levels}
          onHoverOverlay={onHoverProperty}
          onClickOverlay={(propertyId) => handlePolygonSelect(propertyId, false)}
          highlightedOverlayUnitId={hoveredPropertyId}
          propertyLabels={propertyLabels}
        />
      </div>

      {/*
        ΛΕΠΤΟΜΕΡΕΙΕΣ — στήλη **μόνο** στην ευρεία. Στη στενή το ίδιο περιεχόμενο ταξιδεύει στο
        φύλλο πυθμένα παρακάτω (Material 3, Supporting Pane).
      */}
      <div className={cn('hidden w-[360px] shrink-0 md:flex md:flex-col', layout.listGapResponsive)}>
        {/* 🏢 ADR-258D: Επιλεγμένο Ακίνητο — equal height with Γρήγορη Προβολή */}
        <Card className="flex-1 flex flex-col min-h-0">
          <CardHeader className={`${spacing.padding.sm} shrink-0`}>
            <CardTitle className="text-sm">{t('viewer.propertyDetails')}</CardTitle>
          </CardHeader>
          {/* 🏢 ENTERPRISE: No padding - ScrollArea fills to edges (same pattern as Διαθέσιμα Ακίνητα) */}
          <CardContent className={`flex-1 ${spacing.padding.none} overflow-hidden`}>
            {detailsPanel}
          </CardContent>
        </Card>
        {/*
          🏢 ENTERPRISE: Πληροφορίες Ακινήτου - Only visible on floorplan tab.

          🔶 **ΔΕΝ ΤΑΞΙΔΕΥΕΙ ΣΤΟ ΦΥΛΛΟ, ΚΑΙ Ο ΛΟΓΟΣ ΕΙΝΑΙ ΜΕΤΡΗΜΕΝΟΣ.** Χωρίς δείκτη, αυτή η
          κάρτα ζωγραφίζει εικονίδιο **ποντικιού** και ζητά *«περάστε το ποντίκι πάνω από
          ακίνητο»*. Σε συσκευή αφής δεν υπάρχει `hover`, άρα θα ήταν **μόνιμα** σε αυτή την
          κατάσταση: οδηγία για υλικό που ο άνθρωπος δεν έχει.

          ⚠️ Το ειλικρινές κριτήριο είναι η **ικανότητα δείκτη**, όχι το πλάτος — ένα στενό
          παράθυρο σε desktop **έχει** ποντίκι. Το repo σήμερα δεν ρωτά πουθενά `hover: hover`,
          και μια πρόχειρη σύμπτυξη «στενό = αφή» θα ήταν ακριβώς το λάθος που γέννησε το
          `useViewportClass`. Μένει **δηλωμένο ανοιχτό** (SPEC-777D §26.8.5), όχι σιωπηλό.
        */}
        {showPropertyHoverInfo && (
          <Card className="flex-1 flex flex-col min-h-0">
            {/* 🏢 ADR-258D: Γρήγορη Προβολή — equal height with Επιλεγμένο Ακίνητο */}
            <CardHeader className={`${spacing.padding.sm} shrink-0`}>
              <CardTitle className="text-sm">{t('viewer.propertyInfo')}</CardTitle>
            </CardHeader>
            <CardContent className={`flex-1 ${spacing.padding.none} overflow-hidden`}>
              <PropertyHoverInfo
                propertyId={hoveredPropertyId}
                properties={filteredProperties}
              />
            </CardContent>
          </Card>
        )}
      </div>

      {/*
        ΤΟ ΒΟΗΘΗΤΙΚΟ ΠΑΝΕΛ ΣΤΗ ΣΤΕΝΗ ΟΘΟΝΗ. Το `hasSelection` στη συνθήκη **δεν** είναι
        διακόσμηση: όταν το πίσω κουμπί καθαρίσει την επιλογή, το φύλλο κλείνει **μόνο του**,
        χωρίς δεύτερη κατάσταση που θα μπορούσε να αποκλίνει.
      */}
      <ViewerDetailsSheet
        open={detailsRequested && hasSelection && viewport === 'narrow'}
        onOpenChange={setDetailsRequested}
      >
        {detailsPanel}
      </ViewerDetailsSheet>
    </div>
  );
}
