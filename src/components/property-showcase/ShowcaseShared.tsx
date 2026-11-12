'use client';

import React from 'react';
import { PRODUCT_NAME } from '@/constants/product-identity';
import { showcasePoweredByDefault } from '@/services/showcase-core/labels-shared';
import type { EnumLocale } from '@/services/property-enum-labels/property-enum-labels.service';

/**
 * Η οθόνη των μη-έτοιμων καταστάσεων (έληξε · δεν βρέθηκε · σφάλμα) του showcase.
 *
 * 🔑 **Η ρίζα είναι `<main>`** (ADR-939 §6): ο ΜΟΝΟΣ καταναλωτής είναι ο
 * `showcase-core/ShowcaseClient`, που αποδίδει **ή** αυτή την οθόνη **ή** το έτοιμο
 * `<main>` του — ποτέ και τα δύο. Οι σελίδες της ομάδας `(link)` δεν έχουν `<main>`
 * από layout, άρα μετρήθηκε ζωντανά **0 `<main>`** στο `/showcase/<άκυρο>`. Ίδιο σχήμα
 * με το `PublicPOPageContent` (ρίζα `<main>` σε κάθε κατάσταση).
 */
export function MessageScreen({
  icon, title, description,
}: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[hsl(var(--showcase-bg))] px-4">
      <section className="bg-[hsl(var(--showcase-surface))] rounded-xl shadow-sm p-8 max-w-md text-center border border-[hsl(var(--showcase-border))]">
        <div className="flex justify-center mb-4">{icon}</div>
        <h1 className="text-xl font-bold text-[hsl(var(--showcase-fg))] mb-2">{title}</h1>
        <p className="text-[hsl(var(--showcase-muted-fg))]">{description}</p>
      </section>
    </main>
  );
}

/**
 * 🔴 **ΔΥΟ ΜΗΧΑΝΙΣΜΟΙ ΕΛΕΓΑΝ ΤΗΝ ΙΔΙΑ ΠΡΟΤΑΣΗ, ΣΤΗΝ ΙΔΙΑ ΣΕΛΙΔΑ** (ADR-857 Φ4).
 *
 * Το υποσέλιδο διάβαζε `t('showcase:brand.poweredBy')`· το **PDF** διάβαζε τη σκληρή
 * δίγλωσση `showcasePoweredByDefault`. Και τα δύο εμφανίζονται **μαζί**: ο σύνδεσμος
 * «Λήψη PDF» κάθεται ακριβώς πάνω από εδώ (`ShowcaseClient`). Δύο πηγές ⇒ ο άνθρωπος
 * μπορούσε να δει **δύο διαφορετικά** ονόματα στην ίδια οθόνη.
 *
 * Πλέον **μία** πηγή για τις δύο επιφάνειες. Γι' αυτό το `locale` είναι **prop**: ο
 * γονιός το έχει ήδη στενεμένο σε `'el' | 'en'` — μια δεύτερη στένωση εδώ θα ήταν
 * **τέταρτο** αντίγραφο ενός `?:` που έχει **μετρημένα** αποκλίνει στο δέντρο.
 */
export function ShowcaseFooter({
  company,
  locale,
}: {
  company: { name: string; phone?: string; email?: string; website?: string };
  locale: EnumLocale;
}) {
  const contact = [company.phone, company.email, company.website].filter(Boolean).join(' · ');
  const year = new Date().getFullYear();
  return (
    <footer className="mt-6 pt-5 border-t border-[hsl(var(--showcase-border))] text-center space-y-3">
      {contact && (
        <p className="text-sm text-[hsl(var(--showcase-muted-fg))]">
          {company.name} · {contact}
        </p>
      )}
      <div className="flex items-center justify-center gap-2 text-xs text-[hsl(var(--showcase-muted-fg))]">
        <img
          src="/images/nestor-app-logo.png"
          alt=""
          width={24}
          height={24}
          className="h-6 w-6 rounded bg-white/90 object-contain p-0.5"
          aria-hidden="true"
        />
        <span className="font-semibold">{showcasePoweredByDefault(locale)}</span>
      </div>
      {/*
        🔑 **ΤΟ `©` ΓΡΑΦΕΙ ΤΟ ΟΝΟΜΑ ΤΟΥ ΠΡΟΪΟΝΤΟΣ, ΑΠΟ ΤΗ ΡΙΖΑ** (ADR-861 Φ1, απόφαση Giorgio
        2026-09-15). Έγραφε `LEGAL_ENTITY_NAME` = «Nestor Pagonis», όνομα που δεν είναι
        πρόσωπο (αναθεωρεί ADR-857 §3.Β). Ο **υπεύθυνος** της υπηρεσίας δηλώνεται χωριστά,
        από το `constants/platform-operator.ts` — δεν χωρά σε γραμμή `©`.
      */}
      <p className="text-[10px] text-[hsl(var(--showcase-muted-fg))]/70">
        &copy; {year} {PRODUCT_NAME}
      </p>
    </footer>
  );
}
