import type { ObligationDocument, ObligationTemplate } from '@/types/obligations';
import type { IObligationsService, IObligationsRepository, SearchFilters, ObligationStats } from './contracts';
import { InMemoryObligationsRepository } from './InMemoryObligationsRepository';

class ObligationsService implements IObligationsService {
  private static instance: ObligationsService;
  private repository: IObligationsRepository;

  private constructor(repository: IObligationsRepository) {
    this.repository = repository;
  }

  public static getInstance(): ObligationsService {
    if (!ObligationsService.instance) {
      // In a real app, you might inject the repository based on environment
      const repository = new InMemoryObligationsRepository();
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

  create(data: Partial<ObligationDocument>): Promise<ObligationDocument> {
    return this.repository.create(data);
  }

  update(id: string, data: Partial<ObligationDocument>): Promise<ObligationDocument | null> {
    return this.repository.update(id, data);
  }

  delete(id: string): Promise<boolean> {
    return this.repository.delete(id);
  }

  bulkDelete(ids: string[]): Promise<number> {
    return this.repository.bulkDelete(ids);
  }

  duplicate(id: string): Promise<ObligationDocument | null> {
    return this.repository.duplicate(id);
  }

  updateStatus(id: string, status: ObligationDocument['status']): Promise<boolean> {
    return this.repository.updateStatus(id, status);
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
}

export { ObligationsService };
