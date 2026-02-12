import type {
  ObligationDocument,
  ObligationTemplate,
  ObligationStatus,
  ObligationWorkflowTransition,
  ObligationIssueRequest,
  ObligationIssueResult,
  ObligationTransmittal,
} from '@/types/obligations';

export type SearchFilters = { status?: ObligationStatus | 'all'; dateFrom?: Date; dateTo?: Date };

export type ObligationStats = {
  total: number;
  draft: number;
  inReview: number;
  returned: number;
  approved: number;
  issued: number;
  superseded: number;
  archived: number;
  completed: number;
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
  updateStatus(
    id: string,
    status: ObligationStatus,
    transition?: Pick<ObligationWorkflowTransition, 'changedBy' | 'reason'>
  ): Promise<boolean>;
  getTemplates(): Promise<ObligationTemplate[]>;
  search(query: string, filters?: SearchFilters): Promise<ObligationDocument[]>;
  getStatistics(): Promise<ObligationStats>;
  exportToPDF(id: string): Promise<Blob>;
  issueWithTransmittal(request: ObligationIssueRequest): Promise<ObligationIssueResult | null>;
  getTransmittalsForObligation(obligationId: string): Promise<ObligationTransmittal[]>;
}

// Service interface remains identical to the repository for non-breaking changes.
export type IObligationsService = IObligationsRepository;
