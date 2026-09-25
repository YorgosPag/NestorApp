'use client';

/**
 * **Η ΖΩΝΗ «ΓΙΑ ΕΠΑΓΓΕΛΜΑΤΙΕΣ»** — η δεύτερη πόρτα της αρχικής, για τον επισκέπτη.
 *
 * @related ADR-820 §5.4 · ADR-787 Κ-1 (`/workspace/new`) · ADR-777 (οθόνη 1)
 * @module components/search/LandingProBand
 *
 * 🔑 **ΔΕΥΤΕΡΕΥΟΥΣΑ, ΟΧΙ ΙΣΟΤΙΜΗ — και είναι η πρακτική των μεγάλων.** Zillow και
 * idealista κρατούν την αρχική για τον καταναλωτή και δίνουν στον επαγγελματία μια
 * ζώνη **πιο κάτω**. Ένα δεύτερο μπάνερ ίσου βάρους στην κορυφή θα έκανε τη βιτρίνα
 * πύλη επιλογής — το splash page που όλοι εγκατέλειψαν.
 *
 * ⚠️ **Μόνο για ΜΗ συνδεδεμένους.** Ο συνδεδεμένος χωρίς γραφείο βλέπει την ίδια
 * πόρτα ως κάρτα στη λωρίδα «Οι χώροι μου» (`LandingMySpaces`)· ο συνδεδεμένος **με**
 * γραφείο δεν έχει τι να ανοίξει. Δύο εκδοχές της ίδιας πρόσκλησης στην ίδια οθόνη
 * θα ήταν θόρυβος.
 *
 * ✅ **Ο προορισμός είναι πραγματικός**: το `/workspace/new` ζει στο `(me)`, πίσω από
 * τη σύνδεση — ο επισκέπτης περνά πρώτα από το login. Η οθόνη **δεν υπόσχεται** ροή
 * που δεν υπάρχει (ADR-777 §8.10).
 */

import React from 'react';
import { Building2 } from 'lucide-react';

import { useAuthOptional } from '@/auth';
import { buttonVariants } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { Link } from '@/lib/workspace/navigation';
import { CREATE_WORKSPACE_ROUTE } from '@/lib/workspace/workspace-routes';

const HEADING_ID = 'landing-pro-band-heading';

export function LandingProBand(): React.ReactElement | null {
  const { t } = useTranslation(['property-market']);
  // ⚠️ `useAuthOptional`: χωρίς πάροχο ταυτότητας ο θεατής είναι επισκέπτης.
  const auth = useAuthOptional();

  if (auth?.loading || auth?.user) return null;

  return (
    <section
      aria-labelledby={HEADING_ID}
      className="flex flex-col items-start gap-4 rounded-lg border border-border bg-card p-6 text-foreground sm:flex-row sm:items-center sm:justify-between"
    >
      <header className="flex items-start gap-4">
        <Building2 aria-hidden="true" className="mt-1 size-8 shrink-0 text-muted-foreground" />
        <hgroup className="flex flex-col gap-1">
          <h2 id={HEADING_ID} className="text-xl font-semibold">
            {t('property-market:proBand.title')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('property-market:proBand.body')}</p>
        </hgroup>
      </header>
      <Link
        href={CREATE_WORKSPACE_ROUTE}
        // 📱 Κάτω από `sm`: πλήρες πλάτος ΚΑΙ αναδίπλωση (GOV.UK · Material) — μετρημένο 2026-09-25 στα
        //    320 px (WCAG 1.4.10): το `whitespace-nowrap` του Button κρατούσε τις 6 λέξεις σε μία γραμμή
        //    290 px μέσα σε 240 ⇒ 41→331. `min-h-11` = στόχος αφής 44 px όταν το ύψος γίνεται αυτόματο.
        //    Το `w-full sm:w-auto` είναι το ίδιο μοτίβο με την «Αναζήτηση» (`PlaceSearchBox`).
        className={cn(
          buttonVariants({ size: 'lg' }),
          'h-auto min-h-11 w-full shrink-0 whitespace-normal py-2 text-center sm:w-auto sm:whitespace-nowrap',
        )}
      >
        {t('property-market:proBand.cta')}
      </Link>
    </section>
  );
}
