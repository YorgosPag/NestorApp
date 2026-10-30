'use client';

/**
 * @fileoverview **Τα ονόματα των συμβαλλομένων** — ό,τι λέει η όψη (`partyNames`) **+** ό,τι μόλις διάλεξε ο άνθρωπος
 *   (ADR-923 §5.11 «3δ», Σ6 ζωντανής επαλήθευσης).
 * @related PricingPartyPicker.tsx (ο ΕΝΑΣ που θυμάται) · use-discounts-workspace.ts (η ΜΙΑ ένωση) ·
 *   use-discount-words.ts (`usePartyName`: η ΜΙΑ απόδοση για τίτλο · περιόδους · μέλη)
 * @module components/catalog/pricing/party-name-memory
 *
 * 🔑 **Ο διακομιστής υπερισχύει**: το όνομα του επιλογέα είναι αυτό που **είδε** ο άνθρωπος τη στιγμή της επιλογής· μόλις η
 *    όψη φέρει το δικό της (expand στην ίδια συναλλαγή), εκείνο κερδίζει — μετονομασία της επαφής δεν σκιάζεται ποτέ.
 * 🔑 **Γιατί υπάρχει** (Σ6): νέα συνθήκη με συνεργάτη έλεγε «Επαφή χωρίς όνομα» ως την ανανέωση της όψης, ενώ ο επιλογέας
 *    έδειχνε «Γεωργία Ζέρβα» — ψέμα στον τίτλο, στις περιόδους και στο αισιόδοξο μέλος ομάδας. Όνομα ≠ τιμή: η απόφαση Ζ
 *    (τιμές μόνο από τον διακομιστή) δεν αγγίζεται.
 * ⚠️ Context, όχι prop: ο επιλογέας ζει μέσα στο **κοινό** `AudienceField` (και των τιμοκαταλόγων)· χωρίς πάροχο = καμία μνήμη.
 */

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { pricingPartyKey } from '@/subapps/catalog/pricing/price-audience';
import type { PricingPartyRef } from '@/subapps/catalog/types/price-list';

export type PartyNames = Readonly<Record<string, string>>;
export type RememberPartyName = (party: PricingPartyRef, name: string) => void;

/** Συμβαλλόμενος χωρίς επιλογή (το κοινό «συνεργάτης» πριν διαλέξει ο άνθρωπος) — δεν είναι «χωρίς όνομα». */
export const isUnsetParty = (party: PricingPartyRef): boolean =>
  (party.kind === 'contact' ? party.contactId : party.companyId).trim() === '';

/** Η ένωση: ό,τι διάλεξε ο άνθρωπος, με τον διακομιστή να υπερισχύει. */
export const mergePartyNames = (server: PartyNames, picked: PartyNames): PartyNames => ({ ...picked, ...server });

/** Ίδιο όνομα ⇒ ίδιο αντικείμενο (καμία άσκοπη απόδοση)· κενό όνομα δεν θυμάται τίποτα. */
export function withPickedName(picked: PartyNames, party: PricingPartyRef, name: string): PartyNames {
  const trimmed = name.trim();
  const key = pricingPartyKey(party);
  if (trimmed === '' || isUnsetParty(party) || picked[key] === trimmed) return picked;
  return { ...picked, [key]: trimmed };
}

const PartyNameMemoryContext = createContext<RememberPartyName>(() => undefined);

export const PartyNameMemoryProvider = PartyNameMemoryContext.Provider;

export const useRememberPartyName = (): RememberPartyName => useContext(PartyNameMemoryContext);

export function usePartyNameMemory(server: PartyNames): { readonly names: PartyNames; readonly remember: RememberPartyName } {
  const [picked, setPicked] = useState<PartyNames>({});
  const remember = useCallback<RememberPartyName>((party, name) => setPicked((previous) => withPickedName(previous, party, name)), []);
  const names = useMemo(() => mergePartyNames(server, picked), [server, picked]);
  return { names, remember };
}
