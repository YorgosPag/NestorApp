/**
 * @fileoverview Το κείμενο της μηχανής ενός συρσίματος, **στο λεξιλόγιο της επαφής**.
 * @module components/contacts/details/contact-pin-drop
 * @enterprise ADR-332 D27 Βήμα Β-ΙΙ
 *
 * Ο χάρτης δίνει `PinDrop<Partial<PartialProjectAddress>>` (λεξιλόγιο έργου). Οι επαφές το
 * μεταφράζουν **μία φορά**, στο σύνορο του `ContactAddressMapPreview`, και από εκεί και πέρα
 * ταξιδεύει ολόκληρο το `PinDrop` — μαζί με το σημείο, τη χειρονομία και τις εκβάσεις χωρίς
 * κείμενο (ως το Β-ΙΙ το σημείο και οι εκβάσεις αυτές **πετιούνταν** εδώ).
 */

import type { ResolvedAddressFields } from '@/components/shared/addresses/editor';
import type { PartialProjectAddress } from '@/types/project/addresses';
import { splitStreetAndNumber } from '@/utils/address/address-parse';

/** Η διεύθυνση που πρότεινε η αντίστροφη γεωκωδικοποίηση, με όλα τα πεδία παρόντα. */
export interface DragResolvedAddress {
  street: string;
  number: string;
  postalCode: string;
  city: string;
  neighborhood: string;
  region: string;
  country: string;
}

/**
 * Κείμενο της μηχανής → επαφή.
 *
 * Ο αριθμός φτάνει ήδη χωριστά (`addr.house_number` του Nominatim). Αν λείπει, η διάσπαση
 * «Οδός 12» περνά από τη **μία** γραμματική αριθμού του έργου (`splitStreetAndNumber`) — εδώ
 * ζούσε ένα τρίτο, ιδιωτικό regex που δεν ήξερε το «25ης Μαρτίου 12» ή το «8-10».
 */
export function toContactDraggedAddress(data: Partial<PartialProjectAddress>): DragResolvedAddress {
  const rawStreet = (data.street ?? '').trim();
  const rawNumber = (data.number ?? '').trim();
  const split = !rawNumber && rawStreet ? splitStreetAndNumber(rawStreet) : null;
  return {
    street: split?.street ?? rawStreet,
    number: rawNumber || split?.number || '',
    postalCode: data.postalCode ?? '',
    city: data.neighborhood || data.city || '',
    neighborhood: data.neighborhood ?? '',
    region: data.region ?? '',
    country: data.country ?? '',
  };
}

/** Το ίδιο κείμενο, στο λεξιλόγιο του `AddressEditor` (διάλογος της έδρας). */
export function contactDraggedToResolved(addr: DragResolvedAddress): ResolvedAddressFields {
  return {
    street: addr.street,
    number: addr.number,
    postalCode: addr.postalCode,
    city: addr.city,
    neighborhood: addr.neighborhood,
    region: addr.region,
    country: addr.country,
  };
}
