'use client';

/**
 * @fileoverview ADR-945 §7.6 — **η ΜΙΑ επιφάνεια του `/pro` «για» ακίνητο**, με δύο θέσεις: η λωρίδα πλαισίου πάνω από
 *   τη λίστα και το «Ζήτησε προσφορά» στην κάρτα / στο προφίλ.
 * @related issuance-quote-surfaces.tsx (η δήλωση) · AgencyIssuanceContextBar.tsx · AgencyRequestQuoteButton.tsx
 * @module components/mandate/AgencyIssuanceQuoteSurface
 *
 * 🔑 **Μία επιφάνεια, όχι δύο** (πρότυπο `CatalogPriceLineTools`, ADR-923 §5.5.2 Β4): τα δύο μιλούν το ΙΔΙΟ λεξιλόγιο
 *    (`property-market` · `document-registry` · ετικέτες είδους `conveyance`/`legality`) και εμφανίζονται ΜΑΖΙ — δύο
 *    κλειδιά θα δήλωναν τα ίδια namespaces δύο φορές στο κατάστιχο (ADR-744 §27) για ένα chunk που φτάνει έτσι κι αλλιώς.
 */

import React from 'react';

import type { PublicShowcase } from '@/types/agency-profile';
import { AgencyIssuanceContextBar } from './AgencyIssuanceContextBar';
import { AgencyRequestQuoteButton } from './AgencyRequestQuoteButton';

export type AgencyIssuanceQuoteSurfaceProps =
  | { readonly slot: 'context-bar' }
  | { readonly slot: 'request-button'; readonly showcase: PublicShowcase };

export function AgencyIssuanceQuoteSurface(props: AgencyIssuanceQuoteSurfaceProps): React.ReactElement | null {
  return props.slot === 'context-bar' ? <AgencyIssuanceContextBar /> : <AgencyRequestQuoteButton showcase={props.showcase} />;
}
