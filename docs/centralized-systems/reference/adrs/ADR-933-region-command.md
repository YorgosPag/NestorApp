# ADR-933: Εντολή «Περιοχή» — είδος + μέθοδοι γεωμετρίας για περιοχές κάτοψης

| Metadata | Value |
|----------|-------|
| **Status** | 🔄 Φάση Α υλοποιημένη (2026-11-07) · Φάση Β σχεδιασμένη (§5) |
| **Date** | 2026-11-07 |
| **Category** | DXF Viewer / Drawing Tools |
| **Canonical Location** | `src/subapps/dxf-viewer/stores/overlay-draw-settings-store.ts` · `overlays/commit-overlay-polygon.ts` · `ui/ribbon/data/contextual-overlay-region-tab.ts` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |
| **Related** | ADR-931 (κοινόχρηστοι, Β1) · ADR-258B (σύνδεση περιοχής–οντότητας) · ADR-040 (καμβάς) · ADR-050 (γραμμή εργαλείων overlay) · ADR-507 (ανίχνευση περιοχών, HPGAPTOL) |

---

## 1. Context

Ο ζωντανός έλεγχος του ADR-931 Β1 («σχεδίασε περιοχή κοινόχρηστου και σύνδεσέ την») μπλόκαρε: η δοκιμή
«Σχεδίαση Επιπέδων» + **N** + 4 κλικ + Enter έφτιαξε απλή οντότητα DXF, όχι περιοχή. Η αρχική υπόθεση
(«κανένα UI δεν μπαίνει σε σχεδίαση περιοχής») ήταν **λάθος**. Η μέτρηση στον κώδικα έδειξε:

| Εύρημα | Συνέπεια |
|---|---|
| «Σχεδίαση Επιπέδων» (`activeTool='layering'`) ⇒ `NormalView` ⇒ `overlayMode='draw'` — **ζωντανό** | η είσοδος υπήρχε |
| `NormalView`/`FullscreenView` περνούσαν **καρφωμένο** `currentKind="property"`, παρακάμπτοντας το `overlayKind` του `useOverlayState` | περιοχή άλλου είδους (θέση, αποθήκη, **κοινόχρηστος**) **δεν μπορούσε να γεννηθεί από UI** |
| Ο επιλογέας είδους ζούσε μόνο σε απροσάρτητα UI (`OverlayToolbarSection` από το `c63144b7`, `DraggableOverlayToolbar` πίσω από σημαία) και του έλειπε το `common_space` | κανένα σημείο επιλογής |
| Το **N** ήταν δηλωμένο δύο φορές: `polygon` (ζωντανό) και `overlay:draw-mode` (**κανένας χειριστής**) | το N άλλαζε εργαλείο σε απλό πολύγωνο DXF |
| Το `useOverlayState` κρατούσε το είδος σε `useState` μέσα στον `DxfViewerContent` | η κορδέλα (factories χωρίς props) δεν μπορούσε να το φτάσει |

## 2. Έρευνα — τι κάνουν οι μεγάλοι

| Πρόγραμμα | Ροή | Σημείωση |
|---|---|---|
| **Revit** Room/Area | «Place Room» → contextual tab «Modify \| Place Room» με Type Selector· αυτόματη ανίχνευση ορίου με προεπισκόπηση πριν το κλικ· αλίας **RM** | αποτυγχάνει με «not enclosed» στο παραμικρό κενό — λύση: χειροκίνητες Room Separation Lines |
| **ArchiCAD** Zone | Info Box «Geometry Method»: Polygonal · **Rectangular** · Rotated Rect · **Inner Edge** (κλικ μέσα σε κλειστό περίγραμμα) · Magic Wand | αυτόματο μόνο με στοιχεία σημασμένα «zone boundary» |
| **Bluebeam** Dynamic Fill | γέμισμα ως τις γραμμές + «Add Boundary» για ανοίγματα | μόνο σε content layer |

Πηγές: [Revit Room placement](https://novedge.com/blogs/design-news/revit-tip-reliable-room-placement-in-revit-boundaries-settings-and-quality-checks) ·
[ArchiCAD Creating Zones](https://help.graphisoft.com/AC/25/INT/_AC25_Help/040_ElementsVB/040_ElementsVB-147.htm) ·
[Bluebeam Dynamic Fill](https://support.bluebeam.com/en-us/revu/features/dynamic-fill-overview.html).

## 3. Decision

### 3.1 Ένα SSoT ρυθμίσεων — `overlayDrawSettingsStore`

`stores/overlay-draw-settings-store.ts`: `{ kind: OverlayKind; method: OverlayDrawMethod }`, χτισμένο στο υπάρχον
`createPersistedValue` (localStorage, ADR-092). Κάθε εγγραφή περνά από `normalizeOverlayDrawSettings` — άκυρη τιμή δεν
φτάνει ποτέ στην αποθήκευση. Το `useOverlayState` **δεν** κρατά πια δικό του είδος: τα `overlayKind`/`setOverlayKind`
είναι λεπτό πέρασμα προς το store (αμετάβλητοι καταναλωτές). Ο κατάλογος ειδών είναι `OVERLAY_KINDS =
Object.keys(KIND_LABELS)` — ένα σημείο δήλωσης.

### 3.2 Μία πόρτα αποθήκευσης — `commitOverlayPolygon`

`overlays/commit-overlay-polygon.ts`. Κάθε μέθοδος γεωμετρίας καταλήγει εδώ (`usePolygonCompletion` αναθέτει):
1. < 3 κορυφές ⇒ τίποτα · χωρίς επίπεδο ⇒ `overlay:save-error {no-level}`.
2. **Ιδεμποτία**: υπάρχει στο επίπεδο περιοχή με εμβαδόν ±1% **και** το κέντρο βάρους της νέας μέσα της ⇒ δεν
   γράφεται δεύτερη· `overlay:polygon-saved {overlayId, reused: true}` ⇒ επιλέγεται η υπάρχουσα + toast
   «υπάρχει ήδη» (`useToolAvailabilityNotifications`).
3. `overlayStore.add({ kind: overlayDrawSettingsStore.get().kind, … })` — το είδος διαβάζεται **τη στιγμή της
   αποθήκευσης** (ADR-040 κανόνας 2).
4. Σφάλμα ⇒ η **πραγματική** αιτία (`OverlayPersistBlockedError.reason` ή `persist-failed`, ADR-921).

Το καρφωμένο `currentKind` αφαιρέθηκε από `NormalView`, `FullscreenView`, `CanvasSection` και `usePolygonCompletion`.

### 3.3 Contextual καρτέλα «Περιοχή» (Revit «Modify | Place Room»)

`ui/ribbon/data/contextual-overlay-region-tab.ts`, trigger `overlay-region-active`, ενεργοποίηση από
`['layering', …]` στο `TOOL_ACTIVE_TRIGGER`. Panels:
- **Είδος** — widget `overlay-kind` → ξαναχρησιμοποιεί το `KindSelector` (επισκευασμένο: `Record<OverlayKind, Icon>`
  ⇒ νέο είδος χωρίς εικονίδιο = σφάλμα τύπου· ετικέτες από `KIND_LABELS` αντί για σκληροκωδικοποιημένα αγγλικά·
  `<fieldset>`).
- **Μέθοδος** — widget `overlay-draw-method`: Πολυγωνική · Ορθογώνια, πάνω στο νέο κοινό `RibbonGlyphModeGroup`, που
  εξήχθη από το `RibbonWallDrawModeWidget` (ADR-565) — η Draw gallery του τοίχου το χρησιμοποιεί πλέον κι αυτή (N.18).

### 3.4 Μέθοδος «Ορθογώνια» (ArchiCAD Rectangular)

`overlays/region-rectangle.ts` `regionRectangleRing(first, opposite)` πάνω στο BIM SSoT `rectangleCorners`. Το ίδιο
δακτύλιο χτίζει η προεπισκόπηση (`useDraftPolygonLayer`, rubber band) **και** η αποθήκευση
(`canvas-click-overlay-draw.ts`) — ό,τι βλέπει ο άνθρωπος είναι ό,τι γράφεται. Αλλαγή μεθόδου στη μέση της
σχεδίασης ⇒ άδειασμα του πρόχειρου (συνδρομή στο store μέσα σε `useEffect`, setState μόνο στη σπάνια αλλαγή — ο
orchestrator δεν γίνεται high-freq subscriber).

Οι χειριστές κλικ περιοχής μετακόμισαν σε `hooks/canvas/canvas-click-overlay-draw.ts` (το
`canvas-click-tool-handlers.ts` έφτανε τις 488/500 γραμμές).

### 3.5 Πλήκτρα — ένα πλήκτρο, μία σημασία

- **N** = «Πολύγωνο» (μόνο). Η δήλωση `overlayDraw` έγινε **`RM`** → `tool:layering` (αλίας Revit Room) μέσω του
  υπάρχοντος `MultiCharKeySequence` (`R` leader· `R` μόνο του ⇒ «Ορθογώνιο», ίδιο σχήμα με `S`/`C`/`O`).
- Ο dispatcher αγνοεί πλέον και το **Shift** (`!e.shiftKey`), όπως έλεγε ήδη το σχόλιό του («unmodified keys»):
  αλλιώς το Shift+R (περιστροφή) θα άνοιγε το chord του R.
- Το `O` μένει ως είχε (εναλλαγή «Σχεδίαση Επιπέδων»).

### 3.6 Τι ΔΕΝ άλλαξε (ρητά)

Σχήμα `floorplan_overlays`, κανόνες Firestore, σύνδεση ADR-258B, `drawnArea` του ADR-931 Β1. Ο νεκρός κώδικας
overlay **μένει** (απόφαση Giorgio 2026-11-07): `ui/OverlayToolbar.tsx`, `ui/OverlayToolbarSimple.tsx`,
`DraggableOverlayToolbar` + σημαία `USE_UNIFIED_OVERLAY_TOOLBAR`, `OverlayToolbarSection` (+ `OverlayModeButtons`,
`OverlayActions`, `PolygonControls`, `StatusPalette`), `useOverlayPersistence`, `completeEntity({ persistToOverlays })`,
και οι αχειριστές δηλώσεις `overlayEdit` (E) / `overlaySelect` (V). Ο `MainContentSection` περνά ακόμη
`currentKind={overlayKind}` προς το layout — η τιμή πλέον έρχεται από το ίδιο SSoT και κανείς δεν την καταναλώνει.

## 4. Συνέπειες

- ✅ Περιοχή **οποιουδήποτε** είδους (και `common_space`) γεννιέται από UI ⇒ ξεκλειδώνει τον ζωντανό έλεγχο ADR-931 Β1.
- ✅ Μία αυθεντία για το είδος (store), μία πόρτα αποθήκευσης, μία σήμανση «ομάδα κουμπιών-εικονιδίων».
- ⚠️ Τα tests γράφτηκαν — εκτέλεση **μόνο με έγκριση Giorgio**.

## 5. Φάση Β (σχεδιασμένη) — επαναχρησιμοποίηση, όχι νέα μηχανή

Η μέτρηση στον κώδικα βρήκε ότι η ανίχνευση «κλικ μέσα» **υπάρχει ήδη** (ADR-507): `systems/auto-area/`
(`getAutoAreaHitResult` — half-edge face traversal, γεφύρωση κενών HPGAPTOL σε μονάδες σχεδίου, cache ανά σκηνή,
μικρότερη περιοχή που περιέχει το σημείο, τρύπες), προεπισκόπηση `AutoAreaPreviewStore` + `AutoAreaPreviewOverlay`,
τροφοδότηση `useAutoAreaMouseMove`, «Να κλείσω το κενό;» (ADR-419). Η Φάση Β:
- μέθοδος **«Κλικ μέσα»** = ίδιος ανιχνευτής, ίδια προεπισκόπηση (preview ≡ commit όπως η γραμμοσκίαση),
  ανοχή κενού στην καρτέλα (combobox `model-length`, ίδιες επιλογές με το HPGAPTOL της γραμμοσκίασης)·
- μέθοδος **«Από επιλογή»** = κλειστές (LW)POLYLINE / ορθογώνια / κύκλοι από τα ίδια SSoT του ανιχνευτή·
- **πρόταση είδους/ονόματος** από το κείμενο μέσα στην περιοχή.
- ⚠️ Το `floorplan_overlays` κρατά **έναν** δακτύλιο: οι τρύπες (κολόνες) δεν αποθηκεύονται — θα αναφερθεί στον
  χρήστη, δεν θα κρυφτεί.

## 6. Changelog

| Ημερομηνία | Αλλαγή |
|---|---|
| 2026-11-07 | **Φάση Α**: `overlayDrawSettingsStore` (είδος + μέθοδος, ένα SSoT, `useOverlayState` αναθέτει) · `commitOverlayPolygon` (μία πόρτα, ιδεμποτία, πραγματική αιτία σφάλματος) · αφαίρεση καρφωμένου `currentKind="property"` · contextual καρτέλα «Περιοχή» (`overlay-kind` με επισκευασμένο `KindSelector` + `overlay-draw-method`) · κοινό `RibbonGlyphModeGroup` (και ο τοίχος) · μέθοδος «Ορθογώνια» (`regionRectangleRing`, preview ≡ commit) · `canvas-click-overlay-draw.ts` · πλήκτρα: `RM` → περιοχή, N μόνο πολύγωνο, `!e.shiftKey` στον chord dispatcher · i18n el/en. Tests γραμμένα (`overlay-draw-settings-store.test.ts`, `commit-overlay-polygon.test.ts`, `region-rectangle.test.ts`, pin `layering` στο `resolve-tool-active-trigger-coverage.test.ts`) — **εκτέλεση μόνο με έγκριση**. Η έρευνα της Φάσης Β διόρθωσε το σχέδιο: η μηχανή «κλικ μέσα» υπάρχει (ADR-507) — §5. |
