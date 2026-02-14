# DXF Viewer Investigation Report - Missing Draft Polygon Preview in Overlay Draw Mode

Date: 2026-02-14
Scope: Investigation only (no code changes).

## Τι ζήτημα αναφέρθηκε
Ροή χρήστη:
1. Επιλογή `layering/levels` από κεντρική εργαλειοθήκη.
2. Επιλογή `draw mode` για δημιουργία νέου έγχρωμου polygon.
3. Click στον καμβά για σημεία polygon.

Παρατήρηση: δεν εμφανίζονται οπτικά σημεία/προεπισκόπηση κατά τη δημιουργία, σε αντίθεση με line/rectangle/circle που έχουν εμφανή preview.

## Root Cause (βεβαιωμένο)
### 1) Early return στον LayerRenderer κόβει draft polygon με <3 σημεία
Το draft polygon αποδίδεται ως `ColorLayer`, αλλά ο renderer επιστρέφει αμέσως αν έχει λιγότερα από 3 vertices:
- `src/subapps/dxf-viewer/canvas-v2/layer-canvas/LayerRenderer.ts:478`
- Guard: `if (polygon.vertices.length < 3) return;`

Αυτό σημαίνει:
- στα πρώτα 1-2 clicks δεν ζωγραφίζεται ΤΙΠΟΤΑ,
- ούτε path ούτε grips, γιατί η λογική grips είναι κάτω από το early return.

Άρα το user feedback λείπει ακριβώς στο κρίσιμο αρχικό στάδιο σχεδίασης.

## Επιβεβαίωση ότι το draft state υπάρχει (δεν χάνεται)
Το draft layer δημιουργείται κανονικά:
- `src/subapps/dxf-viewer/hooks/layers/useOverlayLayers.ts:294`
- `draftColorLayer` με `showGrips: true` και `vertices: draftPolygon...`

Και περνάει στον LayerCanvas:
- `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx:1719`
- `layers={colorLayersWithDraft}`

Άρα το πρόβλημα δεν είναι στο state creation αλλά στο render gate.

## Αρχιτεκτονικό κενό SSoT (κεντρικοποίηση)
### 2) Overlay draw mode είναι εκτός unified preview pipeline
Για line/rect/circle υπάρχει unified drawing + PreviewCanvas (rubber-band preview). Για overlays υπάρχει ξεχωριστό path.

Τεκμήρια:
- `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx:1251`
- Σχόλιο/λογική: overlay draw χρησιμοποιεί `draftPolygon` και "not the unified engine".

Έτσι υπάρχουν δύο παράλληλα συστήματα preview:
1. Unified drawing preview (οντότητες DXF).
2. Overlay draft preview (layer pipeline).

Αυτό παραβιάζει "μία και μοναδική πηγή αλήθειας" για preview behavior.

## Δευτερεύον ρίσκο ορατότητας
Η ορατότητα draft layer εξαρτάται από `showLayers`:
- `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx:1725` (`layersVisible={showLayers}`)
- `src/subapps/dxf-viewer/canvas-v2/layer-canvas/LayerCanvas.tsx:459` (`filteredLayers = layersVisible ? layers : []`)

Αν `showLayers=false`, το draft preview κρύβεται πλήρως, ακόμα και σε draw mode.

## Γιατί οι άλλες οντότητες έχουν preview και τα overlays όχι
- Line/rectangle/circle: routed στο unified drawing system + hover preview path (`onDrawingHover`) + dedicated `PreviewCanvas`.
- Overlay draw: routed στο draft polygon path (LayerCanvas/LayerRenderer) με early cutoff για <3 σημεία.

## Συμπέρασμα
Το κύριο functional bug είναι deterministic:
- Ο renderer δεν αποδίδει draft polygon πριν το 3ο σημείο.

Το αρχιτεκτονικό θέμα είναι επίσης σαφές:
- Η overlay δημιουργία δεν μοιράζεται ενιαίο preview engine με τα υπόλοιπα drawing tools (διπλή λογική).

## Προτεινόμενη κατεύθυνση διόρθωσης (χωρίς υλοποίηση σε αυτή την αναφορά)
1. Να αποδίδονται ορατά draft points από το 1ο click (χωρίς early return που κόβει grips).
2. Να υπάρχει rubber-band segment (τελευταίο committed point -> current cursor), όπως στα λοιπά tools.
3. Να ενοποιηθεί preview pipeline ώστε overlays και DXF entities να μοιράζονται κοινό SSoT (ίδιο preview contract/renderer path).
4. Σε draw mode να μην εξαρτάται το draft visibility από `showLayers` ή να υπάρχει ρητός κανόνας "draft always visible while drawing".

## Confidence
High.
Το root cause τεκμηριώνεται απευθείας από line-level evidence σε state creation και render gating.
