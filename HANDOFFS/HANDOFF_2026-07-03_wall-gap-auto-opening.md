# HANDOFF — Νέα εντολή: «Γεφύρωση ομοαξονικών τοίχων με αυτόματο κούφωμα στο κενό»

**Ημερομηνία:** 2026-07-03
**Status:** 🔵 NOT STARTED — προς υλοποίηση σε ΝΕΑ συνεδρία (καθαρό context)
**Επόμενο ADR:** **ADR-568** (τελευταίο = ADR-567)
**Commit:** ⚠️ ΤΟΝ ΚΑΝΕΙ Ο GIORGIO — ΠΟΤΕ εσύ (N.(-1)).
**Working tree:** ⚠️ ΜΟΙΡΑΖΕΤΑΙ με άλλον agent — άγγιξε ΜΟΝΟ τα αρχεία της δικής σου feature, μη κάνεις `git add -A`, μη σβήσεις ξένες αλλαγές.

---

## 🎯 ΤΙ ΘΕΛΕΙ Ο GIORGIO (feature)

**Σενάριο (από screenshot 2026-07-03 171856):** Δύο τοίχοι **ομοαξονικοί** (πάνω στην ίδια ευθεία/άξονα) που **απέχουν** μεταξύ τους ένα κενό (σημειωμένοι «1» και «2» με κόκκινο-πράσινο).

**Νέα εντολή** (ΞΕΧΩΡΙΣΤΗ από την υπάρχουσα «Ένωση Τοίχων»):
- Επιλέγω 2 ομοαξονικούς τοίχους με κενό ανάμεσα.
- Η εντολή δημιουργεί **ΕΝΑΝ και μοναδικό συνεχόμενο τοίχο** που γεφυρώνει το κενό.
- **Μέσα στο κενό τοποθετείται αυτόματα ένα πραγματικό BIM κούφωμα** (`OpeningEntity`):
  - **πλάτος** = η απόσταση (κενό) των δύο τοίχων,
  - **ύψος** = όπως ορίζει ο **Νέος Οικοδομικός Κανονισμός (ΝΟΚ)**,
  - από πάνω μένει τοίχος = **στέψη/υπέρθυρο (lintel)** — δηλαδή ο ενιαίος τοίχος καλύπτει το άνω μέρος, το κούφωμα είναι η «τρύπα» στο άνοιγμα.

**Δηλαδή:** ένας ενιαίος τοίχος + αυτόματο opening στη θέση του πρώην κενού (Revit «Wall + hosted door/window», όχι 2 κομμάτια).

### ⚠️ Αποφάσεις που ΠΡΕΠΕΙ να ρωτήσεις τον Giorgio ΠΡΙΝ (lead με συγκεκριμένο αριθμητικό παράδειγμα — προτιμά γεωμετρία/νούμερα, όχι αφηρημένα):
1. **Τύπος κουφώματος:** πόρτα (φτάνει στο δάπεδο, χωρίς στηθαίο) ή παράθυρο (με στηθαίο); Ή αυτόματα ανάλογα με το ύψος;
2. **Ύψος ΝΟΚ:** ποια ακριβώς τιμή; (π.χ. πόρτα ΝΟΚ ελ. ύψος 2.20 m· παράθυρο; στηθαίο;). Χρειάζεται σταθερά config — **δεν βρέθηκε υπάρχον ΝΟΚ height** (βλ. SSoT audit).
3. **Ελάχιστο/μέγιστο κενό:** από ποια απόσταση κενού ενεργοποιείται; (πολύ μικρό κενό = δεν βγάζει κούφωμα;).
4. **Trigger:** νέο κουμπί στο contextual «Ιδιότητες Τοίχου» tab (δίπλα στο «Ένωση Τοίχων»); Command-first + selection-first όπως το merge;

---

## 📋 ΚΑΝΟΝΕΣ ΥΛΟΠΟΙΗΣΗΣ (Giorgio, non-negotiable)

1. **Big-player first:** υλοποίησέ το όπως **Revit / Maxon (Cinema 4D) / Figma-level**. FULL ENTERPRISE + FULL SSOT. Αν οι μεγάλοι παίκτες ΔΕΝ προτείνουν κάτι, ακολούθησε **την πρακτική τους**.
2. **ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep) ΠΡΙΝ γράψεις ΓΡΑΜΜΗ κώδικα** — βρες τον υπάρχοντα κώδικα και **reuse**, ΜΗΔΕΝ διπλότυπα. (Pointers παρακάτω — αλλά κάνε ΚΑΙ δικό σου grep, ίχνευσε ΟΛΟ το pipeline event→command→persist, όχι isolated hooks.)
3. **ADR-driven (N.0.1):** Phase 1 recognition (διάβασε ΤΟΝ ΚΩΔΙΚΑ που τρέχει, όχι μόνο ADR), δημιούργησε **ADR-568**, ενημέρωσε adr-index (2 πίνακες).
4. **Enterprise TS:** όχι `any`/`as any`/`@ts-ignore`. Enterprise IDs για κάθε νέα οντότητα (`enterprise-id.service`). i18n keys ΠΡΙΝ τον κώδικα (el+en). **ΜΗΝ** τρέχεις `tsc` (N.17) — jest OK.
5. **Commit + browser-verify:** τα κάνει ο Giorgio. Εσύ σταματάς όταν έτοιμο + του δίνεις οδηγίες verify.

---

## 🔍 SSoT AUDIT — ΥΠΑΡΧΩΝ ΚΩΔΙΚΑΣ ΠΡΟΣ REUSE (επιβεβαίωσέ τον με grep/read)

### Υπάρχουσα «Ένωση Τοίχων» (ADR-566) — ΤΟ ΠΙΟ ΚΟΝΤΙΝΟ ΠΡΟΤΥΠΟ (μίμησέ το, ΜΗΝ το αλλάξεις)
| Ρόλος | Αρχείο |
|---|---|
| UI button («Ένωση Τοίχων») | `ui/ribbon/data/contextual-wall-tab.ts:~491` (`id: 'wall.merge'`, tool `wall-merge`) |
| Tool (command-first + selection-first) | `hooks/tools/useWallMergeTool.ts` |
| **Core geometry** | `bim/walls/wall-merge.ts` — `canMergeWalls` (collinear + same-thickness gate), `buildMergedWallParams`, `collectMergedOpenings` |
| Undoable command | `core/commands/entity-commands/WallMergeCommand.ts` |
| Persistence + event | `hooks/data/useWallMergePersistence.ts`, event `bim:wall-merge-committed` |

➡️ Η νέα εντολή είναι **αδελφή** του merge: ίδιο gate «ομοαξονικοί» (reuse `canMergeWalls` λογική **αλλά με ΚΕΝΟ αντί επαφής** — ο υπάρχων merge ίσως απαιτεί touching· ίχνευσέ το), ίδιο command/persistence pattern, ίδιο UI pattern.

### Openings (κούφωμα BIM) — για το αυτόματο opening στο κενό
| Ρόλος | Αρχείο |
|---|---|
| Τύποι + params | `bim/types/opening-types.ts` (`OpeningEntity`, `OpeningParams`, `OpeningKind`) |
| Geometry | `bim/geometry/opening-geometry.ts` (`computeOpeningGeometry(params, hostWall)`) |
| **Re-host SSoT** | `bim/walls/opening-host-patch.ts` — `applyOpeningHostPatch(sceneManager, openingId, params)` (ξαναδένει opening σε host wall — reuse για να δέσεις το νέο opening στον ενιαίο τοίχο) |
| Opening updates κατά merge/split | `bim/walls/wall-split.ts` (`OpeningUpdate`), `collectMergedOpenings` |
| Family-type defaults (πλάτος/ύψος) | `bim/family-types/built-in-types.ts`, `auto-opening-type-wiring` |
| Opening creation flow (host click) | grep: `completeOpeningFromHostClick`, `buildOpeningResolvers` (ADR-533 «DXF σύμβολο→opening» — ΙΔΙΟ pattern «φτιάξε opening σε host wall»· reuse τους resolvers) |

### ΝΟΚ ύψος — ⚠️ ΔΕΝ ΒΡΕΘΗΚΕ υπάρχον config
Grep για `NOK`/`ΝΟΚ`/`buildingRegulation`/`defaultOpeningHeight` → **τίποτα ρητό**. Πιθανώς πρέπει να δημιουργήσεις σταθερά config (π.χ. `config/building-regulation.ts` ή μέσα σε opening family-type defaults). Ρώτα τον Giorgio την τιμή. Έλεγξε `bim/family-types/built-in-types.ts` για υπάρχοντα default door/window ύψη πρώτα.

### Χρήσιμα SSoT (ADR-567, μόλις ολοκληρώθηκε — ίδιο domain)
- `bim/placement/structural-placement-overlap.ts` — `findStructuralOverlap` / `structuralFootprintOf` (no-overlap guard· ίσως χρειαστεί να **εξαιρέσεις** το νέο opening/merge από τον έλεγχο).

---

## ⚠️ SHARED WORKING TREE — UNCOMMITTED (μην τα αγγίξεις, δεν είναι δικά σου)

Το ADR-567 («καμία δομική οντότητα πάνω σε υπάρχουσα») μόλις ολοκληρώθηκε **UNCOMMITTED** (θα το commit-άρει ο Giorgio). Αρχεία που ΑΝΗΚΟΥΝ σε αυτό (ΜΗΝ τα πειράξεις/revert-άρεις):
- `bim/placement/structural-placement-overlap.ts` (+ `__tests__/`)
- `bim/scene/append-entity-to-scene.ts`, `bim/walls/add-wall-to-scene.ts`
- `bim/framing/scene-snap-targets.ts` (πεδίο `structuralEntities`)
- `hooks/drawing/wall-ghost-build.ts`, `hooks/canvas/useRegionPerimeterMouseMove.ts`
- `systems/region-preview/RegionPerimeterPreviewStore.ts`, `components/dxf-layout/RegionPerimeterPreviewOverlay.tsx`
- `systems/events/drawing-event-map-bim.ts` (`bim:placement-blocked`), `hooks/notifications/perimeter-build-notifications.ts`
- `i18n/locales/{el,en}/dxf-viewer-shell.json` (`placementBlock.*`)
- `docs/.../adrs/ADR-567-*.md` + adr-index

**⚠️ Πιθανή αλληλεπίδραση:** ο ADR-567 guard μπλοκάρει τοποθέτηση τοίχου πάνω σε τοίχο. Η νέα σου εντολή δημιουργεί ενιαίο τοίχο πάνω από το κενό — βεβαιώσου ότι ΔΕΝ μπλοκάρεται λανθασμένα (το merge αντικαθιστά τους 2 παλιούς, οπότε ελέγξου με `excludeIds` ή σειρά delete-πριν-create). Το `wall-merge.ts` ήδη το χειρίζεται — μίμησέ το.

---

## ✅ DEFINITION OF DONE
- ADR-568 + adr-index (2 πίνακες).
- SSoT reuse (wall-merge pattern + opening-host-patch + opening family defaults), μηδέν διπλότυπα.
- Νέο κουμπί στο contextual wall tab + i18n (el+en).
- jest (colocated) για το geometry (gap detection, opening width=gap, ύψος ΝΟΚ, ένας τοίχος).
- Undoable command + persistence (mirror WallMergeCommand).
- Οδηγίες browser-verify στον Giorgio. Commit → Giorgio.
