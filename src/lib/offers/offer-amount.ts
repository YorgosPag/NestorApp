/**
 * @fileoverview **ΤΟ ΠΟΣΟ ΠΟΥ ΑΠΑΙΤΕΙ Η ΙΔΙΑ Η ΔΙΑΘΕΣΗ** — η Α22 στο επίπεδο του Α20.
 * @related ADR-777 §7 (Α20 · Α22) · §8.7 · constants/commercial-statuses.ts
 * @module lib/offers/offer-amount
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ ΔΙΠΛΟΤΥΠΟ ΤΩΝ `requiresAskingPrice` / `requiresRentPrice`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Οι δύο υπάρχουσες συναρτήσεις απαντούν *«ποια τιμή ζητά μια **ΚΑΤΑΣΤΑΣΗ**;»* —
 * κατηγορήματα πάνω στο **παλιό** λεξιλόγιο (`CommercialStatus`). Αυτό το αρχείο
 * απαντά *«ποιο ποσό ζητά μια **ΔΙΑΘΕΣΗ**;»*. Είναι **άλλο ερώτημα**, και μάλιστα το
 * **θεμελιωδέστερο** από τα δύο, γιατί η **Α20** όρισε ρητά ότι η κατάσταση είναι
 * **ΠΑΡΑΓΟΜΕΝΗ** από τις διαθέσεις — άρα η αλήθεια ζει στη διάθεση και η κατάσταση
 * είναι **lossy προβολή** της.
 *
 * 🔴 **Και το «lossy» δεν είναι θεωρία, είναι η αιτία ύπαρξης αυτού του αρχείου:**
 * μια **αντιπαροχή** προβάλλεται σε `'unavailable'` ({@link KINDS_WITHOUT_LEGACY_PROJECTION}),
 * και το `'unavailable'` **δεν απαιτεί καμία τιμή** από τα δύο κατηγορήματα. Δηλαδή
 * ένα ακίνητο **μόνο προς αντιπαροχή, με ποσοστό `null`**, περνά τους υπάρχοντες
 * ελέγχους **καθαρό**: η Α22 δεν το φρουρεί επειδή **δομικά δεν μπορεί να το δει**.
 * Το ποσοστό δεν είναι «τρίτη τιμή» — είναι το **πρώτο ποσό που το παλιό λεξιλόγιο
 * δεν έχει λέξη να το ζητήσει**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Ο ΤΥΠΟΣ **ΕΙΝΑΙ** Ο ΚΑΝΟΝΑΣ — γι' αυτό δεν υπάρχει πίνακας αντιστοίχισης
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το {@link PropertyOffer} είναι **διακριτή ένωση**: το `SellOffer` **έχει**
 * `askingPrice`, το `LeaseOutOffer` **έχει** `rentPrice`, το `ExchangeOffer` **έχει**
 * `percentage`, το `ShortLeaseOffer` **έχει** `nightlyRate` — και το καθένα **δεν
 * μπορεί να εκφράσει** τα άλλα. Άρα το «ποιο ποσό;» απαντιέται από τον
 * **μεταγλωττιστή**, και εδώ μένει μόνο το «**υπάρχει**;».
 *
 * Ένας χειρόγραφος πίνακας `kind → όνομα πεδίου` θα ήταν **δεύτερη αλήθεια** που
 * αποκλίνει την ημέρα που θα προστεθεί τέταρτο είδος — ενώ το `switch` πάνω στο
 * `kind` **δεν μεταγλωττίζεται** μέχρι κάποιος να απαντήσει (κλειστό σύνολο, ποτέ
 * σιωπηλό `default`).
 *
 * ⚠️ **Η συμφωνία με το παλιό λεξιλόγιο ΔΕΝ δηλώνεται — αποδεικνύεται.** Το
 * `offer-amount.test.ts` εκτελεί, για **κάθε** σχήμα διαθέσεων, τη σύνθεση
 * `deriveCommercialStatus` → `requiresAskingPrice`/`requiresRentPrice` και απαιτεί να
 * συμφωνεί με τα ευρήματα εδώ **για τα δύο είδη που προβάλλονται**. *Ένα σχόλιο που
 * δηλώνει συμφωνία δεν είναι συμφωνία* — το έμαθε η ίδια η Α22 (§8.7).
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, καμία εξάρτηση από React ή Firestore.
 */

import { isLiveOffer, type PropertyOffer } from '@/types/property-offers';

// =============================================================================
// 1. ΤΑ ΟΡΙΑ ΤΩΝ ΑΡΙΘΜΩΝ ΜΙΑΣ ΔΙΑΘΕΣΗΣ — ονομασμένα, ποτέ ωμοί αριθμοί
// =============================================================================

/**
 * Το επιτρεπτό εύρος του ποσοστού οικοπεδούχου.
 *
 * 🔑 **Ίδια σημασία με το `Project.bartexPercentage`** (ADR-244), όπως δηλώνει ήδη το
 * `ExchangeOffer`: *«Το ποσοστό είναι **του οικοπεδούχου** … **μία** σημασία, όχι
 * δεύτερη»*. Ένα δεύτερο εύρος εδώ θα σήμαινε ότι «ποσοστό» σημαίνει άλλο πράγμα
 * ανάλογα με το ποιος ρωτά.
 *
 * ⚠️ Τα άκρα είναι **αποκλειστικά στο 0** και **συμπεριληπτικά στο 100**: ένα
 * `percentage: 0` δεν είναι αντιπαροχή, είναι δωρεά· ένα `100` είναι το ακραίο αλλά
 * **υπαρκτό** «όλα δικά μου».
 */
export const EXCHANGE_PERCENTAGE_MIN_EXCLUSIVE = 0;
export const EXCHANGE_PERCENTAGE_MAX_INCLUSIVE = 100;

/**
 * **Είναι αυτό έγκυρο ποσοστό οικοπεδούχου;** — ο **ΕΝΑΣ** κριτής των ορίων.
 *
 * 🔑 Τον ρωτούν **και** η διάθεση ({@link offerPercentageOutOfRange}) **και** η ζήτηση (οροφή του
 * εργολάβου, ADR-777 §8.60.17): «ποσοστό» σημαίνει **το ίδιο** όποιος κι αν το γράφει.
 */
export function isLandownerShareInRange(value: number): boolean {
  return value > EXCHANGE_PERCENTAGE_MIN_EXCLUSIVE && value <= EXCHANGE_PERCENTAGE_MAX_INCLUSIVE;
}

/**
 * Το κατώτατο **δηλώσιμο** όριο των δύο όρων διαμονής (ADR-835 §4.1).
 *
 * 🔴 **«Δεν δηλώθηκε» και «δηλώθηκε μηδέν» ΔΕΝ είναι το ίδιο, και μόνο το δεύτερο
 * είναι σφάλμα.** Το `null` σημαίνει *«ο κάτοχος δεν έβαλε όριο»* — απολύτως νόμιμο,
 * και **δεν** εμποδίζει τη δημοσίευση. Το `0` σημαίνει *«μηδέν διανυκτερεύσεις»* ή
 * *«μηδέν επισκέπτες»*, δηλαδή κατάλυμα όπου **κανείς δεν μπορεί να μείνει** — αριθμός
 * που ακυρώνει την ίδια τη διάθεση στην οποία ανήκει.
 *
 * ⚠️ **ΜΙΑ σταθερά για τα δύο πεδία, όχι δύο ίδιες**: το κατώφλι είναι το **ίδιο
 * ερώτημα** («ένα, τουλάχιστον;») και δύο σταθερές με την τιμή `1` θα ήταν δύο
 * αριθμοί που μπορούν να αποκλίνουν χωρίς να το προσέξει κανείς.
 */
export const STAY_LIMIT_MIN_INCLUSIVE = 1;

/**
 * **Είναι αυτό έγκυρος αριθμός νυχτών ή ανθρώπων;** — ακέραιος, τουλάχιστον {@link STAY_LIMIT_MIN_INCLUSIVE}.
 *
 * 🔑 Το **ίδιο** κατώφλι με τους όρους του κατόχου, για τη ζήτηση (ADR-777 §8.60.19): «μία νύχτα
 * τουλάχιστον» σημαίνει το ίδιο όποιος κι αν τη γράφει.
 *
 * ⚠️ **Ακέραιος**: 2,5 ενήλικες ή 3,5 νύχτες δεν ζητούνται. Η πλευρά του κατόχου
 * ({@link isDeclaredButBelowStayMinimum}) κρίνει **μόνο** το κατώφλι — δηλωμένο όριο §8.60.19.6.
 */
export function isWholeStayCount(value: number): boolean {
  return Number.isInteger(value) && value >= STAY_LIMIT_MIN_INCLUSIVE;
}

/**
 * **Το ανώτατο πλήθος κατοικιδίων** που δηλώνεται — και από τον κάτοχο (όριο) και από τον
 * ζητούντα (πόσα φέρνει). ADR-777 §8.60.21.
 *
 * 🔑 **5 = το όριο του Airbnb** (*«how many pets you allow per stay, from one to five»*,
 * και 0–5 στον επιλογέα του επισκέπτη). ⚠️ Ο Ν.4830/2021 άρθ.15 §3 επιτρέπει στον
 * **κανονισμό πολυκατοικίας** να περιορίσει έως **3** — αυτό είναι όρος του κτιρίου που ο
 * κάτοχος εκφράζει με το δικό του όριο, **όχι** ταβάνι της πλατφόρμας.
 */
export const STAY_PETS_CEILING = 5;

/** Ακέραιο πλήθος κατοικιδίων στο `[1, STAY_PETS_CEILING]` — το **ίδιο** κατώφλι «ένα, τουλάχιστον». */
export function isWholePetCount(value: number): boolean {
  return isWholeStayCount(value) && value <= STAY_PETS_CEILING;
}

/**
 * **Δηλωμένο πλήθος κατοικιδίων σε αίτημα/κράτηση**: `0` («κανένα», ρητά) ή {@link isWholePetCount}
 * (ADR-777 §8.60.21.7). Ο **ένας** κριτής του «0..5» — όχι inline σύγκριση σε κάθε αναλυτή.
 */
export function isDeclaredPetCount(value: unknown): value is number {
  return typeof value === 'number' && (value === 0 || isWholePetCount(value));
}

// =============================================================================
// 2. ΤΟ ΠΟΣΟ ΜΙΑΣ ΔΙΑΘΕΣΗΣ
// =============================================================================

/**
 * Το ποσό που **κουβαλά** αυτή η διάθεση, όποιο κι αν είναι το νόημά του.
 *
 * 🔑 **Επιστρέφει τον ΑΡΙΘΜΟ, όχι «έχει/δεν έχει»** — ώστε ο ίδιος αναγνώστης να
 * μπορεί να κρίνει **και** την ύπαρξη **και** το εύρος. Δύο συναρτήσεις («υπάρχει;»
 * και «πόσο;») θα διάβαζαν το **ίδιο** πεδίο με **δύο** `switch`, δηλαδή θα ήταν το
 * σχήμα που όλο αυτό το αρχείο αποφεύγει.
 *
 * ⚠️ **`switch` χωρίς `default`, επίτηδες**: τέταρτο είδος διάθεσης **δεν
 * μεταγλωττίζεται** μέχρι κάποιος να δηλώσει ποιο ποσό ζητά. Ένα σιωπηλό `default`
 * θα το βάφτιζε «δεν ζητά τίποτα» — και θα ήταν ακριβώς το κενό της αντιπαροχής,
 * ξανά.
 */
export function offerAmount(offer: PropertyOffer): number | null {
  switch (offer.kind) {
    case 'sell':
      return offer.askingPrice ?? null;
    case 'leaseOut':
      return offer.rentPrice ?? null;
    case 'exchange':
      return offer.percentage ?? null;
    case 'leaseShort':
      return offer.nightlyRate ?? null;
  }
}

/** Θετικός, πεπερασμένος αριθμός. `null`/`0`/αρνητικό/`NaN` → **όχι ποσό**. */
function isPositiveAmount(value: number | null): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * `true` αν η διάθεση **δεν** κουβαλά το ποσό που η ίδια απαιτεί.
 *
 * ⚠️ Το `0` μετράει ως **απουσία**, και είναι η ίδια απόφαση με το
 * `isDisplayableInSalesDashboard`: η **Α22** στηρίχθηκε στη μέτρηση ότι το XE.gr
 * απαγορεύει ρητά *«χωρίς τιμή **ή με ψευδή τιμή (πχ 1€)**»* και ότι το POA είναι
 * **παράνομο** κατά NTSELAT/CMA. Μηδενική τιμή είναι η πιο καθαρή μορφή ψευδούς τιμής.
 */
export function offerAmountMissing(offer: PropertyOffer): boolean {
  return !isPositiveAmount(offerAmount(offer));
}

/**
 * `true` αν είναι **αντιπαροχή με ποσοστό εκτός εύρους**.
 *
 * ⚠️ **Ξεχωριστό ερώτημα από την απουσία**, και όχι λεπτολογία: «δεν έβαλες ποσοστό»
 * και «έβαλες 250%» έχουν **διαφορετική θεραπεία** για τον άνθρωπο — το πρώτο του
 * λέει να συμπληρώσει, το δεύτερο ότι κατάλαβε λάθος τι ζητάμε. Ένα κοινό «άκυρο
 * ποσό» θα τον έστελνε να ψάξει.
 */
export function offerPercentageOutOfRange(offer: PropertyOffer): boolean {
  if (offer.kind !== 'exchange') return false;
  const value = offer.percentage;
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  return !isLandownerShareInRange(value);
}

/**
 * `true` αν το δηλωμένο **ελάχιστο διανυκτερεύσεων** δεν είναι αριθμός διανυκτερεύσεων.
 *
 * ⚠️ **Ξεχωριστό από το {@link offerAmountMissing}, με τον ίδιο λόγο που το ποσοστό
 * εκτός εύρους είναι ξεχωριστό**: εδώ ο άνθρωπος **έβαλε** κάτι, απλώς όχι κάτι που
 * μπορεί να ισχύσει. Το μήνυμα «λείπει» θα τον έστελνε να ψάξει άδειο πεδίο.
 *
 * ⚠️ Και **ξεχωριστό από το {@link offerMaxGuestsInvalid}**, παρότι το κατώφλι είναι
 * κοινό: η οθόνη οφείλει να πει **ποιο** από τα δύο πεδία — «δύο αριθμοί λάθος» δεν
 * λέει σε ποιο να πάει.
 */
export function offerMinNightsInvalid(offer: PropertyOffer): boolean {
  if (offer.kind !== 'leaseShort') return false;
  return isDeclaredButBelowStayMinimum(offer.minNights);
}

/** `true` αν ο δηλωμένος **μέγιστος αριθμός επισκεπτών** δεν είναι αριθμός ανθρώπων. */
export function offerMaxGuestsInvalid(offer: PropertyOffer): boolean {
  if (offer.kind !== 'leaseShort') return false;
  return isDeclaredButBelowStayMinimum(offer.maxGuests);
}

/**
 * `true` αν το δηλωμένο **όριο κατοικιδίων** δεν είναι πλήθος κατοικιδίων ({@link isWholePetCount}).
 *
 * 🔑 Κρίνεται **μόνο** σε «ναι»/«κατόπιν συνεννόησης»: το «όχι» δεν φέρει όριο (ο τύπος το
 * αποκλείει), και `null` = «χωρίς όριο», νόμιμη απάντηση.
 */
export function offerMaxPetsInvalid(offer: PropertyOffer): boolean {
  if (offer.kind !== 'leaseShort') return false;
  const pets = offer.pets ?? null;
  if (pets === null || pets.accepts === 'no' || pets.maxPets === null) return false;
  return !isWholePetCount(pets.maxPets);
}

/**
 * `true` αν η **χρέωση κατοικιδίου** δεν είναι θετικό ποσό, ή ξεπερνά την τιμή ανά νύχτα.
 *
 * 🔑 **Το ταβάνι είναι του Airbnb** (Help 3623): *«your pet fee can't be more than your
 * nightly base rate»* — φρένο σε κρυφή εγγύηση ζημιών ντυμένη χρέωση καθαρισμού. Χωρίς
 * δηλωμένη τιμή νύχτας δεν υπάρχει ταβάνι να συγκριθεί (το κενό το λέει ήδη το
 * `offer-amount-missing`)· ένα `0` δεν είναι χρέωση — είναι «χωρίς χρέωση», δηλαδή `fee: null`.
 */
export function offerPetFeeInvalid(offer: PropertyOffer): boolean {
  if (offer.kind !== 'leaseShort') return false;
  const pets = offer.pets ?? null;
  if (pets === null || pets.accepts === 'no' || pets.fee === null) return false;
  if (!isPositiveAmount(pets.fee.amount)) return true;
  const rate = offer.nightlyRate;
  return typeof rate === 'number' && isPositiveAmount(rate) && pets.fee.amount > rate;
}

/**
 * «Δηλώθηκε, αλλά κάτω από το κατώφλι» — **η μία** ανάγνωση των δύο όρων διαμονής.
 *
 * 🔑 `null` ⇒ `false` **επίτηδες**: η μη δήλωση δεν είναι σφάλμα (δες
 * {@link STAY_LIMIT_MIN_INCLUSIVE}). Ένα μη πεπερασμένο ⇒ επίσης `false`, με το **ίδιο**
 * σκεπτικό που ήδη εφαρμόζει το {@link offerPercentageOutOfRange}: «δεν είναι καν
 * αριθμός» είναι ερώτημα **σχήματος**, και το σχήμα το κρίνει το `zod`, όχι ο κριτής.
 */
function isDeclaredButBelowStayMinimum(value: number | null): boolean {
  if (value === null || value === undefined) return false;
  if (!Number.isFinite(value)) return false;
  return value < STAY_LIMIT_MIN_INCLUSIVE;
}

// =============================================================================
// 3. Η ΚΛΕΙΣΤΗ ΕΙΚΟΝΑ ΕΝΟΣ ΑΚΙΝΗΤΟΥ
// =============================================================================

/**
 * Τι λείπει από τις **ζωντανές** διαθέσεις ενός ακινήτου — **ονομαστικά**.
 *
 * 🔑 **Επιστρέφει τα ΕΙΔΗ, όχι πλήθος.** Η **απόφαση Giorgio** στην Α22 ήταν *«δεν
 * δημοσιεύεται, **αλλά το λέμε καθαρά στον ιδιοκτήτη**»* — και «καθαρά» σημαίνει
 * *«λείπει το **ενοίκιο**»*, όχι *«λείπει 1 τιμή»*. Ένας αριθμός θα ήταν το ίδιο
 * μήνυμα με λιγότερη πληροφορία.
 *
 * ⚠️ **Μόνο οι ΖΩΝΤΑΝΕΣ κρίνονται** ({@link isLiveOffer}): μια **αποσυρμένη** πώληση
 * χωρίς τιμή είναι **ιστορικό**, και *το ιστορικό δεν βάφει την οθόνη* ούτε
 * μπλοκάρει τη δημοσίευση. Χωρίς αυτό, ο κάτοχος που απέσυρε μια ημιτελή διάθεση θα
 * έμενε **κλειδωμένος** από κάτι που ήδη ακύρωσε.
 */
export interface OfferAmountGaps {
  /** Είδη ζωντανών διαθέσεων **χωρίς** το ποσό τους. */
  readonly missing: readonly PropertyOffer['kind'][];
  /** Είδη με ποσοστό **εκτός εύρους** (σήμερα: μόνο `exchange`). */
  readonly percentageOutOfRange: readonly PropertyOffer['kind'][];
  /** Είδη με **ελάχιστο διανυκτερεύσεων** που δεν είναι διανυκτερεύσεις. */
  readonly minNightsInvalid: readonly PropertyOffer['kind'][];
  /** Είδη με **μέγιστο επισκεπτών** που δεν είναι άνθρωποι. */
  readonly maxGuestsInvalid: readonly PropertyOffer['kind'][];
  /** Είδη με **όριο κατοικιδίων** εκτός `[1, 5]` (ADR-777 §8.60.21). */
  readonly maxPetsInvalid: readonly PropertyOffer['kind'][];
  /** Είδη με **χρέωση κατοικιδίου** μη θετική ή πάνω από την τιμή νύχτας. */
  readonly petFeeInvalid: readonly PropertyOffer['kind'][];
}

/**
 * Τα κενά ποσού των **ζωντανών** διαθέσεων. Όλα, ποτέ το πρώτο.
 *
 * 🔑 Ένα φίλτρο ανά κάδο πάνω στις **ίδιες** ζωντανές διαθέσεις: νέος κάδος = μία γραμμή, και
 * ο τύπος {@link OfferAmountGaps} αρνείται να μεταγλωττιστεί αν ξεχαστεί.
 */
export function liveOfferAmountGaps(
  offers: readonly PropertyOffer[] | null | undefined,
): OfferAmountGaps {
  const live = (offers ?? []).filter(isLiveOffer);
  const kindsFailing = (judge: (offer: PropertyOffer) => boolean): PropertyOffer['kind'][] =>
    live.filter(judge).map((offer) => offer.kind);

  return {
    missing: kindsFailing(offerAmountMissing),
    percentageOutOfRange: kindsFailing(offerPercentageOutOfRange),
    minNightsInvalid: kindsFailing(offerMinNightsInvalid),
    maxGuestsInvalid: kindsFailing(offerMaxGuestsInvalid),
    maxPetsInvalid: kindsFailing(offerMaxPetsInvalid),
    petFeeInvalid: kindsFailing(offerPetFeeInvalid),
  };
}
