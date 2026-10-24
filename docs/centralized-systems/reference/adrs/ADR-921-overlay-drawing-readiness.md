# ADR-921 — «Σχεδίαση Επιπέδων»: πρόληψη αντί για απόρριψη (διαθεσιμότητα εργαλείου)

| | |
|---|---|
| **Status** | 🟡 **ΥΛΟΠΟΙΗΜΕΝΟ σε κώδικα — uncommitted (2026-10-24)** · jest: δες §7 · **όχι** σε browser |
| **Date** | 2026-10-24 |
| **Category** | DXF Viewer / Overlays / Tools / UX |
| **Canonical Location** | `src/subapps/dxf-viewer/overlays/overlay-drawing-readiness.ts` · `src/subapps/dxf-viewer/stores/ToolAvailabilityStore.ts` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |
| **Σχετικά** | ADR-913 (γέννηση σχεδίου, `sceneFileId` στην πρώτη αποθήκευση) · ADR-340 (`floorplan_overlays`) · ADR-258 (overlay → ακίνητο) · ADR-662 Φ4 (`aria-disabled` SSoT στο ribbon) · ADR-461 (συμβουλευτικό storey gating) · ADR-055 (`ToolStateStore`) · ADR-040 (micro-leaf συνδρομές) |

---

## 1. Πρόβλημα

Το κουμπί «Σχεδίαση Επιπέδων» (`'layering'`) ήταν **πάντα** ενεργό. Ο έλεγχος «έχει το επίπεδο
όροφο και αναφορά;» ζούσε **μόνο** στην αποθήκευση (`overlay-store.add`). Ο χρήστης σχεδίαζε όλο
το πολύγωνο και στο κλείσιμο έπαιρνε σφάλμα: **χαμένη δουλειά**.

Δεύτερο, χειρότερο εύρημα: το `catch` του `usePolygonCompletion` εμφάνιζε για **κάθε** σφάλμα το
«Δεν βρέθηκε αρχείο αναφοράς». Τρεις διαφορετικές αιτίες έδιναν το ίδιο μήνυμα:

| Πραγματική αιτία | Τι έβλεπε ο χρήστης |
|---|---|
| Επίπεδο χωρίς `floorId` (πρόχειρο του χώρου εργασίας) | «Δεν βρέθηκε αρχείο αναφοράς» ❌ |
| Όροφος χωρίς εικόνα κάτοψης και χωρίς DXF | «Δεν βρέθηκε αρχείο αναφοράς» ✅ |
| Χωρίς συνδεδεμένο χρήστη / σφάλμα δικτύου ή API | «Δεν βρέθηκε αρχείο αναφοράς» ❌ |

Στιγμιότυπο 2026-10-23: κάτω αριστερά φαινόταν «Σχέδιο Επίπεδο 1.dxf» και παρόλα αυτά
εμφανιζόταν «χωρίς αναφορά». Ένα σχέδιο που γεννήθηκε μέσα στην εφαρμογή **αποκτά** `sceneFileId`
στην πρώτη αποθήκευση με περιεχόμενο (ADR-913: `onSceneSaved → linkSceneToLevel`). Άρα η
πιθανότερη πραγματική αιτία ήταν η **έλλειψη ορόφου**, που το γενικό μήνυμα έκρυβε. Δεν έχει
επαληθευτεί στη βάση. Με αυτό το ADR το μήνυμα λέει πλέον ποια είναι η αιτία.

## 2. Τι κάνουν οι μεγάλοι

Από γνώση, **χωρίς** επαλήθευση με έρευνα σε αυτή τη συνεδρία:

- **Revit / ArchiCAD:** εντολή με ανεκπλήρωτη προϋπόθεση εμφανίζεται γκρίζα και δεν ξεκινά καθόλου.
  Για παράδειγμα, το Area του Revit δουλεύει μόνο σε Area Plan.
- **Figma:** το απενεργοποιημένο στοιχείο εξηγεί στο tooltip γιατί.
- **Zillow / Idealista (σχεδίαση σε κάτοψη):** χωρίς κάτοψη εμφανίζεται κενή κατάσταση με κουμπί
  «Ανέβασε κάτοψη».

Αρχή: **αποτρέπεις το λάθος, δεν το αναφέρεις αφού γίνει**· και όταν αποτρέπεις, εξηγείς και
δίνεις τη διόρθωση.

## 3. Απόφαση

### 3.1 ΜΙΑ απόφαση «έτοιμο;» (SSoT)

`resolveOverlayDrawingReadiness({ levelId, floorId, backgroundImageId, sceneFileId, userId })`
(pure). Επιστρέφει `{ ready: true, context: { floorId, backgroundId } }` ή
`{ ready: false, reason }`. Οι αιτίες ελέγχονται με σειρά και αναφέρεται η **πρώτη** ανεκπλήρωτη:

1. `no-level`
2. `no-floor`: οι ζώνες ανήκουν σε όροφο. Το `floorId` είναι αμετάβλητο πεδίο του
   `floorplan_overlays` (Firestore rules D6) και κλειδί της συνδρομής.
3. `no-background`: η αναφορά είναι η εικόνα κάτοψης του ορόφου **ή** το `sceneFileId` του
   επιπέδου. Η εικόνα προηγείται.
4. `no-auth`

Τη ρωτούν **όλοι**: η πύλη ενεργοποίησης, το κουμπί του ribbon και η αποθήκευση (άμυνα σε βάθος).
Δύο ορισμοί του «έτοιμο» θα ξανάνοιγαν το ίδιο κενό.

### 3.2 Πύλη διαθεσιμότητας εργαλείων (γενική)

`ToolAvailabilityStore` (χωρίς React, `createExternalStore`). Απουσία εγγραφής σημαίνει
διαθέσιμο, οπότε κανένα άλλο εργαλείο δεν επηρεάζεται.

- **Κάτοχος:** το `OverlayStoreProvider` δηλώνει `setToolUnavailability('layering', …)` σε layout
  effect, με το ίδιο readiness, και καθαρίζει στο unmount.
- **Πύλη `guardToolActivation(tool)`**, σε δύο σημεία που καλύπτουν **κάθε** διαδρομή:
  - στην αρχή του `useDxfViewerState.handleToolChange` (ribbon, πλήκτρο, mobile toolbar). Αν
    μπλοκάρει, **δεν** ακυρώνει καν την τρέχουσα λειτουργία.
  - στο `toolStateStore.selectTool`, για τη γραμμή εντολών `LA`/`LAY`/`LAYER`, που παρακάμπτει το
    `handleToolChange`.
  - Επιπλέον, το `returnToPreviousTool` δεν ξανανοίγει εργαλείο που έγινε μη διαθέσιμο.
- Όταν μπλοκάρει, εκπέμπει `tool:activation-blocked { tool, reasonKey, remedyAction? }`.
- **Οι αυτόματες ενεργοποιήσεις** (επιλογή overlay → layering, grip-edit → layering) ελέγχουν το
  `getToolUnavailability` και παραλείπονται **σιωπηλά**, ώστε να μη βγαίνει toast σε κάθε κλικ.

### 3.3 Ribbon

Το `RibbonLargeButton` κάνει per-key συνδρομή με `useToolUnavailability(commandKey)` (ADR-040: re-render μόνο του
ίδιου). Όταν το εργαλείο δεν είναι διαθέσιμο, το κουμπί παίρνει `aria-disabled="true"` (SSoT εμφάνιση ADR-662 Φ4) και η
αιτία μπαίνει στο tooltip. Το κλικ **δεν** κόβεται: περνά στην πύλη, που εξηγεί και προσφέρει τη διόρθωση.

### 3.4 Ειδοποίηση: ΕΝΑΣ ακροατής

`useToolAvailabilityNotifications` (καλείται από το `DxfViewerContent`) ακούει:
- `tool:activation-blocked`
- `overlay:save-error`: η αιτία είναι πλέον `OverlayDrawingBlockReason | 'persist-failed'`, και το
  `OverlayPersistBlockedError` τη μεταφέρει τυποποιημένα.

Κάθε αιτία έχει ένα μήνυμα, και είναι το ίδιο σε tooltip, πύλη και αποθήκευση. Το `no-background`
φέρει κουμπί «Εισαγωγή κάτοψης», που εκτελεί το action `import-floorplan-wizard`. Το σταθερό `id`
εμποδίζει τη στοίβαξη toasts.

i18n: `dxf-viewer-shell` → `overlayReadiness.{noLevel,noFloor,noBackground,noAuth,persistFailed,importAction}`.
Αφαιρέθηκαν τα `dxf-viewer` → `callbacks.selectLevelForPolygon` και `callbacks.overlayNeedsBackground`.

## 4. Τι ΔΕΝ άλλαξε

- Ο ορισμός της αναφοράς (εικόνα **ή** `sceneFileId`) είναι ίδιος με πριν· απλώς έγινε ρητός.
- Η επεξεργασία και διαγραφή υπαρχουσών ζωνών (`update` / `remove`) δεν απαιτεί readiness.
- Το `restore` (undo διαγραφής) ρωτά το ίδιο SSoT. Πλέον απαιτεί και χρήστη, ενώ πριν δεχόταν
  `'system'` ως `createdBy`. Η εγγραφή μέσω API απαιτεί έτσι κι αλλιώς πιστοποίηση.

## 5. Ανοιχτά

- **Ορφανό `sceneFileId`** (ADR-469): μετρά ακόμη ως αναφορά. Το latch ζει στον auto-save manager,
  όχι στο overlay store. Αν χρειαστεί, θα γίνει είσοδος του readiness.
- **`no-floor` χωρίς άμεση διόρθωση:** δεν υπάρχει ακόμη ενέργεια «σύνδεσε επίπεδο με όροφο» για
  το κουμπί του toast. Το μήνυμα κατευθύνει στην κάτοψη του ορόφου.
- **Mobile toolbar:** η πύλη και το toast ισχύουν, η γκρίζα εμφάνιση του κουμπιού όχι ακόμη.

## 6. Αρχεία

| Αρχείο | Ρόλος |
|---|---|
| `overlays/overlay-drawing-readiness.ts` | SSoT απόφαση + κλειδιά μηνυμάτων + διορθώσεις + `OverlayPersistBlockedError` |
| `stores/ToolAvailabilityStore.ts` | Γενική πύλη διαθεσιμότητας εργαλείων |
| `stores/ToolStateStore.ts` | Πύλη στο `selectTool` + `returnToPreviousTool` |
| `hooks/useDxfViewerState.ts` | Πύλη στην αρχή του `handleToolChange` |
| `overlays/overlay-store.tsx` | Υπολογίζει + δημοσιεύει readiness· `add`/`restore` ρωτούν το ίδιο |
| `hooks/canvas/usePolygonCompletion.ts` | Αναφέρει την πραγματική αιτία |
| `app/useToolAvailabilityNotifications.ts` | ΕΝΑΣ ακροατής ειδοποιήσεων + κουμπί διόρθωσης |
| `app/useDxfViewerEffects.ts` · `app/SelectionSideEffectsHost.tsx` | Σιωπηλή παράλειψη αυτόματης ενεργοποίησης |
| `ui/ribbon/components/buttons/RibbonLargeButton.tsx` | `aria-disabled` + αιτία στο tooltip |
| `systems/events/drawing-event-map.ts` | `tool:activation-blocked` · τυποποιημένο `overlay:save-error` |

## 7. Επαλήθευση

- `overlays/__tests__/overlay-drawing-readiness.test.ts`: σειρά αιτιών, προτεραιότητα εικόνας,
  πρόχειρο επίπεδο με σχέδιο = `no-floor`, πληρότητα μηνυμάτων.
- `stores/__tests__/ToolAvailabilityStore.test.ts`: σιωπή χωρίς κάτοχο, μία εκπομπή, idempotent,
  `selectTool` / `returnToPreviousTool` σέβονται την πύλη.
- ⏳ **Browser:** (1) πρόχειρο επίπεδο → γκρίζο κουμπί + `noFloor`· (2) όροφος χωρίς σχέδιο →
  `noBackground` + «Εισαγωγή κάτοψης» ανοίγει τον οδηγό· (3) μετά την εισαγωγή το κουμπί ανάβει
  χωρίς ανανέωση· (4) `LA` στη γραμμή εντολών μπλοκάρεται με το ίδιο toast.

## 8. Changelog

| Έκδοση | Ημερομηνία | Αλλαγή |
|---|---|---|
| v1.0 | 2026-10-24 | Αρχική υλοποίηση (uncommitted) |
