import type { ObligationDocument, ObligationTemplate, ObligationStatus } from '@/types/obligations';
import { MOCK_OBLIGATIONS, DEFAULT_TEMPLATE_SECTIONS } from '@/types/mock-obligations';
import type { IObligationsRepository, SearchFilters, ObligationStats } from './contracts';

export class InMemoryObligationsRepository implements IObligationsRepository {
  private obligations: ObligationDocument[] = [...MOCK_OBLIGATIONS];

  async getAll(): Promise<ObligationDocument[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return [...this.obligations];
  }

  async getById(id: string): Promise<ObligationDocument | null> {
    await new Promise(resolve => setTimeout(resolve, 300));
    const obligation = this.obligations.find(o => o.id === id);
    return obligation ? { ...obligation } : null;
  }

  async create(data: Partial<ObligationDocument>): Promise<ObligationDocument> {
    await new Promise(resolve => setTimeout(resolve, 500));
    const newObligation: ObligationDocument = {
      id: Date.now().toString(),
      title: data.title || "",
      projectName: data.projectName || "",
      contractorCompany: data.contractorCompany || "Χ.Γ.Γ. ΠΑΓΩΝΗΣ Ο.Ε.",
      owners: data.owners || [],
      createdAt: new Date(),
      updatedAt: new Date(),
      status: "draft",
      sections: data.sections || DEFAULT_TEMPLATE_SECTIONS,
      projectDetails: data.projectDetails || { location: "", address: "" }
    };
    this.obligations.push(newObligation);
    return { ...newObligation };
  }

  async update(id: string, data: Partial<ObligationDocument>): Promise<ObligationDocument | null> {
    await new Promise(resolve => setTimeout(resolve, 500));
    const index = this.obligations.findIndex(o => o.id === id);
    if (index === -1) return null;
    const updated = { ...this.obligations[index], ...data, updatedAt: new Date() };
    this.obligations[index] = updated;
    return { ...updated };
  }

  async delete(id: string): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 300));
    const index = this.obligations.findIndex(o => o.id === id);
    if (index === -1) return false;
    this.obligations.splice(index, 1);
    return true;
  }
  
  async bulkDelete(ids: string[]): Promise<number> {
    await new Promise(resolve => setTimeout(resolve, 500));
    let deletedCount = 0;
    ids.forEach(id => {
      const index = this.obligations.findIndex(o => o.id === id);
      if (index !== -1) {
        this.obligations.splice(index, 1);
        deletedCount++;
      }
    });
    return deletedCount;
  }

  async duplicate(id: string): Promise<ObligationDocument | null> {
    await new Promise(resolve => setTimeout(resolve, 500));
    const original = this.obligations.find(o => o.id === id);
    if (!original) return null;
    const duplicate: ObligationDocument = {
      ...original,
      id: Date.now().toString(),
      title: `${original.title} - Αντίγραφο`,
      status: "draft",
      createdAt: new Date(),
      updatedAt: new Date(),
      sections: original.sections.map(section => ({
        ...section,
        id: `${section.id}-copy-${Date.now()}`
      }))
    };
    this.obligations.push(duplicate);
    return { ...duplicate };
  }

  async updateStatus(id: string, status: ObligationStatus): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 300));
    const index = this.obligations.findIndex(o => o.id === id);
    if (index === -1) return false;
    this.obligations[index] = { ...this.obligations[index], status, updatedAt: new Date() };
    return true;
  }

  async getTemplates(): Promise<ObligationTemplate[]> {
    await new Promise(resolve => setTimeout(resolve, 200));
    return [
      { id: "default", name: "Βασικό Πρότυπο ΠΑΓΩΝΗΣ", description: "Βασικές ενότητες συγγραφής υποχρεώσεων.", sections: DEFAULT_TEMPLATE_SECTIONS, isDefault: true },
      { id: "minimal", name: "Ελάχιστο Πρότυπο", description: "Μόνο τα απαραίτητα άρθρα για απλά έργα.", sections: DEFAULT_TEMPLATE_SECTIONS.slice(0, 3), isDefault: false }
    ];
  }

  async search(query: string, filters?: SearchFilters): Promise<ObligationDocument[]> {
    await new Promise(resolve => setTimeout(resolve, 200));
    let filtered = [...this.obligations];
    if (query.trim()) {
      const searchTerm = query.toLowerCase();
      filtered = filtered.filter(o => 
        o.title.toLowerCase().includes(searchTerm) ||
        o.projectName.toLowerCase().includes(searchTerm) ||
        o.contractorCompany.toLowerCase().includes(searchTerm) ||
        o.owners.some(owner => owner.name.toLowerCase().includes(searchTerm))
      );
    }
    if (filters?.status && filters.status !== "all") {
      filtered = filtered.filter(o => o.status === filters.status);
    }
    if (filters?.dateFrom) {
      filtered = filtered.filter(o => o.createdAt >= filters.dateFrom!);
    }
    if (filters?.dateTo) {
      filtered = filtered.filter(o => o.createdAt <= filters.dateTo!);
    }
    return filtered;
  }

  async getStatistics(): Promise<ObligationStats> {
    await new Promise(resolve => setTimeout(resolve, 100));
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      total: this.obligations.length,
      draft: this.obligations.filter(o => o.status === "draft").length,
      completed: this.obligations.filter(o => o.status === "completed").length,
      approved: this.obligations.filter(o => o.status === "approved").length,
      thisMonth: this.obligations.filter(o => o.createdAt >= thisMonth).length
    };
  }
  
  async exportToPDF(id: string): Promise<Blob> {
    await new Promise(resolve => setTimeout(resolve, 1000));
    throw new Error("PDF export not implemented yet - will be added when connecting to database");
  }
}
