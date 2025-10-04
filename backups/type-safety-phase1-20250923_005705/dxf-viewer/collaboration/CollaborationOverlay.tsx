'use client';

import React, { useEffect, useRef } from 'react';
import { CollaborationUser, Annotation } from './CollaborationManager';

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
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;

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
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText(user.name, x + 19, y + 6);

    ctx.restore();
  };

  const drawSelection = (ctx: CanvasRenderingContext2D, user: CollaborationUser) => {
    if (!user.selection) return;

    ctx.save();
    ctx.strokeStyle = user.color;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

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
    ctx.fillStyle = annotation.type === 'note' ? '#4F46E5' : 
                   annotation.type === 'measurement' ? '#059669' : '#DC2626';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;

    // ⚡ NUCLEAR: COLLABORATION CIRCLES ELIMINATED

    // Annotation number/icon
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px Inter, sans-serif';
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
      
      const distance = Math.sqrt(
        Math.pow(x - annotationX, 2) + Math.pow(y - annotationY, 2)
      );

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
      className="absolute inset-0 pointer-events-auto"
      style={{ zIndex: 10 }}
      onClick={handleCanvasClick}
    />
  );
}