'use client';

/**
 * @fileoverview **ΤΑ ΠΕΔΙΑ ΤΗΣ ΠΡΟΣΦΟΡΑΣ** — ακριβώς το §25.6, και τίποτε άλλο.
 * @related ADR-777 §7 (Α14 §17.2 · Α20 · Α22) · §25.6 · types/owner-property.ts
 * @module components/owner-property/form/OwnerPropertyFields
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΟΙ ΤΡΕΙΣ ΔΕΣΜΕΥΤΙΚΟΙ ΚΑΝΟΝΕΣ ΤΗΣ Α14 §17.2, ΚΑΙ ΠΟΥ ΤΗΡΕΙΤΑΙ Ο ΚΑΘΕΝΑΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Κανόνας | Πού τηρείται |
 * |---|---|
 * | ρωτάμε **μόνο** ό,τι χρειάζεται το ταίριασμα | τα πεδία είναι **ακριβώς** τα «5 βασικά + 3 ειδικά» του §25.6 — κανένα «τηλέφωνο», κανένα «περιγραφή ακινήτου σε 500 λέξεις» |
 * | **ποτέ** ό,τι μπορούμε να υπολογίσουμε | η **κατάσταση** και τα **είδη διάθεσης** δεν ρωτιούνται: **παράγονται** από τις διαθέσεις (Α20)· το **σημείο** λύνεται από κείμενο· ταυτότητα/κάτοχος/χρόνοι γεννιούνται από την πύλη |
 * | η φόρμα **μικραίνει** όσο δίνεις | τα **ποσά** ζωγραφίζονται **μόνο** για τα είδη που τσέκαρε ο άνθρωπος — δες {@link OwnerOffersField} |
 *
 * 🔑 **Το «μικραίνει» εδώ είναι κυριολεκτικό και δεν κοστίζει τίποτα**: οι τιμές των
 * μη-επιλεγμένων ειδών **μένουν** στη μνήμη της φόρμας (το σχήμα είναι επίπεδο), οπότε
 * ο άνθρωπος που ξετσεκάρει «ενοικίαση» και το ξανασκέφτεται **βρίσκει το ενοίκιό
 * του**. Μια φόρμα που σβήνει ό,τι δεν είναι ενεργό τιμωρεί την εξερεύνηση.
 */

import React from 'react';
import { useFormContext } from 'react-hook-form';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  FormFieldset,
  FormInputField,
  FormOptionsField,
} from '@/components/shared/forms/form-field-primitives';
import {
  PROPERTY_TYPES,
  PLACE_ANSWERS,
  type OwnerPropertyFormValues,
} from '@/lib/owner-property/owner-property-form-values';
import { PROPERTY_TYPE_I18N_KEYS } from '@/constants/property-types';
import { OFFER_KINDS, type OfferKind } from '@/types/property-offers';

const NS = 'search-results';
const K = `${NS}:offer`;

/** Ο έλεγχος της φόρμας — **ένα** σημείο ανάγνωσης ανά component. */
function useOfferForm() {
  return useFormContext<OwnerPropertyFormValues>();
}

// =============================================================================
// 1. ΤΑΥΤΟΤΗΤΑ — τίτλος + είδος
// =============================================================================

/**
 * **Τι είναι το ακίνητο.**
 *
 * ⚠️ **Ο τίτλος είναι κείμενο ΤΟΥ ΑΝΘΡΩΠΟΥ και ταξιδεύει στη δημόσια αγγελία** — ο
 * μόνος τέτοιος. Ζητείται ρητά (και όχι παραγόμενος από «είδος + εμβαδόν») επειδή το
 * `PublicListing.title` το ονομάζει *«κείμενο του κατόχου — **όχι** κλειδί i18n»*: η
 * κάρτα οφείλει να λέει ό,τι θα έλεγε ο ιδιοκτήτης, όχι ό,τι θα συνέθετε ένα πρότυπο.
 *
 * 🔑 **Τα είδη έρχονται από το `PROPERTY_TYPES` και οι ετικέτες από το
 * `PROPERTY_TYPE_I18N_KEYS`** — το ίδιο SSoT που χρησιμοποιεί ο επαγγελματίας. Μια
 * δεύτερη λίστα ειδών «απλοποιημένη για ιδιώτες» θα σήμαινε ότι τα δύο ακροατήρια
 * καταχωρούν **διαφορετικά πράγματα**, και το ταίριασμα θα τα έχανε.
 */
export function OwnerIdentityFields(): React.ReactElement {
  const { t } = useTranslation([NS, 'properties-enums']);
  const { control } = useOfferForm();

  return (
    <FormFieldset legend={t(`${K}.form.identity`)}>
      <FormInputField<OwnerPropertyFormValues>
        control={control}
        name="title"
        kind="text"
        label={t(`${K}.form.titleLabel`)}
        placeholder={t(`${K}.form.titlePlaceholder`)}
      />
      <p className="text-sm text-foreground">{t(`${K}.form.typeLabel`)}</p>
      <FormOptionsField<OwnerPropertyFormValues, (typeof PROPERTY_TYPES)[number]>
        control={control}
        name="type"
        mode="single"
        options={PROPERTY_TYPES}
        labelOf={(type) => t(`properties-enums:${PROPERTY_TYPE_I18N_KEYS[type]}`)}
      />
    </FormFieldset>
  );
}

// =============================================================================
// 2. ΜΕΓΕΘΟΣ ΚΑΙ ΔΙΑΤΑΞΗ — εμβαδόν · όροφος · υπνοδωμάτια
// =============================================================================

/**
 * **Τα τρία μεγέθη που ρωτά το §25.6** — και μόνο αυτά.
 *
 * ⚠️ **Το `0` είναι υπαρκτή τιμή δύο φορές εδώ**: `floor: 0` = **ισόγειο**,
 * `bedrooms: 0` = **γκαρσονιέρα**. Γι' αυτό τα πεδία είναι ελεγχόμενα και το κενό
 * γίνεται `null` — δες {@link FormInputField}. Ένα `min={0}` στον όροφο θα ήταν
 * **λάθος**: το υπόγειο είναι `-1`.
 */
export function OwnerBasicsFields(): React.ReactElement {
  const { t } = useTranslation([NS]);
  const { control } = useOfferForm();

  return (
    <FormFieldset legend={t(`${K}.form.basics`)}>
      <FormInputField<OwnerPropertyFormValues>
        control={control}
        name="areaSqm"
        kind="number"
        label={t(`${K}.form.areaLabel`)}
        min={1}
      />
      <FormInputField<OwnerPropertyFormValues>
        control={control}
        name="floor"
        kind="number"
        label={t(`${K}.form.floorLabel`)}
      />
      <p className="text-sm text-muted-foreground">{t(`${K}.form.floorHelp`)}</p>
      <FormInputField<OwnerPropertyFormValues>
        control={control}
        name="bedrooms"
        kind="number"
        label={t(`${K}.form.bedroomsLabel`)}
        min={0}
      />
      <p className="text-sm text-muted-foreground">{t(`${K}.form.bedroomsHelp`)}</p>
    </FormFieldset>
  );
}

// =============================================================================
// 3. ΟΙ ΔΙΑΘΕΣΕΙΣ — ο άξονας της Α20, με την Α22 δίπλα του
// =============================================================================

/** Ποιο πεδίο ποσού ανήκει σε ποιο είδος — **ο τύπος το ξέρει, εδώ απλώς ονομάζεται**. */
const AMOUNT_FIELD: Readonly<Record<OfferKind, keyof OwnerPropertyFormValues>> = {
  sell: 'askingPrice',
  leaseOut: 'rentPrice',
  exchange: 'exchangePercentage',
};

/** Το κλειδί ετικέτας κάθε ποσού. Παράλληλος πίνακας **επίτηδες κλειστός**. */
const AMOUNT_LABEL: Readonly<Record<OfferKind, string>> = {
  sell: 'askingPriceLabel',
  leaseOut: 'rentPriceLabel',
  exchange: 'exchangePercentageLabel',
};

/**
 * **«Τι θέλεις να κάνεις με το ακίνητο;»** — και το ποσό που ζητά η κάθε απάντηση.
 *
 * 🔑 **ΕΔΩ ΖΕΙ Η ΑΝΤΙΠΑΡΟΧΗ**, και δεν χρειάστηκε καμία επινόηση: το `OFFER_KINDS`
 * την ονομάζει από την **Α20** και το `ExchangeOffer` κουβαλά **ΠΟΣΟΣΤΟ**, όχι τιμή.
 * Είναι η **μόνη** από τις τρεις που κανένα ελληνικό portal δεν εκφράζει ως προσφορά.
 *
 * 🔴 **Το ποσό εμφανίζεται ΜΟΝΟ για τα τσεκαρισμένα είδη — αυτό είναι ο κανόνας 3.**
 * Και η **Α22** είναι δίπλα του γραμμένη: *«χωρίς τιμή δεν δημοσιεύεται»*, με τον λόγο
 * στην ίδια πρόταση. Ο άνθρωπος μαθαίνει **γιατί** το ζητάμε τη στιγμή που το ζητάμε
 * — όχι με κόκκινο μήνυμα αφού πατήσει υποβολή.
 *
 * ⚠️ **Πολλαπλή επιλογή**, γιατί το μοντέλο είναι *«ΕΝΑ ακίνητο, ΠΟΛΛΕΣ διαθέσεις»*.
 * Ένα `<select>` μονής επιλογής θα ξανάφερνε ακριβώς το ελάττωμα που η Α20 έλυσε: η
 * αγορά λύνει το «και προς πώληση και προς ενοικίαση» με **δύο εγγραφές**, και μετά
 * επιβάλλει τη συνέπειά τους με **προθεσμία σε κανονισμό**.
 */
export function OwnerOffersField(): React.ReactElement {
  const { t } = useTranslation([NS]);
  const { control, watch } = useOfferForm();
  const chosen = watch('offerKinds');

  return (
    <FormFieldset legend={t(`${K}.offerKind.label`)} help={t(`${K}.offerKind.help`)}>
      <FormOptionsField<OwnerPropertyFormValues, OfferKind>
        control={control}
        name="offerKinds"
        mode="multiple"
        options={OFFER_KINDS}
        labelOf={(kind) => t(`${K}.offerKind.${kind}`)}
      />

      {/*
        ⚠️ Η σειρά ακολουθεί το `OFFER_KINDS` και **όχι** τη σειρά που τσέκαρε ο
        άνθρωπος: τα πεδία δεν επιτρέπεται να αναπηδούν όταν αλλάζει η επιλογή του.
      */}
      {OFFER_KINDS.filter((kind) => chosen?.includes(kind)).map((kind) => (
        <FormInputField<OwnerPropertyFormValues>
          key={kind}
          control={control}
          name={AMOUNT_FIELD[kind]}
          kind="number"
          label={t(`${K}.form.${AMOUNT_LABEL[kind]}`)}
          min={1}
        />
      ))}

      {(chosen?.length ?? 0) > 0 && (
        <p className="text-sm text-muted-foreground">{t(`${K}.form.priceHelp`)}</p>
      )}
    </FormFieldset>
  );
}

// =============================================================================
// 4. Η ΘΕΣΗ — «υποχρεωτικό ΕΡΩΤΗΜΑ, όχι υποχρεωτική ΑΠΑΝΤΗΣΗ»
// =============================================================================

/**
 * **Η επιλογή ανάμεσα στις δύο έγκυρες απαντήσεις** (Α5 §3).
 *
 * 🔴 **Το «δεν θέλω να το πω τώρα» είναι ΕΠΙΛΟΓΗ ΣΤΗΝ ΟΘΟΝΗ, όχι σιωπηλή παράλειψη.**
 * Αυτό ακριβώς κάνει τη διάκριση `never-asked` ⇄ `owner-declined` **παρατηρήσιμη**:
 * μια φόρμα που ρώτησε και μια φόρμα που δεν ρώτησε ποτέ θα κατέληγαν αλλιώς στο
 * **ίδιο** έγγραφο, και η δημόσια κάρτα δεν θα μπορούσε να πει την αλήθεια για το
 * ποιος άφησε τη θέση κενή.
 *
 * ⚠️ Το κόστος λέγεται **μετρημένα και χωρίς απειλή**: *«δεν εμφανίζεται στον χάρτη —
 * μόνο στη λίστα»*. Η **Α5 §4.4** επιτρέπει ποσοστά (*«οι αγγελίες χωρίς θέση
 * λαμβάνουν Χ% λιγότερα μηνύματα»*) **μόλις** υπάρχουν δεδομένα, **ποτέ πριν**.
 */
export function OwnerPlaceAnswerField(): React.ReactElement {
  const { t } = useTranslation([NS]);
  const { control } = useOfferForm();

  return (
    <FormOptionsField<OwnerPropertyFormValues, (typeof PLACE_ANSWERS)[number]>
      control={control}
      name="placeAnswer"
      mode="single"
      options={PLACE_ANSWERS}
      labelOf={(answer) => t(`${K}.placeAnswer.${answer}`)}
    />
  );
}
