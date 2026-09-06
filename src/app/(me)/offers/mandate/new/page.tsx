/**
 * `/offers/mandate/new?agency=<ψευδώνυμο>` — **η φόρμα του Σ1** (ADR-827 §9.17 α).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΣΤΟ `(me)` ΚΑΙ ΟΧΙ ΔΙΠΛΑ ΣΤΗ ΒΙΤΡΙΝΑ ΤΟΥ `(light)`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `(light)` δηλώνει στο `.shell-boundary.json` *«οι **δημόσιες** οθόνες ακινήτων»*.
 * Αυτή η φόρμα **απαιτεί ταυτότητα** *(ο επιλογέας ρωτά «τα ακίνητά μου»)* και
 * **οφείλει να μην ευρετηριάζεται**. Και τα δύο τα δίνει το `(me)` **δομικά**, από το
 * `layout.tsx` του: `PrivateSpaceShell` + `noindex`.
 *
 * ⇒ Μια φόρμα ταυτότητας κάτω από δήλωση που λέει «δημόσια» θα έκανε τη **δήλωση
 * ψευδή** — και η δήλωση **είναι** το συμβόλαιο που φυλά η **CHECK 3.52**. Φρουρός
 * γραμμένος **μέσα στη σελίδα** θα ήταν ακριβώς ο `ConditionalAppShell` που διέγραψε
 * το ADR-777 §8.12: σωστός σήμερα, ξεχασμένος στην επόμενη σελίδα, **αόρατος** σε κάθε
 * πύλη.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΨΕΥΔΩΝΥΜΟ ΛΥΝΕΤΑΙ ΕΔΩ, ΟΠΩΣ ΚΑΙ ΣΤΗ ΒΙΤΡΙΝΑ — ΚΑΙ ΓΙΑ ΤΟΝ ΙΔΙΟ ΛΟΓΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `workspace_aliases` είναι **`read: false`** για τον πελάτη *(απογραφή γραφείων,
 * ADR-787 Ε-5 §4 #1)*. Η αναζήτηση είναι **σημειακή, κατά κλειδί** — ποτέ σάρωση —
 * και γίνεται με τον **ίδιο** `resolveAlias` που ήδη χρησιμοποιεί το
 * `/pro/[alias]/page.tsx`. Δεύτερος αναγνώστης θα ήταν δεύτερο δόγμα.
 *
 * ⚠️ **Και το «δεν υπάρχει γραφείο» ΔΕΝ γίνεται 404 εδώ.** Η φόρμα χωρίς γραφείο δεν
 * έχει νόημα, αλλά ένα 404 θα έλεγε στον άνθρωπο *«αυτή η σελίδα δεν υπάρχει»* ενώ
 * υπάρχει — απλώς ο σύνδεσμος που πάτησε είναι μπαγιάτικος. Ανακατευθύνεται στον
 * **κατάλογο**, όπου μπορεί να διαλέξει ξανά. *(Το `unknown` **ρίχνει**: «δεν μπόρεσα
 * να ρωτήσω» δεν φοράει τη στολή του «δεν υπάρχει» — N.12.)*
 *
 * ⚠️ **Το `searchParams` είναι `Promise` (Next 15)** — συγχρονισμένη ανάγνωση θα
 * μεταγλωττιζόταν και θα έσπαγε **στην εκτέλεση**.
 *
 * @module app/(me)/offers/mandate/new/page
 */

import { redirect } from 'next/navigation';

import { MandateRequestFormContent } from '@/components/mandate/MandateRequestFormContent';
import { MandateUnavailableNotice } from '@/components/mandate/MandateUnavailableNotice';
import { acceptsMandate } from '@/lib/professional/showcase-acts';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { resolveAlias } from '@/lib/workspace/alias-registry';
import { AGENCY_DIRECTORY_ROUTE, agencyProfileRoute } from '@/components/mandate/agency-directory-route';
import { lookupAgencyProfile } from '@/services/mandate/agency-profile.service';

interface MandateRequestPageProps {
  readonly searchParams: Promise<{ readonly agency?: string }>;
}

export default async function MandateRequestPage({ searchParams }: MandateRequestPageProps) {
  const { agency } = await searchParams;

  if (agency === undefined || agency.trim() === '') redirect(AGENCY_DIRECTORY_ROUTE);

  const resolution = await resolveAlias(agency);
  if (resolution.outcome === 'unknown') {
    // ⛔ **503, ποτέ 404** — ίδιο ιδίωμα με το `/pro/[alias]` και το `o/[workspace]`.
    throw new Error('AGENCY_ALIAS_LOOKUP_UNAVAILABLE');
  }
  if (resolution.outcome === 'not-found') redirect(AGENCY_DIRECTORY_ROUTE);

  // 🔑 **Η ΒΙΤΡΙΝΑ ΞΑΝΑΡΩΤΙΕΤΑΙ, ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΠΕΡΙΤΤΟ**: ένα ψευδώνυμο λύνεται για
  //    **κάθε** οργανισμό — και μόνο όσοι **δημοσιεύονται** επιτρέπεται να δεχτούν
  //    αίτημα. Χωρίς αυτό, η φόρμα θα άνοιγε για γραφείο που το §9.4 δηλώνει
  //    **αόρατο**, και ο ιδιώτης θα μάθαινε ότι ο οργανισμός **υπάρχει**. Ο
  //    διακομιστής το ξαναρωτά στη γραφή· εδώ είναι για να μη γεμίσει ο άνθρωπος
  //    φόρμα που θα απορριφθεί (N.7.2 #4).
  const profile = await lookupAgencyProfile(getAdminFirestore(), resolution.companyId);
  if (profile.outcome === 'unavailable') throw new Error('AGENCY_PROFILE_UNAVAILABLE');
  if (profile.outcome === 'not-published') redirect(AGENCY_DIRECTORY_ROUTE);

  // 🔴 **ΤΟ ΓΡΑΦΕΙΟ ΥΠΑΡΧΕΙ — Η ΠΡΑΞΗ ΟΧΙ** (ADR-841 §7 Α5). Ο **ίδιος** κριτής που
  //    κρύβει το κουμπί στη βιτρίνα κλείνει και τη φόρμα, ώστε μπαγιάτικος ή
  //    χειρόγραφος σύνδεσμος να μη γεμίζει ο άνθρωπος αίτημα που θα απορριφθεί
  //    (N.7.2 #4). ⚠️ Ο **φρουρός** παραμένει ο γραφέας: αυτό εδώ κλείνει οθόνη,
  //    δεν φυλά γραφή.
  //
  // ⚠️ **ΚΑΙ ΔΕΝ ΕΙΝΑΙ `redirect`**, σε αντίθεση με τις δύο από πάνω: εκεί δεν υπάρχει
  //    τίποτα να δείξεις· εδώ ο άνθρωπος μόλις ερχόταν από αυτή τη βιτρίνα και
  //    δικαιούται να μάθει **γιατί** — δες `MandateUnavailableNotice`.
  if (!acceptsMandate(profile.showcase.credentials)) {
    return <MandateUnavailableNotice agencyHref={agencyProfileRoute(agency)} />;
  }

  return (
    <MandateRequestFormContent
      agencyCompanyId={resolution.companyId}
      agencyDisplayName={profile.showcase.displayName}
      agencyHref={agencyProfileRoute(agency)}
    />
  );
}
