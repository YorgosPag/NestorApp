'use client';

/**
 * **Το μενού κινητού της δημόσιας κεφαλίδας** — «☰ Μενού» + συρτάρι (ADR-809 §9).
 *
 * @related PublicSiteHeader · PublicSiteMenuSheet · public-site-nav.ts
 *
 * 🔴 **ΤΟ ΜΕΤΡΗΜΕΝΟ ΕΛΑΤΤΩΜΑ (2026-09-25, 390 px)**: οκτώ χειριστήρια σε μία γραμμή —
 * λογότυπο · Ζητώ · Προσφέρω · Καταχώριση · γλώσσα · θέμα · καμπανάκι · λογαριασμός — με
 * δεξιά ομάδα **470 px** σε **358** διαθέσιμα. Το 🌐 κοβόταν στη μέση, θέμα και λογαριασμός
 * ήταν **εκτός οθόνης**, και κανείς δεν το έβλεπε: ο καθολικός `overflow-x: clip` του
 * `globals.css` το έκοβε σιωπηλά. Επιπλέον οι ακτίνες (Επαγγελματίες · Διαμονή) ήταν
 * `hidden` κάτω από `md` ⇒ **απρόσιτες** από την κεφαλίδα στο κινητό.
 *
 * 🏆 **ΜΙΚΤΗ ΠΛΟΗΓΗΣΗ, ΟΧΙ ΣΚΕΤΟ HAMBURGER** — NN/g (179 συμμετέχοντες): στο κινητό το κρυφό
 * μενού χρησιμοποιείται στο **57%** των εργασιών, το μικτό στο **86%**. Γι' αυτό η ταυτότητα
 * (καμπανάκι · λογαριασμός/«Σύνδεση») μένει **ορατή**, και το κουμπί γράφει τη λέξη
 * **«Μενού»** (NN/g: έως +20% χρήση). Θέση **αριστερά** (Rightmove· και το ☰ της στήλης του
 * `(me)` είναι ήδη αριστερά ⇒ **ΜΙΑ θέση ☰ σε όλη την εφαρμογή**)· το συρτάρι ανοίγει από την
 * **ίδια** πλευρά (Material 3, navigation drawer).
 *
 * ⚡ **ΤΟ ΣΥΡΤΑΡΙ ΦΟΡΤΩΝΕΤΑΙ ΜΟΝΟ ΟΤΑΝ ΖΗΤΗΘΕΙ** — το `(light)` μέτρησε κάθε KB του κελύφους
 * (ADR-744 · ADR-871 Υ2: «όχι `Sheet` σε κάθε δημόσια σελίδα»). Το κουμπί είναι στατικό· το
 * Radix Dialog κατεβαίνει στην **πρόθεση** (δείκτης πάνω/εστίαση), ώστε το πάτημα να μη
 * περιμένει δίκτυο. Κλειστό, πριν την πρώτη χρήση = **μηδέν** DOM και μηδέν bytes.
 */

import React, { useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import { Menu } from 'lucide-react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';

const loadSheet = () => import('./PublicSiteMenuSheet').then((m) => m.PublicSiteMenuSheet);
const PublicSiteMenuSheet = dynamic(loadSheet, { ssr: false });

export function PublicSiteMenu(): React.ReactElement {
  const { t } = useTranslation(['common']);
  const iconSizes = useIconSizes();
  const [open, setOpen] = useState(false);
  // Μένει τοποθετημένο μετά το πρώτο άνοιγμα: το κλείσιμο χρειάζεται το δέντρο για το animation.
  const [mounted, setMounted] = useState(false);

  const prefetch = useCallback(() => void loadSheet(), []);
  const openMenu = useCallback(() => {
    setMounted(true);
    setOpen(true);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={openMenu}
        onPointerEnter={prefetch}
        onFocus={prefetch}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="-ml-2 inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
      >
        <Menu className={iconSizes.md} aria-hidden="true" />
        <span>{t('common:header.menu.label')}</span>
      </button>
      {mounted && <PublicSiteMenuSheet open={open} onOpenChange={setOpen} />}
    </>
  );
}
