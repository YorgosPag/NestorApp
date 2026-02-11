# Architecture Report: Manual + DXF-Auto Measurements

**Date:** 2026-02-11  
**Status:** Proposed (implementation-ready)  
**Scope:** Company -> Project -> Building -> Unit/Parking/Storage

## 1. Executive Decision

1. Manual measurements should be **owned at Building level**.
2. Each measurement item should support **scope = building or unit**.
3. Project level should expose a **read-only rollup** (sum of building BOQs), not primary entry.
4. Manual and future DXF-auto measurements must share **one domain model** (`source: manual | dxf_auto | dxf_verified`).
5. Gantt integration should be at **building phase/task link level** (`linkedPhaseId`, optional `linkedTaskId`).

## 2. What Exists Today (Repo Findings)

1. Building-level Gantt already exists and is implemented in building timeline.
Path: `src/components/building-management/tabs/TimelineTabContent.tsx`  
Path: `src/app/api/buildings/[buildingId]/construction-phases/route.ts`  
Doc: `docs/centralized-systems/reference/adrs/ADR-034-gantt-chart-construction-tracking.md`

2. A dedicated DXF subapp already exists and is technically deep (parser, rendering, overlays, hooks).
Path: `src/subapps/dxf-viewer/`

3. Current `src/types/measurements.ts` is CAD/ruler-oriented (distance/area/angle etc), not BOQ/costing-oriented.
Path: `src/types/measurements.ts`

4. Project tabs and building tabs are separate; building is the right operational level for schedule-driven execution.
Path: `src/config/project-tabs-config.ts`  
Path: `src/config/unified-tabs-factory.ts`

Inference: your current architecture already favors building-level execution workflows, so BOQ at building level is consistent and low-risk.

## 3. External Benchmark Findings (Internet)

1. **Autodesk Revit** supports material takeoff schedules and quantity/cost calculations from model data.
2. **Autodesk Navisworks Quantification** supports both model (automatic) and virtual/manual takeoff in one workbook and exports to Excel.
3. **Autodesk Takeoff** combines 2D + 3D quantities and supports formulas/snapshots for estimating workflows.
4. **buildingSMART IFC** defines standardized quantity sets (count/length/area/volume/weight/time), which is the interoperability baseline.
5. **RIB iTWO** positions BIM 5D as integrated model + time + cost workflows across project phases.
6. **Oracle Primavera Unifier** links cost sheets and schedule activities (cost-schedule coupling).
7. **Turner Construction** publicly describes VDC with 4D scheduling + 5D cost estimating in active delivery.
8. **Skanska** publicly describes BIM analytics that combine model, schedule, and cost for estimation and decision speed.

Inference: market direction is clear: quantity + schedule + cost must be connected, with manual and model-based takeoff coexisting.

## 4. Recommended Product Placement

## 4.1 Manual Measurements

Primary UI entry: **Building Detail -> new "Measurements" tab** (next to existing timeline/Gantt workflows).

## 4.2 Project-Level View

Add **Project Measurements Summary** only:
1. totals per building
2. totals per category
3. total material/labor/equipment
4. variance summary (estimated vs actual)

No direct heavy editing at project level.

## 4.3 DXF-Auto Placement

Keep automatic extraction inside **DXF Viewer domain as an extraction engine**, but persist to shared measurements domain:
1. DXF subapp handles geometry interpretation/classification.
2. Measurements domain owns BOQ records, costing, approvals, Gantt links.

This keeps DXF specialized, while BOQ remains system-wide.

## 5. Canonical Domain Model (Minimal)

```ts
type MeasurementSource = 'manual' | 'dxf_auto' | 'dxf_verified';
type MeasurementScope = 'building' | 'unit';
type MeasurementUnit = 'm2' | 'm3' | 'm' | 'pcs' | 'kg' | 'lt' | 'set' | 'day' | 'lump';

interface BoqItem {
  id: string;
  companyId: string;
  projectId: string;
  buildingId: string;
  scope: MeasurementScope;
  unitId: string | null;
  categoryCode: string;
  description: string;
  unitMeasure: MeasurementUnit;
  estimatedQuantity: number;
  actualQuantity: number | null;
  materialUnitCost: number;
  laborUnitCost: number;
  equipmentUnitCost: number;
  source: MeasurementSource;
  linkedPhaseId: string | null;
  linkedTaskId: string | null;
  status: 'draft' | 'confirmed' | 'completed';
  createdAt: string;
  updatedAt: string;
}
```

## 6. Materials vs Labor (Mandatory Split)

Each item must store separate cost vectors:
1. material
2. labor
3. equipment

Then compute:
1. estimated total
2. actual total (when actual quantity exists)
3. variance (% and absolute)

This is required for realistic contractor control and later cash-flow projection.

## 7. Gantt Integration Pattern

1. Keep Gantt as building-level schedule owner.
2. Link BOQ items to `construction_phases` and optionally `construction_tasks`.
3. Phase cost/time dashboards are computed from linked BOQ items.
4. If no link exists, item remains unplanned cost.

Result: practical 5D behavior without forcing full BIM complexity on day one.

## 8. Modular Architecture (Target)

1. `measurements-domain` (types, validations, cost engine, repository interfaces)
2. `measurements-manual-ui` (building tab CRUD, filters, templates)
3. `measurements-dxf-adapter` (DXF inference -> normalized BoqItem payloads)
4. `measurements-gantt-bridge` (phase/task linking and rollups)
5. `measurements-reporting` (project rollup, exports, variance)

Key rule: all modules write/read the same canonical contracts.

## 9. Phased Implementation

1. Phase A: Building tab + manual CRUD + summaries + project rollup (read-only)
2. Phase B: Gantt link UI + phase cost summary
3. Phase C: DXF auto extraction draft items (`source=dxf_auto`)
4. Phase D: verification workflow (`dxf_auto -> dxf_verified`) + governance/audit

## 10. Risks and Controls

1. Risk: duplicate models between DXF and BOQ.
Control: one canonical BoqItem contract.

2. Risk: wrong hierarchy (project-level editing chaos).
Control: building-level ownership + project rollup only.

3. Risk: schedule/cost disconnect.
Control: explicit phase/task foreign links.

4. Risk: auto-DXF trust issues.
Control: mandatory verification state and audit trail before finalization.

## 11. Final Recommendation

Implement manual measurements now at **building level** with optional per-unit scope, keep project level as aggregation, and treat DXF automation as a producer into the same BOQ domain model.  
This path aligns with your current codebase, with 5D industry practice, and with a modular future architecture.

## Sources

1. Autodesk Revit Material Takeoff: https://help.autodesk.com/cloudhelp/2023/ENU/Revit-DocumentPresent/files/GUID-F8270A42-CA71-46C7-B145-85EC2CB8E4A1.htm
2. Autodesk Revit takeoff video/doc (2026 help): https://help.autodesk.com/cloudhelp/2026/ENU/Revit-DocumentPresent/files/GUID-46FFC071-FC40-4A2F-8985-8BB783374628.htm
3. Autodesk Navisworks Quantification workbook: https://help.autodesk.com/cloudhelp/2022/ENU/Navisworks/files/GUID-F12FB764-A75E-48FE-BC2B-DB9DA6FC4CAA.htm
4. Autodesk Navisworks quantification workflow: https://help.autodesk.com/cloudhelp/2023/ENU/Navisworks-Quantification/files/GUID-95ED5D79-89B6-443D-83C7-61DEF40A13A8.htm
5. Autodesk Takeoff workflow/tooling: https://help.autodesk.com/cloudhelp/ENU/Takeoff-Files/files/File_Mgt_Tools.html
6. Autodesk construction takeoff overview: https://construction.autodesk.com/workflows/construction-takeoff/
7. buildingSMART IFC Quantity Sets concept: https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/concepts/Object_Definition/Quantity_Sets/content.html
8. buildingSMART IfcQuantitySet entity: https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/IfcQuantitySet.htm
9. RIB iTWO BIM 5D positioning: https://www.rib-software.com/de/rib-itwo
10. RIB BIM 5D/6D integration: https://www.rib-software.com/de/rib-itwo/ava-software/bim-ava-integration
11. Oracle Primavera Unifier cost-schedule integration context: https://www.oracle.com/construction-engineering/primavera-unifier-project-controls-asset-management/primavera-unifier-primavera-p6-eppm-tour/
12. Oracle Unifier cost sheet data model reference: https://docs.oracle.com/en/industries/construction-engineering/intelligence/subject-area-reference-guide/unifier-costsheet-primavera-costsheet.html
13. Turner VDC (4D + 5D on delivery): https://www.turnerconstruction.com/services/virtual-design-and-construction-bim
14. Skanska BIM analytics (model + cost + schedule): https://www.usa.skanska.com/what-we-deliver/services/innovation/bim-analytics/
15. Bentley SYNCHRO capabilities (4D + model-based QTO): https://www.bentley.com/software/synchro/
