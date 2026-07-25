# ADR-708 — Landowners submit gate: **ένα** gate για το κουμπί και τον handler

| Metadata | Value |
|----------|-------|
| **Status** | ✅ IMPLEMENTED (uncommitted — ο Giorgio κάνει commit) |
| **Date** | 2026-07-26 |
| **Domain** | Projects · Ownership · Forms/UX · SSoT validation |
| **Canonical Location** | `src/lib/ownership/owner-utils.ts` (`isOptionalOwnersValid`) · `src/components/projects/tabs/ProjectLandownersTab.tsx` (`canSubmit`) |
| **Anchor** | `src/components/projects/tabs/__tests__/project-landowners-save-gate.test.tsx` (6 tests, mutation-verified) · `src/lib/ownership/__tests__/owner-utils-optional.test.ts` (6 tests) |
| **Related** | ADR-244 / SPEC-244A (multi-owner co-ownership· `OwnersList` SSoT) · ADR-707 (ίδια εκστρατεία E2E verify «Έργων») |

---

## 1. Context — πώς βρέθηκε

E2E verify «Έργων», **Φάση 4** (2026-07-26, browser automation), test entity **PRJ-002**
(ΣΥΓΚΡΟΤΗΜΑ ΚΑΤΟΙΚΙΩΝ ΑΙΓΑΙΟΝ ΙΙ, **μηδέν** οικοπεδούχοι).

Καταγράφηκε ως **Ε-15**: στην καρτέλα «Οικοπεδούχοι» το **Ποσοστό Αντιπαροχής** δεν
αποθηκευόταν. Το πεδίο δεχόταν σωστά την τιμή, το κουμπί άλλαζε σωστά σε «Αποθήκευση»,
το κλικ **δεν έκανε τίποτα**: κανένα toast, κανένα σφάλμα, και μετά από full reload το
πεδίο ήταν κενό.

### Μετρήσεις (2/2 αναπαραγώγιμο, με control test)

| Μέτρηση | Αποτέλεσμα |
|---|---|
| Το κλικ έφτασε στο κουμπί (capture-phase listener στο DOM node) | `clickSeen = 1` |
| Requests σε `/api/projects/<id>/landowners-save-preview` | **0** |
| Οποιοδήποτε request σε `localhost` μετά το κλικ | **0** |
| Toast (success ή error) | **κανένα** |
| Τιμή πεδίου μετά από full reload | **κενή** |

Ο network tracker επιβεβαιώθηκε **ζωντανός** στην ίδια μέτρηση (έπιασε το Firestore
`Listen/channel`), άρα το «μηδέν requests» είναι έγκυρη απόδειξη και όχι σιωπή εργαλείου.

**Άρα το save δεν έφτασε ποτέ στο `runSaveOperation`** — αποκλείστηκαν και οι δύο αρχικές
υποψήφιες ρίζες («το impact-preview κατάπιε το save», «το `executeSave` αγνοεί το
bartex-only path»).

---

## 2. Ρίζα — δύο συνθήκες για την ίδια ερώτηση

```tsx
// ΠΡΙΝ — ProjectLandownersTab.tsx
const canSave = isOwnersValid(owners) && !saving;          // γρ. 172
const isDirty = hasChanges(...);

const handleSave = async () => {
  if (!projectId || !canSave) return;                      // γρ. 267  ← ΦΡΟΥΡΟΣ
  ...
};

<Button disabled={!(canSave && isDirty) && owners.length > 0} />   // γρ. 347  ← ΟΨΗ
```

Δύο ανεξάρτητες εκφράσεις απαντούν στην **ίδια** ερώτηση («επιτρέπεται η υποβολή;») και
αποκλίνουν:

- `owner-utils.ts:31` → `if (owners.length === 0) return false;`
  Με μηδέν οικοπεδούχους ⇒ `canSave === false` ⇒ ο handler κάνει `return` στην **πρώτη γραμμή**.
- Στην ίδια στιγμή, το `&& owners.length > 0` μηδενίζει ολόκληρη την έκφραση του `disabled`
  ⇒ το κουμπί **δεν είναι ποτέ** disabled.

**Το κουμπί έλεγε ψέματα.** Και στις δύο καταστάσεις:

| Κατάσταση | Ετικέτα κουμπιού | `disabled` | Τι συνέβαινε στο κλικ |
|---|---|---|---|
| καμία αλλαγή | «Δεν υπάρχουν αλλαγές» | `false` 🔴 | τίποτα |
| αλλαγμένο bartex | «Αποθήκευση» | `false` | **τίποτα** 🔴 |

### Το κενό SSoT από κάτω

Η `isOwnersValid` έχει **3** καλούντες (grep, πλήρες):

| Καλών | Κενή λίστα | Σωστό; |
|---|---|---|
| `SellDialog.tsx:366` | απαγορεύεται | ✅ πώληση χωρίς αγοραστή δεν στέκει |
| `ReserveDialog.tsx:296` | απαγορεύεται | ✅ ίδιο |
| `ProjectLandownersTab.tsx:172` | απαγορεύεται | 🔴 **λάθος** |

Ο τρίτος είναι ο **μόνος** που περνά `allowEmpty` στο `OwnersList` (γρ. 315) — δηλώνει
ρητά ότι το κενό είναι νόμιμη κατάσταση (ένα έργο μπορεί κάλλιστα να μην έχει
οικοπεδούχους αλλά να έχει ποσοστό αντιπαροχής) και μετά το επικυρώνει με predicate που
το απορρίπτει. **Δεν υπήρχε predicate για «λίστα που επιτρέπεται να είναι κενή».**

---

## 3. Απόφαση

### 3.1 Νέο predicate στο υπάρχον SSoT — **delegate, όχι διπλότυπο**

`src/lib/ownership/owner-utils.ts`:

```ts
export function isOptionalOwnersValid(owners: readonly PropertyOwnerEntry[]): boolean {
  return owners.length === 0 || isOwnersValid(owners);
}
```

Κανένας κανόνας δεν επαναδιατυπώνεται — για μη κενή είσοδο η συμπεριφορά είναι **κατά
κατασκευή** ταυτόσημη με την `isOwnersValid` (κατοχυρωμένο με test). Οι δύο συναρτήσεις
απαντούν σε διαφορετικές ερωτήσεις και **δεν** πρέπει να ενοποιηθούν:

- `isOwnersValid` → «τουλάχιστον ένας ιδιοκτήτης είναι **υποχρεωτικός**» (πώληση, κράτηση)
- `isOptionalOwnersValid` → «το κενό είναι **νόμιμη** κατάσταση» (οικοπεδούχοι έργου)

### 3.2 **Ένα** gate — η απόκλιση γίνεται δομικά αδύνατη

```tsx
// ΜΕΤΑ
const canSave  = isOptionalOwnersValid(owners) && !saving;
const isDirty  = hasChanges(...);
const canSubmit = canSave && isDirty;        // ← ΕΝΑ gate

if (!projectId || !canSubmit) return;        // ο handler το διαβάζει
<Button disabled={!canSubmit} />             // η όψη το διαβάζει
```

Η διόρθωση **δεν** είναι το χαλάρωμα του predicate· είναι ότι η όψη και ο φρουρός
διαβάζουν πλέον **την ίδια τιμή**. Ένα κουμπί που είναι ενεργό **υποχρεωτικά** εκτελεί
αποθήκευση όταν πατηθεί.

### 3.3 Πίνακας αλήθειας — αυστηρά καλύτερο σε κάθε κατάσταση

| owners | isDirty | ΠΡΙΝ: disabled | ΠΡΙΝ: το κλικ | ΜΕΤΑ: disabled | ΜΕΤΑ: το κλικ |
|---|---|---|---|---|---|
| `[]` | ναι (bartex) | `false` | **τίποτα** 🔴 | `false` | **αποθηκεύει** ✅ |
| `[]` | όχι | `false` 🔴 | τίποτα | `true` ✅ | — |
| 1 χωρίς επαφή | ναι | `true` | — | `true` | — |
| 1 πλήρης | ναι | `false` | αποθηκεύει | `false` | αποθηκεύει |
| 1 πλήρης | όχι | `true` | — | `true` | — |

---

## 4. Anchors — mutation-verified

| Αρχείο | Tests | Τι φυλάει |
|---|---|---|
| `__tests__/project-landowners-save-gate.test.tsx` | 6 | **την αναλλοίωτη**: ενεργό κουμπί ⇔ το κλικ αποθηκεύει |
| `__tests__/owner-utils-optional.test.ts` | 6 | τη διάκριση των δύο predicates· ότι το νέο δεν επαναδιατυπώνει κανόνα |

**Mutation-verify (εκτελέστηκε):** επαναφορά και των δύο σημείων του ελαττώματος
(`owners.length > 0 &&` στο `canSave` **και** `&& owners.length > 0` στο `disabled`)
⇒ **2 tests κόκκινα**, ακριβώς αυτά που κωδικοποιούν το ελάττωμα:

- `actually persists the bartex percentage when clicked`
- `disables the button when there is nothing to save`

Τα υπόλοιπα 4 έμειναν σωστά πράσινα (δεν αφορούν τη μετάλλαξη). Επαναφορά ⇒ 12/12 πράσινα.

`npm run jscpd:diff` στα 4 αρχεία ⇒ **καθαρό** (CHECK 3.28).

---

## 5. Γιατί όχι κάτι άλλο

| Εναλλακτική | Γιατί απορρίφθηκε |
|---|---|
| `owners.length === 0 \|\| isOwnersValid(owners)` inline στο component | Επιχειρησιακή λογική στην όψη· το επόμενο tab με `allowEmpty` θα την αντέγραφε (N.0.2) |
| Χαλάρωση της ίδιας της `isOwnersValid` να δέχεται `[]` | Θα επέτρεπε **πώληση χωρίς αγοραστή** — σιωπηλή καταστροφή σε 2 dialogs |
| Νέο module `optional-owner-utils.ts` | Διάσπαση SSoT· η επικύρωση ιδιοκτησίας ζει ήδη σε **ένα** αρχείο |
| Μόνο διόρθωση του `disabled` (χωρίς ενοποίηση) | Θεραπεύει το σύμπτωμα· οι δύο εκφράσεις θα ξανα-αποκλίνουν στην επόμενη αλλαγή |

---

## 6. Κανόνας που προκύπτει (γενικεύσιμος)

> **Η όψη και ο φρουρός δεν επιτρέπεται να παράγουν την άδεια χωριστά.**
> Όταν ένα κουμπί έχει `disabled={X}` και ο handler του `if (!Y) return`, τα `X` και `Y`
> πρέπει να είναι **η ίδια μεταβλητή**. Αν δεν είναι, το UI θα πει ψέματα — και η
> αστοχία είναι **σιωπηλή**: ούτε toast, ούτε σφάλμα, ούτε request. Είναι η χειρότερη
> κατηγορία αστοχίας φόρμας γιατί ο χρήστης πιστεύει ότι αποθήκευσε.

Άξιο ελέγχου κατά το Boy Scout Rule σε κάθε φόρμα που ακουμπάμε.

---

## 7. Changelog

| Ημ/νία | Αλλαγή |
|---|---|
| 2026-07-26 | Δημιουργία. Ε-15 (E2E verify «Έργων» Φάση 4): ρίζα απομονωμένη 2/2 με network trace + capture-listener control. Νέο `isOptionalOwnersValid` στο `owner-utils.ts`· ενοποίηση σε ένα `canSubmit` gate στο `ProjectLandownersTab`. 12 tests, mutation-verified, jscpd καθαρό. |
