'use client';

/**
 * 🏢 ENTERPRISE: Data Import Service with Type-Safe Validation
 *
 * Generic implementation following SAP/Autodesk/Bentley patterns.
 * Zero `any` types - fully type-safe import pipeline.
 *
 * @template T - The type of records being imported
 * @template TRaw - The type of raw data before transformation (default: Record<string, unknown>)
 */

// ============================================================================
// 🏢 ENTERPRISE: Type Definitions
// ============================================================================

export type ImportFormat = 'csv' | 'xlsx' | 'json' | 'xml';

/** Primitive value types that can be imported */
export type ImportValue = string | number | boolean | Date | null | undefined;

/** Raw record structure before transformation */
export type RawRecord = Record<string, unknown>;

/** Validated value with optional error/warning */
export interface ValidatedValue<T = ImportValue> {
  value: T | null;
  error?: ImportError;
  warning?: ImportWarning;
}

/** Type-safe column configuration */
export interface ImportColumn<TValue = ImportValue> {
  sourceKey: string;
  targetKey: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'email';
  required?: boolean;
  /** Validates the converted value, returns error message or null */
  validator?: (value: TValue) => string | null;
  /** Transforms raw value before type conversion */
  transformer?: (value: unknown) => unknown;
  defaultValue?: TValue;
}

export interface ImportOptions {
  format: ImportFormat;
  columns: ImportColumn[];
  skipFirstRow?: boolean;
  delimiter?: string; // For CSV
  validateBeforeImport?: boolean;
  maxRecords?: number;
  duplicateHandling?: 'skip' | 'update' | 'create';
  errorHandling?: 'stop' | 'continue' | 'collect';
}

/** 🏢 ENTERPRISE: Generic import result with full type safety */
export interface ImportResult<T = RawRecord> {
  success: boolean;
  totalRecords: number;
  processedRecords: number;
  validRecords: number;
  invalidRecords: number;
  data: T[];
  errors: ImportError[];
  warnings: ImportWarning[];
  duplicates: T[];
  executionTime: number;
}

export interface ImportError {
  row: number;
  field?: string;
  message: string;
  value?: unknown;
}

export interface ImportWarning {
  row: number;
  field?: string;
  message: string;
  value?: unknown;
}

export interface ImportProgress {
  stage: string;
  processed: number;
  total: number;
  percentage: number;
  errors: number;
  warnings: number;
}

class DataImportService {
  private static instance: DataImportService;

  static getInstance(): DataImportService {
    if (!DataImportService.instance) {
      DataImportService.instance = new DataImportService();
    }
    return DataImportService.instance;
  }

  async importData(
    file: File,
    options: ImportOptions,
    onProgress?: (progress: ImportProgress) => void
  ): Promise<ImportResult> {
    const startTime = performance.now();
    
    onProgress?.({
      stage: 'Reading file',
      processed: 0,
      total: 0,
      percentage: 0,
      errors: 0,
      warnings: 0
    });

    try {
      const rawData = await this.readFile(file, options);
      const result = await this.processData(rawData, options, onProgress);
      
      result.executionTime = performance.now() - startTime;
      return result;
      
    } catch (error) {
      return {
        success: false,
        totalRecords: 0,
        processedRecords: 0,
        validRecords: 0,
        invalidRecords: 0,
        data: [],
        errors: [{
          row: 0,
          message: error instanceof Error ? error.message : 'Unknown error occurred'
        }],
        warnings: [],
        duplicates: [],
        executionTime: performance.now() - startTime
      };
    }
  }

  private async readFile(file: File, options: ImportOptions): Promise<RawRecord[]> {
    const text = await file.text();

    switch (options.format) {
      case 'csv':
        return this.parseCSV(text, options);
      case 'json':
        return this.parseJSON(text);
      case 'xml':
        return this.parseXML(text);
      case 'xlsx':
        throw new Error('XLSX import not implemented yet');
      default:
        throw new Error(`Unsupported format: ${options.format}`);
    }
  }

  private parseCSV(text: string, options: ImportOptions): RawRecord[] {
    const lines = text.split('\n').filter(line => line.trim());
    const delimiter = options.delimiter || ',';
    const data: RawRecord[] = [];

    const startIndex = options.skipFirstRow ? 1 : 0;

    // Get headers if skipping first row
    const headers = options.skipFirstRow
      ? this.parseCSVLine(lines[0], delimiter)
      : options.columns.map((_, index) => `column_${index}`);

    for (let i = startIndex; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i], delimiter);
      const row: RawRecord = {};

      values.forEach((value, index) => {
        if (headers[index]) {
          row[headers[index]] = value;
        }
      });

      data.push(row);
    }

    return data;
  }

  private parseCSVLine(line: string, delimiter: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;
    
    while (i < line.length) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i += 2;
        } else {
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === delimiter && !inQuotes) {
        values.push(current.trim());
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }
    
    values.push(current.trim());
    return values;
  }

  private parseJSON(text: string): RawRecord[] {
    const parsed: unknown = JSON.parse(text);

    if (Array.isArray(parsed)) {
      return parsed as RawRecord[];
    } else if (this.isObjectWithDataArray(parsed)) {
      return parsed.data as RawRecord[];
    } else if (typeof parsed === 'object' && parsed !== null) {
      return [parsed as RawRecord];
    }

    throw new Error('Invalid JSON structure for import');
  }

  /** Type guard for objects with data array property */
  private isObjectWithDataArray(value: unknown): value is { data: unknown[] } {
    return (
      typeof value === 'object' &&
      value !== null &&
      'data' in value &&
      Array.isArray((value as { data: unknown }).data)
    );
  }

  private parseXML(text: string): RawRecord[] {
    // Simple XML parsing - in production, use a proper XML parser
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/xml');

    if (doc.documentElement.nodeName === 'parsererror') {
      throw new Error('Invalid XML format');
    }

    const records = doc.querySelectorAll('record');
    const data: RawRecord[] = [];

    records.forEach(record => {
      const row: RawRecord = {};
      record.childNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;
          row[element.nodeName] = element.textContent || '';
        }
      });
      data.push(row);
    });

    return data;
  }

  private async processData(
    rawData: RawRecord[],
    options: ImportOptions,
    onProgress?: (progress: ImportProgress) => void
  ): Promise<ImportResult<RawRecord>> {
    const { columns, maxRecords } = options;
    const data: RawRecord[] = [];
    const errors: ImportError[] = [];
    const warnings: ImportWarning[] = [];
    const duplicates: RawRecord[] = [];
    
    const totalRecords = Math.min(rawData.length, maxRecords || rawData.length);
    let processedRecords = 0;
    let validRecords = 0;
    let invalidRecords = 0;

    onProgress?.({
      stage: 'Processing records',
      processed: 0,
      total: totalRecords,
      percentage: 0,
      errors: 0,
      warnings: 0
    });

    for (let i = 0; i < totalRecords; i++) {
      const rawRecord = rawData[i];
      const { record, recordErrors, recordWarnings } = this.processRecord(
        rawRecord, 
        columns, 
        i + 1
      );

      processedRecords++;

      if (recordErrors.length > 0) {
        invalidRecords++;
        errors.push(...recordErrors);
        
        if (options.errorHandling === 'stop') {
          break;
        }
      } else {
        validRecords++;
        
        // Check for duplicates
        if (this.isDuplicate(record, data)) {
          duplicates.push(record);
          
          if (options.duplicateHandling === 'skip') {
            warnings.push({
              row: i + 1,
              message: 'Duplicate record skipped'
            });
            continue;
          }
        }
        
        data.push(record);
      }

      if (recordWarnings.length > 0) {
        warnings.push(...recordWarnings);
      }

      // Update progress
      if (i % 100 === 0 || i === totalRecords - 1) {
        onProgress?.({
          stage: 'Processing records',
          processed: processedRecords,
          total: totalRecords,
          percentage: (processedRecords / totalRecords) * 100,
          errors: errors.length,
          warnings: warnings.length
        });
      }
    }

    return {
      success: errors.length === 0 || options.errorHandling !== 'stop',
      totalRecords,
      processedRecords,
      validRecords,
      invalidRecords,
      data,
      errors,
      warnings,
      duplicates,
      executionTime: 0 // Will be set by caller
    };
  }

  private processRecord(
    rawRecord: RawRecord,
    columns: ImportColumn[],
    rowNumber: number
  ): {
    record: RawRecord;
    recordErrors: ImportError[];
    recordWarnings: ImportWarning[];
  } {
    const record: RawRecord = {};
    const recordErrors: ImportError[] = [];
    const recordWarnings: ImportWarning[] = [];

    columns.forEach(column => {
      const rawValue = rawRecord[column.sourceKey];
      let processedValue = rawValue;

      // Apply transformer
      if (column.transformer) {
        try {
          processedValue = column.transformer(rawValue);
        } catch (error) {
          recordErrors.push({
            row: rowNumber,
            field: column.targetKey,
            message: `Transformation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            value: rawValue
          });
          return;
        }
      }

      // Type conversion and validation
      const { value, error, warning } = this.validateAndConvert(
        processedValue,
        column,
        rowNumber
      );

      if (error) {
        recordErrors.push(error);
      }

      if (warning) {
        recordWarnings.push(warning);
      }

      // Set value (use default if null/undefined and default is provided)
      record[column.targetKey] = value !== null && value !== undefined 
        ? value 
        : column.defaultValue;
    });

    return { record, recordErrors, recordWarnings };
  }

  private validateAndConvert(
    value: unknown,
    column: ImportColumn,
    rowNumber: number
  ): ValidatedValue<ImportValue> {
    // Check required
    if (column.required && (value === null || value === undefined || value === '')) {
      return {
        value: null,
        error: {
          row: rowNumber,
          field: column.targetKey,
          message: `${column.label} is required`,
          value
        }
      };
    }

    // Skip validation for empty optional fields
    if (!column.required && (value === null || value === undefined || value === '')) {
      return { value: null };
    }

    let convertedValue: ImportValue;
    const warning: ImportWarning | undefined = undefined;

    // Type conversion with proper type guards
    try {
      switch (column.type) {
        case 'number': {
          const numValue = parseFloat(String(value));
          if (isNaN(numValue)) {
            throw new Error(`Cannot convert "${String(value)}" to number`);
          }
          convertedValue = numValue;
          break;
        }

        case 'boolean': {
          const stringValue = String(value).toLowerCase();
          convertedValue = ['true', '1', 'yes', 'y'].includes(stringValue);
          break;
        }

        case 'date': {
          const dateValue = new Date(String(value));
          if (isNaN(dateValue.getTime())) {
            throw new Error(`Cannot convert "${String(value)}" to date`);
          }
          convertedValue = dateValue;
          break;
        }

        case 'email': {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          const emailStr = String(value);
          if (!emailRegex.test(emailStr)) {
            throw new Error(`Invalid email format: "${emailStr}"`);
          }
          convertedValue = emailStr.toLowerCase();
          break;
        }

        case 'string':
        default:
          convertedValue = String(value);
          break;
      }
    } catch (error) {
      return {
        value: null,
        error: {
          row: rowNumber,
          field: column.targetKey,
          message: error instanceof Error ? error.message : 'Conversion error',
          value
        }
      };
    }

    // Custom validation
    if (column.validator) {
      const validationError = column.validator(convertedValue);
      if (validationError) {
        return {
          value: null,
          error: {
            row: rowNumber,
            field: column.targetKey,
            message: validationError,
            value: convertedValue
          }
        };
      }
    }

    return { value: convertedValue, warning };
  }

  private isDuplicate(record: RawRecord, existingData: RawRecord[]): boolean {
    // Simple duplicate detection - can be enhanced
    return existingData.some(existing =>
      JSON.stringify(existing) === JSON.stringify(record)
    );
  }

  // Utility methods
  validateImportOptions(options: ImportOptions): string[] {
    const errors: string[] = [];

    if (!options.columns || options.columns.length === 0) {
      errors.push('At least one column mapping must be specified');
    }

    if (!['csv', 'xlsx', 'json', 'xml'].includes(options.format)) {
      errors.push('Invalid import format');
    }

    return errors;
  }

  getSupportedFormats(): ImportFormat[] {
    return ['csv', 'json', 'xml']; // xlsx not implemented yet
  }
}

export default DataImportService;