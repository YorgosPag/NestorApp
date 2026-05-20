import { setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { generatePerfdiagId } from '@/services/enterprise-id.service';
import { EntityAuditService } from '@/services/entity-audit.service';
import { FIRESTORE_COLLECTIONS } from '@/config/firestore-collections';
import type { PerformanceMetricsSnapshot } from './PerformanceHUDStore';

export interface DiagnosticInput {
  companyId: string;
  userId: string;
  projectId: string | null;
  metrics: PerformanceMetricsSnapshot;
  renderMode: string;
  canvas: HTMLCanvasElement;
  comment: string;
}

export async function sendDiagnostic(input: DiagnosticInput): Promise<void> {
  const { companyId, userId, projectId, metrics, renderMode, canvas, comment } = input;
  const docId = generatePerfdiagId();

  // Screenshot PNG → Storage
  const dataUrl = canvas.toDataURL('image/png', 0.92);
  const base64Data = dataUrl.split(',')[1] ?? dataUrl;
  const storagePath = `performance_diagnostics/${companyId}/${docId}/screenshot.png`;
  const storageRef = ref(storage, storagePath);
  await uploadString(storageRef, base64Data, 'base64', { contentType: 'image/png' });
  const screenshotUrl = await getDownloadURL(storageRef);

  // Firestore doc
  await setDoc(doc(db, FIRESTORE_COLLECTIONS.PERFORMANCE_DIAGNOSTICS, docId), {
    id: docId,
    companyId,
    userId,
    projectId,
    renderMode,
    metrics,
    screenshotUrl,
    comment: comment || null,
    createdAt: serverTimestamp(),
  });

  // Audit trail — fire-and-forget
  void EntityAuditService.recordChange({
    companyId,
    entityType: 'performance_diagnostic',
    entityId: docId,
    action: 'create',
    userId,
    changes: { renderMode, fps: metrics.fps },
  });
}
