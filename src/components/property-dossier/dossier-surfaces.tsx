'use client';

/**
 * @fileoverview Οι τεμπέλικες **επιφάνειες** του φακέλου ακινήτου (ADR-280 §11.8 Β4.3 · ADR-744 §33.4).
 * @module components/property-dossier/dossier-surfaces
 *
 * Οι καρτέλες του φακέλου φτάνουν τον κόσμο του διαχειριστή αρχείων (κάτοψη · BIM 3D · DXF · ISO 19650). Ως εδώ
 * φορτώνονταν με `React.lazy`, δηλαδή το chunk **δεν περίμενε** τα κείμενά του: μόλις το `dxf-viewer` βγει από την
 * εκκίνηση (Β5) θα ζωγράφιζαν ωμά κλειδιά. Εδώ περνούν από την ΙΔΙΑ μηχανή με τις διαδρομές (`defineLazySurfaces`).
 *
 * 🔑 Λεπτό μητρώο **ανά τομέα**, όχι κεντρικό: το `fallback` μιλά `property-market`, και ένα κεντρικό αρχείο θα
 * έσερνε αυτό το namespace στη στατική κλειστότητα **κάθε** εισαγωγέα του.
 */

import { defineLazySurfaces } from '@/utils/lazyRouteFactory';
import { DossierTabLoading } from './dossier-tab-loading';

export const DossierSurfaces = defineLazySurfaces({
  PropertyDossierTab: {
    load: () => import('@/components/property-dossier/PropertyDossierTabs').then(mod => ({ default: mod.PropertyDossierTab })),
    fallback: DossierTabLoading,
  },
});
