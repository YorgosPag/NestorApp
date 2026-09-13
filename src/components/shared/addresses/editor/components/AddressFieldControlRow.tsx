'use client';
/**
 * @fileoverview **ΜΙΑ ΓΡΑΜΜΗ: ΤΟ ΠΕΔΙΟ ΚΑΙ ΤΟ ΣΧΟΛΙΟ ΤΟΥ** — και ποιος υποχωρεί πρώτος.
 * @related address-field-widths · AddressFieldBadge · AddressWithHierarchy · ADR-332 D27 Ζ7
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Το μοτίβο «control + σήμα κατάστασης» ήταν γραμμένο **πέντε** φορές: τέσσερα
 * χειρόγραφα αντίγραφα μέσα στο `AddressWithHierarchy` και ένα στο `AddressFormFieldRow`.
 * Και τα πέντε είχαν **το ίδιο** ελάττωμα, γιατί ήταν το ίδιο ελάττωμα αντιγραμμένο:
 *
 * ```tsx
 * <div className="flex items-center gap-1.5">
 *   <Input className="flex-1" />        // flex-shrink: 1 ⇒ πέφτει ως το 0
 *   <AddressFieldBadge />               // min-content  ⇒ δεν υποχωρεί ΠΟΤΕ
 * </div>
 * ```
 *
 * **Μετρημένο ζωντανά 2026-09-13** σε στήλη 346px: `fieldset 122,8 = input 26,5 +
 * badge 90,3 + gap 6`. Μείον padding 24 ⇒ **ωφέλιμο πλάτος 0**. Ο άνθρωπος δεν έβλεπε
 * τι έγραφε. Στο `FrontageAddressCreateDialog` (`sm:max-w-md`, **σταθερό** πλάτος) αυτό
 * ίσχυε σε **ΚΑΘΕ οθόνη** — και **703 tests ήταν πράσινα**.
 *
 * 🔑 **Η ΑΡΧΗ**: *το πεδίο είναι το δεδομένο· η κατάσταση είναι **σχόλιο** για το
 * δεδομένο. Το σχόλιο δεν τρώει ποτέ τον χώρο του δεδομένου.* Η προτεραιότητα
 * συρρίκνωσης ήταν **ανάποδη** — το μόνο άκαμπτο ήταν το δευτερεύον.
 *
 * 🏆 Material Design 3 / Carbon / GOV.UK βάζουν την ένδειξη κατάστασης **μέσα** στο πεδίο
 * ή **από κάτω** — **ποτέ δίπλα**. Η παλιά διάταξη ήταν ήδη εκτός πρακτικής των μεγάλων.
 * Εδώ το σήμα μένει ορατό και **τυλίγεται** όταν δεν χωρά: κρατά το πλεονέκτημα της
 * γειτνίασης, χωρίς να πληρώνει το πεδίο.
 *
 * ⛔ **Η θεραπεία ΔΕΝ ζει στο `components/ui/input`.** Εκείνο είναι SSoT ολόκληρης της
 * εφαρμογής· το πρόβλημα είναι **της γραμμής**, όχι του control.
 */

import type { CSSProperties, ReactNode } from 'react';

import { addressFieldMinChars } from '../address-field-widths';
import styles from './address-field-control-row.module.css';

interface AddressFieldControlRowProps {
  /**
   * Το όνομα του πεδίου — **δύο ρόλοι, και οι δύο ουσιαστικοί**:
   * (α) επιλέγει το δάπεδο από το `ADDRESS_FIELD_MIN_CHARS`,
   * (β) γίνεται `data-address-field-row`, ώστε η πύλη ωφέλιμου πλάτους να ξέρει
   *     **ποιο** πεδίο μετρά αντί να μαντεύει από σειρά DOM ή από placeholder.
   */
  readonly field: string;
  /** Το control (`<Input>` ή `<SearchableCombobox>`) — παίρνει όλο το πλάτος του φορέα. */
  readonly children: ReactNode;
  /** Το σήμα κατάστασης. Παραλείπεται όταν δεν υπάρχει `fieldStatus`. */
  readonly badge?: ReactNode;
}

export function AddressFieldControlRow({ field, children, badge }: AddressFieldControlRowProps) {
  /*
    Custom property αντί για inline στυλ: η **τιμή** περνά από το TypeScript, ο **κανόνας**
    ζει στο CSS module (N.3). Ίδιο μοτίβο με το `--qp-swatch` του dxf-viewer.
  */
  const controlStyle = { '--address-field-min': `${addressFieldMinChars(field)}ch` } as CSSProperties;
  return (
    <div className={styles.row} data-address-field-row={field}>
      <div className={styles.control} style={controlStyle}>
        {children}
      </div>
      {badge ? (
        <div className={styles.badge} data-address-field-badge={field}>
          {badge}
        </div>
      ) : null}
    </div>
  );
}

/**
 * **Οι κλάσεις της ομάδας πεδίων** — ο γονέας που κρατά τις γραμμές.
 *
 * Εξάγονται ως σταθερές αντί για component γιατί ο γονέας είναι ήδη σημασιολογικό
 * στοιχείο στα σημεία κλήσης (`<fieldset>` μέσα σε `<div>`), και ένα ακόμη component
 * θα πρόσθετε επίπεδο DOM χωρίς να προσθέτει νόημα (N.4).
 *
 * ⚠️ `addressFieldGroup` **αντικαθιστά** το `grid grid-cols-3 gap-3`, που ήταν σταθερές
 * τρεις στήλες **χωρίς breakpoint** — δες το σχόλιο στο `.group` του CSS module για το
 * τι συνέβαινε σε πλάτος 216px.
 */
export const addressFieldGroup = styles.group;
/** Ένα μερίδιο της ομάδας. */
export const addressFieldCell = styles.field;
/** Διπλό μερίδιο — αντικαθιστά το `col-span-2`. */
export const addressFieldCellWide = styles.fieldWide;
