# ADR-734: Agent Capability Layer — Ο Νέστωρ ως Εργαλείο για Πράκτορες

**Ημερομηνία:** 2026-07-30
**Κατάσταση:** ACCEPTED — **Φάση 1 υλοποιημένη** (2026-07-30, §8.1)· Φάσεις 2-5 εκκρεμείς
**Συγγραφέας:** Claude Opus 5 + Γιώργος Παγώνης
**Σχετικά:** ADR-171 (Autonomous AI Agent), ADR-175 (BOQ), ADR-329 (Scope/Granularity), ADR-674 (Baseline Drift), ADR-294 (SSoT Ratchet)

---

## 1. Σκοπός

Ορίζει την αρχιτεκτονική με την οποία οι **ντετερμινιστικές δυνατότητες** του Νέστορα (επιμετρήσεις, κοστολόγηση, γεωμετρία, δομή έργων) εκτίθενται ως **εργαλεία που καλούν πράκτορες τεχνητής νοημοσύνης** — εσωτερικοί και εξωτερικοί — χωρίς να χαθεί η ακρίβεια, η ιχνηλασιμότητα ή η διακυβέρνηση.

**Η θέση που υπερασπίζεται αυτό το ADR:** το LLM κάνει *μετάφραση πρόθεσης*. Ο κώδικας του Νέστορα κάνει *τον υπολογισμό*. Ποτέ το αντίστροφο.

---

## 2. Το Πρόβλημα — Τι Έδειξε η Χαρτογράφηση (2026-07-30)

Χαρτογράφηση ολόκληρου του `src/` με σκοπό να απαντηθεί: *ποια κομμάτια του Νέστορα μπορεί να καλέσει ένας πράκτορας;*

### 2.1 Η καλή είδηση — η βάση είναι ήδη σωστή

| Μέτρηση | Τιμή | Σημασία |
|---|---|---|
| Firestore writes μέσα σε `src/components` | **1** αρχείο / 1.749 | Η λογική **δεν ζει στο UI** |
| Firestore writes μέσα σε `src/hooks` | **0** αρχεία / 244 | Ό.π. |
| Mutation gateways | 13+ | Κάθε εγγραφή περνά από πύλη |
| `cost-engine.ts` | 300 γρ., **pure functions** | «computed at runtime, NEVER stored» |
| `contracts.ts` | `companyId` σε **κάθε** υπογραφή | Tenant isolation by design |

Ο κανόνας N.6 (enterprise IDs) και τα mutation gateways επέβαλαν, χωρίς αυτό να είναι ο σκοπός τους, μια αρχιτεκτονική **service-first**. Δεν απαιτείται refactor για να γίνουν τα services εργαλεία.

### 2.2 Το κενό

Υπάρχουν ήδη **40 ορισμένα εργαλεία** (`agentic-tool-definitions.ts`, 1.467 γρ.) που καλύπτουν επαφές, ESCO, προμήθειες, οργανόγραμμα, μηνύματα, αρχεία και **χρηματοοικονομικά** (NPV σεναρίων, hedging, debt maturity).

**Μηδέν** εργαλεία καλύπτουν το ίδιο το αντικείμενο της εφαρμογής:

```
❌ επιμετρήσεις / BOQ        (services/measurements/ — 1.351 γρ., ώριμο)
❌ κόστη & αποκλίσεις        (cost-engine.ts — pure, δοκιμασμένο)
❌ baseline drift            (ADR-674 — μοναδικό στη βιομηχανία)
❌ δομή κτιρίου / ορόφων
❌ γεωμετρία & BIM           (6.336 αρχεία)
```

**Το παράδοξο:** ο πράκτορας ξέρει να συζητήσει στρατηγικές αντιστάθμισης επιτοκίου, αλλά δεν μπορεί να απαντήσει «πόσο σκυρόδεμα έχει το έργο» — ενώ ο κώδικας που το υπολογίζει υπάρχει, είναι καθαρός και είναι το πολυτιμότερο περιουσιακό στοιχείο του έργου.

### 2.3 Στρατηγικό διακύβευμα

Καθώς οι πράκτορες γίνονται η διεπαφή, το ερώτημα δεν είναι «θα αντικατασταθεί η εφαρμογή;» αλλά **«ποιον θα καλέσει ο πράκτορας για να κάνει τη δουλειά;»**. Ένα generic CRUD UI αντικαθίσταται. Ένας αξιόπιστος, ντετερμινιστικός υπολογιστής επιμετρήσεων **γίνεται πιο πολύτιμος** όσο εξυπνότερος γίνεται ο πράκτορας — αρκεί να έχει πόρτα να τον καλέσει.

---

## 3. Έρευνα — Τι Κάνουν οι Μεγάλοι Παίκτες (κατάσταση Ιουλίου 2026)

### 3.1 Ευρήματα

| Παίκτης | Υλοποίηση | Ημ/νία | Χαρακτηριστικά |
|---|---|---|---|
| **Autodesk Revit** | **Επίσημος Public MCP Server** (Revit 2027) | Ιούν 2026 | 100+ tools: geometry, views, sheets, families, MEP, structures. Localhost HTTP bridge, sub-second |
| **Figma** | Dev Mode MCP Server + **Code Connect** | 2025→2026 | Read *και* write. Ρητό mapping design component → πραγματικό component κώδικα |
| **Graphisoft Archicad** | AI Assistant (beta, AC29) + JSON/Python API (Tapir, community) | 2026 | Πιο πίσω· AI Visualizer = παραγωγή εικόνων, όχι δομημένη πρόσβαση δεδομένων |
| **Maxon Cinema 4D** | Python/C++ SDK· καμία επίσημη MCP υλοποίηση εντοπίστηκε | — | Εκτός του άξονα αυτού του ADR |

### 3.2 Συμπεράσματα που δεσμεύουν την απόφαση

**(α) Το MCP είναι πλέον το πρότυπο, όχι μία επιλογή.** Όταν η Autodesk το κάνει *επίσημο, υποστηριζόμενο προϊόν* στο Revit 2027, το ερώτημα «MCP ή κάτι δικό μας;» έχει κλείσει. Ακολουθούμε MCP.

**(β) Το πλήθος flat εργαλείων είναι αδυναμία τους, όχι πρότυπο.** Τα δεδομένα σχεδίασης εργαλείων είναι σαφή:

- Το **80%** της ποιότητας ενός MCP server κρίνεται στο *schema*, όχι στην υλοποίηση.
- Η επιτυχία επιλογής εργαλείου καταρρέει όταν πέφτει η ποιότητα schema — αναφέρεται πτώση **43% → 14%**.
- 58 εργαλεία ≈ **55K tokens** μόνο σε ορισμούς. Με progressive disclosure: **134K → 5K (−85%)**.

Ο Revit εκθέτει 100+ εργαλεία επίπεδα. **Δεν το αντιγράφουμε.** Ξεκινάμε με λίγα, καλογραμμένα, με ρητό namespace.

**(γ) Το Code Connect της Figma είναι το σωστό μοτίβο.** Ο πράκτορας δεν *μαντεύει* ποιο component να χρησιμοποιήσει — υπάρχει ρητή αντιστοίχιση. Το ανάλογο εδώ: ο πράκτορας δεν μαντεύει *πώς μετριέται* μια ποσότητα — του δηλώνεται ο κανόνας μέτρησης.

**(δ) ⚠️ Τα MCP tool annotations ΔΕΝ επιβάλλουν τίποτα.** Από την επίσημη τεκμηρίωση MCP (Μάρ 2026):

> «Annotations are not guaranteed to faithfully describe tool behavior.» — «An untrusted server can lie.»

Τα `readOnlyHint` / `destructiveHint` / `idempotentHint` / `openWorldHint` είναι **προαιρετικά, client-side, συμβουλευτικά**. Η επίσημη σύσταση: *«keep your actual safety guarantees in deterministic controls»* — η πραγματική διακυβέρνηση ανήκει στο **authorization layer, όχι στα annotations**.

**Αυτό είναι το σημαντικότερο εύρημα της έρευνας** και καθορίζει τον §5.4.

---

## 4. Τα Πρότυπα στα Οποία Πατάμε

Η απαίτηση «κάθε αριθμός να φέρει την απόδειξή του» **δεν είναι εφεύρεση αυτού του ADR**. Είναι σύνθεση τεσσάρων υφιστάμενων προτύπων. Αυτό είναι που τη διαχωρίζει από αυτοσχεδιασμό.

| Ανάγκη | Πρότυπο | Κατάσταση |
|---|---|---|
| **Ποιος κανόνας μέτρησης ίσχυσε** | **buildingSMART IDS 1.0** (Ιούν 2024) — computer-interpretable exchange requirements: πώς objects, classifications, properties, **values και units** παραδίδονται· ρητά σχεδιασμένο για απαιτήσεις quantity takeoff | Διεθνές, ώριμο |
| **Ταξινόμηση κόστους (και άνθρακα)** | **ICMS 3** (RICS + 49 οργανισμοί) — δομή για classifying, defining, measuring, recording, presenting κόστους **και εκπομπών άνθρακα** κύκλου ζωής | Διεθνές· αναγνωρίζει τη μετάβαση PAS 1192 → ISO 19650 |
| **Κατάσταση ωριμότητας / έγκρισης** | **ISO 19650** — ήδη παρόν στον κώδικα (`iso19650-enricher.ts`, 478 γρ.· `ifc-guid.service.ts`, 83 γρ.) | ✅ ήδη υλοποιημένο μερικώς |
| **Προέλευση αριθμού & ίχνος πράκτορα** | **W3C PROV-O / PROV-DM** + **PROV-AGENT** (arXiv 2508.02866) — επεκτείνει το W3C PROV και **αξιοποιεί ρητά το MCP** για provenance σε agentic workflows | Ερευνητικό αλλά ευθυγραμμισμένο με MCP |
| **Μεταφορά δομημένου αποτελέσματος** | **MCP `outputSchema` + `structuredContent`** — machine-parseable, type-safe, επικυρώσιμο από τον client | Επίσημο MCP |

### 4.1 Κενά που εντοπίστηκαν στον κώδικα

```
❌ ICMS 3 classification    — απών
❌ buildingSMART IDS        — απών
❌ Embodied carbon (CO₂e)   — απών (το ICMS 3 το βάζει δίπλα στο κόστος)
✅ ISO 19650                — μερικώς (iso19650-enricher.ts)
✅ IFC GUID                 — παρόν (ifc-guid.service.ts)
✅ Governance lifecycle     — παρόν (draft→submitted→approved→certified→locked)
✅ Baseline drift           — παρόν (ADR-674) — ΔΕΝ το έχει κανείς άλλος
```

Το **embodied carbon** σημειώνεται ως στρατηγικό κενό: το ICMS 3 το θεωρεί ισότιμο του κόστους. Δεν εντάσσεται στη Φάση 1, αλλά η δομή του VQE (§6) το προβλέπει ώστε να μην απαιτηθεί breaking change.

---

## 5. Απόφαση — Αρχιτεκτονική

### 5.1 Τέσσερα στρώματα

```
┌─────────────────────────────────────────────────────────────┐
│ L3  ADAPTERS — ένας ορισμός, πολλοί καταναλωτές             │
│                                                              │
│   OpenAI adapter      MCP adapter        REST adapter        │
│   (in-app agent)      (Claude/Cursor)    (/api/*)            │
│   Chat Completions    outputSchema +     withAuth()          │
│   strict: true        structuredContent                      │
└───────────────────────────┬─────────────────────────────────┘
                            │ παράγονται ΑΥΤΟΜΑΤΑ από ↓
┌───────────────────────────┴─────────────────────────────────┐
│ L2  CAPABILITY REGISTRY — SSoT                              │
│     Ένας ορισμός ανά δυνατότητα: name, description,          │
│     inputSchema (Zod), outputSchema, annotations,            │
│     governance policy, handler                               │
└───────────────────────────┬─────────────────────────────────┘
                            │ επιστρέφει ↓
┌───────────────────────────┴─────────────────────────────────┐
│ L1  VERIFIABLE QUANTITY ENVELOPE (VQE)                      │
│     Κάθε ποσοτικό αποτέλεσμα τυλίγεται με                    │
│     basis + provenance + governance + integrity              │
└───────────────────────────┬─────────────────────────────────┘
                            │ καλεί ↓
┌───────────────────────────┴─────────────────────────────────┐
│ L0  ΥΠΑΡΧΟΝΤΑ SERVICES — ΑΜΕΤΑΒΛΗΤΑ                          │
│     boqService · cost-engine (pure) · boq-repository         │
│     ⚠️ ΔΕΝ τροποποιούνται από αυτό το ADR                    │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Γιατί Capability Registry και όχι απευθείας ορισμοί

Ο κώδικας έχει **δύο** ήδη υπαρκτούς καταναλωτές (OpenAI function calling, REST) και προστίθεται **τρίτος** (MCP). Ξεχωριστοί ορισμοί ανά καταναλωτή = **τριπλότυπο** — ευθεία παραβίαση N.12 (SSoT Ratchet) και N.18 (anti-duplication).

Ένας ορισμός → adapters που *παράγουν* τα schemas. Αυτό ξεπερνά και τη Figma, που συντηρεί χωριστά Plugin API και MCP server.

**Καταχώρηση**: το `capability-registry` θα προστεθεί στο `.ssot-registry.json` (Tier 3) με `forbiddenPatterns` που μπλοκάρουν χειρόγραφους ορισμούς εργαλείων εκτός registry.

### 5.3 Ονοματοδοσία — namespace με πρόθεμα

Το OpenAI function calling περιορίζει τα ονόματα σε `^[a-zA-Z0-9_-]+$` (χωρίς τελείες). Επιλέγεται πρόθεμα τομέα, κοινό και για τα τρία adapters:

```
boq_get_summary          boq_search_items        boq_get_item
boq_get_variance         boq_get_baseline_drift  boq_get_statistics
boq_list_categories
```

Μελλοντικοί τομείς: `model_*` (BIM/γεωμετρία), `project_*` (δομή), `property_*`.

### 5.4 ⚠️ ΚΑΝΟΝΑΣ: Η διακυβέρνηση ΔΕΝ βασίζεται σε annotations

Απευθείας συνέπεια του §3.2(δ). Τα annotations δηλώνονται για UX, **ποτέ** ως όριο ασφαλείας.

| Μηχανισμός | Ρόλος | Επιβάλλει; |
|---|---|---|
| `readOnlyHint` κ.λπ. | Μεταδεδομένα για UI/confirmations | ❌ **ΟΧΙ** |
| `withAuth()` + custom claims | Ταυτοποίηση + tenant | ✅ ΝΑΙ |
| `companyId` σε κάθε υπογραφή service | Απομόνωση πελατών | ✅ ΝΑΙ |
| Firestore Rules (3.490 γρ.) | Τελευταία γραμμή άμυνας | ✅ ΝΑΙ |
| `IBOQService.transition()` | Κύκλος ζωής έγκρισης | ✅ ΝΑΙ |
| Governance policy στο registry | Server-side έλεγχος πριν τον handler | ✅ ΝΑΙ |

**Συγκεκριμένα:** ένα εργαλείο εγγραφής που στοχεύει item σε κατάσταση `certified` ή `locked` απορρίπτεται **στο registry, server-side**, ανεξάρτητα από το τι δηλώνει το annotation και ανεξάρτητα από το τι νομίζει ο client.

---

## 6. Verifiable Quantity Envelope (VQE)

### 6.1 Τι είναι — και τι δεν είναι

**Δεν είναι** νέο πρότυπο. Είναι ο φάκελος μεταφοράς που συνθέτει τα πρότυπα του §4 σε ένα σχήμα MCP `structuredContent`.

**Αιτιολόγηση:** ένας αριθμός χωρίς προέλευση, κανόνα μέτρησης και κατάσταση έγκρισης δεν είναι επιμέτρηση — είναι γνώμη. Όταν ο παραλήπτης είναι LLM που θα τον παρουσιάσει σε άνθρωπο που θα τον **υπογράψει**, η διάκριση είναι νομική, όχι αισθητική.

**Κενό αγοράς:** ούτε ο Revit Public MCP Server ούτε το Figma MCP επιστρέφουν provenance. Επιστρέφουν *δεδομένα μοντέλου*. Αυτό είναι το σημείο υπεροχής του Νέστορα και είναι φθηνό να κατακτηθεί, γιατί το `cost-engine.ts` είναι ήδη pure — άρα ντετερμινιστικό και άρα hashable.

### 6.2 Σχήμα — ΥΛΟΠΟΙΗΜΕΝΟ (Φάση 1, 2026-07-30)

> **Πηγή αλήθειας: ο κώδικας** — `src/types/vqe/envelope.ts`. Το παρακάτω είναι
> συμπυκνωμένο· οι αποκλίσεις από το αρχικό σχέδιο τεκμηριώνονται στο §6.5.

```typescript
export interface VerifiableQuantityEnvelope<T> {
  readonly schemaVersion: string;      // VQE_SCHEMA_VERSION — για τους MCP clients
  readonly value: T;                   // ΑΥΤΟΥΣΙΟ ό,τι επιστρέφει το service
  readonly basis: MeasurementBasis;    // «με ποιον κανόνα μετρήθηκε;»
  readonly provenance: ProvenanceRecord;  // «από πού βγήκε;»
  readonly governance: GovernanceRecord;  // «πόσο δεσμευτικό είναι;»
  readonly integrity: IntegrityRecord;    // «αναπαράγεται;»
}

/** ΟΛΑ nullable: παράγονται από τα items· `null` = «το σύνολο δεν είναι ενιαίο». */
export interface MeasurementBasis {
  readonly atoeCategoryCode: string | null;
  readonly unit: BOQMeasurementUnit | null;
  readonly scope: BOQScope | null;
  readonly wasteFactorApplied: number | null;
  readonly costAllocationMethod: CostAllocationMethod | null;
  readonly icmsCode: string | null;    // δηλώνεται από τον καλούντα (Φάση 3)
}

export interface ProvenanceRecord {
  readonly sourceItemIds: readonly string[];    // prov:Entity (μοναδικά, ταξινομημένα)
  readonly sourceEntityIds: readonly string[];  // prov:wasDerivedFrom (BIM)
  readonly computedBy: ProvenanceActivity;      // prov:Activity — ΚΛΕΙΣΤΗ ένωση
  readonly computedAt: string;                  // prov:atTime — ΕΚΤΟΣ hash
  readonly warnings: readonly EnvelopeWarning[];
}

export interface GovernanceRecord {
  readonly effectiveStatus: BOQItemStatus;      // Η ΧΑΜΗΛΟΤΕΡΗ του συνόλου
  readonly statusBreakdown: Readonly<Record<BOQItemStatus, number>>;
  readonly isSignable: boolean;                 // ≥1 item ΚΑΙ όλα certified/locked
  readonly baselineDrift: BaselineDriftSummary | null;  // ADR-674
}

export interface IntegrityRecord {
  readonly inputsHash: string;     // sha256 κανονικοποιημένων ΕΙΣΟΔΩΝ
  readonly engineVersion: string;  // `<semver>+<αποτύπωμα συμπεριφοράς>`
}

/** Σύνοψη ADR-674 για το σύνολο. `null` ≠ `driftedItemCount: 0` — βλ. §6.5. */
export interface BaselineDriftSummary {
  readonly trackedItemCount: number;
  readonly driftedItemCount: number;
  readonly totalItemCount: number;
  readonly maxAbsPercent: number;
  readonly netQuantityDelta: number | null;  // μόνο σε ενιαία μονάδα
  readonly worstItemId: string | null;
  readonly latestSyncedAt: string | null;
}

/** Ενσωματώνει το ΥΠΑΡΧΟΝ `AllocationWarning` — δεν αντιγράφει κωδικούς. */
export type EnvelopeWarning =
  | { readonly source: 'envelope'; readonly code: EnvelopeWarningCode;
      readonly itemIds?: readonly string[]; readonly field?: string; readonly rawValue?: string }
  | { readonly source: 'allocation'; readonly detail: AllocationWarning };
```

### 6.3 Τρεις μη διαπραγματεύσιμοι κανόνες

1. **Το `effectiveStatus` είναι η ΧΑΜΗΛΟΤΕΡΗ κατάσταση του συνόλου.** Άθροισμα 99 certified + 1 draft **δεν** είναι certified. Αυτό εμποδίζει τον πράκτορα να παρουσιάσει ως εγκεκριμένο ένα σύνολο που δεν είναι.
2. **Το `inputsHash` υπολογίζεται από κανονικοποιημένες εισόδους**, όχι από το αποτέλεσμα. Ίδιες είσοδοι + ίδια `engineVersion` ⇒ ίδιο hash, αναπαραγώγιμα.
3. **Το `value` παραμένει ακριβώς ό,τι επιστρέφει σήμερα το service.** Το VQE *τυλίγει*, δεν *μετασχηματίζει*. Μηδενικό ρίσκο παλινδρόμησης στο `cost-engine.ts`.

### 6.4 Κόστος tokens — αντίρρηση και απάντηση

Ο φάκελος προσθέτει ~150-250 tokens ανά απόκριση. Με το πρότυπο MCP αυτό **δεν** επιβαρύνει το context: το `structuredContent` είναι machine-parseable και ο client επιλέγει τι εισάγει στο prompt. Ο πράκτορας μπορεί να αγνοήσει τον φάκελο όταν απαντά περιγραφικά και να τον επικαλεστεί όταν ο χρήστης ρωτήσει «από πού προκύπτει αυτό;».

### 6.5 Αποκλίσεις υλοποίησης από το αρχικό σχέδιο (Φάση 1)

Κάθε απόκλιση προέκυψε από συγκεκριμένο εύρημα, όχι από προτίμηση.

| # | Σχέδιο §6.2 (2026-07-30 πρωί) | Υλοποίηση | Γιατί |
|---|---|---|---|
| 1 | `MeasurementBasis` πεδία non-null, δηλώνονται | **Nullable, παράγονται από τα items** | Σε σύνοψη κτιρίου δεν υπάρχει ενιαίο `unit` (m³ σκυρόδεμα + kg χάλυβας). Ένα non-null `unit` θα ήταν **ψέμα** — ακριβώς αυτό που ο φάκελος υπάρχει για να αποτρέψει. Παράλληλα, ό,τι *δηλώνεται* μπορεί να δηλωθεί λάθος· ό,τι *παράγεται* δεν μπορεί. Μοναδική εξαίρεση: `icmsCode` (δεν προκύπτει από δεδομένα) |
| 2 | Νέος τύπος `ProvenanceWarning` | **`EnvelopeWarning` που ΕΝΣΩΜΑΤΩΝΕΙ το `AllocationWarning`** | Το SSoT audit επιβεβαίωσε την υποψία διπλότυπου: το `AllocationWarning` (`cost-engine.ts:142`, ADR-329 §3.7.2) ήδη ορίζει κωδικούς επιμερισμού. Η ένωση διακρίνεται κατά `source` και **δεν αντιγράφει** κωδικό — νέος κωδικός εκεί ισχύει αυτόματα εδώ |
| 3 | `computedBy: string` | **`ProvenanceActivity` — κλειστή ένωση 9 τιμών** | Η προέλευση αριθμού που θα υπογραφεί δεν επιτρέπεται να περιέχει τυπογραφικό. Νέο εργαλείο ⇒ ρητή προσθήκη. Είναι το ανάλογο του Figma Code Connect (§3.2γ) |
| 4 | `BaselineDriftSummary` αναφερόταν χωρίς ορισμό | **Ορίστηκε** με 7 πεδία | Το `BaselineDriftResult` (`types/boq/cost`) είναι **ανά item**· χρειαζόταν σύνοψη συνόλου. Κρίσιμο: `null` = «κανείς δεν παρακολουθεί», `driftedItemCount: 0` = «ελέγχθηκε, καθαρό». Για πράκτορα που παρουσιάζει αριθμό προς υπογραφή, τα δύο **δεν επιτρέπεται να μοιάζουν ίδια**. Το `netQuantityDelta` επιστρέφεται μόνο σε ενιαία μονάδα — άθροισμα m³+kg είναι σφάλμα **τιμής**, όχι μορφής |
| 5 | — | **`schemaVersion` στον φάκελο** | Οι MCP clients χρειάζονται έκδοση σχήματος για forward compat· υπάρχει precedent (`USER_SETTINGS_SCHEMA_VERSION`) |
| 6 | `engineVersion` = χειροκίνητη σταθερά | **`<semver>+<αποτύπωμα συμπεριφοράς>`** | βλ. §6.6 |
| 7 | — | **Νέο SSoT `src/types/boq/lifecycle.ts`** | Ο κανόνας «η χαμηλότερη κατάσταση» απαιτεί **διάταξη** ωριμότητας· δεν υπήρχε. Τα `BOQ_AUTO_MANAGED_STATUSES`/`BOQ_FROZEN_BASELINE_STATUSES` απαντούν σε άλλη ερώτηση (μεταβλητότητα, όχι ωριμότητα). Ο τύπος `Record<BOQItemStatus, number>` κάνει την πληρότητα **compile-time**· test δένει τα δύο SSoT ώστε να μην αποκλίνουν |

**Απορρίφθηκε σκόπιμα:** να σβήνει το `isSignable` όταν υπάρχει baseline drift. Είναι ελκυστικό (υπογραφή ξεπερασμένου baseline), αλλά το §6.3 ορίζει το `isSignable` **αποκλειστικά** ως συνάρτηση κατάστασης. Το drift εκτίθεται χωριστά + προειδοποίηση `baseline_drift_present`. Επανεξέταση στη Φάση 4 (write tools).

### 6.6 Γιατί το `engineVersion` δεν είναι χειροκίνητη σταθερά

Το πεδίο απαντά «αν ξανατρέξω τον ίδιο υπολογισμό, θα πάρω τον ίδιο αριθμό;». Μια χειροκίνητη σταθερά το απαντά **μόνο όσο κάποιος θυμάται να την αυξήσει** — και αυτό το repo έχει τεκμηριωμένο ιστορικό σταθερών που σάπισαν σιωπηλά (η γραμμή «ADR-728 = next free» ήταν μπαγιάτικη κατά 357 αριθμούς· η baseline του CHECK 3.18 κατά 2 μήνες).

Άρα: `engineVersion = '<semver>+<sha256 των ΠΡΑΓΜΑΤΙΚΩΝ εξόδων του cost-engine σε σταθερό δείγμα>'`. Αλλάζει ένας τύπος ⇒ αλλάζει η έκδοση **αυτόματα**. Είναι το μοτίβο content-addressed build (Bazel action key / Nix derivation) και **κανένα από τα Revit MCP / Figma MCP δεν επιστρέφει καν έκδοση μηχανής**.

Δύο παγίδες που έπρεπε να λυθούν και τεκμηριώνονται ως προειδοποίηση:
- Το `computeBuildingSummary()` γράφει `lastUpdated: nowISO()` — **ρολόι μέσα στην έξοδο της μηχανής**. Αν έμπαινε στο δείγμα, η «έκδοση» θα άλλαζε κάθε κλήση. Εξαιρείται ρητά· υπάρχει test που μετακινεί το ρολόι συστήματος και απαιτεί σταθερό αποτύπωμα (mutation-verified: η επαναφορά του πεδίου κάνει το test κόκκινο).
- Το ίδιο ταξινομεί κατηγορίες με `compareByLocale` (ICU) — θα έκανε την έκδοση **εξαρτώμενη από το μηχάνημα**. Το δείγμα ξανα-ταξινομεί κατά code unit. Για τον ίδιο λόγο **καμία** ταξινόμηση στο preimage δεν χρησιμοποιεί `compareByLocale`: εκείνο είναι SSoT ταξινόμησης **προς εμφάνιση**, όχι για ντετερμινισμό byte επιπέδου.

**Ειλικρίνεια ορίων:** το αποτύπωμα καλύπτει ό,τι εκτελεί το δείγμα. Είναι **ανιχνευτής μεταβολής**, όχι απόδειξη ισοδυναμίας.

### 6.7 Γιατί δεν επαναχρησιμοποιήθηκε το `sortKeys()` για το hash

Το `sortKeys()` (`@/lib/audit/audit-diff`) είναι υπαρκτό, εξαγόμενο SSoT και **παραμένει σωστό** για σύγκριση audit. Για hash ακεραιότητας δεν αρκεί, γιατί το `JSON.stringify` **δεν είναι ενέσιμο** — συγκρούει διακριτές εισόδους:

| Είσοδος | `JSON.stringify` | Πρόβλημα |
|---|---|---|
| `new Map([['OIK-2','Σκυροδέματα']])` | `{}` | ⚠️ το `computeBuildingSummary` δέχεται **ακριβώς** `Map` για τα ονόματα κατηγοριών ⇒ δύο διαφορετικοί υπολογισμοί θα είχαν ίδιο hash |
| `NaN` / `Infinity` | `null` | ίδιο με πραγματικό `null` |
| `{ a: undefined }` | `{}` | ίδιο με κενό αντικείμενο |
| `new Set([1,2])` | `{}` | κάθε Set ίδια με κάθε άλλη |
| `-0` | `0` | — |

Ένα hash που συγκρούει **λέει ψέματα** για την αναπαραγωγιμότητα. Άλλη ερώτηση ⇒ άλλη απάντηση: το `canonical-encoding.ts` είναι το SSoT κανονικοποίησης **ακεραιότητας** (tagged, μήκος-προθεματισμένη γραμματική, `Map`/`Set`/`Date`/`undefined`/`-0` ρητά), το `audit-diff` παραμένει το SSoT κανονικοποίησης **σύγκρισης**. Καμία δεν αντιγράφει την άλλη — επιβεβαιωμένο με `jscpd --diff` (0 clones).

---

## 7. Κατάλογος Εργαλείων — Φάση 1 (μόνο ανάγνωση)

Επτά εργαλεία. Σκόπιμα λίγα (βλ. §3.2β).

| # | Όνομα | Καλεί | Επιστρέφει |
|---|---|---|---|
| 1 | `boq_get_summary` | `boqService.getBuildingSummary()` | `VQE<BOQSummary>` |
| 2 | `boq_search_items` | `boqService.search()` | `VQE<BOQItem[]>` |
| 3 | `boq_get_item` | `boqService.getById()` + `computeItemCost()` | `VQE<BOQItem & CostBreakdown>` |
| 4 | `boq_get_variance` | `computeVariance()` | `VQE<VarianceResult>` |
| 5 | `boq_get_baseline_drift` | `computeBaselineDrift()` | `VQE<BaselineDriftResult>` |
| 6 | `boq_get_statistics` | `boqService.getStatistics()` | `VQE<BOQStats>` |
| 7 | `boq_list_categories` | `boqService.getCategories()` | `VQE<BOQCategory[]>` |

Και τα επτά: `readOnlyHint: true`, `idempotentHint: true`, `openWorldHint: false`.
Και τα επτά: `companyId` **υποχρεωτικό** — προωθείται στα services, τα οποία ήδη το απαιτούν.

**Το #5 δεν έχει αντίστοιχο σε κανένα ανταγωνιστικό προϊόν.**

---

## 8. Φάσεις Υλοποίησης

Κάθε φάση = αυτοτελές Plan Mode + commit. Ο Γιώργος ελέγχει το αποτέλεσμα πριν προχωρήσουμε (απόφαση 2026-07-30, κανόνας N.8).

| Φάση | Περιεχόμενο | Αρχεία | Ρίσκο |
|---|---|---|---|
| **0** | Αυτό το ADR | 1 | — |
| **1** ✅ | Τύποι VQE + `buildEnvelope()` + tests — **ΟΛΟΚΛΗΡΩΘΗΚΕ 2026-07-30** (§8.1) | 16 | Μηδενικό (νέος κώδικας) |
| **2** | Capability Registry + OpenAI adapter + τα 7 read tools | ~6 | Χαμηλό (μόνο ανάγνωση) |
| **3** | MCP server adapter + auth + rate limiting | ~5 | Μεσαίο (εξωτερική επιφάνεια) |
| **4** | Write tools με governance gate | ~4 | Υψηλό — χωριστή έγκριση |
| **5** | Επέκταση σε `model_*` (BIM/γεωμετρία) | — | Μελλοντικό |

**Οι φάσεις 1-2 δεν αγγίζουν κανένα υπάρχον αρχείο** πλην της προσθήκης εγγραφών στο registry — μηδενικό ρίσκο παλινδρόμησης.

### 8.1 Παραδοτέα Φάσης 1 (2026-07-30)

**Ένα μόνο υπάρχον αρχείο τροποποιήθηκε**, προσθετικά: `src/types/boq/index.ts` (6 re-exports του νέου `lifecycle`). Τα `boqService`, `cost-engine.ts`, `boq-repository.ts`, `contracts.ts` **δεν αγγίχτηκαν** — επιβεβαιωμένο ότι τα υπάρχοντα suites τους περνούν αμετάβλητα.

| Αρχείο | Ρόλος |
|---|---|
| `src/types/vqe/envelope.ts` | Το συμβόλαιο (§6.2) |
| `src/types/vqe/index.ts` | Barrel |
| `src/types/boq/lifecycle.ts` | **ΝΕΟ SSoT** — διάταξη ωριμότητας καταστάσεων |
| `services/agent-capability/vqe/build-envelope.ts` | `buildEnvelope()` — pure, η μοναδική πόρτα |
| `…/canonical-encoding.ts` | Ενέσιμη κανονικοποίηση (§6.7) |
| `…/hashing.ts` | `sha256HexSync` — `@server-only` |
| `…/integrity.ts` | Preimage + `inputsHash` |
| `…/engine-version.ts` | semver + αποτύπωμα συμπεριφοράς (§6.6) |
| `…/governance.ts` | Κανόνας χαμηλότερης κατάστασης, fail-closed |
| `…/measurement-basis.ts` | Παραγωγή βάσης από τα items |
| `…/baseline-drift-summary.ts` | Σύνοψη ADR-674 |
| `…/provenance.ts` | Υγιεινή εισόδων + PROV-O record |
| `…/ordering.ts` | Ταξινόμηση κατά code unit (ΟΧΙ locale) |
| `…/derived.ts` | Κοινό σχήμα «αποτέλεσμα + προειδοποιήσεις» |
| `…/index.ts` | Barrel — η επιφάνεια που καταναλώνει η Φάση 2 |
| + 5 test suites | **80 tests** (`vqe` + `boq-lifecycle` + τα προϋπάρχοντα `cost-engine`) |

**Επαλήθευση (όχι μόνο «πράσινο»):** τρεις σκόπιμες μεταλλάξεις επιβεβαίωσαν ότι τα tests πιάνουν τις αστοχίες που ισχυρίζονται:
1. χαμηλότερη → υψηλότερη κατάσταση ⇒ 2 tests κόκκινα·
2. διαρροή ρολογιού στο αποτύπωμα μηχανής ⇒ 1 test κόκκινο·
3. `Map` σαν απλό αντικείμενο στην κανονικοποίηση ⇒ 2 tests κόκκινα (ένα στη γραμματική, ένα στο hash).

**Πύλες:** `jscpd --diff` καθαρό (0 clones / 15 αρχεία)· CHECK 3.22 dead-code πράσινο· CHECK 3.30 barrel dead-exports **δεν επηρεάστηκε** από αυτά τα barrels (τα 3 ευρήματά του προϋπήρχαν, σε committed αρχεία `dxf-viewer`).

---

## 9. Τι ΔΕΝ Κάνουμε

- ❌ **Δεν** αναθέτουμε υπολογισμούς σε LLM. Το `cost-engine.ts` παραμένει η μόνη πηγή αριθμών.
- ❌ **Δεν** τροποποιούμε `boqService`, `cost-engine`, `boq-repository` στις Φάσεις 1-3.
- ❌ **Δεν** εκθέτουμε 100+ flat εργαλεία όπως ο Revit.
- ❌ **Δεν** βασιζόμαστε σε MCP annotations για ασφάλεια (§5.4).
- ❌ **Δεν** αποθηκεύουμε το VQE στη Firestore. Υπολογίζεται at runtime, όπως το `CostBreakdown` (ADR-175).
- ❌ **Δεν** αγγίζουμε το DXF Viewer σε αυτές τις φάσεις (ADR-040 περιορισμοί ισχύουν).

---

## 10. Ανοιχτά Ερωτήματα

| # | Ερώτημα | Απόφαση από |
|---|---|---|
| Q1 | **Embodied carbon (ICMS 3)** — εντάσσεται; Κενό στον κώδικα σήμερα. Το ICMS 3 το θεωρεί ισότιμο του κόστους | Γιώργος — Φάση 5+ |
| Q2 | **MCP transport**: stdio (τοπικό, όπως Revit) ή HTTP+SSE (απομακρυσμένο); Επηρεάζει auth | Φάση 3 |
| Q3 | **Provider**: ο κώδικας είναι OpenAI (60 αρχεία). Το MCP είναι provider-agnostic — δεν απαιτείται αλλαγή | Καμία ενέργεια |
| Q4 | Ενοποίηση των 4 υπαρχόντων `firestore_*` generic tools με το registry, ή συνύπαρξη; | Φάση 2 |

---

## 11. Αξιολόγηση Google-Level (N.7.2)

| # | Ερώτημα | Απάντηση |
|---|---|---|
| 1 | Proactive ή reactive; | **Proactive** — ο φάκελος χτίζεται στο σημείο υπολογισμού, όχι εκ των υστέρων |
| 2 | Race condition; | **Όχι** — pure functions, μηδέν κοινή κατάσταση |
| 3 | Idempotent; | **Ναι** — ίδιες είσοδοι ⇒ ίδιο `inputsHash` |
| 4 | Belt-and-suspenders; | **Ναι** — registry policy + `withAuth()` + Firestore rules |
| 5 | SSoT; | **Ναι** — ένας ορισμός, τρία adapters |
| 6 | Await ή fire-and-forget; | **Await** — ορθότητα |
| 7 | Ποιος κατέχει τον κύκλο ζωής; | **Ρητά** το Capability Registry |

**Αξιολόγηση σχεδίου: ✅ Google-level: ΝΑΙ** — ένας ορισμός ανά δυνατότητα, επιβολή σε ντετερμινιστικό στρώμα (όχι σε συμβουλευτικά hints), μηδενική τροποποίηση δοκιμασμένου υπολογιστικού κώδικα.

*Η αξιολόγηση αφορά τον σχεδιασμό. Επαναξιολόγηση σε κάθε φάση υλοποίησης.*

---

## 12. Πηγές

- [Revit Public MCP Server — Autodesk AEC Tech Drop, Ιούν 2026](https://www.autodesk.com/blogs/aec/2026/06/17/revit-public-mcp-server/)
- [MCP Servers in Construction — Autodesk](https://www.autodesk.com/blogs/construction/mcp-servers-in-construction/)
- [Design Systems And AI: Why MCP Servers Are The Unlock — Figma](https://www.figma.com/blog/design-systems-ai-mcp/)
- [Introducing Dev Mode MCP server — Figma](https://www.figma.com/blog/introducing-figma-mcp-server/)
- [AI Assistant in Archicad — Graphisoft Community](https://community.graphisoft.com/t5/Getting-started/AI-Assistant-in-Archicad/ta-p/668983)
- [**Tool Annotations as Risk Vocabulary: What Hints Can and Can't Do** — MCP Blog, Μάρ 2026](https://blog.modelcontextprotocol.io/posts/2026-03-16-tool-annotations/)
- [MCP tool design: Practical approaches and tradeoffs — AWS](https://aws.amazon.com/blogs/machine-learning/mcp-tool-design-practical-approaches-and-tradeoffs/)
- [MCP Tool Schema Design Guide 2026 — KanseiLink](https://kansei-link.com/en/insights/mcp-tool-schema-design-guide-2026.html)
- [Information Delivery Specification (IDS) — buildingSMART](https://www.buildingsmart.org/standards/bsi-standards/information-delivery-specification-ids/)
- [IDS Technical — buildingSMART](https://technical.buildingsmart.org/projects/information-delivery-specification-ids/)
- [ICMS 3 — International Cost Management Standard Coalition](https://icms-coalition.org/icms-3/)
- [ICMS 3 — RICS](https://www.rics.org/profession-standards/rics-standards-and-guidance/sector-standards/construction-standards/icms3)
- [NBIMS-US V3 §4.5 — Design to Quantity Takeoff for Cost Estimating](https://nibs.org/wp-content/uploads/2025/04/NBIMS-US_V3_4.5_Design_to_Quantity_Takoff_for_Cost_Estimating_QTO.pdf)
- [PROV-AGENT: Unified Provenance for Tracking AI Agent Interactions — arXiv 2508.02866](https://arxiv.org/abs/2508.02866)
- [From Agent Traces to Trust: Evidence Tracing and Execution Provenance in LLM Agents — arXiv 2606.04990](https://arxiv.org/html/2606.04990)

---

## 13. Changelog

| Ημ/νία | Αλλαγή |
|---|---|
| 2026-07-30 | **Δημιουργία.** Φάση 1 (Αναγνώριση, N.0.1): χαρτογράφηση `src/` + έρευνα αγοράς/προτύπων. Κατάσταση DESIGN — καμία γραμμή κώδικα. Εκκρεμεί έγκριση Γιώργου για Φάση 1 υλοποίησης. |
| 2026-07-30 | **Φάση 1 ΥΛΟΠΟΙΗΘΗΚΕ.** Τύποι VQE + `buildEnvelope()` + 80 tests (§8.1). Προηγήθηκε υποχρεωτικό SSoT audit: επιβεβαιώθηκε η υποψία διπλότυπου `ProvenanceWarning` ↔ `AllocationWarning` και λύθηκε με ενσωμάτωση (§6.5 #2)· εντοπίστηκε ότι το `sortKeys()` **δεν** μπορεί να χρησιμεύσει για hash (§6.7). Επτά αποκλίσεις από το αρχικό σχήμα, όλες τεκμηριωμένες στο §6.5. Νέο SSoT `types/boq/lifecycle.ts`. Το `engineVersion` έγινε αυτο-επαληθευόμενο (§6.6). Κατάσταση: **ACCEPTED — Φάση 1 σε κώδικα, Φάσεις 2-5 εκκρεμείς.** |
