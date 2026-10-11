# ADR-248: Centralized Auto-Save System (Google-Level)

| Metadata | Value |
|----------|-------|
| **Status** | PARTIALLY SUPERSEDED (2026-10-11 — §2.5: το `useAutoSave` καταργήθηκε· μένουν ένδειξη + λεξιλόγιο κατάστασης) |
| **Date** | 2026-03-19 |
| **Category** | UI / State Management / Data Persistence |
| **Canonical Files** | `src/types/auto-save.ts`, `src/components/shared/AutoSaveStatusIndicator.tsx` · αδελφός: `src/lib/async/field-patch-queue.ts` + `src/hooks/useFieldPatchQueue.ts` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

> ⚠️ **Διάβασε πρώτα το §2.5.** Τα §1, §2.1–§2.3 και η Φάση 2 του §3 περιγράφουν τον μηχανισμό όπως **ήταν** ως τις
> 2026-10-11. Τα `src/hooks/useAutoSave.ts` και `src/config/auto-save-config.ts` **δεν υπάρχουν πια**.

---

## 1. Context

### Τι είχαμε πριν

Ο κώδικας αυτόματης αποθήκευσης ήταν **διάσπαρτος σε 8+ σημεία** με copy-paste boilerplate ~15-25 γραμμών σε κάθε component. Κάθε component ξαναέγραφε τα ίδια: `setTimeout` management, status tracking (`idle/saving/success/error`), `lastSaved` timestamp, cleanup on unmount, try-catch error handling.

### The Problem

- ❌ **8+ duplicate patterns**: `saveTimeoutRef`, `saveStatus useState`, `lastSaved useState` copy-pasted
- ❌ **BROKEN auto-save**: `useAutosave` στο Projects/GeneralProjectTab ΔΕΝ έκανε actual save — μόνο UI animation
- ❌ **Fake auto-save**: Buildings/GeneralTabContent είχε fake setTimeout που μόνο εμφάνιζε "Saved" χωρίς Firestore write
- ❌ **No retry logic**: Αν αποτύχει ένα save, χάνονταν δεδομένα
- ❌ **Race conditions**: Rapid edits μπορούσαν να προκαλέσουν stale data saves
- ❌ **No deep equality**: Κάποια components έκαναν save ακόμα κι αν τα data δεν είχαν αλλάξει

### Existing building blocks (ΚΡΑΤΗΘΗΚΑΝ)

| Τι υπάρχει | Πού | Status |
|------------|-----|--------|
| `useDebouncedCallback` | `src/hooks/useDebouncedCallback.ts` | ✅ Κρατήθηκε (generic utility) |
| `useDebounce` | `src/hooks/useDebounce.ts` | ✅ Κρατήθηκε (generic utility) |
| `timing-config.ts` | DXF viewer config | ✅ Κρατήθηκε (DXF-specific) |
| `useAutoSaveSceneManager` | DXF viewer hooks | ✅ Κρατήθηκε (domain-specific) |
| `useStorageSave` | DXF settings provider | ✅ Κρατήθηκε (DXF-specific) |

---

## 2. Decision

### Αρχιτεκτονική: Centralized Hook + Config + Types + Status Component

#### 2.1 `src/types/auto-save.ts` — Shared Types

```typescript
type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

interface AutoSaveConfig<T> {
  saveFn: (data: T) => Promise<void>;
  debounceMs?: number;        // Default: 2000
  equalityFn?: (prev: T, next: T) => boolean;
  enabled?: boolean;           // Default: true
  maxRetries?: number;         // Default: 2
  statusResetMs?: number;      // Default: 3000ms
  onStatusChange?: (status: SaveStatus) => void;
  onError?: (error: Error, retryCount: number) => void;
  onSuccess?: (data: T, timestamp: Date) => void;
}

interface AutoSaveReturn<T> {
  status: SaveStatus;
  lastSaved: Date | null;
  error: string | null;
  isDirty: boolean;
  saveNow: () => Promise<void>;
  retry: () => Promise<void>;
  markClean: () => void;
  reset: () => void;
}
```

#### 2.2 `src/config/auto-save-config.ts` — Timing Constants

```typescript
export const AUTO_SAVE_TIMING = {
  FORM_DEBOUNCE: 2000,    // Building/Project/Contact forms
  SETTINGS_DEBOUNCE: 500, // User preferences
  INSTANT: 0,             // Select/dropdown
  STATUS_RESET: 3000,     // "Saved" message visibility
  ERROR_RESET: 5000,      // Error message visibility
  RETRY_DELAY: 1000,      // Retry delay on failure
  MAX_RETRIES: 2,         // Max retry attempts
} as const;
```

#### 2.3 `src/hooks/useAutoSave.ts` — Core Hook

**Google Docs pattern**: Consumer provides `data`, hook watches for changes and saves.

Key features:
- **Deep equality** via `JSON.stringify` (configurable `equalityFn`)
- **Race condition protection** via version counter
- **Stale closure protection** via `useRef` for `saveFn`
- **Automatic retry** with configurable max attempts
- **Flush on unmount** (fire-and-forget) — never lose data on navigation
- **Status lifecycle**: `idle → saving → success|error → idle` (auto-reset)
- **First render skip** — don't save initial data load

#### 2.4 `src/components/shared/AutoSaveStatusIndicator.tsx` — Status UI

Three variants:
- `inline` — Icon + text (form headers)
- `badge` — Colored badge with dot (page headers)
- `compact` — Colored dot only (toolbars)

Uses semantic `<output>` tag with `aria-live="polite"`.

#### 2.5 Κανόνας (2026-10-11): η ενεργή εγγραφή αλλάζει ΜΟΝΟ με ρητή «Αποθήκευση»

**Το ελάττωμα** (ADR-912 Εύρημα 8, μετρημένο στα 390px): οι φόρμες **κτιρίου** και **έργου** είχαν «Αποθήκευση» και
«Ακύρωση» **και** `useAutoSave` με debounce 2 s πάνω στην **ενεργή** εγγραφή. Συνέπειες:

- Η «Ακύρωση» **δεν ακύρωνε**: επανέφερε την οθόνη, ενώ οι αλλαγές είχαν ήδη γραφτεί.
- Ο διάλογος απόρριψης (ADR-912 §12.5) έλεγε «οι αλλαγές που δεν αποθηκεύσατε θα χαθούν» για αλλαγές που είχαν σωθεί.
- Κάθε παύση 2 s ήταν **ξεχωριστή εγγραφή** που παρέκαμπτε την επικύρωση του `handleSave` (π.χ. κενό όνομα)· στα
  έργα και τον έλεγχο επιπτώσεων για κάθε πεδίο που δεν παρακολουθούσε το `hasImpactTrackedChanges`.
- Το «flush on unmount» έγραφε **χωρίς** να περιμένει και κατάπινε την αποτυχία (ADR-253 A8).

**Η πρακτική**: GitHub Primer — «never mix save patterns in a single form», και ξεκινάς με ρητή αποθήκευση· SAP Fiori
draft handling — η αυτόματη γράφει σε **πρόχειρο**, η ενεργή εγγραφή αλλάζει μόνο στο Save· Shopify save bar — τίποτα
δεν γράφεται πριν το Save· Material full-screen dialog — ✕ = απόρριψη, με επιβεβαίωση μόνο όταν υπάρχουν αλλαγές.
Revit / ArchiCAD / Cinema 4D / Zillow / Idealista: καμία δημόσια τεκμηρίωση για το θέμα.

**Η απόφαση (Α)**: ρητή αποθήκευση. Μια φόρμα με «Αποθήκευση/Ακύρωση» **δεν γράφει ποτέ** στην ενεργή εγγραφή όσο
γράφει ο άνθρωπος, ούτε όταν φεύγει.

| Τι | Πριν | Τώρα |
|---|---|---|
| `building-management/tabs/GeneralTabContent.tsx` | `useAutoSave` + ρητή ενημέρωση **χωρίς** `_v` | μόνο ρητή, μέσω `useVersionedSave` (SPEC-256A, όπως τα έργα)· `buildingFieldsFrom` = μία αντιστοίχιση για δημιουργία και ενημέρωση |
| `projects/general-tab/GeneralProjectTab.tsx` | `useAutosave` + βάση σύγκρισης `autosaved` | μόνο ρητή· βάση σύγκρισης το ίδιο το `project`, μαζί και η συνδεδεμένη εταιρεία |
| `projects/general-tab/hooks/useAutosave.ts` | περιτύλιγμα | **διαγράφηκε** |
| `src/hooks/useAutoSave.ts` · `src/config/auto-save-config.ts` | ο μηχανισμός | **διαγράφηκαν** (μηδέν καταναλωτές ⇒ νεκρός κώδικας, CHECK 3.22)· μαζί το module `auto-save-config` του `.ssot-registry.json` και οι τύποι `AutoSaveConfig` / `AutoSaveReturn` |
| `GeneralTabContent/Header.tsx` · `GeneralProjectHeader.tsx` | «Αποθήκευση… / Αποθηκεύτηκε ΩΩ:ΛΛ» | μόνο ο δείκτης της ρητής αποθήκευσης |

**Τι μένει από αυτό το ADR**: το λεξιλόγιο `SaveStatus` και η ένδειξη `AutoSaveStatusIndicator` — τα χρησιμοποιεί ο
αδελφός μηχανισμός (ουρά μερικών διορθώσεων, πιο κάτω), που **είναι** καθαρή αυτόματη αποθήκευση: εκεί δεν υπάρχει
«Αποθήκευση/Ακύρωση», άρα δεν αναμειγνύονται δύο σχήματα.

**Κανόνας επιλογής**:

| Η επιφάνεια έχει | Σχήμα |
|---|---|
| «Αποθήκευση» + «Ακύρωση» | ρητή αποθήκευση· δηλώνει αλλαγές με `useUnsavedEdits` (ADR-912 §12.5 · ADR-860) |
| καμία από τις δύο (απαντήσεις ανά πεδίο, ζωντανός listener) | `useFieldPatchQueue` |
| ανάγκη «να μη χαθεί ό,τι γράφω» **και** Αποθήκευση/Ακύρωση | **πρόχειρο** τύπου SAP (επιλογή Β) — δικό του ADR, **δεν έχει ξεκινήσει** |

**Άγκυρες** (η αναλλοίωτη, όχι η υλοποίηση — «αλλαγή πεδίου + 60 s ⇒ μηδέν εγγραφές», «αποχώρηση ⇒ μηδέν εγγραφές»,
«Αποθήκευση ⇒ μία εγγραφή με `_v`»):
`building-management/tabs/__tests__/general-tab-explicit-save.test.tsx` (4) ·
`projects/general-tab/__tests__/general-project-tab-explicit-save.test.tsx` (3). Μετάλλαξη 4/4: debounce και εγγραφή
στην αποχώρηση, σε κάθε φόρμα, κοκκινίζουν το Ε1 και το Ε2 αντίστοιχα.

🔶 **Ανοιχτά, ίδια κλάση**:
- **Ακίνητα** — `onAutoSaveFields` (ADR-236): η αλλαγή **τύπου** (`usePropertyFieldHandlers.handleTypeChange`) και η
  αυτόματη δημιουργία επιπέδων (`PropertyFieldsBlock`) γράφουν αμέσως, μέσα σε φόρμα με «Αποθήκευση/Ακύρωση».
- **Κτίρια** — η κάρτα σύνδεσης με έργο είναι `saveMode: 'immediate'` (δική της αποθήκευση, εκτός φόρμας).
- **Desktop** — αλλαγή επιλογής στη λίστα όσο τρέχει επεξεργασία με αλλαγές: παλιά τις έσωζε το «flush on unmount»,
  τώρα χάνονται χωρίς ερώτηση. Η φύλαξη `beforeunload` ισχύει (`useUnsavedEdits` → μητρώο)· φύλαξη για αλλαγή
  επιλογής **δεν βρέθηκε** στα κτίρια (`BuildingsPageContent.onSelectBuilding` αλλάζει επιλογή απευθείας). Οι άλλες
  σελίδες δεν ελέγχθηκαν.

### Αρχιτεκτονικές Αποφάσεις

| Απόφαση | Επιλογή | Γιατί |
|---------|---------|-------|
| Hook vs Class | **Hook** | Auto-save tied σε React lifecycle |
| `data: T` input vs `onChange` | **`data: T`** | Google Docs pattern, eliminates race conditions |
| Configurable `equalityFn` | **Ναι** | Forms: JSON.stringify. DXF: stableHash. Consumer decides. |
| Reuse `useDebouncedCallback` | **Όχι** | Need full control: cancel, flush, retry |
| Flush on unmount | **Ναι** | Google Docs never loses data on navigation |
| DXF hooks migration | **Phase 3** | Too domain-specific, risk outweighs benefit |

---

## 3. Implementation

### Phase 1: Foundation (DONE)

| File | What |
|------|------|
| `src/types/auto-save.ts` | Shared types |
| `src/config/auto-save-config.ts` | Timing constants |
| `src/hooks/useAutoSave.ts` | Core hook |
| `src/components/shared/AutoSaveStatusIndicator.tsx` | Status component |
| `src/i18n/locales/{en,el}/common.json` | i18n keys (`autoSave.*`) |

### Phase 2: First Migration (DONE 2026-03-19 · **ΑΝΑΙΡΕΘΗΚΕ 2026-10-11**, §2.5)

| File | Change |
|------|--------|
| `src/components/projects/general-tab/hooks/useAutosave.ts` | Rewritten as wrapper around `useAutoSave` with actual Firestore persistence |
| `src/components/projects/general-tab/GeneralProjectTab.tsx` | Real auto-save via `updateProject()`, `AutoSaveStatusIndicator` props |
| `src/components/projects/GeneralProjectHeader.tsx` | Added `AutoSaveStatusIndicator` support with backward compat |
| `src/components/building-management/tabs/GeneralTabContent.tsx` | Replaced fake setTimeout auto-save with real `useAutoSave` + `updateBuilding()` |

### Phase 3: Extended Migration (**ΑΚΥΡΩΘΗΚΕ 2026-10-11** — ο μηχανισμός δεν υπάρχει, §2.5)

- `EntityLinkCard.tsx` — Replace `saveStatus` boilerplate
- `LinkedSpacesCard.tsx` — Replace `saveStatus` boilerplate
- `ContactDetails.tsx` — Unify optimistic state tracking
- DXF hooks evaluation (optional)

### Αδελφός: σειριακή ουρά μερικών διορθώσεων (ADR-898 Φ3β-2, 2026-10-01)

Το `useAutoSave` (καταργήθηκε, §2.5) αποθήκευε **ολόκληρο** αντικείμενο με debounce (`saveFn(data): Promise<void>`). Δεν ταιριάζει όπου ο
server δέχεται **μερική διόρθωση ανά πεδίο** σε συναλλαγή και απαντά τριμερώς (`saved` · `invalid` με κωδικούς ·
`failed`): ολόκληρο αντικείμενο θα ξανάγραφε και πεδία που ο άνθρωπος δεν άγγιξε (ό,τι άλλαξε άλλη καρτέλα).

| Αρχείο | Ρόλος |
|---|---|
| `src/lib/async/field-patch-queue.ts` | Η ουρά (χωρίς React): **ένα** αίτημα στον αέρα · συγχώνευση ανά πεδίο στο μεταξύ · αισιόδοξη επικάλυψη σε τρία στρώματα (`acknowledged` · `inflight` · `queued`) πάνω από τον ζωντανό αναγνώστη · αποτυχία ⇒ επαναφορά + `failure` (επανάληψη μόνο για `failed`) |
| `src/hooks/useFieldPatchQueue.ts` | Ο δέτης: `useSyncExternalStore` · `sourceVersion` (νέα αλήθεια του listener ⇒ σβήνει το `acknowledged`) · όσο κάτι δεν έφυγε ⇒ `markUnsavedWork` στο μητρώο του ADR-860 §Ε3γ (ο ΕΝΑΣ `beforeunload`) |

**Κοινά με το ADR-248**: η ένδειξη (`AutoSaveStatusIndicator`) και το λεξιλόγιο κατάστασης (`idle · saving · success · error`).
**Κανόνας επιλογής**: δες τον πίνακα του §2.5 (η γραμμή «έγγραφο-φόρμα ⇒ `useAutoSave`» **δεν ισχύει πια**).
Πρώτος καταναλωτής της ουράς: `/offers/[offerId]/improve`.

⚠️ **Γνωστό χρέος (δεν διορθώθηκε εδώ)**: το `formatSaveAge` του `AutoSaveStatusIndicator` επιστρέφει **αγγλικά**
χωρίς i18n («just now», «5s ago»). Ο νέος καταναλωτής το παρακάμπτει με `showTimestamp={false}`.

---

## 4. i18n Keys

Added to `common.json` under `autoSave` namespace:

| Key | EN | EL |
|-----|----|----|
| `autoSave.saving` | Saving... | Αποθήκευση... |
| `autoSave.saved` | Saved | Αποθηκεύτηκε |
| `autoSave.error` | Save failed | Αποτυχία αποθήκευσης |
| `autoSave.retry` | Retry | Επανάληψη |
| `autoSave.lastSaved` | Last saved | Τελευταία αποθήκευση |

---

## 5. Changelog

| Date | Change |
|------|--------|
| 2026-03-19 | Initial implementation: Phase 1 (foundation) + Phase 2 (first migration) |
| 2026-10-01 | Αδελφός μηχανισμός για **μερικές διορθώσεις ανά πεδίο**: `lib/async/field-patch-queue.ts` + `hooks/useFieldPatchQueue.ts` (ADR-898 Φ3β-2) — ίδια ένδειξη και κατάσταση, άλλο συμβόλαιο αποθήκευσης. Καταγράφηκε το χρέος i18n του `formatSaveAge` |
| 2026-10-11 | **§2.5 (νέα) — ρητή αποθήκευση σε κτίρια και έργα· το `useAutoSave` καταργήθηκε** (ADR-912 Εύρημα 8, απόφαση Α). Η αυτόματη εγγραφή στην ενεργή εγγραφή ζούσε δίπλα σε «Αποθήκευση/Ακύρωση»: η Ακύρωση δεν ακύρωνε και ο διάλογος απόρριψης έλεγε ψέματα. Βγήκε από `GeneralTabContent` και `GeneralProjectTab`· διαγράφηκαν `hooks/useAutoSave.ts`, `config/auto-save-config.ts`, `projects/general-tab/hooks/useAutosave.ts`, το module `auto-save-config` του μητρώου SSoT και οι ορφανοί τύποι. Τα κτίρια αποθηκεύουν πλέον με `_v` (`useVersionedSave`). Στα έργα έφυγαν το `autosaved` και το `hasImpactTrackedChanges` (υπήρχαν μόνο για να φρενάρουν την αυτόματη)· η συνδεδεμένη εταιρεία μπήκε στη σύγκριση «έχει αλλαγές». jest: 2 νέες σουίτες, **7/7**· μετάλλαξη **4/4**. ⚠️ **Αμέτρητο σε browser** τη στιγμή της εγγραφής αυτής· έλεγχος τύπων δεν έτρεξε (N.17). 🔶 Ανοιχτά της ίδιας κλάσης: `onAutoSaveFields` των ακινήτων (ADR-236) · φύλαξη αλλαγής επιλογής σε desktop. Το **Β** (πρόχειρο τύπου SAP) μένει για δικό του ADR. Τα κλειδιά `tabs.general.header.saved` και `projectHeader.savedAt` έμειναν χωρίς καταναλωτή στα locales (αφαίρεση μαζί με το CHECK 3.33). |
