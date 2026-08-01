/**
 * @fileoverview Σύνοψη ιδιοκτησιών επαφής — αθροίσματα + τέσσερις κατανομές
 *
 * Εξήχθη από το `route.ts` (357 γρ. έναντι ορίου 300 για API route, N.7.1). Είναι
 * **καθαρή** συνάρτηση: δεν αγγίζει Firestore, δεν διαβάζει `AuthContext`, δεν
 * κάνει log — άρα ελέγχεται χωρίς να στηθεί ολόκληρη διαδρομή HTTP, που ήταν
 * αδύνατο όσο ζούσε μέσα στον χειριστή.
 */

import type { FirestorePropertyData, ContactPropertiesStatistics } from './types';

/** Μία ιδιοκτησία στη μορφή που ταξιδεύει στην απάντηση. */
export interface ProcessedProperty {
  id: string;
  name: unknown;
  type: string;
  status: string;
  price: number;
  area: number;
  buildingId: string;
  projectId: string;
  buildingName: unknown;
  projectName: unknown;
  floor: unknown;
  address: unknown;
  purchaseDate: unknown;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface PropertiesSummary {
  processedProperties: ProcessedProperty[];
  totalValue: number;
  totalArea: number;
  statistics: ContactPropertiesStatistics;
}

/** Ένα βήμα στη μέτρηση: αυξάνει τον μετρητή του κλειδιού κατά ένα. */
function tally(counter: Record<string, number>, key: string): void {
  counter[key] = (counter[key] || 0) + 1;
}

/**
 * Μετατρέπει τα ωμά έγγραφα σε μορφή απάντησης και μετρά ταυτόχρονα αθροίσματα
 * και κατανομές — ένα πέρασμα, γιατί κάθε ιδιοκτησία συνεισφέρει και στα δύο.
 */
export function summarizeProperties(properties: FirestorePropertyData[]): PropertiesSummary {
  let totalValue = 0;
  let totalArea = 0;

  const statistics: ContactPropertiesStatistics = {
    byType: {},
    byBuilding: {},
    byProject: {},
    byStatus: {},
  };

  const processedProperties = properties.map((prop): ProcessedProperty => {
    const propPrice = typeof prop.price === 'number' ? prop.price : 0;
    const propArea = typeof prop.area === 'number' ? prop.area : 0;

    totalValue += propPrice;
    totalArea += propArea;

    // Cast to string for safe indexing — τα ωμά πεδία είναι `unknown`.
    const propType = String(prop.type || prop.propertyType || 'unknown');
    const buildingId = String(prop.buildingId || 'unknown');
    const projectId = String(prop.projectId || 'unknown');
    const propStatus = String(prop.status || 'unknown');

    tally(statistics.byType, propType);
    tally(statistics.byBuilding, buildingId);
    tally(statistics.byProject, projectId);
    tally(statistics.byStatus, propStatus);

    return {
      id: prop.id,
      name: prop.name || prop.title || `Property ${prop.id}`,
      type: propType,
      status: propStatus,
      price: propPrice,
      area: propArea,
      buildingId,
      projectId,

      // Building information (if available)
      buildingName: prop.buildingName || prop.building || null,

      // Project information (if available)
      projectName: prop.projectName || prop.project || null,

      // Location information
      floor: prop.floor || null,
      address: prop.address || null,

      // Metadata
      purchaseDate: prop.purchaseDate || prop.soldDate || null,
      createdAt: prop.createdAt || null,
      updatedAt: prop.updatedAt || null,
    };
  });

  return { processedProperties, totalValue, totalArea, statistics };
}
