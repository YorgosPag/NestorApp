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
import type { TextEntity } from '../../types/entities';
import { HoverManager } from '../../utils/hover';
import { UI_COLORS } from '../../config/color-config';
// 🏢 ADR-067: Centralized Radians/Degrees Conversion
import { degToRad } from './shared/geometry-utils';
// 🏢 ADR-091: Centralized UI Fonts (buildUIFont for dynamic sizes)
import { buildUIFont } from '../../config/text-rendering-config';


export class TextRenderer extends BaseEntityRenderer {
  /**
   * Text Rendering - Simplified approach from working backup
   *
   * Uses direct height × scale calculation for proper text sizing
   */
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (entity.type !== 'text' && entity.type !== 'mtext') return;

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

    if (options.hovered) {
      HoverManager.renderHover(entity as TextEntity, this.ctx, options, this.worldToScreen.bind(this));
    } else {
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
    }

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
    if (entity.type !== 'text' && entity.type !== 'mtext') return [];

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
   */
  hitTest(entity: EntityModel, point: Point2D, tolerance: number = 5): boolean {
    if (entity.type !== 'text' && entity.type !== 'mtext') return false;

    if (!('position' in entity) || !('text' in entity)) return false;

    const position = entity.position as Point2D;
    const text = entity.text as string;
    const height = this.extractTextHeight(entity);

    if (!position || !text) return false;

    // ✅ SIMPLIFIED: Approximate text bounds like old backup
    const width = text.length * height * 0.6; // Rough approximation

    // Check if point is within text bounds (world coordinates)
    const minX = position.x;
    const maxX = position.x + width;
    const minY = position.y - height;
    const maxY = position.y;

    const worldTolerance = tolerance / this.transform.scale;

    return point.x >= minX - worldTolerance &&
           point.x <= maxX + worldTolerance &&
           point.y >= minY - worldTolerance &&
           point.y <= maxY + worldTolerance;
  }
}