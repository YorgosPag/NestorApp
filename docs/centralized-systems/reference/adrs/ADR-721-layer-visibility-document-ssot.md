# ADR-721 — Ορατότητα επιπέδων: ένα έγγραφο, μία αλήθεια

| Πεδίο | Τιμή |
|---|---|
| **Status** | 🟢 **IMPLEMENTED (UNCOMMITTED)** 2026-07-28 — browser-verified σε `47_ergasia.dxf`· 218/218 jest σε 20 suites |
| **Date** | 2026-07-28 |
| **Category** | DXF Viewer — Scene state / Layer visibility / Cross-cutting |
| **Author** | Claude Opus 5 + Γιώργος Παγώνης |
| **Trigger** | Giorgio: «τα ματάκια εμφάνισης/απόκρυψης επιπέδων δεν συμπεριφέρονται σωστά» (screenshot 2026-07-28 15:22) |
| **Companions** | ADR-547 (SceneStore SSoT), ADR-382 (Visibility Resolver), ADR-358 §5.6.bis (LayerStore), ADR-616 (layer commands), ADR-040 (micro-leaf) |
| **Industry alignment** | AutoCAD LAYER table semantics · Revit *Temporary* Hide/Isolate · Cinema 4D Viewport Solo Mode |
| **Risk** | Medium-high — αγγίζει scene reactivity (κάθε consumer), 16 σημεία γραφής, undo/redo |

---

## 1. Το σύμπτωμα και η μετρημένη ρίζα

Το κλικ στο μάτι ενός layer δεν έκανε **τίποτα**: ούτε ο καμβάς άλλαζε, ούτε το εικονίδιο.

Μέτρηση ζωντανά (browser probe μέσω React fiber, `47_ergasia.dxf`, 58 layers / 3107 οντότητες):

| Πηγή | `VT_POINT.visible` μετά το κλικ |
|---|---|
| `SceneStore.getLevelScene(id)` — η SSoT | `true` ✅ |
| `scene` prop σε panel **και** καμβά | `false` ❌ |
| `aria-label` κουμπιού | «Εμφάνιση» (δηλ. UI νόμιζε κρυφό) |

Δύο διαφορετικά αντικείμενα, μόνιμα αποκλίνοντα. Καμία εξαίρεση στην κονσόλα.

**Ρίζα:** το `useCurrentLevelScene` (ADR-557) διάβαζε τη σκηνή με **σκέτο getter κατά το render**,
χωρίς συνδρομή. Πριν το ADR-547 Stage 0 αυτό ήταν ανεκτό — η σκηνή ζούσε σε `useState`, οπότε κάθε
γραφή προκαλούσε από μόνη της cascade. Μετά το Stage 0 μετακόμισε στο zero-React `SceneStore`, και η
μόνη συνδρομή έμεινε μέσα στο `useSceneManager`, του οποίου το αποτέλεσμα **δεν** μπαίνει στα deps
του `LevelsContext` memo (`LevelsSystem.tsx` §contextValue — και το ADR-547 §2 περιγράφει αυτή τη
σταθερότητα ως **επιθυμητή** για perf).

Άρα: `setLevelScene(...)` → το store ενημερωνόταν → **κανένας consumer δεν ειδοποιούνταν**. Η
εφαρμογή έμοιαζε να δουλεύει μόνο επειδή σχεδόν κάθε άλλη ενέργεια (επιλογή, εργαλείο, drag)
πυροδοτεί re-render από άλλο store, οπότε η σκηνή ξαναδιαβαζόταν παρεμπιπτόντως. Μια ενέργεια που
αλλάζει **μόνο** τη σκηνή — ακριβώς το toggle ορατότητας — έμενε αόρατη για πάντα.

## 2. Τι βρέθηκε από κάτω (η πραγματική έκταση)

Η ρίζα έκρυβε τέσσερα ακόμη προβλήματα στο ίδιο μονοπάτι:

| # | Πρόβλημα | Συνέπεια για τον χρήστη |
|---|---|---|
| Α | Το toggle έγραφε `visible` **σε κάθε οντότητα** του layer (`updateEntitiesForLayer`) | Το «εμφάνιση» ξανα-άναβε και όσα ο χρήστης είχε κρύψει **ατομικά**· ανακτήσιμο μόνο με undo |
| Β | Τέσσερα ασύμβατα κατηγορήματα για το ίδιο flag· δύο με truthiness | Σε φρέσκο DXF **58/58** layers έχουν `visible: undefined` ⇒ το UI δήλωνε «όλα κρυμμένα» ενώ ζωγραφίζονταν όλα |
| Γ | 16 σημεία έγραφαν **μόνο** στο `LayerStore` (runtime προβολή) | «Κρύψε από Διαχειριστή → σχεδίασε → επανεμφανίστηκε». Ντετερμινιστική απώλεια, όχι race |
| Δ | Η απομόνωση έγραφε `frozen: true` σε μόνιμο πεδίο | Προσωρινή κατάσταση συνεδρίας μπορούσε να αποθηκευτεί στο αρχείο |

Το Γ **θα χειροτέρευε** από τη διόρθωση της ρίζας: με reactive σκηνή το hydration τρέχει κανονικά,
άρα οι runtime-only γραφές θα σβήνονταν πιο γρήγορα από πριν. Δεν ήταν επιλογή να λυθεί μόνο η ρίζα.

## 3. Τι λέει η βιομηχανία (έρευνα)

**Πού ζει το ON/OFF:** AutoCAD το κρατά στο **LAYER table**, ποτέ στην οντότητα — γι' αυτό ένα σβηστό
layer κρατά τα αντικείμενά του **επιλέξιμα**. Revit/ArchiCAD: override στο δοχέα (view/category),
όχι ιδιότητα του στοιχείου. ⇒ Το Α ήταν αντι-πρακτική.

**Προσωρινό vs μόνιμο** — εδώ οι μεγάλοι παίκτες **διαφωνούν**:

| | Μόνιμοι διακόπτες | Προσωρινή απομόνωση |
|---|---|---|
| **Revit** | V/G overrides, αποθηκεύονται | *Temporary* Hide/Isolate — **χάνεται στο κλείσιμο**, ξεχωριστή ενέργεια για μονιμοποίηση |
| **Cinema 4D** | Layer Manager (View/Render), στο scene file | **Viewport Solo Mode** — ξεχωριστός μηχανισμός |
| **AutoCAD** | LAYON/LAYOFF/LAYFRZ, στο DWG | LAYISO **μεταλλάσσει** τα layer states· γι' αυτό χρειάζεται LAYUNISO |

**Απόφαση:** μοντέλο **Revit/C4D** (μη-καταστροφικό), όχι AutoCAD LAYISO. Το ADR-358 §5.6.bis το
είχε ήδη επιλέξει στα λόγια («session-only, NOT persisted»)· ο κώδικας δεν το τηρούσε.

## 4. Αρχιτεκτονική

```
   SceneModel.layersById   ← ΤΟ ΕΓΓΡΑΦΟ (persisted, auto-save)
            │ hydrate (μονόδρομος, ιδεμποτικός)
            ▼
       LayerStore          ← runtime προβολή· zero-React, event-time reads
            │ subscribe
      ┌─────┴─────┐
      ▼           ▼
   renderer     panels          ⇒ ίδια πηγή ⇒ αδύνατο να αποκλίνουν

   IsolateEffectsStore     ← ΞΕΧΩΡΙΣΤΟ κανάλι, session-only
                             (ο renderer το διαβάζει χωριστά· ποτέ δεν αγγίζει layer flags)
```

**Μία πόρτα γραφής** (`services/layer-flags-writer`): γράφει έγγραφο **και** προβολή **ατομικά**,
είναι **fail-closed** (χωρίς ενεργό έγγραφο δεν γράφει τίποτα και επιστρέφει `false`), και δουλεύει
**και εκτός React** μέσω της `active-document-gateway`.

## 5. Υλοποίηση

| § | Αρχείο | Αλλαγή |
|---|---|---|
| 1 | `config/layer-visibility.ts` **(νέο)** | `isLayerOn` / `isLayerFrozen` / `isLayerRenderable` / `nextLayerOnState` / `resolveLayerGroupOnState`. `undefined ⇒ ορατό` (DXF code 62: απουσία δήλωσης = ON) |
| 2 | `systems/levels/useCurrentLevelScene.ts` | **Η ρίζα.** `useSyncExternalStore` στο **per-level** getter (`getSceneForLevel`), όχι στο record — γραφή σε άλλο level δεν ξυπνά αυτό το leaf |
| 3 | `stores/LayerStore.ts` | `setLayers` + `upsertLayer` **ιδεμποτικά**. Προϋπόθεση ορθότητας, όχι μικρο-βελτιστοποίηση: χωρίς φρουρό, κάθε drag frame θα πετούσε το bitmap cache |
| 4 | `LayerOperationsService` · `layer-operation-utils` | `updateEntitiesForLayer` **αφαιρέθηκε**· τα δύο toggles έφυγαν προς τη μία πόρτα |
| 6 | `systems/levels/active-document-gateway.ts` **(νέο)** | Zero-React θύρα· **ΕΝΑΣ** γραφέας (`LevelsSystem` effect). Καταχωρεί τον **auto-save-aware** writer, όχι τον ωμό `SceneStore` |
| 7 | `services/layer-flags-writer.ts` **(νέο)** | `setLayerFlags` / `setLayerFlagsBatch` / `toggleLayerFlag`. **Και τα 16 σημεία** μετανάστευσαν εδώ |
| 8 | `dxf-entity-layer-skip.ts` · `LayerIsolateCommand` · `layer-command-utils` | Layer-scope isolate ελέγχεται στον **renderer**· `freezeNonIsolatedLayers` **αφαιρέθηκε** |
| 5 | `stores/useLayerStore.ts` **(νέο)** · `LayerItem` · `ColorGroupItem` | Τα panels διαβάζουν τα flags από τον **ίδιο SSoT με τον καμβά** |
| 9 | 6 αρχεία-πηγές + 12 καταναλωτές (βλ. §9) | **Εκκαθάριση CHECK 3.30**: 4 νεκρές εξαγωγές διαγράφηκαν, 3 συνδέθηκαν με τον καταναλωτή που τις παρέκαμπτε, 1 έγινε πεδίο snapshot |

### Λεπτομέρειες που δάγκωσαν

- **`GROUP_KEY_SEP = '\u001F'`**: τα ονόματα layer επιτρέπουν κενά (`Visible Elevation`). Ένα
  `join(' ')/split(' ')` θα διέλυε το όνομα σε δύο ανύπαρκτα layers ⇒ σιωπηλά λάθος ομαδικός
  διακόπτης. (Το NUL θα έκανε το αρχείο να μοιάζει binary στο git.)
- **name→id γέφυρα**: ο `LayerStore` είναι id-keyed· `getLayer(<όνομα>)` επιστρέφει πάντα `null`.
  Τα panels κρατούν ονόματα (legacy props), η μετάφραση γίνεται στο σύνορο.
- **Το undo πρέπει να φτάνει όσο το execute**: `restoreLayerEntry` γράφει και στο έγγραφο. Αν η
  εντολή περσιστάρει και το undo όχι, η «ακύρωση» φαίνεται στην οθόνη ενώ το αρχείο κρατά την αλλαγή.

## 6. Αλλαγές συμπεριφοράς (ρητές)

1. **Το toggle layer δεν αγγίζει οντότητες.** Ατομικές αποκρύψεις επιβιώνουν.
2. **Η απομόνωση δεν αφήνει αποτύπωμα.** Συνέπεια: μια «Κατάσταση Επιπέδων» αποθηκευμένη *κατά τη
   διάρκεια* απομόνωσης καταγράφει τα **μόνιμα** flags — η επαναφορά της δεν ξαναπαγώνει. Σωστό: μια
   αποθηκευμένη κατάσταση περιγράφει πώς είναι στημένο το σχέδιο, όχι τι κοίταζε στιγμιαία ο χρήστης.
3. **Fail-closed**: χωρίς ενεργό έγγραφο καμία γραφή. Το αντίθετο θα ανασταίνε το bug.

## 7. Επαλήθευση

**Browser (localhost, `47_ergasia.dxf`)** — μετά τη διόρθωση:

| Έλεγχος | Αποτέλεσμα |
|---|---|
| Απόκρυψη ομάδας «Color #FFFFFF (27 layers)» | Όλη η λευκή γεωμετρία **εξαφανίστηκε** (υπόμνημα, περιγράμματα) |
| `sameObject` (prop vs store) | **`true`** — η απόκλιση εξαφανίστηκε |
| `propHidden` / `storeHidden` | 27/27 → 0/0, συγχρονισμένα |
| `entitiesMutated` πριν/μετά | **316 → 316** — καμία οντότητα δεν μεταλλάχθηκε |
| Απόκρυψη από Διαχειριστή → πλήρης αλλαγή σκηνής | **επιβίωσε** (το σενάριο «επανεμφανίστηκε» έκλεισε) |
| «Ορατά: 58» στον Διαχειριστή | σωστό (με truthiness θα έλεγε 0) |

**Jest:** 218/218 σε 20 suites. Έξι suites χρειάστηκαν ενημέρωση — και **σωστά**: έστηναν μόνο τον
`LayerStore` και ρωτούσαν μόνο την προβολή, δηλαδή έλεγχαν ακριβώς τη μισή αρχιτεκτονική που
παρήγαγε το bug. Νέος harness `active-document-test-harness` + `expectPersisted` (ρωτά **και τις
δύο** πηγές). Νέα suites: `layer-flags-writer` (10), `layer-visibility` (16).

## 8. Γνωστό υπόλοιπο

**Data debt στο `47_ergasia.dxf`:** 316 οντότητες φέρουν `visible: false` — αποτύπωμα του παλιού
toggle (μέρος και από τις δοκιμές αυτής της συνεδρίας). Ο νέος κώδικας δεν παράγει άλλες, αλλά οι
υπάρχουσες παραμένουν κρυμμένες ακόμη κι όταν το layer τους είναι ON. **Δεν καθαρίστηκαν αυτόματα**:
είναι δεδομένα του χρήστη και το `visible: false` είναι διφορούμενο (ατομική απόκρυψη vs αποτύπωμα).
Χρειάζεται ρητή απόφαση/εργαλείο.

## 9. Νεκρές εξαγωγές (CHECK 3.30) — τι ήταν πραγματικά

Το push `e4ec333a..d5f320db` άφησε **9 νέες νεκρές εξαγωγές** (ADR-700· στο `e4ec333a` το gate ήταν
πράσινο). Καμία δεν ήταν «ψευδώς νεκρή»: **το gate είχε δίκιο και στις 9**. Δεν έγινε rebaseline.

Η διάγνωση ανά σύμβολο έδωσε **δύο διαφορετικές ασθένειες**, και αυτό είναι το χρήσιμο εύρημα:

**(α) Τέσσερα «πλήρη API» χωρίς καταναλωτή** — γεννήθηκαν επειδή ένα module «πρέπει» να εκθέτει
συμμετρικό σύνολο, όχι επειδή τα ζήτησε κάποιος. Διαγράφηκαν:

| Σύμβολο | Γιατί διαγραφή |
|---|---|
| `layer-visibility#isSceneLayerRenderable` | Καθαρό συνώνυμο του `isLayerRenderable`. Ο `SceneLayer` είναι **δομικά** συμβατός με το `LayerVisibilityFlags` — η TS δεν χρειάζεται «τυποποιημένο» wrapper. Δεύτερο όνομα για το ίδιο ερώτημα = ακριβώς η ασθένεια του §1 |
| `layer-operation-utils#getEntityIdsByLayer` | Ο μόνος caller (`affectedEntityIds` στο `toggleLayerVisibility`) έφυγε στο §4 — και ήταν ούτως ή άλλως πληροφοριακός. **ΟΧΙ** ενοποίηση με το ομώνυμο του `useEnhancedSelection`: εκείνο είναι id-first με legacy name fallback πάνω στη σκηνή του επιπέδου — άλλο ερώτημα, ίδιο όνομα |
| `useLayerStore#useSceneLayer` | Θα έσπαγε τη ρητή γραμμή του §5 (flags ⇒ store, name/color/id ⇒ έγγραφο). Ο επόμενος καταναλωτής θα τραβούσε από εκεί και το `color` και θα ξαναγεννιόταν η διπλή πηγή. Για νέο flag: **στενό** leaf (`useIsLayerFrozen`), όχι γενικός getter |
| `active-document-gateway#getActiveLevelId` / `#getActiveScene` | Δεν είναι μόνο νεκρός κώδικας: ένας γυμνός `getActiveScene()` είναι η **μόνη** διαδρομή που επιτρέπει «διάβασε εδώ, γράψε αλλού», παρακάμπτοντας τον auto-save-aware writer — δηλαδή ανασταίνει το bug που έκλεισε η θύρα. Χωρίς αυτούς, το fail-closed `withActiveDocument` είναι η ΜΟΝΗ πόρτα **εξ ορισμού** |

**(β) Τέσσερα SSoT που γράφτηκαν και δεν συνδέθηκαν ΠΟΤΕ** — η επικίνδυνη κατηγορία: το κεντρικό
σπίτι υπάρχει, ο καταναλωτής συνεχίζει στο δικό του αντίγραφο, και το docblock **λέει ψέματα**.

| Σύμβολο | Ποιος το παρέκαμπτε | Θεραπεία |
|---|---|---|
| `useLayerStore#useLayerStoreSnapshot` | **9 αρχεία** κρατούσαν αυτούσιο το `useSyncExternalStore(subscribeLayerStore, getLayerStoreSnapshot, getLayerStoreSnapshot)` — δηλαδή **κανένας** από τους 4 που ονομάτιζε το ίδιο του το docblock δεν είχε μεταναστεύσει | Μετανάστευσαν και τα 9 (properties ×2, layer-manager ×2, layer-picker ×2, ribbon bridges ×3) |
| `topo-display-frame#unprojectDisplayPoint` | `topo-survey-point-resolve` καλούσε ωμό `getActiveWorldToDisplayProjector().unproject(...)` — δηλαδή η **εισερχόμενη** πύλη του ADR-718 §Α παρακάμπτονταν από τον ίδιο τον κώδικα λαβών | 2 σημεία περνούν πλέον από τη γέφυρα (και το `displayDeltaToWorld`) |
| `topo-surface-grips#topoSurfaceGripsOf` | **Και οι δύο** καταναλωτές (`TopoSurfaceRenderer.getGrips`, `GRIP_PRODUCERS`) ξανάγραφαν `e as unknown as TopoSurfaceEntity` — **ανέλεγκτο** cast, ενώ ο φύλακας υπήρχε | Υπογραφή `{ type: string }` (mirror `isTopoSurfaceEntity`) ⇒ δέχεται `EntityModel` **και** `DxfEntityUnion` **χωρίς κανένα cast**, με πραγματικό έλεγχο τύπου |
| `topo-frame-status-store#getTopoFrameStatusLevelId` | Κανείς — και γι' αυτό ο φρουρός «το μήνυμα δεν ζει πέρα από την οθόνη που το γέννησε» ήταν **γραμμένος αλλά ασύνδετος** | Το `levelId` μπήκε **μέσα** στο snapshot (+ στο `equals`) και το `TopoFrameNotice` το τιμά· ο getter διαγράφηκε |

**Γιατί το `levelId` δεν έμεινε getter:** τιμή που συμμετέχει στο render **πρέπει** να ζει στο
snapshot. Εκτός αυτού το `useSyncExternalStore` δεν τη βλέπει (tearing σε concurrent render), και
δύο όροφοι με ταυτόσημο εύρημα δεν θα ξυπνούσαν καν τον αναγνώστη — το μήνυμα θα κολλούσε κρυφό.

**Το πραγματικό μάθημα:** το CHECK 3.30 δεν είναι απλώς μετρητής νεκρού κώδικα. **Μια εξαγωγή που
δεν την καλεί κανείς είναι το πρώτο ορατό σημάδι ότι ένα SSoT δεν συνδέθηκε ποτέ** — και το
docblock που περιγράφει τους «καταναλωτές» του δεν είναι απόδειξη ότι υπάρχουν. Το grep είναι.

## Changelog

| Ημ/νία | Αλλαγή |
|---|---|
| 2026-07-29 (β) | 🔴 **ΤΟ ΤΡΙΤΟ BIT (`locked`) ΚΑΙ ΤΟ LAYER «0» ΠΟΥ ΗΤΑΝ ΕΞΑΙΡΕΜΕΝΟ ΑΠΟ ΤΟΝ ΠΙΝΑΚΑ.** Βλ. §11. Το κλείδωμα χανόταν στην εισαγωγή **και** στην εξαγωγή, παρότι parser/καταναλωτές/writer ήταν όλοι έτοιμοι· το «0» αγνοούσε **και τις τρεις** σημαίες του αρχείου, επιβιώνοντας της διόρθωσης του §10 επειδή δεν περνά από `registerLayer`. +13 tests |
| 2026-07-29 | 🔴 **Ο ΔΕΥΤΕΡΟΣ ΜΗΧΑΝΙΣΜΟΣ ΑΠΟΚΡΥΨΗΣ ΔΕΝ ΕΙΣΑΓΟΤΑΝ ΠΟΤΕ, ΚΑΙ ΤΟ PICKING ΔΕΝ ΤΟΝ ΡΩΤΟΥΣΕ.** Βλ. §10 |
| 2026-07-28 | §9 — εκκαθάριση CHECK 3.30 (9 νέες νεκρές εξαγωγές, κανένα rebaseline): 4+1 διαγραφές, 4 συνδέσεις. Τα 9 χειρόγραφα αντίγραφα του layer-store subscription μετανάστευσαν στο `useLayerStoreSnapshot`· η εισερχόμενη πύλη `unprojectDisplayPoint` συνδέθηκε στο `topo-survey-point-resolve`· το `topoSurfaceGripsOf` αντικατέστησε δύο ανέλεγκτα casts· το `levelId` του `topo-frame-status-store` έγινε πεδίο snapshot και το `TopoFrameNotice` το τιμά (**διόρθωση συμπεριφοράς**: το μήνυμα δεν εμφανίζεται πια για άλλον όροφο). Gate: `✅ CHECK 3.30 OK`. Jest: 193/193 στις 19 σχετικές σουίτες |
| 2026-07-28 | Αρχική έκδοση. Ρίζα εντοπισμένη με browser probe· §1-8 IMPLEMENTED· 218/218 jest· browser-verified. Κώδικας: `9b6b80c3` (SSoT γραφής + gateway), `e1391324` (κάλυψη), `58bf78b8` (ανα-αρίθμηση 719→721 — το 719 ήταν πιασμένο από το ambient-declaration-ssot) |


## 10. 🔴 2026-07-29 — Το πάγωμα (group 70) και το picking

**Αφορμή (Giorgio):** *«γιατί αυτή η μπλε γραμμή δεν φαίνεται στο AutoCAD;»* — για μια πολυγραμμή
που ο Νέστορας ζωγράφιζε κανονικά.

### 10.1 Η εισαγωγή διάβαζε τον μισό πίνακα

Το AutoCAD κρύβει ένα layer με **δύο ανεξάρτητους** μηχανισμούς — και το §1 αυτού του ADR το
δηλώνει ήδη ρητά («ON και FREEZE είναι ΔΥΟ ερωτήματα»). Ο reader όμως που τροφοδοτεί τον
`DxfSceneBuilder` (`parseLayerColors`) διάβαζε **μόνο** τα group `2` και `62`:

| Μηχανισμός | DXF | Τιμούνταν; |
|---|---|---|
| **OFF** | `62` αρνητικό | ✅ ναι |
| **FROZEN** | `70` bit 0 | ❌ **δεν διαβαζόταν καθόλου** |

Μετρημένο στο πραγματικό `47_ergasia.dxf`: **8 παγωμένα layers / ~700 οντότητες** που το AutoCAD
δεν δείχνει (`Point_Tax_2019` 284, `Num_Tax_2019` 244, `pl` 60, `kryfo` 38, `Visible Elevation` 24,
`Δημανιδης`/`Survey`/`Name` 43). Το `pl` — η μπλε γραμμή — έχει **θετικό** χρώμα και είναι *μόνο*
frozen, γι' αυτό γλιστρούσε από τον έλεγχο προσήμου.

⚠️ **Ολόκληρη η μηχανή του παγώματος υπήρχε και ήταν σωστή** (`isLayerRenderable`,
`LayerFreezeCommand`, `LAYTHW`, smart filters, `dxf-entity-layer-skip`). **Κανείς δεν έγραφε το
πεδίο.** Η ιδιότητα χωρίς συγγραφέα είναι σχόλιο, όχι συμπεριφορά.

🆕 `utils/dxf-layer-flags.ts` — SSoT για τα bits του group 70. Ο πλήρης parser
(`dxf-layer-table-parser`) υπολόγιζε ήδη `flag & 1` inline· τώρα **και οι δύο** readers ρωτούν το
ίδιο module ⇒ αδύνατο να πουν διαφορετικά για το ίδιο αρχείο. Το `LayerColorEntry` απέκτησε
`frozen`, και το `registerLayer` το περνά στο `createSceneLayer` (χωρίς αυτό ο parser θα ήταν
σωστός και **αδρανής** — ένα test το φυλάει).

### 10.2 Και μετά: «τις ανακαλύπτει ο κέρσορας»

Μόλις το πάγωμα άρχισε να τιμάται στο **rendering**, ο Giorgio ανέφερε αμέσως: *«εξαφανίστηκαν οι
μπλε γραμμές, αλλά όταν κάνω hover τις ανακαλύπτει ο κέρσορας, φωτίζονται και επιλέγονται»*.

Το ίδιο ερώτημα ήταν γραμμένο σε **τέσσερα** σημεία με **τέσσερις** απαντήσεις — ακριβώς η
παθολογία που γέννησε αυτό το ADR, σε άλλο υποσύστημα:

| Σημείο | Τι ρωτούσε | Αποτέλεσμα |
|---|---|---|
| `dxf-entity-layer-skip` (render) | `frozen \|\| !visible` | ✅ σωστό |
| `hit-tester-utils.passesFilters` (hover/click) | μόνο `entity.visible` | ❌ **καμία** ερώτηση για layer |
| `SelectionUtils.findEntityAtPoint` | `layer && !layer.visible` | ❌ αγνοεί πάγωμα· truthiness ⇒ `undefined` = «κρυφό» |
| `SelectionUtils.findEntitiesInMarquee` / `findEntitiesInLasso` | — | ❌ **κανένας** έλεγχος |

🆕 `LayerStore.isLayerIdPickable(layerId)` — ζωντανή ανάγνωση store + ο καθαρός
`isLayerRenderable`. **Ένα** κατηγόρημα, **τέσσερα** call sites. Fail-open σε άγνωστο `layerId`
(ίδια στάση με τον renderer: σπασμένη αναφορά δεν εξαφανίζει σιωπηλά τη δυνατότητα επιλογής),
και σεβασμός του `includeInvisible` για όποιον θέλει ρητά τα πάντα.

**Γιατί event-time και όχι φιλτράρισμα στο χτίσιμο του spatial index:** ο index ξαναχτίζεται μόνο
σε αλλαγή σκηνής (`scene === this.currentScene` guard). Ένα toggle παγώματος στο panel δεν αλλάζει
τη σκηνή ⇒ το φίλτρο θα έμενε μπαγιάτικο. Ένα test το καρφώνει.

### 10.3 Επαλήθευση

- `utils/__tests__/dxf-layer-frozen-import.test.ts` (9) — το περιστατικό `pl`, πειθαρχία bit
  (`locked`=4 και «frozen σε νέα viewports»=2 **δεν** κρύβουν), η καλωδίωση μέχρι το `SceneLayer`,
  και anti-drift μεταξύ των δύο parsers σε 6 τιμές flag.
- `rendering/hitTesting/__tests__/hit-test-layer-renderable.test.ts` (8) — hover + **και τα τρία**
  μονοπάτια επιλογής (click/marquee/lasso), fail-open, `includeInvisible`, ζωντανή ανάγνωση.
- Σαμποτάζ: 5 / 1 / 3 / 1 κόκκινα αντίστοιχα ⇒ τα δίχτυα δαγκώνουν.

## 11. 🔴 2026-07-29 (β) — Το **τρίτο** bit, και το layer που ήταν εξαιρεμένο από τον πίνακα

Το §10 έκλεισε το bit 0 (πάγωμα) και άφησε ρητά ανοιχτό το bit 2 (κλείδωμα) ως ερώτημα προς τον
Giorgio, επειδή **αλλάζει επεξεργασιμότητα, όχι ορατότητα**. Ο Giorgio το ενέκρινε — και η
ανάλυση για την υλοποίηση αποκάλυψε ότι το κενό ήταν μεγαλύτερο απ' όσο περιέγραφε το handoff.

### 11.1 `locked` (group 70 bit 2) — τρίτη ερώτηση, τρίτη απάντηση

| Μηχανισμός | DXF | Τι απαγορεύει | Ρωτά το `isLayerRenderable`; |
|---|---|---|---|
| **OFF** | `62` αρνητικό | εμφάνιση | ✅ ναι |
| **FROZEN** | `70` bit 0 | εμφάνιση + regen | ✅ ναι |
| **LOCKED** | `70` bit 2 | **επεξεργασία** | ❌ **ποτέ** — μένει ορατό & εκτυπώσιμο |

Ίδιο σχήμα με το §10, ένα σκαλί χειρότερο: εδώ **και οι δύο** άκρες υπήρχαν. Ο πλήρης parser
(`dxf-layer-table-parser`) καλούσε ήδη `isLockedFlag`. Οι καταναλωτές ήταν έξι — trim, extend,
stretch, scale, offset, fillet — συν τον `assertCanEditLayer` και τον layer picker. Ο
`dxf-layer-table-writer` ήξερε ήδη να επανεκπέμψει το bit 4. Έλειπε **μόνο** ο legacy reader:
το `parseLayerColors` ρωτούσε από το group 70 μόνο το bit 0, οπότε το `registerLayer` κατέληγε να
γράφει καρφωτά `locked: false`.

Συνέπεια που δεν ήταν προφανής: **σιωπηλή απώλεια στο round-trip**. Ένα αρχείο με κλειδωμένα
layers έβγαινε από την εξαγωγή ξεκλείδωτο — ο writer ήταν σωστός, απλώς δεν είχε ποτέ τι να γράψει.

### 11.2 🔴 Το layer «0» ήταν το ΜΟΝΟ layer εξαιρεμένο από τον πίνακα

Εύρημα **εκτός** του handoff, από την ανάγνωση του `buildScene`. Το «0» κατασκευάζεται **πριν** τον
βρόχο των οντοτήτων, με `visible: true` / `locked: false` **καρφωτά** — και επειδή ο
`registerLayer` κάνει `if (!layers[name])`, δεύτερη ευκαιρία **δεν υπάρχει ποτέ**. Δηλαδή ένα
αρχείο που δηλώνει το «0» σβηστό, παγωμένο ή κλειδωμένο το εισήγαγε ως απολύτως κανονικό.

Το §10 δεν το είχε πιάσει: η διόρθωση του παγώματος έγινε στο `registerLayer`, το οποίο για το «0»
**δεν εκτελείται**. Ένα ελάττωμα που επιβιώνει της διόρθωσης της ίδιας του της κλάσης, επειδή ζει σε
ειδική περίπτωση που καμία δοκιμή δεν κοίταζε.

⚠️ Το «0» εξακολουθεί να είναι υποχρεωτικό και να δημιουργείται πάντα (κάθε νέο BIM entity
καρφώνεται στο id του) — άλλαξαν **μόνο** οι τρεις σημαίες, και μόνο όταν ο πίνακας τις δηλώνει.
Αρχείο χωρίς πίνακα LAYER κρατά τα ιστορικά defaults.

### 11.3 Επαλήθευση

- `utils/__tests__/dxf-layer-locked-import.test.ts` (13) — ο **πλήρης πίνακας αλήθειας** και των 8
  τιμών του group 70 (κάθε bit απαντά μόνο στη δική του ερώτηση), «κλειδωμένο ≠ κρυμμένο», η
  καλωδίωση μέχρι το `SceneLayer`, ο **πραγματικός** φύλακας (`assertCanEditLayer` πετά /
  `canUnlockLayer` περνά — όχι απλώς «η τιμή είναι true»), ο κύκλος εισαγωγής→εξαγωγής, anti-drift
  στους δύο parsers, και οι τέσσερις περιπτώσεις του layer «0».
- Σαμποτάζ: αφαίρεση του `isLockedFlag` από τον legacy reader ⇒ **8** κόκκινα· επαναφορά του
  καρφωτού `visible: true` στο «0» ⇒ **1** κόκκινο. Τα δίχτυα δαγκώνουν.
- Regression: **190 suites / 2.166 tests** πράσινα σε layers/dimensions/parsers/round-trip.
  `jscpd:diff` καθαρό στα 7 αρχεία.

### 11.4 Τι ΔΕΝ έγινε

Τα **316 `visible: false`** του §8 μένουν ως έχουν (δεδομένα χρήστη, διφορούμενη πρόθεση) — ο
Giorgio δεν έδωσε εντολή καθαρισμού και δεν πρέπει να θεωρηθεί παράλειψη.
