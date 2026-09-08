# ΤΟ ΟΡΓΑΝΟ — μη το ξαναχτίσεις *(ADR-298 Α21.15, 2026-09-08)*

Το προηγούμενο όργανο (`mutate-rules.js`) **πέθανε στον scratchpad** και το handoff
έγραψε οδηγίες ανακατασκευής. Αυτό δεν χρειάζεται ανακατασκευή — είναι εδώ.

## Τι κάνει

Τρέχει **και τα 35 κελιά** (7 πρόσωπα × 5 πράξεις) σε **κάθε** σουίτα, με τα
**δικά της** fixtures, **χωρίς να αλλάξει ούτε ένα πηγαίο αρχείο**.

Ο μηχανισμός είναι `moduleNameMapper` στο `^\.\./_registry/coverage-manifest$` → shim
που γεμίζει κάθε matrix στα 35, δηλώνοντας τα **λείποντα** ως `deny`.

⇒ **Κάθε κόκκινο = η πραγματικότητα ΕΠΕΤΡΕΨΕ ό,τι κανείς δεν ρώτησε.**

## Γιατί είναι καλύτερο από τη μετάλλαξη κανόνων

| | μετάλλαξη `firestore.rules` | αυτό |
|---|---|---|
| κοινό working tree | **μολύνεται** (και το μοιράζεται άλλος agent) | **ούτε ένα αρχείο** |
| μνήμη | νέο projectId ανά μεταλλαγμένο ⇒ JVM 2,7 GB ⇒ kill | **ένα** τρέξιμο, ένα projectId ανά σουίτα |
| τι απαντά | «ποιος όρος δεν μετράει» | «**ποιο κελί λείπει και τι κάνει η πραγματικότητα**» |

⚠️ Το shim επεμβαίνει στο **μητρώο**, όχι στη matrix — επίτηδες. Τα
`crmDirectMatrix()` / `attendanceEventMatrix()` καλούν τη **module-local**
`tenantDirectMatrix()`, οπότε ένα shim στο `coverage-matrices` **δεν** θα τα άγγιζε.

## Εντολές

Πρώτα ο emulator σε άλλο παράθυρο:

    npx firebase emulators:start --only firestore --project demo-nestor

**Α) Καθαρή μέτρηση κενών — ΧΩΡΙΣ emulator, ~1 δευτ.**

    npx jest --config HANDOFFS/adr-298-probe/jest.gap.js

**Β) Πόσα από τα λείποντα κελιά τα ΕΠΙΤΡΕΠΕΙ η πραγματικότητα** *(θέλει emulator)*

    npx jest --config HANDOFFS/adr-298-probe/jest.probe.js --testPathPatterns "suites/(projects|contacts|messages|survey-records|leads|opportunities|activities|attendance-events|admin-building-templates|analytics|communications|conversations|external-identities|layer-groups|layers|obligations|obligation-templates|obligation-transmittals|relationships|teams)\.rules\.test"

Χωρίς `--testPathPatterns` τρέχει **και τις 127** — δεν το έχω μετρήσει, υπολόγισε
~1.100s και κοίτα πρώτα ελεύθερη μνήμη.

**Γ) Τι κουβαλά μια άρνηση** *(feasibility του `reason`)*

    npx jest --config HANDOFFS/adr-298-probe/jest.reason.js

**Δ) Φέρει το `reason` πληροφορία που δεν έχει ήδη η περσόνα;** *(χωρίς emulator)*

    npx jest --config HANDOFFS/adr-298-probe/jest.rinfo.js

⚠️ Οι διαδρομές μέσα στα configs/shim είναι **απόλυτες** επίτηδες: το jest θέλει το
test **μέσα** στο `rootDir`, και το shim πρέπει να εισάγει το **αληθινό** μητρώο
χωρίς να αυτο-χαρτογραφηθεί από το ίδιο του το mapping.

## Μετρημένα 2026-09-08

- Οικογένεια `tenant_direct`: **64/734 κόκκινα** — **όλα** «επιτρέπεται χωρίς ερώτηση».
  **60 από αυτά** είναι `external_user` × read/list/create σε **20 από 20** συλλογές
  (**καμία εξαίρεση** ⇒ δεν διαρρέουν «κάποιες συλλογές», διαρρέει **το πρότυπο**).
- ⚠️ **Η ακτίνα είναι 20 σουίτες, όχι 8.** Το σχόλιο της `crmDirectMatrix()` έλεγε
  «leads, opportunities, activities» ενώ οι καλούντες είναι **16**. Ρώτα το μητρώο:
  `grep -n "crmDirectMatrix()" tests/firestore-rules/_registry/coverage-manifest.ts`.
- Project-wide: **127** συλλογές, **2.953/4.445** κελιά ⇒ **1.492 (33,6%) αδήλωτα**.
  `cross_tenant_user` 543/635 και `external_user` 546/635 **αδήλωτοι** (~86%).
- **17** συλλογές είναι στα **35/35** (`bim_authoring`, `bim_presentation`, `ownership`)
  ⇒ το πλήρες σχήμα είναι **εφικτό**· το κενό είναι **εφαρμογής**, όχι δυνατότητας.
- `reason` tags: **1.654** σε χρόνο εκτέλεσης — **όχι 508**. Το 508/550 ήταν grep
  **πηγαίων literals**· βοηθοί όπως `serverOnlyWriteCells()` πολλαπλασιάζουν ένα
  literal σε πολλά κελιά. **Κάθε** κελί άρνησης φέρει tag· **κανένα** δεν ελέγχεται.
