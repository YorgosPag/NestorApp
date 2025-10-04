import type { ObligationDocument, ObligationTemplate, ObligationStatus } from '@/types/obligations';

export type SearchFilters = { status?: string; dateFrom?: Date; dateTo?: Date };

export type ObligationStats = {
  total: number;
  draft: number;
  completed: number;
  approved: number;
  thisMonth: number;
};

export interface IObligationsRepository {
  getAll(): Promise<ObligationDocument[]>;
  getById(id: string): Promise<ObligationDocument | null>;
  create(data: Partial<ObligationDocument>): Promise<ObligationDocument>;
  update(id: string, data: Partial<ObligationDocument>): Promise<ObligationDocument | null>;
  delete(id: string): Promise<boolean>;
  bulkDelete(ids: string[]): Promise<number>;
  duplicate(id: string): Promise<ObligationDocument | null>;
  updateStatus(id: string, status: ObligationStatus): Promise<boolean>;
  getTemplates(): Promise<ObligationTemplate[]>;
  search(query: string, filters?: SearchFilters): Promise<ObligationDocument[]>;
  getStatistics(): Promise<ObligationStats>;
  exportToPDF(id: string): Promise<Blob>;
}

// Service interface remains identical to the repository for non-breaking changes.
export interface IObligationsService extends IObligationsRepository {}
