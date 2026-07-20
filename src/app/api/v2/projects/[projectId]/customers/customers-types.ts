// 📊 TypeScript Interfaces για Type Safety — V2 Project Customers API
//
// Εξήχθησαν από το route.ts (κανόνας N.7.1: API routes ≤300 γραμμές, το route.ts
// είχε φτάσει τις 450). Οι τύποι μοιράζονται μεταξύ του GET handler (route.ts) και
// των SQL query functions (customers-queries.ts), οπότε ζουν εδώ ως το ένα σημείο
// αλήθειας του σχήματος απόκρισης.

export interface ProjectCustomer {
  contactId: string;
  name: string;
  email: string;
  phone: string;
  mobile: string;
  contactType: "individual" | "company" | "service";
  propertiesCount: number;
  totalValue: number;
  averagePropertyValue: number;
  purchaseDate: string;
  deliveryStatus: string;
  propertiesDetails: PropertySummary[];
}

export interface PropertySummary {
  propertyId: string;
  propertyNumber: string;
  floor: number;
  areaSqm: number;
  propertyType: string;
  salePrice: number;
  saleDate: string;
  deliveryDate: string | null;
}

export interface ProjectCustomersResponse {
  success: boolean;
  projectId: string;
  projectName: string;
  customers: ProjectCustomer[];
  summary: {
    totalCustomers: number;
    totalPropertiesSold: number;
    totalSalesValue: number;
    averageSaleValue: number;
    deliveryCompleteCount: number;
    pendingDeliveryCount: number;
  };
  performance: {
    queryTimeMs: number;
    dataProcessingTimeMs: number;
    totalTimeMs: number;
  };
}
