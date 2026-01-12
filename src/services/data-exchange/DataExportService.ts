'use client';

// ============================================================================
// 🏢 ENTERPRISE: Type Definitions (ADR-compliant - NO any)
// ============================================================================

/** Primitive export value types */
export type ExportValue = string | number | boolean | Date | null | undefined;

/** Export record type */
export type ExportRecord = Record<string, ExportValue | Record<string, unknown>>;

/** Cell style properties */
export interface CellStyle {
  backgroundColor?: string;
  color?: string;
  fontWeight?: 'normal' | 'bold';
  fontSize?: number;
  textAlign?: 'left' | 'center' | 'right';
  border?: string;
  padding?: string;
}

// Data Export Service with multiple formats
export type ExportFormat = 'csv' | 'xlsx' | 'json' | 'pdf' | 'xml';

export interface ExportColumn {
  key: string;
  label: string;
  type?: 'string' | 'number' | 'date' | 'boolean';
  formatter?: (value: ExportValue) => string;
  width?: number;
}

export interface ExportOptions {
  format: ExportFormat;
  filename?: string;
  columns: ExportColumn[];
  data: ExportRecord[];
  metadata?: {
    title?: string;
    description?: string;
    author?: string;
    company?: string;
  };
  styling?: {
    headerStyle?: CellStyle;
    rowStyle?: CellStyle;
    alternateRowStyle?: CellStyle;
  };
}

export interface ExportProgress {
  processed: number;
  total: number;
  percentage: number;
  stage: string;
}

class DataExportService {
  private static instance: DataExportService;

  static getInstance(): DataExportService {
    if (!DataExportService.instance) {
      DataExportService.instance = new DataExportService();
    }
    return DataExportService.instance;
  }

  async exportData(
    options: ExportOptions,
    onProgress?: (progress: ExportProgress) => void
  ): Promise<Blob> {
    const { format, data, columns } = options;
    
    onProgress?.({ processed: 0, total: data.length, percentage: 0, stage: 'Preparing export' });

    switch (format) {
      case 'csv':
        return this.exportCSV(options, onProgress);
      case 'xlsx':
        return this.exportXLSX(options, onProgress);
      case 'json':
        return this.exportJSON(options, onProgress);
      case 'pdf':
        return this.exportPDF(options, onProgress);
      case 'xml':
        return this.exportXML(options, onProgress);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private async exportCSV(
    options: ExportOptions,
    onProgress?: (progress: ExportProgress) => void
  ): Promise<Blob> {
    const { columns, data } = options;
    
    onProgress?.({ processed: 0, total: data.length, percentage: 0, stage: 'Generating CSV headers' });
    
    // Create CSV content
    const headers = columns.map(col => this.escapeCSV(col.label)).join(',');
    const rows: string[] = [headers];
    
    // Process data rows
    data.forEach((item, index) => {
      const row = columns.map(col => {
        const value = this.getValueByPath(item, col.key);
        const formatted = col.formatter ? col.formatter(value) : String(value || '');
        return this.escapeCSV(formatted);
      }).join(',');
      
      rows.push(row);
      
      if (index % 100 === 0) {
        onProgress?.({
          processed: index + 1,
          total: data.length,
          percentage: ((index + 1) / data.length) * 100,
          stage: 'Processing CSV rows'
        });
      }
    });

    const csvContent = rows.join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' });
    
    onProgress?.({ processed: data.length, total: data.length, percentage: 100, stage: 'Complete' });
    return blob;
  }

  private async exportJSON(
    options: ExportOptions,
    onProgress?: (progress: ExportProgress) => void
  ): Promise<Blob> {
    const { columns, data, metadata } = options;
    
    onProgress?.({ processed: 0, total: data.length, percentage: 0, stage: 'Processing JSON data' });
    
    const processedData = data.map((item, index) => {
      const processedItem: Record<string, ExportValue | string> = {};

      columns.forEach(col => {
        const value = this.getValueByPath(item, col.key);
        processedItem[col.key] = col.formatter ? col.formatter(value) : value;
      });
      
      if (index % 100 === 0) {
        onProgress?.({
          processed: index + 1,
          total: data.length,
          percentage: ((index + 1) / data.length) * 100,
          stage: 'Processing JSON rows'
        });
      }
      
      return processedItem;
    });

    const exportObject = {
      metadata: {
        ...metadata,
        exportDate: new Date().toISOString(),
        recordCount: data.length
      },
      columns: columns.map(col => ({
        key: col.key,
        label: col.label,
        type: col.type || 'string'
      })),
      data: processedData
    };

    const jsonContent = JSON.stringify(exportObject, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
    
    onProgress?.({ processed: data.length, total: data.length, percentage: 100, stage: 'Complete' });
    return blob;
  }

  private async exportXML(
    options: ExportOptions,
    onProgress?: (progress: ExportProgress) => void
  ): Promise<Blob> {
    const { columns, data, metadata } = options;
    
    onProgress?.({ processed: 0, total: data.length, percentage: 0, stage: 'Generating XML structure' });
    
    let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xmlContent += '<export>\n';
    
    // Add metadata
    if (metadata) {
      xmlContent += '  <metadata>\n';
      Object.entries(metadata).forEach(([key, value]) => {
        xmlContent += `    <${key}>${this.escapeXML(String(value))}</${key}>\n`;
      });
      xmlContent += `    <exportDate>${new Date().toISOString()}</exportDate>\n`;
      xmlContent += `    <recordCount>${data.length}</recordCount>\n`;
      xmlContent += '  </metadata>\n';
    }
    
    xmlContent += '  <data>\n';
    
    data.forEach((item, index) => {
      xmlContent += '    <record>\n';
      
      columns.forEach(col => {
        const value = this.getValueByPath(item, col.key);
        const formatted = col.formatter ? col.formatter(value) : String(value || '');
        xmlContent += `      <${col.key}>${this.escapeXML(formatted)}</${col.key}>\n`;
      });
      
      xmlContent += '    </record>\n';
      
      if (index % 100 === 0) {
        onProgress?.({
          processed: index + 1,
          total: data.length,
          percentage: ((index + 1) / data.length) * 100,
          stage: 'Processing XML records'
        });
      }
    });
    
    xmlContent += '  </data>\n';
    xmlContent += '</export>';
    
    const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
    
    onProgress?.({ processed: data.length, total: data.length, percentage: 100, stage: 'Complete' });
    return blob;
  }

  private async exportXLSX(
    options: ExportOptions,
    onProgress?: (progress: ExportProgress) => void
  ): Promise<Blob> {
    // Note: This would require a library like xlsx or exceljs
    // For now, we'll create a simple Excel-compatible format
    onProgress?.({ processed: 0, total: options.data.length, percentage: 0, stage: 'Excel export not fully implemented' });
    
    // Fallback to CSV for now
    return this.exportCSV(options, onProgress);
  }

  private async exportPDF(
    options: ExportOptions,
    onProgress?: (progress: ExportProgress) => void
  ): Promise<Blob> {
    // Note: This would require jsPDF
    // For now, return a simple text-based format
    onProgress?.({ processed: 0, total: options.data.length, percentage: 0, stage: 'PDF export not fully implemented' });
    
    // Fallback to CSV for now
    return this.exportCSV(options, onProgress);
  }

  // Utility methods
  private escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private escapeXML(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private getValueByPath(obj: ExportRecord, path: string): ExportValue {
    const result = path.split('.').reduce<unknown>((current, key) => {
      if (current && typeof current === 'object') {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);

    // Ensure we return a valid ExportValue
    if (result === null || result === undefined) return null;
    if (typeof result === 'string' || typeof result === 'number' || typeof result === 'boolean') {
      return result;
    }
    if (result instanceof Date) return result;
    return String(result);
  }

  // Download helper
  downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Get appropriate file extension
  getFileExtension(format: ExportFormat): string {
    const extensions = {
      csv: 'csv',
      xlsx: 'xlsx',
      json: 'json',
      pdf: 'pdf',
      xml: 'xml'
    };
    return extensions[format];
  }

  // Validate export options
  validateOptions(options: ExportOptions): string[] {
    const errors: string[] = [];

    if (!options.columns || options.columns.length === 0) {
      errors.push('At least one column must be specified');
    }

    if (!options.data || options.data.length === 0) {
      errors.push('No data to export');
    }

    if (!['csv', 'xlsx', 'json', 'pdf', 'xml'].includes(options.format)) {
      errors.push('Invalid export format');
    }

    return errors;
  }
}

export default DataExportService;