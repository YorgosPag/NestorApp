# ADR-734: Agent Capability Layer — Ο Νέστωρ ως Εργαλείο για Πράκτορες

**Ημερομηνία:** 2026-07-30
**Κατάσταση:** ACCEPTED — **Φάσεις 1-2 υλοποιημένες** (2026-07-30, §8.1 / §8.2)· **Φάση 3α υλοποιημένη** (2026-07-31, §8.3)· Φάση 3β (transport) + 4-5 εκκρεμείς
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

## 7. Κατάλογος Εργαλείων — μόνο ανάγνωση (ΥΛΟΠΟΙΗΜΕΝΑ, Φάση 2)

Επτά εργαλεία. Σκόπιμα λίγα (βλ. §3.2β).

| # | Όνομα | Καλεί | Επιστρέφει |
|---|---|---|---|
| 1 | `boq_get_summary` | `getByBuilding()` + `getBuildingSummary()` | `VQE<BOQSummary \| null>` |
| 2 | `boq_search_items` | `boqService.search()` | `VQE<BOQItem[]>` |
| 3 | `boq_get_item` | `getById()` **μέσω guard** + `computeItemCost()` | `VQE<{ item; cost }>` |
| 4 | `boq_get_variance` | ό.π. + `computeVariance()` | `VQE<VarianceResult \| null>` |
| 5 | `boq_get_baseline_drift` | ό.π. + `computeBaselineDrift()` | `VQE<BaselineDriftResult \| null>` |
| 6 | `boq_get_statistics` | `getByBuilding()` + `getStatistics()` | `VQE<BOQStats>` |
| 7 | `boq_list_categories` | `boqService.getCategories()` | `VQE<BOQCategory[]>` |

Και τα επτά: `readOnlyHint: true`, `idempotentHint: true`, `openWorldHint: false`, `requiresAdmin: true`.

### 7.1 ⛔ ΔΙΟΡΘΩΣΗ — τι έλεγε λάθος αυτή η ενότητα μέχρι τη Φάση 2

Μέχρι τις 2026-07-30 το §7 έγραφε: *«Και τα επτά: `companyId` υποχρεωτικό — προωθείται στα services, τα οποία ήδη το απαιτούν.»* **Και τα δύο μισά της πρότασης ήταν λάθος**, και το καθένα με τον δικό του τρόπο επικίνδυνο. Επαληθεύτηκε στον κώδικα (`services/measurements/contracts.ts`), όχι στο κείμενο.

**Διόρθωση 1 — «τα services ήδη το απαιτούν»: όχι όλα.**

```ts
getById(id: string): Promise<BOQItem | null>;   // ⛔ ΚΑΝΕΝΑ companyId
```

Είναι η **μοναδική** υπογραφή του `IBOQService` χωρίς tenant. Στο UI δεν πείραζε: το id ερχόταν πάντα από λίστα ήδη φιλτραρισμένη κατά `companyId`. Με πράκτορα αλλάζει το μοντέλο απειλής — **ο πράκτορας είναι αναξιόπιστη πηγή id**. Τρία από τα επτά εργαλεία (#3, #4, #5) περνούν από εκεί, άρα θα διέρρεαν έγγραφο άλλου πελάτη σε όποιον έδινε αυθαίρετο id.

*Λύση (επιλογή Α):* `capabilities/boq/boq-tenant-guard.ts` — μία πόρτα, `fetchOwnedBoqItem()`, που ελέγχει `item.companyId === ctx.companyId` **μετά** το fetch, στο ντετερμινιστικό στρώμα (§5.4), χωρίς να αγγίξει το παγωμένο `boqService` (§9). Επιστρέφει **`NOT_FOUND`**, όχι `PERMISSION_DENIED`: το δεύτερο θα επιβεβαίωνε ότι το id υπάρχει, δηλαδή θα λειτουργούσε ως μαντείο ύπαρξης. Η απόπειρα καταγράφεται ως σήμα ασφαλείας. Τα τρία εργαλεία δεν έχουν καν άλλη διαδρομή: μοιράζονται το `withOwnedItem()`, οπότε κανένα δεν μπορεί να «ξεχάσει» τον έλεγχο. Το `.ssot-registry.json` (module `boq-capability-tenant-guard`) μπλοκάρει απευθείας `boq.getById(` εκτός του guard.

*Επιλογή Β* — `companyId` στην υπογραφή του `getById` — παραμένει το σωστό **τελικό** σχήμα, αλλά είναι breaking change σε δοκιμασμένο service που το §9 παγώνει στις Φάσεις 1-3. Καταγράφηκε ως χρέος ασφαλείας στο `.claude-rules/pending-ratchet-work.md`.

**Διόρθωση 2 — «`companyId` υποχρεωτικό»: ΟΧΙ ως παράμετρος εργαλείου.**

Αν το `companyId` είναι παράμετρος που δηλώνει ο πράκτορας, τότε ο πράκτορας **επιλέγει πελάτη** — κενό σοβαρότερο από το πρώτο, γιατί δεν χρειάζεται καν να μαντέψει id. Ο tenant έρχεται **αποκλειστικά** από το `CapabilityContext`, δηλαδή από το ταυτοποιημένο στρώμα (`withAuth()` / claims). Δεν είναι σύμβαση καλής θέλησης: το registry **ρίχνει κατά τη φόρτωση** αν κάποια δυνατότητα δηλώσει παράμετρο `companyId` / `tenantId` / `organizationId`. Ένα λάθος αυτού του είδους δεν φτάνει σε περιβάλλον εκτέλεσης — σπάει στο πρώτο import.

### 7.2 Λοιπές αποκλίσεις υλοποίησης από το αρχικό §7

| # | Σχέδιο | Υλοποίηση | Γιατί |
|---|---|---|---|
| 1 | `#3 → VQE<BOQItem & CostBreakdown>` | **`VQE<{ item, cost }>`** | Η ένωση συγκρούεται στο `unit` και συγχέει `wasteFactor` (item) με `wasteFactorApplied` (breakdown). Σύνθεση, όχι μετασχηματισμός — κανένα από τα δύο δεν αλλοιώνεται (§6.3 κανόνας 3) |
| 2 | `#1 → VQE<BOQSummary>` | **`VQE<BOQSummary \| null>`** + διάκριση αστοχίας | Το `getBuildingSummary()` επιστρέφει `null` **και** για «κενό κτίριο» **και** για εσωτερική αστοχία (καταπίνει το σφάλμα). Ο handler διαβάζει πρώτα τις γραμμές: κενές ⇒ `value: null` με `no_source_items`· γραμμές υπάρχουν αλλά σύνοψη `null` ⇒ **`INTERNAL`**. Φάκελος με `value: null` στη δεύτερη περίπτωση θα διαβαζόταν ως «κτίριο χωρίς επιμετρήσεις» |
| 3 | #1/#6 καλούν μία μέθοδο | **Διαβάζουν και τις γραμμές** | Ο φάκελος *παράγει* βάση/διακυβέρνηση/drift από τα items (§6.5 #1). Άθροισμα χωρίς τις γραμμές του δεν μπορεί να απαντήσει «είναι υπογράψιμο;». Τίμημα: μία επιπλέον ανάγνωση· η εναλλακτική θα ήταν αντιγραφή της ενορχήστρωσης του service — απαγορευμένη από §9. Χρέος Φάσης 3: μέθοδος που επιστρέφει άθροισμα *και* γραμμές |
| 4 | #2 χωρίς όριο | **`BOQ_SEARCH_MAX_ITEMS = 200`, με ΣΦΑΛΜΑ** | Σιωπηλή περικοπή είναι σφάλμα **τιμής**: ο πράκτορας αθροίζει περικομμένη λίστα νομίζοντας ότι είναι πλήρης. Υπέρβαση ⇒ `INVALID_ARGUMENT` με οδηγία να στενέψουν τα φίλτρα ή να χρησιμοποιηθεί το #1/#6 |
| 5 | — | **`requiresAdmin: true` και στα επτά** | Το BOQ εκθέτει μοναδιαία κόστη υλικών/εργασίας/εξοπλισμού — δηλαδή το περιθώριο κέρδους. Ίδιο κριτήριο με τα financial tools (ADR-242) |
| 6 | annotations δηλώνονται | **δένονται με την πολιτική** | Το πρότυπο MCP επιτρέπει σε annotation να λέει ψέματα (§3.2δ). Στον Νέστορα δεν μπορεί: το registry απορρίπτει κατά την κατασκευή κάθε `readOnlyHint` που αντιφάσκει με το `policy.access` |

**Το #5 δεν έχει αντίστοιχο σε κανένα ανταγωνιστικό προϊόν.**

---

## 8. Φάσεις Υλοποίησης

Κάθε φάση = αυτοτελές Plan Mode + commit. Ο Γιώργος ελέγχει το αποτέλεσμα πριν προχωρήσουμε (απόφαση 2026-07-30, κανόνας N.8).

| Φάση | Περιεχόμενο | Αρχεία | Ρίσκο |
|---|---|---|---|
| **0** | Αυτό το ADR | 1 | — |
| **1** ✅ | Τύποι VQE + `buildEnvelope()` + tests — **ΟΛΟΚΛΗΡΩΘΗΚΕ 2026-07-30** (§8.1) | 16 | Μηδενικό (νέος κώδικας) |
| **2** ✅ | Capability Registry + OpenAI adapter + τα 7 read tools — **ΟΛΟΚΛΗΡΩΘΗΚΕ 2026-07-30** (§8.2) | 17 | Χαμηλό (μόνο ανάγνωση) |
| **3α** ✅ | MCP adapter (L3) + **σύνδεση με τον in-app πράκτορα** + γεφύρωση SDK — **ΟΛΟΚΛΗΡΩΘΗΚΕ 2026-07-31** (§8.3) | 16 | Χαμηλό (εσωτερική επιφάνεια· μόνο ανάγνωση) |
| **3β** ✅ | **Streamable HTTP endpoint** + **OAuth 2.1 authorization server** + rate limiting — **ΟΛΟΚΛΗΡΩΘΗΚΕ 2026-07-31** (§8.4· ο AS σε **ADR-738**) | 27 | Μεσαίο (εξωτερική επιφάνεια) |
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

### 8.2 Παραδοτέα Φάσης 2 (2026-07-30)

**Κανένα υπάρχον αρχείο δεν τροποποιήθηκε πλην προσθηκών**: `types/vqe/envelope.ts` + barrel (δύο runtime κατάλογοι για τα `enum` του `outputSchema`), `types/boq/boq.ts` + barrel (`BOQ_SCOPE_VALUES`), `BOQEditorScopeSection.tsx` (κατανάλωση του νέου SSoT αντί χειρόγραφου αντιγράφου — N.0.2), `.ssot-registry.json` (2 modules). Τα `boqService`, `cost-engine.ts`, `boq-repository.ts`, `contracts.ts` **δεν αγγίχτηκαν**.

| Αρχείο | Ρόλος |
|---|---|
| `registry/parameter-spec.ts` | Η **μία** δήλωση παραμέτρων· από αυτήν παράγονται schema + έλεγχος + τύπος |
| `…/parameter-json-schema.ts` | Δήλωση → JSON Schema (OpenAI strict / MCP `inputSchema`) |
| `…/parameter-parse.ts` | Δήλωση → έλεγχος εισόδου, fail-closed |
| `…/json-schema.ts` | Το υποσύνολο JSON Schema που δέχονται **και τα τρία** adapters |
| `…/vqe-output-schema.ts` | ΕΝΑ σχήμα φακέλου για τις επτά δυνατότητες |
| `…/capability-types.ts` | Το συμβόλαιο ορισμού (`CapabilityDescriptor`, context, policy, annotations) |
| `…/capability-errors.ts` | Κλειστό λεξιλόγιο σφαλμάτων — υποσύνολο `google.rpc.Code` |
| `…/capability-registry.ts` | Κατάλογος + **μοναδική πύλη εκτέλεσης** (πολιτική → έλεγχος → handler) |
| `…/index.ts` | Barrel L2 |
| `capabilities/boq/boq-tenant-guard.ts` | **Κλείνει το κενό του §7.1** — μία πόρτα προς το `getById` |
| `…/boq-capability-shared.ts` | Κοινές παράμετροι/πολιτική + `withOwnedItem()` |
| `…/boq-value-schemas.ts` | Σχήματα φορτίου με **compile-time πληρότητα** (`Record<keyof T, SchemaField>`) |
| `…/boq-aggregate-capabilities.ts` | Εργαλεία 1, 6, 7 |
| `…/boq-item-capabilities.ts` | Εργαλεία 2-5 |
| `…/index.ts` | `createBoqCapabilities()` / `createBoqCapabilityRegistry()` |
| `adapters/openai-adapter.ts` + barrel | Παράγει το **υπάρχον** `AgenticToolDefinition` — όχι δεύτερη μορφή |
| + 5 test suites | **72 νέα tests** (σύνολο `agent-capability`: **152**) |

**Επαλήθευση (όχι μόνο «πράσινο»):** έξι σκόπιμες μεταλλάξεις επιβεβαίωσαν ότι τα tests πιάνουν τις αστοχίες που ισχυρίζονται:
1. αφαίρεση του ελέγχου ιδιοκτησίας ⇒ **6** tests κόκκινα·
2. διαρροή του `lastUpdated` της σύνοψης στο `params` του `buildEnvelope` ⇒ 1 κόκκινο (η παγίδα του §6.6)·
3. `required` χωρίς τα nullable κλειδιά ⇒ 2 κόκκινα (σχήμα + adapter)·
4. αντιστροφή σειράς «πολιτική πριν έλεγχο ορισμάτων» ⇒ **8** κόκκινα·
5. σιωπηλή περικοπή αποτελεσμάτων αναζήτησης αντί σφάλματος ⇒ 1 κόκκινο·
6. αφαίρεση του δεσμού annotation ↔ policy ⇒ 1 κόκκινο.

**Πύλες:** `jscpd --diff` καθαρό (0 clones / 26 αρχεία)· τα προϋπάρχοντα suites `measurements` + `types/boq` πράσινα αμετάβλητα· `npm run test:registry-golden` **101/102** — η μία αστοχία είναι στο module `date-local` και **προϋπάρχει** (αποδείχθηκε: το module είναι byte-ταυτόσημο με το HEAD).

**Τι ΔΕΝ έγινε σκόπιμα:** τα επτά εργαλεία **δεν** συνδέθηκαν στον ζωντανό `AgenticToolExecutor`. Δύο λόγοι, και οι δύο ουσιαστικοί: (α) το §8 ορίζει ότι οι Φάσεις 1-2 δεν αγγίζουν υπάρχοντα αρχεία· (β) **ασυμφωνία SDK** — το `boqService` χτίζεται πάνω στο **client** Firebase SDK, ενώ ο `agentic-tool-executor.ts` είναι `server-only` με admin SDK (το `api/boq/items/route.ts` παρακάμπτει σήμερα το service και χτυπά κατευθείαν admin Firestore). Η γεφύρωση είναι θέμα auth, δηλαδή **Φάση 3**. Γι' αυτό οι δυνατότητες δέχονται `IBOQService` με **ένεση**: η Φάση 3 αλλάζει μία γραμμή σύνδεσης, όχι επτά handlers.

---

### 8.3 Παραδοτέα Φάσης 3α (2026-07-31)

#### 8.3.1 ⛔ Η απόφαση που μπλόκαρε τα πάντα: ασυμφωνία client/admin SDK

Το `boqService` χτίζεται στο **client** Firebase SDK· ο `agentic-tool-executor` είναι `server-only` με **Admin** SDK. Σύνδεση των επτά δυνατοτήτων χωρίς γεφύρωση θα έτρεχε το client SDK **ανεξουσιοδότητο** μέσα στον server: τα rules κόβουν, το client repository **καταπίνει** το σφάλμα και γυρίζει `[]`, και ο πράκτορας ανακοινώνει «δεν βρέθηκαν επιμετρήσεις» — **σιωπηλά και ψευδώς**.

**Απόφαση: δρόμος Α** — νέα υλοποίηση ανάγνωσης με Admin SDK (`BOQAdminReadService`), ένεση μέσω `BoqCapabilityDeps`. Είναι **προσθήκη**: τα ίδια επτά capabilities εξυπηρετούν in-app πράκτορα, MCP και REST χωρίς αντιγραφή λογικής στο επίπεδο εργαλείων.

**Τρεις επιλογές που δεν κρύφτηκαν:**

| # | Απόφαση | Αιτιολόγηση |
|---|---|---|
| 1 | **Τα σφάλματα ρίχνουν** αντί να γίνονται `[]`/`null` | Το client μονοπάτι καταπίνει κάθε αστοχία. Για UI ανεκτό — ο άνθρωπος ξαναφορτώνει. Για πράκτορα που παρουσιάζει αριθμό **προς υπογραφή**, «κενό» και «δεν διάβασα» γίνονται δυσδιάκριτα και το μοντέλο δηλώνει το δεύτερο ως πρώτο με σιγουριά. Το registry μετατρέπει την εξαίρεση σε `INTERNAL` χωρίς διαρροή υποδομής. **Μοναδική εξαίρεση:** κενή συλλογή κατηγοριών ⇒ static ΑΤΟΕ (φυσιολογική κατάσταση, όχι αστοχία) |
| 2 | **`IBOQReadService` αντί `IBOQService`** (interface segregation) | Με ολόκληρο το service, το `deps.boq.delete(id)` έμενε **συντακτικά διαθέσιμο** σε handler ανάγνωσης και μόνη άμυνα ήταν ότι κανείς δεν το έγραψε. Ο στενός τύπος (`Pick<…>`, ώστε να μη γίνει δεύτερη πηγή υπογραφών) το κάνει αδύνατο σε compile-time — ίδια αρχή με §5.4 |
| 3 | **Εξαγωγή κοινών καθαρών κανόνων** σε 3 modules | Βλ. §8.3.2 |

#### 8.3.2 Απόκλιση από τον πάγο του §9 — τεκμηριωμένη, όχι σιωπηλή

Το §9 παγώνει `boq-repository.ts` / `boq-service.ts`. Η Φάση 3α **τα άγγιξε**, αποκλειστικά για **εξαγωγή** κοινού κώδικα (−54 γρ. / +20 γρ. στο repository· −14 / +7 στο service). Καμία αλλαγή σε ερώτημα, υπολογισμό ή συμπεριφορά· τα υπάρχοντα suites περνούν αμετάβλητα.

**Γιατί επιτράπηκε:** ο πάγος προστατεύει **υπολογισμό**· εδώ μετακινήθηκε **αντιστοίχιση**. Η εναλλακτική ήταν αντιγραφή, και η αντιγραφή εδώ αστοχεί με τον χειρότερο τρόπο — νέο πεδίο στο `BOQItem` θα ενημερωνόταν στο ένα αντίγραφο και θα έπεφτε `?? null` στο άλλο, δηλαδή **η οθόνη και ο πράκτορας θα ανέφεραν διαφορετικό αριθμό για το ίδιο έγγραφο**, χωρίς σφάλμα και χωρίς κόκκινο test. Απόφαση Γιώργου, 2026-07-31: «full SSoT, καμία έκπτωση».

Βρέθηκε επιπλέον **προϋπάρχον** διπλότυπο: ο static ΑΤΟΕ fallback ήταν γραμμένος **δύο φορές μέσα στο ίδιο** `boq-repository.ts`. Κεντρικοποιήθηκε (N.0.2).

| Αρχείο | Ρόλος |
|---|---|
| `measurements/boq-document-normalize.ts` | **ΝΕΟ SSoT** — έγγραφο → `BOQItem`/`BOQCategory`, ανεξάρτητο SDK |
| `measurements/boq-read-shared.ts` | **ΝΕΟ SSoT** — χάρτης ονομάτων κατηγορίας, φίλτρο κειμένου, `computeBoqStats` |
| `measurements/boq-atoe-fallback.ts` | **ΝΕΟ SSoT** — static ΑΤΟΕ (ήταν 2× μέσα στο repository) |
| `measurements/boq-read-contract.ts` | **ΝΕΟ** — `IBOQReadService` (6 μέθοδοι, `Pick<IBOQService, …>`) |
| `measurements/admin/boq-admin-read-service.ts` | **ΝΕΟ** — Admin SDK, `server-only`, σφάλματα ρίχνουν |
| `agent-capability/adapters/mcp-protocol-types.ts` | **ΝΕΟ** — wire types MCP· χωρίς εξάρτηση SDK (§8.3.3) |
| `agent-capability/adapters/mcp-adapter.ts` | **ΝΕΟ** — `toMcpTool` / `toMcpTools` / `toMcpCallToolResult` |
| `ai-pipeline/tools/handlers/boq-capability-handler.ts` | **ΝΕΟ** — γέφυρα `AgenticContext` → `CapabilityContext` → `registry.invoke()` |
| `ai-pipeline/tools/agentic-tool-catalog.ts` | **ΝΕΟ SSoT** — 40 χειρόγραφοι + 7 παραγόμενοι ορισμοί σε ένα σημείο |
| + 3 test suites | **50 νέα tests** (σύνολο `agent-capability` + `measurements`: **243**) |

**Τροποποιημένα** (προσθετικά/εξαγωγικά μόνο): `boq-repository.ts`, `boq-service.ts`, `boq-capability-shared.ts`, `boq-tenant-guard.ts`, `adapters/index.ts`, `agentic-tool-executor.ts`, `agentic-path-executor.ts`.

#### 8.3.3 Γιατί ΟΧΙ το `@modelcontextprotocol/sdk`

Το SDK φέρνει server runtime, transports και διαχείριση συνεδρίας — τίποτα από τα οποία δεν χρειάζεται ένα **adapter**, που κάνει καθαρή μετάφραση μορφής. Νέα εξάρτηση για ~40 γραμμές τύπων θα έσερνε τη μορφή του SDK μέσα στο L3 και θα αντέστρεφε το §5.2 (adapters που *παράγουν*, όχι που *υιοθετούν* ξένο μοντέλο). Όταν χρειαστεί πλήρης server (Φάση 3β) το SDK μπαίνει **εκεί** και καταναλώνει αυτούς τους τύπους.

#### 8.3.4 Επαλήθευση — όχι μόνο «πράσινο»

**Οκτώ** σκόπιμες μεταλλάξεις (πήχης Φάσης 2 = 6)· καθεμία κόκκινισε τα tests που ισχυρίζονται ότι την πιάνουν:

1. φύρα μετά τον πολλαπλασιασμό ⇒ **2** κόκκινα (**και στις δύο** διαδρομές ανάγνωσης — απόδειξη ότι μοιράζονται τον κανόνα)·
2. αφαίρεση εφεδρείας ονόματος κατηγορίας ⇒ 1·
3. παράλειψη `destructiveHint` ⇒ 1·
4. `structuredContent` σε αποτυχημένη κλήση ⇒ 1·
5. admin repository που **καταπίνει** το σφάλμα ⇒ **3**·
6. handler που επιστρέφει ωμή τιμή αντί φακέλου ⇒ 2·
7. `allowedUnits` χωρίς αντίγραφο ⇒ 1·
8. `requiresAdmin: false` στην πολιτική ⇒ **10**.

**Πύλες:** `jscpd --diff` καθαρό (0 clones / 11 αρχεία)· 243/243 tests πράσινα· τα προϋπάρχοντα suites `measurements`/`types/boq` αμετάβλητα.

#### 8.3.5 Τι ΔΕΝ έγινε — Φάση 3β

**Δεν υπάρχει ακόμη εξωτερικό MCP endpoint.** Ο adapter παράγει σωστά `Tool`/`CallToolResult`, αλλά κανένας transport δεν τα εκθέτει, άρα **κανένας εξωτερικός client (Claude Desktop, Cursor) δεν μπορεί να συνδεθεί σήμερα**. Συνεπώς δεν έγιναν ούτε το `withAuth()` στο HTTP σύνορο ούτε η επιλογή κατηγορίας rate limit — δεν υπάρχει route να τα φιλοξενήσει. Ο in-app πράκτορας **δεν** επηρεάζεται: αντλεί ταυτότητα από το `AgenticContext`, που χτίζει το ήδη ταυτοποιημένο pipeline.

> ✅ **Έκλεισε στη Φάση 3β** (2026-07-31, §8.4).

---

### 8.4 Παραδοτέα Φάσης 3β (2026-07-31) — transport + OAuth

#### 8.4.1 ⛔ Ο αποκλειστής ήταν ψευδοδίλημμα

Το handoff έθεσε «Α = μόνο bearer / Β = πλήρες OAuth (τεράστιο) / Γ = stdio bridge» και συνιστούσε το Α. Η έρευνα στο πρότυπο **2025-11-25** — την έκδοση που ήδη δηλώνει ο adapter μας — έδειξε ότι το «τεράστιο πακέτο Β» δεν υπάρχει: το spec ορίζει τον MCP server ως **resource server** και αφήνει τον authorization server **ρητά εκτός εμβέλειας** («It may be hosted with the resource server or a separate entity»). Επιπλέον το **DCR υποβαθμίστηκε σε `MAY`** και το **CIMD ανέβηκε σε `SHOULD`** — το handoff το ανέφερε ως απαίτηση.

**Απόφαση Γιώργου: δικός μας AS πάνω στο Firebase** (Firebase = *ποιος είσαι*· AS = *τι επιτρέπεις σε αυτόν τον πράκτορα*). Πλήρης τεκμηρίωση σε **ADR-738**.

#### 8.4.2 Τι παραδόθηκε

| Αρχείο | Ρόλος |
|---|---|
| `agent-capability/transport/mcp-http-guards.ts` | **ΝΕΟ** — `Origin`→403, `MCP-Protocol-Version`→400, απουσία ⇒ υπονοούμενη `2025-03-26` |
| `agent-capability/transport/mcp-jsonrpc.ts` | **ΝΕΟ** — καθαρή ανάλυση JSON-RPC 2.0· διάκριση request / notification / **απόκριση client** |
| `agent-capability/transport/mcp-method-dispatch.ts` | **ΝΕΟ** — `initialize` / `tools/list` / `tools/call` / `ping` |
| `agent-capability/transport/mcp-identity.ts` | **ΝΕΟ** — OAuth token (**με έλεγχο ακροατηρίου + scope**) → `CapabilityContext`· fallback Firebase |
| `agent-capability/capabilities/boq/boq-admin-registry.ts` | **ΝΕΟ SSoT** — το registry εξήχθη από τον `boq-capability-handler` (§8.4.3) |
| `app/api/mcp/route.ts` | **ΝΕΟ** — `POST` + `GET` στο ίδιο path, stateless, `application/json` |
| + 11 αρχεία OAuth AS + οθόνη συγκατάθεσης | **ADR-738** |

**Τροποποιημένα:** `middleware.ts` (εξαίρεση bot-block — βλ. ADR-738 §7.1), `next.config.js` (rewrites discovery), `firestore-collections.ts`, `firestore.rules`, `enterprise-id-*` (5 νέα προθέματα), `boq-capability-handler.ts` (καταναλώνει πλέον το κοινό registry), locales `el`/`en`.

#### 8.4.3 Το registry εξήχθη — N.0.2 στην πράξη

Στη Φάση 3α η σύνδεση «τεμπέλικο admin service → registry» ζούσε **ιδιωτικά** μέσα στον `boq-capability-handler.ts`, όπου ήταν ο μοναδικός καταναλωτής. Με το transport εμφανίστηκε δεύτερος. Η αντιγραφή θα έδινε **δύο registries** με τους ίδιους επτά ορισμούς — δηλαδή ένα `boq_get_item` που θα μπορούσε να συμπεριφέρεται αλλιώς στον in-app πράκτορα και αλλιώς στο Claude Desktop. Ακριβώς η κατηγορία σφάλματος που το §5.2 υπάρχει για να αποκλείσει. Εξήχθη σε `capabilities/boq/boq-admin-registry.ts`· τα 629 υπάρχοντα tests πέρασαν αμετάβλητα.

#### 8.4.4 Ρυθμίσεις που επιλέχθηκαν

- **Rate limit:** `STANDARD` (60/min) για το `/api/mcp` — ανάγνωση, όχι HEAVY· **`SENSITIVE`** (20/min) για κάθε OAuth endpoint (brute force σε codes/tokens). Καμία 7η κατηγορία.
- **Χωρίς SSE:** `POST` απαντά `application/json`· ο `GET` απαντά **405** με `Allow: POST` — ρητά επιτρεπτό από το πρότυπο. Τα επτά εργαλεία είναι σύντομα request/response.
- **Stateless:** κανένα `MCP-Session-Id`.
- **Χωρίς `@modelcontextprotocol/sdk`:** το §8.3.3 άφηνε την πόρτα ανοιχτή για τη Φάση 3β. Κλείνει με λόγο: το `StreamableHTTPServerTransport` γράφτηκε για Node `http`/Express, ενώ ο App Router δίνει Web `Request`/`Response`· η γεφύρωση κοστίζει περισσότερο — και είναι δυσκολότερα ελέγξιμη — από ~120 γραμμές καθαρού JSON-RPC για **τρεις** μεθόδους. Οι χειρόγραφοι τύποι του §8.3.3 **καταναλώνονται** όπως προβλεπόταν.

#### 8.4.5 Επαλήθευση

**185 νέα tests** σε 8 suites· σύνολο `agent-capability` + `lib/oauth` + `lib/security` = **357 πράσινα**· τα προϋπάρχοντα 629 (`agent-capability` + `ai-pipeline/tools`) αμετάβλητα.

**16 σκόπιμες μεταλλάξεις — 16 σκοτώθηκαν** (πήχης: Φ1=3, Φ2=6, Φ3α=8). Πλήρης πίνακας: **ADR-738 §8**. Ενδεικτικά: αφαίρεση ελέγχου ακροατηρίου (1 κόκκινο), `Origin` χωρίς έλεγχο (4), `redirect_uri` mismatch που γίνεται redirectable — **open redirect** (1), αστοχία εργαλείου που γίνεται JSON-RPC error αντί `isError` (1).

**CHECK 3.28 (jscpd):** έπιασε **πραγματικό** δίδυμο — η ανάλυση `resource` ήταν γραμμένη δύο φορές. Κεντρικοποιήθηκε· δεύτερη εκτέλεση καθαρή σε 21 αρχεία.

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
| Q2 ✅ | **MCP transport**: stdio ή HTTP+SSE; ⚠️ **Το ερώτημα ήταν λάθος διατυπωμένο** — το HTTP+SSE είναι **καταργημένο**. | **ΚΛΕΙΣΤΟ — Φάση 3α: Streamable HTTP (§10.2)** |
| Q3 | **Provider**: ο κώδικας είναι OpenAI (60 αρχεία). Το MCP είναι provider-agnostic — δεν απαιτείται αλλαγή | Καμία ενέργεια |
| Q4 ✅ | Ενοποίηση των 4 υπαρχόντων `firestore_*` generic tools με το registry, ή συνύπαρξη; | **ΚΛΕΙΣΤΟ — Φάση 2: συνύπαρξη, με ρητό σύνορο (§10.1)** |

### 10.1 Q4 — γιατί συνύπαρξη και ποιο είναι το σύνορο

**Απόφαση: συνύπαρξη.** Δεν υπάρχει επικάλυψη να ενοποιηθεί: τα `firestore_*` είναι *γενικά* εργαλεία πάνω σε **λίστα επιτρεπόμενων συλλογών** (`ALLOWED_READ_COLLECTIONS`, `executor-shared-types.ts`) — και οι συλλογές `boq_items` / `boq_categories` **δεν είναι μέσα σε αυτήν** (επαληθεύτηκε 2026-07-30). Άρα σήμερα κανένα generic εργαλείο δεν αγγίζει BOQ. Μετανάστευση των 40 χειρόγραφων ορισμών στο registry θα ήταν ξεχωριστό, υψηλού ρίσκου εγχείρημα με έξι ζωντανούς καταναλωτές, χωρίς όφελος ορθότητας εδώ.

**Το σύνορο είναι κανόνας, όχι σύμπτωση:** οι συλλογές BOQ **δεν επιτρέπεται** να προστεθούν στο `ALLOWED_READ_COLLECTIONS`. Ένα generic `firestore_query` πάνω σε `boq_items` θα επέστρεφε **ωμούς αριθμούς χωρίς φάκελο** — χωρίς βάση μέτρησης, χωρίς κατάσταση έγκρισης, χωρίς αποτύπωμα. Δηλαδή ακριβώς τη «γνώμη» που το §6.1 υπάρχει για να αποτρέψει, παρακάμπτοντας ταυτόχρονα τον έλεγχο ιδιοκτησίας του §7.1. Ποσότητα φεύγει προς πράκτορα **μόνο** μέσα σε VQE.

### 10.2 Q2 — γιατί Streamable HTTP, και η διόρθωση του ερωτήματος

**Το αρχικό ερώτημα ήταν άκυρο.** Ρωτούσε «stdio ή **HTTP+SSE**;». Το HTTP+SSE είναι η μεταφορά της έκδοσης πρωτοκόλλου **2024-11-05** και έχει **αντικατασταθεί** από το **Streamable HTTP**. Οι μόνες δύο επίσημες μεταφορές σήμερα είναι `stdio` και `Streamable HTTP` (σταθερή έκδοση **2025-11-25**· RC **2026-07-28**).

**Απόφαση: Streamable HTTP**, ένα endpoint (`POST` + `GET`), **stateless** (χωρίς `MCP-Session-Id`).

Ο Revit διάλεξε localhost bridge γιατί είναι **desktop εφαρμογή**: ο server ζει ήδη στο μηχάνημα του χρήστη. Ο Νέστωρ είναι **web εφαρμογή με ταυτότητα server-side** (Firebase custom claims, `withAuth()`). Με stdio, ένας τοπικός process θα χρειαζόταν δικά του διαπιστευτήρια **στον δίσκο του χρήστη** — υποβάθμιση ασφαλείας για μηδέν όφελος, αφού τα δεδομένα ζουν ήδη απομακρυσμένα. Το stateless σχήμα ταιριάζει επίσης στο μοντέλο εκτέλεσης του Next.js (καμία εγγυημένη συνέχεια διεργασίας μεταξύ αιτημάτων).

**Τι επιβάλλει η επιλογή στη Φάση 3β** (κανονιστικές απαιτήσεις του προτύπου, όχι προτιμήσεις):

- Ο server **MUST** επικυρώνει το `Origin` σε κάθε αίτημα (άμυνα σε DNS rebinding)· άκυρο ⇒ **403**.
- **SHOULD** πραγματική ταυτοποίηση σε κάθε σύνδεση — εδώ `withAuth()` + claims.
- Ο client **MUST** στέλνει `MCP-Protocol-Version` σε κάθε αίτημα μετά την αρχικοποίηση.

**Γνωστό κενό, ρητά καταγεγραμμένο:** οι εξωτερικοί MCP clients απαιτούν **OAuth 2.1** με discovery (`.well-known`) και Dynamic Client Registration. Ο Νέστωρ σήμερα ταυτοποιεί με Firebase ID token. Άρα ένα endpoint προστατευμένο μόνο με `withAuth()` θα δούλευε για δικούς μας καταναλωτές αλλά **δεν** θα συνδεόταν με Claude Desktop / Cursor. Η γεφύρωση είναι η ουσία της Φάσης 3β και **δεν** πρέπει να παρουσιαστεί ως «σχεδόν έτοιμη».

> ✅ **ΕΚΛΕΙΣΕ — Φάση 3β (2026-07-31).** Δύο διορθώσεις στην παραπάνω παράγραφο:
>
> 1. **Το Dynamic Client Registration ΔΕΝ απαιτείται πλέον.** Στο 2025-11-25
>    υποβαθμίστηκε σε `MAY` («included for backwards compatibility») και τη θέση
>    του πήραν τα **Client ID Metadata Documents** (`SHOULD`) — η αλλαγή που
>    πέρασε η Autodesk για λόγους ελέγχου πρόσβασης σε επίπεδο επιχείρησης.
> 2. **Η «γεφύρωση» δεν ήταν τεράστια, επειδή ο authorization server είναι
>    εκτός εμβέλειας του προτύπου.** Ο MCP server οφείλει μόνο PRM + `401`
>    challenge + επικύρωση ακροατηρίου. Ο AS υλοποιήθηκε δικός μας, πάνω από το
>    υπάρχον Firebase — **ADR-738**.

**Rate limiting (η δεύτερη εκκρεμότητα του §8.3.5):** `STANDARD` για το `/api/mcp`, **`SENSITIVE`** για τα OAuth endpoints. Επιλογή από τις 6 υπάρχουσες κατηγορίες· καμία 7η.

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
| 2026-07-31 | **Φάση 3β ΥΛΟΠΟΙΗΘΗΚΕ — ο Νέστωρ είναι πλέον MCP server, κυριολεκτικά.** Streamable HTTP endpoint (`POST`+`GET`, stateless, `application/json`) + **OAuth 2.1 authorization server** (ADR-738)· 27 αρχεία, 185 νέα tests, **16** μεταλλάξεις επαλήθευσης — **16 σκοτώθηκαν** (§8.4.5). **Ο αποκλειστής §3.1 του handoff ήταν ψευδοδίλημμα** και διορθώθηκε (§8.4.1): το πρότυπο 2025-11-25 αφήνει τον authorization server **εκτός εμβέλειας** και υποβάθμισε το **DCR σε `MAY`** υπέρ του **CIMD** — άρα το «Β» δεν ήταν το τεράστιο εγχείρημα που περιγράφηκε. Ακολουθήθηκε η γραμμή **Autodesk** (CIMD, σταθερές ταυτότητες client) και **Figma** (OAuth υποχρεωτικό, δικός τους AS πάνω από τη δική τους ταυτότητα). **N.0.2 στην πράξη:** το registry BOQ εξήχθη από τον `boq-capability-handler` σε κοινό SSoT μόλις εμφανίστηκε δεύτερος καταναλωτής — αλλιώς θα υπήρχαν δύο registries των ίδιων επτά εργαλείων (§8.4.3). **Δύο παγίδες που θα έσπαγαν σιωπηλά τα πάντα:** το bot-blocking του Edge έκοβε κάθε MCP client με 403 πριν τρέξει ο κώδικας, και το `isAdminRole()` ανήκει σε **άλλο λεξιλόγιο ρόλων** (ADR-738 §7.1, §7.2). **Το §8.3.3 έκλεισε με λόγο:** το `@modelcontextprotocol/sdk` **δεν** μπήκε — γράφτηκε για Node `http`, όχι για App Router· οι χειρόγραφοι τύποι καταναλώθηκαν όπως προβλεπόταν. **Έντιμη ονοματοδοσία:** ο όρος «MCP server» είναι πλέον **ακριβής** — υπάρχει transport, discovery και OAuth. Κατάσταση: **ACCEPTED — Φάσεις 1-3β σε κώδικα· Φάση 4 (write tools) εκκρεμής, χωριστή έγκριση.** |
| 2026-07-31 | **Φάση 3α ΥΛΟΠΟΙΗΘΗΚΕ.** MCP adapter (L3) + σύνδεση των 7 εργαλείων με τον in-app πράκτορα + γεφύρωση της ασυμφωνίας SDK· 16 αρχεία, 50 νέα tests, **8** μεταλλάξεις επαλήθευσης (§8.3). **Ο αποκλειστής §3.1 έκλεισε με δρόμο Α** (`BOQAdminReadService`), με δύο αποφάσεις που ξεπερνούν το ζητούμενο: τα σφάλματα **ρίχνουν** αντί να γίνονται ψευδές «κενό», και οι δυνατότητες δέχονται **`IBOQReadService`** ώστε καμία μέθοδος εγγραφής να μην είναι καν συντακτικά προσβάσιμη. **Ρητή απόκλιση από τον πάγο του §9** για εξαγωγή κοινού κώδικα, τεκμηριωμένη στο §8.3.2 (απόφαση Γιώργου: full SSoT)· βρέθηκε και **προϋπάρχον** διπλότυπο static ΑΤΟΕ, 2× μέσα στο ίδιο αρχείο. **Q2 έκλεισε** και το ερώτημα **διορθώθηκε**: το HTTP+SSE που ανέφερε είναι καταργημένο — επιλέχθηκε **Streamable HTTP** (§10.2). Κατάσταση: **ACCEPTED — Φάσεις 1-3α σε κώδικα· Φάση 3β (transport + OAuth) εκκρεμής, §8.3.5.** |
| 2026-07-30 | **Δημιουργία.** Φάση 1 (Αναγνώριση, N.0.1): χαρτογράφηση `src/` + έρευνα αγοράς/προτύπων. Κατάσταση DESIGN — καμία γραμμή κώδικα. Εκκρεμεί έγκριση Γιώργου για Φάση 1 υλοποίησης. |
| 2026-07-30 | **Φάση 2 ΥΛΟΠΟΙΗΘΗΚΕ.** Capability Registry (L2) + OpenAI adapter (L3) + τα 7 read tools· 18 αρχεία, 72 νέα tests, 6 μεταλλάξεις επαλήθευσης (§8.2). Προηγήθηκε υποχρεωτικό SSoT audit: επιβεβαιώθηκε ότι το `AgenticToolDefinition` είναι το SSoT μορφής (ο adapter το **παράγει**, δεν φτιάχνει δεύτερο)· μετρήθηκαν **40** ορισμοί — ο header του `agentic-tool-definitions.ts` έλεγε «8 generic tools», μπαγιάτικος· διαπιστώθηκε ότι **δεν** υπάρχει μετατροπέας Zod → JSON Schema (γι' αυτό η δήλωση παραμέτρων είναι ενιαία και παράγει και τα δύο)· βρέθηκε χειρόγραφο αντίγραφο των `BOQScope` τιμών σε component (κεντρικοποιήθηκε, N.0.2). **Το §7 διορθώθηκε: έλεγε ψέμα** — δύο κενά tenant isolation, ένα στο `getById` και ένα σοβαρότερο στο ίδιο το σχέδιο (`companyId` ως παράμετρος εργαλείου). Και τα δύο κλείνουν σε ντετερμινιστικό στρώμα (§7.1). **Q4 έκλεισε** (§10.1). Κατάσταση: **ACCEPTED — Φάσεις 1-2 σε κώδικα, Φάσεις 3-5 εκκρεμείς.** |
| 2026-07-30 | **Φάση 1 ΥΛΟΠΟΙΗΘΗΚΕ.** Τύποι VQE + `buildEnvelope()` + 80 tests (§8.1). Προηγήθηκε υποχρεωτικό SSoT audit: επιβεβαιώθηκε η υποψία διπλότυπου `ProvenanceWarning` ↔ `AllocationWarning` και λύθηκε με ενσωμάτωση (§6.5 #2)· εντοπίστηκε ότι το `sortKeys()` **δεν** μπορεί να χρησιμεύσει για hash (§6.7). Επτά αποκλίσεις από το αρχικό σχήμα, όλες τεκμηριωμένες στο §6.5. Νέο SSoT `types/boq/lifecycle.ts`. Το `engineVersion` έγινε αυτο-επαληθευόμενο (§6.6). Κατάσταση: **ACCEPTED — Φάση 1 σε κώδικα, Φάσεις 2-5 εκκρεμείς.** |
