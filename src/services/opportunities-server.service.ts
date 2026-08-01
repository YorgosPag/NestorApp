/**
 * Opportunities Server Service — Admin SDK operations
 * ADR-252 Security Fix: Server-side validation for opportunity writes
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateOpportunityId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
import { getErrorMessage } from '@/lib/error-utils';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('OpportunitiesServerService');

function getDb() {
  const db = getAdminFirestore();
  if (!db) throw new Error('Admin Firestore unavailable');
  return db;
}

// Valid opportunity stages
const VALID_STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'] as const;

export interface ServerOpportunityCreatePayload {
  name: string;
  leadId?: string | null;
  stage?: string;
  value?: number;
  probability?: number;
  expectedCloseDate?: string;
  assignedTo?: string;
  notes?: string;
}

export interface ServerOpportunityUpdatePayload {
  name?: string;
  stage?: string;
  value?: number;
  probability?: number;
  expectedCloseDate?: string;
  assignedTo?: string;
  notes?: string;
  leadId?: string | null;
}

/**
 * Οι **κοινοί** κανόνες πεδίων του `create` και του `update`, μία φορά.
 *
 * Boy Scout (N.0.2 · N.18): η τριάδα `stage` / `value` / `probability` ήταν
 * γραμμένη **δύο φορές, αυτολεξεί** — προϋπάρχουσα διπλοτυπία που την
 * αποκάλυψε το `jscpd` μόλις άλλαξε το αρχείο. Ο κανόνας του `name` **δεν**
 * μπαίνει εδώ: στο `create` είναι **υποχρεωτικό**, στο `update` **προαιρετικό
 * αλλά όχι κενό** — δύο διαφορετικοί κανόνες που θα κρύβονταν πίσω από μία
 * σημαία. Επιστρέφει το μήνυμα ή `null`.
 */
function validateSharedOpportunityFields(data: {
  readonly stage?: string;
  readonly value?: number;
  readonly probability?: number;
}): string | null {
  if (data.stage && !VALID_STAGES.includes(data.stage as typeof VALID_STAGES[number])) {
    return `Invalid stage: ${data.stage}`;
  }
  if (data.value !== undefined && data.value < 0) {
    return 'Value cannot be negative';
  }
  if (data.probability !== undefined && (data.probability < 0 || data.probability > 100)) {
    return 'Probability must be between 0 and 100';
  }
  return null;
}

/**
 * 🔴 **Φόρτωσε → υπάρχει; → δικό μου;** — μία φορά για τις δύο διαδρομές γραφής
 * (N.18 · CHECK 3.28)
 *
 * Το `update` και το `remove` έγραφαν την ίδια τετράδα. Μόλις η σύγκριση
 * ενοποιήθηκε στον SSoT (ADR-742 §4), τα δύο προοίμια έγιναν **ταυτόσημα** και
 * το `jscpd` τα μέτρησε ως κλώνο **μέσα στο ίδιο diff** — *η κεντρικοποίηση
 * γεννάει τον κλώνο* (μάθημα #2). Απάντηση: **πραγματική μείωση**, όχι
 * χαλάρωση του gate.
 *
 * ⚠️ **Γιατί ΟΧΙ ο κοινός `loadOwnedDocOrRefusal`** (ADR-742 §7undecies.3):
 * εκείνος καλεί το `refusal()` με **μηδέν ορίσματα** και στους **δύο** κλάδους
 * — αυτό είναι το νόημά του, ώστε «δεν βρέθηκε» και «δεν είναι δικό σου» να
 * μην μπορούν να αποκλίνουν. Εδώ οι δύο κλάδοι **αποκλίνουν σήμερα**
 * (`'Opportunity not found'` vs `'Access denied'`). Η ένωσή τους θα ήταν
 * **αλλαγή δόγματος αποκάλυψης**, δηλαδή απόφαση (N.8) — όχι παρενέργεια ενός
 * de-duplication. Καταγράφεται ως **παρατήρηση χωρίς αλλαγή** (§7novies.6).
 */
async function loadOwnedOpportunity(
  id: string,
  companyId: string,
): Promise<
  | { readonly docRef: FirebaseFirestore.DocumentReference; readonly existing: Record<string, unknown> }
  | { readonly error: string }
> {
  const docRef = getDb().collection(COLLECTIONS.OPPORTUNITIES).doc(id);
  const snap = await docRef.get();

  if (!snap.exists) {
    return { error: 'Opportunity not found' };
  }

  const existing = snap.data() as Record<string, unknown>;

  // 🔴🔴 ADR-742 §4 — **η παγίδα του κενού στη ρητή της μορφή**. Μέχρι τις
  // 2026-08-01 ο έλεγχος ήταν `existing.companyId && existing.companyId !== …`:
  // το `&&` σημαίνει «αν δεν έχει μισθωτή, **μην ρωτήσεις**» ⇒ ευκαιρία
  // αποθηκευμένη χωρίς μισθωτή ήταν **επεξεργάσιμη και διαγράψιμη** από
  // οποιονδήποτε συνδεδεμένο χρήστη **οποιασδήποτε** εταιρείας. Πέμπτη εμφάνιση
  // του ίδιου σφάλματος (§7quinquies, §7octies, §7novies, §7decies.4).
  if (!isPayloadOwnedByCompany(existing, companyId)) {
    return { error: 'Access denied' };
  }

  return { docRef, existing };
}

export class OpportunitiesServerService {
  static async create(
    data: ServerOpportunityCreatePayload,
    companyId: string,
    createdBy: string
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      // Validation
      if (!data.name || data.name.trim().length === 0) {
        return { success: false, error: 'Opportunity name is required' };
      }
      if (data.name.trim().length > 200) {
        return { success: false, error: 'Opportunity name cannot exceed 200 characters' };
      }
      const invalid = validateSharedOpportunityFields(data);
      if (invalid) return { success: false, error: invalid };

      const db = getDb();
      const id = generateOpportunityId();
      const now = nowISO();

      const opportunity: Record<string, unknown> = {
        id,
        name: data.name.trim(),
        leadId: data.leadId ?? null,
        stage: data.stage ?? 'lead',
        value: data.value ?? 0,
        probability: data.probability ?? 0,
        expectedCloseDate: data.expectedCloseDate ?? null,
        assignedTo: data.assignedTo ?? null,
        notes: data.notes ?? null,
        companyId,
        createdBy,
        createdAt: now,
        updatedAt: now,
      };

      await db.collection(COLLECTIONS.OPPORTUNITIES).doc(id).set(opportunity);

      logger.info(`Created opportunity ${id} for company ${companyId}`);

      // ADR-029 Phase D: search_documents written by Cloud Function onOpportunityWrite.
      return { success: true, id };
    } catch (error) {
      logger.error('Failed to create opportunity:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  static async update(
    id: string,
    data: ServerOpportunityUpdatePayload,
    companyId: string,
    updatedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const owned = await loadOwnedOpportunity(id, companyId);
      if ('error' in owned) return { success: false, error: owned.error };
      const { docRef } = owned;

      // Validation
      if (data.name !== undefined && data.name.trim().length === 0) {
        return { success: false, error: 'Opportunity name cannot be empty' };
      }
      const invalid = validateSharedOpportunityFields(data);
      if (invalid) return { success: false, error: invalid };

      const updates: Record<string, unknown> = {
        updatedAt: nowISO(),
        updatedBy,
      };

      if (data.name !== undefined) updates.name = data.name.trim();
      if (data.stage !== undefined) updates.stage = data.stage;
      if (data.value !== undefined) updates.value = data.value;
      if (data.probability !== undefined) updates.probability = data.probability;
      if (data.expectedCloseDate !== undefined) updates.expectedCloseDate = data.expectedCloseDate;
      if (data.assignedTo !== undefined) updates.assignedTo = data.assignedTo;
      if (data.notes !== undefined) updates.notes = data.notes;
      if (data.leadId !== undefined) updates.leadId = data.leadId ?? null;

      await docRef.update(updates);

      logger.info(`Updated opportunity ${id}`);

      // ADR-029 Phase D: search_documents written by Cloud Function onOpportunityWrite.
      return { success: true };
    } catch (error) {
      logger.error('Failed to update opportunity:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  static async remove(
    id: string,
    companyId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const owned = await loadOwnedOpportunity(id, companyId);
      if ('error' in owned) return { success: false, error: owned.error };

      await owned.docRef.delete();

      // ADR-029 Phase D: search_documents row cleaned up by Cloud Function onOpportunityWrite (delete branch).

      logger.info(`Deleted opportunity ${id}`);
      return { success: true };
    } catch (error) {
      logger.error('Failed to delete opportunity:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }
}
