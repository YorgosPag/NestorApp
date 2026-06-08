# HANDOFF — Επαναλαμβανόμενη απώλεια/κενή φόρτωση σκηνής: ROOT CAUSE + 2 fixes + εκκρεμές underfloor Μέρος 2

**Ημερομηνία:** 2026-06-08
**Μοντέλο:** Opus 4.8
**Κατάσταση:** 🔴 pending browser verify + commit (Giorgio). ΤΙΠΟΤΑ δεν έγινε commit.
**⚠️ SHARED working tree** με άλλον agent (mep-fixture/sanitary/licensing). `git add` ΜΟΝΟ δικά σου αρχεία — **ΠΟΤΕ `-A`**.

---

## 0) ΤΟ ΠΡΟΒΛΗΜΑ (αναφορά Giorgio)
«Εξαφανίστηκαν όλες οι οντότητες DXF+BIM από τον καμβά. Συμβαίνει αρκετές φορές την εβδομάδα.» (Τα δεδομένα είναι πρόχειρα/δοκιμαστικά — η απώλεια δεν πειράζει· **το ζητούμενο ήταν η ΡΙΖΑ**.)

## 1) DIAGNOSIS (από Firestore MCP — επιβεβαιωμένα δεδομένα)
- Όροφος «1ος Όροφος» (`flr_ea148848`, level `lvl_9ec374bf`) → `sceneFileId: file_0df264da`.
- Όροφος «2ος Όροφος» (`flr_b56e8ebc`, level `lvl_e9a2eec9`) → **ΙΔΙΟ** `file_0df264da` ⚠️ (cross-floor contamination).
- `file_0df264da` (_AfrPolGO.dxf): **revision 96, sizeBytes 95, sceneStats.entityCount 0** → η σκηνή blob είναι ΚΕΝΗ (γράφτηκε κενή ξανά και ξανά). Το DXF είχε γίνει process σε 0 entities εξαρχής (πιθανό encoding Windows-1253).
- **BIM ΔΕΔΟΜΕΝΑ ΑΣΦΑΛΗ** στο Firestore: 7 columns, 1 wall, 1 slab, 1 beam, 1 opening, 6 mep_fixtures (όλα `floorId flr_ea148848`). `floorplan_mep_underfloors = 0` (οι ενδοδαπέδιες δεν persist-άρονταν ποτέ → μόνο live scene).
- Το log ΔΕΝ είχε JS error → όχι render-crash· καθαρά load/save issue.

## 2) ROOT CAUSE (βρέθηκε)
`src/subapps/dxf-viewer/systems/levels/hooks/useLevelSceneLoader.ts`: ο auto-save target (`fileRecordId`/`currentFileName`) οριζόταν **ΜΟΝΟ** στο fresh-load path (`loadScene` success). Δύο πρόωρα `return` (fast-path «σκηνή ήδη στη μνήμη» + «already-loaded») έφευγαν **ΠΡΙΝ** οριστεί ο target → ο target έμενε **κολλημένος στον ΠΡΟΗΓΟΥΜΕΝΟ όροφο**. Αλλαγή σε ήδη-φορτωμένο όροφο + σχεδίαση → auto-save έγραφε στη **λάθος** DXF αρχείο + ξανα-συνέδεε → 2 levels/1 file, scene blob έπεφτε κενό (revision↑).

## 3) ΔΥΟ FIXES ΠΟΥ ΕΓΙΝΑΝ (uncommitted, δικά μου)
1. **ROOT CAUSE** — `systems/levels/hooks/useLevelSceneLoader.ts`: re-point του auto-save target στον **τρέχοντα** όροφο σε **ΚΑΘΕ** level change, **ΠΡΙΝ** τα fast-path returns (`if (sceneFileId) setFileRecordId(sceneFileId)+setCurrentFileName(level.sceneFileName) else reset`). Αφαιρέθηκε το διπλό reset στο `!sceneFileId` block. Cross-floor guard στο full-load παραμένει (κενοί/cross-floor όροφοι δεν μπαίνουν στο fast-path).
2. **FAIL-SAFE GUARD** — `hooks/scene/useAutoSaveSceneManager.ts`: `const isEmptyScene = scene.entities.length === 0;` + `&& !isEmptyScene` στο auto-save gate → **ποτέ δεν γράφεται κενή σκηνή** πάνω σε αρχείο. Fail-safe (μπορεί μόνο να αποτρέψει κακή εγγραφή).

- Και τα δύο **ΕΚΤΟΣ ADR-040** (δεν είναι canvas micro-leaf). tsc 0 δικά μου (verify ξανά). Κανένα υπάρχον test δεν σπάει· `cross-floor-link.test.ts` (pure helper) αμετάβλητο.

## 4) VERIFY (Giorgio)
- Browser: άλλαξε ορόφους μπρος-πίσω + σχεδίασε → οι αλλαγές πρέπει να σώζονται στον **σωστό** όροφο, καμία σκηνή να μη μηδενίζεται. Έλεγξε ότι `file_0df264da` revision **σταματά** να ανεβαίνει με κενό.
- ⚠️ Υπάρχον data corruption: «2ος Όροφος» δείχνει λάθος στο `file_0df264da`. Ο κώδικας τώρα δεν το χειροτερεύει, αλλά το **λάθος link θέλει χειροκίνητο fix** (re-link 2ου ορόφου σε δικό του sceneFileId, ή ξεκαθάρισμα). Δες `dxf_viewer_levels` doc `lvl_e9a2eec9.sceneFileId`.

## 5) FOLLOW-UPS
- 🔴 Hook-level test για `useLevelSceneLoader` (renderHook + mock sceneManager): «fast-path δεν αφήνει stale auto-save target» + «file-less level μηδενίζει target». ΔΕΝ γράφτηκε (χρόνος/context).
- ⚠️ DXF parse 0 entities για _AfrPolGO.dxf (Windows-1253) — ξεχωριστό· το raw .dxf (821KB) υπάρχει στο storage.
- N.15: ADR-399 changelog + memory ΔΕΝ ενημερώθηκαν ακόμα (context).

## 6) ΕΚΚΡΕΜΕΣ — ENDODAPEDIA Μέρος 2 (ΑΣΧΕΤΟ task, στο ίδιο tree)
Πριν το dataloss debugging, είχα ολοκληρώσει (uncommitted, **innocent** — stash test το απέδειξε):
- **Spiral/snail μοτίβο** + **στρογγυλεμένες κάμψεις (arc-fillet)** στην ενδοδαπέδια θέρμανση + **custom one-ring-per-vertex tube** (3D). jest 30/30, tsc 0.
- Αρχεία: `bim/mep-underfloor/mep-underfloor-geometry.ts`, `bim/types/mep-underfloor-types.ts`+`.schemas.ts`, `bim/renderers/MepUnderfloorRenderer.ts`, `bim-3d/converters/mep-underfloor-to-three.ts`, `ui/ribbon/data/contextual-mep-underfloor-tab.ts`, `ui/ribbon/hooks/useRibbonMepUnderfloorBridge.ts`, i18n el+en, +2 test, ADR-408 changelog.
- Φυσικό backup: `_wip_underfloor_backup/` (μπορεί να σβηστεί μετά το commit).
- ADR-408 changelog ΕΧΕΙ ήδη entry γι' αυτό. memory `project_adr408_underfloor.md` ενημερωμένο.

## 7) ΛΙΣΤΑ ΑΡΧΕΙΩΝ ΜΟΥ (git add ΜΟΝΟ αυτά — όχι του άλλου agent: mep-fixture*/sanitary*/licensing/)
**Dataloss fixes:**
- `src/subapps/dxf-viewer/systems/levels/hooks/useLevelSceneLoader.ts`
- `src/subapps/dxf-viewer/hooks/scene/useAutoSaveSceneManager.ts`
**Underfloor Μέρος 2:**
- `src/subapps/dxf-viewer/bim/mep-underfloor/mep-underfloor-geometry.ts` (+ `__tests__/mep-underfloor-geometry.test.ts`)
- `src/subapps/dxf-viewer/bim/types/mep-underfloor-types.ts`
- `src/subapps/dxf-viewer/bim/types/mep-underfloor.schemas.ts`
- `src/subapps/dxf-viewer/bim/renderers/MepUnderfloorRenderer.ts`
- `src/subapps/dxf-viewer/bim-3d/converters/mep-underfloor-to-three.ts` (+ `__tests__/mep-underfloor-to-three.test.ts`)
- `src/subapps/dxf-viewer/ui/ribbon/data/contextual-mep-underfloor-tab.ts`
- `src/subapps/dxf-viewer/ui/ribbon/hooks/useRibbonMepUnderfloorBridge.ts`
- `src/i18n/locales/el/dxf-viewer-shell.json`, `src/i18n/locales/en/dxf-viewer-shell.json`
- `docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md`

**ΜΗΝ adr-index. ΜΗΝ --no-verify. ΜΗΝ commit/push χωρίς εντολή Giorgio.**
