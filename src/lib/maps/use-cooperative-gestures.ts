'use client';

/**
 * @fileoverview **Ο ΧΑΡΤΗΣ ΜΕΣΑ ΣΤΗ ΣΕΛΙΔΑ ΔΕΝ ΚΛΕΒΕΙ ΤΗΝ ΚΥΛΙΣΗ** — συνεργατικές χειρονομίες, μεταφρασμένες.
 * @related ADR-900 §8 #3 (καταχώριση από κινητό) · `use-default-basemap.ts` (ίδιο σχήμα: `<Map {...hook()}>`) ·
 *   `components/geo/PlaceMap.tsx` (ο ενσωματωμένος χάρτης κάθε φόρμας)
 * @module lib/maps/use-cooperative-gestures
 *
 * 🔴 **ΤΟ ΠΡΟΒΛΗΜΑ — ΜΟΝΟ ΣΤΟ ΚΙΝΗΤΟ ΦΑΙΝΕΤΑΙ.** Χάρτης σε όλο το πλάτος, μέσα σε μακριά φόρμα: το δάχτυλο που
 * θέλει να **κυλήσει τη σελίδα** σέρνει τον **χάρτη**. Ο άνθρωπος εγκλωβίζεται πάνω από το πεδίο «Πού βρίσκεται;»
 * και δεν φτάνει ποτέ στο κουμπί υποβολής. Στον υπολογιστή το ίδιο σύμπτωμα έχει τον τροχό: η κύλιση της σελίδας
 * γίνεται **μεγέθυνση** του χάρτη μόλις ο δείκτης περάσει από πάνω του.
 *
 * 🏆 **Η απάντηση των μεγάλων**: Google Maps JS `gestureHandling: 'cooperative'` (η προεπιλογή `auto` για χάρτη σε
 * σελίδα που κυλά) — ένα δάχτυλο κυλά τη σελίδα, **δύο** μετακινούν τον χάρτη· στον υπολογιστή μεγέθυνση με
 * Ctrl/⌘ + τροχό. Η MapLibre το έχει αυτούσιο (`cooperativeGestures`)· εδώ μένει μόνο να **μιλά ελληνικά**.
 *
 * 🔑 **Το πάτημα ΔΕΝ επηρεάζεται**: ένα δάχτυλο που **πατά** (όχι σέρνει) διαλέγει κτίριο όπως πριν.
 *
 * ⚠️ **Μόνο για χάρτη ΜΕΣΑ σε σελίδα.** Ο χάρτης πλήρους οθόνης της αναζήτησης **είναι** η σελίδα — εκεί δεν
 *    υπάρχει κύλιση να προστατευθεί, και η σκιά «δύο δάχτυλα» θα ήταν σκέτο εμπόδιο.
 * ⚠️ Το `locale` είναι **αρχική** ρύθμιση της MapLibre: αλλαγή γλώσσας πάνω στην ίδια σελίδα ισχύει στον επόμενο
 *    χάρτη που θα γεννηθεί. Τα κλειδιά ζουν στο `common` — ταξιδεύει ολόκληρο στο κέλυφος, άρα απαντά σύγχρονα.
 */

import { useMemo } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';

interface CooperativeGestures {
  readonly cooperativeGestures: true;
  /** Τα τρία μηνύματα της MapLibre — ποιο θα δειχθεί το κρίνει η ίδια (αφή · Mac · αλλιώς). */
  readonly locale: Readonly<Record<string, string>>;
}

export function useCooperativeGestures(): CooperativeGestures {
  const { t } = useTranslation('common');
  return useMemo(
    () => ({
      cooperativeGestures: true,
      locale: {
        'CooperativeGesturesHandler.WindowsHelpText': t('map.gestures.windows'),
        'CooperativeGesturesHandler.MacHelpText': t('map.gestures.mac'),
        'CooperativeGesturesHandler.MobileHelpText': t('map.gestures.mobile'),
      },
    }),
    [t],
  );
}
