'use client';

/**
 * @fileoverview **Οι δύο όψεις του ίδιου ανθρώπου** — «Οι επαφές μου» ⇄ «Ποιοι με πλησίασαν».
 * @related ADR-843 §10.19 · lib/contact/first-contact-routes.ts
 * @module components/contact/FirstContactViews
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ**: μέχρι 2026-09-10 η σελίδα «ποιοι με πλησίασαν» ήταν **ανέφικτη** —
 * κανένας σύνδεσμος σε όλο το `src/` δεν οδηγούσε εκεί. Πρότυπο: LinkedIn Invitation
 * Manager — **ένα** όνομα, **δύο** καρτέλες.
 *
 * 🔑 **ΚΑΙ Ο ΣΚΕΛΕΤΟΣ ΤΗΣ ΣΕΛΙΔΑΣ ΜΑΖΙ**: οι καρτέλες φαίνονται και στη φόρτωση και στο
 * σφάλμα — αλλιώς ο άνθρωπος θα έχανε τη διέξοδο ακριβώς όταν κάτι πάει στραβά. **Ένα**
 * πλαίσιο για τις έξι επιστροφές των δύο σελίδων, όχι έξι αντίγραφα.
 *
 * 🔑 **Η τρέχουσα όψη έρχεται ως ΟΡΙΣΜΑ**, όχι από το pathname: ο καλών **ξέρει** ποια
 * σελίδα είναι· μια ανάγνωση διεύθυνσης θα ήταν δεύτερη απάντηση στην ίδια ερώτηση.
 *
 * ⚠️ Η τρέχουσα καρτέλα **δεν** είναι σύνδεσμος (`aria-current="page"`): σύνδεσμος προς
 * τη σελίδα όπου ήδη βρίσκεσαι είναι θόρυβος για αναγνώστη οθόνης.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { FIRST_CONTACTS_INBOX_ROUTE, MY_FIRST_CONTACTS_ROUTE } from '@/lib/contact/first-contact-routes';
import { Link } from '@/lib/workspace/navigation';

import { FIRST_CONTACT_NS, INBOX_KEYS, MINE_KEYS, VIEWS_KEYS } from './first-contact-labels';

/** Ποια από τις δύο όψεις βλέπει ο άνθρωπος — κλειστό σύνολο. */
export type FirstContactView = 'mine' | 'inbox';

function ViewTab({
  current,
  href,
  label,
}: {
  readonly current: boolean;
  readonly href: string;
  readonly label: string;
}): React.JSX.Element {
  return (
    <li>
      {current ? (
        <span
          aria-current="page"
          className="inline-block border-b-2 border-foreground pb-2 text-sm font-semibold text-foreground"
        >
          {label}
        </span>
      ) : (
        <Link
          href={href}
          className="inline-block border-b-2 border-transparent pb-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          {label}
        </Link>
      )}
    </li>
  );
}

export function FirstContactViewsFrame({
  current,
  children,
}: {
  readonly current: FirstContactView;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const { t } = useTranslation([FIRST_CONTACT_NS]);

  return (
    // ΚΑΝΕΝΑ `p-*`/`max-w-*`/`PageContainer` εδώ (ADR-797 · CHECK 3.63): σελίδες του
    // `(me)` — το κενό, το μέτρο και το ύψος τα κατέχει το `ShellSurface` του
    // `PrivateSpaceShell`. Ίδια σύμβαση με `MyDemandsContent`/`MyOwnerPropertiesContent`.
    <main className="flex w-full flex-col gap-6">
      <nav aria-label={t(VIEWS_KEYS.label)}>
        <ul className="m-0 flex list-none gap-6 border-b border-border p-0">
          {/* ⚠️ Δύο ρητές κλήσεις, ΟΧΙ `map` πάνω σε πίνακα: ο εξαγωγέας κλειδιών
              διαβάζει τιμές ΣΤΑΘΕΡΑΣ module (βλ. κεφαλίδα του `first-contact-labels`). */}
          <ViewTab
            current={current === 'mine'}
            href={MY_FIRST_CONTACTS_ROUTE}
            label={t(MINE_KEYS.title)}
          />
          <ViewTab
            current={current === 'inbox'}
            href={FIRST_CONTACTS_INBOX_ROUTE}
            label={t(INBOX_KEYS.title)}
          />
        </ul>
      </nav>
      {children}
    </main>
  );
}
