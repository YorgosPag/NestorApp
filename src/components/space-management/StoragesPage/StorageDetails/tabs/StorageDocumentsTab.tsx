'use client';

import React, { useState } from 'react';
import type { Storage } from '@/types/storage/contracts';
import { formatDate, formatCurrency } from '@/lib/intl-utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  FileText,
  Download,
  Eye,
  Upload,
  Calendar,
  User,
  Building,
  FileCheck,
  AlertTriangle,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StorageDocumentsTabProps {
  storage: Storage;
}

// Τύποι εγγράφων βάση του storage
interface Document {
  id: string;
  name: string;
  type: 'contract' | 'lease' | 'inspection' | 'insurance' | 'maintenance' | 'legal';
  size: string;
  lastModified: Date;
  status: 'active' | 'pending' | 'expired' | 'draft';
  description?: string;
  relatedTo?: string;
}

function getDocumentIcon(type: Document['type']) {
  switch (type) {
    case 'contract': return FileCheck;
    case 'lease': return Building;
    case 'inspection': return Eye;
    case 'insurance': return AlertTriangle;
    case 'maintenance': return Clock;
    case 'legal': return FileText;
    default: return FileText;
  }
}

// Helper function to get document type label - uses i18n from component
function getDocumentTypeLabelKey(type: Document['type']): string {
  switch (type) {
    case 'contract': return 'documents.types.contract';
    case 'lease': return 'documents.types.lease';
    case 'inspection': return 'documents.types.inspection';
    case 'insurance': return 'documents.types.insurance';
    case 'maintenance': return 'documents.types.maintenance';
    case 'legal': return 'documents.types.legal';
    default: return 'documents.types.document';
  }
}

function getStatusColor(status: Document['status'], colors: ReturnType<typeof useSemanticColors>) {
  switch (status) {
    case 'active': return `${colors.text.success} ${colors.bg.success}`;
    case 'pending': return `${colors.text.warning} ${colors.bg.warning}`;
    case 'expired': return `${colors.text.danger} ${colors.bg.error}`;
    case 'draft': return `${colors.text.info} ${colors.bg.info}`;
    default: return `${colors.text.muted} ${colors.bg.secondary}`;
  }
}

// Helper function to get status label key - uses i18n from component
function getStatusLabelKey(status: Document['status']): string {
  switch (status) {
    case 'active': return 'documents.statuses.active';
    case 'pending': return 'documents.statuses.pending';
    case 'expired': return 'documents.statuses.expired';
    case 'draft': return 'documents.statuses.draft';
    default: return 'documents.statuses.unknown';
  }
}

export function StorageDocumentsTab({ storage }: StorageDocumentsTabProps) {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('storage');

  // Γεννάμε πραγματικά έγγραφα βάση των στοιχείων της αποθήκης
  const [documents] = useState<Document[]>([
    {
      id: '1',
      name: `Συμβόλαιο_Αποθήκης_${storage.name.replace(/\s+/g, '_')}.pdf`,
      type: 'contract',
      size: '2.4 MB',
      lastModified: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 ημέρες πριν
      status: storage.status === 'available' ? 'draft' : 'active',
      description: `Συμβόλαιο ${storage.status === 'occupied' ? 'μίσθωσης' : 'πώλησης'} της αποθήκης ${storage.name}`,
      relatedTo: storage.owner || 'Διαχείριση Κτιρίου'
    },
    {
      id: '2',
      name: `Επιθεώρηση_${storage.building}_${storage.floor}_${new Date().getFullYear()}.pdf`,
      type: 'inspection',
      size: '1.8 MB',
      lastModified: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 ημέρες πριν
      status: 'active',
      description: `Ετήσια επιθεώρηση αποθήκης στον ${storage.floor}, ${storage.building}`,
      relatedTo: 'Τεχνικός Έλεγχος'
    },
    ...(storage.status === 'occupied' ? [{
      id: '3',
      name: `Μίσθωση_${storage.name}_2024-2025.pdf`,
      type: 'lease' as const,
      size: '1.2 MB',
      lastModified: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 ημέρες πριν
      status: 'active' as const,
      description: `Συμβόλαιο μίσθωσης αποθήκης ${storage.area} m² - ${formatCurrency(storage.price || 0)}/μήνα`,
      relatedTo: storage.owner || 'Μισθωτής'
    }] : []),
    ...(storage.status === 'maintenance' ? [{
      id: '4',
      name: `Συντήρηση_${storage.name}_${new Date().toISOString().slice(0, 7)}.pdf`,
      type: 'maintenance' as const,
      size: '0.9 MB',
      lastModified: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 ημέρες πριν
      status: 'pending' as const,
      description: `Εργασίες συντήρησης και αναβάθμισης της αποθήκης`,
      relatedTo: 'Συνεργείο Συντήρησης'
    }] : []),
    {
      id: '5',
      name: `Ασφάλιση_Αποθηκών_${storage.building}_2024.pdf`,
      type: 'insurance',
      size: '3.1 MB',
      lastModified: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 ημέρες πριν
      status: new Date().getMonth() > 10 ? 'expired' : 'active', // Λήγει Δεκέμβριο
      description: `Ασφαλιστήριο συμβόλαιο για αποθήκες κτιρίου ${storage.building}`,
      relatedTo: 'Ασφαλιστική Εταιρεία'
    }
  ]);

  const activeDocuments = documents.filter(doc => doc.status === 'active');
  const pendingDocuments = documents.filter(doc => doc.status === 'pending');
  const expiredDocuments = documents.filter(doc => doc.status === 'expired');

  return (
    <div className="p-6 space-y-6">
      {/* Στατιστικά Εγγράφων */}
      <section>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <FileText className={iconSizes.md} />
          {t('documents.overview')}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={`bg-card ${quick.card} p-4 text-center`}>
            <div className={`text-2xl font-bold ${colors.text.info}`}>{documents.length}</div>
            <div className="text-sm text-muted-foreground">{t('documents.totalDocuments')}</div>
          </div>
          <div className={`bg-card ${quick.card} p-4 text-center`}>
            <div className={`text-2xl font-bold ${colors.text.success}`}>{activeDocuments.length}</div>
            <div className="text-sm text-muted-foreground">{t('documents.active')}</div>
          </div>
          <div className={`bg-card ${quick.card} p-4 text-center`}>
            <div className={`text-2xl font-bold ${colors.text.warning}`}>{pendingDocuments.length}</div>
            <div className="text-sm text-muted-foreground">{t('documents.pending')}</div>
          </div>
          <div className={`bg-card ${quick.card} p-4 text-center`}>
            <div className={`text-2xl font-bold ${colors.text.danger}`}>{expiredDocuments.length}</div>
            <div className="text-sm text-muted-foreground">{t('documents.expired')}</div>
          </div>
        </div>
      </section>

      {/* Upload Περιοχή */}
      <section>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Upload className={iconSizes.md} />
          {t('documents.uploadTitle')}
        </h3>
        <div className="border border-dashed border-border rounded-lg p-6 text-center">
          <Upload className={`${iconSizes.xl} mx-auto mb-2 text-muted-foreground`} />
          <p className="text-sm text-muted-foreground mb-2">
            {t('documents.dropzoneHint')}
          </p>
          <Button variant="outline" size="sm">
            {t('documents.selectFiles')}
          </Button>
        </div>
      </section>

      {/* Λίστα Εγγράφων */}
      <section>
        <h3 className="font-semibold mb-4">{t('documents.storageDocuments')}</h3>
        <div className="space-y-3">
          {documents.map((doc) => {
            const IconComponent = getDocumentIcon(doc.type);
            return (
              <div key={doc.id} className={`${quick.card} p-4 hover:bg-accent/50 transition-colors`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="p-2 bg-primary/10 rounded-md">
                      <IconComponent className={`${iconSizes.md} text-primary`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium truncate">{doc.name}</h4>
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(doc.status, colors)}`}>
                          {t(getStatusLabelKey(doc.status))}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <FileText className={iconSizes.xs} />
                          {t(getDocumentTypeLabelKey(doc.type))}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className={iconSizes.xs} />
                          {formatDate(doc.lastModified.toISOString())}
                        </span>
                        <span>{doc.size}</span>
                        {doc.relatedTo && (
                          <span className="flex items-center gap-1">
                            <User className={iconSizes.xs} />
                            {doc.relatedTo}
                          </span>
                        )}
                      </div>
                      {doc.description && (
                        <p className="text-sm text-muted-foreground mt-1 truncate">
                          {doc.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm">
                      <Eye className={iconSizes.sm} />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Download className={iconSizes.sm} />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Σχετικές Πληροφορίες */}
      <section>
        <h3 className="font-semibold mb-4">{t('documents.relatedInfo')}</h3>
        <div className={`bg-card ${quick.card} p-4`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <label className="font-medium text-muted-foreground">{t('documents.fields.storage')}</label>
              <span className="ml-2">{storage.name} ({storage.area} m²)</span>
            </div>
            <div>
              <label className="font-medium text-muted-foreground">{t('documents.fields.location')}</label>
              <span className="ml-2">{storage.building}, {storage.floor}</span>
            </div>
            <div>
              <label className="font-medium text-muted-foreground">{t('documents.fields.status')}</label>
              <span className="ml-2">
                {t(`general.statuses.${storage.status}`)}
              </span>
            </div>
            {storage.price && (
              <div>
                <label className="font-medium text-muted-foreground">{t('documents.fields.value')}</label>
                <span className="ml-2">{formatCurrency(storage.price)}</span>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}