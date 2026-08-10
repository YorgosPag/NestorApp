'use client';

import { useMemo, useState } from 'react';
import { useSharedProperties } from '@/contexts/SharedPropertiesProvider';
import type { Property } from '@/types/property-viewer';
import type { FilterState } from '@/types/property-viewer';
import { DEFAULT_FILTERS } from '@/types/property-viewer';
import { tallyBy } from '@/utils/collection-utils';
import {
  isDisplayableInSalesDashboard,
  normalizeCommercialStatus,
} from '@/constants/commercial-statuses';
import { getEffectivePrice } from '@/lib/properties/price-resolver';

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
 * Hook για το `/properties` — **read-only mirror** του Units page: ίδια δεδομένα,
 * μηδέν δυνατότητα επεξεργασίας. Φιλτράρει τα actively available ακίνητα μέσω του
 * SSoT gate και απενεργοποιεί κάθε edit capability.
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
 * ⇒ Ο hook κάνει πλέον **μία** δουλειά: τον συνδεδεμένο read-only viewer.
 */
export function usePublicPropertyViewer() {
  const { properties: allProperties, floors, isLoading } = useSharedProperties();

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

    // Price range filter
    // 🏢 ENTERPRISE: Check for both null AND undefined (ADR-051 uses undefined for empty ranges)
    const hasPriceFilter = filters.priceRange.min != null || filters.priceRange.max != null;
    if (hasPriceFilter) {
      filtered = filtered.filter(property => {
        // ADR-777 Α6/Α7 — SSoT τιμής. Το `property.price` είναι @deprecated flat
        // πεδίο: το φίλτρο διάβαζε ΑΛΛΟ πεδίο από αυτό που δείχνει η κάρτα, και
        // το `|| 0` έλεγε ότι «δεν έχει τιμή» = «κοστίζει 0 €».
        const resolved = getEffectivePrice(property);
        // Χωρίς λυμένη τιμή δεν υπάρχει αριθμός να συγκριθεί με το εύρος —
        // δεν το βαφτίζουμε 0. (Το gate εγγυάται ήδη askingPrice > 0· η
        // περίπτωση μένει ρητή αντί για σιωπηλή.)
        if (!resolved) return false;
        const minOk = filters.priceRange.min == null || resolved.amount >= filters.priceRange.min;
        const maxOk = filters.priceRange.max == null || resolved.amount <= filters.priceRange.max;
        return minOk && maxOk;
      });
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

    // ADR-777 Α6/Α7 + Α5 (κλειστή λογιστική) — τα αθροίσματα διαβάζουν τον SSoT
    // τιμής, όχι το @deprecated flat `p.price`. Το `p.price || 0` έκανε ΔΥΟ
    // ζημιές: αγνοούσε το `commercial.askingPrice` (⇒ το ταμπλό έδειχνε
    // ΜΙΚΡΟΤΕΡΗ αξία από την αληθινή, στα ίδια ακίνητα που η πύλη απέδειξε ότι
    // έχουν τιμή) και μετρούσε τα άτιμα ως 0 στον παρονομαστή του μέσου όρου.
    const resolvedAmounts = availableProps
      .map(getEffectivePrice)
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map(r => r.amount);
    const totalValue = resolvedAmounts.reduce((sum, amount) => sum + amount, 0);

    return {
      totalProperties: availableProps.length,
      availableProperties: availableProps.filter(isAvailableForTransaction).length,
      soldProperties: 0, // Δεν εμφανίζουμε sold properties
      totalValue,
      totalArea: availableProps.reduce((sum, p) => sum + (p.area || 0), 0),
      // Ο μέσος όρος διαιρεί με όσα ΕΧΟΥΝ τιμή — αλλιώς κάθε άτιμο ακίνητο
      // τραβούσε τον μέσο όρο προς τα κάτω σαν να κόστιζε μηδέν.
      averagePrice: resolvedAmounts.length > 0 ? totalValue / resolvedAmounts.length : 0,
      /** Α5 — η λογιστική κλείνει ρητά: πόσα μετρήθηκαν και πόσα όχι. */
      pricedProperties: resolvedAmounts.length,
      unpricedProperties: availableProps.length - resolvedAmounts.length,
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
    
    // Mark as read-only for components
    isReadOnly: true,
  };
}