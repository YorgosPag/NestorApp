'use client';

/**
 * @fileoverview Η όψη αναμονής του τεμπέλικου `FloorplanGallery` (ADR-954 §2) — όσο φτάνουν κώδικας + κείμενα.
 * @related ./floorplan-gallery-surfaces (το μητρώο που τη δηλώνει ως `fallback`)
 * @module components/shared/files/media/FloorplanGalleryPending
 *
 * 🔑 **Κρατά τη θέση της κάτοψης** με το ΙΔΙΟ λεξιλόγιο διάταξης (`flow` · `fill`, ADR-912 §12.17): το `fallback`
 *   ενός μητρώου δεν βλέπει props, γι' αυτό υπάρχει μία όψη ανά διάταξη. `flow` ⇒ το δάπεδο 500px του θεατή, ώστε η
 *   σελίδα να μη «πηδήξει» όταν φτάσει το chunk· `fill` ⇒ ό,τι δίνει ο γονιός — δάπεδο 500px σε χώρο 280px (κινητό)
 *   θα ξανάφερνε το κομμένο, χαμηλωμένο κέντρο που διόρθωσε το ADR-912.
 * ⚠️ Ελαφρύ επίτηδες: ζει στη στατική κλειστότητα του μητρώου — μόνο spinner και το `common` (ήδη στην εκκίνηση).
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { FloorplanGalleryProps } from './floorplan-gallery-props';

type FloorplanGalleryLayout = NonNullable<FloorplanGalleryProps['layout']>;

function FloorplanGalleryPending({ layout }: { readonly layout: FloorplanGalleryLayout }): React.ReactElement {
  const { t } = useTranslation(['common']);
  return (
    <section
      aria-busy="true"
      className={cn(
        'flex flex-col items-center justify-center bg-muted/30',
        layout === 'fill' ? 'h-full min-h-0' : 'min-h-[500px]',
      )}
    >
      <Spinner size="large" aria-label={t('common:common.loading')} />
    </section>
  );
}

/** Για την καρτέλα αρχείων / τη σελίδα-έγγραφο: ο γονιός δεν δίνει ύψος. */
export function FloorplanGalleryPendingFlow(): React.ReactElement {
  return <FloorplanGalleryPending layout="flow" />;
}

/** Για τον θεατή μέσων: ο γονιός δίνει ύψος. */
export function FloorplanGalleryPendingFill(): React.ReactElement {
  return <FloorplanGalleryPending layout="fill" />;
}
