'use client';

/**
 * **Ο ΔΕΙΚΤΗΣ ΑΚΡΗΣ** — *«δεν κουνήθηκα· να πού είναι αυτό που κοιτάς»*.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 Η ΤΡΙΤΗ ΕΠΙΛΟΓΗ ΠΟΥ Η FIGMA ΔΕΝ ΔΟΚΙΜΑΣΕ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το δίλημμα του συγχρονισμού χάρτη ⇄ λίστας έχει δύο γνωστές απαντήσεις, και **και οι
 * δύο κοστίζουν**:
 *
 * • **αυτόματη κύλιση** — η λίστα πηδά σε κάθε ακούσιο πέρασμα του δείκτη. Η Figma το
 *   υλοποίησε στο Layers panel και **το απέσυρε** ως αποπροσανατολιστικό.
 * • **τίποτα** — ο άνθρωπος περνά τον δείκτη πάνω από πινέζα, βλέπει δακτύλιο, και
 *   **δεν μαθαίνει ποτέ** ότι η κάρτα του υπάρχει 200px πιο κάτω. Αυτό κάνουν σήμερα
 *   Zillow και Redfin, και είναι ο λόγος που **γεννήθηκε** το popup στον χάρτη.
 *
 * 🔑 **Η τρίτη**: η λίστα **δεν κουνιέται**, αλλά **λέει** πού είναι — με το όνομα και
 * την τιμή του ακινήτου, και με κατεύθυνση. Ο άνθρωπος παίρνει την πληροφορία που ήθελε
 * *(«ναι, αυτό είναι η Μεζονέτα των 200.000 €»)* **χωρίς καμία κίνηση**, και αν θέλει να
 * πάει εκεί, **το ζητά** — δηλαδή η κύλιση γίνεται ρητή πράξη, όπως το `S` του Cinema 4D
 * και το *Find in Project Browser* του Revit.
 *
 * ⚠️ **ΕΙΝΑΙ `<button>`, ΟΧΙ ΔΙΑΚΟΣΜΗΣΗ.** Το ίδιο μέγεθος πληροφορίας ζωγραφισμένο ως
 * `<div>` θα ήταν υπόσχεση διάδρασης που δεν τηρείται — το ίδιο είδος ψέματος με τον
 * δείκτη «χεράκι» πάνω σε σχήμα που δεν κάνει τίποτα ({@link ResultsMapProps.onSelect}).
 */

import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { resolveDisplayPrice } from '@/lib/properties/price-resolver';
import { displayPriceLabel } from '@/lib/listings/listing-price-label';
import { useStayTotal } from './StayTotalsContext';
import type { PublicListing } from '@/types/public-listing';

interface ListingEdgeIndicatorProps {
  readonly listing: PublicListing;
  /** Πού βρίσκεται σε σχέση με ό,τι φαίνεται — καθορίζει **άκρη και βέλος**. */
  readonly direction: 'above' | 'below';
  readonly onActivate: () => void;
}

export function ListingEdgeIndicator({ listing, direction, onActivate }: ListingEdgeIndicatorProps) {
  const { t } = useTranslation(['search-results', 'search-focus']);
  const price = resolveDisplayPrice(listing);
  const stayTotal = useStayTotal(listing.id);
  const Arrow = direction === 'above' ? ChevronUp : ChevronDown;

  return (
    <button
      type="button"
      onClick={onActivate}
      /*
        🔴 **`aria-live` ΘΑ ΗΤΑΝ ΛΑΘΟΣ ΕΔΩ, και η απόφαση είναι μετρημένη.** Ο δείκτης
        γεννιέται από **κίνηση του ποντικιού** — συμβάν που ο χρήστης αναγνώστη οθόνης
        δεν παράγει. Μια ζωντανή περιοχή θα ανακοίνωνε δεκάδες φορές κάτι που **δεν
        συνέβη γι' αυτόν**. Η διαδρομή του πληκτρολογίου δεν χρειάζεται τον δείκτη
        καθόλου: η εστίαση **ήδη** κυλά την κάρτα στο πεδίο (σύμβαση περιηγητή), και ο
        δεσμός λίστα → χάρτης δένεται στο `onFocus` της κάρτας.
      */
      className={cn(
        'absolute inset-x-2 z-10 flex items-center gap-2 rounded-md px-3 py-1.5',
        'border border-ring bg-card/95 shadow-md backdrop-blur',
        'text-left transition-opacity',
        'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        direction === 'above' ? 'top-2' : 'bottom-2'
      )}
    >
      <Arrow className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />

      <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
        {listing.title}
      </span>

      <span className="shrink-0 text-xs font-semibold text-foreground">
        {displayPriceLabel(t, price, stayTotal)}
      </span>

      {/*
        Η **οδηγία** για τον αναγνώστη οθόνης, αόρατη στα μάτια: το ορατό κείμενο λέει
        *τι* είναι, όχι *τι κάνει το κουμπί*. Χωρίς αυτό, ο σύνδεσμος θα ανακοινωνόταν
        ως «Μεζονέτα 95 τ.μ., 200.000 €, κουμπί» — τρία ουσιαστικά και καμία πράξη.
      */}
      <span className="sr-only">
        {t(
          direction === 'above'
            ? 'search-focus:edge.above'
            : 'search-focus:edge.below'
        )}
      </span>
    </button>
  );
}
