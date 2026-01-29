# 🧪 DXF EXPORT TEST STRATEGY

---

**📋 Document Type:** Enterprise Test Strategy
**🎯 Scope:** ezdxf Python Microservice & DXF Export Validation
**👤 Architect:** Γιώργος Παγωνής
**🤖 Developer:** Claude (Anthropic AI)
**📅 Created:** 2026-01-30
**📅 Last Updated:** 2026-01-30
**📊 Status:** APPROVED - Phase 0 Complete

---

## 📖 TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [Testing Philosophy](#2-testing-philosophy)
3. [Test Categories](#3-test-categories)
4. [Golden File Specification](#4-golden-file-specification)
5. [Round-Trip Testing](#5-round-trip-testing)
6. [CAD Compatibility Matrix](#6-cad-compatibility-matrix)
7. [Test Fixture Management](#7-test-fixture-management)
8. [Entity Coverage Matrix](#8-entity-coverage-matrix)
9. [Error Scenario Testing](#9-error-scenario-testing)
10. [Performance Benchmarks](#10-performance-benchmarks)
11. [CI/CD Integration](#11-cicd-integration)
12. [Test Data Security](#12-test-data-security)
13. [Acceptance Criteria](#13-acceptance-criteria)

---

## 1. EXECUTIVE SUMMARY

### 1.1 Purpose

This document defines the **enterprise-grade testing strategy** for the DXF Export functionality using the ezdxf Python microservice. It follows **SAP/Autodesk/Google testing practices** to ensure production-quality output.

### 1.2 Scope

| In Scope | Out of Scope |
|----------|--------------|
| ezdxf microservice unit tests | DXF import testing (existing) |
| Golden file comparison | UI/UX testing |
| Round-trip validation | Performance load testing (Phase 3) |
| CAD compatibility verification | Security penetration testing |
| API contract testing | Mobile testing |

### 1.3 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Unit Test Coverage** | ≥85% | pytest-cov |
| **Golden File Pass Rate** | 100% | CI/CD pipeline |
| **Round-Trip Fidelity** | ≥99.9% | Coordinate comparison |
| **CAD Compatibility** | 100% opens without error | Manual + automated |
| **Export Time (100 entities)** | <500ms | Performance benchmark |

---

## 2. TESTING PHILOSOPHY

### 2.1 Core Principles

**1. Output-Driven Testing (Autodesk Pattern)**
- Test the **DXF file output**, not internal implementation
- Golden files represent "known good" output
- Any deviation from golden = test failure

**2. CAD Industry Standards**
- DXF must open in AutoCAD without warnings
- Coordinate precision: 6 decimal places (CAD standard)
- Layer structure must be preserved exactly

**3. Deterministic Output**
- Same input → Same output (byte-for-byte where possible)
- Timestamps and UUIDs excluded from comparison
- No random elements in DXF generation

**4. Fail Fast, Fail Loud**
- Any golden file mismatch = blocking failure
- No silent degradation allowed
- Immediate notification on regression

### 2.2 Test Pyramid (DXF Export Specific)

```
                        ▲
                       / \
                      / CAD \              ← 3% (Manual: AutoCAD/BricsCAD)
                     / Compat \               ~5 tests
                    ───────────
                   /           \
                  / Round-Trip  \          ← 7% (Import→Export→Import)
                 /    Tests      \            ~10 tests
                ───────────────────
               /                   \
              /   Golden File       \       ← 20% (Output comparison)
             /      Tests            \         ~30 tests
            ───────────────────────────
           /                           \
          /      Unit Tests             \    ← 70% (Entity conversion)
         /                               \      ~100 tests
        ───────────────────────────────────
```

---

## 3. TEST CATEGORIES

### 3.1 Category Overview

| Category | Count | Priority | Automation | Blocking |
|----------|-------|----------|------------|----------|
| **Unit Tests** | 100+ | P0 | 100% | Yes |
| **Golden File Tests** | 30+ | P0 | 100% | Yes |
| **Round-Trip Tests** | 10+ | P1 | 100% | Yes |
| **Integration Tests** | 15+ | P1 | 100% | Yes |
| **CAD Compatibility** | 5+ | P1 | 50% | Yes |
| **Error Handling** | 20+ | P2 | 100% | No |
| **Performance** | 5+ | P3 | 100% | No |

### 3.2 Unit Test Scope

```python
# Example: Entity conversion unit tests

class TestLineEntityConversion:
    """Unit tests for LINE entity export."""

    def test_basic_line_export(self):
        """LINE entity converts to ezdxf LINE."""
        nestor_line = {
            "id": "line-001",
            "type": "line",
            "start": {"x": 0, "y": 0},
            "end": {"x": 100, "y": 50},
            "layer": "0",
            "color": "#FF0000"
        }

        dxf_line = convert_line_entity(nestor_line)

        assert dxf_line.dxftype() == "LINE"
        assert dxf_line.dxf.start == (0, 0, 0)
        assert dxf_line.dxf.end == (100, 50, 0)
        assert dxf_line.dxf.layer == "0"

    def test_line_with_lineweight(self):
        """LINE with lineweight preserves thickness."""
        # ...

    def test_line_negative_coordinates(self):
        """LINE handles negative coordinates correctly."""
        # ...
```

---

## 4. GOLDEN FILE SPECIFICATION

### 4.1 Golden File Architecture

```
tests/golden/
├── fixtures/                    # Input JSON (Nestor format)
│   ├── basic/
│   │   ├── simple-lines.json
│   │   ├── single-circle.json
│   │   └── basic-text.json
│   ├── intermediate/
│   │   ├── polyline-shapes.json
│   │   ├── multi-layer.json
│   │   └── mixed-entities.json
│   └── advanced/
│       ├── complex-floor-plan.json
│       ├── overlays-conversion.json
│       └── full-scene.json
│
├── baselines/                   # Expected DXF output (golden files)
│   ├── AC1015/                  # R2000 version
│   │   ├── simple-lines.dxf
│   │   ├── single-circle.dxf
│   │   └── ...
│   ├── AC1021/                  # R2007 version
│   │   └── ...
│   └── AC1032/                  # R2018 version
│       └── ...
│
└── generated/                   # Test run output (gitignored)
    └── ...
```

### 4.2 Golden File Fixtures

| Fixture ID | File | Entities | Purpose | Complexity |
|------------|------|----------|---------|------------|
| **GF-001** | `simple-lines.json` | 5 LINE | Basic line export | Low |
| **GF-002** | `single-circle.json` | 1 CIRCLE | Circle center/radius | Low |
| **GF-003** | `basic-text.json` | 3 TEXT | Text position/content | Low |
| **GF-004** | `polyline-open.json` | 1 LWPOLYLINE (open) | Open polyline vertices | Medium |
| **GF-005** | `polyline-closed.json` | 1 LWPOLYLINE (closed) | Closed polyline flag | Medium |
| **GF-006** | `arc-entity.json` | 2 ARC | Start/end angles | Medium |
| **GF-007** | `ellipse-entity.json` | 1 ELLIPSE | Major/minor axis, ratio | Medium |
| **GF-008** | `mtext-multiline.json` | 1 MTEXT | Multiline text, width | Medium |
| **GF-009** | `spline-cubic.json` | 1 SPLINE | Control points, degree | High |
| **GF-010** | `multi-layer.json` | 10 mixed | 5 layers, visibility | High |
| **GF-011** | `greek-text.json` | 5 TEXT | Ελληνικά χαρακτήρες (UTF-8) | Medium |
| **GF-012** | `rectangle-to-poly.json` | 3 RECT | Rectangle → LWPOLYLINE | Medium |
| **GF-013** | `hatch-solid.json` | 1 HATCH | Solid fill boundary | High |
| **GF-014** | `dimension-linear.json` | 1 DIMENSION | Linear dimension | High |
| **GF-015** | `complex-floor-plan.json` | 50+ mixed | Real-world scenario | High |
| **GF-016** | `overlay-polygons.json` | 10 overlays | Overlay → DXF conversion | Medium |
| **GF-017** | `all-colors.json` | 7 LINE | ACI color mapping | Low |
| **GF-018** | `all-linetypes.json` | 4 LINE | Solid, dashed, dotted, dashdot | Medium |
| **GF-019** | `precision-test.json` | 1 LINE | 6-decimal coordinate precision | Low |
| **GF-020** | `large-coordinates.json` | 5 mixed | Coordinates >100,000 units | Medium |

### 4.3 Golden File Comparison Algorithm

```python
# services/dxf-export/tests/conftest.py

import ezdxf
from dataclasses import dataclass
from typing import List, Tuple

@dataclass
class ComparisonResult:
    """Result of golden file comparison."""
    passed: bool
    entity_count_match: bool
    entity_types_match: bool
    coordinates_match: bool
    layers_match: bool
    colors_match: bool
    differences: List[str]

def compare_dxf_structural(
    generated_path: str,
    golden_path: str,
    coordinate_tolerance: float = 0.000001  # 6 decimal places
) -> ComparisonResult:
    """
    Structural comparison of DXF files.

    Strategy: Parse both files, compare entity-by-entity.
    Ignores: timestamps, software version, handle values.
    """
    gen_doc = ezdxf.readfile(generated_path)
    gold_doc = ezdxf.readfile(golden_path)

    gen_msp = list(gen_doc.modelspace())
    gold_msp = list(gold_doc.modelspace())

    differences = []

    # 1. Entity count
    entity_count_match = len(gen_msp) == len(gold_msp)
    if not entity_count_match:
        differences.append(
            f"Entity count: generated={len(gen_msp)}, golden={len(gold_msp)}"
        )

    # 2. Entity types (sorted)
    gen_types = sorted([e.dxftype() for e in gen_msp])
    gold_types = sorted([e.dxftype() for e in gold_msp])
    entity_types_match = gen_types == gold_types
    if not entity_types_match:
        differences.append(f"Entity types differ: {gen_types} vs {gold_types}")

    # 3. Coordinate comparison
    coordinates_match = True
    for gen_e, gold_e in zip(
        sorted(gen_msp, key=entity_sort_key),
        sorted(gold_msp, key=entity_sort_key)
    ):
        if not compare_entity_coordinates(gen_e, gold_e, coordinate_tolerance):
            coordinates_match = False
            differences.append(
                f"Coordinate mismatch: {gen_e.dxftype()} at {get_entity_location(gen_e)}"
            )

    # 4. Layer comparison
    gen_layers = set(gen_doc.layers.entries.keys())
    gold_layers = set(gold_doc.layers.entries.keys())
    layers_match = gen_layers == gold_layers
    if not layers_match:
        differences.append(f"Layers differ: {gen_layers} vs {gold_layers}")

    # 5. Color comparison
    colors_match = compare_entity_colors(gen_msp, gold_msp)

    passed = all([
        entity_count_match,
        entity_types_match,
        coordinates_match,
        layers_match,
        colors_match
    ])

    return ComparisonResult(
        passed=passed,
        entity_count_match=entity_count_match,
        entity_types_match=entity_types_match,
        coordinates_match=coordinates_match,
        layers_match=layers_match,
        colors_match=colors_match,
        differences=differences
    )


def entity_sort_key(entity) -> Tuple:
    """Sort key for deterministic entity ordering."""
    dxftype = entity.dxftype()
    layer = entity.dxf.layer if hasattr(entity.dxf, 'layer') else ''

    # Get representative coordinate for sorting
    if dxftype == 'LINE':
        coord = (entity.dxf.start.x, entity.dxf.start.y)
    elif dxftype == 'CIRCLE':
        coord = (entity.dxf.center.x, entity.dxf.center.y)
    elif dxftype in ('TEXT', 'MTEXT'):
        coord = (entity.dxf.insert.x, entity.dxf.insert.y)
    else:
        coord = (0, 0)

    return (dxftype, layer, coord[0], coord[1])
```

### 4.4 Golden File Test Execution

```python
# tests/golden/test_golden_files.py

import pytest
from pathlib import Path
from conftest import compare_dxf_structural

FIXTURES_DIR = Path(__file__).parent / "fixtures"
BASELINES_DIR = Path(__file__).parent / "baselines"
GENERATED_DIR = Path(__file__).parent / "generated"

# DXF versions to test
DXF_VERSIONS = ["AC1015", "AC1021", "AC1032"]

# All golden file fixtures
GOLDEN_FIXTURES = [
    "simple-lines",
    "single-circle",
    "basic-text",
    "polyline-open",
    "polyline-closed",
    "arc-entity",
    "ellipse-entity",
    "mtext-multiline",
    "spline-cubic",
    "multi-layer",
    "greek-text",
    "rectangle-to-poly",
    "hatch-solid",
    "dimension-linear",
    "complex-floor-plan",
    "overlay-polygons",
    "all-colors",
    "all-linetypes",
    "precision-test",
    "large-coordinates",
]


class TestGoldenFiles:
    """Golden file comparison tests."""

    @pytest.mark.parametrize("fixture_name", GOLDEN_FIXTURES)
    @pytest.mark.parametrize("dxf_version", DXF_VERSIONS)
    def test_golden_file(self, fixture_name: str, dxf_version: str, export_service):
        """
        Golden file test: export fixture and compare to baseline.

        Test ID: GF-{fixture_index:03d}-{version}
        """
        # 1. Load input fixture
        fixture_path = FIXTURES_DIR / f"{fixture_name}.json"
        assert fixture_path.exists(), f"Fixture not found: {fixture_path}"

        with open(fixture_path) as f:
            scene_data = json.load(f)

        # 2. Export to DXF
        generated_path = GENERATED_DIR / dxf_version / f"{fixture_name}.dxf"
        generated_path.parent.mkdir(parents=True, exist_ok=True)

        result = export_service.export(
            scene=scene_data,
            version=dxf_version,
            output_path=str(generated_path)
        )

        assert result.success, f"Export failed: {result.error}"

        # 3. Compare to golden baseline
        baseline_path = BASELINES_DIR / dxf_version / f"{fixture_name}.dxf"
        assert baseline_path.exists(), f"Baseline not found: {baseline_path}"

        comparison = compare_dxf_structural(
            generated_path=str(generated_path),
            golden_path=str(baseline_path)
        )

        # 4. Assert match
        assert comparison.passed, (
            f"Golden file mismatch for {fixture_name} ({dxf_version}):\n"
            + "\n".join(comparison.differences)
        )

    @pytest.mark.parametrize("fixture_name", GOLDEN_FIXTURES)
    def test_default_version_golden(self, fixture_name: str, export_service):
        """Test with default DXF version (AC1015 - R2000)."""
        self.test_golden_file(fixture_name, "AC1015", export_service)
```

### 4.5 Golden File Update Policy

| Scenario | Action | Approval Required |
|----------|--------|-------------------|
| **Bug fix improves output** | Update golden with `--update-golden` | Code review |
| **New entity type added** | Add new golden file | Code review |
| **Intentional format change** | Update affected golden files | Architecture review |
| **Accidental regression** | Fix code, NOT golden | Mandatory |
| **DXF version upgrade** | Add new version baseline | Architecture review |

**Command to update golden files:**

```bash
# Update all golden files (REQUIRES REVIEW)
pytest tests/golden/ --update-golden

# Update specific fixture
pytest tests/golden/ -k "simple-lines" --update-golden

# Dry-run (show what would change)
pytest tests/golden/ --update-golden --dry-run
```

---

## 5. ROUND-TRIP TESTING

### 5.1 Round-Trip Concept

```
┌─────────────┐     Export      ┌─────────────┐     Import      ┌─────────────┐
│   Nestor    │ ──────────────► │  DXF File   │ ──────────────► │   Nestor    │
│   Scene A   │                 │  (ezdxf)    │                 │   Scene B   │
└─────────────┘                 └─────────────┘                 └─────────────┘
       │                                                               │
       │                        Comparison                             │
       └───────────────────────── A ≈ B ──────────────────────────────┘
                              (within tolerance)
```

### 5.2 Round-Trip Test Cases

| Test ID | Fixture | Tolerance | Validation |
|---------|---------|-----------|------------|
| **RT-001** | simple-lines.json | 0.001 | All coordinates match |
| **RT-002** | polyline-shapes.json | 0.001 | Vertex count + positions |
| **RT-003** | circles-arcs.json | 0.001 | Center + radius match |
| **RT-004** | text-labels.json | exact | Text content preserved |
| **RT-005** | multi-layer.json | 0.001 | Layer names + assignments |
| **RT-006** | greek-text.json | exact | UTF-8 encoding preserved |
| **RT-007** | complex-floor-plan.json | 0.001 | Entity count + types |
| **RT-008** | all-colors.json | exact | ACI colors match |
| **RT-009** | precision-test.json | 0.000001 | 6-decimal precision |
| **RT-010** | spline-cubic.json | 0.01 | Control points (relaxed) |

### 5.3 Round-Trip Implementation

```python
# tests/round_trip/test_round_trip.py

class TestRoundTrip:
    """Round-trip validation: Export → Import → Compare."""

    @pytest.mark.parametrize("fixture_name,tolerance", [
        ("simple-lines", 0.001),
        ("polyline-shapes", 0.001),
        ("circles-arcs", 0.001),
        ("multi-layer", 0.001),
        ("complex-floor-plan", 0.001),
    ])
    def test_coordinate_round_trip(
        self,
        fixture_name: str,
        tolerance: float,
        export_service,
        import_service
    ):
        """Coordinates survive export/import cycle."""
        # 1. Load original scene
        original = load_fixture(fixture_name)

        # 2. Export to DXF
        dxf_path = export_to_temp(export_service, original)

        # 3. Import back
        reimported = import_service.import_dxf(dxf_path)

        # 4. Compare entities
        assert len(reimported.entities) == len(original.entities), \
            f"Entity count mismatch: {len(reimported.entities)} vs {len(original.entities)}"

        for orig_e, reimp_e in zip(
            sorted(original.entities, key=entity_key),
            sorted(reimported.entities, key=entity_key)
        ):
            assert compare_entity_coordinates(orig_e, reimp_e, tolerance), \
                f"Coordinate drift detected in {orig_e['type']}"

    def test_text_content_round_trip(self, export_service, import_service):
        """Text content preserved exactly."""
        original = load_fixture("greek-text")

        dxf_path = export_to_temp(export_service, original)
        reimported = import_service.import_dxf(dxf_path)

        orig_texts = [e['text'] for e in original.entities if e['type'] in ('text', 'mtext')]
        reimp_texts = [e['text'] for e in reimported.entities if e['type'] in ('text', 'mtext')]

        assert orig_texts == reimp_texts, "Text content changed during round-trip"

    def test_layer_assignment_round_trip(self, export_service, import_service):
        """Layer assignments preserved."""
        original = load_fixture("multi-layer")

        dxf_path = export_to_temp(export_service, original)
        reimported = import_service.import_dxf(dxf_path)

        orig_layers = {e['id']: e.get('layer', '0') for e in original.entities}
        reimp_layers = {e['id']: e.get('layer', '0') for e in reimported.entities}

        # Note: IDs may change, so compare by position
        assert sorted(orig_layers.values()) == sorted(reimp_layers.values())
```

---

## 6. CAD COMPATIBILITY MATRIX

### 6.1 Target CAD Applications

| Application | Versions | Priority | Test Method |
|-------------|----------|----------|-------------|
| **AutoCAD** | 2018, 2021, 2024, 2025 | P0 | Automated (ODA) + Manual |
| **BricsCAD** | V23, V24 | P1 | Manual |
| **LibreCAD** | 2.2.0+ | P2 | Automated |
| **DraftSight** | 2024 | P3 | Manual |
| **QCAD** | 3.x | P3 | Manual |
| **FreeCAD** | 0.21+ | P3 | Manual |

### 6.2 Compatibility Test Matrix

| DXF Version | AutoCAD 2018 | AutoCAD 2024 | BricsCAD V24 | LibreCAD |
|-------------|--------------|--------------|--------------|----------|
| AC1009 (R12) | ✅ Required | ✅ Required | ✅ Required | ✅ Required |
| AC1015 (R2000) | ✅ Required | ✅ Required | ✅ Required | ✅ Required |
| AC1021 (R2007) | ✅ Required | ✅ Required | ✅ Required | ⚠️ Partial |
| AC1032 (R2018) | ⚠️ N/A | ✅ Required | ✅ Required | ❌ Skip |

### 6.3 Compatibility Test Checklist

For each golden file and target CAD application:

- [ ] **Opens without error** - No crash, no error dialog
- [ ] **Opens without warning** - No "repair" or "audit" needed
- [ ] **Entity count correct** - All entities visible
- [ ] **Layer structure intact** - Layers panel shows all layers
- [ ] **Colors correct** - Visual inspection matches expected
- [ ] **Text readable** - Greek characters display correctly
- [ ] **Dimensions accurate** - DIST command validates coordinates

### 6.4 Automated Compatibility Check (ODA SDK)

```python
# Future: ODA Viewer SDK for automated verification
# NOTE: Requires ODA membership license

def verify_with_oda(dxf_path: str) -> CompatibilityResult:
    """
    Automated compatibility check using ODA Viewer SDK.

    Returns: CompatibilityResult with:
    - opens: bool (file can be opened)
    - warnings: List[str] (any warnings)
    - entity_count: int (entities recognized)
    - audit_issues: List[str] (audit findings)
    """
    # ODA SDK integration (future implementation)
    pass
```

---

## 7. TEST FIXTURE MANAGEMENT

### 7.1 Fixture Versioning

```
tests/golden/fixtures/
├── v1/                          # Initial release
│   ├── simple-lines.json
│   └── ...
├── v2/                          # After entity type changes
│   ├── simple-lines.json        # May have new properties
│   └── ...
└── current -> v2                # Symlink to active version
```

### 7.2 Fixture Schema

```typescript
// Fixture JSON schema (matches dxf-export.types.ts)

interface TestFixture {
  /** Fixture metadata */
  _meta: {
    version: string;         // Fixture schema version
    created: string;         // ISO date
    description: string;     // What this tests
    expectedEntities: number;
    expectedLayers: string[];
  };

  /** Scene data (Nestor format) */
  scene: {
    entities: Entity[];
    layers: Record<string, SceneLayer>;
    bounds: SceneBounds;
    units: 'mm' | 'cm' | 'm';
  };

  /** Export settings override */
  settings?: Partial<DxfExportSettings>;
}
```

### 7.3 Fixture Example

```json
{
  "_meta": {
    "version": "1.0",
    "created": "2026-01-30",
    "description": "Basic LINE entity export validation",
    "expectedEntities": 5,
    "expectedLayers": ["0", "WALLS", "DIMENSIONS"]
  },
  "scene": {
    "entities": [
      {
        "id": "line-001",
        "type": "line",
        "start": { "x": 0, "y": 0 },
        "end": { "x": 100, "y": 0 },
        "layer": "0",
        "color": "#FF0000"
      },
      {
        "id": "line-002",
        "type": "line",
        "start": { "x": 0, "y": 0 },
        "end": { "x": 0, "y": 100 },
        "layer": "WALLS",
        "color": "#00FF00"
      }
    ],
    "layers": {
      "0": { "name": "0", "color": "#FFFFFF", "visible": true, "locked": false },
      "WALLS": { "name": "WALLS", "color": "#00FF00", "visible": true, "locked": false }
    },
    "bounds": {
      "min": { "x": 0, "y": 0 },
      "max": { "x": 100, "y": 100 }
    },
    "units": "mm"
  }
}
```

### 7.4 Fixture Generation Tool

```bash
# Generate fixture from existing DXF
python scripts/generate_fixture.py input.dxf --output fixtures/new-test.json

# Validate fixture schema
python scripts/validate_fixture.py fixtures/new-test.json

# Generate baseline DXF from fixture
python scripts/generate_baseline.py fixtures/new-test.json --versions AC1015,AC1021
```

---

## 8. ENTITY COVERAGE MATRIX

### 8.1 Entity Type Test Coverage

| Entity Type | Unit Tests | Golden Files | Round-Trip | Status |
|-------------|------------|--------------|------------|--------|
| LINE | ✅ 10+ | ✅ GF-001, GF-015 | ✅ RT-001 | Ready |
| LWPOLYLINE (open) | ✅ 5+ | ✅ GF-004 | ✅ RT-002 | Ready |
| LWPOLYLINE (closed) | ✅ 5+ | ✅ GF-005, GF-012 | ✅ RT-002 | Ready |
| CIRCLE | ✅ 5+ | ✅ GF-002, GF-006 | ✅ RT-003 | Ready |
| ARC | ✅ 5+ | ✅ GF-006 | ✅ RT-003 | Ready |
| ELLIPSE | ✅ 5+ | ✅ GF-007 | ✅ RT-003 | Ready |
| TEXT | ✅ 5+ | ✅ GF-003, GF-011 | ✅ RT-004 | Ready |
| MTEXT | ✅ 5+ | ✅ GF-008 | ✅ RT-004 | Ready |
| SPLINE | ✅ 5+ | ✅ GF-009 | ✅ RT-010 | Ready |
| POINT | ✅ 3+ | ✅ GF-015 | ✅ RT-007 | Ready |
| HATCH | ✅ 5+ | ✅ GF-013 | ⏳ Planned | Phase 2 |
| DIMENSION | ✅ 5+ | ✅ GF-014 | ⏳ Planned | Phase 2 |
| INSERT (block) | ⏳ Planned | ⏳ Planned | ⏳ Planned | Phase 3 |
| LEADER | ⏳ Planned | ⏳ Planned | ⏳ Planned | Phase 3 |

### 8.2 Edge Case Coverage

| Edge Case | Test | Fixture |
|-----------|------|---------|
| Zero-length line | Unit | N/A (validation) |
| Negative coordinates | Unit + Golden | GF-020 |
| Very large coordinates | Unit + Golden | GF-020 |
| Empty layer name | Unit | N/A (defaults to "0") |
| Unicode text (Greek) | Unit + Golden | GF-011 |
| Special characters in text | Unit | N/A |
| Self-intersecting polyline | Unit + Golden | GF-015 |
| Degenerate circle (r=0) | Unit | N/A (validation) |

---

## 9. ERROR SCENARIO TESTING

### 9.1 Error Categories

| Category | Code Range | Examples |
|----------|------------|----------|
| **Validation Errors** | INVALID_* | Invalid scene, invalid settings |
| **Conversion Errors** | UNSUPPORTED_*, *_FAILED | Unsupported entity, conversion failed |
| **Version Errors** | VERSION_* | Version incompatible |
| **Service Errors** | MICROSERVICE_* | Unavailable, timeout |

### 9.2 Error Test Cases

```python
# tests/errors/test_error_handling.py

class TestErrorHandling:
    """Error scenario tests."""

    def test_invalid_scene_empty(self, export_service):
        """Empty scene returns INVALID_SCENE error."""
        result = export_service.export(scene={"entities": []})

        assert result.status == "error"
        assert result.error.code == "INVALID_SCENE"

    def test_invalid_entity_missing_coordinates(self, export_service):
        """Entity without required coordinates fails."""
        scene = {
            "entities": [
                {"id": "bad-line", "type": "line"}  # Missing start/end
            ]
        }

        result = export_service.export(scene=scene)

        assert result.status == "error"
        assert result.error.code == "INVALID_ENTITY"

    def test_unsupported_entity_type(self, export_service):
        """Unknown entity type reports as skipped."""
        scene = {
            "entities": [
                {"id": "e1", "type": "line", "start": {"x": 0, "y": 0}, "end": {"x": 10, "y": 10}},
                {"id": "e2", "type": "unknown_type", "data": {}}
            ]
        }

        result = export_service.export(scene=scene)

        assert result.status == "partial"  # Partial success
        assert result.stats.skippedEntities == 1
        assert result.stats.exportedEntities == 1

    def test_version_incompatible_spline_in_r12(self, export_service):
        """SPLINE in R12 triggers version warning."""
        scene = {
            "entities": [
                {
                    "id": "spline-1",
                    "type": "spline",
                    "controlPoints": [{"x": 0, "y": 0}, {"x": 50, "y": 50}, {"x": 100, "y": 0}]
                }
            ]
        }

        result = export_service.export(scene=scene, version="AC1009")  # R12

        # Spline should be converted to polyline with warning
        assert result.status == "success"
        assert "VERSION_INCOMPATIBLE" in [w.code for w in result.warnings]
```

---

## 10. PERFORMANCE BENCHMARKS

### 10.1 Performance Targets

| Scenario | Entity Count | Target Time | Max Memory |
|----------|--------------|-------------|------------|
| Small scene | 10 | <100ms | <50MB |
| Medium scene | 100 | <500ms | <100MB |
| Large scene | 1,000 | <2s | <500MB |
| Very large scene | 10,000 | <20s | <2GB |

### 10.2 Performance Test Implementation

```python
# tests/performance/test_performance.py

import pytest
import time
import tracemalloc

class TestPerformance:
    """Performance benchmark tests."""

    @pytest.mark.benchmark
    @pytest.mark.parametrize("entity_count,max_time_ms", [
        (10, 100),
        (100, 500),
        (1000, 2000),
    ])
    def test_export_time(self, entity_count: int, max_time_ms: int, export_service):
        """Export completes within time budget."""
        scene = generate_scene_with_entities(entity_count)

        start = time.perf_counter()
        result = export_service.export(scene=scene)
        elapsed_ms = (time.perf_counter() - start) * 1000

        assert result.success
        assert elapsed_ms < max_time_ms, \
            f"Export took {elapsed_ms:.0f}ms, budget was {max_time_ms}ms"

    @pytest.mark.benchmark
    def test_memory_usage(self, export_service):
        """Memory usage within limits for large scene."""
        scene = generate_scene_with_entities(1000)

        tracemalloc.start()
        result = export_service.export(scene=scene)
        current, peak = tracemalloc.get_traced_memory()
        tracemalloc.stop()

        assert result.success
        assert peak < 500 * 1024 * 1024, f"Peak memory {peak/1024/1024:.0f}MB exceeds 500MB limit"
```

---

## 11. CI/CD INTEGRATION

### 11.1 Pipeline Overview

```yaml
# .github/workflows/dxf-export-tests.yml

name: DXF Export Tests

on:
  push:
    paths:
      - 'services/dxf-export/**'
      - 'src/subapps/dxf-viewer/types/dxf-export.types.ts'
      - 'tests/golden/**'
  pull_request:
    paths:
      - 'services/dxf-export/**'

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          cd services/dxf-export
          pip install -r requirements.txt
          pip install -r requirements-dev.txt

      - name: Run unit tests with coverage
        run: |
          cd services/dxf-export
          pytest tests/unit/ -v --cov=src --cov-report=xml

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          file: services/dxf-export/coverage.xml

  golden-file-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    steps:
      - uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          cd services/dxf-export
          pip install -r requirements.txt

      - name: Run golden file tests
        run: |
          cd services/dxf-export
          pytest tests/golden/ -v

      - name: Upload failure artifacts
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: golden-file-diffs
          path: services/dxf-export/tests/golden/generated/

  round-trip-tests:
    runs-on: ubuntu-latest
    needs: golden-file-tests
    steps:
      - uses: actions/checkout@v4

      - name: Run round-trip tests
        run: |
          cd services/dxf-export
          pytest tests/round_trip/ -v

  cad-compatibility:
    runs-on: ubuntu-latest
    needs: round-trip-tests
    steps:
      - name: LibreCAD compatibility check
        run: |
          # Install LibreCAD
          sudo apt-get install -y librecad

          # Verify each generated DXF opens
          for dxf in tests/golden/generated/AC1015/*.dxf; do
            librecad --check "$dxf" || exit 1
          done
```

### 11.2 Quality Gates

| Gate | Check | Blocking |
|------|-------|----------|
| **Unit Tests** | All pass, ≥85% coverage | Yes |
| **Golden Files** | 100% match | Yes |
| **Round-Trip** | 100% pass | Yes |
| **TypeScript** | Zero errors | Yes |
| **Lint** | Zero errors | Yes |
| **Build** | Success | Yes |

---

## 12. TEST DATA SECURITY

### 12.1 Data Classification

| Category | Example | Handling |
|----------|---------|----------|
| **Synthetic** | simple-lines.json | Git committed |
| **Anonymized** | floor-plan-anon.json | Git committed |
| **Real (sanitized)** | client-project-sanitized.json | Private repo only |
| **Real (confidential)** | client-original.dxf | NEVER in Git |

### 12.2 PII/Sensitive Data Rules

- [ ] **NO real customer data** in test fixtures
- [ ] **NO real addresses** (use synthetic addresses)
- [ ] **NO real names** in text entities
- [ ] **Sanitize** any derived fixtures from real projects
- [ ] **Greek text** uses lorem ipsum or generic labels

---

## 13. ACCEPTANCE CRITERIA

### 13.1 Phase 0 (Current) - Test Infrastructure

- [x] Test strategy document created
- [x] Golden file specification defined
- [x] CAD compatibility matrix documented
- [x] CI/CD integration planned
- [ ] First 5 fixture files created (GF-001 to GF-005)

### 13.2 Phase 1 - Basic Testing

- [ ] Unit tests for LINE, CIRCLE, ARC, TEXT (40+ tests)
- [ ] Golden files for basic entities (GF-001 to GF-010)
- [ ] Round-trip tests for coordinates (RT-001 to RT-005)
- [ ] CI/CD pipeline operational

### 13.3 Phase 2 - Complete Coverage

- [ ] Unit tests for all 14 entity types (100+ tests)
- [ ] Golden files complete (GF-001 to GF-020)
- [ ] Round-trip tests complete (RT-001 to RT-010)
- [ ] CAD compatibility verified (AutoCAD, BricsCAD)

### 13.4 Phase 3 - Production Ready

- [ ] Performance benchmarks passing
- [ ] Error handling tests complete
- [ ] 85% code coverage achieved
- [ ] Zero blocking issues in CI/CD

---

## REVISION HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-30 | Claude (Anthropic AI) | Initial test strategy document |

---

**END OF DXF EXPORT TEST STRATEGY**
