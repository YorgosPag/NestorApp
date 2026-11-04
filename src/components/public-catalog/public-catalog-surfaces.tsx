'use client';

/**
 * @fileoverview Οι τεμπέλικες **επιφάνειες** της δημόσιας βιτρίνας (ADR-923 §5.13 Σ6 · ADR-280 §11.8 Β4.1 · ADR-744 §27).
 * @module components/public-catalog/public-catalog-surfaces
 *
 * 🔑 Οι τιμές ζωγραφίζονται πίσω από το `defineLazySurfaces`, την ΙΔΙΑ μηχανή με τις διαδρομές: το chunk περιμένει τα κείμενά
 *    του (`awaitedNamespaces`), άρα δεν βγαίνει ποτέ ωμό κλειδί, και τα κείμενα δεν βαραίνουν το σφραγισμένο route slice των
 *    σελίδων (CHECK 3.34). Επιφάνεια = πάντα client-only: η ανώνυμη τιμή βρίσκεται στα δεδομένα του ISR και στο JSON-LD,
 *    και **ζωγραφίζεται** μετά την ενυδάτωση.
 * 🔑 Με κλειστό διακόπτη καμία επιφάνεια δεν αποδίδεται, άρα κανένα chunk και κανένα namespace δεν ζητείται.
 * ⚠️ Το μητρώο δέχεται `ComponentType<any>`: οι λεπτές προσόψεις παρακάτω ξαναδίνουν τους τύπους, ώστε ο καλών να μη χάνει τον
 *    έλεγχο των props. Λεπτό μητρώο: εισάγει μόνο το factory και τύπους.
 */

import type { PublicCatalogModel } from '@/subapps/catalog/public/public-catalog-schema';
import type { ShowcaseConsumerPrice, ShowcasePriceSurfaceProps } from '@/subapps/catalog/public/showcase-price';
import { defineLazySurfaces } from '@/utils/lazyRouteFactory';

const PublicCatalogSurfaces = defineLazySurfaces({
  PublicCatalogPrice: {
    load: () => import('./ShowcasePriceSurface'),
  },
});

function PriceSurface(props: ShowcasePriceSurfaceProps) {
  return <PublicCatalogSurfaces.PublicCatalogPrice {...props} />;
}

export function PublicPriceSlot({ price }: { readonly price: ShowcaseConsumerPrice }) {
  return <PriceSurface mode="public" price={price} />;
}

export function PublicFromPriceSlot({ price }: { readonly price: ShowcaseConsumerPrice }) {
  return <PriceSurface mode="from" price={price} />;
}

export function BuyerPriceIslandSlot({ model }: { readonly model: PublicCatalogModel }) {
  return <PriceSurface mode="buyer" model={model} />;
}
