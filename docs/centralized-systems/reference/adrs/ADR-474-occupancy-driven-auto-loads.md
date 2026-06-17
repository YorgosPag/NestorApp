# ADR-474 — Occupancy-Driven Auto Structural Loads (zero-input area loads)

**Status:** 🟢 DONE (UNCOMMITTED 2026-06-17 Opus) · **Σχετικά:** ADR-464/467 (load takedown / load path), ADR-472 (load-aware reinforcement), ADR-456 (structural settings).
**Ημ/νία:** 2026-06-17 · **Γλώσσα:** Ελληνικά.

---

## 1. Context — γιατί

Στόχος Giorgio: *ο μηχανικός να παρεμβαίνει όσο το δυνατόν λιγότερο — Revit-grade αυτοματισμός.*
Μετά τα ADR-464/467 (tributary takedown) + ADR-472 (load-aware οπλισμός), η αλυσίδα
**γεωμετρία → φορτία → οπλισμός → πέδιλο** είναι αυτόματη — **εκτός** από μία είσοδο:

- `deadAreaLoadKpa` / `liveAreaLoadKpa` (`structural-settings`) ήταν **optional χωρίς default**
  (`absent → 0 → takedown αδρανής`). Δηλαδή ο μηχανικός **έπρεπε να πληκτρολογήσει kPa** αλλιώς
  δεν υπολογίζονταν καθόλου φορτία. Η ΜΟΝΗ χειροκίνητη παρέμβαση στη ροή.

## 2. Decision — occupancy → auto G/Q, explicit-wins

**NEW SSoT** `bim/structural/loads/occupancy-loads.ts` (pure, zero deps):

- `OccupancyCategory` = υποσύνολο EN1991-1-1 §6.3.1 (A κατοικία / B γραφείο / C συνάθροιση /
  D εμπόριο / E αποθήκη). **Default = κατοικία** → πλήρης αυτοματισμός χωρίς καμία επιλογή.
- `OCCUPANCY_IMPOSED_KPA` — χαρακτηριστικό **q_k** ανά κατηγορία (EN1991-1-1 Table 6.2:
  A=2.0, B=3.0, C=5.0, D=5.0, E=7.5). Εθνικό παράρτημα → DEFER.
- `resolveDefaultDeadLoadKpa(slabThicknessMm?)` — αυτόματο **g_k** = ίδιο βάρος πλάκας
  (t·25 kN/m³) + επιστρώσεις (1.5) + κινητά χωρίσματα (1.0, EN1991-1-1 §6.3.1.2). Default πάχος 200mm
  → 7.5 kPa.
- **`resolveEffectiveAreaLoads({explicitDeadKpa?, explicitLiveKpa?, occupancy?, slabThicknessMm?})`**
  — **ΕΝΑ SSoT** επίλυσης: ρητή building-level kPa **κερδίζει** (Revit override)· αλλιώς αυτόματο
  default. Το μοιράζονται ΟΛΟΙ οι takedown triggers (proactive Φ9 + ribbon) → αφαιρέθηκε το διπλό
  `?? 0` (boy-scout N.0.2).

**Wiring:** `StructuralSettings += occupancy?` (building-level, persist `buildings/{id}.structuralSettings`)·
store `setOccupancy` + `loadForBuilding`· οι 2 hooks (`useProactiveStructuralLoads`,
`useStructuralLoadTakedown`) καλούν `resolveEffectiveAreaLoads`. **Μηδέν αλλαγή** στον takedown core
(παίρνει ήδη resolved kPa).

## 3. Συμπεριφορά / backward-compat

- **Υπάρχοντα κτίρια με ρητά kPa** → αμετάβλητα (explicit κερδίζει).
- **Κτίρια χωρίς kPa** → πλέον παίρνουν **αυτόματα** φορτία (residential default) → ο takedown
  ενεργοποιείται μόνος του (πριν: αδρανής). Αυτό είναι το ζητούμενο feature, όχι regression.
- Ο επανυπολογισμός είναι ντετερμινιστικός (μηδέν feedback) → καμία αλληλεπίδραση με τον
  S3 convergence guard (ADR-472).

## 3β. Edge tributary realism (Revit-grade, 2026-06-17) — καμία mirror στην περίμετρο

Παρατήρηση Giorgio σε browser-verify: 4 κολώνες σε φάτνωμα 10×10 → υπερβολικά μεγάλα πέδιλα
(3.15×3.15 m). Ρίζα: το `tributaryWidth` (`load-takedown.ts`, ADR-464) **καθρέφτιζε** (mirror) το
half-spacing στις ακραίες κολώνες → κάθε γωνιακή έπαιρνε **ολόκληρο** φάτνωμα (100 m²) αντί του
πραγματικού **¼** (25 m²) → 4× φορτίο → 4× μεγαλύτερα πέδιλα. Η διαστασιολόγηση πεδίλου (A=N/σ) ήταν
**σωστή** — το **φορτίο** ήταν υπερ-συντηρητικό (πιο πολύ από τη Revit).

**Fix (Revit-grade):** half-bay **μόνο** προς υπαρκτό γείτονα· εξωτερική πλευρά ακραίας = **0** (slab
edge στον άξονα). Αποτέλεσμα ratios 1:2:4 (γωνία : ακμή : εσωτερική) — όπως η κλασική tributary
μέθοδος. Μεμονωμένος άξονας → `DEFAULT_BAY_SPAN_M` (αμετάβλητο). `storeyCount` ανέγγιχτο (= σωστός
πολλαπλασιαστής δηλωμένου κτιρίου). Slab overhang/πρόβολος = DEFER.

**Επίδραση:** για 4-κολώνο φάτνωμα 10×10, 3 όροφοι → κάθε κολώνα 25 m²×3 → πέδιλα ~1.6×1.6 m
(ρεαλιστικά). Το `computeFootingTakedownLoads` (ADR-464 oracle) χρησιμοποιεί το ίδιο tributary →
regression test παραμένει συνεπές (αλλάζουν μαζί). 76 loads/footing jest GREEN.

## 4. Όρια / DEFER (100% ειλικρίνεια)

- **Occupancy UI selector:** δεν υπάρχει σήμερα structural-settings panel στον viewer που να
  εκθέτει G/Q/soil setters. Το override γίνεται μέσω του store/building doc. Ο selector (Radix
  Select, ADR-001) = thin follow-up όταν αποφασιστεί host panel. Default residential → ο
  αυτοματισμός δουλεύει χωρίς αυτόν.
- **Αντιπροσωπευτικό πάχος πλάκας:** default 200mm (δεν παράγεται από τις πραγματικές πλάκες της
  σκηνής ακόμη) — slab-derived g_k = follow-up.
- **Per-room occupancy / mixed-use:** building-level μόνο (όπως τα kPa σήμερα). Per-area = DEFER.
- Εθνικό παράρτημα q_k, μειωτικοί συντελεστές α_n/α_A (EN1991-1-1 §6.3.1.2) = DEFER.

## 5. SSoT reuse (μηδέν διπλότυπα)

- Combinations: υπάρχον `EN1990_ULS_FACTORS` (ADR-472).
- Takedown: υπάρχον `computeMemberTakedown` / `areaLoadResultant` (ADR-464) — ανέγγιχτα.
- Settings: επέκταση `StructuralSettings` + store (ΟΧΙ νέο σύστημα).
- Resolver: ΕΝΑ `resolveEffectiveAreaLoads` αντικατέστησε το διπλό `?? 0` σε 2 hooks.

## 6. Tests

`bim/structural/loads/__tests__/occupancy-loads.test.ts` (NEW): q_k ανά κατηγορία + default· g_k
auto από πάχος πλάκας (μονοτονία)· `resolveEffectiveAreaLoads` explicit-wins / auto / occupancy-drives /
invalid-falls-to-auto. Regression: structural-settings-store + takedown suites GREEN.

## 7. Changelog

- **2026-06-17 (edge tributary realism, UNCOMMITTED):** `tributaryWidth` (`load-takedown.ts`) — καμία
  mirror στην περίμετρο· ακραία/γωνιακή κολώνα παίρνει πραγματικό ¼/½ φάτνωμα (ratios 1:2:4). Έλυσε
  υπερμεγέθη πέδιλα σε γωνιακές κολώνες (4× φορτίο). `storeyCount` αμετάβλητο. Βλ. §3β. (ADR-464/467
  shared tributary· cross-ref στα changelogs τους.)
- **2026-06-17 (υλοποίηση, UNCOMMITTED):** NEW `occupancy-loads.ts` SSoT (q_k EN1991-1-1 + auto g_k +
  `resolveEffectiveAreaLoads`)· `StructuralSettings += occupancy`· store `setOccupancy`· 2 hooks wired
  (boy-scout dedupe `?? 0`). Default residential → zero-input φορτία. UI selector = follow-up (§4).
