// ============================================================================
// IMPORT/EXPORT TYPES
// ============================================================================

export interface ImportResult {
  processedRows: number;
  importedRelationships: number;
  createdContacts: number;
  errors: Array<{
    row: number;
    data: Record<string, unknown>;
    error: string;
  }>;
  summary: {
    totalTime: number;
    successRate: number;
  };
}

export interface ExportResult {
  fileName: string;
  recordCount: number;
  fileSize: number;
  downloadUrl?: string;
}

export interface ImportOptions {
  createMissingContacts?: boolean;
  updateExistingRelationships?: boolean;
  skipDuplicates?: boolean;
  validateData?: boolean;
}

export interface CSVRow {
  [key: string]: string;
}

export interface RelationshipImportRow {
  sourceEmail: string;
  targetEmail: string;
  relationshipType: string;
  position?: string;
  department?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  notes?: string;
}
