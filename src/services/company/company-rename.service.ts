/**
 * @fileoverview **Η ΜΕΤΟΝΟΜΑΣΙΑ ΚΑΤΕΧΕΙ ΤΗ ΣΥΝΕΠΕΙΑ ΤΗΣ** — μία φορά (ADR-841 §7 Α1.6 · Α22 · Α23).
 * @module services/company/company-rename.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η επωνυμία ζει στο προφίλ (`accounting_settings/{companyId}`, ADR-439) και **αντιγράφεται**
 * στο `companies/{id}.name` και σε κάθε δημόσια αγγελία. Μέχρι την Α23 **μία** διαδρομή έκανε
 * την αντιγραφή (`PATCH /api/admin/bootstrap-company`)· η **αποθήκευση του ίδιου του προφίλ**
 * άλλαζε την επωνυμία **χωρίς** να ενημερώνει κανένα αντίγραφο — μετρημένο 2026-09-14.
 *
 * 🔑 Δύο καλούντες ⇒ **ένα** σημείο: επισκευή του παραγώγου και, **μόνο αν άλλαξε**,
 * ανανέωση των αγγελιών (`agency-name-refresh`, αιτία `company-renamed`).
 *
 * ⚠️ **Δεν πετά για το παράγωγο των αγγελιών**: η ανανέωση επιστρέφει `null` σε αποτυχία και
 * το καταγράφει· η επισκευή του `companies/{id}` πετά, όπως πριν.
 *
 * **Layering**: service — συνθέτει δύο υπάρχοντες γραφείς, κανένας νέος.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { repairCompanyDocument } from '@/services/company-document.service';
import { refreshAgencyNameOnListings } from '@/services/listings/agency-name-refresh';

export interface CompanyRenameOutcome {
  readonly name: string;
  /** `false` ⇒ το παράγωγο ήταν ήδη σωστό (ή δεν βρέθηκε όνομα) — **καμία** αγγελία δεν αγγίχτηκε. */
  readonly wasRepaired: boolean;
  /** Η λογιστική της ανανέωσης· `null` όταν δεν χρειάστηκε ή απέτυχε το ίδιο το πέρασμα. */
  readonly republished: Awaited<ReturnType<typeof refreshAgencyNameOnListings>>;
}

export async function propagateCompanyRename(
  adminDb: AdminFirestore,
  companyId: string,
  actorUid: string,
): Promise<CompanyRenameOutcome> {
  const repair = await repairCompanyDocument(companyId, actorUid);
  if (!repair.wasRepaired) return { ...repair, republished: null };
  const republished = await refreshAgencyNameOnListings(adminDb, companyId, 'company-renamed');
  return { ...repair, republished };
}
