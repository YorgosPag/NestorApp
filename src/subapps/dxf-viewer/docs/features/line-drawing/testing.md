# Line Drawing System - Testing & Verification

---

**📚 Part of:** [LINE_DRAWING_SYSTEM.md](../../LINE_DRAWING_SYSTEM.md)
**📂 Documentation Hub:** [README.md](README.md)
**🔗 Related Docs:** [implementation.md](implementation.md), [lifecycle.md](lifecycle.md), [status-report.md](status-report.md)

---

**Last Updated:** 2025-10-05
**Focus:** Test scenarios & enterprise checklist

---

## 📚 Navigation

| Document | Purpose |
|----------|---------|
| [← README](README.md) | Documentation index & quick start |
| [architecture.md](architecture.md) | Core architecture & dual canvas |
| [coordinates-events.md](coordinates-events.md) | Coordinate systems & mouse events |
| [rendering-dependencies.md](rendering-dependencies.md) | Rendering pipeline & file dependencies |
| [status-report.md](status-report.md) | Current implementation status |
| [root-cause.md](root-cause.md) | Why settings were never applied |
| [lifecycle.md](lifecycle.md) | Preview/Completion phases |
| [implementation.md](implementation.md) | Code changes needed |
| **[testing.md](testing.md)** | **← YOU ARE HERE** |

---

## 🧪 TEST SCENARIOS

### Test 1: Preview Phase Visual Feedback

**Objective:** Verify preview settings are applied during drawing

**Setup:**
1. Open DxfSettingsPanel → DXF Settings → Ειδικές → Preview
2. Set preview color to **GREEN** (#00FF00)
3. Set preview lineType to **DASHED**
4. Set preview opacity to **0.7** (70%)
5. Set preview lineWidth to **1.5**

**Steps:**
1. Click toolbar "Line" button
2. Click first point on canvas (anywhere)
3. Move mouse (don't click)

**Expected Result:**
- ✅ Grip appears at first click point (brown/orange dot)
- ✅ Grip follows cursor (brown/orange dot)
- ✅ Line between grips is **GREEN**
- ✅ Line is **DASHED**
- ✅ Line is **70% transparent** (semi-transparent)
- ✅ Line width is **1.5px**
- ✅ Distance label appears at line midpoint
- ✅ All updates happen smoothly (60 FPS, no lag)

**Failure Modes:**
| Symptom | Root Cause |
|---------|------------|
| Line is white instead of green | Preview settings not applied |
| Line is solid instead of dashed | lineType not applied |
| Line is 100% opaque | opacity not applied |
| No grips visible | showPreviewGrips flag not set |
| No distance label | showEdgeDistances flag not set |
| Updates are laggy | Performance issue (check FPS) |

---

### Test 2: Completion Phase Final Appearance

**Objective:** Verify completion settings are applied after drawing

**Setup:**
1. Open DxfSettingsPanel → DXF Settings → Ειδικές → Completion
2. Set completion color to **WHITE** (#FFFFFF)
3. Set completion lineType to **SOLID**
4. Set completion opacity to **1.0** (100%)
5. Set completion lineWidth to **1.0**

**Steps:**
1. Continue from Test 1 (preview already active)
2. Click second point to complete line

**Expected Result:**
- ✅ Line **instantly** changes from GREEN to WHITE
- ✅ Line **instantly** changes from DASHED to SOLID
- ✅ Line **instantly** changes from 70% to 100% opacity
- ✅ Line width changes from 1.5px to 1.0px
- ✅ Grips disappear
- ✅ Distance label disappears
- ✅ Line remains in scene (persistent)
- ✅ No flicker during transition

**Failure Modes:**
| Symptom | Root Cause |
|---------|------------|
| Line stays green | Completion settings not applied |
| Line stays dashed | lineType not changed |
| Grips still visible | Preview flags not removed |
| Distance label still visible | showEdgeDistances not cleared |
| Line disappears | Entity not added to scene |
| Flicker during transition | Rendering issue |

---

### Test 3: Settings Inheritance (Γενικές Fallback)

**Objective:** Verify fallback to Γενικές when Ειδικές not set

**Setup:**
1. Open DxfSettingsPanel → DXF Settings → Γενικές
2. Set general color to **RED** (#FF0000)
3. Set general lineType to **SOLID**
4. Set general opacity to **0.8**
5. Open Ειδικές tab
6. **CLEAR** all preview settings (leave empty - use general instead)
7. **CLEAR** all completion settings (leave empty - use general instead)

**Steps:**
1. Draw a line (any two points)
2. Observe both preview and completion phases

**Expected Result:**
- ✅ Preview line is **RED** (from Γενικές)
- ✅ Preview line is **SOLID** (from Γενικές)
- ✅ Preview opacity is **0.8** (from Γενικές)
- ✅ Completed line is **RED** (from Γενικές)
- ✅ Completed line is **SOLID** (from Γενικές)
- ✅ Completed opacity is **0.8** (from Γενικές)
- ✅ Both phases use same settings (no specific override)

**Failure Modes:**
| Symptom | Root Cause |
|---------|------------|
| Line is white/default color | Γενικές fallback not working |
| Preview different from completion | Inconsistent fallback |
| Settings ignored completely | useEntityStyles not called |

---

### Test 4: Real-Time Settings Update

**Objective:** Verify settings changes update preview in real-time

**Setup:**
1. Set preview color to GREEN (#00FF00)
2. Click Line tool
3. Click first point (preview active, mouse moving)

**Steps:**
1. **While preview is visible**, open DxfSettingsPanel
2. Change preview color from GREEN to **BLUE** (#0000FF)
3. **Don't click** (stay in preview phase)
4. Observe line appearance

**Expected Result:**
- ✅ Preview line **instantly** changes from GREEN to BLUE
- ✅ Change happens **without re-clicking**
- ✅ Smooth transition (no flicker)
- ✅ Line continues to follow cursor normally
- ✅ Grips and distance label remain visible

**Failure Modes:**
| Symptom | Root Cause |
|---------|------------|
| Preview stays green | Settings not reactive |
| Preview disappears | State reset on settings change |
| Need to re-click to see change | Dependency array missing settings |
| Flicker or lag | Performance issue |

---

### Test 5: Multi-Entity Consistency

**Objective:** Verify consistent settings across multiple entities

**Setup:**
1. Set preview color to GREEN, completion color to WHITE
2. Set preview lineType to DASHED, completion lineType to SOLID

**Steps:**
1. Draw 5 lines in sequence (Line 1 → Line 5)
2. Observe each line during preview and after completion

**Expected Result:**
- ✅ All 5 **previews** are GREEN, DASHED (consistent)
- ✅ All 5 **completed lines** are WHITE, SOLID (consistent)
- ✅ No color mixing between entities
- ✅ No settings bleeding from one line to another
- ✅ Each line independently uses correct settings

**Failure Modes:**
| Symptom | Root Cause |
|---------|------------|
| Some previews are white | Settings not applied consistently |
| Some completed lines are green | Completion settings missed |
| Settings from Line 1 affect Line 2 | State not properly isolated |
| Random colors appear | Race condition in settings application |

---

## 📋 ENTERPRISE CHECKLIST

### ISO 9000 Quality Management

- [ ] Real-time feedback during drawing (preview phase)
- [ ] Clear visual distinction between phases (preview vs completion)
- [ ] Dimensional accuracy (distance labels show correct values)
- [ ] User-configurable appearance (DxfSettingsPanel settings work)
- [ ] Consistent behavior across entity types
- [ ] No data loss (entities persist correctly)

### AutoCAD Compatibility

- [ ] Preview uses dashed lines (industry standard)
- [ ] Completion uses solid lines (industry standard)
- [ ] Grip color: Brown/orange (#CD853F - AutoCAD standard)
- [ ] Distance labels during drawing (professional CAD workflow)
- [ ] Snap indicators (geometric precision)
- [ ] 60 FPS performance (no lag)

### Performance Standards

- [ ] 60 FPS update rate (16.67ms per frame max)
- [ ] No lag between mouse move and visual update
- [ ] Efficient rendering (incremental updates, not full scene re-render)
- [ ] No memory leaks (entities properly garbage collected)
- [ ] Smooth transitions (no flicker between phases)

### Data Integrity

- [ ] Entity properties saved with entity (color, lineweight, opacity)
- [ ] Settings independent of rendering (can change renderer without losing data)
- [ ] Export/import preserves properties (DXF export includes all settings)
- [ ] Firestore/localStorage persistence (settings survive browser refresh)
- [ ] Multi-user collaboration (settings sync correctly)

### User Experience

- [ ] Instant visual feedback (<16.67ms)
- [ ] Clear phase transitions (preview → completion is obvious)
- [ ] Intuitive settings organization (Γενικές/Ειδικές tabs)
- [ ] Consistent behavior across entity types (line, circle, rectangle, etc.)
- [ ] No unexpected behavior (settings apply as user expects)

---

## 🐛 TROUBLESHOOTING

### Problem: Preview settings not applying

**Symptoms:**
- Line is white instead of configured color
- Line is solid instead of dashed
- Opacity is 100% instead of configured value

**Debug Steps:**
1. Check console for errors
2. Verify `useEntityStyles('line', 'preview')` is called
3. Check `linePreviewStyles.settings` has correct values
4. Verify settings are applied in `updatePreview()` function
5. Check dependency array includes `linePreviewStyles.settings`

**Solution:**
- Verify [implementation.md](implementation.md) Change 2 and Change 3 are correct

---

### Problem: Completion settings not applying

**Symptoms:**
- Final line has preview appearance (dashed, semi-transparent)
- Settings don't persist after browser refresh

**Debug Steps:**
1. Check if completion settings are applied in `addPoint()` function
2. Verify `lineCompletionStyles` (NOT `linePreviewStyles`) is used
3. Check entity is added to scene AFTER settings are applied
4. Verify settings are saved to Firestore/localStorage

**Solution:**
- Verify [implementation.md](implementation.md) Change 4 is correct
- Check `lineCompletionStyles.settings` (not `linePreviewStyles.settings`)

---

### Problem: Settings don't update in real-time

**Symptoms:**
- Change settings in DxfSettingsPanel
- Preview doesn't update until next draw

**Debug Steps:**
1. Check dependency arrays include settings
2. Verify React re-renders when settings change
3. Check `useEntityStyles` hook is reactive

**Solution:**
- Verify [implementation.md](implementation.md) Change 5 (dependency arrays) is correct

---

### Problem: Grips or distance labels not showing

**Symptoms:**
- Preview line visible but no grips
- No distance label in middle of line

**Debug Steps:**
1. Check `showPreviewGrips` flag is set to `true`
2. Check `showEdgeDistances` flag is set to `true`
3. Verify `previewGripPoints` array is populated
4. Check grip renderer is active

**Solution:**
- This is NOT related to settings implementation
- Check [status-report.md](status-report.md) Component 7 (Preview Flags)

---

## ✅ ACCEPTANCE CRITERIA

### All Tests Must Pass

- [ ] Test 1: Preview Phase ✅
- [ ] Test 2: Completion Phase ✅
- [ ] Test 3: Γενικές Fallback ✅
- [ ] Test 4: Real-Time Updates ✅
- [ ] Test 5: Multi-Entity Consistency ✅

### All Enterprise Checklist Items

- [ ] ISO 9000 (6 items) ✅
- [ ] AutoCAD Compatibility (6 items) ✅
- [ ] Performance Standards (5 items) ✅
- [ ] Data Integrity (5 items) ✅
- [ ] User Experience (5 items) ✅

### TypeScript Compilation

```bash
npx tsc --noEmit --skipLibCheck
# Expected: 0 errors
```

### Runtime Testing

```bash
npm run dev
# Navigate to: http://localhost:3001/dxf/viewer
# Run all 5 test scenarios
# Expected: All pass
```

---

## 🔗 RELATED DOCUMENTATION

**If Tests Fail:**
- **[implementation.md](implementation.md)** - Review implementation steps
- **[status-report.md](status-report.md)** - Check component status
- **[root-cause.md](root-cause.md)** - Understand the problem

**Previous:**
- **[← implementation.md](implementation.md)** - Implementation guide

---

**Last Updated:** 2025-10-05
**Part of:** Line Drawing System Documentation
**Status:** Ready for implementation & testing
