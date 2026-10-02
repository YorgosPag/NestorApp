'use client';

/**
 * **Η ήπια πόρτα πριν την καταχώριση** — «ενδιαφέρεται κάποιος; δείτε το πριν καταχωρίσετε» (ADR-900 §3.7).
 *
 * @related ADR-900 · OwnerPropertyCreationGate · lib/demand/prospect-interest.ts (`interestCheckHref`)
 * @module components/demand/interest-check/InterestCheckNudge
 *
 * 🔑 **Σύνδεσμος, ΟΧΙ ενδιάμεση οθόνη.** Το «+ Καταχώριση αγγελίας» (κεφαλίδα · στήλη) δηλώνει πρόθεση
 * **τώρα**· ένα βήμα που μπαίνει ανάμεσα θα κόστιζε μετατροπές σε όποιον αποφάσισε ήδη (Zillow: το
 * «See your Zestimate» ζει **δίπλα** στο «List your home», δεν το φράζει). Εδώ ο άνθρωπος βλέπει τη φόρμα
 * **και** την πρόταση· διαλέγει ο ίδιος.
 *
 * 🔑 **Σε στενή οθόνη είναι η πιο χρήσιμη πρόταση της σελίδας**: η καταχώριση είναι desktop-only (Α8), ο
 * έλεγχος ενδιαφέροντος **όχι** — άρα στο κινητό η ειδοποίηση «όχι εδώ» αποκτά κάτι που **γίνεται** εδώ.
 *
 * ⚠️ **Σύνδεσμος, όχι η κάρτα διεύθυνσης** (`OwnerInterestEntry`): εδώ ο άνθρωπος ήρθε να καταχωρίσει — μια
 * δεύτερη φόρμα πάνω από τη φόρμα θα ανταγωνιζόταν την πρόθεσή του. Οι λέξεις (`interestCheck.door`) υπήρχαν ήδη.
 */

import React from 'react';
import { ArrowRight, Users } from 'lucide-react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Link } from '@/lib/workspace/navigation';
import { interestCheckHref } from '@/lib/demand/prospect-interest';

export function InterestCheckNudge(): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  return (
    <aside className="rounded-md border border-border bg-card">
      <Link
        href={interestCheckHref()}
        className="flex items-center gap-3 rounded-md px-4 py-3 text-sm text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Users aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">{t('property-market:interestCheck.door')}</span>
        <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    </aside>
  );
}
