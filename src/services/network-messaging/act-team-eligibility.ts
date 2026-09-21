/**
 * @fileoverview **ΠΟΙΟΣ ΜΠΟΡΕΙ ΝΑ ΚΑΘΙΣΕΙ ΣΤΗΝ ΟΜΑΔΑ ΤΗΣ ΠΡΑΞΗΣ;** — ADR-867 Β9(β) Ε1β.
 * @related act-team-change.ts (ο κριτής — παίρνει την απάντηση ως γεγονός) · act-team-writer.ts ·
 *          api/network/act-teams/[teamId]/route.ts (ο επιλογέας)
 *
 * 🔴 **ΤΟ ΕΥΡΗΜΑ**: μετά το Ε1 ο κατάλογος του γραφείου είναι **πλήρης** — μαζί και οι επισκέπτες
 * (`external_user`), που **υπάρχουν** στο γραφείο επειδή το token τους ανοίγει την πόρτα. Όμως
 * **κάθε** ενεργό μέλος μπορούσε να γίνει υπεύθυνος ή συνεργάτης, δηλαδή να **γράφει στον
 * αντισυμβαλλόμενο** εκ μέρους του γραφείου.
 *
 * 🌐 Οι μεγάλοι χωρίζουν ακριβώς εδώ: ο **light agent** του Zendesk *«can view tickets … but cannot
 * respond publicly or be assigned tickets»*· ο **guest** του Slack δεν διαχειρίζεται τίποτα. Υπάρχει
 * στον χώρο **≠** μιλά για λογαριασμό του.
 *
 * 🔑 **ΙΚΑΝΟΤΗΤΑ, ΟΧΙ ΛΙΣΤΑ ΡΟΛΩΝ** (ADR-801 · CHECK 3.68): ποιος ρόλος την έχει το λέει ο κατάλογος
 * ρόλων (`network:threads:respond`)· εδώ ρωτιέται ο **ένας** κριτής. Ίδιο ιδίωμα με τον κληρονόμο της
 * αποχώρησης (`pickOfficeHeir`).
 *
 * ⚠️ **Μόνο για όποιον ΜΠΑΙΝΕΙ.** Η αφαίρεση επισκέπτη που βρέθηκε μέσα πριν τον κανόνα πρέπει
 * πάντα να δουλεύει — ο κριτής ρωτά αυτό το γεγονός **μόνο** σε ανάθεση/προσθήκη.
 *
 * Καθαρό: καμία ανάγνωση, κανένα ρολόι.
 */

import { decideCapability } from '@/lib/auth/authority';
import { isGranted } from '@/types/capability-authority';

/** Η **μία** ικανότητα της θέσης στην ομάδα — ο κατάλογος ρόλων αποφασίζει ποιος την έχει. */
export const ACT_TEAM_SEAT_CAPABILITY = 'network:threads:respond' as const;

/**
 * **Μπορεί ο ρόλος αυτού του μέλους να αναλάβει / να απαντά για το γραφείο;**
 *
 * @param globalRole ο ρόλος **του εγγράφου μέλους** (`normalizeMembership`)· `''`/`null` = χωρίς ρόλο ⇒ όχι.
 */
export function canServeOnActTeam(globalRole: string | null): boolean {
  const role = globalRole === '' ? null : globalRole;
  return isGranted(decideCapability({ subject: { globalRole: role }, action: ACT_TEAM_SEAT_CAPABILITY }).verdict);
}
