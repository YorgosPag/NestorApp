'use client';

/**
 * **Η μία επιφάνεια τιμής της βιτρίνας** (ADR-923 §5.13 Σ6): ένα chunk, μία αναμονή κειμένων (`public-catalog`), τρεις χρήσεις.
 * Ένα κλειδί στο μητρώο αντί για τρία, ώστε η απογραφή αναμονών (ADR-744 §27) να μεγαλώσει κατά **ένα** ζεύγος.
 *
 * @module components/public-catalog/ShowcasePriceSurface
 */

import React from 'react';

import type { ShowcasePriceSurfaceProps } from '@/subapps/catalog/public/showcase-price';

import { BuyerPriceIsland } from './BuyerPriceIsland';
import { PublicFromPrice, PublicPrice } from './ShowcasePriceView';

export default function ShowcasePriceSurface(props: ShowcasePriceSurfaceProps): React.JSX.Element | null {
  switch (props.mode) {
    case 'public':
      return <PublicPrice price={props.price} />;
    case 'from':
      return <PublicFromPrice price={props.price} />;
    case 'buyer':
      return <BuyerPriceIsland model={props.model} />;
  }
}
