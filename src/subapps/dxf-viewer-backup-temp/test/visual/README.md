# 🎨 Visual Regression Testing για DXF Viewer

Comprehensive visual regression testing infrastructure με pixelmatch για enterprise-level quality assurance.

## 📁 Structure

```
test/visual/
├── README.md                 # Αυτό το αρχείο
├── overlayRenderer.ts        # Core rendering utilities για visual tests
└── baselines/               # Baseline images (auto-generated)
    ├── origin-markers-800x600.png
    ├── grid-overlay-1024x768.png
    └── ...

reports/visual/
├── *.actual.png             # Actual test results
├── *.diff.png              # Pixel-by-pixel difference images
└── visual-regression-report.json
```

## 🚀 Running Visual Tests

### Individual Test Types
```bash
# Run all visual regression tests
npm run test:visual

# Run specific visual test
npx jest visual-regression.test.ts

# Run all test types (unit, property-based, visual)
npm run test:all
```

### CI/CD Integration
```bash
# CI-friendly execution με artifacts
npm run test:ci

# Generate coverage + visual reports
npm run coverage
```

## 📊 Test Coverage

### Overlay Types Tested
- **Origin Markers**: Canvas (0,0) και coordinate system origins
- **Grid Overlays**: Regular και adaptive grid rendering
- **Crosshair**: Center alignment και visual consistency
- **Combined**: Multi-overlay rendering accuracy
- **Coordinate Transforms**: Transform matrix accuracy
- **Multi-Resolution**: Consistency across different screen sizes

### Test Scenarios
- Standard resolutions (800x600, 1024x768, 1920x1080)
- Mobile resolutions (320x240)
- Various zoom levels και pan positions
- Different overlay combinations
- Deterministic rendering με fixed seeds

## 🎯 Quality Gates

### Enterprise Thresholds
- **Mismatch Rate**: <0.01% (1 pixel per 10,000)
- **Max Mismatched Pixels**: <50 pixels total
- **Performance Budget**: <180s για visual test suite
- **Pixel Tolerance**: ±0.5 pixels για coordinate accuracy

### Baseline Management
- Baselines auto-generated on first run
- Manual baseline updates μόνο όταν χρειάζεται
- Version-controlled baseline images
- Automatic diff report generation

## 🔧 Configuration

### Jest Configuration
- **Timeout**: 180 seconds για image processing
- **Environment**: jsdom με enhanced canvas mocks
- **Reporters**: HTML reports + JUnit XML για CI
- **Projects**: Separated από unit tests για performance

### Visual Test Options
```typescript
interface VisualTestOptions {
  seed?: number;              // Deterministic random seed
  viewport?: Viewport;        // Canvas dimensions
  overlayType?: 'origin' | 'grid' | 'crosshair' | 'combined';
  gridEnabled?: boolean;
  crosshairEnabled?: boolean;
}
```

## 📈 Reporting

### Artifacts Generated
- **Baseline Images**: Reference images για comparison
- **Actual Images**: Current test results
- **Diff Images**: Pixel-level differences (magenta highlights)
- **JSON Reports**: Detailed test metrics και results

### Failure Analysis
Όταν visual test αποτυγχάνει:

1. **Check Diff Image**: Δες την `.diff.png` για pixel differences
2. **Review Actual**: Compare `.actual.png` με baseline
3. **Analyze Metrics**: Δες το JSON report για details
4. **Update Baseline**: Αν η αλλαγή είναι expected

### Example Failure Output
```
Expected mismatch rate to be < 0.0001
Received: 0.0025 (0.25% mismatch)
Mismatched pixels: 1200/480000
See: reports/visual/grid-overlay-1024x768.diff.png
```

## 🛠️ Development Workflow

### Adding New Visual Tests
1. Create test scenario στο `visual-regression.test.ts`
2. Use `renderOverlayToCanvas()` με appropriate options
3. Set expected quality thresholds
4. Run test to generate baseline
5. Commit baseline images

### Updating Baselines
```bash
# Delete existing baselines για regeneration
rm -rf test/baselines/*.png

# Run tests to regenerate
npm run test:visual

# Review και commit new baselines
git add test/baselines/
git commit -m "Update visual regression baselines"
```

### Custom Renderers
Για νέους overlay types:
```typescript
// test/visual/overlayRenderer.ts
export async function renderMyCustomOverlay(
  canvas: HTMLCanvasElement,
  opts: VisualTestOptions
): Promise<void> {
  const ctx = canvas.getContext('2d')!;
  // Implement deterministic rendering
}
```

## 🎲 Integration με Property-Based Testing

Visual regression tests μπορούν να συνδυαστούν με property-based testing:

```typescript
test('visual consistency across random transforms', () => {
  fc.assert(
    fc.property(
      fc.record({
        scale: fc.double({ min: 0.1, max: 5 }),
        offsetX: fc.double({ min: -200, max: 200 }),
        offsetY: fc.double({ min: -200, max: 200 })
      }),
      async (transform) => {
        const canvas = document.createElement('canvas');
        await renderCoordinateSystemTest(canvas, transform);

        // Visual consistency checks
        const buffer = canvasToPng(canvas);
        expect(buffer.length).toBeGreaterThan(0);
      }
    ),
    { numRuns: 50 }
  );
});
```

## 🔍 Debugging Visual Tests

### Common Issues
1. **Non-deterministic rendering**: Ensure fixed seeds και consistent state
2. **Platform differences**: Test στο same environment ως CI
3. **Timing issues**: Add proper waits για async rendering
4. **Memory leaks**: Cleanup canvas elements properly

### Debug Utilities
```typescript
import {
  createVisualTestCanvas,
  generateTestImageBuffer,
  validateVisualMatch
} from '../test/setupTests';

// Create debug canvas
const canvas = createVisualTestCanvas({
  width: 800,
  height: 600,
  testId: 'debug-overlay'
});

// Manual visual validation
const baseline = generateTestImageBuffer(800, 600);
const actual = canvasToPng(canvas);
const result = validateVisualMatch(baseline, actual);
console.log('Visual match result:', result);
```

## 📋 Best Practices

### Test Design
- **Deterministic**: Use fixed seeds για reproducible results
- **Isolated**: Each test should be independent
- **Comprehensive**: Cover edge cases και boundary conditions
- **Fast**: Optimize για CI performance

### Baseline Management
- **Version Control**: Always commit baseline images
- **Review Process**: Manual review για baseline updates
- **Documentation**: Document significant visual changes
- **Automation**: Automated baseline updates όπου είναι safe

### CI/CD Integration
- **Artifacts**: Upload visual reports ως CI artifacts
- **Notifications**: Alert team on visual regression failures
- **Parallel Execution**: Run visual tests in parallel με unit tests
- **Quality Gates**: Block merges on visual regression failures

---

**Enterprise Visual Testing** - Ensuring pixel-perfect consistency across all DXF Viewer overlay systems.