# Architecture Visibility Map

## canvasUtilities.geoInteractive (ENGINE)

| Function | Used In | Domain | Status |
|--------|--------|--------|-------|
| viewport.padding | design-tokens.ts | GENERIC | Core engine |
| viewport.margin | design-tokens.ts | GENERIC | Core engine |
| positioning.center | design-tokens.ts | GENERIC | Core engine |
| positioning.topRight | design-tokens.ts | GENERIC | Core engine |
| mobileSlideHeader | MobileDetailsSlideIn.tsx | GENERIC | Live usage |
| mobileSlideContent | MobileDetailsSlideIn.tsx | GENERIC | Live usage |
| canvasFullDisplay | FloorplanViewerTab.tsx | CANVAS | Live usage |
| portalDropdownContainer | enterprise-contact-dropdown.tsx | UI | Live usage |
| dropdownScrollableResults | enterprise-contact-dropdown.tsx | UI | Live usage |
| floorPlanOverlay | GeoCanvasContent.tsx | GEO | Live usage |
| draggablePanelContainer | GeoCanvasContent.tsx, FloorPlanControlPointPicker.tsx | GEO | Live usage |
| draggablePanelHandle | FloorPlanControlPointPicker.tsx | GEO | Live usage |
| draggablePanelTabNavigation | FloorPlanControlPointPicker.tsx | GEO | Live usage |
| draggablePanelTabButton | FloorPlanControlPointPicker.tsx | GEO | Live usage |
| draggablePanelProgressBar | FloorPlanControlPointPicker.tsx | GEO | Live usage |
| fixedSidebarPanel | GeoCanvasContent.tsx | GEO | Live usage |
| pdfFallbackContainer | SafePDFLoader.tsx | PDF | Live usage |
| pdfDisplayWrapper | SafePDFLoader.tsx | PDF | Live usage |
| debugCrosshairPosition | CoordinateDebugOverlay.tsx | DEBUG | Live usage |
| controlPointInteraction | InteractiveMap.styles.ts | MAP | Candidate for adapter |
| accuracyCircle | InteractiveMap.styles.ts | MAP | Candidate for adapter |
| accuracyCircleWithZIndex | InteractiveMap.styles.ts | MAP | Candidate for adapter |
| accuracyZone | InteractiveMap.styles.ts | MAP | Candidate for adapter |
| accuracyZoneIcon | InteractiveMap.styles.ts | MAP | Candidate for adapter |
| pinMarker | InteractiveMap.styles.ts | MAP | Candidate for adapter |
| pinCenterDot | InteractiveMap.styles.ts | MAP | Candidate for adapter |
| dynamicPinMarker | InteractiveMap.styles.ts | MAP | Candidate for adapter |
| dynamicPinCenterDot | InteractiveMap.styles.ts | MAP | Candidate for adapter |
| drawingPoint | InteractiveMap.styles.ts | MAP | Candidate for adapter |
| radiusLabel | InteractiveMap.styles.ts | MAP | Candidate for adapter |
| previewRadiusLabel | InteractiveMap.styles.ts | MAP | Candidate for adapter |
| legendItem | InteractiveMap.styles.ts | MAP | Candidate for adapter |
| polygonVertex | InteractiveMap.styles.ts | MAP | Candidate for adapter |

---

## InteractiveMap.styles.ts (DOMAIN)

| Feature | Depends On Engine | Notes |
|-------|------------------|------|
| controlPoints.interaction | NO | Pure domain reimplementation |
| accuracy.circle | NO | Pure domain reimplementation |
| accuracy.zone | NO | Pure domain reimplementation |
| accuracy.zoneIcon | NO | Pure domain reimplementation |
| markers.pin | NO | Pure domain reimplementation |
| markers.centerDot | NO | Pure domain reimplementation |
| markers.dynamicPin | NO | Pure domain reimplementation |
| markers.dynamicCenterDot | NO | Pure domain reimplementation |
| markers.drawingPoint | NO | Pure domain reimplementation |
| labels.radiusLabel | NO | Pure domain reimplementation |
| labels.previewLabel | NO | Pure domain reimplementation |
| labels.legendItem | NO | Pure domain reimplementation |
| layout.mapContainer | YES | Uses mapInteractionTokens |
| layout.animationDelay | YES | Uses layoutUtilities |
| layout.polygonVertex | NO | Pure domain reimplementation |

## Summary

**ENGINE FUNCTIONS IN ACTIVE USE:**
- **GENERIC**: 4 functions (viewport, positioning) - Keep stable
- **LIVE USAGE**: 15 functions across 8 files - Keep stable
- **MAP CANDIDATES**: 14 functions - Ready for adapter pattern

**DOMAIN LAYER ANALYSIS:**
- **NO DEPENDENCIES**: 11 functions (pure reimplementation)
- **DESIGN TOKEN DEPS**: 2 functions (healthy dependency)
- **ADAPTATION READY**: All map functions have domain alternatives
