/**
 * @fileoverview **Το εμβαδόν που δείχνουμε για ένα ακίνητο** — μικτό, αλλιώς καθαρό, αλλιώς το παλιό επίπεδο `area`.
 * @module lib/properties/property-display-area
 *
 * 🧹 Η ίδια αλυσίδα `areas?.gross || areas?.net || area` ήταν γραμμένη αυτούσια σε **έξι** αρχεία (καρτέλα Μονάδων κτιρίου ×4,
 * κάρτα ακινήτου, πλέγμα, γρήγορη προβολή, κοινοποίηση). Εδώ ζει **μία** φορά (ADR-898 Φ4β — η εξαγωγή XLSX χρειαζόταν
 * πέμπτη)· οι καταναλωτές εκτός καρτέλας κτιρίου περνούν όταν αγγιχτούν (`.claude-rules/pending-ratchet-work.md`).
 *
 * ⚠️ `0` σημαίνει **«δεν μετρήθηκε»**, όχι «μηδέν τετραγωνικά» — γι' αυτό `||` και όχι `??`, ακριβώς όπως η αλυσίδα που
 * αντικαθιστά. Η απουσία επιστρέφεται ως `null`: κενό κελί, ποτέ «0 m²» (και ποτέ μέρος αθροίσματος).
 */

export interface DisplayAreaSource {
  readonly areas?: { readonly gross?: number; readonly net?: number } | null;
  readonly area?: number | null;
}

export function propertyDisplayArea(source: DisplayAreaSource): number | null {
  return source.areas?.gross || source.areas?.net || source.area || null;
}
