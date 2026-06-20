# HANDOFF — Ενοποίηση «settings → legacy style stores» σε ΕΝΑ SSoT single-writer pattern

**Ημερομηνία:** 2026-06-20
**Κατάσταση:** SSOT AUDIT ΕΓΙΝΕ (grep) — υλοποίηση στη ΝΕΑ συνεδρία.
**Εντολή Giorgio:** Revit-grade, FULL ENTERPRISE + FULL SSOT. Commit τον κάνει ο Giorgio.
**⚠️ Working tree μοιράζεται με άλλον agent** → ΜΗΝ αγγίξεις `bim/*`, `structural/*`, `codes/*`.

---

## 0. ΓΙΑΤΙ ΑΥΤΟ ΤΟ HANDOFF (το τρέχον context)
Στην προηγούμενη συνεδρία λύσαμε το «λαβές άλλοτε μεγάλο/μικρό» (ADR-107: SSoT base grip size `GRIP_SIZE_DEFAULT=7` + αφαίρεση νεκρού override) και ΞΕΚΙΝΗΣΑΜΕ την κεντρικοποίηση των grip-store writers: **NEW `stores/grip-style-sync.ts` → `syncGripStyleStoreFromSettings()`** (1 writer, τον καλούν GripProvider×3 + StyleManager).

Ο Giorgio σωστά εντόπισε ότι αυτό είναι **ασύμμετρο**: το ίδιο pattern (settings → store mapping) υπάρχει inline ΚΑΙ για **line / text / completion** στον `StyleManagerProvider`, αλλά δεν κεντρικοποιήθηκε. Στόχος αυτής της δουλειάς: **συμμετρικό, πλήρες SSoT** — ΕΝΑ single-writer pattern για ΟΛΑ τα style stores.

**ΟΛΑ τα παραπάνω είναι UNCOMMITTED** (grip work + αυτό). Ξεκίνα διαβάζοντας τι ήδη υπάρχει.

---

## 1. SSOT AUDIT — ΤΙ ΒΡΕΘΗΚΕ (grep, πραγματικός κώδικας)

### 1.1 Υπάρχουν **4 legacy style stores** που τροφοδοτούνται από settings
| Store | Writer (full mapping) | # πεδία που γράφονται |
|---|---|---|
| `stores/ToolStyleStore.ts` | `StyleManagerProvider.syncLineStore` (inline) | 6 (enabled, strokeColor, lineWidth, opacity, fillColor, lineType) |
| `stores/TextStyleStore.ts` | `StyleManagerProvider.syncTextStore` (inline) | 10 (enabled, fontFamily, fontSize, color, fontWeight, fontStyle, textDecoration, opacity, isSuper/Subscript) |
| `stores/CompletionStyleStore.ts` | `StyleManagerProvider.syncCompletionStore` (inline) | 11 (enabled, color, fillColor, lineWidth, opacity, lineType, dashScale, lineCap, lineJoin, dashOffset, breakAtCenter) |
| `stores/GripStyleStore.ts` | ✅ **ΗΔΗ ΚΕΝΤΡΙΚΟ** `stores/grip-style-sync.ts` `syncGripStyleStoreFromSettings` | 15 |

→ Τα **line/text/completion** είναι ακόμα inline στον `StyleManagerProvider` (γρ. ~51-113). Μόνο το grip κεντρικοποιήθηκε. **ΑΥΤΗ είναι η ασυμμετρία προς διόρθωση.**

### 1.2 ΥΠΑΡΧΟΥΝ **ΔΥΟ παράλληλα συστήματα sync** (το βαθύτερο SSoT πρόβλημα)
1. **Inline (legacy)**: `providers/StyleManagerProvider.tsx` (`syncLineStore`/`syncTextStore`/`syncCompletionStore`/`syncGripStore`) + `providers/GripProvider.tsx`. Γράφουν **FULL** state στα stores.
2. **Hexagonal (ports/adapters)**: `settings/sync/storeSync.ts` (`createStoreSync`) + `settings/sync/adapters/{tool,text,grip,grid,ruler}StyleAdapter.ts` + `settings/sync/ports.ts` + `settings/sync/compositionRoot.ts`. Wire-άρεται από `settings-provider/EnterpriseDxfSettingsProvider.tsx`.

### 1.3 🔴 ΚΡΙΣΙΜΟ: τα ports είναι **LOSSY** — ΔΕΝ μπορούν να αντικαταστήσουν τα full mappings
Από `settings/sync/ports.ts`:
- `ToolStylePort.apply`: μόνο `{stroke, fill, width, opacity, dashArray}` (χάνει lineType, enabled…)
- `TextStylePort.apply`: μόνο `{font, size, color, weight, style}` (χάνει textDecoration, opacity, super/sub…)
- `GripStylePort.apply`: μόνο `{size, color, hoverColor, selectedColor}` (χάνει 11 πεδία: dpiScale, showMidpoints, pickBox, aperture…)

➡️ **Συμπέρασμα:** η «προφανής» λύση «πέτα τους inline, χρησιμοποίησε το storeSync» **ΕΙΝΑΙ ΛΑΘΟΣ** — θα έχανε πεδία. Το authoritative state είναι τα **full inline mappings**. Το ports-path είναι ένα δεύτερο (lossy) μονοπάτι που γράφει υποσύνολο στα ΙΔΙΑ stores (potential last-writer-wins).

### 1.4 Adapters & storeSync ΔΕΝ είναι διπλότυπα του full mapping
- `gripStyleAdapter` / `toolStyleAdapter` / `textStyleAdapter` = γνήσιοι port adapters (partial). `storeSync.ts` = port-based αγωγός. **Διαφορετικός σκοπός** από το full mapping — μην τα μπερδέψεις/σβήσεις.

---

## 2. ΣΤΟΧΟΣ (Revit-grade, FULL SSoT)
Γενίκευσε το **`grip-style-sync.ts` pattern** στα υπόλοιπα 3 stores ώστε **ΚΑΘΕ** «settings → full store state» mapping να ζει σε **ΕΝΑ** σημείο, και οι inline syncers να γίνουν **thin delegations**.

### Προτεινόμενη αρχιτεκτονική (επιβεβαίωσε/βελτίωσε στη νέα συνεδρία)
- **NEW** `stores/style-store-sync.ts` (ή φάκελος `stores/style-sync/` με 1 αρχείο/store + `index.ts`), που εξάγει:
  - `syncToolStyleStoreFromSettings(line: LineSettings)`
  - `syncTextStyleStoreFromSettings(text: TextSettings)`
  - `syncCompletionStyleStoreFromSettings(line: LineSettings)`
  - `syncGripStyleStoreFromSettings(grip: GripSettings)` ← **ΜΕΤΑΚΙΝΗΣΕ εδώ** το υπάρχον από `grip-style-sync.ts` (ή κράτα το αρχείο και κάν' το re-export — αποφάσισε με Giorgio· **μη δημιουργήσεις δεύτερο grip writer**).
- `StyleManagerProvider.syncLineStore/syncTextStore/syncCompletionStore/syncGripStore` → καθένα **μία γραμμή** delegation στον αντίστοιχο SSoT writer.
- Κράτα τα type imports σωστά (το `getEffective*Settings()` επιστρέφει τα πλήρη domain types — δες πώς διορθώθηκε ο grip τύπος: `rendering/types/Types` → `types/gripSettings`).

### Open decision (ρώτησε Giorgio ΠΡΙΝ τον κώδικα)
**Τι κάνουμε με το lossy ports-path (`storeSync.ts`/adapters);**
- (A) **Άφησέ το** ως 2ο μονοπάτι (ελάχιστο scope, αλλά το διπλό-writer/last-writer-wins παραμένει latent). 
- (B) **Κάνε τους adapters να καλούν τους νέους full writers** (τα `*StyleStore.set(updates)` μέσα στους adapters → delegate), ώστε ΕΝΑ μονοπάτι. Πρόσεξε: τα ports δίνουν partial input → χρειάζεται merge με υπάρχον state, ΟΧΙ full overwrite. Μεγαλύτερο scope.
- (C) **Κατάργησε** εντελώς το ports-path αν είναι ανενεργό/redundant (απαιτεί επιβεβαίωση ότι δεν το χρησιμοποιεί κανείς runtime — grep `createStoreSync`/`pushFromSettings` σε `EnterpriseDxfSettingsProvider`, `DxfViewerApp`).

**Σύσταση:** ξεκίνα με τη **συμμετρική γενίκευση (Στόχος §2)** που είναι ασφαλής & καθαρό SSoT win, και βάλε το ports-convergence ως ξεχωριστή απόφαση/φάση.

---

## 3. ΥΠΟΧΡΕΩΤΙΚΟ — ΞΑΝΑΚΑΝΕ SSOT AUDIT (grep) ΠΡΙΝ ΓΡΑΨΕΙΣ
1. `grep "syncGripStyleStoreFromSettings"` → δες ότι το grip είναι ήδη κεντρικό (μην το διπλασιάσεις).
2. Διάβασε `providers/StyleManagerProvider.tsx` (syncLineStore/syncTextStore/syncCompletionStore — τα full mappings).
3. Διάβασε `stores/{ToolStyleStore,TextStyleStore,CompletionStyleStore}.ts` (το σχήμα-στόχος + τυχόν circular-import περιορισμοί — δες πώς το grip leaf αποφεύχθηκε).
4. `grep "toolStyleStore.set|textStyleStore.set|completionStyleStore.set"` → όλοι οι writers (υπάρχουν ΚΑΙ writers εκτός StyleManager, π.χ. `ui/OverlayToolbar.tsx`, `ui/components/DraggableOverlayToolbar.tsx` γράφουν `toolStyleStore.set` — **ΑΥΤΟΙ είναι UI-driven, ΟΧΙ settings-sync· μην τους αγγίξεις, δεν είναι μέρος του pattern**).
5. Επιβεβαίωσε types: `LineSettings`/`TextSettings` από `settings-core/types`, `GripSettings` από `types/gripSettings`.

---

## 4. ΑΡΧΕΙΑ-ΚΛΕΙΔΙΑ
- `src/subapps/dxf-viewer/stores/grip-style-sync.ts` — **ΤΟ ΠΡΟΤΥΠΟ** (ήδη υπάρχει· single full-mapping writer)
- `src/subapps/dxf-viewer/providers/StyleManagerProvider.tsx` — οι 3 inline syncers προς κεντρικοποίηση (+ ο grip ήδη delegating)
- `src/subapps/dxf-viewer/providers/GripProvider.tsx` — ήδη delegating (πρότυπο χρήσης)
- `src/subapps/dxf-viewer/stores/{ToolStyleStore,TextStyleStore,CompletionStyleStore,GripStyleStore}.ts` — τα σχήματα-στόχοι
- `src/subapps/dxf-viewer/settings/sync/{storeSync.ts,ports.ts,compositionRoot.ts,adapters/*}` — το ΔΕΥΤΕΡΟ (lossy) σύστημα (open decision §2)
- ADR: **ADR-107** (UI size defaults — εκεί μπήκε το grip SSoT· πρόσθεσε εδώ ή σε νέο ADR το store-sync unification — αποφάσισε με βάση scope)

## 5. ΤΙ ΝΑ ΜΗΝ ΚΑΝΕΙΣ
- ΜΗΝ «ενοποιήσεις στο storeSync/ports» χωρίς merge — τα ports είναι **lossy** (§1.3), θα χάσεις πεδία.
- ΜΗΝ δημιουργήσεις 2ο grip writer — υπάρχει ήδη `grip-style-sync.ts`.
- ΜΗΝ αγγίξεις τους UI-driven `toolStyleStore.set` σε OverlayToolbar/DraggableOverlayToolbar (διαφορετικό concern).
- ΜΗΝ αγγίξεις `bim/*`, `structural/*`, `codes/*` (shared tree, άλλος agent).
- ΜΗΝ κάνεις commit — ο Giorgio το κάνει.
- Πρόσεξε circular imports (το grip SSoT χρειάστηκε zero-import leaf `config/grip-size-default.ts` γι' αυτόν τον λόγο).

## 6. TESTS
- Πρότυπο: `config/__tests__/grip-size-default-ssot.test.ts`. Πρόσθεσε regression test ότι κάθε `sync*StyleStoreFromSettings` γράφει **όλα** τα πεδία (anti-partial-write guard).
- Τρέξε στοχευμένα: grip/settings/storeSync/StyleManager/provider suites.
- **Pre-existing fails ΟΧΙ δικά σου** (committed bim/*): `beam-grips.test.ts #26` (rotation), `grip-commit-alt-bypass.test.ts` (mock `getEntity`).
- ⚠️ N.17: ΕΝΑ tsc τη φορά (shared tree) — έλεγξε πρώτα αν τρέχει άλλος.

## 7. ΣΧΕΤΙΚΑ ΕΚΚΡΕΜΗ (context)
- `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`: το ADR-107 grip entry (UNCOMMITTED) — αυτή η δουλειά είναι συνέχειά του.
- Memory: `reference_grip_size_default_ssot.md`.
