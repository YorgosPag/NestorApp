'use client';

/**
 * =============================================================================
 * SHOWCASE CORE — Media Grid (ADR-784 §10)
 * =============================================================================
 *
 * ── 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ: ΠΕΝΤΕ ΑΝΤΙΓΡΑΦΑ ΤΟΥ ΙΔΙΟΥ ΠΛΕΓΜΑΤΟΣ ──
 *
 * Μέχρι τις 2026-08-11 αυτό το πλέγμα ήταν γραμμένο **πέντε** φορές: ένα ιδιωτικό `MediaGrid`
 * μέσα σε καθένα από τα `BuildingShowcaseClient` · `ParkingShowcaseClient` ·
 * `ProjectShowcaseClient` · `StorageShowcaseClient`, και μία φορά ως `ShowcasePhotoGrid` στο
 * `property-showcase`. Τα τέσσερα πρώτα ήταν **χαρακτήρα προς χαρακτήρα** ίδια εκτός από το
 * όνομα του τύπου των δεδομένων — και ο τύπος ήταν **ήδη** ένας (`ShowcaseMediaItem`, ADR-698):
 * τα `BuildingShowcaseMedia`/`ParkingShowcaseMedia`/… είναι σημειωμένα `@deprecated` ψευδώνυμά
 * του. Δηλαδή η αιτία της αντιγραφής **είχε ήδη εξαλειφθεί** και τα αντίγραφα έμειναν.
 *
 * ⚠️ Το CHECK 3.28 (jscpd) δεν τα έπιασε γιατί το Layer 2 του σαρώνει `src/` με κατώφλι 50
 * σημείων ανά **ζεύγος** και αυτά είναι μικρά αρχεία σε διαφορετικούς φακέλους· το CHECK 3.18
 * είναι regex/ονόματος και τα ονόματα ήταν **τοπικά** (`MediaGrid`, μη εξαγόμενο). Τα βρήκε η
 * μετανάστευση του ADR-784, ρωτώντας κάτι εντελώς άλλο.
 *
 * ── ΤΟ ΠΛΗΘΟΣ ΣΤΗΛΩΝ ──
 *
 * Ρωτά τον SSoT (`gridPatterns.cards.tile`), όχι το παράθυρο. Το δάπεδο των **15rem** βγαίνει
 * από τις **ίδιες τις δηλώσεις** αυτού του κελιού: η εικόνα δηλώνει ύψος **160 px** (`h-40`) με
 * `object-cover`, άρα μια φωτογραφία 3:2 θέλει **240 px** πλάτος για να μην κοπεί σε κάθετη
 * λωρίδα — και 240 px **είναι** το πλακίδιο.
 *
 * ⚠️ Οι σελίδες showcase ζουν **μέσα** στο `(app)` route group, δηλαδή **φοράνε το κέλυφος**
 * (`.shell-boundary.json`). Άρα το δοχείο τους είναι «παράθυρο μείον πλευρικό μενού», και το
 * μενού **συμπτύσσεται**: στα 820 px παραθύρου με ανοιχτό μενού το δοχείο είναι ~492 px, ενώ η
 * παλιά σκάλα φώναζε τρεις στήλες (σκαλί των 768 px) ⇒ **156 px ανά φωτογραφία των 160 px
 * ύψους**. Αυτό δεν ήταν προτίμηση, ήταν βλάβη.
 *
 * @module components/showcase-core/ShowcaseMediaGrid
 */

import React from 'react';

import { gridPatterns } from '@/styles/design-tokens';

/**
 * Το **δομικό ελάχιστο** που χρειάζεται αυτό το πλέγμα.
 *
 * ⚠️ Δηλώνεται εδώ αντί να εισαχθεί το `ShowcaseMediaItem` του διακομιστή, ώστε ένα
 * component του πελάτη να μην κουβαλά εξάρτηση από module υπηρεσίας. Και οι δύο σημερινές
 * μορφές (`ShowcaseMediaItem` · `ShowcaseMedia` του `property-showcase`) το ικανοποιούν.
 */
export interface ShowcaseMediaGridItem {
  id: string;
  url: string;
  displayName?: string | null;
}

export interface ShowcaseMediaGridProps {
  media: ShowcaseMediaGridItem[];
  /** Επικεφαλίδα της ενότητας — **μεταφρασμένη από τον καλούντα** (N.11: μηδέν κείμενο εδώ). */
  title: string;
  /**
   * Εναλλακτικό κείμενο όταν το στοιχείο δεν έχει όνομα. Προεπιλογή: ο τίτλος της ενότητας —
   * ακριβώς ό,τι έκαναν και τα τέσσερα αντίγραφα.
   */
  emptyAlt?: string;
}

export function ShowcaseMediaGrid({ media, title, emptyAlt }: ShowcaseMediaGridProps) {
  if (media.length === 0) return null;

  return (
    <section className="bg-[hsl(var(--showcase-surface))] rounded-xl shadow-sm p-5 border border-[hsl(var(--showcase-border))]">
      <h2 className="text-lg font-semibold text-[hsl(var(--showcase-fg))] mb-4">{title}</h2>
      <div className={`grid gap-3 ${gridPatterns.cards.tile}`}>
        {media.map((item) => (
          <figure key={item.id} className="overflow-hidden rounded-lg bg-[hsl(var(--showcase-bg))]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.url}
              alt={item.displayName || emptyAlt || title}
              loading="lazy"
              className="w-full h-40 object-cover hover:scale-105 transition-transform duration-300"
            />
            {item.displayName && (
              <figcaption className="text-xs text-[hsl(var(--showcase-muted-fg))] px-2 py-1 truncate">
                {item.displayName}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    </section>
  );
}
