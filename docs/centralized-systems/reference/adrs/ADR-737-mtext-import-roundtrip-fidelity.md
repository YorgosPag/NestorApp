# ADR-737 — Πιστότητα MTEXT: εισαγωγή, ανάγνωση σήμανσης, round-trip

**Status:** ✅ Implemented — 5 βλάβες διορθωμένες, end-to-end επαληθευμένο στο πραγματικό αρχείο του
Giorgio· **4 εκκρεμότητες ρητά ανοιχτές** (§7 — μην τις ξαναβρείτε ως «νέες»).
**Date:** 2026-07-30
**Domain:** dxf-viewer / import parser + text engine + ASCII export
**Related:** ADR-635 (import entity coverage — Φ4, Φ C.19, Φ C.20 είναι οι άμεσοι πρόγονοι),
ADR-636 (professional export — το ιδίωμα `dxfSourceType`, Φ2.4 D.3), ADR-344 (text engine —
Appendix B «Authoritative» πίνακας inline codes), ADR-462 (canonical-mm — το φίλτρο
out-of-extents R21), ADR-507 (ordered-pairs `EntityData.pairs`), ADR-587 (capability anchors).

---

## 1. Η αναφορά και η ταυτοποίηση του δείγματος

Ο Giorgio ανέφερε: **«τα MTEXT δεν εισάγονται σωστά»**, δίνοντας **δύο** αρχεία:

| Αρχείο | Τι είναι | MTEXT | TEXT |
|---|---|---|---|
| `47_ergasia.dxf` | **Πηγή** — AC1032 / R2018, τοπογραφικό ΕΓΣΑ87 | **89** | 1.127 |
| `Ισόγειο_Ισόγειο (4).dxf` | **Το export του Νέστορα από την πηγή** | **0** | 1.197 |

**Η ταυτοποίηση δεν είναι εικασία, είναι μέτρηση:** ίδια layers, συντεταγμένες **÷1000**
(canonical-mm, ADR-462), και **και τα δύο** αρχεία εισάγονταν σε **ακριβώς 2.903 entities / 1.192
text**. Δηλαδή ο Giorgio μας έδωσε **την είσοδο και την έξοδο του ίδιου αγωγού** — και η έξοδος
είχε **μηδέν MTEXT**. Αυτό από μόνο του απαντά «τι έσπασε»: όχι ένα, **δύο** ανεξάρτητα σκέλη
(εισαγωγή **και** εξαγωγή), που κανένα δεν ήταν ορατό από το άλλο.

Το `0` της στήλης MTEXT στο export **δεν** ήταν οριακή περίπτωση· ήταν η **κανονική** συμπεριφορά
για **κάθε** εισαγόμενο αρχείο, εδώ και όλη τη ζωή της διαδρομής (§3-Β).

---

## 2. ΒΛΑΒΗ Α — `101 Embedded Object`: ο parser έγραφε πάνω στα πραγματικά δεδομένα

### Ρίζα — **σφάλμα λεξικού, όχι λογικής**

Ο `parseEntity` (`utils/dxf-entity-parser.ts`) ισοπεδώνει τα group codes σε
`Record<string,string>` (`data[code] = value`) και σταματούσε **μόνο** στο `0`. Ο κωδικός
**`101`** στο DXF R2018+ **δεν είναι δεδομένο**: είναι **τομή ενότητας**, ισοδύναμη με τα `0`
(νέα οντότητα) και `100` (νέα subclass) — η ίδια η προδιαγραφή λέει ότι *«must cause the filer to
stop reading data»*. Ό,τι ακολουθεί ανήκει σε **άλλο namespace κωδικών**.

Δεν σταματούσε ⇒ οι κωδικοί του embedded object **ΕΠΕΓΡΑΦΑΝ** τους πραγματικούς της οντότητας:

| code | DXF (handle `175A`) | ο parser κρατούσε | τι είναι στο embedded |
|---|---|---|---|
| `10`/`20` | `407717.5228` / `4502407.4932` | **`1.0` / `0.0`** | text direction vector |
| `41` | `0.5` | **`0`** | column width |
| `71` | `1` (top-left attachment) | **`2`** | column type = dynamic |
| `44` | `1.0` (line spacing) | **`0.5`** | column gutter |

### Γιατί έγινε **εξαφάνιση** αντί για «λάθος θέση»

Το σχέδιο είναι **γεωαναφερμένο**. Η κατεστραμμένη θέση `(1, 0)` έπεφτε **έξω** από τα
`$EXTMIN/$EXTMAX`, οπότε το `dropOutOfExtentsEntities` (ADR-462 R21 — «big-player practice:
ό,τι είναι εκτός extents είναι junk») έκανε ακριβώς τη δουλειά του και τα **πετούσε**.

🔴 **Και τα πετούσε ΧΩΡΙΣ ΚΑΝΕΝΑ ΔΙΑΓΝΩΣΤΙΚΟ ΙΧΝΟΣ.** Δύο σωστοί μηχανισμοί (flatten για
ταχύτητα, φίλτρο για ανθεκτικότητα) παρήγαγαν μαζί μια **αθόρυβη απώλεια οντοτήτων**.

### Μέτρηση

**10 MTEXT** του δείγματος έχουν code `101` → **ακριβώς 10 εξαφανισμένα**: **75** MTEXT στο
`ENTITIES` → **65** οντότητες σκηνής. Τα χαμένα, ονομαστικά:

- layer **ΠΕΡΙΓΡΑΦΗ**: `I, II, II, II, II, I, I` — **οι αριθμοί ορόφων**
- layer **kryfo**: `ΠΟΛ, III, III`

Δηλαδή δεν χανόταν διακόσμηση· χανόταν **σημασιολογία κτιρίου**.

### Λύση — νέο SSoT, και το embedded **ΔΙΑΤΗΡΕΙΤΑΙ**

NEW `utils/dxf-embedded-object.ts` (leaf, μηδέν imports):
- **διαχωρισμός** στο code `101` → `{ own: DxfPair[], embedded: DxfPair[][] }` (μια οντότητα
  μπορεί να έχει **πάνω από ένα** embedded object → πίνακας από buckets)·
- **τυποποίηση κατ' απαίτηση** → `parseMTextColumns(tags): MTextColumnsData` (14 group codes)·
- ο διαχωριστής είναι **type-agnostic** (ο ίδιος μηχανισμός ισχύει σε `ATTRIB`/`ATTDEF` — κοινή
  subclass `AcDbMTextObjectEmbedded`)· **μόνο** ο τυποποιητής στηλών είναι MTEXT-specific.

**Γιατί ΔΕΝ πετάμε το embedded object** (η ουσιαστική απόφαση): περιέχει τα **MTEXT columns**.
Το ezdxf το φορτώνει σε κλάση `MTextColumns` (`load_columns_from_embedded_object`) και το
**ξαναγράφει** στο export (`export_embedded_object`). Πέταγμα = απλώς **νέα** σιωπηλή απώλεια,
μια σκάλα πιο κάτω. Άρα κρατιέται ωμό στο `EntityData.embeddedObjects`.

**Συνοδό, εξίσου σημαντικό:** τα drops των `dropOutOfExtentsEntities` **και** του αδελφού
`dropNonFiniteEntities` καταγράφονται πλέον στο **υπάρχον** `ImportDiagnostics` SSoT (ADR-635 Φ3)
με `kind` + `reason` + `at: e.id`. **Μια σιωπηλή διαγραφή είναι η μισή βλάβη**: αν το φίλτρο
μιλούσε, το σφάλμα του `101` θα είχε βρεθεί χωρίς να διαβάσει κανείς group codes.

### Απόδειξη

**19 νέα tests** (`utils/__tests__/dxf-embedded-object.test.ts`).
🔬 **Mutation check** — με το fix **απενεργοποιημένο**: **11 failed**. Δηλαδή τα pins είναι
**ζωντανά**, όχι διακοσμητικά (η πειθαρχία του ADR-587: *ένα anchor που δεν μπορεί να κοκκινίσει
δεν είναι anchor, είναι σχόλιο*).

---

## 3. ΒΛΑΒΗ Β — το export δεν έγραφε **ΚΑΝΕΝΑ** MTEXT (νεκρός κώδικας σε παραγωγή)

### Ρίζα — **dispatcher που ρωτούσε πεδίο το οποίο ο importer δεν γράφει ποτέ**

Ο importer δίνει `type:'text'` σε **κάθε** MTEXT (`buildTextSceneEntity`). Ο dispatcher
(`export/core/dxf-ascii-entity-dispatch.ts`) είχε `case 'mtext' → emitMText` — μια περίπτωση που
**δεν έφτανε ΠΟΤΕ**. Όλα έπεφταν στο `case 'text' → emitText`, δηλαδή στο **μονογραμμικό** TEXT.

⇒ **`emitMText` + `serializeDxfTextNode` ήταν νεκρός κώδικας για κάθε εισαγωγή.** Η ολόκληρη
μηχανή σειριοποίησης MTEXT του ADR-344 υπήρχε, δοκιμαζόταν, και **δεν εκτελούνταν**.

### 🔴 Γιατί κανένα test δεν το έπιασε — **το πιο σημαντικό εύρημα ολόκληρου του ADR**

Το `export/core/__tests__/dxf-roundtrip-mtext.test.ts` είχε βοηθητική συνάρτηση **`asMText()`**
που **ξανα-ταγκάριζε χειροκίνητα** το imported entity σε `type:'mtext'` **πριν** το δώσει στον
writer. Δηλαδή το test **πείραζε τα δεδομένα ώστε να μπει στη διαδρομή που ήθελε να δοκιμάσει** —
και ήταν **πράσινο πάνω σε διαδρομή που η παραγωγή δεν εκτελεί ΠΟΤΕ**.

> **Ένα test που πρέπει να πειράξεις τα δεδομένα για να περάσει, δεν δοκιμάζει την παραγωγή.**
> Δοκιμάζει τη φαντασία σου για την παραγωγή.

Το patch **αφαιρέθηκε**. Το test τώρα τρέχει το πραγματικό αποτέλεσμα του importer.

### Λύση — **δείκτης προέλευσης, ΟΧΙ αλλαγή τύπου**

NEW `TextEntity.dxfSourceType?: 'mtext'` — **ίδιο ιδίωμα** με το `HatchEntity.dxfSourceType`
(`'solid' | 'trace' | '3dface'`, ADR-636 Φ2.4 D.3). Ο dispatcher ρωτά
`if (!explode && e.dxfSourceType === 'mtext') → emitMText`.

⚠️ **ΔΕΝ άλλαξε το `type`, και αυτό είναι σχεδίαση — μην το «απλοποιήσεις».** **15+ registries**
έχουν **ασύμμετρη** κάλυψη `text` vs `mtext`. Παράδειγμα με συνέπεια: το
`grip-computation-producers` **δεν έχει key `mtext`** ⇒ αλλαγή τύπου θα έδινε **μηδέν λαβές,
σιωπηλά**. Το ADR-635 Φ4 το είχε ήδη χαρακτηρίσει «cross-cutting entity-type change → deferred»·
εδώ **δεν** το κάναμε — το **παρακάμψαμε σωστά**.

### Απόδειξη

`dxf-roundtrip-mtext.test.ts`: **πριν 6 failed / 2 passed → μετά 8/8** (και τα 8 πάνω στον
**πραγματικό** writer, incl. αρνητικό pin ότι απλό TEXT **δεν** αναβαθμίζεται σε MTEXT και pin
ότι στο **explode** (Τέκτονας) το MTEXT μένει TEXT, γιατί ο minimal parser του Τέκτονα δεν
διαβάζει MTEXT).
Regression: **529/529** export suites, **364/364** ADR-587 capability anchors.

---

## 4. ΒΛΑΒΗ Γ — stacked text (`\S`) χανόταν από το **flat** κείμενο

### Ρίζα — φίλτρο που πέταγε ό,τι δεν ήταν απλό run

`utils/text-node-utils.ts` → `extractFlatText` έκανε `.filter(r => !('top' in r))`, δηλαδή
**πετούσε κάθε `TextStack`**. Το AST τα κρατούσε σωστά (ADR-635 Φ C.20)· αλλά **render, hit-test
και bounds διαβάζουν το flat**. Άρα η πληροφορία υπήρχε στη μνήμη και **δεν έφτανε στην οθόνη**.

### Μέτρηση

```
DXF:      Ε\H0.7x;\S^ τίτλου;\H1.4286x;=231.04τ.μ.
ΠΡΙΝ:     Ε=231.04τ.μ.            ← «τίτλου» ΕΞΑΦΑΝΙΣΜΕΝΟ
```
Το ίδιο για τη λέξη «καταμέτρησης» + **3 ακόμη εμβαδά**.

### Λύση — απόδοση, όχι διαγραφή

`top` + **διαχωριστής** + `bottom`, με νέο SSoT `MTEXT_STACK_DIVIDERS` / `mtextStackDivider()`
(`^` tolerance, `/` diagonal, `#` horizontal) στο `text-engine/types/text-ast.types.ts` —
**κοινό με τον serializer**, ώστε ανάγνωση και γραφή να μη μπορούν να αποκλίνουν.

Ταυτίζεται με το `fast_plain_mtext()` του **ezdxf**: κρατά το **περιεχόμενο**, χάνει μόνο τη
**σημασιολογία στοίβαξης** — **ποτέ δεν πετάει χαρακτήρα**. Αυτή είναι η σωστή ανταλλαγή για ένα
flat προβολικό string.

---

## 5. ΒΛΑΒΗ Δ — `\A` (κατακόρυφη στοίχιση): διαβαζόταν σωστά και **πετιόταν**

### Ρίζα — `default: break` σε switch που θεωρούνταν πλήρες

Ο tokenizer παρήγαγε **σωστά** `{ kind: 'alignment', value }` (είναι στους 22 κωδικούς του
Appendix B του ADR-344 από την πρώτη μέρα). Η `applyStyleToken` του parser **δεν είχε case** για
αυτό ⇒ `default: break` ⇒ το token **καταναλωνόταν στο κενό**.

**Μέτρηση: 49 εμφανίσεις** στο δείγμα, **όλες** σιωπηλά.

### Λύση

NEW `TextRunStyle.verticalAlign?: 0 | 1 | 2` — διατηρείται στο AST **και εκπέμπεται στο export**
(`mtext-serializer.ts`: `\A{n};` όταν αλλάζει σε σχέση με το προηγούμενο run).

### ⚠️ ΑΝΟΙΧΤΟ — να το ξέρετε πριν το χαρακτηρίσετε «done»

**Κανένας renderer / layout δεν το διαβάζει ακόμη.** Οι 49 εμφανίσεις **δεν μετακινούν
χαρακτήρα στην οθόνη**. Αυτό που κερδήθηκε είναι **round-trip πιστότητα** (η πληροφορία δεν
πεθαίνει πια στο import και επιστρέφει στο DXF), **όχι** οπτική ορθότητα. Βλ. §7-2.

---

## 6. ΒΛΑΒΗ Ε — escaped literals `\\`, `\{`, `\}` καταπίνονταν

### Ρίζα — και **ασυμμετρία μέσα στο ίδιο μας το round-trip**

`readBackslashToken` → `default: return null` ⇒ ο χαρακτήρας **χανόταν**. Το χειρότερο: ο
`escapeText()` του **δικού μας** serializer **ΗΔΗ παρήγαγε** αυτές τις ακολουθίες. Δηλαδή
γράφαμε `\\` και δεν μπορούσαμε να το ξαναδιαβάσουμε — **ο εξαγωγέας μας παρήγαγε αρχείο που ο
εισαγωγέας μας αποδεδειγμένα διάβαζε λάθος**.

### Λύση

`ESCAPED_LITERALS = '\\{}'` ελεγμένο **πριν** το switch (ίδια ακριβώς λογική με το ezdxf
`if char in "\\{}"`).

### Απόδειξη Γ + Δ + Ε (κοινή)

**33 tests: 20 failed ΠΡΙΝ → 33 passed ΜΕΤΑ.** Regression: **1.843 tests**.

🔴 **Κανένα υπάρχον test δεν έσπασε** — δηλαδή οι τρεις βλάβες ήταν **ΕΝΤΕΛΩΣ ακάλυπτες**.
Γι' αυτό επέζησαν. Ένα σύνολο tests που δεν σπάει από τη διόρθωση ενός πραγματικού σφάλματος
είναι **μέτρηση της τυφλότητάς του**, όχι της σταθερότητάς του.

---

## 7. Δύο επιπλέον διορθώσεις (εντοπίστηκαν στην επιθεώρηση, όχι από τα tests)

1. **`bim/text/text-layout-source.ts` — υπόσχεση ασυνεπής με τον κώδικα.** Απέδιδε τη στοίβα με
   **καρφωμένο `/` για κάθε τύπο**, ενώ το ίδιο του το σχόλιο υπόσχεται **ισοδυναμία** με την
   `extractFlatText`. Μια στοίβα tolerance εμφανιζόταν `+0.1/-0.05` στη διάταξη και `+0.1^-0.05`
   στο flat — **δύο αλήθειες για το ίδιο κείμενο**. Τώρα καλεί το `mtextStackDivider()` SSoT.
2. **`types/entities.ts` — πεδίο που γραφόταν, διαβαζόταν, και δεν υπήρχε.** Το
   `TextEntity.width` (MTEXT group `41`) το **έγραφε ο importer** και το **διάβαζαν**
   `text-box.ts` / `emitMText`, αλλά **δεν ήταν δηλωμένο**· ο writer το έπαιρνε με
   `(e as MTextEntity)`. Αφότου το `emitMText` δέχεται και `TextEntity`, το cast διάβαζε πεδίο
   **άγνωστο στον μεταγλωττιστή**. Δηλώθηκε (additive, μηδέν παλινδρόμηση).

---

## 8. Τελική επαλήθευση end-to-end (στο πραγματικό αρχείο, μετά από όλα)

| | ΠΡΙΝ | ΜΕΤΑ |
|---|---|---|
| MTEXT που εισάγονται | **65 / 75** | **75 / 75** |
| τα 10 «χαμένα» | — | `I, II, II, II, II, I, I, ΠΟΛ, III, III` |
| δείκτες (`\S`) | `Ε=231.04τ.μ.` | `Ε^ τίτλου=231.04τ.μ.` |
| **MTEXT στο export** | **0** | **80** |

**Γιατί 80 > 75:** προστίθενται τα **5 MTEXT του block `βοράςΝΠ`** κατά την έκθεση (expansion)
του `INSERT`. Δηλαδή ο αριθμός είναι σωστός **επειδή** εξηγείται — όχι παρά το ότι διαφέρει.

---

## 9. 🔴 Το μάθημα — **δύο ξεχωριστοί μηχανισμοί έκρυβαν την ίδια απώλεια**

Αυτό είναι το μέρος του ADR που πρέπει να επιβιώσει, ακόμα κι αν όλα τα υπόλοιπα ξαναγραφτούν:

**(α) Το `asMText` patch έκανε πράσινο ένα test πάνω σε νεκρή διαδρομή.**
Το test «απεδείκνυε» ότι το MTEXT round-trip δουλεύει. Δούλευε — για είσοδο που **κατασκεύαζε το
ίδιο**. Η παραγωγή δεν παρήγαγε ποτέ τέτοια είσοδο.

**(β) Το φίλτρο out-of-extents έσβηνε οντότητες χωρίς ίχνος.**
Ένας **σωστός** αμυντικός μηχανισμός (ADR-462 R21) μετέτρεψε ένα σφάλμα ανάγνωσης σε
**εξαφάνιση**. Χωρίς diagnostics, το σύμπτωμα («λείπουν κείμενα») δεν είχε **καμία** γέφυρα προς
την αιτία («code 101»).

**Κανόνας που προκύπτει, γενικός:**
> Κάθε **σιωπηλή** διαγραφή πρέπει να γράφει diagnostics. Κάθε **βοηθητική** συνάρτηση σε test
> που **μετασχηματίζει** το αντικείμενο υπό δοκιμή πριν το δώσει στο σύστημα, είναι **ύποπτη μέχρι
> αποδείξεως του εναντίου** — γράψε δίπλα της *γιατί* η παραγωγή παράγει το ίδιο σχήμα, αλλιώς
> δοκιμάζεις κώδικα που κανείς δεν εκτελεί.

---

## 10. Files

**Νέα:**
- `utils/dxf-embedded-object.ts` — SSoT code `101` (split + `parseMTextColumns` → `MTextColumnsData`)
- `utils/__tests__/dxf-embedded-object.test.ts` — 19 tests (mutation-verified: 11 failed χωρίς το fix)
- `text-engine/parser/__tests__/mtext-lossless.test.ts` — `\S` / `\A` / escaped literals

**Τροποποιημένα:**
- `utils/dxf-entity-parser.ts` — στάση στο `101`, buckets στο `EntityData.embeddedObjects`
- `utils/dxf-converter-helpers.ts` / `utils/dxf-scene-builder.ts` — διοχέτευση + diagnostics
- `utils/dxf-out-of-extents-filter.ts` — προαιρετικός `ImportDiagnostics` (ADR-635 Φ3 SSoT)
- `utils/dxf-text-converters.ts` — `dxfSourceType: 'mtext'` στο `buildTextSceneEntity`
- `utils/text-node-utils.ts` — `extractFlatText` αποδίδει στοίβες
- `text-engine/types/text-ast.types.ts` — `MTEXT_STACK_DIVIDERS`, `mtextStackDivider()`, `TextRunStyle.verticalAlign`
- `text-engine/parser/mtext-tokenizer.ts` — `ESCAPED_LITERALS`
- `text-engine/parser/mtext-parser.ts` — `case 'alignment'`
- `text-engine/serializer/mtext-serializer.ts` — εκπομπή `\A`, χρήση του divider SSoT
- `export/core/dxf-ascii-entity-dispatch.ts` — δρομολόγηση μέσω `dxfSourceType`
- `export/core/entity-export-coverage.ts` — τεκμηρίωση της σειράς `mtext` (§7-3)
- `types/entities.ts` — `TextEntity.dxfSourceType`, `TextEntity.width`
- `bim/text/text-layout-source.ts` — χρήση του divider SSoT
- `export/core/__tests__/dxf-roundtrip-mtext.test.ts` — **αφαίρεση του `asMText` patch**
- `utils/__tests__/text-node-utils.test.ts`

---

## 11. 🔴 Ανοιχτά — μετρημένα, **ΟΧΙ** διορθωμένα

1. **Export των στηλών MTEXT.** Τα δεδομένα φτάνουν **άθικτα** στο `EntityData.embeddedObjects`,
   αλλά **κανείς δεν τα ξαναγράφει** στο export και **κανένας renderer δεν τα διαβάζει**. Το
   ezdxf τα ξαναγράφει (`export_embedded_object`)· εμείς όχι. Σε re-export ενός MTEXT με στήλες
   **χάνεται η στηλοποίηση**. ⚠️ **Δεν είναι παλινδρόμηση** — πριν χανόταν **ολόκληρη η
   οντότητα**· τώρα χάνεται μόνο η διάταξη σε στήλες.
2. **Οπτική εφαρμογή του `\A`.** Το πεδίο υπάρχει, ταξιδεύει, εξάγεται — **και δεν ζωγραφίζεται**
   (§5). Οι 49 εμφανίσεις του δείγματος δεν μετακινούν χαρακτήρα. Χωριστό βήμα, με δική του
   μέτρηση.
3. **`entity-export-coverage`: η σειρά `mtext` είναι σειρά χωρίς στιγμιότυπα.** Η καταχώριση
   (`dxf: 'native'`, `tek: 'missing'`) περιγράφει τύπο που **κανένα runtime entity δεν παίρνει
   ποτέ** (`type:'mtext'` δεν παράγεται από πουθενά). Το snapshot **`31` σκόπιμα ΔΕΝ άλλαξε**: η
   διόρθωση ταξιδεύει ως `type:'text'`, και ο TEK collector φιλτράρει
   `if (e.type !== 'text') continue`, άρα το `tek: 'missing'` **παραμένει αληθές για τον τύπο**.
   ⚠️ Μην «διορθώσεις» το snapshot για να «ταιριάξει» — θα κρύψεις το γεγονός ότι η σειρά είναι
   κενή.
4. **`emitMText` κάνει ακόμη 5 casts `(e as MTextEntity)`.** Το `width` δηλώθηκε (§7-2) και ο
   ένας κίνδυνος έκλεισε, αλλά η καθαρή λύση είναι **accessor** `readMTextGeometry(e)` που
   δέχεται και τις δύο μορφές και επιστρέφει ένα ρητό σχήμα γεωμετρίας.

---

## 12. Τι **ΔΕΝ** είναι σφάλμα (μην το «διορθώσεις»)

- **Ο εισαγόμενος MTEXT έχει `type:'text'`.** Είναι **απόφαση** (§3), όχι παράλειψη. Η αλλαγή
  τύπου σπάει 15+ registries με ασύμμετρη κάλυψη.
- **Το embedded object μένει στην οντότητα ως ωμά ζεύγη.** Η τυποποίηση είναι **κατ' απαίτηση**.
  Η εναλλακτική («πέτα ό,τι δεν καταλαβαίνεις») είναι ακριβώς η βλάβη που μόλις κλείσαμε.
- **Ο διαχωρισμός γίνεται στον κωδικό `101`, όχι στη συμβολοσειρά `"Embedded Object"`.** Άλλα
  εργαλεία γράφουν άλλη ετικέτα· ο κωδικός παραμένει τομή ενότητας σε κάθε περίπτωση.
- **Το flat κείμενο χάνει τη *σημασιολογία* της στοίβαξης.** Αυτό κάνει και το ezdxf
  (`fast_plain_mtext`). Το flat είναι **προβολή**, όχι το AST.

---

## Changelog
- **2026-07-30 — Αρχικό ADR (🐛 «τα MTEXT δεν εισάγονται σωστά», Opus 5):** Πέντε ανεξάρτητες
  βλάβες σε **τρία** υποσυστήματα (parser / text engine / ASCII export), διαγνωσμένες στο ζεύγος
  `47_ergasia.dxf` (πηγή, 89 MTEXT) ↔ `Ισόγειο_Ισόγειο (4).dxf` (**το δικό μας export της, 0
  MTEXT**). **Ρίζα Α — σφάλμα λεξικού:** ο `parseEntity` δεν αναγνώριζε το group code `101`
  («Embedded Object») ως **τομή ενότητας** ⇒ οι κωδικοί του embedded επέγραφαν θέση/ύψος/
  attachment ⇒ θέση `(1,0)` ⇒ το φίλτρο out-of-extents (ADR-462 R21) τα **έσβηνε σιωπηλά**:
  μετρημένο **10 MTEXT** (75→65), ονομαστικά `I,II,II,II,II,I,I,ΠΟΛ,III,III` — **αριθμοί
  ορόφων**. **Ρίζα Β — νεκρή διαδρομή:** ο dispatcher είχε `case 'mtext'` που δεν έφτανε ποτέ
  (ο importer γράφει `type:'text'`) ⇒ `emitMText`/`serializeDxfTextNode` **νεκρός κώδικας για
  κάθε εισαγωγή**· το test το «κάλυπτε» με helper `asMText()` που **ξανα-ταγκάριζε τα δεδομένα**
  — **πράσινο πάνω σε διαδρομή που δεν εκτελείται**. **Ρίζες Γ/Δ/Ε — σιωπηλές απορρίψεις:**
  `extractFlatText` πετούσε κάθε `TextStack` (μετρημένο: `Ε\H0.7x;\S^ τίτλου;…` → `Ε=231.04τ.μ.`)·
  η `applyStyleToken` δεν είχε case για `\A` (**49 εμφανίσεις**)· ο `readBackslashToken`
  κατάπινε `\\`/`\{`/`\}` **που ο δικός μας `escapeText()` ήδη παρήγαγε**. **Fix:** NEW SSoT
  `utils/dxf-embedded-object.ts` (split στο `101` + typed `parseMTextColumns`· το embedded
  **διατηρείται**, όπως το `MTextColumns` του ezdxf) + diagnostics στα δύο drop-φίλτρα +
  `TextEntity.dxfSourceType:'mtext'` (**ιδίωμα ADR-636 Φ2.4 D.3 — ΟΧΙ αλλαγή `type`**: 15+
  registries έχουν ασύμμετρη κάλυψη `text`/`mtext`, π.χ. μηδέν λαβές) + SSoT
  `MTEXT_STACK_DIVIDERS`/`mtextStackDivider()` κοινό parser↔serializer↔bim layout +
  `TextRunStyle.verticalAlign` + `ESCAPED_LITERALS`. **Files:** 3 νέα + 16 τροποποιημένα (§10).
  **Verification:** end-to-end στο πραγματικό αρχείο **65/75 → 75/75** MTEXT, `\S` πλήρες,
  **export 0 → 80 MTEXT** (80 = 75 + 5 του block `βοράςΝΠ` στο INSERT expansion)· 19 embedded
  tests **mutation-verified (11 failed χωρίς το fix)**· roundtrip **6 failed/2 passed → 8/8**·
  Γ+Δ+Ε **20 failed → 33/33**· regression **1.843 tests + 529/529 export + 364/364 ADR-587
  anchors**, **κανένα υπάρχον test δεν έσπασε** (= μέτρο του πόσο ακάλυπτες ήταν).
  ⏳ **Ανοιχτά (§11):** export στηλών MTEXT· οπτική εφαρμογή `\A`· η σειρά `mtext` του
  `entity-export-coverage` παραμένει **χωρίς στιγμιότυπα** (snapshot `31` σκόπιμα αμετάβλητο)·
  5 casts στο `emitMText`.
