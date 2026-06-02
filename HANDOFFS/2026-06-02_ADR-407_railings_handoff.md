# HANDOFF — ADR-407: Κάγκελα / Κιγκλιδώματα (Railings) ως πλήρες BIM στοιχείο

**Ημερομηνία:** 2026-06-02
**Συντάκτης:** Opus 4.8 (μετά από έρευνα industry + RECOGNITION του υπάρχοντος χειρολισθήρα σκάλας)
**Στόχος συνεδρίας:** Σύνταξη **νέου ADR-407** για τα κάγκελα/κιγκλιδώματα (design doc — ΟΧΙ απαραίτητα υλοποίηση· δες §Scope).
**Γλώσσα:** Ελληνικά πάντα (ο Giorgio γράφει/διαβάζει ελληνικά).
**Commit/push:** **ΜΟΝΟ ο Giorgio.** Ο agent ΔΕΝ κάνει commit/push (N.(-1)).
**⚠️ Shared working tree:** `git add <specific>` ΜΟΝΟ — ΠΟΤΕ `git add -A`. Άλλος agent δουλεύει ταυτόχρονα (βλ. §Multi-agent).
**ADR αριθμός:** **ADR-407** (επόμενος ελεύθερος — ADR-405/406 πιάστηκαν από MEP). Επιβεβαίωσε στο `adr-index.md` πριν.
**Workflow:** ADR-DRIVEN (N.0.1) — **PHASE 1 RECOGNITION πρώτα** (διάβασε ΚΩΔΙΚΑ, όχι μόνο αυτό το handoff).

---

## 🎯 ΤΙ ΖΗΤΑΕΙ Ο GIORGIO

Νέο ADR για τα **κάγκελα** ως **πλήρες BIM στοιχείο** — όπως το αντιμετωπίζουν οι μεγάλοι (Revit/ArchiCAD/IFC), όχι το απλό «handrail tube» που υπάρχει σήμερα στη σκάλα.

Ο Giorgio ακολουθεί πάντα: **«δες πρώτα τι κάνουν οι μεγάλοι παίχτες» + industry convergence = default answer** (βλ. memory `feedback_industry_standard_default`, `feedback_completeness_over_mvp`).

---

## 🌍 INDUSTRY FRAMING (συμφωνημένο με Giorgio σε αυτή τη συνεδρία)

**Είναι BIM; ΝΑΙ** — υπάρχει `IfcRailing` με `PredefinedType`:
- `HANDRAIL` (χειρολισθήρας/κουπαστή), `GUARDRAIL` (στηθαίο ασφαλείας), `BALUSTRADE` (κιγκλίδωμα με μπαλούστρα).

**Τι είναι για τους μεγάλους:** **παραμετρική συναρμολόγηση πολλών εξαρτημάτων που παράγεται κατά μήκος διαδρομής (path-based assembly)** — ΟΧΙ ένα στερεό. Δίνεις (α) διαδρομή/ακμή + (β) Τύπο → γεννιούνται αυτόματα όλα τα μέλη.

**Components:** posts (στύλοι/ορθοστάτες) · balusters (μπαλούστρα/κάγκελα — κατακόρυφα) · top rail (κουπαστή) · handrail (χειρολισθήρας, με returns στα άκρα) · ενδιάμεσες ράγες · infill panels (γυαλί/πλέγμα).

**Πώς το κάνει ο καθένας:**
- **Revit**: Railing = **System Family** (όπως Τοίχος/Σκάλα). Τύπος με 2 κλειδιά: **Rail Structure** + **Baluster Placement** (μοτίβο/βήμα/posts/«ανά σκαλοπάτι»). Top Rail & Handrail = αυτόνομα υπο-στοιχεία (από 2013).
- **ArchiCAD**: εργαλείο Railing — ιεραρχικό (segments→posts/rails/panels/balusters/handrails), **associative** σε πλάκες/σκάλες.
- **Tekla**: κυρίως **μεταλλικά** via custom component/macro → posts+rails ως steel members **με συνδέσεις**.

**Hosting & associativity (το κλειδί):** το κάγκελο **φιλοξενείται** σε σκάλα/ράμπα (ακολουθεί κλίση/σκαλοπάτια) **ή** σχεδιάζεται σε ακμή πλάκας/μπαλκονιού. Αν αλλάξει ο host → αναπροσαρμόζεται. **Σου θυμίζει το ADR-401 attach-to-structural** — ίδια λογική.

**Κανονιστικά (να μπουν ως type params με validation):** ύψος guardrail ~**1.00–1.10 m** · κενό μπαλούστρων ≤ **100 mm** («κανόνας σφαίρας 10cm», Eurocode/IBC/κτιριοδομικός) · οριζόντιο φορτίο κουπαστής (~0.5–1.0 kN/m).

---

## 🔍 RECOGNITION — ΥΠΑΡΧΩΝ ΧΕΙΡΟΛΙΣΘΗΡΑΣ ΣΚΑΛΑΣ (code = source of truth)

Σήμερα ο χειρολισθήρας είναι **υπο-εξάρτημα της σκάλας** (ΟΧΙ ξεχωριστή οντότητα) — το **απλούστερο κομμάτι** ενός `IfcRailing`:

| Αρχείο | Τι κάνει |
|---|---|
| `bim/types/stair-types.ts:165` | `StairHandrails { inner, outer (bool), height (900mm), topExtension?, bottomExtension? }` — μέρος του `StairParams`. `StairHandrailGeometry { inner?, outer?: Polyline3D }`. |
| `bim/geometry/stairs/stair-geometry-shared.ts:189` | `buildHandrailsFromParams` — η γεωμετρία = **walkline offset ±μισό πλάτος** (ίδια διαδρομή με stringers), **μία πολυγραμμή** ανά πλευρά. SSoT, καλείται από ΟΛΑ τα stair kinds (helical/gamma/lshape/ushape/elliptical/...). |
| `bim-3d/converters/StairToThreeConverter.ts:234` | `buildHandrailMeshes` → ανά πλευρά **ένας `TubeGeometry`** (ακτίνα 25mm) στα 900mm. Tag `handrail-inner/outer`. |
| `bim/renderers/StairRenderer.ts:302` | `drawHandrails` — 2Δ κάτοψη: η πολυγραμμή ως **λεπτή διακεκομμένη** + ADA προεκτάσεις (305mm top / one-tread bottom). |

**Τι ΛΕΙΠΕΙ vs μεγάλοι:** κανένας στύλος · κανένα μπαλούστρο/κάγκελο · ΟΧΙ διάκριση top-rail/handrail · ΟΧΙ infill · μόνο σε σκάλα (όχι σε πλάκα/μπαλκόνι) · ΟΧΙ ξεχωριστή BIM οντότητα/Type. **Καλή βάση, αλλά απέχει από πλήρες `IfcRailing`.**

---

## ❓ ΑΠΟΦΑΣΕΙΣ ΠΡΟΣ ΣΥΖΗΤΗΣΗ ΜΕ GIORGIO (στην αρχή της νέας συνεδρίας)

Αυτές καθορίζουν το ADR — **ρώτησέ τον με AskUserQuestion πριν γράψεις**:

1. **Αρχιτεκτονική οντότητας:** Νέο **standalone `RailingEntity`** (path-based, σαν τους μεγάλους) **vs** επέκταση του υπάρχοντος `StairHandrails`; (Πρόταση/industry: standalone RailingEntity + το stair handrail γίνεται special-case ή migrate.)
2. **Scope v1:** Μόνο πάνω σε **σκάλα**, ή **και σε ακμή πλάκας/μπαλκονιού** (standalone path); 
3. **Components v1:** posts + balusters + top rail (το minimum «κιγκλίδωμα»), με infill panels (γυαλί/πλέγμα) deferred; Ή πλήρες από την αρχή (ο Giorgio συνήθως θέλει completeness — βλ. memory).
4. **Type system:** «Railing Type» (Rail Structure + Baluster Placement) σαν Revit, ή flat params v1;
5. **Hosting/attach:** reuse του **ADR-401 attach-to-structural coordinator** (host=σκάλα/πλάκα → follow); 
6. **Κανονισμοί:** ποια όρια ψήνουμε (ύψος 1.0-1.1m, κενό ≤100mm) ως validated params;
7. **IFC mapping:** `IfcRailing` + PredefinedType — να μπει στο ADR για future export.

---

## 🧱 SSoT / REUSE POINTERS (για το ADR & μελλοντική υλοποίηση)

- **Entity registration pattern** (πώς δηλώνεται νέο BIM entity end-to-end): μελέτησε πώς έγινε ΚΟΛΩΝΑ/ΔΟΚΑΡΙ — `bim/types/*-types.ts` + `*.schemas.ts` (Zod) + `enterprise-id.service.ts` generator (N.6) + ToolType (`ui/toolbar/types.ts`) + `systems/tools/tool-definitions.ts` + ribbon (`ui/ribbon/data/home-tab-draw.ts`) + persistence hook + audit-client (ADR-379/380) + 2Δ renderer + 3Δ converter + validators + `bim-to-atoe-mapping.ts` (BOQ) + `bim-object-styles.ts`/lineweights (ADR-375).
- **Path/offset geometry**: `offsetPolyline` + `buildHandrailsFromParams` (stair-geometry-shared.ts) — βάση για baluster placement κατά μήκος διαδρομής.
- **Attach-to-structural**: ADR-401 (`entity-attach-detach.ts`, `*-structural-attach-coordinator`, `useStructuralAutoAttach`) — πρότυπο για host-follow.
- **3Δ tube/extrude**: `StairToThreeConverter.handrailTube` (TubeGeometry) — βάση για rails· instancing για επαναλαμβανόμενα μπαλούστρα.

---

## 📦 SCOPE ΤΗΣ ΣΥΝΕΔΡΙΑΣ

Ο Giorgio ζήτησε **«να γράψουμε ένα νέο ADR»** → το **deliverable είναι το έγγραφο ADR-407** (design: framing + αποφάσεις + αρχιτεκτονική + φάσεις υλοποίησης + IFC/BOQ/2Δ/3Δ plan). **Όχι κώδικας** σε αυτή τη φάση, εκτός αν ο Giorgio το ζητήσει ρητά μετά. Πιθανώς **Plan Mode** για να συμφωνήσετε δομή πριν γράψεις το ADR.

**N.15 trackers (όταν ολοκληρωθεί το ADR):** `adr-index.md` (entry ADR-407) · `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` · memory (νέο topic `project_adr407_railings.md` + MEMORY.md index).

---

## 🤖 MULTI-AGENT STATE (κρίσιμο — διάβασέ το)

- **Άλλος agent δουλεύει ταυτόχρονα** σε **ADR-405/406 (MEP discipline taxonomy + light fixtures)**. Πρόσθεσε πεδίο **`fixtures` στο `Bim3DEntities`** → υπάρχει **1 tsc error** στο `hooks/data/useFloors3DAggregator.ts(96)` («Property 'fixtures' is missing») που είναι **ΔΙΚΟ ΤΟΥ, ΟΧΙ δικό σου**. **ΜΗΝ το αγγίξεις/διορθώσεις** (memory `feedback_never_checkout_other_agent_files`, `feedback_multi_agent_*`).
- **ADR-363 Φ3c «Κολώνα από περίγραμμα»** ολοκληρώθηκε στην προηγούμενη συνεδρία (Opus), **pending commit από Giorgio** — μην το ξαναφτιάξεις. Tsc καθαρό στα δικά του αρχεία. Βλ. memory `project_adr363_from_perimeter_walls` (Φ3c) + `HANDOFFS/2026-06-01_ADR-363_column-from-perimeter_handoff.md`.
- Όταν έρθει commit: **`git add` ΜΟΝΟ τα δικά σου** + έλεγξε `git diff --cached`.
