/**
 * @module services/ownership/ownership-verification-record
 * @description Ό,τι **φεύγει** από μια επαλήθευση κατοχής (ADR-900 §3.8): η προβολή προς τον ιδιοκτήτη και το ίχνος.
 *
 * 🔒 Η προβολή είναι **κλειστό σχήμα**: κανένα HMAC ΑΦΜ, κανένα όνομα δικαιούχου, καμία σφραγίδα — ο
 * ιδιοκτήτης μαθαίνει **κατάσταση και λόγους**, όχι τι διαβάσαμε για τρίτους (συνιδιοκτήτες).
 */

import 'server-only';

import { EntityAuditService } from '@/services/entity-audit.service';
import type {
  OwnershipVerification,
  OwnershipVerificationStatus,
  OwnershipVerificationView,
} from '@/types/ownership-verification';

export function viewOfVerification(record: OwnershipVerification): OwnershipVerificationView {
  return {
    id: record.id,
    status: record.status,
    reasons: record.reasons,
    kaek: record.kaek,
    createdAt: record.createdAt,
    decidedAt: record.decidedAt,
  };
}

/**
 * Ίχνος στο **προσωπικό** βιβλίο του ιδιοκτήτη (ADR-864 Φ1β), πάνω στην αγγελία: η απόδειξη κατοχής
 * είναι γεγονός **της αγγελίας** για τον κάτοχό της. Fire-and-forget **με** log μέσα στην υπηρεσία
 * ίχνους — η επαλήθευση έχει ήδη γραφτεί, και αποτυχία ίχνους δεν την αναιρεί.
 */
export async function recordVerificationAudit(
  record: OwnershipVerification,
  previous: OwnershipVerificationStatus | null,
): Promise<void> {
  await EntityAuditService.recordChange({
    entityType: 'owner_property',
    entityId: record.ownerPropertyId,
    entityName: null,
    action: 'status_changed',
    changes: [{ field: 'ownershipVerification', oldValue: previous, newValue: record.status }],
    performedBy: record.decidedBy ?? record.uid,
    performedByName: null,
    userId: record.uid,
  });
}
