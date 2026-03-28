/**
 * @module reports/sections/export/types
 * @enterprise ADR-265 Phase 13 — Export Center view-model types
 */

import type { LucideIcon } from 'lucide-react';
import type { ExportFormat } from '@/components/reports/core/ReportExportBar';

export interface ExportDomainCard {
  /** i18n key for the domain title */
  titleKey: string;
  /** i18n key for the domain description */
  descriptionKey: string;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Route for the live report */
  href: string;
  /** Available export formats */
  formats: ExportFormat[];
  /** Domain ID matching the API route */
  domain: ExportDomain;
}

export type ExportDomain =
  | 'executive'
  | 'financial'
  | 'sales'
  | 'projects'
  | 'crm'
  | 'contacts'
  | 'spaces'
  | 'construction'
  | 'compliance';

export interface ExportJob {
  domain: ExportDomain;
  format: ExportFormat;
  status: 'pending' | 'exporting' | 'done' | 'error';
  error?: string;
}
