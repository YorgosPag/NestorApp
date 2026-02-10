'use client';

/**
 * @fileoverview Documents Page Content — Παραστατικά AI
 * @description AccountingPageHeader + UnifiedDashboard toggle + AdvancedFiltersPanel + status tabs + document list with review
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-10
 * @updated 2026-02-10 — Collapsible dashboard via AccountingPageHeader + document type filter
 * @see ADR-ACC-005 AI Document Processing
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileText,
  Plus,
  Clock,
  CheckCircle,
  Eye,
} from 'lucide-react';
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { AdvancedFiltersPanel } from '@/components/core/AdvancedFilters/AdvancedFiltersPanel';
import type { FilterPanelConfig, GenericFilterState } from '@/components/core/AdvancedFilters/types';
import { formatCurrencyOrDash } from '../../utils/format';
import { AccountingPageHeader } from '../shared/AccountingPageHeader';
import { FiscalYearPicker } from '../shared/FiscalYearPicker';
import { DocumentReviewCard } from './DocumentReviewCard';
import { UploadDocumentDialog } from './UploadDocumentDialog';
import { useExpenseDocuments } from '../../hooks/useExpenseDocuments';
import { useExpenseDocument } from '../../hooks/useExpenseDocument';
import type { DocumentProcessingStatus, ReceivedExpenseDocument } from '../../types/documents';

// ============================================================================
// TYPES
// ============================================================================

type TabValue = 'all' | DocumentProcessingStatus;

interface DocumentFilterState extends GenericFilterState {
  documentType: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_FILTERS: DocumentFilterState = {
  documentType: 'all',
};

const STATUS_VARIANT_MAP: Record<DocumentProcessingStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  processing: 'secondary',
  review: 'outline',
  confirmed: 'default',
  rejected: 'destructive',
};

// ============================================================================
// HELPERS
// ============================================================================

function buildFilterConfig(t: (key: string) => string): FilterPanelConfig {
  return {
    title: 'filters.title',
    i18nNamespace: 'accounting',
    rows: [
      {
        id: 'documents-main',
        fields: [
          {
            id: 'documentType',
            type: 'select',
            label: 'filterLabels.documentType',
            ariaLabel: 'Document type',
            width: 1,
            options: [
              { value: 'all', label: t('filterOptions.allDocTypes') },
              { value: 'purchase_invoice', label: t('documentTypes.purchase_invoice') },
              { value: 'receipt', label: t('documentTypes.receipt') },
              { value: 'utility_bill', label: t('documentTypes.utility_bill') },
              { value: 'telecom_bill', label: t('documentTypes.telecom_bill') },
              { value: 'other', label: t('documentTypes.other') },
            ],
          },
        ],
      },
    ],
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function DocumentsPageContent() {
  const { t } = useTranslation('accounting');

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState<TabValue>('all');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [showDashboard, setShowDashboard] = useState(true);
  const [filters, setFilters] = useState<DocumentFilterState>({ ...DEFAULT_FILTERS });

  const filterConfig = useMemo(() => buildFilterConfig(t), [t]);

  const statusFilter = activeTab === 'all' ? undefined : activeTab;
  const { documents, loading, error, refetch } = useExpenseDocuments({
    fiscalYear: selectedYear,
    status: statusFilter,
  });

  const {
    document: selectedDocument,
    confirming,
    confirmDocument,
    rejectDocument,
  } = useExpenseDocument(selectedDocId);

  const handleUploadSuccess = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleDocumentClick = useCallback((docId: string) => {
    setSelectedDocId((prev) => (prev === docId ? null : docId));
  }, []);

  const handleConfirm = useCallback(
    async (params: {
      confirmedCategory: ReceivedExpenseDocument['confirmedCategory'];
      confirmedNetAmount: number;
      confirmedVatAmount: number;
      confirmedDate: string;
      confirmedIssuerName: string;
    }) => {
      if (!params.confirmedCategory) return false;
      const result = await confirmDocument({
        confirmedCategory: params.confirmedCategory,
        confirmedNetAmount: params.confirmedNetAmount,
        confirmedVatAmount: params.confirmedVatAmount,
        confirmedDate: params.confirmedDate,
        confirmedIssuerName: params.confirmedIssuerName,
      });
      if (result) {
        refetch();
        setSelectedDocId(null);
      }
      return result;
    },
    [confirmDocument, refetch]
  );

  const handleReject = useCallback(
    async (notes?: string) => {
      const result = await rejectDocument(notes);
      if (result) {
        refetch();
        setSelectedDocId(null);
      }
      return result;
    },
    [rejectDocument, refetch]
  );

  // Filter documents by document type (client-side)
  const filteredDocuments = useMemo(() => {
    if (filters.documentType === 'all') return documents;
    return documents.filter((d) => d.type === filters.documentType);
  }, [documents, filters.documentType]);

  // Compute dashboard stats
  const dashboardStats: DashboardStat[] = useMemo(() => {
    const processingCount = documents.filter((d) => d.status === 'processing').length;
    const reviewCount = documents.filter((d) => d.status === 'review').length;
    const confirmedCount = documents.filter((d) => d.status === 'confirmed').length;

    return [
      {
        title: t('dashboard.totalDocuments'),
        value: documents.length,
        icon: FileText,
        color: 'blue' as const,
        loading,
      },
      {
        title: t('dashboard.processingDocs'),
        value: processingCount,
        icon: Clock,
        color: 'orange' as const,
        loading,
      },
      {
        title: t('dashboard.pendingReview'),
        value: reviewCount,
        icon: Eye,
        color: 'purple' as const,
        loading,
      },
      {
        title: t('dashboard.confirmedDocs'),
        value: confirmedCount,
        icon: CheckCircle,
        color: 'green' as const,
        loading,
      },
    ];
  }, [documents, loading, t]);

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <AccountingPageHeader
        icon={FileText}
        titleKey="documents.title"
        descriptionKey="documents.description"
        showDashboard={showDashboard}
        onDashboardToggle={() => setShowDashboard(!showDashboard)}
        actions={[
          <div key="fiscal-year" className="w-32">
            <FiscalYearPicker value={selectedYear} onValueChange={setSelectedYear} />
          </div>,
          <Button key="new-doc" onClick={() => setUploadOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t('documents.newDocument')}
          </Button>,
        ]}
      />

      {/* Stats Dashboard */}
      {showDashboard && <UnifiedDashboard stats={dashboardStats} columns={4} />}

      {/* Document Type Filter */}
      <AdvancedFiltersPanel
        config={filterConfig}
        filters={filters}
        onFiltersChange={setFilters}
        defaultFilters={DEFAULT_FILTERS}
      />

      {/* Status Tabs */}
      <nav className="border-b border-border bg-card px-6 py-3 overflow-x-auto">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
          <TabsList>
            <TabsTrigger value="all">{t('common.all')}</TabsTrigger>
            <TabsTrigger value="processing">{t('documents.statuses.processing')}</TabsTrigger>
            <TabsTrigger value="review">{t('documents.statuses.review')}</TabsTrigger>
            <TabsTrigger value="confirmed">{t('documents.statuses.confirmed')}</TabsTrigger>
            <TabsTrigger value="rejected">{t('documents.statuses.rejected')}</TabsTrigger>
          </TabsList>
        </Tabs>
      </nav>

      {/* Content */}
      <section className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="large" />
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" onClick={refetch} className="mt-4">
                {t('common.retry')}
              </Button>
            </CardContent>
          </Card>
        ) : filteredDocuments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">{t('documents.noDocuments')}</p>
              <Button variant="outline" onClick={() => setUploadOpen(true)} className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                {t('documents.newDocument')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {filteredDocuments.map((doc) => {
              const statusVariant = STATUS_VARIANT_MAP[doc.status];
              const statusLabel = t(`documents.statuses.${doc.status}`);
              const isSelected = selectedDocId === doc.documentId;

              return (
                <li key={doc.documentId}>
                  <Card
                    className={`cursor-pointer transition-colors hover:bg-accent/50 ${isSelected ? 'ring-2 ring-primary' : ''}`}
                    onClick={() => handleDocumentClick(doc.documentId)}
                  >
                    <CardHeader className="py-3 px-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <CardTitle className="text-sm">{doc.fileName}</CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {doc.extractedData.issuerName ?? t('documents.unknownIssuer')}
                              {doc.extractedData.issueDate ? ` — ${doc.extractedData.issueDate}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium">
                            {formatCurrencyOrDash(doc.extractedData.grossAmount)}
                          </span>
                          <Badge variant={statusVariant}>{statusLabel}</Badge>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>

                  {/* Expanded Review Card */}
                  {isSelected && selectedDocument && (
                    <div className="mt-2">
                      <DocumentReviewCard
                        document={selectedDocument}
                        onConfirm={handleConfirm}
                        onReject={handleReject}
                        confirming={confirming}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Upload Dialog */}
      <UploadDocumentDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        fiscalYear={selectedYear}
        onSuccess={handleUploadSuccess}
      />
    </main>
  );
}
