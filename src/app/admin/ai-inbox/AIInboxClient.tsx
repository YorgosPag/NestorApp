'use client';

/**
 * =============================================================================
 * 🏢 ENTERPRISE: AI INBOX CLIENT - UI Component
 * =============================================================================
 *
 * Client component για AI Inbox UI rendering και interactions.
 * Receives admin context from Server Component parent.
 *
 * @component AIInboxClient
 * @enterprise Client-side UI, server-side auth
 * @created 2026-02-03
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Inbox, CheckCircle, XCircle, Eye, AlertTriangle } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import toast from 'react-hot-toast';
import type { Communication } from '@/types/crm';
import type { AdminContext } from '@/server/admin/admin-guards';
import {
  getPendingTriageCommunications,
  approveCommunication,
  rejectCommunication
} from '@/services/communications.service';

// ============================================================================
// LOGGER
// ============================================================================

const logger = createModuleLogger('AI_INBOX_CLIENT');

// ============================================================================
// FEATURE FLAGS
// ============================================================================

const ENABLE_MOCK_DATA = process.env.NODE_ENV === 'development';

// ============================================================================
// MOCK DATA (Development Only)
// ============================================================================

const getMockCommunications = (): Communication[] => {
  if (!ENABLE_MOCK_DATA) return [];

  return [
    {
      id: '1',
      type: 'telegram',
      direction: 'inbound',
      from: 'Γιώργος Παπαδόπουλος',
      subject: 'Ερώτηση για διαθέσιμα διαμερίσματα',
      content: 'Καλημέρα, ενδιαφέρομαι για διαμερίσματα στο έργο Χαλάνδρι. Έχετε διαθέσιμα 2άρια;',
      createdAt: '2026-02-03T10:30:00Z',
      updatedAt: '2026-02-03T10:30:00Z',
      contactId: 'contact_1',
      createdBy: 'system',
      status: 'pending',
      intentAnalysis: {
        kind: 'message_intent',
        intentType: 'info_update',
        confidence: 0.85,
        needsTriage: false,
        aiModel: 'mock-provider-v1',
        analysisTimestamp: '2026-02-03T10:30:01Z',
        rawMessage: 'Καλημέρα, ενδιαφέρομαι για διαμερίσματα...',
        extractedEntities: {}
      },
      triageStatus: 'pending'
    },
    {
      id: '2',
      type: 'email',
      direction: 'inbound',
      from: 'maria@example.com',
      subject: 'Παράδοση οικοδομικών υλικών',
      content: 'Αύριο στις 3μμ θα παραδοθούν τα υλικά στο εργοτάξιο.',
      createdAt: '2026-02-03T09:15:00Z',
      updatedAt: '2026-02-03T09:15:00Z',
      contactId: 'contact_2',
      createdBy: 'system',
      status: 'pending',
      intentAnalysis: {
        kind: 'message_intent',
        intentType: 'delivery',
        confidence: 0.92,
        needsTriage: false,
        aiModel: 'mock-provider-v1',
        analysisTimestamp: '2026-02-03T09:15:01Z',
        rawMessage: 'Αύριο στις 3μμ...',
        extractedEntities: {}
      },
      triageStatus: 'pending'
    },
    {
      id: '3',
      type: 'telegram',
      direction: 'inbound',
      from: 'Νίκος Κωνσταντίνου',
      subject: 'Πρόβλημα με την πόρτα',
      content: 'Η πόρτα του διαμερίσματος δεν κλειδώνει σωστά. Χρειάζεται επισκευή.',
      createdAt: '2026-02-03T08:45:00Z',
      updatedAt: '2026-02-03T08:45:00Z',
      contactId: 'contact_3',
      createdBy: 'system',
      status: 'pending',
      intentAnalysis: {
        kind: 'message_intent',
        intentType: 'issue',
        confidence: 0.78,
        needsTriage: true,
        aiModel: 'mock-provider-v1',
        analysisTimestamp: '2026-02-03T08:45:01Z',
        rawMessage: 'Η πόρτα δεν κλειδώνει...',
        extractedEntities: {}
      },
      triageStatus: 'pending'
    }
  ];
};

// ============================================================================
// DESIGN SYSTEM - Badge Variants
// ============================================================================

type IntentBadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

const getIntentBadgeVariant = (intentType?: string): IntentBadgeVariant => {
  switch (intentType) {
    case 'delivery':
    case 'appointment':
      return 'default';
    case 'issue':
      return 'destructive';
    case 'payment':
    case 'info_update':
      return 'secondary';
    default:
      return 'outline';
  }
};

const getConfidenceBadgeVariant = (confidence?: number): IntentBadgeVariant => {
  if (!confidence) return 'outline';
  return confidence >= 0.8 ? 'default' : confidence >= 0.6 ? 'secondary' : 'destructive';
};

// ============================================================================
// PROPS
// ============================================================================

interface AIInboxClientProps {
  adminContext: AdminContext;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function AIInboxClient({ adminContext }: AIInboxClientProps) {
  const router = useRouter();
  const { t } = useTranslation('admin');

  // 🏢 ENTERPRISE: Type refinement - Firestore docs always have id
  const [communications, setCommunications] = useState<Array<Communication & { id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // =========================================================================
  // LOAD PENDING COMMUNICATIONS
  // =========================================================================

  const loadPendingCommunications = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 🏢 ENTERPRISE: Real data fetching via server action with tenant isolation
      const companyId = adminContext.companyId;

      if (!companyId) {
        throw new Error('Admin user has no companyId - tenant isolation violated');
      }

      const data = await getPendingTriageCommunications(companyId);

      // Fallback to mock data if empty (development only)
      const finalData = data.length > 0 ? data : (ENABLE_MOCK_DATA ? getMockCommunications() : []);
      // 🏢 ENTERPRISE: Type assertion - all Firestore documents have id
      setCommunications(finalData as Array<Communication & { id: string }>);

      logger.info('Loaded pending communications', {
        count: finalData.length,
        source: data.length > 0 ? 'firestore' : 'mock',
        adminUid: adminContext.uid
      });
    } catch (err) {
      logger.error('Failed to load communications', { error: err });
      setError(err instanceof Error ? err.message : 'Unknown error');

      // Fallback to mock data on error (development only)
      if (ENABLE_MOCK_DATA) {
        const mockData = getMockCommunications();
        // 🏢 ENTERPRISE: Type assertion - mock data has ids
        setCommunications(mockData as Array<Communication & { id: string }>);
        logger.warn('Using mock data due to fetch error', { count: mockData.length });
      }
    } finally {
      setLoading(false);
    }
  }, [adminContext.uid]);

  useEffect(() => {
    loadPendingCommunications();
  }, [loadPendingCommunications]);

  // =========================================================================
  // ACTIONS
  // =========================================================================

  const handleApprove = async (commId: string) => {
    setActionLoading(commId);
    try {
      // 🏢 ENTERPRISE: Real server action με idempotent task creation
      const result = await approveCommunication(commId, adminContext.uid);

      // Update local state
      setCommunications(prev =>
        prev.map(comm =>
          comm.id === commId
            ? { ...comm, triageStatus: 'approved' as const, linkedTaskId: result.taskId }
            : comm
        )
      );

      toast.success(t('admin.approveSuccess'));
      logger.info('Communication approved', {
        communicationId: commId,
        taskId: result.taskId,
        adminUid: adminContext.uid
      });
    } catch (err) {
      logger.error('Approve failed', { communicationId: commId, error: err });
      toast.error(t('admin.approveFailed'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (commId: string) => {
    setActionLoading(commId);
    try {
      // 🏢 ENTERPRISE: Real server action για reject
      await rejectCommunication(commId);

      setCommunications(prev =>
        prev.map(comm =>
          comm.id === commId
            ? { ...comm, triageStatus: 'rejected' as const }
            : comm
        )
      );

      toast.success(t('admin.rejectSuccess'));
      logger.info('Communication rejected', {
        communicationId: commId,
        adminUid: adminContext.uid
      });
    } catch (err) {
      logger.error('Reject failed', { communicationId: commId, error: err });
      toast.error(t('admin.rejectFailed'));
    } finally {
      setActionLoading(null);
    }
  };

  // =========================================================================
  // MAIN RENDER
  // =========================================================================

  const pendingCount = communications.filter(c => c.triageStatus === 'pending').length;

  return (
    <main className="container mx-auto py-10">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Inbox className="h-8 w-8" />
              {t('admin.aiInboxTitle')}
            </h1>
            <p className="text-muted-foreground mt-2">
              {t('admin.aiInboxDescription')}
            </p>
            {/* Admin Context Debug (Development Only) */}
            {process.env.NODE_ENV === 'development' && (
              <p className="text-xs text-muted-foreground mt-1">
                👤 {adminContext.email} ({adminContext.role})
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* 🏢 ENTERPRISE: Badge μόνο όταν count > 0 */}
            {pendingCount > 0 && (
              <Badge variant="outline" className="text-lg px-3 py-1">
                {pendingCount} {t('admin.pending')}
              </Badge>
            )}
            <Button onClick={loadPendingCommunications} variant="outline" size="sm">
              <Loader2 className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {t('admin.refresh')}
            </Button>
          </div>
        </header>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Communications Table */}
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.pendingMessages')}</CardTitle>
            <CardDescription>
              {t('admin.pendingMessagesDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : communications.length === 0 ? (
              <div className="text-center py-10">
                <Inbox className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">{t('admin.noPendingMessages')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('admin.from')}</TableHead>
                      <TableHead>{t('admin.channel')}</TableHead>
                      <TableHead>{t('admin.content')}</TableHead>
                      <TableHead>{t('admin.intent')}</TableHead>
                      <TableHead>{t('admin.confidence')}</TableHead>
                      <TableHead>{t('admin.status')}</TableHead>
                      <TableHead>{t('admin.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {communications.map((comm) => (
                      <TableRow key={comm.id}>
                        <TableCell className="font-medium">
                          {comm.from || t('admin.unknownSender')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{comm.type}</Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {comm.content}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getIntentBadgeVariant(comm.intentAnalysis?.intentType)}>
                            {comm.intentAnalysis?.intentType || t('admin.unknownIntent')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {comm.intentAnalysis?.confidence && (
                            <Badge variant={getConfidenceBadgeVariant(comm.intentAnalysis.confidence)}>
                              {Math.round(comm.intentAnalysis.confidence * 100)}%
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {comm.triageStatus === 'approved' ? (
                            <Badge variant="default">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              {t('admin.approved')}
                            </Badge>
                          ) : comm.triageStatus === 'rejected' ? (
                            <Badge variant="destructive">
                              <XCircle className="h-3 w-3 mr-1" />
                              {t('admin.rejected')}
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              {t('admin.pending')}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {comm.triageStatus === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => handleApprove(comm.id)}
                                  disabled={actionLoading === comm.id}
                                >
                                  {actionLoading === comm.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <CheckCircle className="h-4 w-4 mr-1" />
                                      {t('admin.approve')}
                                    </>
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleReject(comm.id)}
                                  disabled={actionLoading === comm.id}
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
                                  {t('admin.reject')}
                                </Button>
                              </>
                            )}
                            {comm.linkedTaskId && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => router.push(`/crm/tasks/${comm.linkedTaskId}`)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                {t('admin.viewTask')}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('admin.howItWorks')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>1. {t('admin.howItWorksStep1')}</p>
            <p>2. {t('admin.howItWorksStep2')}</p>
            <p>3. {t('admin.howItWorksStep3')}</p>
            <p>4. {t('admin.howItWorksStep4')}</p>
            <p>5. {t('admin.howItWorksStep5')}</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
