/**
 * @fileoverview Τύποι της διαδρομής «ιδιοκτησίες επαφής» (ADR-742)
 *
 * Ξεχωριστό αρχείο επειδή η ίδια η διαδρομή είχε φτάσει τις 357 γραμμές έναντι
 * ορίου 300 για API route (N.7.1): οι δηλώσεις σχήματος δεν είναι λογική και δεν
 * έχουν λόγο να καταναλώνουν το όριο του χειριστή.
 */

/** 🏢 ENTERPRISE: Firestore data types (includes legacy fields for backward compatibility) */
export type FirestoreContactData = Record<string, unknown> & {
  id: string;
  companyId?: string;
};

export type FirestorePropertyData = Record<string, unknown> & {
  id: string;
};

/**
 * Οι τέσσερις κατανομές που συνοδεύουν κάθε απάντηση — και στην επιτυχία και στο
 * σφάλμα, όπου επιστρέφονται κενές ώστε ο καταναλωτής να μη χρειάζεται κλάδο.
 */
export interface ContactPropertiesStatistics {
  byType: Record<string, number>;
  byBuilding: Record<string, number>;
  byProject: Record<string, number>;
  byStatus: Record<string, number>;
}

/** 🏢 ENTERPRISE: Discriminated union response types */
export interface ContactPropertiesSuccessResponse {
  success: true;
  contactId: string;
  properties: unknown[];
  propertiesCount: number;
  totalValue: number;
  averagePropertyValue: number;
  totalArea: number;
  averagePropertyArea: number;
  statistics: ContactPropertiesStatistics;
  contactInfo: {
    profession: string | null;
    city: string | null;
    lastContactDate: unknown;
  };
  timestamp: string;
  dataSource: string;
}

export interface ContactPropertiesErrorResponse {
  success: false;
  error: string;
  errorCategory?: string;
  contactId?: string | null;
  timestamp?: string;
  properties?: unknown[];
  propertiesCount?: number;
  totalValue?: number;
  totalArea?: number;
  statistics?: ContactPropertiesStatistics;
}

export type ContactPropertiesResponse =
  | ContactPropertiesSuccessResponse
  | ContactPropertiesErrorResponse;
