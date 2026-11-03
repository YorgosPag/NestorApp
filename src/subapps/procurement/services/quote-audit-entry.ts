/**
 * **Η ΜΙΑ γραμμή του ενσωματωμένου `Quote.auditTrail`** (ADR-327 §6.10) — server, Admin SDK.
 *
 * Ήταν χειρόγραφη σε κάθε γραφέα της προσφοράς (`quote-service` · `quote-leveling-plug-service`), και ο τρίτος
 * (`quote-extraction-lifecycle`) θα γινόταν τέταρτο αντίγραφο (N.0.2). Το `vendor-portal-submit-service` μένει
 * χωριστά επίτηδες: σφραγίζει με Timestamp **πελάτη** (`adminTimestampAsClient`) και `ip` κατακερματισμένο.
 *
 * @module subapps/procurement/services/quote-audit-entry
 */

import 'server-only';

import admin from 'firebase-admin';
import type { QuoteAuditEntry } from '../types/quote';

export function quoteAuditEntry(
  userId: string,
  action: string,
  previousValue: string | null = null,
  newValue: string | null = null,
  source: QuoteAuditEntry['source'] = 'system',
): QuoteAuditEntry {
  return {
    timestamp: admin.firestore.Timestamp.now(),
    userId,
    action,
    previousValue,
    newValue,
    source,
    ip: null,
  };
}
