'use client';

/**
 * **Το κέλυφος της συμπτυγμένης γραμμής**: «N ακόμη δεν φαίνονται στον χάρτη», ανοίγει επιτόπου.
 *
 * ADR-777 Α5 §4.1: ⛔ **ποτέ σιωπηλή εξαφάνιση.** Ό,τι δεν ζωγραφίζεται **λέγεται**, με αιτία
 * ανά στοιχείο και σύνδεσμο. ⚠️ Ανοίγει **μέσα** στο ίδιο πλαίσιο, ποτέ δεύτερη επιφάνεια
 * (Α5 §4.2, κανόνας 21: NN/g *«never stack»*).
 *
 * 🔑 Βγήκε από το `UnmappedListingsRow` όταν ήρθε δεύτερος καταναλωτής (ADR-777 §8.71: ο χάρτης
 * χαρτοφυλακίου του κατόχου). Οι **αιτίες** και οι **σύνδεσμοι** είναι του καταναλωτή (δημόσια
 * αγγελία ↔ κάρτα κατόχου)· η **συμπεριφορά** (μηδέν ⇒ τίποτα, άνοιγμα επιτόπου, `aria-expanded`)
 * είναι μία.
 */

import React, { useState } from 'react';

/**
 * Η κλάση του συνδέσμου κάθε γραμμής — **μία**, για όλους τους καταναλωτές. Ο σύνδεσμος τον
 * φτιάχνει ο καταναλωτής, γιατί μόνο εκείνος ξέρει τον **τύπο** της διεύθυνσής του (`WorkspaceHref`).
 */
export const UNMAPPED_ROW_LINK_CLASS =
  'font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export interface UnmappedRowItem {
  readonly id: string;
  /** Ο σύνδεσμος προς το στοιχείο, με `UNMAPPED_ROW_LINK_CLASS`. */
  readonly link: React.ReactNode;
  /** Η αιτία, **ήδη μεταφρασμένη** — ή `null` όταν δεν υπάρχει κάτι να ειπωθεί. */
  readonly note: string | null;
}

interface UnmappedRowProps {
  readonly heading: string;
  readonly hint: string;
  readonly items: readonly UnmappedRowItem[];
}

export function UnmappedRow({ heading, hint, items }: UnmappedRowProps) {
  const [expanded, setExpanded] = useState(false);

  // ⚠️ Στο μηδέν ΔΕΝ εμφανίζεται: μια γραμμή που λέει «κανένα κρυμμένο» είναι θόρυβος.
  if (items.length === 0) return null;

  return (
    <section className="border-t border-border bg-muted/40 p-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="text-left text-sm font-medium text-foreground underline-offset-2 hover:underline"
      >
        {heading}
      </button>

      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>

      {expanded && (
        <ul className="mt-2 space-y-1">
          {items.map((item) => (
            <li key={item.id} className="text-sm text-foreground">
              {/*
                🔑 **Και αυτά οδηγούν κάπου.** Το ότι κάτι δεν είναι στον χάρτη δεν το κάνει
                λιγότερο ακίνητο: ως απλό κείμενο θα τιμωρούνταν στη διεπαφή (Α5 §4.1).
              */}
              {item.link}
              {item.note && <span className="ml-2 text-xs text-muted-foreground">{item.note}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
