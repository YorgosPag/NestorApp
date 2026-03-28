/**
 * Text Entity Renderer
 * Handles rendering of text and mtext entities
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  ⚠️  ΠΡΟΣΟΧΗ - ΜΗΝ ΑΛΛΑΞΕΤΕ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ! ⚠️                          ║
 * ║                                                                          ║
 * ║  Αυτός ο κώδικας ΛΕΙΤΟΥΡΓΕΙ ΣΩΣΤΑ μετά από πολλές δοκιμές.              ║
 * ║                                                                          ║
 * ║  ✅ VERIFIED WORKING: 2026-01-03                                         ║
 * ║  ✅ Τα κείμενα κλιμακώνονται με το zoom (screenHeight = height × scale) ║
 * ║  ✅ Τα κείμενα διαστάσεων ακολουθούν τη σωστή κατεύθυνση (rotation)     ║
 * ║                                                                          ║
 * ║  ΚΡΙΣΙΜΟ: Η απλή προσέγγιση (height × scale) είναι η ΣΩΣΤΗ!             ║
 * ║  ΜΗΝ προσθέσετε:                                                         ║
 * ║  - SCALE_BOOST_FACTOR                                                    ║
 * ║  - MIN/MAX clamping (κάνει τα κείμενα σταθερά!)                         ║
 * ║  - Annotation scaling                                                    ║
 * ║                                                                          ║
 * ║  📐 ROTATION FIX (2026-01-03):                                           ║
 * ║  Το rotation για dimension text λειτουργεί ΣΩΣΤΑ!                        ║
 * ║  - DXF: Counter-clockwise (CCW), 0° = +X                                 ║
 * ║  - Canvas: Clockwise (CW) με Y-flip                                      ║
 * ║  - Λύση: Αντιστροφή γωνίας (-rotation) λόγω Y-flip                      ║
 * ║  ΜΗΝ ΑΛΛΑΞΕΤΕ τον υπολογισμό rotation!                                  ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { BaseEntityRenderer } from './BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions } from '../types/Types';
import type { Point2D } from '../types/Types';
import type { Entity } from '../../types/entities';
// 🏢 ADR-102: Centralized Entity Type Guards
import { isTextEntity, isMTextEntity } from '../../types/entities';
import { UI_COLORS } from '../../config/color-config';
// 🏢 ADR-067: Centralized Radians/Degrees Conversion
import { degToRad } from './shared/geometry-utils';
// 🏢 ADR-091: Centralized UI Fonts (buildUIFont for dynamic sizes)
// 🏢 ADR-107: Centralized Text Metrics Ratios
import { buildUIFont, TEXT_METRICS_RATIOS } from '../../config/text-rendering-config';
// 🏢 ADR-105: Centralized Hit Test Fallback Tolerance
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';


export class TextRenderer extends BaseEntityRenderer {
  /**
   * Text Rendering - Simplified approach from working backup
   *
   * Uses direct height × scale calculation for proper text sizing
   */
  render(entity: EntityModel, options: RenderOptions = {}): void {
    // 🏢 ADR-102: Use centralized type guards
    const e = entity as Entity;
    if (!isTextEntity(e) && !isMTextEntity(e)) return;

    // Type guards for safe property access
    if (!('position' in entity) || !('text' in entity)) return;
    const position = entity.position as Point2D;
    const text = entity.text as string;

    // ✅ SIMPLIFIED: Extract height with fallback to 12 (like old backup)
    const height = this.extractTextHeight(entity);
    const rotation = ('rotation' in entity) ? entity.rotation as number : 0;

    if (!position || !text) return;

    // Setup style
    this.setupStyle(entity, options);

    // ╔════════════════════════════════════════════════════════════════════════╗
    // ║ ✅ ZOOM-RESPONSIVE TEXT (2026-01-03)                                   ║
    // ║ Τα κείμενα κλιμακώνονται με το zoom όπως όλες οι άλλες οντότητες.     ║
    // ║ Χρησιμοποιεί: screenHeight = worldHeight × scale                       ║
    // ║ Έτσι τα κείμενα διαστάσεων ακολουθούν τις γραμμές τους.               ║
    // ╚════════════════════════════════════════════════════════════════════════╝
    const screenPos = this.worldToScreen(position);
    const screenHeight = height * this.transform.scale;

    this.ctx.save();

    // ✅ SIMPLIFIED: Direct font setting
    this.ctx.font = buildUIFont(screenHeight, 'arial');
    this.ctx.fillStyle = ('color' in entity ? entity.color : undefined) || UI_COLORS.DEFAULT_ENTITY;
    this.ctx.textAlign = 'left';
    // ╔════════════════════════════════════════════════════════════════════════╗
    // ║ 🔧 DXF BASELINE FIX (2026-01-03)                                       ║
    // ║                                                                        ║
    // ║ DXF: insertion point = baseline (κάτω από τα γράμματα)                ║
    // ║ Canvas με Y-flip (worldToScreen): Πρέπει να χρησιμοποιήσουμε 'top'    ║
    // ║                                                                        ║
    // ║ ΠΡΙΝ: 'bottom' → κείμενα εμφανίζονταν ΠΑΝΩ από το insertion point    ║
    // ║ ΤΩΡΑ: 'top' → κείμενα εμφανίζονται ΚΑΤΩ (σωστό μετά Y-flip!)         ║
    // ╚════════════════════════════════════════════════════════════════════════╝
    this.ctx.textBaseline = 'top';

    // Apply rotation if needed
    // ╔════════════════════════════════════════════════════════════════════════╗
    // ║ 🔧 DXF ROTATION FIX v3 (2026-01-03)                                    ║
    // ║ Βάσει έρευνας: ezdxf, FreeCAD, libdxfrw                               ║
    // ║                                                                        ║
    // ║ DXF: Counter-clockwise (CCW), 0° = +X direction                       ║
    // ║ Canvas: Clockwise (CW) - positive angles rotate clockwise             ║
    // ║ worldToScreen: Y-flip (screenY = height - worldY)                     ║
    // ║                                                                        ║
    // ║ ΚΡΙΣΙΜΟ: Λόγω Y-flip, πρέπει να ΑΝΤΙΣΤΡΕΨΟΥΜΕ τη γωνία!              ║
    // ║ DXF CCW 90° → Canvas -90° (ή 270°)                                    ║
    // ╚════════════════════════════════════════════════════════════════════════╝
    // Normalize rotation angle (DXF μπορεί να έχει -360, -315, κλπ)
    let normalizedRotation = rotation % 360;
    if (normalizedRotation < 0) normalizedRotation += 360;

    if (normalizedRotation !== 0) {
      this.ctx.translate(screenPos.x, screenPos.y);
      // ΑΝΤΙΣΤΡΟΦΗ γωνίας λόγω Y-flip στο worldToScreen
      // DXF CCW → Canvas CW με αντιστροφή
      // 🏢 ADR-067: Use centralized angle conversion
      this.ctx.rotate(degToRad(-normalizedRotation));
      this.ctx.fillText(text, 0, 0);
    } else {
      this.ctx.fillText(text, screenPos.x, screenPos.y);
    }

    this.ctx.restore();

    // 🏢 FIX (2026-02-20): Text hover uses PhaseManager glow (shadowColor/shadowBlur)
    // from setupStyle(). No additional bounding box overlay needed — the yellow dashed
    // rectangle was visually distracting and non-standard. AutoCAD-style: glow only.

    // Use centralized finalization
    this.finalizeRendering(entity, options);
  }

  /**
   * Extract text height with fallback
   * Priority: height → fontSize → default 2.5 (AutoCAD Standard DIMTXT)
   *
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ 🏢 ENTERPRISE FIX (2026-01-03): Removed 0.1 threshold                    ║
   * ║                                                                          ║
   * ║ ΠΡΙΝ: height > 0.1 → fallback 12 (λάθος!)                               ║
   * ║ Αυτό έκανε dims με μικρό height (0.18) να πέφτουν σε 12 = ΤΕΡΑΣΤΙΑ!     ║
   * ║                                                                          ║
   * ║ ΤΩΡΑ: height > 0 → χρησιμοποιεί την πραγματική τιμή                     ║
   * ║ Fallback: 2.5 (AutoCAD Standard default, όχι arbitrary 12)              ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   */
  private extractTextHeight(entity: EntityModel): number {
    // Priority 1: height (direct from entity - from DXF parsing)
    if ('height' in entity && typeof entity.height === 'number' && entity.height > 0) {
      return entity.height as number;
    }
    // Priority 2: fontSize (alternative property name)
    if ('fontSize' in entity && typeof entity.fontSize === 'number' && entity.fontSize > 0) {
      return entity.fontSize;
    }
    // Default: 2.5 (AutoCAD Standard DIMTXT default)
    return 2.5;
  }

  getGrips(entity: EntityModel): GripInfo[] {
    // 🏢 ADR-102: Use centralized type guards
    const e = entity as Entity;
    if (!isTextEntity(e) && !isMTextEntity(e)) return [];

    const grips: GripInfo[] = [];
    // ✅ ENTERPRISE FIX: Use type guard for safe property access
    if (!('position' in entity)) return [];
    const position = entity.position as Point2D;
    
    if (!position) return grips;
    
    // Position grip
    grips.push({
      id: `${entity.id}-position`,
      entityId: entity.id,
      type: 'vertex',
      gripIndex: 0,
      position: position,
      isVisible: true,
      isHovered: false,
      isSelected: false,
      gripType: 'vertex' // ✅ ENTERPRISE FIX: Backward compatibility alias
    });
    
    return grips;
  }

  /**
   * Hit testing for text entities (simplified like old backup)
   * 🏢 ADR-105: Use centralized fallback tolerance
   */
  hitTest(entity: EntityModel, point: Point2D, tolerance: number = TOLERANCE_CONFIG.HIT_TEST_FALLBACK): boolean {
    // 🏢 ADR-102: Use centralized type guards
    const e = entity as Entity;
    if (!isTextEntity(e) && !isMTextEntity(e)) return false;

    if (!('position' in entity) || !('text' in entity)) return false;

    const position = entity.position as Point2D;
    const text = entity.text as string;
    const height = this.extractTextHeight(entity);
    const rotation = ('rotation' in entity) ? entity.rotation as number : 0;

    if (!position || !text) return false;

    // 🏢 ADR-107: Use centralized text metrics ratio for width estimation
    const width = text.length * height * TEXT_METRICS_RATIOS.CHAR_WIDTH_MONOSPACE;

    // 🏢 FIX (2026-02-20): Rotation-aware hit testing.
    // Transform the test point into the text's LOCAL coordinate system before
    // checking the axis-aligned bounding box. Without this, vertical dimension
    // text (rotated 90°) had a horizontal hit zone — catching clicks from far away.
    let testPoint = point;
    if (rotation !== 0) {
      const rad = degToRad(-rotation); // Inverse rotation to go from world → local
      const dx = point.x - position.x;
      const dy = point.y - position.y;
      testPoint = {
        x: position.x + dx * Math.cos(rad) - dy * Math.sin(rad),
        y: position.y + dx * Math.sin(rad) + dy * Math.cos(rad),
      };
    }

    // Check if point is within text bounds (local coordinates, axis-aligned)
    const minX = position.x;
    const maxX = position.x + width;
    const minY = position.y - height;
    const maxY = position.y;

    const worldTolerance = tolerance / this.transform.scale;

    return testPoint.x >= minX - worldTolerance &&
           testPoint.x <= maxX + worldTolerance &&
           testPoint.y >= minY - worldTolerance &&
           testPoint.y <= maxY + worldTolerance;
  }
}