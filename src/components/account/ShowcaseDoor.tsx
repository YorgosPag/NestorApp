'use client';

/**
 * @fileoverview **«ΘΕΛΩ ΝΑ ΜΕ ΒΡΙΣΚΟΥΝ»** — η δεύτερη είσοδος, ίδια μηχανή (ADR-841 Φ6-Β6).
 * @related ADR-841 §2 (απόφαση Α2) · lib/workspace/workspace-routes.ts
 * @module components/account/ShowcaseDoor
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΕΙΝΑΙ ΣΥΝΔΕΣΜΟΣ, ΟΧΙ ΔΕΥΤΕΡΗ ΒΙΤΡΙΝΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η οθόνη *«Θέλω να με βρίσκουν»* **ΥΠΑΡΧΕΙ ΗΔΗ** — είναι το
 * `AgencyShowcaseContent`, στο `/o/<χώρος>/settings/agency-profile`. Μια δεύτερη
 * μέσα στο `/profile` θα ήταν **δίδυμο** *(N.18)*: δύο φόρμες που γράφουν την
 * ίδια συλλογή, και η μία θα ξεχνούσε την επόμενη προσθήκη πεδίου.
 *
 * 🔑 **Μία δομή, μία μηχανή, ΔΥΟ ΠΟΡΤΕΣ.** Ο μάστορας μπαίνει από εδώ και δεν
 * βλέπει ποτέ τη λέξη *«χώρος»* — τη βλέπει ως **βιτρίνα**. Πίσω από την πόρτα
 * τρέχει η **ίδια** υπάρχουσα διαδρομή `/workspace/new`.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΓΙΑΤΙ ΖΕΙ ΣΤΟ `PrivateProfileContent` ΚΑΙ ΟΧΙ ΣΤΟ `ProfilePageContent`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `ProfilePageContent` το σερβίρουν **ΔΥΟ** διευθύνσεις: το `/profile` *(ο
 * ιδιώτης)* **και** το `/o/<ψευδώνυμο>/account/profile` *(ο άνθρωπος που είναι
 * **ήδη μέσα σε χώρο**)*. Στη δεύτερη, ένα κουμπί *«θέλω να με βρίσκουν»* θα
 * πρότεινε σε ιδιοκτήτη γραφείου να φτιάξει **δεύτερο** χώρο.
 *
 * 🔴 **Η ΘΕΣΗ ΕΙΝΑΙ Ο ΦΡΟΥΡΟΣ** — κανένα runtime `if` να ξεχαστεί, και το
 * `ProfilePageContent` μένει **ανέγγιχτο** *(η σύμβασή του «τρία αποθετήρια, ένα
 * κουμπί» δεν σπάει)*.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΡΕΙΣ ΚΑΤΑΣΤΑΣΕΙΣ, ΠΟΤΕ BOOLEAN — ΚΑΙ ΤΟ ΤΡΙΤΟ ΚΕΛΙ ΕΙΝΑΙ ΟΛΟΚΛΗΡΟ ΤΟ N.12
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Κατάσταση | Δείχνει | CTA |
 * |---|---|---|
 * | `companyId === null` | *«Δεν έχετε ακόμη δημόσια βιτρίνα.»* | **«Θέλω να με βρίσκουν»** → `/workspace/new` |
 * | `companyId !== null` | *«Έχετε ήδη χώρο· η βιτρίνα ρυθμίζεται μέσα σε αυτόν.»* | → `/home` |
 * | `user === null` | ⚠️ **τίποτα** — ούτε σκελετός | — |
 *
 * 🔴 Ένα `user?.companyId ?? null → «δεν έχεις χώρο»` θα έδειχνε «Θέλω να με
 * βρίσκουν» σε **ιδιοκτήτη γραφείου** για ένα καρέ — και **ένα πάτημα εκεί τον
 * στέλνει να φτιάξει δεύτερο χώρο**. Το *«δεν ξέρω ακόμη»* δεν είναι *«δεν
 * έχει»*: άγνωστο ≠ κενό.
 *
 * ⚠️ **Το `/home` και όχι `/o/<ψευδώνυμο>`**: το `useWorkspaceAlias()` επιστρέφει
 * `null` **εκτός** προθέματος — και το `/profile` είναι εκτός. Ο ανακατευθυντής
 * `/home` υπάρχει ακριβώς γι' αυτό: *«πήγαινέ με εκεί που ανήκω»*.
 */

import React from 'react';

import { useAuth } from '@/auth/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Link } from '@/lib/workspace/navigation';
import { CREATE_WORKSPACE_ROUTE, HOME_REDIRECT_ROUTE } from '@/lib/workspace/workspace-routes';

/** Το namespace της σελίδας λογαριασμού — το ίδιο που κουβαλά ήδη το route slice. */
const ACCOUNT_NS = 'common-account';

const K = 'common-account:account.showcase';

/**
 * ⚠️ **Πίνακας σταθερών, ΠΟΤΕ παρεμβολή** *(N.11 · CHECK 3.8)*: ένα
 * ``t(`${K}.${state}Lead`)`` θα ήταν αόρατο στην πύλη και θα ζωγράφιζε ωμό
 * κλειδί την πρώτη φορά που κάποιος πρόσθετε κατάσταση.
 */
const DOOR_KEYS = {
  title: `${K}.title`,
  absentLead: `${K}.absentLead`,
  absentCta: `${K}.absentCta`,
  presentLead: `${K}.presentLead`,
  presentCta: `${K}.presentCta`,
} as const;

export function ShowcaseDoor(): React.ReactElement | null {
  const { t } = useTranslation([ACCOUNT_NS]);
  const { user } = useAuth();

  // 🔴 **ΤΟ ΤΡΙΤΟ ΚΕΛΙ.** Όχι σκελετός, όχι προεπιλογή — **τίποτα**. Ένας
  //    σκελετός θα ήταν ακίνδυνος· μια **προεπιλογή** δεν θα ήταν, και ο πιο
  //    φυσικός τρόπος να γραφτεί αυτό το component είναι με προεπιλογή.
  if (user === null || user === undefined) return null;

  const hasWorkspace = user.companyId !== null && user.companyId !== undefined;

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
      <h2 className="m-0 text-base font-semibold text-foreground">{t(DOOR_KEYS.title)}</h2>
      <p className="m-0 text-sm text-muted-foreground">
        {t(hasWorkspace ? DOOR_KEYS.presentLead : DOOR_KEYS.absentLead)}
      </p>
      {/* ⚠️ **Ο σύνδεσμος από το ΣΥΝΟΡΟ** (CHECK 3.61): και οι δύο διαδρομές ζουν
          **εκτός** προθέματος χώρου, και ο κριτής του συνόρου τις αφήνει άθικτες.
          Με ωμό `next/link` θα «δούλευε» σήμερα και θα έσπαγε τη μέρα που κάποιος
          άλλαζε τη δήλωση — δηλαδή ο έλεγχος θα ζούσε στο τίποτα. */}
      <Button asChild variant={hasWorkspace ? 'outline' : 'default'} className="self-start">
        <Link href={hasWorkspace ? HOME_REDIRECT_ROUTE : CREATE_WORKSPACE_ROUTE}>
          {t(hasWorkspace ? DOOR_KEYS.presentCta : DOOR_KEYS.absentCta)}
        </Link>
      </Button>
    </section>
  );
}
