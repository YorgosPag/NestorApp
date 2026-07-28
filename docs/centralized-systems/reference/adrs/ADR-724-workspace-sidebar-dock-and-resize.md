# ADR-724 — Ο **Χώρος Εργασίας** του DXF Viewer: αγκύρωση, αλλαγή μεγέθους, αιώρηση της κύριας παλέτας

| Πεδίο | Τιμή |
|---|---|
| **Status** | 🟢 **Φ0 + Φ1 IMPLEMENTED & ΕΠΑΛΗΘΕΥΜΕΝΑ ΖΩΝΤΑΝΑ** 2026-07-28 — αγκυρωμένη αριστερά παλέτα με αλλαγή πλάτους (δείκτης **και πληκτρολόγιο**)· οι δύο καμβάδες ακολουθούν. Απόδοση **μετρήθηκε** (§4.3.1): το σύρσιμο κοστίζει ~0 ⇒ καμία cheap-path. **Φ2 (δεξιά) / Φ3 (αιωρούμενη) / Φ4 (πάνω από τον κλάδο): NOT IMPLEMENTED.** Μοναδικό ανέλεγκτο: **mobile drawer** (§14.2) |
| **Date** | 2026-07-28 |
| **Category** | DXF Viewer — Layout / Workspace· Shared UI primitives (`components/ui/floating`, `components/ui/resizable`) |
| **Author** | Claude Opus 5 + Γιώργος Παγώνης |
| **Trigger** | Giorgio: «ΤΟ CONTAINER ΝΑ ΜΕΓΑΛΩΝΕΙ/ΜΙΚΡΑΙΝΕΙ ΔΕΞΙΑ-ΑΡΙΣΤΕΡΑ ΚΑΙ ΝΑ ΑΚΟΛΟΥΘΟΥΝ ΟΙ ΚΑΜΒΑΔΕΣ 2Δ ΚΑΙ 3Δ· ΝΑ ΜΠΟΡΕΙ ΝΑ ΕΙΝΑΙ FLOATING Ή ΝΑ ΑΓΚΥΡΩΝΕΙ ΑΡΙΣΤΕΡΑ Ή ΔΕΞΙΑ» |
| **Συνεχίζει** | **ADR-723** — που δήλωσε ρητά *«⛔ εκτός σκοπού: docking, keyboard resize»*. Αυτό το ADR είναι ακριβώς αυτό το εκτός-σκοπού |
| **Companions** | ADR-040 (micro-leaf· ο καμβάς)· ADR-176 (responsive + pointer events)· ADR-241 (fullscreen)· ADR-418 (πραγματική κλίμακα 1:N)· ADR-549 (dpr)· ADR-092 (storage SSoT)· ADR-013 (panel tokens)· ADR-002 (z-index) |
| **Industry alignment** | Revit *Dockable Windows* · ArchiCAD palettes · Cinema 4D Layout Manager · Figma right panel · VS Code sash · WAI-ARIA `separator` (window splitter) |
| **Risk** | **High** — αγγίζει τη ρίζα διάταξης του viewer **και** τον κανόνα resize του καμβά (ADR-040 CHECK 6B/6D). Μετριάζεται με φασεολόγηση: Φ1 δίνει το 80% της αξίας αγγίζοντας 3 αρχεία |

---

## 0. Πώς διαβάζεται αυτό το έγγραφο

Είναι **ερευνητικό ADR**: γράφτηκε πριν από τον κώδικα, όπως ορίζει ο κανόνας N.0.1 Φάση 1.
Τα §1–§4 είναι **μετρημένα ευρήματα** στον σημερινό κώδικα (με αρχείο:γραμμή — επαληθεύσιμα).
Τα §5–§9 είναι **αποφάσεις** και §10 το σχέδιο υλοποίησης. Όπου δεν είμαι σίγουρος, το λέω ρητά
αντί να το κρύψω πίσω από βεβαιότητα (§11 «Ανοιχτά ερωτήματα»).

---

## 1. Τι ζητήθηκε

Η κύρια παλέτα του viewer (καρτέλες *Επίπεδα / Ρυθμίσεις DXF / Ιδιότητες / Διαστάσεις / Υλικά /
BIM 3D / Διατομές Κάσας / Εισαγόμενα*) — σήμερα καρφωμένη αριστερά σε **384px** — πρέπει να αποκτήσει:

1. **Αλλαγή πλάτους** με σύρσιμο, και οι δύο καμβάδες (2D & 3D) να προσαρμόζονται ταυτόχρονα.
2. **Τρεις τρόπους**: αγκυρωμένη αριστερά (σημερινή θέση), αγκυρωμένη **δεξιά**, ή **αιωρούμενη**
   πάνω από τους καμβάδες.

---

## 2. SSoT AUDIT — τι **υπάρχει ήδη** (grep, όχι εικασία)

### 2.1 Ώριμη υποδομή που **πρέπει** να χρησιμοποιηθεί

| Υπάρχον SSoT | Αρχείο | Τι λύνει ήδη |
|---|---|---|
| **Floating γεωμετρία** (ADR-723) | `src/components/ui/floating/*` | σύρσιμο, **8 λαβές** αλλαγής μεγέθους, κανόνας ορίων, μνήμη ανά χρήστη, διάσωση από «χαμένη εκτός οθόνης» |
| `useFloatingPanelGeometry` | `…/floating/useFloatingPanelGeometry.ts` | ο **ένας** κάτοχος θέσης+μεγέθους μιας παλέτας· rAF-coalesced `window.resize`· persist στο **τέλος** χειρονομίας |
| `useResizable` / `useDraggable` | `src/hooks/` | pointer events (ADR-176), pointer capture, 8 ακμές, ελεγχόμενα (controlled) — **αποθήκη = ο καλών** |
| `floating-panel-persistence` | `…/floating/` | `nestor:floating-panel-geometry:v1:` πάνω από `@/lib/storage` (SSR/quota-safe) |
| **Split panes** | `src/components/ui/resizable.tsx` | shadcn wrapper του **`react-resizable-panels@4.7.2`** (MIT) — ήδη σε **3** σελίδες |
| Καμβάς 2D | `hooks/canvas/useCanvasSizeObserver.ts:83`, `useCanvasResize.ts` | `ResizeObserver` + dpr sync (ADR-549) |
| Καμβάς 3D | `bim-3d/scene/scene-manager-resize.ts:40` | `applyViewportResize()` → aspect + `setSize` + SSAO + ViewCube + `bimEdgeResolutionStore` + invalidate caches |
| Pointer rect | `rendering/core/pointer-rect-cache.ts:58` | `ResizeObserver` στο ίδιο το canvas ⇒ **αυτο-ακυρώνεται** σε κάθε αλλαγή πλάτους |
| Z-index | `styles/DxfZIndexSystem.styles.ts:113` | `dxfZIndex.overlays.sidebar` = `sticky + 10` |
| Responsive | `useResponsiveLayout` + `constants/layout.ts` | `desktop ≥ 1024` / `tablet ≥ 768` / `mobile` |

**Συμπέρασμα Α:** το ~80% υπάρχει. Το ζητούμενο είναι **σύνθεση**, όχι νέος μηχανισμός.

### 2.2 Το **μοναδικό** εμπόδιο σήμερα

`src/subapps/dxf-viewer/layout/SidebarSection.tsx:56-60`

```ts
WIDTH:     PANEL_LAYOUT.WIDTH.PANEL_LG                       // w-96      = 384px
MIN_WIDTH: PANEL_LAYOUT.LAYOUT_DIMENSIONS.SIDEBAR_MIN_WIDTH  // min-w-[384px]
MAX_WIDTH: PANEL_LAYOUT.LAYOUT_DIMENSIONS.SIDEBAR_MAX_WIDTH  // max-w-[384px]
```

`min = max = 384` + `flex-shrink-0`. **Δεν υπάρχει άλλη σκληρή παραδοχή πλάτους** πουθενά στη
διάταξη: το `MainContentSection.tsx:124` έχει ήδη `min-w-0 overflow-hidden` και
`getMainContentSectionStyles()` έχει `flex: 1`. Δηλαδή **η flexbox είναι ήδη σωστή** — το
`min-w-0` (η κλασική αιτία του «δεν συρρικνώνεται») υπάρχει.

### 2.3 ⚠️ Δύο **νεκρά** συστήματα docking — ΜΗΝ τα αναστήσεις

| Αρχείο | Κατάσταση | Απόδειξη |
|---|---|---|
| `layout/CadDock.tsx` | **ΝΕΚΡΟ + ΣΠΑΣΜΕΝΟ** | κάνει `import { DockviewReact } from 'dockview'` — το **`dockview` ΔΕΝ είναι στο `package.json` και ΔΕΝ είναι εγκατεστημένο**. Δεν το εισάγει κανείς. Περνά απαρατήρητο επειδή το subapp εξαιρείται από το root `tsconfig` (ADR-663/ADR-719) |
| `systems/toolbars/ToolbarsContext.types.ts:33` | **ΝΕΚΡΟ** | έχει `docked: boolean` + `isToolbarDocked()`, αλλά `grep -rn "ToolbarsProvider" src` → **0 αποτελέσματα** |

> **Κανόνας μνήμης**: «feature σε unmounted container = ΝΕΚΡΟ». Και τα δύο είναι *σχόλια που
> μοιάζουν με αρχιτεκτονική*. Η ύπαρξή τους **δεν** αποτελεί επιχείρημα υπέρ του `dockview`.
> **Ενέργεια**: το `CadDock.tsx` προτείνεται προς **διαγραφή** (ξεχωριστό commit, εκτός αυτής της
> εργασίας — το working tree μοιράζεται με άλλον πράκτορα).

---

## 3. Τι κάνουν οι μεγάλοι παίχτες (τεκμηριωμένο)

| Εφαρμογή | Αγκύρωση | Αιώρηση | Πλάτος | Ιδιαιτερότητα |
|---|---|---|---|---|
| **Revit** | Project Browser + Properties σε **οποιαδήποτε άκρη**, στοιβαζόμενες ή δίπλα-δίπλα | ναι, ακόμη και **σε δεύτερη οθόνη** | ελεύθερο | **διπλό κλικ στη γραμμή τίτλου = dock/undock**· περίγραμμα-προεπισκόπηση κατά το σύρσιμο |
| **ArchiCAD** | παλέτες σε dock zones | ναι | ελεύθερο | *Work Environment* profiles = ονομασμένες διατάξεις |
| **Cinema 4D** | κάθε manager σε οποιαδήποτε άκρη ή ξεχωριστό παράθυρο | ναι | ελεύθερο | ονομασμένα **Layouts** με εναλλαγή |
| **Figma** | δεξί panel **σταθερό** (canvas-first) | όχι | πρόσφατα resizable | συνειδητή **αντίθετη** επιλογή |
| **VS Code** | primary/secondary sidebar | όχι | sash | **διπλό κλικ στο sash → «optimal width»** (όπως Sublime/Atom)· **δεν** έχει keyboard resize (ανοιχτό issue) |

**Συμπέρασμα Β:** το «resizable + dockable» **είναι** η πρακτική του κλάδου για CAD/BIM — δεν είναι
προσωπική προτίμηση. Το «σκέτο floating» **δεν** είναι: είναι επιλογή του χρήστη *πάνω* σε ένα
dock model. Άρα υλοποιούμε **και τα τρία**, με το docked ως προεπιλογή.

**Συμπέρασμα Γ (πού τους ξεπερνάμε):** το VS Code **δεν** έχει keyboard resize· εμείς το έχουμε
(§5.2). Καμία CAD εφαρμογή δεν προσαρμόζει το *περιεχόμενο* της παλέτας στο πλάτος της — εμείς
μπορούμε (§9.1).

> ⚠️ **ΔΙΟΡΘΩΣΗ (2026-07-28, μετρημένο ζωντανά).** Η αρχική διατύπωση εδώ έλεγε ότι το keyboard
> resize «το παίρνουμε **δωρεάν**». **Ήταν ψευδής.** Η βιβλιοθήκη όντως το υλοποιεί, αλλά στην
> **εφαρμογή μας δεν λειτουργούσε καθόλου**: με εστίαση στο διαχωριστικό, τα βέλη άφηναν το πλάτος
> **670 → 670** και αντ' αυτού **πάναραν το σχέδιο** ~80px/πάτημα.
>
> Αιτία (επαληθευμένη στο bundle, handler `Te`): ο listener του splitter είναι **element-level,
> φάση bubble**, και ξεκινά με `if (e.defaultPrevented) return;` — ενώ οι global accelerators του
> viewer τρέχουν σε **window capture**, δηλαδή **πρώτοι**. Έκαναν το pan και `preventDefault()`,
> οπότε το splitter δεν έβλεπε ποτέ το συμβάν.
>
> **Το μάθημα**: «η βιβλιοθήκη το υποστηρίζει» **δεν** σημαίνει «η εφαρμογή το έχει». Ανάμεσά τους
> στέκεται η ιδιοκτησία του πλήκτρου, και αυτή είναι **δική μας** ευθύνη (ADR-711). Διορθώθηκε με
> **τρίτη ερώτηση** στον υπάρχοντα φύλακα — βλ. §5.2 και ADR-711 §5.7.

---

## 4. Τι θα σπάσει αν το κάνουμε αφελώς (τα δύσκολα)

Το σύρσιμο είναι η εύκολη μισή ώρα. Αυτά είναι που ξεχωρίζουν το επαγγελματικό εργαλείο:

### 4.1 Ο κανόνας αγκύρωσης του 2D — υπάρχει για το **ύψος**, λείπει για το **πλάτος**

`hooks/canvas/useViewportManager.ts:134-142`:

```ts
const deltaHeight = height - oldHeight;
if (oldHeight > 0 && Math.abs(deltaHeight) > 0.5) {
  const newOffsetY = currentTransform.offsetY + deltaHeight;   // ⇐ αγκύρωση ΚΑΤΩ ακμής
}
```

Δηλαδή σε αλλαγή ύψους το σχέδιο μένει κολλημένο στην **κάτω** ακμή — συνεπές με τον χάρακα του
app (0.000m κάτω-αριστερά). Για το **πλάτος δεν υπάρχει αντίστοιχη γραμμή** — γιατί μέχρι σήμερα το
πλάτος **δεν άλλαζε ποτέ**. Συνέπεια, ακριβώς:

- **Αγκύρωση ΔΕΞΙΑ**: η αριστερή ακμή του καμβά δεν κουνιέται ⇒ το σχέδιο μένει **απόλυτα ακίνητο**. ✅
- **Αγκύρωση ΑΡΙΣΤΕΡΑ**: η αριστερή ακμή του καμβά μετακινείται κατά Δ ⇒ **το σχέδιο σέρνεται μαζί
  με την παλέτα**. Οπτικά λάθος για CAD.

**Απόφαση**: αντιστάθμιση με βάση τη μετατόπιση της **οθονο-χωρικής** αριστερής ακμής του
container (`offsetX -= Δ(rect.left)`), όχι με βάση το Δ πλάτους. Έτσι και οι δύο πλευρές
συμπεριφέρονται ίδια, και ο κανόνας παραμένει **ένας**. Αγγίζει `useViewportManager` ⇒
**ADR-040 CHECK 6B/6D: το ADR-040 πρέπει να μπει staged στο ίδιο commit.**

### 4.2 Η κλίμακα **απαγορεύεται** να αλλάξει

Το app εμφανίζει πραγματική κλίμακα σχεδίου `1:N` (ADR-418, `SidebarZoomLeaf`). Οποιοδήποτε
zoom-to-fit κατά το resize θα άλλαζε **εμφανιζόμενο αριθμό** χωρίς εντολή χρήστη. Ο κανόνας είναι
απόλυτος: **resize ⇒ αλλάζει μόνο η ορατή περιοχή, ποτέ το `scale`.**

### 4.3 Καταιγίδα resize κατά το σύρσιμο

Κάθε pixel κίνησης → `ResizeObserver` → (2D) πιθανό full-scene bitmap rebuild + (3D)
`renderer.setSize` + SSAO resize + `invalidateFrameCaches`. Με **3.107 στοιχεία** αυτό είναι το #1
ρίσκο αίσθησης. Τρεις στρατηγικές, κατά σειρά προτίμησης:

1. **Live + rAF coalescing** (Figma/C4D): μία ενημέρωση ανά frame. Το `ResizeObserver` *ήδη*
   παραδίδει μία φορά ανά frame — άρα ίσως αρκεί. **Μέτρησέ το πρώτα** με 3.107 οντότητες.
2. **Cheap-path κατά τη χειρονομία**: όσο `[data-resize-handle-active]`, ο 2D blit-άρει το
   υπάρχον bitmap τεντωμένο και κάνει **ένα** full redraw στο `pointerup`.
3. **Ghost splitter** (γραμμή κατά το σύρσιμο, ένα resize στο τέλος) — σίγουρο αλλά λιγότερο
   «ζωντανό». Εφεδρεία, όχι πρώτη επιλογή.

⛔ **ΜΗΝ** επιλέξεις (2) ή (3) «προληπτικά». Χωρίς μέτρηση είναι πρόωρη βελτιστοποίηση που
θυσιάζει την αίσθηση.

#### 4.3.1 ✅ ΜΕΤΡΗΘΗΚΕ (2026-07-28, ζωντανά, 3.107 οντότητες) — **η στρατηγική (1) ΑΡΚΕΙ**

Η πρώτη ζωντανή μέτρηση ανέφερε «σύρσιμο στα 10 FPS» και οδήγησε στο συμπέρασμα ότι το resize
είναι ακριβό. **Η μέτρηση ήταν σωστή· η απόδοση της αιτίας λάθος.** Έλειπε η **ομάδα ελέγχου**:

| Σενάριο | Διάμεσος καρέ | FPS |
|---|---|---|
| Σύρσιμο διαχωριστικού (90 `pointermove`) | **70,8 ms** | 14,1 |
| **Ηρεμία — κανένα input** | **71,1 ms** | 14,1 |
| Ίδιο app, **απλή σελίδα** (χωρίς viewer) | 17,3 ms | 57,8 |
| Viewer με **κρυμμένους** τους καμβάδες | 16,8 ms | 59,5 |

**Το σύρσιμο κοστίζει ~0.** Είναι ταυτόσημο με την ηρεμία. Ο viewer τρέχει στα ~14 FPS **ούτως ή
άλλως**, και το resize δεν προσθέτει μετρήσιμο φορτίο.

Επιπλέον, σε **4 δευτερόλεπτα ηρεμίας**: **μηδέν** `longtask` — το main thread είναι εντελώς
αδρανές. Το κόστος **δεν είναι JS**. Είναι η **σύνθεση 13–15 στοιβαγμένων καμβάδων πλήρους
viewport** (1286×697 ο καθένας): κρύβοντας οποιουσδήποτε ~μισούς τα καρέ πέφτουν 71 → ~42 ms,
δηλαδή το κόστος είναι **γραμμικό στο πλήθος** (~5 ms ανά καμβά ανά καρέ), χωρίς μεμονωμένο ένοχο.

**Απόφαση: η στρατηγική (2) *cheap-path* ΔΕΝ υλοποιείται.** Θα ήταν ακριβώς η πρόωρη
βελτιστοποίηση που απαγορεύει η παράγραφος από πάνω: θα πρόσθετε πολυπλοκότητα και θα θυσίαζε τη
ζωντανή αίσθηση, για να «διορθώσει» κόστος **που δεν υπάρχει**.

> 📌 **Το ζήτημα των ~14 FPS είναι υπαρκτό αλλά ΕΚΤΟΣ ΣΚΟΠΟΥ αυτού του ADR**: προϋπάρχει του dock
> (μετριέται με μηδέν αλληλεπίδραση) και ανήκει στο **ADR-040** (αρχιτεκτονική στοίβας καμβάδων).
> Μετρήθηκε σε **dev build**· το πόσο επιμένει σε production παραμένει ανοιχτό. **Το συμπέρασμα του
> §4.3 δεν εξαρτάται από αυτό**: είναι **σύγκριση μέσα στο ίδιο build** (70,8 vs 71,1), οπότε ο
> dev overhead ακυρώνεται στη διαφορά.

### 4.4 ADR-040 — πού **δεν** επιτρέπεται να ζήσει το πλάτος

Το πλάτος αλλάζει ~60 φορές/δευτ. κατά το σύρσιμο. **Απαγορεύεται** να μπει σε store στον οποίο
συνδρομούν οι orchestrators (`CanvasSection`, `CanvasLayerStack`) — θα ξαναρενδάριζε ~426 fibers ανά
pixel (τεκμηριωμένο ADR-040 Φ XXII.B). Το πλάτος ζει στο DOM (η βιβλιοθήκη γράφει `flex-grow`) και
στο store **μόνο** στο τέλος της χειρονομίας.

### 4.5 Το mobile drawer δεν αγγίζεται

`DxfViewerContent.tsx:373` → `layoutMode === 'desktop' ? <SidebarSection/> : <MobileSidebarDrawer/>`.
Το dock system είναι **desktop-only** (`≥1024px`). Σε tablet/mobile τίποτα δεν αλλάζει.

### 4.6 Fullscreen (ADR-241)

Ο `FullscreenOverlay` τυλίγει **μόνο** το `MainContentSection` — άρα σε fullscreen η παλέτα μένει
εκτός. Πρέπει να επιβεβαιωθεί ότι το `Group`/`Panel` δεν καταρρέει όταν το ένα του παιδί φεύγει σε
`position: fixed`. **Δοκίμασέ το ρητά** (§10 Φ1 checklist).

### 4.7 Δομικός περιορισμός της βιβλιοθήκης

> *«Separator elements must be direct DOM children of their parent Group elements.»*

Το σημερινό `<section className="flex flex-1 min-h-0">` (`DxfViewerContent.tsx:368`) γίνεται το
`Group`. Παιδιά του πρέπει να είναι **ακριβώς**: `Panel`(sidebar) · `Separator` · `Panel`(canvas).
Το `FullscreenOverlay` + `Suspense` μπαίνουν **μέσα** στο δεύτερο `Panel`.

---

## 5. Η βιβλιοθήκη: `react-resizable-panels@4.7.2` — τι μας δίνει **δωρεάν**

Ήδη εξάρτηση (MIT ✅ κανόνας N.5 δεν ενεργοποιείται), ήδη σε 3 σελίδες μέσω
`src/components/ui/resizable.tsx`.

### 5.1 ⚠️ API v4 ≠ API v2 — μην αντιγράψεις παλιά docs

| v2 (παλιά docs, παντού στο διαδίκτυο) | **v4.7.2 (αυτό που έχουμε)** |
|---|---|
| `PanelGroup` / `PanelResizeHandle` | **`Group`** / **`Separator`** |
| `direction="horizontal"` | **`orientation="horizontal"`** |
| ποσοστά μόνο | **αριθμός = pixels**, string χωρίς μονάδα = ποσοστό |

### 5.2 Οι ιδιότητες που κάνουν τη διαφορά

| Ιδιότητα | Γιατί την **χρειαζόμαστε** |
|---|---|
| `minSize={280}` / `maxSize={720}` (px) | CAD θέλει **pixel** όρια, όχι ποσοστά |
| `groupResizeBehavior="preserve-pixel-size"` | μεγαλώνει το παράθυρο ⇒ **ο καμβάς** παίρνει τον χώρο, η παλέτα κρατά τα px της. Ακριβώς Revit/VS Code |
| `collapsible` + `collapsedSize` | σύμπτυξη σε λωρίδα με ένα σύρσιμο (VS Code) |
| `Separator` | `role="separator"` + `aria-valuenow/min/max` + **πληκτρολόγιο** (`ArrowLeft/Right`, `Home`, `End`) — επαληθευμένο στο bundle. ⚠️ **ΔΕΝ αρκεί μόνο του** — δες §5.2.1 |
| `onLayoutChanged` | καλείται **μετά** την απελευθέρωση του δείκτη ⇒ **μία** εγγραφή ανά χειρονομία. Ίδιο δόγμα με το `onResizeEnd` του ADR-723 |
| `Panel.onResize(size)` | δίνει **και px και %** ⇒ αποθηκεύουμε px |

### 5.2.1 ⚠️ ΤΟ ΠΛΗΚΤΡΟΛΟΓΙΟ ΔΕΝ ΗΤΑΝ ΔΩΡΕΑΝ — η ιδιοκτησία του πλήκτρου είναι δική μας

Μετρημένο ζωντανά (Φ1, 3.107 οντότητες), με **πραγματικά** πλήκτρα και `document.activeElement`
επιβεβαιωμένα στο `DIV[role=separator]`:

| | Πριν τη διόρθωση | Μετά |
|---|---|---|
| Πλάτος μετά από `ArrowLeft` | **670 → 670** (τίποτα) | **604 → 487** ✅ |
| `offsetX` του καμβά | **+80px/πάτημα** (πάναρε το σχέδιο) | αλλάζει **μόνο** ως αντιστάθμιση §4.1 ✅ |

**Η αιτία δεν ήταν το splitter — ήταν η σειρά των φάσεων του DOM.** Ο handler της βιβλιοθήκης
(`Te`) είναι **element-level, φάση bubble**, και ξεκινά με `if (e.defaultPrevented) return;`. Οι
global accelerators του viewer τρέχουν σε **window capture** — πρώτοι. Ο ένας τους
(`useKeyboardShortcuts`, `PAN_STEP = 80`) έκανε pan **και** `preventDefault()`. Άρα **ένα** σφάλμα
παρήγαγε **δύο** συμπτώματα: το πλάτος δεν άλλαζε *και* το σχέδιο έφευγε.

**Η διόρθωση ζει στον ΕΝΑΝ φύλακα ιδιοκτησίας πλήκτρων** (`src/lib/a11y/keyboard-scope.ts`,
ADR-711/ADR-364), **όχι** εδώ. Το ADR-711 είχε **δύο** ονομασμένες ερωτήσεις — «γράφει κείμενο;»
και «θα καταναλώσει τον **χαρακτήρα**;». Καμία δεν κάλυπτε τα **βέλη**: το ίδιο του το σχόλιο
σημείωνε ρητά ότι `slider`/`radio`/`tab`/`grid` «πλοηγούνται με βέλη» αλλά τα **εξαιρούσε**, γιατί
δεν υπήρχε ερώτηση να τα στεγάσει. Προστέθηκε η **τρίτη**:

```
3. «Θα καταναλώσει το ΠΛΗΚΤΡΟ ΠΛΟΗΓΗΣΗΣ;» → consumesDirectionalKeys()
   = ερώτηση 2  +  ARROW_NAVIGATION_ROLES (separator, slider, scrollbar, radio*, tab*, grid*)
```

Το **πλήκτρο** επιλέγει την ερώτηση: πλοηγικό ⇒ ερώτηση 3· οτιδήποτε άλλο ⇒ ερώτηση 2. Έτσι με
εστίαση στο διαχωριστικό τα **βέλη** ανήκουν στο splitter, ενώ το «Z»/«L» φτάνουν κανονικά στον
viewer. Ένα ενιαίο πλατύτερο predicate θα σκότωνε τους accelerators γραμμάτων — παλινδρόμηση, όχι
διόρθωση.

⛔ **Καμία τοπική άμυνα στο `WorkspaceSplitLayout`.** Ένα `stopPropagation` στο διαχωριστικό δεν θα
έλυνε τίποτα: ο accelerator έχει **ήδη τρέξει** (capture) πριν το συμβάν φτάσει στο element.

### 5.3 ⛔ ΜΗΝ χρησιμοποιήσεις `useDefaultLayout`

Η βιβλιοθήκη προσφέρει `useDefaultLayout({ storage })` για persistence. **Το απορρίπτουμε**: θα
γινόταν **δεύτερος ιδιοκτήτης** του πλάτους, δίπλα στο δικό μας store — δηλαδή δύο αλήθειες τη
στιγμή της επαναφοράς. Ακριβώς το σχήμα που παράγει «η παλέτα πήδηξε πίσω» (το ίδιο λάθος που
απέφυγε ρητά το ADR-723 §useFloatingPanelGeometry). **Ένας** κάτοχος: το δικό μας store, μέσω
`defaultSize` (ανάγνωση) + `onResize`/`onLayoutChanged` (εγγραφή).

Επιπλέον, το `Layout` της βιβλιοθήκης είναι `{ [panelId]: number }` σε **ποσοστά** — μια
αποθηκευμένη διάταξη 25% δίνει άλλο πλάτος σε άλλη οθόνη. Τα CAD θυμούνται **px**.

---

## 6. Η αρχιτεκτονική

### 6.1 Δύο μηχανισμοί, **ένα** SSoT κατάστασης

Αγκυρωμένο και αιωρούμενο είναι **γεωμετρικά διαφορετικά προβλήματα** (μέσα στη ροή vs
`position: fixed`). Ένα ενιαίο engine θα ήταν χειρότερο και από τα δύο. Άρα:

```
                    ┌──────────────────────────────────────┐
                    │   workspace-dock-store  (ΤΟ SSoT)    │
                    │   { mode, dockedWidth }              │
                    └───────────┬──────────────┬───────────┘
                     mode=docked│              │mode=floating
                                ▼              ▼
              react-resizable-panels    ADR-723 FloatingPanel
              Group/Panel/Separator     useFloatingPanelGeometry
              (px, a11y, keyboard)      (drag, 8 λαβές, clamp)
              ↑ πλάτος                  ↑ {x,y,w,h}
              persist: το store μας     persist: ADR-723 v1 key
```

**Γιατί δύο κλειδιά persistence και όχι ένα**: τα πεδία **δεν επικαλύπτονται**. Το store μας κατέχει
«σε ποια λειτουργία είμαι + πόσο πλατιά είμαι όταν είμαι αγκυρωμένη». Το ADR-723 κατέχει «πού και
πόσο μεγάλη είμαι όταν αιωρούμαι» — και το κάνει ήδη σωστά (clamp σε κάθε ανάγνωση, διάσωση από
χαμένη-εκτός-οθόνης). Δεύτερη υλοποίηση του ίδιου clamp θα ήταν **διπλότυπο** (N.18/jscpd).

### 6.2 Νέα αρχεία

| Αρχείο | Ρόλος | Όριο |
|---|---|---|
| `systems/workspace/workspace-dock-geometry.ts` | **Καθαρές συναρτήσεις**, μηδέν React/DOM: `clampDockWidth`, `dockToFloatGeometry`, `floatToDockWidth`, `resolveDropTarget`. Πλήρως ελέγξιμο με jest χωρίς jsdom (καθρέφτης του `floating-panel-geometry.ts`) | ~150 |
| `systems/workspace/workspace-dock-store.ts` | Imperative store (zero React state) + persistence πάνω από `@/lib/storage`· `subscribe`/`getSnapshot` για **leaf** χρήση | ~120 |
| `systems/workspace/useWorkspaceDock.ts` | Το leaf hook (`useSyncExternalStore`) — **ΜΟΝΟ** σε components που επιτρέπεται να ξαναρενδάρουν | ~40 |
| `layout/WorkspaceSplitLayout.tsx` | Ο **μοναδικός** τόπος στο subapp που γνωρίζει `react-resizable-panels`. Σειρά παιδιών ανά `mode` | ~150 |
| `layout/WorkspaceDockMenu.tsx` | «Αγκύρωση αριστερά / δεξιά / Αιωρούμενο / Επαναφορά» | ~90 |

### 6.3 Τροποποιούμενα

| Αρχείο | Αλλαγή | Προσοχή |
|---|---|---|
| `layout/SidebarSection.tsx` | αφαίρεση `MIN/MAX_WIDTH`· `variant: 'inline' \| 'drawer' \| 'floating'` | το `w-96` γίνεται προεπιλογή του Panel, όχι κλείδωμα |
| `app/DxfViewerContent.tsx:368-399` | το `<section>` → `WorkspaceSplitLayout` | §4.7 direct-child |
| `hooks/canvas/useViewportManager.ts` | αντιστάθμιση `offsetX` (§4.1) | **ADR-040 staged** (CHECK 6B) |
| `config/panel-tokens.ts` | νέα `WORKSPACE_DOCK` όρια | τα `SIDEBAR_MIN/MAX_WIDTH` **μένουν** (τα χρησιμοποιεί το drawer) |
| `i18n/locales/{el,en}/dxf-viewer-shell.json` | `workspaceDock.*` | **πρώτα τα κλειδιά, μετά ο κώδικας** (N.11) |

### 6.4 Οι τιμές

| Σταθερά | Τιμή | Αιτιολόγηση |
|---|---|---|
| `DOCK_WIDTH_DEFAULT` | **384** | το σημερινό ⇒ **μηδενική οπτική αλλαγή** στην πρώτη φόρτωση |
| `DOCK_WIDTH_MIN` | **280** | ίδιο με `DEFAULT_MIN_PANEL_SIZE.width` του ADR-723 — **μία** έννοια «στενότερο λειτουργικό πλάτος» σε όλη την εφαρμογή |
| `DOCK_WIDTH_MAX` | **720** | πάνω από αυτό ο καμβάς παύει να είναι ο πρωταγωνιστής |
| `CANVAS_MIN_WIDTH` | **320** | ο καμβάς **ποτέ** κάτω από αυτό· υπερισχύει του `DOCK_WIDTH_MAX` σε στενές οθόνες |

---

## 7. Ο κανόνας μετάβασης (το κομμάτι που ξεχνιέται)

Ζει **αποκλειστικά** στο `workspace-dock-geometry.ts`, ως καθαρές συναρτήσεις:

| Μετάβαση | Κανόνας |
|---|---|
| **docked → floating** | Αν υπάρχει αποθηκευμένη floating γεωμετρία (ADR-723) ⇒ **αυτή νικά** (επιστρέφει εκεί που την άφησες — συμπεριφορά Revit). Αλλιώς: `{x,y,w,h}` = το **τρέχον** rect της αγκυρωμένης παλέτας, ελαφρώς μετατοπισμένο ⇒ η μετάβαση φαίνεται **φυσική**, όχι τηλεμεταφορά |
| **floating → docked** | `dockedWidth = clampDockWidth(floatingWidth)`· η πλευρά προκύπτει από το **πού αφέθηκε** (§7.1) |
| **αλλαγή πλευράς** | το `dockedWidth` **δεν** αλλάζει |
| **επαναφορά** | `clearPanelGeometry()` (ADR-723) + `DOCK_WIDTH_DEFAULT` + `docked-left` = «Reset palette locations» του AutoCAD |

### 7.1 Πού «πέφτει» η παλέτα (κανόνας Revit)

Κατά το σύρσιμο μιας **αιωρούμενης** παλέτας, αν ο δείκτης μπει σε ζώνη **64px** από την αριστερή ή
δεξιά ακμή του χώρου εργασίας ⇒ εμφανίζεται **περίγραμμα-προεπισκόπηση** της αγκύρωσης· στο
`pointerup` αγκυρώνει. Αλλιώς μένει αιωρούμενη. Καθαρή συνάρτηση: `resolveDropTarget(pointerX, rect)`.

---

## 8. Χειρονομίες & προσβασιμότητα

| Χειρονομία | Αποτέλεσμα | Πηγή |
|---|---|---|
| Σύρσιμο διαχωριστικού | αλλαγή πλάτους, live | κλάδος |
| **Διπλό κλικ διαχωριστικού** | επαναφορά στο **`defaultSize`** του panel — δηλαδή στο πλάτος με το οποίο **άνοιξε η συνεδρία** (το αποθηκευμένο), όχι στο `DOCK_WIDTH_DEFAULT` | VS Code / Sublime / Atom |
| **Διπλό κλικ επικεφαλίδας** | dock ⇄ float | **Revit** |
| `ArrowLeft/Right`, `Home`, `End` στο διαχωριστικό | αλλαγή πλάτους από πληκτρολόγιο | βιβλιοθήκη **+ ο φύλακας ιδιοκτησίας πλήκτρων** (§5.2.1)· το VS Code ΔΕΝ το έχει |
| Δεξί κλικ επικεφαλίδας | μενού: αριστερά / δεξιά / αιωρούμενο / επαναφορά | Revit / C4D |

⚠️ Το πληκτρολόγιο **δεν** πρέπει να συγκρουστεί με τον Escape bus / `keyboard-scope` (ADR-364 /
ADR-711): το διαχωριστικό είναι εστιάσιμο στοιχείο — τα βελάκια το αφορούν **μόνο όσο έχει εστίαση**.

### 8.1 ⚠️ ΔΙΟΡΘΩΣΗ ΤΗΣ ΕΡΕΥΝΑΣ (Φ1) — το διπλό κλικ **ανήκει ήδη στη βιβλιοθήκη**

Η αρχική γραφή αυτού του πίνακα υπέθετε ότι το διπλό κλικ θα το υλοποιούσαμε εμείς. **Δεν
ισχύει.** Το `react-resizable-panels@4` εγγράφει δικό του listener `dblclick` σε **capture**
φάση στο `document`, που επαναφέρει το panel στο `defaultSize` του και κάνει `preventDefault()`.

Συνέπειες που **δεν** ήταν προφανείς πριν από τον κώδικα:

1. **Δεν μπορεί να ακυρωθεί από εμάς.** Capture στο `document` σημαίνει ότι τρέχει **πριν** από
   οποιονδήποτε React handler (bubble στο root). Ένα δικό μας `resize()` θα ήταν **δεύτερος
   ιδιοκτήτης**: το panel θα άλλαζε μέγεθος **δύο φορές** ανά διπλό κλικ.
2. **Το `defaultSize` έχει διπλή σημασία by design**: αρχικό πλάτος **και** στόχος του διπλού
   κλικ. Επειδή του δίνουμε το αποθηκευμένο πλάτος, η χειρονομία σημαίνει «επαναφορά στο
   αποθηκευμένο μου» (*revert to saved*, τύπου Photoshop) — **όχι** «επιστροφή στο 384».
3. Άρα ο ρόλος μας περιορίζεται στο να **ακολουθήσει** το store ό,τι εφάρμοσε η βιβλιοθήκη
   (σημείωση πρόθεσης χρήστη ⇒ εγγραφή στο `onLayoutChanged`). Κανένας δεύτερος μηχανισμός.

Το «επαναφορά στο `DOCK_WIDTH_DEFAULT`» παραμένει επιθυμητό ως **ρητή εντολή μενού**
(«Επαναφορά», §7) — δηλαδή **Φ2**, μαζί με τον πρώτο πραγματικό καλούντα της.

---

## 9. Πάνω από τον κλάδο (τι **δεν** κάνει κανείς τους)

### 9.1 Container queries στο περιεχόμενο της παλέτας — **η πραγματικά προηγμένη ιδέα**

Σε Revit/ArchiCAD/C4D, όταν στενεύεις μια παλέτα το περιεχόμενο απλώς **κόβεται ή κυλά**. Με
`container-type: inline-size` στο `<aside>` και `@container` κανόνες, το περιεχόμενο **προσαρμόζεται
στο δικό του πλάτος** (όχι του viewport):

- `< 320px` → οι καρτέλες γίνονται **μόνο εικονίδια**
- `320–520px` → η σημερινή μονόστηλη μορφή
- `> 520px` → οι λίστες ιδιοτήτων σε **δύο στήλες**

Αυτό είναι το αναγνωρισμένο killer use case των container queries και έχει **καθολική** υποστήριξη
browser από το 2026. ⚠️ Tailwind **v3.4** εδώ ⇒ δεν υπάρχει built-in `@container`. **Πρώτη επιλογή:
σκέτο CSS** στο υπάρχον stylesheet του subapp — **μηδέν νέα εξάρτηση** (ο N.5 δεν ενεργοποιείται).
Το `@tailwindcss/container-queries` (MIT) είναι εφεδρεία, όχι προτίμηση.

### 9.2 View Transitions για τη μετάβαση dock ⇄ float

`document.startViewTransition()` με κοινό `view-transition-name` ⇒ η παλέτα **μεταμορφώνεται**
αντί να εξαφανίζεται και να εμφανίζεται αλλού. Καμία CAD εφαρμογή δεν το κάνει (είναι native
δυνατότητα browser). Progressive enhancement: όπου δεν υποστηρίζεται, απλή εναλλαγή.
⚠️ **Υποχρεωτικός** φύλακας `prefers-reduced-motion` — υπάρχει ήδη πρότυπο στο
`bim-3d/accessibility/use-reduced-motion.ts` (αν χρειαστεί σε κοινό επίπεδο, **μετακόμισε** το, μην
το αντιγράψεις — N.18).

### 9.3 Διπλό κλικ = «βέλτιστο πλάτος»

Το VS Code κάνει reset· Sublime/Atom υπολογίζουν το **ελάχιστο πλάτος που χωρά όλο το περιεχόμενο**
(`scrollWidth` του περιεχομένου, clamped). Το δεύτερο είναι σαφώς καλύτερο και μετρήσιμο.

**Ιεράρχηση:** το §9 είναι **Φάση 4**. Δεν μπαίνει τίποτα από αυτά πριν δουλέψουν σωστά τα §5–§7.

---

## 10. Σχέδιο υλοποίησης (φάσεις — κάθε μία αποστέλλεται μόνη της)

### Φ0 — Θεμέλια (καμία οπτική αλλαγή)
1. i18n κλειδιά `workspaceDock.*` σε **el + en** (N.11: πρώτα τα κλειδιά).
2. `workspace-dock-geometry.ts` + jest suite (καθαρές συναρτήσεις, χωρίς jsdom).
3. `workspace-dock-store.ts` + persistence + jest.
4. Σταθερές στο `panel-tokens.ts`.
> **Έξοδος**: πράσινα tests, μηδέν αλλαγή στο UI.

### Φ1 — Αγκυρωμένη αριστερά, **με αλλαγή πλάτους** ← *το 80% της αξίας*
1. `WorkspaceSplitLayout.tsx` (Group / Panel / Separator, px όρια, `preserve-pixel-size`).
2. Ξεκλείδωμα `SidebarSection` (αφαίρεση `MIN/MAX`).
3. Σύνδεση στο `DxfViewerContent` (§4.7 direct-child).
4. Αντιστάθμιση `offsetX` στο `useViewportManager` (§4.1) — **ADR-040 staged**.
5. **Μέτρηση** FPS κατά το σύρσιμο με `47_ergasia.dxf` (3.107 στοιχεία) ⇒ απόφαση §4.3.
6. Έλεγχος: fullscreen (§4.6), mobile drawer (§4.5), 3D viewport, χάρακες, crosshair, hit-test.
> **Έξοδος**: ο Giorgio σέρνει το διαχωριστικό και οι δύο καμβάδες ακολουθούν.

### Φ2 — Αγκύρωση δεξιά
Αντιστροφή σειράς παιδιών + μενού + persistence. Μικρή, χαμηλού ρίσκου.

### Φ3 — Αιωρούμενη
`FloatingPanel` (ADR-723) με `resizable` + `persistenceKey="dxf.workspace-sidebar"` + κανόνες
μετάβασης §7 + drop zones §7.1 + z-index `dxfZIndex.overlays.sidebar`.

### Φ4 — Πάνω από τον κλάδο
§9.1 container queries → §9.3 βέλτιστο πλάτος → §9.2 view transitions.

---

## 11. Ανοιχτά ερωτήματα (ειλικρινώς: δεν τα ξέρω ακόμη)

1. **Απόδοση §4.3 — ✅ ΕΚΛΕΙΣΕ (2026-07-28), με μέτρηση.** Η στρατηγική **(1) live + rAF
   coalescing** επαληθεύτηκε **επαρκής**: το σύρσιμο κοστίζει ~0 (70,8 ms vs 71,1 ms σε ηρεμία).
   Η (2)/(3) **δεν** υλοποιείται. Πλήρη νούμερα και μεθοδολογία: **§4.3.1**.
   ➜ Αυτό που **έμεινε ανοιχτό** είναι άλλο ερώτημα, **εκτός ADR-724**: ο viewer τρέχει στα ~14 FPS
   ακόμη και σε πλήρη ηρεμία (μηδέν `longtask`· κόστος γραμμικό στο πλήθος των στοιβαγμένων
   καμβάδων). Ανήκει στο **ADR-040**, μετρήθηκε σε dev build.
2. **Fullscreen × Group** (§4.6) — ✅ **ΑΠΑΝΤΗΘΗΚΕ ΣΤΗ Φ1, δομικά.** Ο `FullscreenOverlay`
   (`src/core/containers/FullscreenOverlay.tsx:149`) κάνει `createPortal` στο `document.body`:
   μετακινείται το **περιεχόμενο** του δεύτερου panel, **όχι** το panel. Άρα τα άμεσα παιδιά του
   `Group` παραμένουν `Panel · Separator · Panel` σε **κάθε** κατάσταση — ο περιορισμός §4.7 δεν
   μπορεί να παραβιαστεί από το fullscreen. Καλύπτεται από test (§14). Παραμένει σκόπιμο ένα
   οπτικό πέρασμα, αλλά το δομικό ρίσκο έκλεισε.
3. **Πλάτος ανά λειτουργία;** Ο χρήστης ίσως θέλει διαφορετικό πλάτος ανά καρτέλα (Επίπεδα στενή,
   Ιδιότητες πλατιά). Το Revit **δεν** το κάνει. Προτείνω **όχι** — αλλά είναι απόφαση του Giorgio.
4. **Ανά χρήστη ή ανά έργο;** Το ADR-723 απάντησε **ανά χρήστη** (localStorage) με τεκμηρίωση
   (Revit/AutoCAD/Photoshop αποθηκεύουν διάταξη στο προφίλ, ποτέ στο αρχείο). Το ίδιο εδώ, εκτός αν
   ο Giorgio θέλει «Work Environment profiles» τύπου ArchiCAD (μελλοντικό ADR).
5. **Σχόλιο τεκμηρίωσης προς έλεγχο**: το `floating-panel-geometry.ts:59` αποδίδει το «Minimum
   Visible Header» στο **ADR-030**, αλλά το `ADR-030-unified-frame-scheduler.md` αφορά άλλο θέμα.
   Πιθανό λάθος παραπομπής του ADR-723 — να επαληθευτεί και να διορθωθεί (χαμηλή προτεραιότητα).

---

## 12. Πύλες (gates) που πρέπει να περάσουν

| Πύλη | Τι απαιτεί |
|---|---|
| **ADR-040 CHECK 6B/6D** | αγγίζοντας `useViewportManager` / canvas ⇒ **υποχρεωτικά staged το ADR-040** αλλιώς μπλοκάρει το commit |
| **N.11 / CHECK 3.8** | κάθε νέο `t('…')` έχει κλειδί σε **el + en** πριν τον κώδικα |
| **N.7.1** | κανένα αρχείο >500 γρ., καμία συνάρτηση >40 γρ. |
| **N.3** | καμία inline style — **εξαίρεση** η δυναμική γεωμετρία (προηγούμενο ADR-723) |
| **N.18 / CHECK 3.28** | `npm run jscpd:diff <staged>` πριν πεις «τελείωσα». Ο κίνδυνος εδώ είναι **αντιγραφή του clamp** του ADR-723 |
| **N.17** | ❌ **κανένα `tsc`** από τον πράκτορα |
| **N.(-1)** | ❌ **κανένα commit/push** χωρίς εντολή Giorgio |
| **N.2 / N.5** | μηδέν `any`· καμία νέα εξάρτηση (η μόνη υποψήφια, `@tailwindcss/container-queries`, είναι MIT αλλά **αποφεύγεται**) |

---

## 13. Απόφαση

**Υιοθετούμε το μοντέλο τριών λειτουργιών** (`docked-left` / `docked-right` / `floating`) με
**δύο μηχανισμούς και ένα SSoT κατάστασης**:

- **αγκυρωμένη** → `react-resizable-panels@4.7.2` (υπάρχουσα MIT εξάρτηση· px όρια· WAI-ARIA
  splitter με πληκτρολόγιο· `preserve-pixel-size`),
- **αιωρούμενη** → `FloatingPanel` / `useFloatingPanelGeometry` (ADR-723, αναλλοίωτο),
- **κατάσταση** → `workspace-dock-store` (ένας κάτοχος· `useDefaultLayout` απορρίπτεται ρητά).

Οι καμβάδες **δεν χρειάζονται νέα υποδομή** — ο `ResizeObserver` τους είναι ήδη σωστός. Χρειάζονται
**έναν** νέο κανόνα: αντιστάθμιση `offsetX` (§4.1), ώστε η αριστερή αγκύρωση να είναι οπτικά τόσο
σταθερή όσο η δεξιά.

---

## 14. Changelog

| Ημ/νία | Αλλαγή |
|---|---|
| 2026-07-28 (γ) | **Φ1 ΔΙΟΡΘΩΣΕΙΣ μετά από ζωντανή επαλήθευση.** Βλ. §14.2 |
| 2026-07-28 (β) | **Φ0 + Φ1 IMPLEMENTED.** Βλ. αναλυτικά §14.1 παρακάτω |
| 2026-07-28 | **Δημιουργία** — SSoT audit (grep) + έρευνα κλάδου. Κατάσταση: **RESEARCHED, NOT IMPLEMENTED**. Ευρήματα: (α) το μόνο εμπόδιο είναι `min=max=384` στο `SidebarSection.tsx:56-60`· (β) και οι δύο καμβάδες ακολουθούν **ήδη** αυτόματα· (γ) δύο **νεκρά** συστήματα docking (`CadDock`+ακατάστατο `dockview`, `ToolbarsContext`) — να μην αναστηθούν· (δ) το `react-resizable-panels` v4 δίνει px όρια + keyboard splitter δωρεάν· (ε) ο κανόνας αγκύρωσης του 2D υπάρχει για το **ύψος** και λείπει για το **πλάτος** |

### 14.1 Φ0 + Φ1 — τι απεστάλη (2026-07-28)

**Νέα αρχεία**

| Αρχείο | Ρόλος | Γρ. |
|---|---|---|
| `systems/workspace/workspace-dock-geometry.ts` | `clampDockWidth` / `parseDockWidth` — καθαρές, μηδέν React/DOM | 55 |
| `systems/workspace/workspace-dock-store.ts` | Ο **ένας** κάτοχος του αποθηκευμένου πλάτους | 82 |
| `layout/WorkspaceSplitLayout.tsx` | Ο μοναδικός τόπος του subapp που ξέρει από split panes | ~175 |
| `systems/workspace/__tests__/*` (2) | 39 tests | — |
| `layout/__tests__/WorkspaceSplitLayout.test.tsx` | 8 tests (δομή §4.7, a11y, split=false passthrough) | — |
| `hooks/canvas/__tests__/anchor-transform-on-resize.test.ts` | 15 tests (§4.1) | — |

**Τροποποιημένα**: `SidebarSection.tsx` (ξεκλείδωμα πλάτους) · `MobileSidebarDrawer.tsx` ·
`app/DxfViewerContent.tsx` (σύνδεση) · `hooks/canvas/useViewportManager.ts` (§4.1 + ενοποίηση
3 μετρήσεων) · `config/panel-tokens.ts` (`WORKSPACE_DOCK`) · `utils/storage-utils.ts` (κλειδί) ·
`components/ui/resizable.tsx` (re-export τύπου) · `i18n/locales/{el,en}/dxf-viewer-shell.json`
(`workspaceDock.*`) · **`ADR-040` changelog** (CHECK 6B/6D).
**Σύνολο: 62 tests πράσινα. jscpd (N.18): καθαρό στα 10 αρχεία.**

**Πέντε σημεία όπου η υλοποίηση ΔΙΑΦΩΝΗΣΕ με την έρευνα** (ο κώδικας είναι η αλήθεια, N.0.1):

1. **Το `mode` ΔΕΝ μπήκε στο store** (§6.1 το προέβλεπε). Στη Φ1 έχει **μία** δυνατή τιμή
   (`docked-left`) — πεδίο με μία τιμή είναι νεκρός κώδικας, όχι αρχιτεκτονική. Μπαίνει στη Φ2
   μαζί με τον πρώτο αναγνώστη του. Το store της Φ1 είναι **σκέτο πλάτος**.
2. **Το διπλό κλικ ανήκει στη βιβλιοθήκη** — βλ. §8.1. Ακυρώνει τη γραμμή «επαναφορά στο
   `DOCK_WIDTH_DEFAULT`» του §8 **και** το `resetDockedWidth` που είχε προγραμματιστεί.
3. **Το `CANVAS_MIN_WIDTH` ΔΕΝ επιβάλλεται στο `workspace-dock-geometry`** (§6.2 το υπαινισσόταν)
   αλλά ως `minSize` στο **panel του καμβά**: εκεί είναι το μόνο σημείο που γνωρίζει το
   διαθέσιμο πλάτος τη στιγμή του συρσίματος. Το store δεν βλέπει viewport — αν το αντέγραφε,
   θα διαφωνούσαν σε κάθε αλλαγή μεγέθους παραθύρου.
4. **Το `SidebarSection.variant` ΑΦΑΙΡΕΘΗΚΕ** (§6.3 προέβλεπε επέκτασή του σε `'floating'`).
   Μετά την απελευθέρωση του πλάτους, οι κλάδοι `inline`/`drawer` παρήγαγαν **ταυτόσημο**
   markup ⇒ διακόπτης που δεν ανάβει τίποτα. Επιστρέφει στη Φ3, όταν αποκτήσει νόημα.
5. **Το subapp ΔΕΝ εισάγει το `react-resizable-panels`** (§6.2 έλεγε «ο μοναδικός τόπος που
   γνωρίζει τη βιβλιοθήκη»). Περνά από το **υπάρχον** shadcn wrapper
   `@/components/ui/resizable` — ήδη σε 3 σελίδες. Ένα σημείο επαφής σε **ολόκληρη** την
   εφαρμογή αντί για δύο.

**Δύο ευρήματα προς μελλοντική εργασία (δεν αγγίχτηκαν — 3 άλλες σελίδες τα χρησιμοποιούν):**

- `src/components/ui/resizable.tsx` περιέχει **νεκρούς v2 selectors**: το
  `[&[data-resize-handle-active]]:bg-ring` και τα `data-[panel-group-direction=vertical]:*`
  **δεν αντιστοιχούν σε τίποτα στην v4** — η v4 εκπέμπει `data-separator` με τιμές
  `inactive` / `hover` / `active` / `disabled` και `data-group`. Δηλαδή οι 3 υπάρχουσες σελίδες
  **δεν έχουν οπτική ένδειξη ενεργού συρσίματος** και το νομίζουν. Το `WorkspaceSplitLayout`
  παρακάμπτει με σωστούς v4 selectors στο δικό του className.
- `layout/CadDock.tsx` παραμένει **νεκρό + σπασμένο** (`import 'dockview'`, μη εγκατεστημένο) —
  §2.3. Προτείνεται διαγραφή σε **ξεχωριστό** commit.

---

### 14.2 Φ1 — διορθώσεις μετά τη ζωντανή επαλήθευση (2026-07-28 γ)

Η Φ1 απεστάλη με **62 πράσινα tests** και **δύο πραγματικά ελαττώματα** που κανένα test δεν έπιασε.
Και τα δύο ήταν αόρατα σε jsdom (δεν κάνει διάταξη, δεν εκτελεί φάσεις πληκτρολογίου).

| # | Ελάττωμα | Ρίζα | Διόρθωση |
|---|---|---|---|
| **Ε1** | «σύρσιμο στα 10 FPS» | **δεν ήταν ελάττωμα** — έλειπε η ομάδα ελέγχου· η ηρεμία μετρά τα ίδια | καμία· §4.3.1 τεκμηριώνει γιατί η (2) **δεν** μπαίνει |
| **Ε2** | βέλη: πλάτος 670→670 **και** το σχέδιο πάναρε 80px | window **capture** accelerator πριν τον **bubble** handler της βιβλιοθήκης (`defaultPrevented`) | **τρίτη ερώτηση** στον φύλακα ADR-711 (§5.2.1) |
| **Ε3** *(νέο — βρέθηκε κατά την επαλήθευση του Ε2)* | το αποθηκευμένο πλάτος ήταν **ένα βήμα πίσω** (DOM 487,2 · store 604) | το `onLayoutChanged` καλείται **πριν** εφαρμοστεί η διάταξη ⇒ **και** το `onResize` ref **και** το DOM είναι μπαγιάτικα | η εγγραφή αναβάλλεται **ένα καρέ** (`requestAnimationFrame`), μετά διαβάζεται το DOM |

> **Γιατί το Ε3 κρυβόταν**: στο **σύρσιμο** το `onResize` έχει ήδη τρέξει ~60 φορές πριν σηκωθεί ο
> δείκτης, οπότε η «προηγούμενη» τιμή τύχαινε να είναι η σωστή. Μόνο το **πληκτρολόγιο** — μία
> διακριτή αλλαγή ανά πάτημα — το εμφάνισε γυμνό. Δηλαδή **η διόρθωση του Ε2 αποκάλυψε το Ε3**.

**Τι επαληθεύτηκε ζωντανά** (Chrome, `47_ergasia.dxf`, 3.107 οντότητες, πραγματικά πλήκτρα):

| Έλεγχος (§10 Φ1 checklist) | Απόδειξη |
|---|---|
| Πλήκτρα αλλάζουν πλάτος | 408→280, 604→487, 487→604, 720→604 ✅ |
| Το σχέδιο **δεν** πανάρει | `canvasLeft + offsetX` = **1114,58 → 1114,17** (μόνο στρογγυλοποίηση) |
| **§4.1 + hit-test + crosshair + χάρακες** | ίδιο σημείο **οθόνης** πριν/μετά resize ⇒ world **ταυτόσημο**: `X: 240,3927, Y: 293,2950 m` |
| Αποθήκευση | store == DOM (720 == 720) ✅ |
| **Διπλό κλικ** | 720 → **487,2** = το πλάτος έναρξης συνεδρίας ⇒ επιβεβαιώνει το §8.1 *revert-to-saved* |
| **3D viewport** | 13 → **15** καμβάδες· όλοι ακολουθούν το νέο πλάτος (`1841`)· το ViewCube 160×160 μένει σταθερό **by design** |
| **Fullscreen** (§4.6) | παιδιά του `Group` παραμένουν `panel·separator·panel`· η παλέτα μένει εκτός overlay· οπτικά καθαρό |
| **Mobile drawer** (§4.5) | ⚠️ **ΔΕΝ επαληθεύτηκε ζωντανά** — το `resize_window` δεν μεταβάλλει το `innerWidth` (μένει 2400 ενώ `outerWidth`=1920). Καλύπτεται από 2 jest tests (`split={false}` ⇒ fragment passthrough, μηδέν separator) και από τον ρητό κλάδο `split={layoutMode === 'desktop'}` |

**Τι άλλαξε στον κώδικα**

| Αρχείο | Αλλαγή |
|---|---|
| `src/lib/a11y/keyboard-scope.ts` | **+ ερώτηση 3**: `ARROW_NAVIGATION_ROLES`, `DIRECTIONAL_KEYS`, `isDirectionalKey`, `consumesDirectionalKeys`, `focusConsumesDirectionalKeys`· το `shouldGlobalShortcutYield` δέχεται πλέον **και** το `key` |
| `layout/WorkspaceSplitLayout.tsx` | αναβολή εγγραφής ένα καρέ + `elementRef` + cleanup· τεκμηρίωση της εξάρτησης από τον φύλακα |
| `__tests__/keyboard-scope.test.ts` | **40 → 81** tests |
| `__tests__/WorkspaceSplitLayout.test.tsx` | **8 → 11**· το παραπλανητικό test ξαναγράφτηκε (βλ. κάτω) |

**Το test που ήταν ψέμα.** Υπήρχε test με όνομα *«αλλαγή πλάτους από πληκτρολόγιο (το VS Code ΔΕΝ
το έχει)»* που έλεγχε **μόνο** `tabIndex === 0`. Ήταν **πράσινο πάνω σε εντελώς νεκρή δυνατότητα**.
Η εστιασιμότητα δεν αποδεικνύει ιδιοκτησία πλήκτρου. Αντικαταστάθηκε από τρία tests που ελέγχουν το
**πραγματικό** συμβόλαιο: ο accelerator **παραιτείται** στα βέλη, **δεν** παραιτείται στα γράμματα,
και το διαχωριστικό είναι εστιάσιμο (ξεχωριστός, ειλικρινής ισχυρισμός).

## 15. Πηγές

- [Revit — Dockable Windows (Autodesk Help)](https://help.autodesk.com/cloudhelp/2023/ENU/Revit-GetStarted/files/GUID-2FCA3097-36CC-4EED-B6BB-BAF431EC9475.htm)
- [Revit — Video: Dockable Windows](https://help.autodesk.com/view/RVT/2024/ENU/?guid=GUID-DAEAAE9B-EEC0-4948-9E42-C573B6DFDE18)
- [VS Code — Custom Layout](https://code.visualstudio.com/docs/configure/custom-layout)
- [VS Code issue #4660 — double-click border to optimal width](https://github.com/Microsoft/vscode/issues/4660)
- [VS Code issue #300121 — keyboard shortcut to resize secondary sidebar](https://github.com/microsoft/vscode/issues/300121)
- [react-resizable-panels (MIT)](https://github.com/bvaughn/react-resizable-panels)
- [MDN — CSS container queries](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Containment/Container_queries)
- [Container queries in 2026: powerful, but not a silver bullet — LogRocket](https://blog.logrocket.com/container-queries-2026/)
- [MDN — View Transition API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API)
