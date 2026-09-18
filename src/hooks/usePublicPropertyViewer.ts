'use client';

import { useMemo, useState } from 'react';
import { useSharedProperties } from '@/contexts/SharedPropertiesProvider';
import { usePropertyEditCapability } from '@/hooks/usePropertyEditCapability';
import type { Property } from '@/types/property-viewer';
import type { FilterState } from '@/types/property-viewer';
import { DEFAULT_FILTERS } from '@/types/property-viewer';
import { tallyBy } from '@/utils/collection-utils';
import {
  isDisplayableInSalesDashboard,
  normalizeCommercialStatus,
} from '@/constants/commercial-statuses';
import { isPriceRangeActive, matchesPriceRange } from '@/lib/properties/price-range';
import { totalPriceByRole } from '@/lib/properties/price-totals';

// ============================================================================
// 🏢 PUBLIC VIEWING ELIGIBILITY — SSoT gate (ADR-287 Batch 18)
// ============================================================================
// Ένα property εμφανίζεται στο public viewer ΜΟΝΟ αν περνά το
// `isDisplayableInSalesDashboard` gate: listed commercial status +
// askingPrice > 0 + grossArea > 0. Legacy `status` field κανονικοποιείται
// μέσω `normalizeCommercialStatus` όταν το canonical `commercialStatus`
// λείπει (migration safety).
//
// Coerent με το UX contract του SalesDashboardRequirementsAlert: όταν
// εμφανίζεται ο alert, το property δεν εμφανίζεται στις public λίστες.
// ============================================================================

/**
 * Hook για το `/properties`: **ίδια δεδομένα** με το Units page (ίδιος provider),
 * φιλτραρισμένα από το SSoT gate εμφάνισης.
 *
 * 🔴 **Η ΕΠΙΚΕΦΑΛΙΔΑ ΕΛΕΓΕ «ΜΗΔΕΝ ΔΥΝΑΤΟΤΗΤΑ ΕΠΕΞΕΡΓΑΣΙΑΣ» — ΕΠΑΨΕ ΝΑ ΙΣΧΥΕΙ**
 * (ADR-840 Α4, Σ2). Δεν είναι πια «read-only mirror»: το `isReadOnly` **παράγεται
 * από τον ρόλο** ({@link usePropertyEditCapability}). Ήταν σταθερά — δηλαδή το αν
 * μπορείς να επεξεργαστείς εξαρτιόταν από **ποιο κουμπί του μενού πάτησες**, όχι
 * από το ποιος είσαι.
 *
 * ⚠️ **«Public» εδώ σημαίνει «read-only», ΟΧΙ «ανώνυμος»** — και μέχρι τις 2026-08-10
 * σήμαινε και τα δύο, λανθασμένα:
 *
 * Ο hook είχε **δεύτερη πηγή**, ένα `usePublicProperties()` που ρωτούσε απευθείας το
 * `properties` χωρίς σύνδεση, ως εφεδρικό όταν ο χρήστης δεν ήταν συνδεδεμένος. Το
 * σκέλος **αφαιρέθηκε ολόκληρο** (ADR-777 Β2β), και ο λόγος δεν είναι καθαριότητα:
 *
 *  1. **Διέρρεε.** Το Firestore δεν έχει έλεγχο ανάγνωσης σε επίπεδο πεδίου, οπότε ο
 *     ανώνυμος έπαιρνε ΟΛΟΚΛΗΡΟ το έγγραφο — `companyId`, `createdBy`,
 *     `_lastModifiedByName` (ονοματεπώνυμο), `projectId`, `code`, `levelData`.
 *  2. **Και δεν έδειχνε τίποτα.** Το εφεδρικό χαρτογραφούσε σε `RealtimeUnit`, τύπο
 *     **χωρίς** `commercial`/`areas`, και το `isDisplayableInSalesDashboard` παρακάτω
 *     απαιτεί την τιμή που ζητά η κατάσταση ⇒ **καμία** από τις τρεις listed
 *     καταστάσεις δεν περνούσε ποτέ. Η ανώνυμη λίστα ήταν **δομικά κενή**.
 *
 * 🔑 **Δεν αντικαταστάθηκε από προσαρμογέα, και αυτό μετρήθηκε:** ο τύπος
 * {@link Property} απαιτεί `building` · `project` · `buildingId` · `floorId` ·
 * `vertices` — **ακριβώς** τα εσωτερικά αναγνωριστικά που η προβολή
 * `types/public-listing.ts` υπάρχει για να **μη** δημοσιεύει. Ένας προσαρμογέας
 * `PublicListing → Property` θα ήταν υποχρεωμένος να τα **επινοήσει**, δηλαδή να
 * παραγάγει ψεύτικο `Property` για να τροφοδοτήσει έναν viewer κλειδωμένο πάνω σε
 * `floorId` που δεν υπάρχει. Η δημόσια επιφάνεια είναι οι οθόνες `/search`,
 * `/search/results`, `/listing/[id]`, που διαβάζουν `usePublicListings`.
 *
 * ⇒ Ο hook κάνει πλέον **μία** δουλειά: τον **συνδεδεμένο** viewer — με τη
 * δυνατότητα επεξεργασίας να **ρωτιέται**, όχι να προεξοφλείται.
 */
export function usePublicPropertyViewer() {
  const { properties: allProperties, floors, isLoading } = useSharedProperties();

  /**
   * ADR-840 Α4 / Σ2 — **η δυνατότητα έρχεται από τον ΡΟΛΟ, όχι από τη διεύθυνση.**
   * Δες την επικεφαλίδα του {@link usePropertyEditCapability} για το τι ήταν εδώ
   * πριν (σταθερά `isReadOnly: true`) και γιατί ήταν σφάλμα.
   */
  const { canEdit } = usePropertyEditCapability();

  // Local state για UI controls
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  const [hoveredPropertyId, setHoveredPropertyId] = useState<string | null>(null);
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>("floor-2");
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [showDashboard, setShowDashboard] = useState(false);
  const [scale, setScale] = useState(1);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  // Φιλτράρουμε properties για public view μέσω SSoT gate.
  // ADR-287 Batch 18: ενιαίος κανόνας εμφάνισης σε public vetrina & sales dashboards.
  //
  // 🔑 **Μία πηγή, άρα σωστή εξάρτηση ΕΚ ΚΑΤΑΣΚΕΥΗΣ.** Μέχρι τις 2026-08-10 εδώ
  // υπήρχε ένα `sourceProperties = allProperties.length > 0 ? allProperties :
  // publicProps`, ενώ το memo εξαρτιόταν **μόνο** από το `allProperties` — δηλαδή η
  // άφιξη των δημόσιων δεδομένων δεν ξανα-υπολόγιζε ποτέ τη λίστα. Το ενδιάμεσο
  // ψευδώνυμο ήταν ο μηχανισμός: έκρυβε ποια είσοδο διαβάζει πραγματικά το memo.
  const publicProperties = useMemo(() => {
    if (!Array.isArray(allProperties)) return [];

    return allProperties.filter((property: Property) => {
      // ADR-197: commercialStatus is source of truth. Legacy `status`
      // normalized as migration fallback.
      const commercialStatus =
        property.commercialStatus ?? normalizeCommercialStatus(property.status);

      // Runtime shape includes nested `areas.gross` (canonical) even though
      // viewer type exposes only flat `area` (legacy). Read both, prefer gross.
      const nestedGross = (property as { areas?: { gross?: number } }).areas?.gross;

      return isDisplayableInSalesDashboard({
        commercialStatus,
        askingPrice: property.commercial?.askingPrice ?? property.price,
        // ADR-777 §8.2 #1: η πύλη ζητά τη τιμή που ζητά Η ΚΑΤΑΣΤΑΣΗ. Χωρίς
        // αυτό, ένα ακίνητο μόνο προς ενοικίαση δεν εμφανιζόταν ΠΟΤΕ.
        rentPrice: property.commercial?.rentPrice,
        grossArea: nestedGross ?? property.area,
      });
    });
  }, [allProperties]);

  // Apply filters to public properties
  const filteredProperties = useMemo(() => {
    let filtered = publicProperties;

    // Search term filter
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(property => {
        const name = (property.name ?? '').toLowerCase();
        const desc = (property.description ?? '').toLowerCase();
        return name.includes(term) || desc.includes(term);
      });
    }

    // Type filter
    if (filters.propertyType.length > 0) {
      filtered = filtered.filter(property => 
        filters.propertyType.includes(property.type)
      );
    }

    // Status filter
    if (filters.status.length > 0) {
      filtered = filtered.filter(property => 
        filters.status.includes(property.status)
      );
    }

    // Price range filter — ADR-777 Α6 + §8.60.14.14: the range carries its UNIT, and only
    // an amount IN THAT ROLE is judged (`matchesPriceRange`). Until 2026-09-18 this read
    // `getEffectivePrice(...).amount` — the headline of ANY role — so «up to 1.000» let a
    // 900 €/month rent and a 50 €/night rate through as if they were sale prices.
    if (isPriceRangeActive(filters.priceRange)) {
      filtered = filtered.filter((property) => matchesPriceRange(property, filters.priceRange));
    }

    // Area range filter
    // 🏢 ENTERPRISE: Check for both null AND undefined (ADR-051 uses undefined for empty ranges)
    const hasAreaFilter = filters.areaRange.min != null || filters.areaRange.max != null;
    if (hasAreaFilter) {
      filtered = filtered.filter(property => {
        const area = property.area || 0;
        const minOk = filters.areaRange.min == null || area >= filters.areaRange.min;
        const maxOk = filters.areaRange.max == null || area <= filters.areaRange.max;
        return minOk && maxOk;
      });
    }

    return filtered;
  }, [publicProperties, filters]);

  // Υπολογίζουμε stats μόνο για διαθέσιμα properties
  // 🏢 ENTERPRISE: Stats calculation considers both market and operational status
  const dashboardStats = useMemo(() => {
    const availableProps = publicProperties;

    // Helper: Check if property is available for sale/rent
    const isAvailableForTransaction = (p: Property): boolean => {
      const hasMarketStatus = p.status === 'for-sale' || p.status === 'for-rent';
      const isReady = p.operationalStatus === 'ready';
      return hasMarketStatus || isReady;
    };

    // ADR-777 Α5/Α6 + §8.60.14.13 — ο SSoT τιμής, ΑΝΑ ΡΟΛΟ. Εδώ ζούσε το τρίτο
    // χειρόγραφο άθροισμα: διάβαζε σωστά τον επιλυτή, και μετά πετούσε τον ρόλο
    // (`.map(r => r.amount)`) — πωλήσεις + ενοίκια + διανυκτερεύσεις, ένας αριθμός.
    return {
      totalProperties: availableProps.length,
      availableProperties: availableProps.filter(isAvailableForTransaction).length,
      soldProperties: 0, // Δεν εμφανίζουμε sold properties
      totalArea: availableProps.reduce((sum, p) => sum + (p.area || 0), 0),
      // Α5 — η λογιστική κλείνει ΜΕΣΑ στο αποτέλεσμα (`pricedCount` ανά ρόλο +
      // `unpricedCount`)· ο μέσος όρος διαιρεί μόνο με όσα έχουν τιμή του ρόλου του.
      priceTotals: totalPriceByRole(availableProps, (p) => p.area),
      // 🏢 ENTERPRISE: Group by effective status (market or operational)
      propertiesByStatus: tallyBy(availableProps, p => p.status || p.operationalStatus || 'unknown'),
      propertiesByType: tallyBy(availableProps, p => p.type),
      propertiesByFloor: tallyBy(availableProps, p => `Όροφος ${p.floor}`),
      totalStorageUnits: availableProps.filter(p => p.type === 'Αποθήκη').length,
      // 🏢 ENTERPRISE: Storage availability considers both status systems
      availableStorageUnits: availableProps.filter(p =>
        p.type === 'Αποθήκη' && (
          p.status === 'for-sale' ||
          p.status === 'for-rent' ||
          p.operationalStatus === 'ready'
        )
      ).length,
      soldStorageUnits: 0, // Δεν εμφανίζουμε sold
      uniqueBuildings: [...new Set(availableProps.map(p => p.building))].length,
      reserved: availableProps.filter(p => p.status === 'reserved').length,
    };
  }, [publicProperties]);

  // Find selected unit
  const selectedProperty = useMemo(() => {
    if (selectedPropertyIds.length === 1) {
      return publicProperties.find(p => p.id === selectedPropertyIds[0]) || null;
    }
    return null;
  }, [selectedPropertyIds, publicProperties]);

  // Get current floor με filtered properties
  const currentFloor = useMemo(() => {
    const baseFloor = floors.find(f => f.id === selectedFloorId);
    if (!baseFloor) return null;
    
    // Return floor με μόνο τα filtered properties
    return {
      ...baseFloor,
      properties: filteredProperties.filter(p => p.floorId === baseFloor.id)
    };
  }, [floors, selectedFloorId, filteredProperties]);

  // Event handlers
  const handleSelectUnit = (unit: Property) => {
    setSelectedPropertyIds([unit.id]);
  };

  const onHoverProperty = (propertyId: string | null) => {
    setHoveredPropertyId(propertyId);
  };

  const onSelectFloor = (floorId: string | null) => {
    setSelectedFloorId(floorId);
  };

  const handleFiltersChange = (newFilters: Partial<FilterState>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  // Read-only polygon select handler
  const handlePolygonSelect = (propertyId: string, isShiftClick: boolean) => {
    if (!propertyId) {
      setSelectedPropertyIds([]);
      return;
    }
    
    if (isShiftClick) {
      setSelectedPropertyIds(prev => 
        prev.includes(propertyId) 
          ? prev.filter(id => id !== propertyId) 
          : [...prev, propertyId]
      );
    } else {
      setSelectedPropertyIds(prev => 
        prev.length === 1 && prev[0] === propertyId ? [] : [propertyId]
      );
    }
  };

  return {
    // Data
    properties: publicProperties,
    filteredProperties,
    dashboardStats,
    floors,
    
    // State
    isLoading,
    selectedPropertyIds,
    hoveredPropertyId,
    selectedFloorId,
    selectedProperty,
    currentFloor,
    
    // UI State
    viewMode,
    setViewMode,
    showDashboard,
    setShowDashboard,
    filters,
    handleFiltersChange,
    
    // Display settings (keep some for zoom, etc.)
    showGrid: true,
    snapToGrid: true,
    gridSize: 20,
    showMeasurements: false,
    scale,
    setScale,
    
    // Event handlers
    onHoverProperty,
    onSelectFloor,
    handleSelectUnit,
    handlePolygonSelect,
    setSelectedProperties: setSelectedPropertyIds,
    
    // Disabled capabilities
    canUndo: false,
    canRedo: false,
    activeTool: null,
    showHistoryPanel: false,
    suggestionToDisplay: null,
    connections: [],
    groups: [],
    isConnecting: false,
    firstConnectionPoint: null,
    
    /**
     * 🔑 **ΔΕΝ ΕΙΝΑΙ ΠΙΑ ΣΤΑΘΕΡΑ** (ADR-840 Α4). Η ίδια οθόνη προσαρμόζεται στον
     * άνθρωπο, αντί ο άνθρωπος να διαλέγει πόρτα.
     *
     * ⚠️ **ΜΗΝ το γυρίσεις σε `true` «για σιγουριά»**: η ασφάλεια δεν κατοικεί
     * εδώ. Ο φύλακας είναι ο διακομιστής (`checkPermission`), και ένα `true`
     * εδώ κρύβει από **δικαιούχο** — σφάλμα χωρίς μήνυμα, ακριβώς αυτό που
     * αυτό το στάδιο διόρθωσε.
     */
    isReadOnly: !canEdit,
  };
}