/**
 * 🔴 Ο **ΕΝΑΣ** κανόνας: «το `name` ενός στυλ είναι **κλειδί i18n** ή **κυριολεξία του χρήστη**;»
 *
 * Δύο μητρώα του viewer κρατούν ονοματισμένα στυλ με **ταυτόσημο** συμβόλαιο ονόματος, ήδη
 * γραμμένο σε πρόζα και στα δύο (`line-style-types.ts` §`name`, `table-style.ts` §`name`):
 *
 * ```
 *   isBuiltIn: true   →  το `name` είναι i18n ΚΛΕΙΔΙ  («ribbon.commands.tableStyleNames.standard»)
 *   isBuiltIn: false  →  το `name` είναι ΚΥΡΙΟΛΕΞΙΑ    («Πίνακας ποσοτήτων», ό,τι πληκτρολόγησε)
 * ```
 *
 * ## 🔴 ΓΙΑΤΙ ΕΓΙΝΕ ΣΥΝΑΡΤΗΣΗ (ADR-739 §52.2 — το περιστατικό)
 *
 * Ο κανόνας ήταν γραμμένος **σε επιφάνεια**, δύο φορές:
 *
 * | επιφάνεια | τι δήλωνε | αποτέλεσμα |
 * |---|---|---|
 * | `line-style-ribbon-options.ts` | `isLiteralLabel: !style.isBuiltIn` | ✅ σωστό |
 * | `useRibbonTableFormatBridge.ts` | `isLiteralLabel: true` (για **κάθε** στυλ) | 🔴 **ωμό κλειδί στην οθόνη** |
 *
 * Η δεύτερη επιφάνεια δεν «ξέχασε» τίποτα — **ξαναποφάσισε**, με σχόλιο που έλεγε «τα ονόματα
 * των στυλ είναι δεδομένα του χρήστη», σωστό για τα custom και ψευδές για τα built-in. Το
 * dropdown «Στυλ πίνακα» έδειχνε `ribbon.commands.tableStyleNames.standard` με **όλες** τις
 * πύλες πράσινες: το CHECK 3.8 ψάχνει `t('κλειδί')` χωρίς αντιστοίχιση, κι εδώ δεν υπήρχε
 * **καμία κλήση `t()`** — το `isLiteralLabel: true` είναι ακριβώς η εντολή «μην μεταφράσεις».
 *
 * Η διόρθωση «γράψε `!style.isBuiltIn` και στον bridge» θα ήταν το **δεύτερο σωστό αντίγραφο**
 * του ίδιου κανόνα, δηλαδή η επόμενη ευκαιρία να αποκλίνουν. Άρα ο κανόνας ζει εδώ, **μία**
 * φορά, και κάθε επιφάνεια τον ρωτά.
 *
 * ## Γιατί **δομικός** τύπος και μηδέν imports
 * Το module δεν εισάγει `LineStyle` ούτε `TableStyle`: το `NamedStyleProvenance` είναι το
 * ελάχιστο σχήμα, και τα δύο μοντέλα του ταιριάζουν δομικά. Έτσι μένει **χωρίς επίπεδο** —
 * το καλεί ελεύθερα και η κορδέλα και ένας μελλοντικός διάλογος διαχείρισης στυλ, χωρίς
 * κανένας τους να εισάγει το μητρώο του άλλου.
 *
 * ## ⚠️ Το `t()` ΔΕΝ μπαίνει εδώ — και δεν είναι παράλειψη
 * Επιστρέφεται **ζεύγος**, όχι κείμενο. Το μητρώο στυλ είναι καθαρό και in-memory (το
 * καταναλώνει και ο ζωγράφος του καμβά)· μια κλήση `t()` μέσα του θα το έδενε με το i18n
 * runtime και με τη γλώσσα **της στιγμής της ανάγνωσης**. Το `t()` ανήκει στην επιφάνεια, τη
 * στιγμή της απόδοσης — εκεί που ζει ήδη (`RibbonCombobox.resolveLabel`).
 *
 * ## ⚠️ ΤΙ **ΔΕΝ** ΠΕΡΝΑΕΙ ΑΠΟ ΕΔΩ
 * - **`DimStyle`** (ADR-362): τα built-in του έχουν **κυριολεκτικά** ονόματα («ΔΙΑΣΤΑΣΕΙΣ
 *   Nestor»), όχι κλειδιά — ταιριάζει δομικά με το `NamedStyleProvenance` αλλά έχει **αντίθετη**
 *   σύμβαση, και θα έβγαζε το όνομά του ωμό μέσα από `t()`. Ο `DimStyleList` σωστά τυπώνει
 *   `style.name` ως έχει.
 * - **Τύποι γραμμής** (`linetype-ribbon-options.ts`): ονόματα DXF («DASHED», «ByLayer») —
 *   πάντα κυριολεξίες, καμία προέλευση να ρωτηθεί.
 *
 * 🔑 Το ότι τα built-in **όντως** κρατούν κλειδί που **όντως** μεταφράζεται σε `el`+`en` δεν
 * είναι υπόθεση αυτού του module: το πιστοποιεί το `style-name-label.test.ts` πάνω στα
 * πραγματικά presets **και** στα πραγματικά locale JSON.
 *
 * @module subapps/dxf-viewer/systems/style-naming/style-name-label
 * @see ../../ui/ribbon/data/line-style-ribbon-options.ts — καταναλωτής (στυλ γραμμής)
 * @see ../../ui/ribbon/hooks/useRibbonTableFormatBridge.ts — καταναλωτής (στυλ πίνακα)
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §52.2
 */

/**
 * Το ελάχιστο σχήμα που χρειάζεται ο κανόνας.
 *
 * Σκόπιμα **δομικό** και όχι ένωση των δύο μοντέλων: μια ένωση θα ανάγκαζε αυτό το module να
 * εισάγει και τα δύο μητρώα, και κάθε τρίτο μητρώο θα το ξανάγγιζε.
 */
export interface NamedStyleProvenance {
  /** i18n κλειδί όταν `isBuiltIn`, αλλιώς το κείμενο που πληκτρολόγησε ο χρήστης. */
  readonly name: string;
  /** Προέλευση: preset του προϊόντος (read-only) ή στυλ που έφτιαξε ο χρήστης. */
  readonly isBuiltIn: boolean;
}

/**
 * Το ζεύγος ετικέτας που καταναλώνουν οι επιφάνειες.
 *
 * Είναι **ακριβώς** τα δύο πεδία που ήδη ξέρουν το `RibbonComboboxOption` και το
 * `BimPropertyOption`, ώστε να μπαίνει με σκέτο spread — χωρίς τρίτο ενδιάμεσο σχήμα.
 */
export interface StyleNameLabel {
  /** Ό,τι θα φτάσει στην επιφάνεια: κλειδί ή κυριολεξία, ανάλογα με το `isLiteralLabel`. */
  readonly labelKey: string;
  /** `true` ⇒ η επιφάνεια το τυπώνει αυτούσιο· `false` ⇒ το περνά από `t()`. */
  readonly isLiteralLabel: boolean;
}

/**
 * Η **μοναδική** απάντηση στο «κλειδί ή κυριολεξία;» για ένα ονοματισμένο στυλ.
 *
 * @param style Οτιδήποτε κρατά `name` + `isBuiltIn` με τη σύμβαση της κεφαλίδας.
 * @returns Ζεύγος έτοιμο για spread μέσα σε option επιφάνειας.
 *
 * @example
 * ```ts
 * options: styles.map((style) => ({ value: style.id, ...resolveStyleNameLabel(style) }))
 * ```
 */
export function resolveStyleNameLabel(style: NamedStyleProvenance): StyleNameLabel {
  return { labelKey: style.name, isLiteralLabel: !style.isBuiltIn };
}
