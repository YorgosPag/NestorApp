const S = 'systems/model-from-drawing/model-from-drawing-openings-session.ts';
const W = 'systems/model-from-drawing/model-from-drawing-session.ts';
const T = 'systems/model-from-drawing/assistant-status-tone.ts';
const P = 'bim/model-from-drawing/opening-preview.ts';
const R = 'bim/model-from-drawing/opening-review.ts';
const U = 'ui/panels/model-from-drawing/ModelFromDrawingOpeningSections.tsx';
const O = 'components/dxf-layout/ModelFromDrawingPreviewOverlay.tsx';
const H = 'app/ModelFromDrawingHost.tsx';
const L = 'systems/model-from-drawing/model-from-drawing-live.ts';

const tS = 'systems/model-from-drawing/__tests__/model-from-drawing-openings-session.test.ts';
const tW = 'systems/model-from-drawing/__tests__/model-from-drawing-session.test.ts';
const tR = 'bim/model-from-drawing/__tests__/opening-review.test.ts';
const tP = 'bim/model-from-drawing/__tests__/opening-preview.test.ts';
const tU = 'ui/panels/model-from-drawing/__tests__/ModelFromDrawingOpeningSections.test.tsx';
const tO = 'components/dxf-layout/__tests__/ModelFromDrawingPreviewOverlay.test.tsx';
const tH = 'app/__tests__/ModelFromDrawingHost.test.tsx';

const m = (id, module, suite, what, find, replace) => ({ id, module, suite, what, find, replace });

module.exports = {
  session: [
    m('s0', S, tS, 'identity'),
    m('s1', S, tS, 'χωρίς έλεγχο μπαγιάτικης σκηνής', '!== seen) {', '!== seen && false) {'),
    m('s2', S, tS, 'υιοθετεί και δείγμα «τοίχος»', "if (!pendingSample || sampleRole !== 'opening') return;", 'if (!pendingSample) return;'),
    m('s3', S, tS, 'δείγμα χωρίς καμπύλες', 'sampleColorAt(pendingSample, deps, true)', 'sampleColorAt(pendingSample, deps, false)'),
    m('s4', S, tS, 'χωρίς έλεγχο «υπάρχει τοίχος»', 'if (!sceneHasWalls(deps)) {', 'if (false) {'),
    m('s5', S, tS, 'απάντηση και σε μη αποφασίσιμο κλειδί', 'if (!choosable.has(key)) continue;', ''),
    m('s6', S, tS, 'νέο δείγμα κρατά παλιές απαντήσεις', 'recompute({ openingColorHex: sampled, openingChoices: new Map() }, deps);', 'recompute({ openingColorHex: sampled }, deps);'),
    m('s7', S, tS, 'οπλίζει και κλειστό βοηθό', "if (modelFromDrawingStore.get().phase === 'closed') return;", ''),
    m('s8', S, tS, 'ακύρωση πάντα στον έλεγχο', "phase: hasReview ? 'review' : 'picking'", "phase: 'review'"),
    m('s9', S, tS, 'ακύρωση και για δείγμα τοίχου', "if (state.phase !== 'picking' || state.sampleRole !== 'opening') return false;", "if (state.phase !== 'picking') return false;"),
    m('s10', S, tS, 'refresh χωρίς φραγμό δείγματος', "if (phase !== 'review' || !openingColorHex) return;", "if (phase !== 'review') return;"),
    m('s11', S, tS, 'ειδοποίηση με λάθος πλήθος', 'count: result.plan.openings.length', 'count: 0'),
  ],
  session2: [
    m('s3b', S, tS, 'δείγμα χωρίς καμπύλες (ξανά, μετά τη διόρθωση του test)', 'sampleColorAt(pendingSample, deps, true)', 'sampleColorAt(pendingSample, deps, false)'),
    m('s12', S, tS, 'keepNotice αγνοείται', 'if (keepNotice) modelFromDrawingStore.patch({ notice });', ''),
    m('s13', S, tS, 'η άρνηση του γραφέα αγνοείται', 'if (!result.plan) {', 'if (false) {'),
    m('s14', S, tS, '«τίποτα» = αφαίρεση απάντησης', 'else next.set(key, choice);', "else if (choice !== 'none') next.set(key, choice);"),
    m('s15', S, tS, 'η μπαγιάτικη δεν ανανεώνει την προεπισκόπηση', "modelFromDrawingStore.patch({ ...fresh, notice: { kind: 'stale' } });", "modelFromDrawingStore.patch({ notice: { kind: 'stale' } });"),
    m('s16', S, tS, 'οι απαντήσεις δεν φτάνουν στον πυρήνα', 'decisions: decisionsFromChoices(inputs.openingChoices),', ''),
    m('s17', S, tS, 'η προεπισκόπηση δεν μαθαίνει τις απαντήσεις', 'choices: inputs.openingChoices,', 'choices: new Map(),'),
    m('w0', W, tW, 'identity'),
    m('w1', W, tS, 'ο ελεγκτής τοίχων υιοθετεί δείγμα «κούφωμα»', "if (!pendingSample || sampleRole !== 'wall') return;", 'if (!pendingSample) return;'),
    m('w2', W, tH, 'refresh τοίχων χωρίς φραγμό πρότασης', "if (phase !== 'review' || !proposal) return;", "if (phase !== 'review') return;"),
    m('w3', W, tH, 'refresh τοίχων αγνοεί keepNotice', 'if (keepNotice) modelFromDrawingStore.patch({ notice });', ''),
    m('l0', L, tS, 'identity'),
    m('l1', L, tS, 'δείγμα πάντα χωρίς καμπύλες', '{ tessellateCurves: curves }', '{ tessellateCurves: false }'),
  ],
  preview: [
    m('w2b', W, tW, 'refresh τοίχων χωρίς φραγμό πρότασης (ξανά, με νέο test)', "if (phase !== 'review' || !proposal) return;", "if (phase !== 'review') return;"),
    m('p0', P, tS, 'identity'),
    m('p1', P, tS, '«θα γραφτεί» από λωρίδα, όχι από το σχέδιο', 'const pieces = written ? [written] : found', 'const pieces = found'),
    m('p2', P, tS, 'λωρίδα με διπλό πάχος', 'thickness / 2);', 'thickness);'),
    m('p3', P, tS, 'αποτύπωμα χωρίς ό,τι φωτίστηκε', '    preview.zones.map((zone) => zone.pieces),\n', ''),
    m('p4', P, tR, 'αποτύπωμα χωρίς την άρνηση', 'preview.refusal ?? null,', 'null,'),
    m('p5', P, tS, '«τίποτα» δεν φτάνει στη ζώνη', "dismissed: choices.get(item.key) === 'none',", 'dismissed: false,'),
    m('p6', P, tS, 'χωρίς ενοίκους', 'occupants: segmentsOf(occupantIds, entities),', 'occupants: [],'),
    m('p7', P, tS, '«υπάρχει ήδη» χωρίς το περίγραμμά του', ': found ? [ring(found)] : spanBand(item, walls, scale);', ': spanBand(item, walls, scale);'),
    m('p8', P, tP, 'σύμβολα χωρίς δειγματισμό τόξων', '{ tessellateCurves: true }', '{}'),
    m('p9', P, tP, 'η άρνηση του σχεδίου χάνεται', "...(planned.refusal ? { refusal: planned.refusal } : {}),", ''),
    m('p10', P, tP, 'το σχέδιο λαμβάνει ΟΛΑ τα στοιχεία', 'items: writable,', 'items: input.proposal.items,'),
    m('p11', P, tP, 'σύμβολο φωτίζεται και όταν υπάρχει λωρίδα', 'if (pieces.length === 0) item.sourceIds', 'if (true) item.sourceIds'),
  ],
  preview2: [
    m('p3b', P, tS, 'αποτύπωμα χωρίς ό,τι φωτίστηκε (ξανά, με μάρτυρα «η πρόταση δεν άλλαξε»)', '    preview.zones.map((zone) => zone.pieces),\n', ''),
    m('p12', P, tP, 'ένοικοι = όλες οι ανεξήγητες', 'const occupantIds = new Set(proposal.items.flatMap((item) => item.occupantIds ?? []));', 'const occupantIds = new Set(proposal.unexplainedIds);'),
    m('p13', P, tP, 'occupied πάντα ψευδές', 'occupied: isOccupiedOpening(item),', 'occupied: false,'),
    m('p14', P, tS, 'πάχος λωρίδας από τον δεύτερο τοίχο γέφυρας', "host.kind === 'bridge' ? host.wallIds[0]", "host.kind === 'bridge' ? host.wallIds[1]"),
    m('p15', P, tR, 'αποτύπωμα χωρίς την πρόταση', '    proposal.items,\n', ''),
    m('r0', R, tR, 'identity'),
    m('r1', R, tR, '«τίποτα» φτάνει στον πυρήνα', "if (choice !== 'none') decisions.set(key, choice);", 'decisions.set(key, choice as never);'),
    m('r2', R, tR, 'όμοια χωρίς κατάσταση ενοίκου', ' && isOccupiedOpening(item) === occupied)', ')'),
    m('r3', R, tR, 'όμοια χωρίς λόγο', 'item.reason === anchor.reason && ', ''),
    m('r4', R, tR, 'υπόδειξη «τίποτα» για όλα', "canChooseOpening(item) && isOccupiedOpening(item) ? 'none' : null", "canChooseOpening(item) ? 'none' : null"),
    m('r5', R, tR, 'μη εγγράψιμα μετρούν ως αναποφάσιστα', 'else if (!isDecidableOpening(item)) counts.blocked += 1;', ''),
    m('r6', R, tR, 'αποφασισμένο δεν δέχεται νέα απάντηση', 'return item.decided === true || isDecidableOpening(item);', 'return isDecidableOpening(item);'),
    m('r7', R, tR, 'η ουρά χάνει τα απαντημένα', " || item.decided === true);", ');'),
  ],
  review2: [
    m('r0b', R, tR, 'identity (με τα 2 νέα tests αποτυπώματος)'),
    m('p15b', P, tR, 'αποτύπωμα χωρίς την πρόταση (ξανά, με άγκυρα πόρτα→παράθυρο)', '    proposal.items,\n', ''),
    m('p16', P, tR, 'αποτύπωμα χωρίς τις ανεξήγητες', '    proposal.unexplainedIds,\n', ''),
    m('r8', R, tR, '«τίποτα» μετρά ως αναποφάσιστο', "else if (choices.get(item.key) === 'none') counts.dismissed += 1;", ''),
    m('r9', R, tR, 'υπόδειξη και σε μη αποφασίσιμο', "canChooseOpening(item) && isOccupiedOpening(item) ? 'none' : null", "isOccupiedOpening(item) ? 'none' : null"),
    m('r10', R, tR, 'όμοια και για μη αποφασίσιμη άγκυρα', 'if (!anchor || !canChooseOpening(anchor)) return [];', 'if (!anchor) return [];'),
    m('r11', R, tR, 'όμοια περιλαμβάνουν μη αποφασίσιμα', '.filter((item) => canChooseOpening(item) && item.reason', '.filter((item) => item.reason'),
    m('t0', T, tO, 'identity'),
    m('t1', T, tO, '«τίποτα» δεν αλλάζει τόνο', "  if (zone.dismissed) return 'reject';\n", ''),
    m('t2', T, tO, 'η άρνηση δεν αλλάζει τόνο', "  if (refused && (zone.status === 'door' || zone.status === 'window')) return 'reject';\n", ''),
    m('t3', T, tO, 'η άρνηση κοκκινίζει τα πάντα', "if (refused && (zone.status === 'door' || zone.status === 'window')) return 'reject';", "if (refused) return 'reject';"),
    m('t4', T, tO, 'παράθυρο με τόνο απόφασης', "  window: 'accept',", "  window: 'decide',"),
    m('o0', O, tO, 'identity'),
    m('o1', O, tO, 'χωρίς ετικέτα πόρτα/παράθυρο', 'label={labelKey ? t(labelKey) : undefined}', ''),
    m('o2', O, tO, 'τίποτα χωρίς πρόταση τοίχων', "if (phase === 'closed' || (!preview && !openingPreview)) return null;", "if (phase === 'closed' || !preview) return null;"),
  ],
  ui: [
    m('o3', O, tO, 'ένοικοι στο χρώμα της απόρριψης', 'segments={preview.occupants} tone="decide"', 'segments={preview.occupants} tone="reject"'),
    m('o4', O, tO, 'ετικέτα και στα «προς απόφαση»', "return status === 'door' || status === 'window' ? OPENING_CHOICE_LABEL_KEY[status] : null;", "return OPENING_CHOICE_LABEL_KEY[status === 'door' ? 'door' : 'window'];"),
    m('o5', O, tO, 'εστιασμένο άνοιγμα όχι τελευταίο', 'zone.key === focusedKey ? PREVIEW_ZONE_PAINT_ORDER.length :', 'false ? PREVIEW_ZONE_PAINT_ORDER.length :'),
    m('u0', U, tU, 'identity'),
    m('u1', U, tU, 'το Shift αγνοείται', 'similar: event.shiftKey };', 'similar: false };'),
    m('u2', U, tU, 'Ctrl/Alt/Meta δεν εξαιρούνται', '  if (event.ctrlKey || event.metaKey || event.altKey) return null;\n', ''),
    m('u3', U, tU, 'τα βέλη τυλίγουν', 'items[Math.min(items.length - 1, Math.max(0, activeIndex + key.delta))]', 'items[(activeIndex + key.delta + items.length) % items.length]'),
    m('u4', U, tU, 'αναποφάσιστα κλειδώνουν την έγκριση', 'disabled={counts.writable === 0 || refusal !== undefined}', 'disabled={counts.writable === 0 || counts.undecided > 0 || refusal !== undefined}'),
    m('u5', U, tU, 'η άρνηση δεν κλειδώνει την έγκριση', 'disabled={counts.writable === 0 || refusal !== undefined}', 'disabled={counts.writable === 0}'),
    m('u6', U, tU, 'δεύτερο κλικ δεν ξε-απαντά', 'onChoose(current === choice ? null : choice, false)', 'onChoose(choice, false)'),
    m('u7', U, tU, '«και στα όμοια» πριν από απάντηση', '{current !== undefined && similarCount > 0 ? (', '{similarCount > 0 ? ('),
    m('u8', U, tU, 'όλες οι γραμμές στο Tab', 'tabbable={i === activeIndex}', 'tabbable'),
  ],
  ui2: [
    m('u9', U, tU, 'η εστιασμένη γραμμή ξαναζητά την όψη', 'if (item.key !== focusedKey) actions.onFocus(item.key);', 'actions.onFocus(item.key);'),
    m('u10', U, tU, 'το 0 σημαίνει «τίποτα»', 'Digit0: null, Numpad0: null,', "Digit0: 'none', Numpad0: 'none',"),
    m('u11', U, tU, 'μη αποφασίσιμο με κουμπιά', 'const choosable = canChooseOpening(item);', 'const choosable = true;'),
    m('u12', U, tU, 'κλειδωμένη χωρίς εγγράψιμα: αγνοείται', 'disabled={counts.writable === 0 || refusal !== undefined}', 'disabled={refusal !== undefined}'),
    m('u13', U, tU, '«μένουν έξω» μετρά και τα απορριφθέντα', '{counts.undecided > 0 ? (', '{counts.undecided + counts.dismissed > 0 ? ('),
    m('u14', U, tU, 'όμοια μετρούν και τον εαυτό τους', 'similarOpeningKeys(proposal, item.key).length - 1)', 'similarOpeningKeys(proposal, item.key).length)'),
    m('u15', U, tU, 'ο ένοικος δεν φαίνεται', '{occupants > 0 ? (', '{false ? ('),
    m('u16', U, tU, 'το πλήκτρο αφορά πάντα το πρώτο', 'actions.onChooseOpening(targetKeys(proposal, items[activeIndex].key, key.similar), key.choice);', 'actions.onChooseOpening(targetKeys(proposal, items[0].key, key.similar), key.choice);'),
    m('u17', U, tU, 'γραμμή χωρίς ρόλο option', 'role="option" aria-selected={focused}', 'aria-selected={focused}'),
    m('u18', U, tU, 'το κλικ δεν επιστρέφει την εστίαση', '            rows.current.get(item.key)?.focus();\n', ''),
    m('h0', H, tH, 'identity'),
    m('h1', H, tH, 'το Esc κλείνει πάντα', 'if (!modelFromDrawingOpeningsSession.cancelSample()) modelFromDrawingSession.close();', 'modelFromDrawingSession.close();'),
    m('h2', H, tH, 'το δείγμα δεν φτάνει στον ελεγκτή ανοιγμάτων', '    modelFromDrawingOpeningsSession.adoptSample(getOpeningDeps());\n', ''),
    m('h3', H, tH, 'ίδια οδηγία και για τους δύο ρόλους', "useSamplePickMode(picking, state.sampleRole === 'opening'", 'useSamplePickMode(picking, false'),
  ],
  host2: [
    m('h0b', H, tH, 'identity (με τις 2 νέες άγκυρες)'),
    m('h7b', H, tH, 'ίδιο όνομα αναίρεσης με τους τοίχους (ξανά)', '({ ...getDeps(), undoName: openingsUndoName })', '({ ...getDeps() })'),
    m('h8b', H, tH, 'έγκριση κουφωμάτων δεν ξυπνά τους τοίχους (ξανά)', 'if (modelFromDrawingOpeningsSession.approve(getOpeningDeps())) modelFromDrawingSession.refresh(getDeps(), true);', 'modelFromDrawingOpeningsSession.approve(getOpeningDeps());'),
  ],
  host: [
    m('h4', H, tH, 'έγκριση τοίχων δεν ξυπνά τα κουφώματα', 'if (modelFromDrawingSession.approve(getDeps())) modelFromDrawingOpeningsSession.refresh(getOpeningDeps(), true);', 'modelFromDrawingSession.approve(getDeps());'),
    m('h5', H, tH, 'έγκριση κουφωμάτων σβήνει την ειδοποίησή της', 'modelFromDrawingSession.refresh(getDeps(), true);', 'modelFromDrawingSession.refresh(getDeps());'),
    m('h6', H, tH, 'έγκριση τοίχων σβήνει την ειδοποίησή της', 'modelFromDrawingOpeningsSession.refresh(getOpeningDeps(), true);', 'modelFromDrawingOpeningsSession.refresh(getOpeningDeps());'),
    m('h7', H, tH, 'ίδιο όνομα αναίρεσης με τους τοίχους', '({ ...getDeps(), undoName: openingsUndoName })', '({ ...getDeps() })'),
    m('h8', H, tH, 'έγκριση κουφωμάτων δεν ξυπνά τους τοίχους', 'if (modelFromDrawingOpeningsSession.approve(getOpeningDeps())) modelFromDrawingSession.refresh(getDeps(), true);', 'modelFromDrawingOpeningsSession.approve(getOpeningDeps());'),
  ],
};
