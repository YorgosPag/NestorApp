/**
 * @fileoverview **Η ΜΕΤΟΝΟΜΑΣΙΑ ΚΑΤΕΧΕΙ ΤΗ ΣΥΝΕΠΕΙΑ ΤΗΣ** — μία φορά (ADR-841 §7 Α1.6 · Α22 · Α23).
 * @module services/company/company-rename.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η επωνυμία ζει στο προφίλ (`accounting_settings/{companyId}`, ADR-439) και **αντιγράφεται**
 * στο `companies/{id}.name`, στη **νομική ταυτότητα της βιτρίνας** και σε κάθε δημόσια αγγελία. Μέχρι
 * την Α23 **μία** διαδρομή έκανε την αντιγραφή (`PATCH /api/admin/bootstrap-company`)· η **αποθήκευση
 * του ίδιου του προφίλ** άλλαζε την επωνυμία **χωρίς** να ενημερώνει κανένα αντίγραφο — μετρημένο 2026-09-14.
 *
 * 🔑 Η σειρά είναι απόφαση: **πρώτα η βιτρίνα, μετά οι αγγελίες**. Ο επιλυτής του ονόματος των αγγελιών
 * (`readPublicAgencyIdentity`) ρωτά **πρώτα** τη βιτρίνα· αν οι αγγελίες ανανεώνονταν πριν, θα έπαιρναν
 * το **παλιό** όνομα της βιτρίνας.
 *
 * ⚠️ **Δεν πετά για τα παράγωγα**: η ανανέωση βιτρίνας επιστρέφει `failed`, των αγγελιών `null`, και
 * τα καταγράφουν· η επισκευή του `companies/{id}` πετά, όπως πριν.
 *
 * **Layering**: service — συνθέτει υπάρχοντες γραφείς, κανένας νέος.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { repairCompanyDocument } from '@/services/company-document.service';
import { refreshAgencyNameOnListings } from '@/services/listings/agency-name-refresh';
import {
  refreshShowcaseLegalIdentity,
  type LegalIdentityRefresh,
} from '@/services/mandate/showcase-legal-identity-custody';

export interface CompanyRenameOutcome {
  readonly name: string;
  /** `false` ⇒ το παράγωγο ήταν ήδη σωστό (ή δεν βρέθηκε όνομα). */
  readonly wasRepaired: boolean;
  /** Τι έγινε με τη νομική ταυτότητα της βιτρίνας (Α23). */
  readonly showcase: LegalIdentityRefresh;
  /** Η λογιστική της ανανέωσης αγγελιών· `null` όταν δεν χρειάστηκε ή απέτυχε το ίδιο το πέρασμα. */
  readonly republished: Awaited<ReturnType<typeof refreshAgencyNameOnListings>>;
}

function publicNameChanged(refresh: LegalIdentityRefresh): boolean {
  return refresh.kind === 'refreshed' && refresh.publicNameChanged;
}

export async function propagateCompanyRename(
  adminDb: AdminFirestore,
  companyId: string,
  actorUid: string,
): Promise<CompanyRenameOutcome> {
  const repair = await repairCompanyDocument(companyId, actorUid);
  const showcase = await refreshShowcaseLegalIdentity(adminDb, companyId);
  // 🔑 Αγγελίες **μία** φορά, και μόνο αν άλλαξε κάποιο από τα δύο ονόματα που μπορεί να λένε.
  if (!repair.wasRepaired && !publicNameChanged(showcase)) return { ...repair, showcase, republished: null };
  const republished = await refreshAgencyNameOnListings(adminDb, companyId, 'company-renamed');
  return { ...repair, showcase, republished };
}

/**
 * **Αλλαγή εισόδου της νομικής ταυτότητας ΧΩΡΙΣ μετονομασία** — αριθμός ΓΕΜΗ, μορφή, έδρα προφίλ,
 * νέα απάντηση του μητρώου, οδός της κάρτας (Α23). Ίδια σειρά: βιτρίνα, μετά αγγελίες αν άλλαξε όνομα.
 */
export async function reconcileShowcaseLegalIdentity(
  adminDb: AdminFirestore,
  companyId: string,
): Promise<LegalIdentityRefresh> {
  const showcase = await refreshShowcaseLegalIdentity(adminDb, companyId);
  if (publicNameChanged(showcase)) {
    await refreshAgencyNameOnListings(adminDb, companyId, 'legal-identity-refreshed');
  }
  return showcase;
}
