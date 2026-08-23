"use client";

import React, { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from '@/lib/workspace/navigation';
import { useSearchParams } from 'next/navigation';
import { ENTITY_ROUTES } from '@/lib/routes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Import from canonical location
import { Spinner as AnimatedSpinner } from '@/components/ui/spinner';
import { PropertyGridView } from '@/features/property-grid/PropertyGridView';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import '@/lib/design-system';

// Loading component for dynamic import
const LoadingComponent = () => {
  const { t } = useTranslation(['properties', 'properties-detail', 'properties-enums', 'properties-viewer']);
  const colors = useSemanticColors();
  return (
    <div className={`min-h-screen ${colors.bg.secondary} dark:${colors.bg.primary} flex items-center justify-center`}>
      <div className="text-center">
        <AnimatedSpinner size="large" className="mx-auto mb-4" />
        <p className={colors.text.muted}>{t('page.loading')}</p>
      </div>
    </div>
  );
};

// Dynamically import the floorplan viewer with layers (ADR-237: interactive overlays)
const PropertyFloorplanViewer = dynamic(
  () => import('@/components/property-management/PropertyManagementPageContent').then(mod => ({ default: mod.PropertyManagementPageContent })),
  {
    loading: () => <LoadingComponent />,
    ssr: false
  }
);

export const PropertiesPageContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewParam = searchParams.get('view');
  const legacyPropertyId = searchParams.get('propertyId');

  /**
   * 🔴 **ADR-777 §8.30 — Η ΠΑΛΙΑ ΣΥΜΒΑΣΗ ΔΕΙΧΝΕΙ, ΔΕΝ ΜΕΝΕΙ ΠΑΡΑΛΛΗΛΗ.**
   *
   * Το `/properties?propertyId=…` ήταν ο προορισμός στον οποίο έστελνε το
   * **κεντρικό μητρώο** διαδρομών, και αυτή η σελίδα **δεν το διάβαζε ποτέ**:
   * διάβαζε μόνο `?view`. Ο σύνδεσμος «δούλευε» με την έννοια ότι άνοιγε σελίδα —
   * απλώς **όχι το ακίνητο**.
   *
   * Οι διευθύνσεις που έχουν ήδη φύγει (σελιδοδείκτες, παλιά email, ιστορικό
   * περιηγητή) δεν διορθώνονται αναδρομικά. Άρα δεν διαγράφεται η μορφή — γίνεται
   * **δείκτης** προς την καρτέλα, με `replace` ώστε το «πίσω» να μην κολλά σε
   * βρόχο ανάμεσα στις δύο διευθύνσεις.
   *
   * ⚠️ Δεν είναι το ίδιο με το `?propertyId=` του `/spaces/properties`: εκείνο
   * απαντά *«ποια γραμμή είναι επιλεγμένη»* και μένει ως έχει.
   */
  useEffect(() => {
    if (legacyPropertyId) {
      router.replace(ENTITY_ROUTES.properties.withId(legacyPropertyId));
    }
  }, [legacyPropertyId, router]);

  if (legacyPropertyId) {
    return <LoadingComponent />;
  }

  // If floorplan view is requested, show the property viewer with layers + interactive overlays
  if (viewParam === 'floorplan') {
    return <PropertyFloorplanViewer />;
  }

  // Otherwise, show the property grid view
  return <PropertyGridView />;
};

export default PropertiesPageContent;