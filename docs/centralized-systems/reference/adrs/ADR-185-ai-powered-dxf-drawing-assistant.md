# ADR-185: AI-Powered DXF Drawing Assistant

> **Status**: DRAFT — Requirements Gathering
> **Date**: 2026-02-17
> **Category**: AI Architecture / DXF Viewer / CAD Automation
> **Related ADRs**: ADR-171 (Autonomous AI Agent), ADR-080 (AI Pipeline), ADR-031 (Command Pattern), ADR-032 (Drawing State Machine), ADR-057 (Entity Completion Pipeline)
> **Related Documents**:
> - [ADR-186: Building Code Module (ΝΟΚ)](./ADR-186-building-code-nok-module.md) — Modular κανονισμός δόμησης
> - [UC-DXF-AI: Use Cases](./UC-DXF-AI-use-cases.md) — Αναλυτικές περιπτώσεις χρήσης

---

## 0. Αποφάσεις από Συζήτηση (2026-02-17)

> Τα παρακάτω αποτελούν αποφάσεις που λήφθηκαν κατά τη διάρκεια συζήτησης μεταξύ Γιώργου Παγώνη και Claude. Κάθε απόφαση έχει αριθμό (Q-xx) για εύκολη αναφορά.

### Q-01: Target Users — Ποιοι χρησιμοποιούν το σύστημα

| Φάση | Χρήστες |
|------|---------|
| **Αρχικά** | Μόνο ο Γιώργος (admin/μηχανικός) |
| **Αργότερα** | + Μηχανικοί / Αρχιτέκτονες |

**Συνέπειες**: Admin-only access στην αρχή. Αργότερα role-based permissions. Η AI πρέπει να κατανοεί τεχνική CAD ορολογία.

---

### Q-02: Input Methods — Τρόποι εισαγωγής εντολών

| Μέθοδος | Υποστήριξη | Τεχνολογία |
|---------|-----------|-----------|
| **Text** (πληκτρολόγηση) | ✅ Ναι | Chat panel input |
| **Voice** (φωνή) | ✅ Ναι | OpenAI Whisper → text → pipeline |
| **Point + Voice/Text** (δείξιμο στον canvas) | ✅ Ναι | Click → coordinates → AI context |

**ΣΗΜΑΝΤΙΚΟ**: Multimodal input. Ο χρήστης μπορεί να κλικάρει ένα σημείο στον canvas και ταυτόχρονα να λέει/γράφει "σχεδίασε κύκλο εδώ". Η AI λαμβάνει τις συντεταγμένες του κλικ ως context.

---

### Q-03: UI Position — Θέση AI Panel

**Απόφαση**: **Δεξί sidebar** — σταθερό, πάντα ορατό (consistent με existing Voice AI panel pattern).

---

### Q-04: Execution Mode — Preview ή άμεση εκτέλεση

**Απόφαση**: **Υβριδικό**, ανάλογα με την πολυπλοκότητα:

| Τύπος εντολής | Συμπεριφορά | Παράδειγμα |
|---------------|------------|-----------|
| **Απλή** (1-3 entities) | Άμεση εκτέλεση + undo | "Σχεδίασε γραμμή", "Σβήσε τον κύκλο" |
| **Σύνθετη** (4+ entities) | Preview (ghost) → Confirm/Cancel | "Σχεδίασε κάτοψη 3 δωματίων" |

**Λογική**: Ο χρήστης δεν ενοχλείται με confirmations στα απλά, αλλά δεν χάνει τον έλεγχο στα σύνθετα. Η AI αποφασίζει αυτόματα βάσει αριθμού entities.

---

### Q-05: Γλώσσα επικοινωνίας

**Απόφαση**: **Δίγλωσσο** — Ελληνικά + Αγγλικά + μεικτά

| Παράδειγμα | Γλώσσα |
|-----------|--------|
| "Σχεδίασε ορθογώνιο 4x3m" | Ελληνικά |
| "Draw a rectangle 4x3m" | Αγγλικά |
| "Κάνε offset 2 μέτρα" | Μεικτά |

Η AI απαντά στη γλώσσα του χρήστη. Αναγνωρίζει CAD terminology σε ελληνικά και αγγλικά.

---

### Q-06: Τοποθέτηση entities — Coordinate Awareness

**Απόφαση**: **Context-aware positioning**

| Κατάσταση canvas | Συμπεριφορά τοποθέτησης |
|-----------------|----------------------|
| **Κενός canvas** (τίποτα δεν υπάρχει) | Κέντρο τρέχουσας οθόνης |
| **Υπάρχει σχέδιο** (π.χ. τοπογραφικό) | Σε σχέση με το υπάρχον σχέδιο |
| **Χρήστης κλίκαρε σημείο** | Στο κλικαρισμένο σημείο |
| **Χρήστης δίνει συντεταγμένες** | Στις δοσμένες συντεταγμένες |

**ΚΡΙΣΙΜΟ**: Τα τοπογραφικά χρησιμοποιούν πραγματικές συντεταγμένες (π.χ. ΕΓΣΑ '87). Η AI πρέπει να σέβεται αυτό το coordinate system — δεν μπορεί απλά να βάλει κάτι στο (0,0) αν το οικόπεδο βρίσκεται σε πραγματικές γεωγραφικές συντεταγμένες.

---

### Q-07: Μονάδες μέτρησης

**Απόφαση**: **Μέτρα (m)** ως default, με αυτόματη μετατροπή

| Input χρήστη | Μετατρέπεται σε |
|-------------|----------------|
| "10 μέτρα" | 10 m |
| "200 χιλιοστά" / "200mm" | 0.2 m |
| "50 εκατοστά" / "50cm" | 0.5 m |
| "10" (χωρίς μονάδα) | 10 m (default) |

---

### Q-08: Layer Management

**Απόφαση**: **Αυτόματο layer assignment** βάσει τύπου entity

Η AI αναθέτει αυτόματα layer ανάλογα με τι σχεδιάζει:

| Τύπος σχεδίασης | Layer |
|-----------------|-------|
| Τοίχοι | "Τοίχοι" / "Walls" |
| Πόρτες | "Πόρτες" / "Doors" |
| Παράθυρα | "Παράθυρα" / "Windows" |
| Έπιπλα | "Έπιπλα" / "Furniture" |
| Κολώνες | "Φέρον" / "Structural" |
| Γεωμετρία (γενικά) | "Γεωμετρία" / "Geometry" |
| Διαστάσεις | "Διαστάσεις" / "Dimensions" |

> **Σημείωση**: Το layer mapping θα είναι configurable. Αυτός ο πίνακας είναι αρχικό draft — θα συμπληρωθεί.

---

### Q-09: Session Memory

**Απόφαση**: **Session memory μόνο** (τρέχουσα συνεδρία)

| Τύπος μνήμης | Υποστήριξη | Λόγος |
|-------------|-----------|-------|
| **Session** (σημερινή συνεδρία) | ✅ ΥΠΟΧΡΕΩΤΙΚΟ | Αναφορές ("κάνε το ίδιο", "μετακίνησε αυτό") |
| **Cross-session** (αύριο) | ❌ Όχι αρχικά | Το σχέδιο σώζεται στο scene — η AI μπορεί να το "δει" ξανά. Αν χρειαστεί, προσθέτουμε εύκολα αργότερα. |

---

### Q-10: Building Code / ΝΟΚ — Κανονισμός δόμησης

**Απόφαση**: **ΑΠΑΡΑΙΤΗΤΟ εξαρχής** — modular αρχιτεκτονική

**Βασικές αρχές:**

1. Ο ΝΟΚ **ΔΕΝ** είναι hardcoded — είναι ένα **plugin/module** που ενεργοποιείται ή απενεργοποιείται
2. Ο χρήστης επιλέγει: **"Σχεδιάζω με κανονισμό"** ή **"Σχεδιάζω ελεύθερα"**
3. **Modular κανονισμοί**: ΝΟΚ Ελλάδας σήμερα, αύριο Γερμανικός, Κυπριακός, κλπ
4. Κάθε κανονισμός = **ξεχωριστό module** (Building Code Provider pattern)

**Πηγές παραμέτρων κανονισμού (πολλαπλές):**

| Πηγή | Περιγραφή |
|------|-----------|
| **Χειροκίνητα** | Ο χρήστης εισάγει ΣΔ, κάλυψη, ύψος, αποστάσεις |
| **Upload διαταγμάτων** | Ανεβάζει PDF/σκαν → AI διαβάζει (Vision API) |
| **Web search** | Η AI ψάχνει βάσει συντεταγμένων/περιοχής |
| **Override** | "Λάθος ΣΔ, είναι 0.8" → η AI διορθώνει |

**ΣΗΜΑΝΤΙΚΟ**: Η πολεοδομική νομοθεσία στην Ελλάδα είναι εξαιρετικά περίπλοκη — κάθε οικόπεδο μπορεί να έχει διαφορετικούς όρους δόμησης, ειδικά ΠΔ, τροποποιήσεις ΓΠΣ. Αυτό αναλύεται σε ξεχωριστό **ADR-186**.

---

### Q-11: Ερώτηση σε εκκρεμότητα — Στυλ σχεδίασης τοίχων

> **ΠΡΟΣ ΣΥΖΗΤΗΣΗ**: Μονή γραμμή (σκίτσο) ή διπλή γραμμή με πάχος (ρεαλιστικό);
> Πιθανή απάφαση: Εξαρτάται από τη φάση σχεδιασμού — σκίτσο στην αρχή, λεπτομερές αργότερα.

---

## 1. Context & Motivation

### 1.1 Τι ζητάμε

Ενσωμάτωση τεχνητής νοημοσύνης στον DXF Viewer ώστε ο χρήστης να μπορεί μέσω φυσικής γλώσσας (text ή φωνή) να:

- **Σχεδιάζει** γεωμετρικά σχήματα (γραμμές, κύκλους, ορθογώνια, πολύγωνα)
- **Τροποποιεί** υπάρχοντα σχέδια (μετακίνηση, παράλληλη, κάθετη, επέκταση, διαγραφή)
- **Μετράει** (αποστάσεις, εμβαδά, γωνίες)
- **Αναλύει** σχέδια (αναγνώριση χώρων, υπολογισμός εμβαδών, αρχιτεκτονική ανάλυση)
- **Δημιουργεί** σύνθετα αρχιτεκτονικά στοιχεία (δωμάτια, επιπλωμένους χώρους, κατόψεις)

### 1.2 Γιατί τώρα

1. **Η υποδομή υπάρχει ήδη**: Ο DXF Viewer έχει πλήρες programmatic API (20+ εργαλεία σχεδίασης, Command Pattern με undo/redo, entity builders) και η εφαρμογή έχει production-ready agentic AI pipeline (ADR-171)
2. **Η αγορά κινείται ραγδαία**: AutoCAD 2026 ενσωμάτωσε natural language commands, το Zoo (ex-KittyCAD) προσφέρει production Text-to-CAD API, Y Combinator χρηματοδοτεί startups (Adam AI, DraftAid)
3. **Ανταγωνιστικό πλεονέκτημα**: Ελάχιστες εφαρμογές real estate / construction management ενσωματώνουν AI-powered drawing
4. **Σταδιακή μάθηση**: Χτίζοντας τώρα τη βάση, κάθε νέα γενιά AI μοντέλων (GPT-5, GPT-6) θα αξιοποιείται αυτόματα χωρίς αλλαγές κώδικα

### 1.3 State of the Art (Έρευνα Αγοράς, Φεβρουάριος 2026)

| Προϊόν/Project | Τύπος | Προσέγγιση | Status |
|---------------|-------|-----------|--------|
| **AutoCAD 2026** (Autodesk) | Commercial | Natural Language → AutoCAD commands, AI Assistant | Production |
| **Autodesk Forma** | Commercial | Generative site design, environmental analysis | Production |
| **Zoo (ex-KittyCAD)** | Open Source + API | Text-to-CAD, KCL language, MCP Server | Production API |
| **Adam AI** (YC W25) | SaaS | Text-to-3D CAD co-pilot | Early Production |
| **DraftAid** (YC) | SaaS | AI 3D-to-2D fabrication drawings | Production |
| **CAD-MCP** | Open Source | Natural language → AutoLISP → AutoCAD | Experimental |
| **ArchiCAD AI** (Graphisoft) | Commercial | AI chatbot + Stable Diffusion visualizer | Beta |
| **MIT VideoCAD** | Research | AI learns CAD UI from video demonstrations | Research |
| **Text2CAD** | Research (NeurIPS 2024) | End-to-end text → parametric CAD | Research |
| **CAD-GPT** | Research | Spatial reasoning enhanced MLLM | Research |

**Βασικά συμπεράσματα έρευνας:**

1. **MCP Protocol** είναι το κυρίαρχο integration pattern AI↔CAD (2025-2026)
2. **Code Generation** (AI → domain code → CAD engine) υπερτερεί σε editability vs direct mesh generation
3. **General-purpose LLMs** (GPT-4o, Claude) λειτουργούν ως **orchestrators** (tool calling), όχι ως geometric engines
4. **OpenAI Function Calling** + strict mode = reliable tool execution

---

## 2. Υπάρχουσα Υποδομή (What We Already Have)

### 2.1 DXF Viewer — Drawing System

**Εργαλεία σχεδίασης** (20+):

| Κατηγορία | Εργαλεία |
|-----------|----------|
| **Βασικά** | `line`, `rectangle`, `polyline`, `polygon` |
| **Κύκλοι** (ADR-083) | `circle`, `circle-diameter`, `circle-2p-diameter`, `circle-3p`, `circle-chord-sagitta`, `circle-2p-radius`, `circle-best-fit` |
| **Τόξα** (ADR-059) | `arc-3p`, `arc-cse`, `arc-sce` |
| **Μετρήσεις** | `measure-distance`, `measure-distance-continuous`, `measure-area`, `measure-angle` |
| **Σύνθετα** | `useLineParallel`, `useLinePerpendicular`, `useCircleTTT` (tangent-tangent-tangent) |

**Programmatic API:**

```typescript
// Entity creation (pure function, no side effects)
createEntityFromTool(tool: DrawingTool, points: Point2D[], entityId: string, arcFlipped: boolean): ExtendedSceneEntity

// Entity completion (applies styles, adds to scene, tracks for undo)
completeEntity(entity, { tool, levelId, getScene, setScene, trackForUndo }): CompleteEntityResult

// Command Pattern (undo/redo, serializable)
CreateEntityCommand, DeleteEntityCommand, MoveEntityCommand, MoveVertexCommand
```

**Scene Management:**

```typescript
// Scene structure
SceneModel = {
  entities: AnySceneEntity[],
  layers: Record<string, SceneLayer>,
  bounds: { min: Point2D, max: Point2D },
  units: 'mm' | 'cm' | 'm'
}

// Level management
useLevels() → { currentLevelId, getLevelScene, setLevelScene }
```

**Entity Types:**

| Entity | Properties |
|--------|-----------|
| `LineEntity` | start: Point2D, end: Point2D |
| `CircleEntity` | center: Point2D, radius: number |
| `ArcEntity` | center, radius, startAngle, endAngle |
| `PolylineEntity` | vertices: Point2D[], closed?: boolean |
| `RectangleEntity` | corner1: Point2D, corner2: Point2D |
| `TextEntity` | position: Point2D, text: string, fontSize? |
| `PointEntity` | position: Point2D |

**Βασικά αρχεία:**

```
src/subapps/dxf-viewer/
├── hooks/drawing/
│   ├── useUnifiedDrawing.tsx          — Main drawing API
│   ├── drawing-entity-builders.ts     — Entity creation (pure)
│   ├── completeEntity.ts             — Completion pipeline (ADR-057)
│   ├── drawing-preview-generator.ts   — Preview system
│   ├── drawing-types.ts              — Type definitions
│   ├── useLineParallel.ts            — Parallel line
│   ├── useLinePerpendicular.ts       — Perpendicular line
│   └── useCircleTTT.ts              — Circle tangent-tangent-tangent
├── core/commands/
│   ├── interfaces.ts                 — ICommand interface
│   ├── CommandHistory.ts             — Undo/redo stacks
│   └── entity-commands/              — Create, Delete, Move commands
├── types/
│   ├── entities.ts                   — Entity type definitions
│   └── scene.ts                      — Scene types
└── stores/
    └── ToolStateStore.ts             — Tool state management
```

### 2.2 AI Pipeline — Agentic System (ADR-171)

**Υποδομή που υπάρχει:**

| Component | Αρχείο | Λειτουργία |
|-----------|--------|-----------|
| Agentic Loop | `agentic-loop.ts` | Multi-step reasoning (7 iterations, 50s timeout) |
| Tool Definitions | `agentic-tool-definitions.ts` | 8 tools, OpenAI strict mode JSON Schema |
| Tool Executor | `agentic-tool-executor.ts` | Secure execution engine with whitelisting |
| Pipeline Orchestrator | `pipeline-orchestrator.ts` | Routing + execution + chat history |
| Chat History | `chat-history-service.ts` | 20 messages, 24h TTL |
| Firestore Schema Map | `firestore-schema-map.ts` | 25 collection schemas for AI awareness |

**Existing tools:**
`firestore_query`, `firestore_get_document`, `firestore_count`, `firestore_write`, `send_email_to_contact`, `send_telegram_message`, `get_collection_schema`, `search_text`

**Αρχιτεκτονικό pattern:**

```
User message → Pipeline Orchestrator → Agentic Loop → OpenAI (tool calling)
                                                      ↕
                                               Tool Executor
                                                      ↓
                                               Final Answer
```

### 2.3 Voice AI (ADR-161, ADR-164)

- **Global Voice Assistant**: Header microphone → OpenAI Whisper → text → AI pipeline
- **In-App Voice AI**: Right-side chat panel → voice/text input → AI response
- **Δυνατότητα**: Ήδη μπορεί ο χρήστης να μιλήσει → μετατροπή σε text → εκτέλεση

---

## 3. Αρχιτεκτονική Απόφαση

### 3.1 Επιλεγμένο Pattern: **Agentic Tool Calling (Server-Side)**

```
┌──────────────────────────────────────────────────────┐
│                  DXF Viewer UI                        │
│                                                       │
│  ┌─────────────────────┐  ┌────────────────────────┐  │
│  │   Canvas (Drawing)  │  │  AI Chat Panel         │  │
│  │                     │  │  ┌──────────────────┐   │  │
│  │   Entities, Grips,  │  │  │ "Σχεδίασε        │   │  │
│  │   Preview, Layers   │  │  │  ορθογώνιο 4x3m" │   │  │
│  │                     │  │  └──────┬───────────┘   │  │
│  └─────────────────────┘  └────────┼────────────────┘  │
│           ▲                         │                   │
│           │                         ▼                   │
│  ┌────────┴──────────────────────────────────────────┐  │
│  │              API Route: /api/dxf-ai               │  │
│  │  ┌──────────────────────────────────────────────┐ │  │
│  │  │         DXF Agentic Loop (server)            │ │  │
│  │  │  ┌────────────────┐  ┌────────────────────┐  │ │  │
│  │  │  │  OpenAI GPT-4o │  │ DXF Tool Executor  │  │ │  │
│  │  │  │  (tool calling)│→→│ (validates + plans) │  │ │  │
│  │  │  └────────────────┘  └────────┬───────────┘  │ │  │
│  │  └───────────────────────────────┼──────────────┘ │  │
│  └──────────────────────────────────┼────────────────┘  │
│                                     ▼                   │
│  ┌──────────────────────────────────────────────────┐   │
│  │        DXF Command Executor (client-side)        │   │
│  │  createEntityFromTool() → completeEntity()       │   │
│  │  CommandHistory (undo/redo)                       │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

### 3.2 Γιατί αυτό το pattern

| Εναλλακτική | Πλεονεκτήματα | Μειονεκτήματα | Απόφαση |
|-------------|---------------|---------------|---------|
| **A. Server-side tool calling** | Ασφάλεια, reuse existing pipeline | Client-server roundtrip, latency | **ΕΠΙΛΕΓΜΕΝΟ** |
| B. Client-side direct OpenAI | Χαμηλότερο latency | API key στο client, κίνδυνος ασφαλείας | Απορρίπτεται |
| C. MCP Protocol | Industry standard | Υπέρ-μηχανική για 2D CAD, θέλει external server | Μελλοντικά |
| D. Specialized CAD model | Καλύτερο geometric reasoning | Δεν υπάρχει production-ready για 2D | Μελλοντικά |

**Λόγοι επιλογής Pattern A:**
1. **Reuse**: Επαναχρησιμοποιούμε τον existing agentic loop (ADR-171) με νέα tool definitions
2. **Ασφάλεια**: Το OpenAI API key μένει server-side
3. **Auditability**: Server-side logging & audit trail
4. **Undo/Redo**: Κάθε AI action γίνεται μέσω του Command Pattern → πλήρης undo

### 3.3 Ροή εκτέλεσης

```
1. Χρήστης: "Σχεδίασε ένα ορθογώνιο 4x3 μέτρα στο κέντρο"
2. Client → POST /api/dxf-ai { message, canvasState? }
3. Server: Agentic Loop → OpenAI (tool calling, strict mode)
4. OpenAI decides: call tool "draw_rectangle" { width: 4, height: 3, position: "center" }
5. Server: DXF Tool Executor validates parameters, resolves coordinates
6. Server → Client: { actions: [{ tool: "rectangle", points: [{x:...,y:...}, {x:...,y:...}] }], answer: "Σχεδίασα ένα ορθογώνιο 4×3m..." }
7. Client: Εκτελεί createEntityFromTool() → completeEntity() → CommandHistory
8. Canvas ενημερώνεται, entity εμφανίζεται
```

---

## 4. Σταδιακή Υλοποίηση (Phased Approach)

### Phase 1: Foundation — Βασικές Εντολές Σχεδίασης

**Στόχος**: Ο χρήστης μπορεί να δημιουργεί και να διαγράφει βασικά σχήματα μέσω text.

**Scope:**
- Chat panel στον DXF Viewer (sidebar ή floating)
- API route `/api/dxf-ai`
- DXF-specific tool definitions (JSON Schema, strict mode)
- Client-side command executor

**Tools Phase 1:**

| Tool | Περιγραφή | Παράδειγμα |
|------|-----------|-----------|
| `draw_line` | Σχεδιάζει γραμμή | "Σχεδίασε γραμμή από (0,0) στο (100,200)" |
| `draw_rectangle` | Σχεδιάζει ορθογώνιο | "Ορθογώνιο 4x3 μέτρα" |
| `draw_circle` | Σχεδιάζει κύκλο | "Κύκλος ακτίνας 5m στο (50,50)" |
| `draw_polygon` | Σχεδιάζει πολύγωνο | "Τρίγωνο με κορυφές (0,0), (10,0), (5,8)" |
| `draw_polyline` | Σχεδιάζει πολυγραμμή | "Πολυγραμμή μέσα από τα σημεία..." |
| `delete_entity` | Διαγράφει entity | "Διέγραψε τον τελευταίο κύκλο" |
| `undo_action` | Αναίρεση | "Αναίρεσε" |
| `list_entities` | Λίστα entities | "Τι υπάρχει στο σχέδιο;" |
| `measure_distance` | Μέτρηση απόστασης | "Πόσο απέχουν αυτά τα δύο σημεία;" |

### Phase 2: Context-Aware — Σχετικές Εντολές

**Στόχος**: Ο χρήστης μπορεί να αναφέρεται σε υπάρχοντα entities και να τα τροποποιεί.

**Scope:**
- Canvas state awareness (AI "βλέπει" τα entities)
- Entity selection/reference μέσω text
- Γεωμετρικοί μετασχηματισμοί

**Tools Phase 2:**

| Tool | Περιγραφή | Παράδειγμα |
|------|-----------|-----------|
| `query_entities` | Αναζήτηση entities με κριτήρια | "Βρες όλες τις γραμμές" |
| `move_entity` | Μετακίνηση | "Μετακίνησε αυτό 5m δεξιά" |
| `copy_entity` | Αντιγραφή | "Αντίγραψε αυτό το ορθογώνιο" |
| `draw_parallel` | Παράλληλη γραμμή | "Παράλληλη σε απόσταση 2m" |
| `draw_perpendicular` | Κάθετη γραμμή | "Κάθετη σε αυτή τη γραμμή" |
| `extend_line` | Επέκταση γραμμής | "Επέκτεινε μέχρι τον τοίχο" |
| `trim_entity` | Αποκοπή | "Κόψε τη γραμμή στο σημείο τομής" |
| `mirror_entity` | Κατοπτρισμός | "Κατοπτρισμός ως προς τον άξονα Χ" |
| `rotate_entity` | Περιστροφή | "Περίστρεψε 45 μοίρες" |
| `scale_entity` | Κλιμάκωση | "Μεγάλωσε 2x" |
| `set_layer` | Αλλαγή layer | "Βάλε σε layer 'Τοίχοι'" |
| `set_style` | Αλλαγή στυλ | "Κάνε τη γραμμή κόκκινη, πάχος 2" |

### Phase 3: Vision — Κατανόηση Σχεδίου

**Στόχος**: Η AI "βλέπει" το σχέδιο (screenshot) και μπορεί να το αναλύσει.

**Scope:**
- Canvas screenshot → OpenAI Vision API (gpt-4o)
- Αρχιτεκτονική ανάλυση
- Χωρική αναγνώριση

**Tools Phase 3:**

| Tool | Περιγραφή | Παράδειγμα |
|------|-----------|-----------|
| `analyze_drawing` | Ανάλυση σχεδίου (vision) | "Τι βλέπεις σε αυτό το σχέδιο;" |
| `identify_rooms` | Αναγνώριση χώρων | "Πόσα δωμάτια έχει;" |
| `calculate_total_area` | Υπολογισμός εμβαδού | "Ποια η συνολική επιφάνεια;" |
| `suggest_improvements` | Προτάσεις βελτίωσης | "Τι βελτιώσεις προτείνεις;" |
| `annotate_drawing` | Αυτόματη σημείωση | "Βάλε labels στα δωμάτια" |

### Phase 4: Generative — Ευφυής Σχεδιασμός (Μακροπρόθεσμο)

**Στόχος**: Η AI δημιουργεί σύνθετα αρχιτεκτονικά στοιχεία.

**Scope:**
- Αρχιτεκτονικοί κανόνες (min/max διαστάσεις, building codes)
- Furniture library
- Template-based generation

**Περιπτώσεις χρήσης:**

| Περίπτωση | Περιγραφή | Παράδειγμα |
|-----------|-----------|-----------|
| Δημιουργία δωματίου | Σχεδιάζει πλήρες δωμάτιο | "Σχεδίασε υπνοδωμάτιο 4x3m με πόρτα και παράθυρο" |
| Επίπλωση | Τοποθέτηση επίπλων | "Επίπλωσε το σαλόνι" |
| Κάτοψη | Πλήρης κάτοψη | "Σχεδίασε κάτοψη διαμερίσματος 80τμ, 2 υπνοδωμάτια" |
| Αυτόματη διαστασιολόγηση | Dimensions | "Βάλε διαστάσεις σε όλους τους τοίχους" |

---

## 5. Περιπτώσεις Χρήσης (Use Cases)

> **Βλέπε ξεχωριστό αρχείο**: [UC-DXF-AI-use-cases.md](./UC-DXF-AI-use-cases.md)
>
> Οι περιπτώσεις χρήσης τεκμηριώνονται σε ξεχωριστό αρχείο λόγω μεγέθους και πολυπλοκότητας.
> Περιλαμβάνει UC-DXF-001 έως UC-DXF-020+ με αναλυτικές ροές, εναλλακτικές, και edge cases.

---

## 6. Τεχνικές Αποφάσεις

### 6.1 AI Provider

| Επιλογή | Tool Calling | Vision | Ελληνικά | Κόστος | Απόφαση |
|---------|-------------|--------|----------|--------|---------|
| **OpenAI GPT-4o** | Strict mode ✅ | Εξαιρετικό ✅ | Πολύ καλά ✅ | Μέτριο | **ΕΠΙΛΕΓΜΕΝΟ** (Phase 1-3) |
| OpenAI GPT-4o-mini | Strict mode ✅ | Καλό ✅ | Καλά ✅ | Χαμηλό | Εναλλακτικό (αν θέλουμε χαμηλό κόστος) |
| Claude 4.5 Sonnet | Tool use ✅ | Εξαιρετικό ✅ | Πολύ καλά ✅ | Μέτριο | Μελλοντικό |
| Specialized CAD model | Δεν υπάρχει ✅ | — | — | — | Phase 4+ |

**Επιλογή**: GPT-4o για tool calling + vision. Μελλοντικά multi-provider support.

### 6.2 Γλώσσα εντολών

- **Ελληνικά**: Πρωτεύουσα γλώσσα (ο Γιώργος και οι πελάτες μιλούν ελληνικά)
- **Αγγλικά**: Υποστηρίζονται (GPT-4o τα χειρίζεται εξίσου)
- **System prompt**: Δίγλωσσο (instructions στα αγγλικά, αλλά respond στη γλώσσα του χρήστη)

### 6.3 Coordinate System

- **Μονάδες**: Μέτρα (m) ως default, configurable
- **Origin**: (0,0) = κάτω-αριστερά (CAD convention)
- **Αναφορά θέσης**: Absolute coordinates ή relative ("5 μέτρα δεξιά")
- **Snap**: AI-generated points περνούν μέσα από snap system

### 6.4 Ασφάλεια

- **Rate limiting**: Ίδιο με existing API endpoints (ADR-068)
- **Input validation**: AI output validated πριν εκτελεστεί στο client
- **Undo guarantee**: Κάθε AI action = undo-able command
- **Max entities per request**: Limit (π.χ. 50) για αποφυγή abuse
- **API key**: Server-side only (ΔΕΝ στο client)

---

### 6.5 Geometry Engine — Server-Side Υπολογισμοί (Έρευνα #1, 2026-02-17)

> **Πηγές**: ICCV 2025 (CAD-Assistant paper), LLMs for CAD Survey (arxiv:2505.08137)

**ΚΡΙΣΙΜΟ ΕΥΡΗΜΑ**: Τα LLMs έχουν 42-80% αποτυχία σε complex spatial/geometric tasks. **ΠΟΤΕ** μην αφήνεις την AI να υπολογίζει γεωμετρία. Η AI αποφασίζει **τι** σχεδιάζεται — ο server κάνει τους γεωμετρικούς υπολογισμούς σε **deterministic code**.

**Προτεινόμενες βιβλιοθήκες** (όλες FREE, permissive licenses):

| Βιβλιοθήκη | Άδεια | Τι κάνει | Χρήση στο σύστημα |
|------------|-------|----------|-------------------|
| **@flatten-js/core** | MIT | Πλήρης 2D geometry (intersections, distances, containment) | **ΚΟΡΥΦΑΙΑ ΕΠΙΛΟΓΗ** — κεντρικός geometry engine |
| **polyclip-ts** | MIT | Polygon boolean operations (union, difference) | Room detection, walls |
| **clipper2-wasm** | BSL-1.0 | Polygon offset | Πάχος τοίχων (wall offset/thickness) |
| **rbush** | MIT | Spatial index (R-tree) | Performance — "βρες entities κοντά σε σημείο" |
| **robust-predicates** | ISC | Ακρίβεια floating-point | Αποφυγή CAD precision bugs |
| **@turf/turf** | MIT | Geospatial analysis | Τοπογραφικά, ΕΓΣΑ'87 |

> **Σημείωση**: Όλες οι παραπάνω έχουν **permissive licenses** (MIT/ISC/BSL) — δεν υποχρεώνουν open-source. Συμβατές με ADR-034 (License Compliance).

**Planned file structure**:
```
src/services/geometry-engine/
├── geometry-engine.ts              — Facade (main API)
├── intersection-solver.ts          — Line-line, line-circle, circle-circle
├── offset-calculator.ts            — Parallel lines, wall offsets
├── spatial-index.ts                — R-tree spatial indexing (rbush)
├── coordinate-transformer.ts       — ΕΓΣΑ'87, unit conversions
└── precision-utils.ts              — Robust predicates
```

---

### 6.6 AI Provider Abstraction — Αποφυγή Vendor Lock-in (Έρευνα #2, 2026-02-17)

> **Ερώτηση Γιώργου**: "Αν αύριο θέλω να φύγω από OpenAI και να πάω σε Anthropic ή κάποιο άλλο σύστημα, θα υπάρχει πρόβλημα;"
> **Απαίτηση**: Μία πληρωμή AI provider (ΟΧΙ πολλαπλά APIs), ελευθερία αλλαγής provider χωρίς refactoring.

**Στρατηγική**: **AI Provider Abstraction Layer** — ένα ενιαίο interface, πολλαπλοί providers πίσω.

#### Αξιολογημένες λύσεις:

| Λύση | Άδεια | Πλεονεκτήματα | Μειονεκτήματα | Απόφαση |
|------|-------|---------------|---------------|---------|
| **Vercel AI SDK** | Apache 2.0 | Ήδη χρησιμοποιούμε Vercel, unified API, streaming, tool calling support, OpenAI/Anthropic/Google/Mistral/Ollama, Next.js native | — | **ΚΟΡΥΦΑΙΑ ΕΠΙΛΟΓΗ** |
| LangChain.js | MIT | Μεγάλο ecosystem, πολλοί providers | Βαρύ (bundle size), over-engineering για εμάς | Απορρίπτεται |
| LiteLLM | MIT | 100+ providers, proxy mode | Python only (δεν ταιριάζει σε Next.js) | Απορρίπτεται |
| OpenRouter | Proprietary | 200+ models, single API key | **Πληρώνεις τρίτο** (middleware fee), vendor lock-in | Απορρίπτεται |
| Custom abstraction | — | Πλήρης έλεγχος | Χρόνος ανάπτυξης, maintenance | Fallback αν χρειαστεί |

#### Vercel AI SDK — Γιατί ΚΟΡΥΦΑΙΑ ΕΠΙΛΟΓΗ:

1. **Apache 2.0 license** — δεν υποχρεώνει open-source (ADR-034 compliant)
2. **Ήδη χρησιμοποιούμε Vercel** — zero friction integration
3. **Unified API**: Αλλαγή `openai('gpt-4o')` → `anthropic('claude-4.5-sonnet')` = **1 γραμμή κώδικα**
4. **Tool calling support**: Δουλεύει identically σε OpenAI, Anthropic, Google
5. **Streaming**: Built-in streaming για progressive rendering
6. **No middleware fees**: Πληρώνεις μόνο τον AI provider, **ΤΙΠΟΤΑ** στη Vercel για το SDK

#### Pattern αλλαγής provider:

```typescript
// ΠΡΙΝ (OpenAI)
import { openai } from '@ai-sdk/openai';
const model = openai('gpt-4o');

// ΜΕΤΑ (Anthropic) — αλλαγή 1 ΓΡΑΜΜΗΣ
import { anthropic } from '@ai-sdk/anthropic';
const model = anthropic('claude-4.5-sonnet');

// Το υπόλοιπο ΟΛΟΚΛΗΡΟ σύστημα ΠΑΡΑΜΕΝΕΙ ΙΔΙΟ
const result = await generateText({ model, tools, messages });
```

#### Βελτιστοποίηση κόστους AI:

| Στρατηγική | Περιγραφή | Εξοικονόμηση |
|-----------|-----------|-------------|
| **Model routing** | gpt-4o-mini για 80% εντολών, gpt-4o μόνο για vision/complex | ~70% |
| **Prompt caching** | Cached system prompts (OpenAI, Anthropic υποστηρίζουν) | ~50% στα input tokens |
| **Context pruning** | Μόνο ορατά entities + summary, ΟΧΙ ολόκληρο canvas state | ~60% |
| **Batched requests** | Ομαδοποίηση σύνθετων εντολών | Μείωση roundtrips |

> **ΑΠΟΦΑΣΗ**: Ξεκινάμε με OpenAI directly (ήδη λειτουργεί). Εισάγουμε Vercel AI SDK στο Phase 1 ώστε από την αρχή να έχουμε provider-agnostic κώδικα. Η αλλαγή μπορεί να γίνει **οποιαδήποτε στιγμή** χωρίς refactoring.

---

### 6.7 Performance & UX — Πράγματα που μας διέφευγαν (Έρευνα #1, 2026-02-17)

> Ευρήματα από research σε production AI-CAD systems.

| Εύρημα | Περιγραφή | Ενέργεια |
|--------|-----------|---------|
| **Coordinates σε mm (integers)** | `{x: 3500, y: 2000}` αντί `{x: 3.5, y: 2.0}`. Τα integers είναι πιο ακριβή στο context ενός LLM (λιγότερα floating-point λάθη). | Εσωτερικά mm integers → display σε m |
| **Context pruning** | ΜΗΝ στέλνεις ΟΛΟ το canvas state στην AI. Μόνο τα ορατά entities + summary. | Token budget: max 2000 tokens canvas context |
| **Progressive rendering** | Μια σύνθετη εντολή μπορεί να πάρει 10-30 δευτερόλεπτα. Πρέπει να δείχνουμε progress. | Streaming + entity-by-entity rendering |
| **Batched undo** | Μία εντολή AI = πολλά entities (π.χ. 50). Το undo πρέπει να τα αναιρεί ΟΛΑ μαζί. | `CommandGroup` pattern: 1 undo = αναίρεση πλήρους AI action |

---

### 6.8 Open Source Reference Projects (Έρευνα #1, 2026-02-17)

| Project | Άδεια | Τι κάνει | Πώς μας βοηθά |
|---------|-------|----------|---------------|
| **tldraw "Make Real"** | Apache 2.0 | Canvas → screenshot → GPT-4V → εφαρμογή | Pattern για vision-based interaction |
| **Zoo/KittyCAD** | MIT | Text-to-CAD, KCL language, MCP Server | UI reference implementation |
| **FloorspaceJS** | BSD | Floor plan editor (NREL) | Floor plan UI/UX reference |

---

## 7. File Structure (Planned)

```
src/
├── app/api/dxf-ai/
│   └── route.ts                          — API endpoint
├── services/dxf-ai/
│   ├── dxf-ai-tool-definitions.ts        — Tool JSON Schemas
│   ├── dxf-ai-tool-executor.ts           — Server-side executor
│   ├── dxf-ai-system-prompt.ts           — System prompt builder
│   └── dxf-ai-coordinate-resolver.ts     — Coordinate logic
├── services/geometry-engine/             — Server-side geometry (Έρευνα #1)
│   ├── geometry-engine.ts                — Facade (main API)
│   ├── intersection-solver.ts            — Line-line, line-circle, circle-circle
│   ├── offset-calculator.ts              — Parallel lines, wall offsets
│   ├── spatial-index.ts                  — R-tree spatial indexing (rbush)
│   ├── coordinate-transformer.ts         — ΕΓΣΑ'87, unit conversions
│   └── precision-utils.ts                — Robust predicates, mm integers
├── subapps/dxf-viewer/
│   ├── components/ai-panel/
│   │   ├── DxfAiChatPanel.tsx            — Chat UI component
│   │   ├── DxfAiMessageBubble.tsx        — Message display
│   │   └── DxfAiActionPreview.tsx        — Preview πριν εκτέλεση
│   ├── hooks/
│   │   ├── useDxfAiChat.ts              — Chat state management
│   │   └── useDxfAiExecutor.ts          — Client-side command executor
│   └── services/
│       └── dxf-ai-client-executor.ts     — Μετατρέπει AI actions → Commands
```

---

## 8. Βιβλιογραφικές Αναφορές

### Ακαδημαϊκά Papers

1. **Text2CAD** — NeurIPS 2024 Spotlight — arxiv:2409.17106
2. **CAD-GPT** — Spatial Reasoning Enhanced MLLM — arxiv:2412.19663
3. **LLMs for Computer-Aided Design: A Survey** — arxiv:2505.08137 (Μάιος 2025)
4. **MIT VideoCAD** — Learning CAD from Video — arxiv:2505.24838 (Νοέμβριος 2025)
5. **CAD-Llama** — LLM for Parametric 3D — arxiv:2505.04481

### Commercial & Open Source

6. AutoCAD 2026 AI — autodesk.com/blogs/autocad/autocad-2026/
7. Autodesk Forma — autodesk.com/products/forma/overview
8. Zoo Text-to-CAD — zoo.dev/text-to-cad
9. Zoo KCL Language — zoo.dev/research/introducing-kcl
10. Adam AI (YC W25) — adam.new
11. DraftAid — draftaid.io
12. CAD-MCP (GitHub) — github.com/daobataotie/CAD-MCP

### Geometry Libraries (Έρευνα #1)

13. @flatten-js/core (MIT) — npmjs.com/package/@flatten-js/core
14. polyclip-ts (MIT) — npmjs.com/package/polyclip-ts
15. clipper2-wasm (BSL-1.0) — npmjs.com/package/clipper2-wasm
16. rbush (MIT) — npmjs.com/package/rbush
17. robust-predicates (ISC) — npmjs.com/package/robust-predicates
18. @turf/turf (MIT) — npmjs.com/package/@turf/turf

### AI Provider Abstraction (Έρευνα #2)

19. Vercel AI SDK (Apache 2.0) — sdk.vercel.ai
20. tldraw "Make Real" (Apache 2.0) — github.com/tldraw/make-real
21. FloorspaceJS (BSD) — github.com/NREL/floorspace.js

### Research Papers (Έρευνα #1)

22. **ICCV 2025 CAD-Assistant** — LLMs as planners, not renderers (42-80% geometric failure rate)
23. **Prompt Engineering for CAD** — Coordinates in mm integers, context pruning strategies

---

## 9. Ανοιχτές Ερωτήσεις [ΠΡΟΣ ΣΥΖΗΤΗΣΗ]

> Εντοπίστηκαν κατά τον έλεγχο γραμμή-γραμμή (2026-02-17). Πρέπει να απαντηθούν πριν ξεκινήσει η υλοποίηση.

### Εκκρεμείς Αποφάσεις (Q-11+)

| # | Ερώτηση | Αναφορά | Status |
|---|---------|---------|--------|
| **Q-11** | **Στυλ σχεδίασης τοίχων**: Μονή γραμμή (σκίτσο), διπλή γραμμή με πάχος (ρεαλιστικό), ή και τα δύο; | Section 0 → Q-11 | ΑΝΟΙΧΤΗ |
| **Q-12** | **Error handling AI**: Τι γίνεται όταν η AI αποτύχει; Επιστρέφει λάθος συντεταγμένες; Δεν καταλαβαίνει την εντολή; Timeout; Πώς ειδοποιείται ο χρήστης; | — | ΑΝΟΙΧΤΗ |
| **Q-13** | **Budget AI κλήσεων**: Πόσο budget ανά μήνα σε AI API calls; Αυτό καθορίζει model routing (gpt-4o-mini vs gpt-4o) και token limits. | Section 6.6 | ΑΝΟΙΧΤΗ |
| **Q-14** | **Multi-level (όροφοι)**: Ο DXF Viewer υποστηρίζει levels. Η AI θα καταλαβαίνει "σχεδίασε στον 2ο όροφο"; Θα μπορεί να αλλάξει level; Είναι Phase 1 ή αργότερα; | Section 2.1 | ΑΝΟΙΧΤΗ |
| **Q-15** | **Αλληλεπίδραση με imported DXF**: Αν ο χρήστης κάνει import ένα DXF αρχείο, η AI μπορεί να τροποποιήσει τα imported entities; Ή μόνο entities που δημιουργήθηκαν στον viewer; | UC-DXF-011 | ΑΝΟΙΧΤΗ |
| **Q-16** | **Canvas state format**: Τι ακριβώς στέλνεται στην AI ως context; Entity list σε JSON; Summary (π.χ. "3 ορθογώνια, 5 γραμμές"); Viewport info; Ποιο είναι το max token budget; | Section 6.7 | ΑΝΟΙΧΤΗ |
| **Q-17** | **Snap integration**: Τα AI-generated points περνούν μέσα από snap system (grid snap, entity snap, endpoint snap); Ποια snap modes ενεργοποιούνται; | Section 6.3 | ΑΝΟΙΧΤΗ |
| **Q-18** | **Auth & permissions**: Πώς κλειδώνεται το AI panel; Feature flag; Role-based; Ποιοι ρόλοι έχουν πρόσβαση; | Q-01 | ΑΝΟΙΧΤΗ |
| **Q-19** | **Offline/degraded mode**: Αν πέσει το OpenAI API (ή αλλάξει provider), ο DXF Viewer συνεχίζει να λειτουργεί κανονικά χωρίς AI; Ή εξαρτάται; | Section 6.6 | ΑΝΟΙΧΤΗ |
| **Q-20** | **Server timeout**: Η Vercel έχει 10s default (60s με maxDuration). Σύνθετες εντολές (π.χ. κάτοψη) μπορεί να πάρουν >60s. Τι κάνουμε; Streaming; Chunked responses; | Section 6.7 | ΑΝΟΙΧΤΗ |
| **Q-21** | **DXF Export**: Μετά τη σχεδίαση με AI, ο χρήστης μπορεί να κάνει export σε DXF file; Αυτό υπάρχει ήδη ή πρέπει να χτιστεί; | UC-DXF-016 | ΑΝΟΙΧΤΗ |

### Αντιφάσεις που χρειάζουν διευκρίνιση

| # | Αντίφαση | Πού βρέθηκε | Πρόταση |
|---|----------|------------|---------|
| **C-01** | **Μονάδες: m vs mm** — Q-07 λέει "μέτρα ως default", αλλά Section 6.7 λέει "εσωτερικά mm integers". Πρέπει να διευκρινιστεί: ο χρήστης μιλάει σε μέτρα, αλλά εσωτερικά αποθηκεύονται σε mm; Ή ο χρήστης βλέπει mm; | Q-07 vs 6.7 | Χρήστης σε m, εσωτερικά mm → αυτόματη μετατροπή |
| **C-02** | **Vercel AI SDK migration**: Section 6.6 λέει "εισάγουμε στο Phase 1", αλλά η existing pipeline (ADR-171) χρησιμοποιεί OpenAI SDK directly. Μεταφέρουμε ΚΑΙ το existing pipeline σε Vercel AI SDK; Ή μόνο το DXF AI; | Section 6.6 vs ADR-171 | Μόνο DXF AI αρχικά, migrate existing αργότερα |

---

## 10. Changelog

| Date | Change | By |
|------|--------|-----|
| 2026-02-17 | Initial draft — Architecture, 4 phases, market research | Claude + Γιώργος |
| 2026-02-17 | Προσθήκη 11 αποφάσεων (Q-01 → Q-11) από συζήτηση | Claude + Γιώργος |
| 2026-02-17 | Use Cases μεταφέρθηκαν σε ξεχωριστό αρχείο (UC-DXF-AI-use-cases.md) | Claude |
| 2026-02-17 | Δημιουργία ADR-186 (Building Code / ΝΟΚ Module) | Claude + Γιώργος |
| 2026-02-17 | Έρευνα #1: Geometry libraries, αρχιτεκτονική AI-CAD, performance patterns | Claude |
| 2026-02-17 | Έρευνα #2: AI Provider abstraction, Vercel AI SDK, vendor lock-in avoidance | Claude + Γιώργος |
| 2026-02-17 | Προσθήκη sections 6.5-6.8: Geometry Engine, Provider Abstraction, Performance, References | Claude |
| 2026-02-17 | Έλεγχος γραμμή-γραμμή: 11 νέες ερωτήσεις (Q-12 → Q-21), 2 αντιφάσεις (C-01, C-02), fix τίτλου Section 3.1 | Claude |
