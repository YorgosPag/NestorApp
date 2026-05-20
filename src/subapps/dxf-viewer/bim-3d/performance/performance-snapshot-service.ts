import { setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { generatePerformanceDiagnosticId } from '@/services/enterprise-id.service';
import { COLLECTIONS } from '@/config/firestore-collections';
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
  const docId = generatePerformanceDiagnosticId();

  // Screenshot PNG → Storage
  const dataUrl = canvas.toDataURL('image/png', 0.92);
  const base64Data = dataUrl.split(',')[1] ?? dataUrl;
  const storagePath = `performance_diagnostics/${companyId}/${docId}/screenshot.png`;
  const storageRef = ref(storage, storagePath);
  await uploadString(storageRef, base64Data, 'base64', { contentType: 'image/png' });
  const screenshotUrl = await getDownloadURL(storageRef);

  // Firestore doc
  await setDoc(doc(db, COLLECTIONS.PERFORMANCE_DIAGNOSTICS, docId), {
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

  // TODO(ADR-366 §B.5): audit trail must happen server-side (EntityAuditService is server-only).
  // Move write+audit into a `/api/performance-diagnostics` route so both Firestore doc and
  // entity_audit_trail entry are written in the same server transaction. Client cannot import
  // entity-audit.service (Admin SDK / server-only). For now the doc is written client-side
  // without audit.
}
