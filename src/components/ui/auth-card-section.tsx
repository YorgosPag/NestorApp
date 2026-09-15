'use client';

/**
 * @fileoverview **Η ΚΑΡΤΑ ΜΙΑΣ ΟΘΟΝΗΣ ΧΩΡΙΣ ΣΥΝΔΕΣΗ** — ό,τι ανοίγει ένας άνθρωπος από email (ADR-841 §7 Α21.21 Φάση Β).
 * @related app/(auth)/layout.tsx · hooks/useLayoutClasses.ts (`cardAuthWidth`) · ADR-797 / CHECK 3.63
 * @module components/ui/auth-card-section
 *
 * 🔴 **ΕΞΗΧΘΗ ΟΤΑΝ ΕΡΧΟΤΑΝ Η ΠΕΜΠΤΗ ΑΝΤΙΓΡΑΦΗ** (N.0.2): η ίδια `<section>` — πλάτος κάρτας auth, περίγραμμα, στρογγυλεμένη
 * γωνία, εσωτερικό κενό — ζούσε γραμμένη με το χέρι σε τέσσερις οθόνες (`GuestContactContent` · `EmailPreferencesPanel` ·
 * `NotificationPermalinkUnavailable` · `ShowcaseEmailConfirmationContent`). Η επόμενη αλλαγή της κάρτας θα έφτανε στις μισές.
 *
 * 🔑 **Το πλάτος το κατέχει η κάρτα — με ΟΝΟΜΑ** (ADR-797): το `(auth)/layout.tsx` κεντράρει και δεν δηλώνει `measure`.
 * ⚠️ Το `gap` είναι **κλειστό σύνολο** και όχι ελεύθερο `className`: οι τέσσερις οθόνες είχαν 3 · 4 · 5 — μηδέν οπτική αλλαγή
 * στη μετακόμιση, και καμία πόρτα για πέμπτη χειρόγραφη τιμή.
 */

import React from 'react';

import { useLayoutClasses } from '@/hooks/useLayoutClasses';

const GAP_CLASSES = { 3: 'gap-3', 4: 'gap-4', 5: 'gap-5' } as const;

export type AuthCardGap = keyof typeof GAP_CLASSES;

type AuthCardSectionProps = Omit<React.ComponentPropsWithoutRef<'section'>, 'className'> & {
  readonly gap?: AuthCardGap;
};

export function AuthCardSection({ gap = 4, children, ...rest }: AuthCardSectionProps): React.ReactElement {
  const layout = useLayoutClasses();
  return (
    <section {...rest} className={`${layout.cardAuthWidth} flex flex-col ${GAP_CLASSES[gap]} rounded-lg border border-border bg-card p-6`}>
      {children}
    </section>
  );
}
