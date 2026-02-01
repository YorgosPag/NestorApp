'use client';

import React, { useEffect, useRef } from 'react';
import { CollaborationUser, Annotation } from './CollaborationManager';
import { isFeatureEnabled } from '../config/experimental-features';
import { dxfComponentStyles, dxfAccessibility } from '../styles/DxfZIndexSystem.styles';
import { UI_COLORS } from '../config/color-config';
import { PANEL_LAYOUT } from '../config/panel-tokens';
// 🏢 ADR-090: Centralized UI Fonts
// 🏢 ADR-097: Centralized Line Dash Patterns
// 🏢 ADR-122: Centralized Line Widths
import { UI_FONTS, LINE_DASH_PATTERNS, RENDER_LINE_WIDTHS } from '../config/text-rendering-config';
// 🏢 ADR-109: Centralized Distance Calculation
import { calculateDistance } from '../rendering/entities/shared/geometry-rendering-utils';

interface CollaborationOverlayProps {
  users: CollaborationUser[];
  annotations: Annotation[];
  viewport: {
    zoom: number;
    panX: number;
    panY: number;
  };
  onAnnotationClick?: (annotation: Annotation) => void;
}

export function CollaborationOverlay({
  users,
  annotations,
  viewport,
  onAnnotationClick
}: CollaborationOverlayProps) {
  // 🚩 Feature flag check - return null if disabled
  if (!isFeatureEnabled('COLLABORATION_OVERLAY')) {
    return null;
  }
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw user cursors
    users.forEach(user => {
      if (user.cursor && user.isActive) {
        drawCursor(ctx, user);
      }
    });

    // Draw selections
    users.forEach(user => {
      if (user.selection && user.selection.length > 0 && user.isActive) {
        drawSelection(ctx, user);
      }
    });

    // Draw annotations
    annotations.forEach(annotation => {
      drawAnnotation(ctx, annotation);
    });

  }, [users, annotations, viewport]);

  const drawCursor = (ctx: CanvasRenderingContext2D, user: CollaborationUser) => {
    if (!user.cursor) return;

    const x = (user.cursor.x * viewport.zoom) + viewport.panX;
    const y = (user.cursor.y * viewport.zoom) + viewport.panY;

    // Draw cursor
    ctx.save();
    ctx.fillStyle = user.color;
    ctx.strokeStyle = UI_COLORS.CANVAS_STROKE_DEFAULT;
    ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL; // 🏢 ADR-122: Centralized line width

    // Cursor arrow
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 12, y + 4);
    ctx.lineTo(x + 8, y + 8);
    ctx.lineTo(x + 4, y + 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // User name label
    ctx.fillStyle = user.color;
    ctx.fillRect(x + 15, y - 8, ctx.measureText(user.name).width + 8, 20);
    ctx.fillStyle = UI_COLORS.WHITE;
    ctx.font = UI_FONTS.INTER.NORMAL; // 🏢 ADR-090: Centralized font
    ctx.fillText(user.name, x + 19, y + 6);

    ctx.restore();
  };

  const drawSelection = (ctx: CanvasRenderingContext2D, user: CollaborationUser) => {
    if (!user.selection) return;

    ctx.save();
    ctx.strokeStyle = user.color;
    ctx.lineWidth = RENDER_LINE_WIDTHS.SELECTION; // 🏢 ADR-122: Centralized line width
    ctx.setLineDash([...LINE_DASH_PATTERNS.SELECTION]); // 🏢 ADR-097: Centralized selection pattern

    // This would need actual entity bounds from the DXF viewer
    // For now, just draw placeholder rectangles
    user.selection.forEach((entityId, index) => {
      const x = 100 + (index * 50);
      const y = 100 + (index * 30);
      ctx.strokeRect(x, y, 40, 25);
    });

    ctx.restore();
  };

  const drawAnnotation = (ctx: CanvasRenderingContext2D, annotation: Annotation) => {
    const x = (annotation.position.x * viewport.zoom) + viewport.panX;
    const y = (annotation.position.y * viewport.zoom) + viewport.panY;

    ctx.save();

    // Annotation marker
    ctx.fillStyle = annotation.type === 'note' ? UI_COLORS.BUTTON_PRIMARY :
                   annotation.type === 'measurement' ? UI_COLORS.SUCCESS : UI_COLORS.ERROR;
    ctx.strokeStyle = UI_COLORS.WHITE;
    ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL; // 🏢 ADR-122: Centralized line width

    // ⚡ NUCLEAR: COLLABORATION CIRCLES ELIMINATED

    // Annotation number/icon
    ctx.fillStyle = UI_COLORS.WHITE;
    ctx.font = UI_FONTS.INTER.BOLD_SMALL; // 🏢 ADR-090: Centralized font
    ctx.textAlign = 'center';
    ctx.fillText(annotation.type === 'note' ? '!' :
                annotation.type === 'measurement' ? 'M' : '×', x, y + 3);

    ctx.restore();
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onAnnotationClick) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Check if click is on an annotation
    annotations.forEach(annotation => {
      const annotationX = (annotation.position.x * viewport.zoom) + viewport.panX;
      const annotationY = (annotation.position.y * viewport.zoom) + viewport.panY;

      // 🏢 ADR-109: Use centralized distance calculation
      const distance = calculateDistance({ x, y }, { x: annotationX, y: annotationY });

      if (distance <= 12) { // 8px radius + 4px tolerance
        onAnnotationClick(annotation);
      }
    });
  };

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={600}
      className={`absolute ${PANEL_LAYOUT.INSET['0']} ${PANEL_LAYOUT.POINTER_EVENTS.AUTO}`}
      style={dxfComponentStyles.collaborationOverlay}
      {...dxfAccessibility.getOverlayProps('collaboration', true)}
      onClick={handleCanvasClick}
    />
  );
}