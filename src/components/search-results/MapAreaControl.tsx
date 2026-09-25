'use client';

/**
 * # Ο ΔΙΑΚΟΠΤΗΣ ΚΑΙ ΤΟ ΚΟΥΜΠΙ — **Η ΕΠΙΛΟΓΗ ΤΟΥ ΑΝΘΡΩΠΟΥ, ΟΡΑΤΗ** (ADR-777 §8.63)
 *
 * Δύο χειριστήρια πάνω στον χάρτη, και είναι **ένα ζεύγος** επίτηδες:
 *
 * - **Ο διακόπτης** *«Αναζήτηση καθώς μετακινώ τον χάρτη»* — η **συνήθεια**.
 * - **Το κουμπί** *«Αναζήτηση σε αυτή την περιοχή»* — η **μεμονωμένη πράξη**,
 *   ορατό μόνο όσο υπάρχει κάτι να ζητηθεί.
 *
 * 🔑 **ΤΟ ΚΟΥΜΠΙ ΕΞΑΦΑΝΙΖΕΤΑΙ ΕΠΕΙΔΗ ΔΕΝ ΕΧΕΙ ΠΙΑ ΤΙ ΝΑ ΠΕΙ, ΟΧΙ ΕΠΕΙΔΗ ΤΟ ΚΡΥΨΑΜΕ.**
 * Η ορατότητά του είναι **δομικά** δεμένη με το `pendingArea`: αν το κάδρο που βλέπει
 * ο άνθρωπος είναι ήδη το ερώτημα, δεν υπάρχει καμία πράξη να προσφερθεί. Μια
 * ξεχωριστή σημαία `showButton` θα ήταν **δεύτερη** αλήθεια για την ίδια κατάσταση —
 * και η μέρα που θα διαφωνούσαν θα εμφανιζόταν ως κουμπί που δεν κάνει τίποτα.
 *
 * ⚠️ **Ο διακόπτης μένει ορατός ΚΑΙ όταν είναι αναμμένος.** Ένα χειριστήριο που
 * κρύβεται μόλις ενεργοποιηθεί αφήνει τον άνθρωπο με μια συμπεριφορά που δεν ξέρει
 * πώς να σταματήσει — η ίδια παγίδα με την επίμονη επιλογή χωρίς ορατή έξοδο, που ο
 * `ResultsMap` λύνει με τρεις ανεξάρτητες διαδρομές ακύρωσης.
 *
 * ⚠️ **`z-10` και όχι μεγαλύτερο**: ο χάρτης ζει μέσα σε `isolate` *(δικό του
 * περιβάλλον στοίβαξης)*, άρα η στρώση είναι **τοπική** και δεν ανταγωνίζεται καμία
 * καθολική κλίμακα — δες CHECK 3.50 για το γιατί ο **περιορισμός** είναι ανώτερος
 * από το δάμασμα με αριθμό.
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface MapAreaControlProps {
  readonly followMap: boolean;
  readonly onFollowMapChange: (next: boolean) => void;
  /** Υπάρχει κάδρο που δεν έχει ζητηθεί ακόμη; Ορίζει **αν** εμφανίζεται το κουμπί. */
  readonly hasPendingArea: boolean;
  readonly onSearchHere: () => void;
  /**
   * **Το όριο διοικητικής περιοχής, αν ζητήθηκε** *(ADR-883)* — παίρνει τη θέση του διακόπτη.
   * Όσο υπάρχει όριο η κίνηση του χάρτη δεν αλλάζει την περιοχή, άρα ο διακόπτης θα υποσχόταν
   * κάτι που δεν κάνει. Ένα χειριστήριο που δεν κάνει τίποτα δεν δείχνεται.
   */
  readonly regionChip?: React.ReactNode;
  readonly className?: string;
}

const SWITCH_ID = 'search-results-follow-map';

export function MapAreaControl({
  followMap,
  onFollowMapChange,
  hasPendingArea,
  onSearchHere,
  regionChip,
  className,
}: MapAreaControlProps) {
  const { t } = useTranslation(['search-results']);

  return (
    /*
      ⚠️ **`pointer-events-none` στο δοχείο, `pointer-events-auto` στα παιδιά.** Χωρίς
      αυτό, η αόρατη λωρίδα του δοχείου θα κάλυπτε ολόκληρο το πλάτος του χάρτη και θα
      **έτρωγε τα κλικ** πάνω σε σχήματα που βρίσκονται από κάτω — δηλαδή θα έσπαγε
      σιωπηλά τον αμφίδρομο δεσμό λίστας/χάρτη σε μια ολόκληρη ζώνη.
    */
    <nav
      aria-label={t('search-results:area.followMap')}
      className={cn(
        'pointer-events-none absolute inset-x-0 top-3 z-10 flex flex-col items-center gap-2 px-3',
        className
      )}
    >
      {/*
        🔑 **Το κουμπί πάνω από τον διακόπτη**: είναι η **επείγουσα** πράξη — απαντά σε
        κάτι που μόλις έκανε ο άνθρωπος — ενώ ο διακόπτης είναι ρύθμιση που ζει για
        πάντα. Το εφήμερο μπροστά, το μόνιμο πίσω.
      */}
      {regionChip}

      {!regionChip && hasPendingArea && (
        <Button
          type="button"
          size="sm"
          onClick={onSearchHere}
          className="pointer-events-auto shadow-md"
        >
          {t('search-results:area.searchHere')}
        </Button>
      )}

      {!regionChip && (
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 shadow-sm">
          <Switch id={SWITCH_ID} checked={followMap} onCheckedChange={onFollowMapChange} />
          {/*
            ⚠️ **`<label htmlFor>` και όχι `<span>`**: κάνει το ίδιο το κείμενο στόχο
            κλικ — που στα δάχτυλα είναι η διαφορά ανάμεσα σε χειριστήριο που πιάνεται
            και σε ένα που αστοχεί (WCAG 2.5.5, μέγεθος στόχου).
          */}
          <label htmlFor={SWITCH_ID} className="cursor-pointer text-sm text-foreground">
            {t('search-results:area.followMap')}
          </label>
        </div>
      )}
    </nav>
  );
}
