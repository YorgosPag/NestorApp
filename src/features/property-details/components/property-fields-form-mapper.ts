/**
 * =============================================================================
 * 🏢 ENTERPRISE: Property Fields Form → Updates Mapper
 * =============================================================================
 *
 * Pure mapping function that converts PropertyFieldsFormData + Property context
 * into a Partial<Property> update payload ready for Firestore persistence.
 *
 * Extracted from PropertyFieldsBlock.tsx for SRP compliance (CLAUDE.md N.7.1)
 * and to act as SSoT for form → domain mapping (can be reused by tests, other
 * mutation sites, or server-side validation).
 *
 * @module features/property-details/components/property-fields-form-mapper
 * @since 2026-04-05
 */

import { aggregateLevelData } from '@/services/multi-level.service';
import type { Property } from '@/types/property-viewer';
import type {
  ConditionType,
  OrientationType,
  InteriorFeatureCodeType,
  SecurityFeatureCodeType,
} from '@/constants/property-features-enterprise';
import type { PropertyFieldsFormData } from './property-fields-form-types';
import { changedCommercialAmounts } from '@/lib/properties/commercial-draft';
import { energyOfForm } from '@/lib/energy-certificate/energy-certificate-form';
import { writtenAreasOf } from '@/lib/properties/property-areas';
import { changedPropertyFields, samePropertyFieldValue } from '@/lib/property/property-field-change';
import { buildFormDataFromProperty } from '@/services/property/property-form-sync';

/**
 * Μπλοκ που εκπέμπονται **μόνο όταν δηλώνουν κάτι** — άδειο (κατά τον ΕΝΑ κριτή) ⇒ απουσία. Η δημιουργία δεν στέλνει
 * έτσι άδεια μπλοκ, και στην επεξεργασία το φίλτρο μετατρέπει την απουσία σε `null` όταν ο άνθρωπος τα άδειασε.
 */
const DECLARED_ONLY_BLOCKS = ['areas', 'energy', 'commercial', 'commonCharges'] as const;

/**
 * Builds the Firestore update payload from the current form state.
 *
 * Rules:
 * - Uses suggestedCode as fallback if user hasn't typed a custom one (ADR-233)
 * - Preserves existing property.floorId when present (ADR-232)
 * - For multi-level units, auto-aggregates per-level data (ADR-236 Phase 2)
 *
 * Παράγει την **πλήρη** εικόνα της φόρμας (τη χρειάζεται η δημιουργία). Το «τι άλλαξε» για την επεξεργασία ΔΕΝ
 * κρίνεται εδώ — το κρίνει το ΕΝΑ φίλτρο {@link changedPropertyUpdatesFromForm} (ADR-249 §7).
 */
export function buildPropertyUpdatesFromForm(params: {
  formData: PropertyFieldsFormData;
  property: Property;
  isMultiLevel: boolean | undefined;
}): Partial<Property> {
  const { formData, property, isMultiLevel } = params;

  // ADR-233: Preserve existing code when formData.code is empty (suggestion not yet applied).
  // Never use latestSuggestion as fallback here — EntityCodeField already applies it via onChange.
  // Using a stale suggestion would cause spurious code-change warnings in ImpactGuard.
  const resolvedCode = formData.code || property.code || undefined;
  const updates: Partial<Property> = {
    name: formData.name,
    code: resolvedCode,
    type: formData.type,
    operationalStatus: formData.operationalStatus,
    commercialStatus: formData.commercialStatus,
    floor: formData.floor,
    // 🔒 ADR-232: Include floorId from property (set via FloorSelectField)
    ...(property.floorId ? { floorId: property.floorId } : {}),
    layout: {
      bedrooms: formData.bedrooms,
      bathrooms: formData.bathrooms,
      wc: formData.wc,
    },
    orientations: formData.orientations as OrientationType[],
  };

  if (formData.description.trim()) {
    updates.description = formData.description.trim();
  }

  // ADR-777 §8.97 — τα εμβαδά: ολόκληρο το μπλοκ (`0` ≡ «δεν μετρήθηκε» — το κρίνει ο `sameAreas` μέσα στο φίλτρο).
  updates.areas = writtenAreasOf({
    gross: formData.areaGross,
    net: formData.areaNet,
    balcony: formData.areaBalcony,
    terrace: formData.areaTerrace,
    garden: formData.areaGarden,
  });

  if (formData.condition) updates.condition = formData.condition as ConditionType;
  // ADR-777 §8.94 — το ΠΕΑ: ολόκληρο το μπλοκ (ποτέ σκέτο `{ class }`, που θα έσβηνε τους αριθμούς).
  updates.energy = energyOfForm(formData);

  if (formData.heatingType || formData.coolingType) {
    const systemsOverride: Record<string, string> = {};
    if (formData.heatingType) systemsOverride.heatingType = formData.heatingType;
    if (formData.coolingType) systemsOverride.coolingType = formData.coolingType;
    updates.systemsOverride = systemsOverride as Property['systemsOverride'];
  }

  if (formData.flooring.length > 0 || formData.windowFrames || formData.glazing) {
    const finishes: Record<string, unknown> = {};
    if (formData.flooring.length > 0) finishes.flooring = formData.flooring;
    if (formData.windowFrames) finishes.windowFrames = formData.windowFrames;
    if (formData.glazing) finishes.glazing = formData.glazing;
    updates.finishes = finishes as Property['finishes'];
  }

  if (formData.interiorFeatures.length > 0) {
    updates.interiorFeatures = formData.interiorFeatures as InteriorFeatureCodeType[];
  }
  if (formData.securityFeatures.length > 0) {
    updates.securityFeatures = formData.securityFeatures as SecurityFeatureCodeType[];
  }

  // Commercial data — preserve existing fields, merge only the amounts that changed (ADR-777 §8.60.18: ο ΙΔΙΟΣ
  // κριτής ποσών με τους επεξεργαστές θέσεων/αποθηκών — δεν γράφει `null` σε ποσό που ποτέ δεν δηλώθηκε).
  updates.commercial = {
    ...(property.commercial as Record<string, unknown>),
    ...changedCommercialAmounts(formData, property.commercial),
  } as Property['commercial'];

  // ADR-777 §8.93 — τα κοινόχρηστα: ολόκληρο το μπλοκ.
  updates.commonCharges = formData.commonCharges;

  // ADR-236 Phase 2: Per-level data + auto-aggregation
  if (isMultiLevel && Object.keys(formData.levelData).length > 0) {
    (updates as Record<string, unknown>).levelData = formData.levelData;
    const agg = aggregateLevelData(formData.levelData);
    updates.areas = agg.areas;
    updates.layout = {
      bedrooms: agg.layout.bedrooms,
      bathrooms: agg.layout.bathrooms,
      wc: agg.layout.wc,
    };
    updates.orientations = agg.orientations;
  }

  for (const field of DECLARED_ONLY_BLOCKS) {
    if (samePropertyFieldValue(field, updates[field], undefined)) delete updates[field];
  }
  return updates;
}

/**
 * **Το ΕΝΑ φίλτρο «μόνο ό,τι άλλαξε»** της φόρμας ακινήτου (ADR-249 §7 · AIP-134 μάσκα πεδίων · RFC 7396).
 *
 * Συγκρίνει τη φόρμα **τώρα** με τη φόρμα **όπως θα φορτωνόταν** από το αποθηκευμένο ακίνητο — και τις δύο μέσα από
 * τον ΙΔΙΟ χαρτογράφο, άρα κάθε διαφορά αναπαράστασης (`0` vs απουσία, κενό vs `null`, μορφή ποσών) ακυρώνεται και
 * μένει μόνο η πρόθεση του ανθρώπου. Ο κριτής είναι ο ίδιος με το κλείδωμα του server και το ιστορικό.
 *
 * Αντικαθιστά τα τέσσερα σκόρπια «μόνο όταν άλλαξε» (εμβαδά · ΠΕΑ · κοινόχρηστα · ποσά). Συνέπειες:
 * - αμετάβλητο κλειδωμένο πεδίο δεν φεύγει ⇒ η «Αποθήκευση» δουλεύει σε κρατημένο/πωλημένο ακίνητο·
 * - ό,τι ο άνθρωπος **άδειασε** φεύγει ως `null` ⇒ σβήνεται (ως τώρα ένα άδειο μπλοκ απλώς δεν στελνόταν).
 */
export function changedPropertyUpdatesFromForm(params: {
  updates: Partial<Property>;
  property: Property;
  isMultiLevel: boolean | undefined;
}): Record<string, unknown> {
  const { updates, property, isMultiLevel } = params;
  const baseline = buildPropertyUpdatesFromForm({ formData: buildFormDataFromProperty(property), property, isMultiLevel });
  return changedPropertyFields(updates, baseline);
}
