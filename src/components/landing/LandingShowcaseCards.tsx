'use client';

/**
 * Οι δύο κάρτες της αρχικής σελίδας — **ΕΝΑΣ** ορισμός ανά είδος.
 *
 * Μέχρι σήμερα το `LandingPage.tsx` έγραφε **τρία αντίγραφα** της κάρτας
 * χαρακτηριστικού και **τρία** της κάρτας ακινήτου, με μόνη διαφορά το εικονίδιο,
 * τον τόνο χρώματος και τα κλειδιά i18n. Το CHECK 3.28 (jscpd, token-based) τα
 * μετρούσε ως **τέσσερα ζεύγη κλώνων** μέσα στο ίδιο αρχείο — αυτο-κλώνος, που
 * **κανένα σπλιτ commit δεν λύνει**: η μόνη θεραπεία είναι ένας ορισμός.
 *
 * 🔑 **Ο ΤΟΝΟΣ ΕΙΝΑΙ ΚΛΕΙΔΙ, ΟΧΙ ΚΛΑΣΗ.** Οι κάρτες δέχονται `tone: CardTone`
 * και λύνουν μόνες τους `colors.bg[tone]` / `colors.text[tone]` από το
 * `useSemanticColors`. Αν δέχονταν έτοιμες κλάσεις (`iconBgClass`), ο καλών θα
 * ξαναέγραφε χρώμα σε **κάθε** σημείο κλήσης — δηλαδή ο κλώνος θα μετακινούνταν
 * στα props αντί να λυθεί, και οι πύλες 3.38/3.42 θα έχαναν το ίχνος του.
 *
 * ⚠️ **Το `gradientClass` ΕΙΝΑΙ εξαίρεση, και ο λόγος είναι μετρημένος**: τα
 * `from-blue-400 to-blue-600` είναι **ωμή παλέτα Tailwind**, που το CHECK 3.26
 * (ADR-365, baseline **0/0** — εκστρατεία ολοκληρωμένη) μπλοκάρει με **μηδενική
 * ανοχή σε ΝΕΟ αρχείο**. Μένουν όπου ήταν, στο `LandingPage.tsx`, ως δεδομένα.
 * Η σωστή θεραπεία τους είναι σημασιολογικά tokens — **άλλο ερώτημα, άλλη
 * δουλειά**· μετακόμιση εδώ θα τα έκανε παράβαση χωρίς να τα διορθώσει.
 *
 * @module components/landing/LandingShowcaseCards
 */

import React from 'react';
import { Star } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import '@/lib/design-system';

/** Οι σημασιολογικοί τόνοι που χρησιμοποιούν οι κάρτες της αρχικής. */
export type CardTone = 'info' | 'accent' | 'success';

const TOTAL_STARS = 5;

export interface FeatureCardProps {
  readonly icon: LucideIcon;
  readonly tone: CardTone;
  readonly title: string;
  readonly description: string;
}

/** Κάρτα χαρακτηριστικού: εικονίδιο σε χρωματιστό πλαίσιο, τίτλος, περιγραφή. */
export function FeatureCard({ icon: Icon, tone, title, description }: FeatureCardProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  return (
    <article
      className={`${colors.bg.primary} rounded-xl p-6 shadow-sm ${INTERACTIVE_PATTERNS.CARD_STANDARD}`}
    >
      <figure
        className={`${iconSizes.xl2} ${colors.bg[tone]} rounded-lg flex items-center justify-center mb-4`}
      >
        <Icon className={`${iconSizes.lg} ${colors.text[tone]}`} aria-hidden="true" />
      </figure>
      <h3 className={`text-lg font-semibold ${colors.text.foreground} mb-2`}>{title}</h3>
      <p className={colors.text.muted}>{description}</p>
    </article>
  );
}

/**
 * Βαθμολογία με αστέρια.
 *
 * ⚠️ **`Math.floor`, ΟΧΙ `Math.round`** — αναπαράγει την υπάρχουσα συμπεριφορά:
 * το 4,5 ζωγράφιζε **τέσσερα** γεμάτα αστέρια και ένα σβηστό, όχι πέντε.
 */
export function StarRating({ value }: { readonly value: number }) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const filled = Math.floor(value);

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: TOTAL_STARS }, (_, i) => (
        <Star
          key={i}
          className={
            i < filled
              ? `${iconSizes.sm} ${colors.text.warning} fill-current`
              : `${iconSizes.sm} ${colors.text.muted}`
          }
          aria-hidden="true"
        />
      ))}
      <span className={`text-sm ${colors.text.muted} ml-2`}>{value.toFixed(1)}</span>
    </div>
  );
}

export interface PropertyShowcaseCardProps {
  readonly icon: LucideIcon;
  /** Ωμή κλάση gradient — βλ. τη σημείωση στην κεφαλίδα του module. */
  readonly gradientClass: string;
  readonly title: string;
  readonly price: string;
  readonly details: string;
  readonly availableLabel: string;
  readonly rating: number;
  readonly onSelect: () => void;
}

/** Κάρτα προβεβλημένου ακινήτου: εικόνα-gradient, τίτλος, τιμή, βαθμολογία. */
export function PropertyShowcaseCard({
  icon: Icon,
  gradientClass,
  title,
  price,
  details,
  availableLabel,
  rating,
  onSelect,
}: PropertyShowcaseCardProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  return (
    <article
      className={`${colors.bg.primary} rounded-xl shadow-lg overflow-hidden cursor-pointer ${INTERACTIVE_PATTERNS.CARD_ENHANCED}`}
      onClick={onSelect}
    >
      <figure className={`h-48 ${gradientClass} flex items-center justify-center`}>
        <Icon className={`${iconSizes.xl12} ${colors.text.foreground}`} aria-hidden="true" />
      </figure>
      <div className="p-6">
        <div className="flex justify-between items-start mb-2">
          <h3 className={`text-lg font-bold ${colors.text.foreground}`}>{title}</h3>
          <span
            className={`px-2 py-1 ${colors.bg.info} ${colors.text.info} text-xs font-semibold rounded-full`}
          >
            {availableLabel}
          </span>
        </div>
        <p className={`text-2xl font-bold ${colors.text.info} mb-2`}>{price}</p>
        <p className={`${colors.text.muted} text-sm mb-4`}>{details}</p>
        <StarRating value={rating} />
      </div>
    </article>
  );
}
