'use client';

import { nowISO } from '@/lib/date-local';
import type { Property } from '@/types/property-viewer';
// 🏢 ENTERPRISE: Centralized real-time service for cross-page sync
import { RealtimeService } from '@/services/realtime';
// 🏢 ENTERPRISE: Centralized API client (Fortune-500 pattern)
import { apiClient, ApiClientError } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('PropertiesService');

// ============================================================================
// 🔴 ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΔΕΝ ΔΙΑΒΑΖΕΙ ΤΗ ΒΑΣΗ — ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ (ADR-842 §7.6.13)
// ============================================================================
//
// Μέχρι τις 2026-09-06 εδώ ζούσε ο `toProperty` — **δεύτερος αναγνώστης** της
// συλλογής `properties`, με ασύμβατη φιλοσοφία από τον {@link mapPropertyDoc}:
// διαπερατός αντί για λίστα επιτρεπόμενων πεδίων, και τερμάτιζε σε
// `as unknown as Property`, δηλαδή **διπλό** ισχυρισμό — ούτε καν ο μεταγλωττιστής
// δεν είχε λόγο.
//
// 🔑 **Δεν συγκλίναμε τους δύο· ο ένας ήταν ΝΕΚΡΟΣ.** Μετρημένο με `knip
// --include exports,types`: ο μόνος καλών του `getProperties()` ήταν το
// `useContactsState`, πρόγονος του ζωντανού `useContactsPageState` που έμεινε πίσω
// στην εξαγωγή του ADR-233 και κρατιόταν «ζωντανός» από **ένα** `import type`.
//
// ⚠️ **ΜΗΝ ΞΑΝΑΠΡΟΣΘΕΣΕΙΣ ΑΝΑΓΝΩΣΗ ΕΔΩ.** Αν χρειάζεσαι έγγραφα `properties`:
//   • από τον διακομιστή → Admin SDK + {@link mapPropertyDoc} (δες
//     `app/api/properties/route.ts`)
//   • από τον πελάτη ανά κτίριο → `components/properties/shared/usePropertiesByBuilding`
//   • συγκεντρωτικά ανά ιδιοκτήτη → `app/api/contacts/owner-property-stats`
// Η συλλογή έχει **ΕΝΑ** σύνορο ανάγνωσης· μια δεύτερη πόρτα εδώ θα ήταν η ίδια
// απόκλιση από την αρχή. Το φυλάει άγκυρα (`properties-service-no-read.test.ts`).

// addUnit() DELETED — was dead code (0 consumers).
// Client-side setDoc blocked by Firestore rules (allow create: if false).
// All property creation goes through createProperty() → server API + Admin SDK.

/**
 * 🏢 ENTERPRISE: Create property via server-side API (Admin SDK)
 *
 * 🔒 SECURITY: Firestore rules block client-side writes (allow create: if false)
 *              Uses API endpoint with Admin SDK to bypass rules with proper auth
 *
 * @see src/app/api/properties/create/route.ts (POST handler)
 * @see ADR-078
 */
export async function createProperty(
  propertyData: Record<string, unknown>
): Promise<{ success: boolean; propertyId?: string; error?: string; errorCode?: string }> {
  try {
    logger.info('Creating new property via API');

    interface PropertyCreateResult {
      propertyId: string;
    }
    const result = await apiClient.post<PropertyCreateResult>(API_ROUTES.PROPERTIES.CREATE, propertyData);

    const propertyId = result?.propertyId;
    logger.info(`Property created with ID: ${propertyId}`);

    // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
    RealtimeService.dispatch('UNIT_CREATED',{
      propertyId,
      property: {
        name: propertyData.name as string,
        type: propertyData.type as string,
        buildingId: (propertyData.buildingId as string) ?? null,
      },
      timestamp: Date.now()
    });

    return { success: true, propertyId };

  } catch (error) {
    logger.error('Error creating property', { error });
    return {
      success: false,
      error: getErrorMessage(error),
      errorCode: ApiClientError.isApiClientError(error) ? error.errorCode : undefined,
    };
  }
}

// Update a property via Admin SDK API (server-side validation + audit trail)
export async function updateProperty(propertyId: string, updates: Partial<Property>): Promise<{ success: boolean }> {
  await apiClient.patch(API_ROUTES.PROPERTIES.BY_ID(propertyId), updates);

  // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
  // Dispatch event for all components to update their local state
  RealtimeService.dispatch('UNIT_UPDATED',{
    propertyId,
    updates: {
      name: updates.name,
      type: updates.type,
      status: updates.status,
      area: updates.area,
      floor: updates.floor,
      buildingId: updates.buildingId,
      soldTo: updates.soldTo,
    },
    timestamp: Date.now()
  });

  return { success: true };
}

// updateMultiplePropertiesOwner() DELETED 2026-09-06 (ADR-842 §7.6.13) — νεκρό,
// μετρημένο με `knip --include exports,types` μαζί με τον νεκρό αναγνώστη.
//
// ⚠️ **Δεν αντικαταστάθηκε από κάτι, και είναι μετρημένο**: το
// `property-mutation-gateway` **δεν έχει** μαζική μεταβίβαση κυριότητας — έχει
// `updatePropertyWithPolicy` (μία μονάδα) και `revertPropertySaleWithPolicy` (η
// αντίστροφη πράξη). Αν χρειαστεί ποτέ μαζική, ανήκει **εκεί**, με πολιτική: αυτή
// εδώ έγραφε `soldTo`/`status: 'sold'` παρακάμπτοντας κάθε έλεγχο.

// 🔒 SECURITY: Delete property via Admin SDK API (client-side Firestore deletes are blocked)
export async function deleteProperty(propertyId: string): Promise<{ success: boolean }> {
  await apiClient.delete(API_ROUTES.PROPERTIES.BY_ID(propertyId));

  // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
  RealtimeService.dispatch('UNIT_DELETED', {
    propertyId,
    timestamp: Date.now()
  });

  return { success: true };
}

/**
 * Get list of buildings for entity linking
 */
export async function getBuildingsList(): Promise<Array<{ id: string; name: string }>> {
  try {
    interface BuildingFromAPI {
      id: string;
      name?: string;
    }
    interface BuildingsResponse {
      buildings: BuildingFromAPI[];
    }

    const result = await apiClient.get<BuildingsResponse>(API_ROUTES.BUILDINGS.LIST);
    if (!result?.buildings) return [];

    return result.buildings.map(b => ({
      id: b.id,
      name: b.name || b.id,
    }));
  } catch {
    return [];
  }
}

export async function updatePropertyCoverage(
  propertyId: string,
  coverage: Partial<{
    hasPhotos: boolean;
    hasFloorplans: boolean;
    hasDocuments: boolean;
  }>
): Promise<{ success: boolean }> {
  await apiClient.patch(API_ROUTES.PROPERTIES.BY_ID(propertyId), {
    'propertyCoverage.hasPhotos': coverage.hasPhotos,
    'propertyCoverage.hasFloorplans': coverage.hasFloorplans,
    'propertyCoverage.hasDocuments': coverage.hasDocuments,
    'propertyCoverage.updatedAt': nowISO(),
  });
  return { success: true };
}

