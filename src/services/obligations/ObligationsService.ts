import type {
  ObligationDocument,
  ObligationTemplate,
  ObligationWorkflowTransition,
  ObligationIssueRequest,
  ObligationIssueResult,
  ObligationTransmittal,
} from '@/types/obligations';
import type { IObligationsService, IObligationsRepository, SearchFilters, ObligationStats } from './contracts';
import { FirestoreObligationsRepository } from './InMemoryObligationsRepository';
// 🏢 ENTERPRISE: Centralized real-time service for cross-page sync
import { RealtimeService } from '@/services/realtime';

class ObligationsService implements IObligationsService {
  private static instance: ObligationsService;
  private repository: IObligationsRepository;

  private constructor(repository: IObligationsRepository) {
    this.repository = repository;
  }

  public static getInstance(): ObligationsService {
    if (!ObligationsService.instance) {
      // 🏢 PRODUCTION: Use Firestore repository instead of deprecated InMemory
      const repository = new FirestoreObligationsRepository();
      ObligationsService.instance = new ObligationsService(repository);
    }
    return ObligationsService.instance;
  }

  getAll(): Promise<ObligationDocument[]> {
    return this.repository.getAll();
  }

  getById(id: string): Promise<ObligationDocument | null> {
    return this.repository.getById(id);
  }

  async create(data: Partial<ObligationDocument>): Promise<ObligationDocument> {
    const result = await this.repository.create(data);

    // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
    RealtimeService.dispatch('OBLIGATION_CREATED', {
      obligationId: result.id,
      obligation: {
        title: result.title,
        status: result.status,
      },
      timestamp: Date.now(),
    });

    return result;
  }

  async update(id: string, data: Partial<ObligationDocument>): Promise<ObligationDocument | null> {
    const result = await this.repository.update(id, data);

    if (result) {
      // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
      RealtimeService.dispatch('OBLIGATION_UPDATED', {
        obligationId: id,
        updates: {
          title: data.title,
          status: data.status,
        },
        timestamp: Date.now(),
      });
    }

    return result;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);

    if (result) {
      // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
      RealtimeService.dispatch('OBLIGATION_DELETED', {
        obligationId: id,
        timestamp: Date.now(),
      });
    }

    return result;
  }

  bulkDelete(ids: string[]): Promise<number> {
    return this.repository.bulkDelete(ids);
  }

  duplicate(id: string): Promise<ObligationDocument | null> {
    return this.repository.duplicate(id);
  }

  updateStatus(
    id: string,
    status: ObligationDocument['status'],
    transition?: Pick<ObligationWorkflowTransition, 'changedBy' | 'reason'>
  ): Promise<boolean> {
    return this.repository.updateStatus(id, status, transition);
  }

  getTemplates(): Promise<ObligationTemplate[]> {
    return this.repository.getTemplates();
  }

  search(query: string, filters?: SearchFilters): Promise<ObligationDocument[]> {
    return this.repository.search(query, filters);
  }

  getStatistics(): Promise<ObligationStats> {
    return this.repository.getStatistics();
  }

  exportToPDF(id: string): Promise<Blob> {
    return this.repository.exportToPDF(id);
  }

  async issueWithTransmittal(request: ObligationIssueRequest): Promise<ObligationIssueResult | null> {
    const result = await this.repository.issueWithTransmittal(request);

    if (result) {
      RealtimeService.dispatch('OBLIGATION_UPDATED', {
        obligationId: request.obligationId,
        updates: {
          status: 'issued',
        },
        timestamp: Date.now(),
      });
    }

    return result;
  }

  getTransmittalsForObligation(obligationId: string): Promise<ObligationTransmittal[]> {
    return this.repository.getTransmittalsForObligation(obligationId);
  }
}

export { ObligationsService };
