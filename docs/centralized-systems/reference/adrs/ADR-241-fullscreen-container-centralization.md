# ADR-241: Fullscreen — Composition Architecture

## Status: ✅ IMPLEMENTED (2026-03-18) | REFACTORED (2026-03-18) | ✅ ΕΠΙΦΑΝΕΙΑ (2026-09-11 — σταθερός ξενιστής · ιδιοκτησία Escape · focus · `inert`)

## Context

Η εφαρμογή είχε **6 διαφορετικές fullscreen υλοποιήσεις** σε 6 αρχεία χωρίς κοινό pattern. Κάθε component έγραφε το δικό του boilerplate:

- State management (`isFullscreen` / `setIsFullscreen`)
- Escape key handler (addEventListener / removeEventListener)
- Toggle button με icon swap
- CSS positioning (fixed / absolute / portal)

### Αρχικό πρόβλημα (v1)

| Πρόβλημα | Αντίκτυπο |
|----------|-----------|
| **Duplicated code** | ~155 γραμμές boilerplate σε 6 αρχεία |
| **Inconsistent UX** | Κάποια components δεν είχαν Escape handler, κάποια δεν είχαν close button |
| **Maintenance burden** | Κάθε bug fix (π.χ. body scroll lock) έπρεπε να γίνει σε 6 σημεία |
| **No accessibility** | Κανένα component δεν χρησιμοποιούσε semantic HTML ή ARIA attributes |

### Πρόβλημα v1 → v2 refactor

Το `FullscreenContainer` (v1) είχε 2 modes σε 1 component:
- `mode="overlay"` — React Portal + CSS fixed
- `mode="dialog"` — Wrapper πάνω από Radix Dialog

Ο dialog mode ήταν **abstraction πάνω σε abstraction** (Radix Dialog). Google-level architecture χρησιμοποιεί **composition** — ξεχωριστά components για ξεχωριστά πράγματα.

---

## Decision (v2 — Composition Architecture)

Decompose σε **SRP components**:

```
ΠΡΙΝ (v1):                          ΜΕΤΑ (v2):
┌─────────────────────┐           ┌──────────────────┐
│ FullscreenContainer │           │ FullscreenOverlay │  (overlay μόνο)
│  mode="overlay"     │           └──────────────────┘
│  mode="dialog"      │           ┌──────────────────┐
└─────────────────────┘           │ Dialog            │  (+ size="fullscreen")
                                  │  size="fullscreen"│
                                  └──────────────────┘
                                  ┌──────────────────────────┐
                                  │ FullscreenToggleButton    │  (standalone)
                                  └──────────────────────────┘
                                  ┌──────────────────┐
                                  │ useFullscreen     │  (ως έχει)
                                  └──────────────────┘
```

### Design Principles

- **SRP**: Κάθε component κάνει ένα πράγμα
- **Composition over abstraction**: Dialog mode = direct `<Dialog>` + `<DialogContent size="fullscreen">`
- **CVA variants**: `DialogContent` αποκτά `size` prop μέσω `class-variance-authority`
- **Zero breaking changes**: Default `size="default"` = σημερινό `max-w-lg`

---

## Components

### 1. `useFullscreen` hook — **μόνο κατάσταση** (2026-09-11)

**Location**: `src/hooks/useFullscreen.ts`

Ως 2026-09-11 κρατούσε **και** το Escape (ωμός listener `document`) **και** το κλείδωμα κύλισης. Και τα δύο ανήκουν
στην **επιφάνεια**, όχι στην κατάσταση — ένας κάτοχος κατάστασης που ζωγραφίζει αλλού (`FloorplanGallery`: Radix
`<Dialog size="fullscreen">`) είχε έτσι **τρεις** ιδιοκτήτες για το ίδιο πάτημα. Η αχρησιμοποίητη επιλογή `lockScroll`
αφαιρέθηκε (grep: 0 χρήσεις).

```typescript
interface UseFullscreenReturn {
  isFullscreen: boolean;
  toggle: () => void;
  enter: () => void;
  exit: () => void;
}
```

### 2. `FullscreenOverlay` component (πρώην `FullscreenContainer`)

**Location**: `src/core/containers/FullscreenOverlay.tsx`

**API**:

```typescript
interface FullscreenOverlayProps {
  children: React.ReactNode;
  isFullscreen: boolean;
  onToggle: () => void;
  headerContent?: React.ReactNode;
  className?: string;
  fullscreenClassName?: string;
  ariaLabel?: string;
}
```

- CSS `fixed inset-0` overlay via React Portal — στρώση = ρόλος **`fullscreenSurface`** της κλίμακας (ADR-780 Φάση Δ):
  **ΕΠΙΦΑΝΕΙΑ κάτω** από την παροδική οικογένεια (`transientStack`). ⚠️ Εδώ έγραφε «`z-50`» ενώ ο κώδικας είχε ωμό
  `z-[60]` — **πάνω** από το `z-50` των διαλόγων, οπότε κάθε διάλογος που άνοιγε μέσα σε πλήρη οθόνη ήταν αόρατος
  και το πρώτο κλικ τον ακύρωνε (ADR-332 D27 Ζ3). Τη σειρά την κλειδώνει το `components/ui/__tests__/layer-contract`.
- ✅ **ΕΠΙΦΑΝΕΙΑ (2026-09-11, ADR-332 D27 βήμα 2)** — τα πέντε μετρημένα ελαττώματα, κλειστά:

  | # | Ελάττωμα (μετρημένο ζωντανά) | Μηχανισμός τώρα | Άγκυρα |
  |---|---|---|---|
  | Ε1 | **Διπλό Escape**: ένα Esc με Select / μενού / διάλογο ανοιχτό μέσα στην πλήρη οθόνη έκλεινε **και τα δύο** (4 καταναλωτές + DXF) | Στοίβα `@/lib/a11y/escape-layers` — **ένα Esc = ένα πλαίσιο**: Radix / slot bus → **πεδίο κειμένου** (1ο Esc: focus στην επιφάνεια, το κείμενο μένει) → πλήρης οθόνη | A1–A7 |
  | Ε2 | **Καμία παγίδα / επαναφορά focus** — `aria-modal` που δεν τηρούνταν | `inert` σε ό,τι είναι έξω (`@/lib/a11y/inert-outside`)· focus στην επιφάνεια στην είσοδο· πίσω στον opener στην έξοδο (`@/lib/a11y/focus-return`) | C1, C1′, C2 |
  | Ζ9 | **Τα παιδιά ξαναπροσαρτώνονταν σε κάθε εναλλαγή** (`<section>` ή `createPortal`) — πεδίο «Ανάθεση» χαμένο, **4/4 καμβάδες DXF** ξαναστημένοι | **Σταθερός ξενιστής** (`fullscreen/use-stable-host`): τα παιδιά πάντα με portal στον ίδιο ξενιστή· ο ξενιστής μετακινείται με `moveBefore` (κρατά focus / iframes / WebGL), εφεδρικά `appendChild` | D1–D5 |
  | Ζ8 | **Κεφαλίδα ύψους 0** (Πίνακας Ελέγχου Χρονοδιαγράμματος) | Ρίζα: `globals.css` `overflow-x: hidden → clip` + `:where(...)` (ADR-750 §21.10)· ζώνη ασφαλείας: το σώμα της επιφάνειας είναι **block** και ο μόνος scroll container | E1 |
  | Α1 | Ψευδές `starved` στον έλεγχο ESC (το «1 Issue») | ADR-364 §10.15.γ — κρίση `unarmed` | B1, B2 |

- **Δομή**: κενή θέση inline (`display: contents`) · **μόνιμη** επιφάνεια με portal στο `body` (`hidden` όταν δεν χρειάζεται —
  αν ξεπροσαρτιόταν, το React θα την αφαιρούσε από το DOM **πριν** τις layout effects, με τον ξενιστή μέσα της) · τα παιδιά
  με portal στον ξενιστή. Η κλάση του καταναλωτή μπαίνει **στον ξενιστή** (άμεσος γονέας — το `space-y-*` της Tailwind 3.4
  είναι επιλογέας παιδιού). Όποιος θέλει flex στην πλήρη οθόνη το ζητά ρητά (DXF: `fullscreenClassName="flex flex-row"`).
- **`role="dialog"` + ετικέτα, ΧΩΡΙΣ `aria-modal`**: με συνοδό έξω από την επιφάνεια (η πλωτή παλέτα του DXF) το
  `aria-modal` θα την έκρυβε στο VoiceOver· την αδράνεια την επιβάλλει πραγματικά το `inert`.
- **Συνοδοί** (ζωντανοί δίπλα σε κάθε επιφάνεια): κάθε `FloatingPanel` (`data-fullscreen-companion` στη ρίζα του — ό,τι
  ζωγραφίζεται **πάνω** από την επιφάνεια πρέπει να πατιέται) · οι ειδοποιήσεις (`[data-sonner-toaster]`) · το dev overlay.
- **Δεν** πατά `ModalKeyboardScope` (ADR-711): θα σκότωνε τους accelerators του DXF σε πλήρη οθόνη (άγκυρα C4).
- **SSR**: ο ξενιστής δημιουργείται σε layout effect ⇒ το περιεχόμενο **δεν** μπαίνει στο HTML του server (ο server
  renderer πετά σε `createPortal`). Αποδεκτό: και οι 13 καταναλωτές είναι καρτέλες με δεδομένα πελάτη πίσω από σύνδεση (D4).
- Ideal for: EntityFilesManager, canvas-based views

### 3. `FullscreenToggleButton` (standalone export)

**Location**: `src/core/containers/FullscreenOverlay.tsx`

```typescript
interface ToggleButtonProps {
  isFullscreen: boolean;
  onToggle: () => void;
}
```

- Maximize2 / Minimize2 icon toggle
- i18n tooltips
- Can be used independently in any context

### 4. `DialogContent` size variants (CVA)

**Location**: `src/components/ui/dialog.tsx`

```typescript
type DialogContentSize = 'sm' | 'default' | 'lg' | 'xl' | 'fullscreen';
```

| Size | CSS |
|------|-----|
| `sm` | `max-w-sm` |
| `default` | `max-w-lg` |
| `lg` | `max-w-2xl` |
| `xl` | `max-w-4xl` |
| `fullscreen` | `max-w-[95vw] w-[95vw] h-[90vh]` |

### 5. i18n Keys

**Location**: `src/i18n/locales/{en,el}/common.json`

```json
{
  "fullscreen": {
    "enter": "Enter fullscreen / Πλήρης οθόνη",
    "exit": "Exit fullscreen / Έξοδος πλήρους οθόνης",
    "enterTooltip": "...",
    "exitTooltip": "..."
  }
}
```

---

## Migrated Components

| # | Component | Pattern | Notes |
|---|-----------|---------|-------|
| 1 | **EntityFilesManager** | `FullscreenOverlay` (overlay) | Simple rename — props unchanged |
| 2 | **GanttView** | `Dialog` + `DialogContent size="fullscreen"` | Direct composition — no wrapper |
| 3 | **FloorplanGallery** | `Dialog` + `DialogContent size="fullscreen"` | Direct composition — no wrapper |
| 4 | **DXF Viewer** | `FullscreenOverlay` (overlay) | Portal wraps MainContentSection + FloatingPanelsSection. Toolbar button toggle. ⚠️ Το «zero canvas remount» που έγραφε εδώ ήταν **ψευδές** (μετρημένο 2026-09-11: 4/4 καμβάδες αντικαθίσταντο σε είσοδο **και** έξοδο) — **ισχύει από κατασκευής** μόνο από τον σταθερό ξενιστή (§2). |
| 5 | **AnalyticsTabContent** | `FullscreenOverlay` (overlay) | Building analytics tab — FullscreenToggleButton in Header nav. |
| 6 | **MeasurementsTabContent** | `FullscreenOverlay` (overlay) | Building BOQ/measurements tab — FullscreenToggleButton next to "New Item" button. |

---

## Not Migrated (by design)

| Component | Reason |
|-----------|--------|
| **VideoPlayer** | Uses native browser Fullscreen API (`element.requestFullscreen()`). Different paradigm. |
| **~~FullscreenView (DXF)~~** | ~~Deep coupling με canvas coordinate system και zoom state.~~ **MIGRATED** (2026-03-18) — Portal-based `FullscreenOverlay` wraps `MainContentSection` + `FloatingPanelsSection` (το «zero canvas remount» διαψεύστηκε 2026-09-11 — δες γραμμή 4 του πίνακα παραπάνω). |
| **GeoDialogSystem** | Dialog framework με δικό του fullscreen mode (dialog stack management). |

---

## Architecture (v2)

```
┌─────────────────────────────────────────────────┐
│           Consumer Component                    │
│  (EntityFilesManager, GanttView, FloorplanGallery)│
└───────┬─────────────────────────────┬───────────┘
        │ overlay pattern             │ dialog pattern
        ▼                             ▼
┌───────────────────┐   ┌─────────────────────────┐
│ FullscreenOverlay │   │ Dialog + DialogContent   │
│ (React Portal)    │   │ size="fullscreen"        │
└───────────────────┘   │ + FullscreenToggleButton │
                        └─────────────────────────┘
        │                             │
        └──────────┬──────────────────┘
                   ▼
        ┌──────────────────┐
        │ useFullscreen    │
        │ (μόνο κατάσταση) │
        └──────────────────┘
```

**Η επιφάνεια του `FullscreenOverlay` (2026-09-11):**

```
FullscreenOverlay
 ├─ useFullscreenOpener      ← ΠΡΙΝ τη μετακίνηση: καταγράφει ποιος είχε το focus
 ├─ useStableHost            ← ένας ξενιστής για όλη τη ζωή· μετακίνηση με moveBefore
 └─ useFullscreenSurface     ← ΜΕΤΑ τη μετακίνηση
      ├─ στρώση Escape  (@/lib/a11y/escape-layers)  — ένα Esc = ένα πλαίσιο
      ├─ inert έξω      (@/lib/a11y/inert-outside)   — συνοδοί ζωντανοί
      ├─ κλείδωμα κύλισης (μέτρηση αναφορών)
      └─ focus: μέσα στην είσοδο · πίσω στον opener (@/lib/a11y/focus-return)
```
Η σειρά δήλωσης **είναι** η σειρά των layout effects: με το εφεδρικό `appendChild` η μετακίνηση χάνει το focus, οπότε ο
opener καταγράφεται πριν (άγκυρα C2 · μετάλλαξη S-M7).

---

## Ζωντανή επαλήθευση της επιφάνειας (Chrome 152 · 2026-09-12)

Το jsdom είναι **τυφλό** σε ό,τι μετριέται εδώ: ταυτότητα κόμβου μετά από `moveBefore`, WebGL context, στοίβαξη,
πραγματική σειρά Tab. Κάθε γραμμή είναι μέτρηση στον browser, όχι συμπέρασμα από test.

| Ερώτημα | Μέτρηση | Πριν |
|---|---|---|
| **Ζ8** — κεφαλίδα Πίνακα Ελέγχου σε πλήρη οθόνη | `headerHeight: 36` · `headerOverflow: "clip visible"` · το «Εξαγωγή» **κορυφαίο** στο σημείο του (`exportIsTopmost: true`) | `0` — απάτητη |
| **Ζ9** — ανοιχτό πεδίο «Ανάθεση» (Νομικά) | `sameNode: true` — **ο ίδιος κόμβος DOM** μέσα στην επιφάνεια, στην είσοδο **και** στην έξοδο | χανόταν |
| **Ζ9** — καμβάδες DXF | `sameNodes: 4/4` · `recreated: 0` — **και στις δύο** κατευθύνσεις | 4/4 αντικαθίσταντο |
| **Ε1** — διπλό Escape (Radix μέσα σε πλήρη οθόνη) | Esc#1 ⇒ κλείνει **μόνο** το dropdown, `stillFullscreen: true`, focus πίσω στο combobox | έκλειναν **και τα δύο** |
| **Ε1** — διπλό Escape (DXF με ενεργό εργαλείο) | εργαλείο `dist` · Esc ⇒ `consumedBy: "measure/dist"`, ετυμηγορία `ok`, `stillFullscreen: true` | έβγαινε και η πλήρης οθόνη |
| **Α1** — σεντινέλα Escape χωρίς καταναλωτή | ετυμηγορία **`ok`**, `localOwner: "core/fullscreen-surface"`, `busArmed: true`, `busDispatched: true`, `preemptedAtEntry: false` | ψευδές `starved` («1 Issue») |
| **Ε2** — επαναφορά focus | μετά από **πραγματικό** κλικ: `focusIsOpener: true` | έπεφτε στο `body` |
| **Ε2** — περιορισμός focus | Tab×6: κανένα βήμα σε αδρανές περιεχόμενο· στο 3ο το focus βγαίνει στο πλαίσιο του browser (`activeElement === body`), στο 4ο ξαναμπαίνει στο **πρώτο** στοιχείο της επιφάνειας | το Tab δραπέτευε στη σελίδα από κάτω |
| **Χάρτης** (maplibre) | ίδιος κόμβος · `isContextLost(): false` · μέγεθος 172→469 ⇒ ο χάρτης **αντέδρασε**, δεν πάγωσε | — |
| **Έξοδος** | `inert: 0` υπόλοιπα · `overflow` σώματος πίσω σε `auto` | — |
| **Εύρος CSS** (Ζ8) σε 625px (< 640px ⇒ ο κανόνας κινητού **ενεργός**) | Επαφές · Πίνακας Ελέγχου · Κτίρια · Πωλήσεις · DXF: `hScroll: 0`, παλινδρομήσεις **0**· `.dxf-ribbon-panel` κρατά ρητό `overflow: clip` | — |

⚠️ Η μόνη «υπερχείλιση» που βρήκε το όργανο ήταν δείκτης χάρτη (`FIGURE` καρφίτσα 36px + λεζάντα 16px από κάτω, άξονας
y `visible`): **όφελος**, όχι παλινδρόμηση — με τον παλιό `overflow-x: hidden` το στοιχείο γινόταν δοχείο κύλισης και η
λεζάντα κοβόταν.

### 🔴 Ελάττωμα που βρήκε **μόνο** η ζωντανή επαλήθευση — ο συνοδός χωρίς σήμα

Μέτρηση: με την επιφάνεια ανοιχτή, `notificationsInert: **true**`. Ο περιέκτης ειδοποιήσεων του sonner **αδρανοποιούνταν**.

Αιτία: ο επιλογέας συνοδών ζητούσε `[data-sonner-toaster]`, αλλά το sonner αποδίδει στο `body` έναν **κενό**
`<section aria-live="polite">` και γεννά το `<ol data-sonner-toaster>` **μέσα** του μόνο με την **πρώτη** ειδοποίηση.
Δηλαδή ο επιλογέας αστοχούσε **ακριβώς τη στιγμή της εισόδου** — και επειδή το `inert` κληρονομείται σε όλο το υποδέντρο,
κάθε ειδοποίηση που ερχόταν μετά γεννιόταν **απάτητη και εκτός δέντρου προσβασιμότητας**, άρα ούτε ανακοινωνόταν.

Το test ήταν **πράσινο σε νεκρό δίδυμο**: το πλαστό έβαζε το σήμα `data-sonner-toaster` πάνω στο section του `body` —
σχήμα που η βιβλιοθήκη **δεν παράγει ποτέ**.

Διόρθωση = **αρχή, όχι λίστα ονομάτων**: μια **ζωντανή περιοχή σε επίπεδο `body`** είναι καθολική επιφάνεια ανακοίνωσης
και δεν βρίσκεται ποτέ «από πίσω» ⇒ `body > [aria-live="polite"], body > [aria-live="assertive"]` στον
`INERT_COMPANION_SELECTOR`. **Στενό επίτηδες**: το `aria-live` ζει πλήθος φορές **μέσα** σε περιεχόμενο σελίδας (φόρμες,
δείκτες αυτόματης αποθήκευσης) και αυτά **πρέπει** να σβήνουν — το φυλάνε δύο άγκυρες. Άγκυρα **C5** (4 έλεγχοι),
μεταλλάξεις **3/3 σκοτωμένες**. Ζωντανά μετά: `notificationsInert: false`, ενώ τα υπόλοιπα 5 στοιχεία σβήνουν κανονικά.

---

## Usage Examples

### Overlay mode (EntityFilesManager)

```tsx
const fs = useFullscreen();
<FullscreenOverlay isFullscreen={fs.isFullscreen} onToggle={fs.toggle}>
  <Card>...</Card>
</FullscreenOverlay>
```

### Dialog mode (GanttView) — Direct composition

```tsx
const fs = useFullscreen();

<Dialog open={fs.isFullscreen} onOpenChange={(open) => { if (!open) fs.exit(); }}>
  <DialogContent size="fullscreen" hideCloseButton className="flex flex-col p-0 gap-0">
    <DialogTitle className="sr-only">Gantt Chart</DialogTitle>
    <header className="flex items-center justify-between shrink-0 border-b px-4 py-2">
      <span className="font-semibold">Title</span>
      <FullscreenToggleButton isFullscreen onToggle={fs.toggle} />
    </header>
    <section className="flex-1 min-h-0 overflow-auto">
      <GanttChart ... />
    </section>
  </DialogContent>
</Dialog>
```

### Hook-only (without any container)

⚠️ Εδώ έγραφε `useFullscreen({ escapeToExit: true })` — επιλογή που **δεν υπήρξε ποτέ** στον κώδικα. Χωρίς
`FullscreenOverlay` δεν υπάρχει επιφάνεια, άρα ούτε Escape / focus / αδράνεια: αυτό το σχήμα κρατά **μόνο** την κατάσταση.

```tsx
const { isFullscreen, toggle, exit } = useFullscreen();

return (
  <div className={isFullscreen ? 'fixed inset-0 z-50 bg-white' : 'relative'}>
    <button onClick={toggle}>Toggle</button>
    <MyContent />
  </div>
);
```

---

## Full Codebase Audit (2026-03-18)

- **0 rogue fullscreen implementations** βρέθηκαν
- **6/6** eligible components μεταφέρθηκαν επιτυχώς (EntityFilesManager, GanttView, FloorplanGallery, DXF Viewer, AnalyticsTab, MeasurementsTab)
- **2/3** intentional exceptions τεκμηριωμένες (VideoPlayer, GeoDialogSystem)

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-09-12 | **✅ Η ζωντανή επαλήθευση ολοκληρώθηκε — και βρήκε ένα ελάττωμα που κανένα test δεν έβλεπε.** Επαληθεύτηκαν στον Chrome 152 και τα έξι σημεία (πίνακας «Ζωντανή επαλήθευση της επιφάνειας»): κεφαλίδα **36px** (ήταν 0) με το «Εξαγωγή» κορυφαίο · «Ανάθεση» **ίδιος κόμβος** στην είσοδο **και** στην έξοδο · DXF **4/4 καμβάδες ίδιοι, 0 ξαναστημένοι** και στις δύο κατευθύνσεις · Esc#1 κλείνει **μόνο** τη στρώση Radix · Esc με εργαλείο `dist` ⇒ `consumedBy: "measure/dist"` και η πλήρης οθόνη **μένει** · σεντινέλα `ok` με `localOwner: core/fullscreen-surface` (τέλος το ψευδές «1 Issue») · `focusIsOpener: **true**` μετά από πραγματικό κλικ · χάρτης maplibre ίδιος κόμβος με **ζωντανό** WebGL context (172→469) · CSS σε 5 σελίδες στα 625px: **0** οριζόντια υπερχείλιση, **0** παλινδρομήσεις. 🔴 **Νέο ελάττωμα, μόνο ζωντανά**: ο περιέκτης ειδοποιήσεων **αδρανοποιούνταν** (`notificationsInert: true`) — το `[data-sonner-toaster]` γεννιέται **τεμπέλικα** μέσα σε κενό `<section aria-live>`, άρα ο επιλογέας συνοδών αστοχούσε τη στιγμή της εισόδου και κάθε επόμενη ειδοποίηση ήταν απάτητη **και** ανακοίνωτη· το test ήταν **πράσινο σε νεκρό δίδυμο**. Διόρθωση = αρχή (`body > [aria-live]`), άγκυρα **C5** (4 έλεγχοι, δύο εξ αυτών φυλάνε τη **στενότητα**), μεταλλάξεις **3/3**, ζωντανά μετά `notificationsInert: false`. Τεκμηριώθηκε επίσης, **με έρευνα**, ότι το Tab που φτάνει στο πλαίσιο του browser **δεν** είναι ελάττωμα (ADR-711 §10.11β) — καμία παγίδα focus. Σουίτες **20 / 298 πράσινες** · `jscpd:diff` καθαρό · CHECK 3.53 ✅ (4.929 δείκτες) · CHECK 3.54 ✅. | Claude + Γιώργος |
| 2026-09-11 (β) | **Η πλήρης οθόνη έγινε πραγματική επιφάνεια** (ADR-332 D27 βήμα 2 · Plan Mode · απόφαση Giorgio «όπως οι μεγάλοι»). Πέντε μετρημένα ελαττώματα κλειστά (§2): **Ε1** διπλό Escape → στοίβα `escape-layers` με σκάλα «ένα Esc = ένα πλαίσιο» (Revit / AutoCAD / Figma) · **Ε2** καμία παγίδα / επαναφορά focus → `inert-outside` + `focus-return`, χωρίς `aria-modal` · **Ζ9** remount σε κάθε εναλλαγή (Νομικά «Ανάθεση» χαμένη, DXF 4/4 καμβάδες) → σταθερός ξενιστής + `moveBefore` · **Ζ8** κεφαλίδα 0px → ρίζα στο `globals.css` (ADR-750 §21.10) · **Α1** ψευδές `starved` (ADR-364). Διαψεύστηκαν και διορθώθηκαν τρεις ισχυρισμοί του ίδιου του ADR («Children do NOT remount», «zero canvas remount» ×2, `escapeToExit`). `useFullscreen` → μόνο κατάσταση· `FloorplanGallery` χάνει τον δεύτερο ιδιοκτήτη Escape· `FullscreenToggleButton` σε δικό του αρχείο (re-export). **Άγκυρες**: A1–A7 · B1/B2 · C1/C1′/C2/C4 · D1–D5 · E1 + συνοδός `FloatingPanel` — **κόκκινες πρώτα**· **μεταλλάξεις 42/42 σκοτωμένες** (E1 4 · B 5 · B2 2 · A 8 · A2 3 · D 6 · C 5 · S 7 · F 2 — τέσσερις επέζησαν στην πρώτη γραφή των αγκυρών, A-M7 · A5-M1 · C-M3 · B-M2, και διορθώθηκαν οι **άγκυρες**, όχι ο κώδικας). Σουίτες που αγγίχτηκαν: **18 / 278 πράσινα**. `jscpd:diff` καθαρό (17). CHECK 3.62 ✅ χωρίς μεγέθυνση της δημόσιας επιφάνειας (390). ✅ **Η ζωντανή επαλήθευση έγινε 2026-09-12** (γραμμή από πάνω) — και τα έξι σημεία πέρασαν· βρήκε επιπλέον ένα ελάττωμα (αδρανείς ειδοποιήσεις) που τα tests δεν έβλεπαν. | Claude + Γιώργος |
| 2026-09-11 (β, αρχεία) | Νέα: `src/lib/a11y/{escape-layers,inert-outside,focus-return}.ts` · `src/core/containers/FullscreenToggleButton.tsx` · `src/core/containers/fullscreen/{move-node,use-stable-host,use-fullscreen-surface}.ts`. Τροποποιημένα: `FullscreenOverlay.tsx` · `useFullscreen.ts` · `useEscapeKey.ts` · `use-dialog-focus-restore.ts` · `radix-escape-ownership.ts` · `FloatingPanel.tsx` · `escape-dev-audit.ts` · `EscapeCommandBus.ts` · `FloorplanGallery.tsx` · `DxfViewerContent.tsx` · `globals.css` · `ribbon-tokens.css`. | Claude + Γιώργος | | Claude + Γιώργος |
| 2026-09-11 | **Στρώση από την κλίμακα (ADR-780 Φάση Δ)**: `FullscreenOverlay` ωμό `z-[60]` → ρόλος `fullscreenSurface` (1045), **κάτω** από την παροδική οικογένεια `transientStack` (1095). Διορθώνει την κλάση του ADR-332 D27 Ζ3: σε **κάθε** καταναλωτή (Addresses · Measurements · Ownership · Locations · Payments · Files · ScheduleDashboard · DXF) κάθε διάλογος/μενού που άνοιγε σε πλήρη οθόνη ήταν αόρατος. Άγκυρα `components/ui/__tests__/layer-contract` (Σ2). **Ζωντανά**: σύρσιμο έδρας σε πλήρη οθόνη ⇒ διάλογος ορατός (1095 > 1045), «Ακύρωση» και «Μόνο η θέση» ολοκληρώνονται, Select μέσα στην πλήρη οθόνη = 1220. Δηλωμένο κενό: παγίδα/επαναφορά focus + 🔴 **το Escape (ωμός listener του `useFullscreen`, εκτός ADR-364) κλείνει ΚΑΙ τον διάλογο ΚΑΙ την πλήρη οθόνη** (μετρημένο) — χωριστό βήμα. | Claude + Γιώργος |
| 2026-03-18 | **Building tabs fullscreen**: AnalyticsTabContent + MeasurementsTabContent — `FullscreenOverlay` wrap + `FullscreenToggleButton` in header/actions area | Claude + Γιώργος |
| 2026-03-18 | **DXF Viewer fullscreen**: Portal-based `FullscreenOverlay` wraps canvas area, toolbar toggle button (Maximize2/Minimize2), `isFullscreen` prop flow through 7 components, i18n keys (en+el), zero canvas remount | Claude + Γιώργος |
| 2026-03-18 | **Milestones fullscreen**: Added `FullscreenOverlay` to `TimelineTabContent.tsx` milestones view — `useFullscreen` hook + fullscreen button in toolbar + overlay with OverallProgressCard, TimelineMilestones, CriticalPathCard, CompletionForecastCard | Claude + Γιώργος |
| 2026-03-18 | **v2 Composition Refactor**: `FullscreenContainer` → `FullscreenOverlay` (SRP), dialog mode → direct `<Dialog size="fullscreen">` composition, `FullscreenToggleButton` standalone export, CVA size variants on `DialogContent` | Claude + Γιώργος |
| 2026-03-18 | Full codebase audit — confirmed 100% centralization coverage, 0 rogue implementations | Claude + Γιώργος |
| 2026-03-18 | Initial implementation — `useFullscreen` hook, `FullscreenContainer` component, 3 component migrations, i18n keys | Claude + Γιώργος |
