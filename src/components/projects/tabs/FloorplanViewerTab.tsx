'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Map, Plus, Edit } from 'lucide-react';

interface FloorplanViewerTabProps {
  title: string;
  floorplanData?: any; // DXF scene data
  onAddFloorplan?: () => void;
  onEditFloorplan?: () => void;
}

export function FloorplanViewerTab({ 
  title, 
  floorplanData, 
  onAddFloorplan, 
  onEditFloorplan 
}: FloorplanViewerTabProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(false);


  // Render DXF data to canvas (simplified - without grid/rulers)
  useEffect(() => {
    if (!floorplanData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match container size exactly
    const container = canvas.parentElement;
    if (container) {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      console.log('📐 Canvas sized to container:', { width: rect.width, height: rect.height });
    }

    console.log('🏗️ Rendering floorplan to project tab:', floorplanData);
    
    // Detect dark mode
    const isDarkMode = document.documentElement.classList.contains('dark');
    console.log('🌙 Dark mode detected:', isDarkMode);
    
    // Clear canvas with appropriate background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = isDarkMode ? '#111827' : '#f8f9fa';  // dark:bg-gray-900 vs bg-gray-50
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate bounds and scale - align TOP-LEFT with canvas TOP-LEFT (different from main canvas)
    if (floorplanData.entities && floorplanData.entities.length > 0) {
      const bounds = floorplanData.bounds || { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } };
      const drawingWidth = bounds.max.x - bounds.min.x;
      const drawingHeight = bounds.max.y - bounds.min.y;
      
      // Calculate scale to fill entire canvas completely
      const availableWidth = canvas.width;
      const availableHeight = canvas.height;
      const scaleX = availableWidth / drawingWidth;
      const scaleY = availableHeight / drawingHeight;
      
      // Use the LARGER scale to fill the entire canvas (may crop some content)
      // Or use smaller scale to fit entirely - let's try fitting first
      const scale = Math.min(scaleX, scaleY);
      
      // For debugging, let's also calculate what max scale would be
      const maxScale = Math.max(scaleX, scaleY);
      
      // Position TOP-LEFT corner of drawing at TOP-LEFT corner of canvas (0,0)
      // For DXF coordinate system where Y increases upward, we need to position the MAX Y at the top
      const offsetX = 0; // No horizontal offset - start from left edge (x=0)
      const offsetY = 0; // No vertical offset - start from top edge (y=0)
      
      // To position top-left at (0,0), we need to adjust the drawing coordinates
      // Since DXF Y increases upward, we flip and offset by the drawing height
      
      console.log('🎯 FloorplanViewerTab TOP-LEFT alignment - VERSION 2.4-ORIGINAL-COLORS:', {
        bounds,
        drawingSize: { width: drawingWidth, height: drawingHeight },
        scale,
        maxScale,
        scaleX,
        scaleY,
        canvasSize: { width: canvas.width, height: canvas.height },
        scaledDrawingSize: { width: drawingWidth * scale, height: drawingHeight * scale },
        alignment: 'top-left-FULL-CONTAINER',
        offsetX: offsetX,
        offsetY: offsetY,
        isDarkMode: isDarkMode,
        backgroundColor: isDarkMode ? '#111827' : '#f8f9fa',
        colorMode: 'ORIGINAL_LAYER_COLORS',
        layersAvailable: Object.keys(floorplanData.layers || {}),
        entitiesCount: floorplanData.entities.length,
        timestamp: Date.now()
      });
      
      // No debug border - removed as requested
      
      // Use original layer colors from DXF (same as main canvas)
      const getLayerColor = (layerName: string) => {
        return floorplanData.layers?.[layerName]?.color || '#ffffff';
      };
      
      ctx.lineWidth = 1;
      
      // Render all entity types with TOP-LEFT alignment using original layer colors
      floorplanData.entities.forEach((entity: any) => {
        // Skip invisible layers
        if (floorplanData.layers?.[entity.layer]?.visible === false) {
          return;
        }
        
        // Get the actual layer color (same logic as main canvas)
        const layerColor = getLayerColor(entity.layer);
        ctx.strokeStyle = layerColor;
        
        switch (entity.type) {
          case 'line':
            if (entity.start && entity.end) {
              ctx.beginPath();
              ctx.moveTo(
                (entity.start.x - bounds.min.x) * scale + offsetX,
                (bounds.max.y - entity.start.y) * scale + offsetY  // TOP-LEFT: flip Y and position at top
              );
              ctx.lineTo(
                (entity.end.x - bounds.min.x) * scale + offsetX,
                (bounds.max.y - entity.end.y) * scale + offsetY    // TOP-LEFT: flip Y and position at top
              );
              ctx.stroke();
            }
            break;
            
          case 'polyline':
            if (entity.vertices && Array.isArray(entity.vertices) && entity.vertices.length > 1) {
              ctx.beginPath();
              const firstVertex = entity.vertices[0];
              ctx.moveTo(
                (firstVertex.x - bounds.min.x) * scale + offsetX,
                (bounds.max.y - firstVertex.y) * scale + offsetY
              );
              
              entity.vertices.slice(1).forEach((vertex: any) => {
                ctx.lineTo(
                  (vertex.x - bounds.min.x) * scale + offsetX,
                  (bounds.max.y - vertex.y) * scale + offsetY
                );
              });
              
              if (entity.closed) {
                ctx.closePath();
              }
              ctx.stroke();
            }
            break;
            
          case 'circle':
            if (entity.center && entity.radius) {
              ctx.beginPath();
              ctx.arc(
                (entity.center.x - bounds.min.x) * scale + offsetX,
                (bounds.max.y - entity.center.y) * scale + offsetY,
                entity.radius * scale,
                0,
                2 * Math.PI
              );
              ctx.stroke();
            }
            break;
            
          case 'arc':
            if (entity.center && entity.radius && entity.startAngle !== undefined && entity.endAngle !== undefined) {
              ctx.beginPath();
              ctx.arc(
                (entity.center.x - bounds.min.x) * scale + offsetX,
                (bounds.max.y - entity.center.y) * scale + offsetY,
                entity.radius * scale,
                entity.endAngle,    // Normal angle direction for top-left alignment
                entity.startAngle,  // Normal angle direction for top-left alignment
                false
              );
              ctx.stroke();
            }
            break;
            
          case 'text':
            if (entity.position && entity.text) {
              ctx.fillStyle = layerColor;
              ctx.font = `${Math.max(8, (entity.height || 10) * scale)}px Arial`;
              ctx.fillText(
                entity.text,
                (entity.position.x - bounds.min.x) * scale + offsetX,
                (bounds.max.y - entity.position.y) * scale + offsetY
              );
            }
            break;
        }
      });
    }
  }, [floorplanData]);

  return (
    <Card className="w-full h-full">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <Map className="w-5 h-5" />
            {title}
          </CardTitle>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onAddFloorplan}
              className="flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Προσθήκη Κάτοψη Έργου
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onEditFloorplan}
              disabled={!floorplanData}
              className="flex items-center gap-1"
            >
              <Edit className="w-4 h-4" />
              Επεξεργασία Κάτοψη Έργου
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-2 flex-1 min-h-[500px]">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-3">Φόρτωση κάτοψης...</span>
          </div>
        ) : floorplanData ? (
          <div className="w-full h-full bg-gray-50 dark:bg-gray-900 border-2 border-blue-500 dark:border-blue-400 overflow-hidden relative min-h-[450px]">
            <canvas
              ref={canvasRef}
              className="w-full h-full"
              style={{ 
                width: '100%', 
                height: '100%',
                display: 'block'
              }}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Map className="w-12 h-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">Δεν υπάρχει κάτοψη</h3>
            <p className="text-gray-500 mb-4">Πατήστε "Προσθήκη Κάτοψη Έργου" για να φορτώσετε κάτοψη</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}