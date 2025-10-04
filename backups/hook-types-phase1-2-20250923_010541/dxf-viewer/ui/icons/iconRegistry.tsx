'use client';
import React from 'react';

// Comprehensive Lucide imports για CAD
import {
  Upload, Download, Save, Printer, FolderOpen, FileText, FilePlus,
  PencilLine, Square, Circle, Triangle, Pentagon, Hexagon,
  Move, Copy, RotateCw, Scale, FlipHorizontal, Scissors, 
  Expand, Move3D, CornerUpRight, CornerDownRight, Wrench,
  Type, MessageSquare, Tag, Table, FileSpreadsheet,
  ZoomIn, ZoomOut, Maximize, RotateCcw, Eye, EyeOff,
  Layers, Settings, Lock, Unlock, MousePointer, Grid3X3,
  Target, Crosshair, Dot, Compass, Plus, Minus
} from 'lucide-react';

export type CommandId =
  | 'file.new' | 'file.open' | 'file.import' | 'file.save' | 'file.export' | 'file.print'
  | 'draw.line' | 'draw.polyline' | 'draw.rectangle' | 'draw.polygon'
  | 'draw.circle' | 'draw.arc' | 'draw.ellipse' | 'draw.spline'
  | 'draw.point' | 'draw.construction' | 'draw.hatch' | 'draw.region'
  | 'modify.move' | 'modify.copy' | 'modify.rotate' | 'modify.scale' | 'modify.mirror'
  | 'modify.stretch' | 'modify.trim' | 'modify.extend' | 'modify.break' | 'modify.join'
  | 'modify.offset' | 'modify.fillet' | 'modify.chamfer' | 'modify.explode' | 'modify.array'
  | 'annotate.text' | 'annotate.mtext' | 'annotate.leader' | 'annotate.dimension' | 'annotate.table'
  | 'view.redraw' | 'view.regen' | 'view.zoom.window' | 'view.zoom.extents'
  | 'view.zoom.in' | 'view.zoom.out' | 'view.pan' | 'view.orbit'
  | 'layer.manager' | 'layer.properties' | 'layer.freeze' | 'layer.isolate'
  | 'select.all' | 'select.window' | 'select.fence';

export type SnapMode = 'endpoint' | 'midpoint' | 'intersection' | 'center' | 'quadrant' | 
  'tangent' | 'perpendicular' | 'parallel' | 'nearest' | 'node' | 'grid' | 'extension';

// 🎨 COMPREHENSIVE COMMAND ICONS
export const CommandIcons: Record<CommandId, React.ReactNode> = {
  // FILE OPERATIONS
  'file.new': <FilePlus />,
  'file.open': <FolderOpen />,
  'file.import': <Upload />,
  'file.save': <Save />,
  'file.export': <Download />,
  'file.print': <Printer />,
  
  // DRAW TOOLS
  'draw.line': <PencilLine />,
  'draw.polyline': <PencilLine />,
  'draw.rectangle': <Square />,
  'draw.polygon': <Pentagon />,
  'draw.circle': <Circle />,
  'draw.arc': <Circle />,
  'draw.ellipse': <Circle />,
  'draw.spline': <PencilLine />,
  'draw.point': <Dot />,
  'draw.construction': <Plus />,
  'draw.hatch': <Grid3X3 />,
  'draw.region': <Square />,
  
  // MODIFY TOOLS
  'modify.move': <Move />,
  'modify.copy': <Copy />,
  'modify.rotate': <RotateCw />,
  'modify.scale': <Scale />,
  'modify.mirror': <FlipHorizontal />,
  'modify.stretch': <Expand />,
  'modify.trim': <Scissors />,
  'modify.extend': <Move3D />,
  'modify.break': <Scissors />,
  'modify.join': <CornerUpRight />,
  'modify.offset': <Move />,
  'modify.fillet': <CornerDownRight />,
  'modify.chamfer': <CornerUpRight />,
  'modify.explode': <Expand />,
  'modify.array': <Grid3X3 />,
  
  // ANNOTATION TOOLS
  'annotate.text': <Type />,
  'annotate.mtext': <FileText />,
  'annotate.leader': <MessageSquare />,
  'annotate.dimension': <Tag />,
  'annotate.table': <Table />,
  
  // VIEW TOOLS
  'view.redraw': <RotateCcw />,
  'view.regen': <RotateCcw />,
  'view.zoom.window': <ZoomIn />,
  'view.zoom.extents': <Maximize />,
  'view.zoom.in': <ZoomIn />,
  'view.zoom.out': <ZoomOut />,
  'view.pan': <Move />,
  'view.orbit': <RotateCw />,
  
  // LAYER TOOLS
  'layer.manager': <Layers />,
  'layer.properties': <Settings />,
  'layer.freeze': <EyeOff />,
  'layer.isolate': <Eye />,
  
  // SELECTION TOOLS
  'select.all': <MousePointer />,
  'select.window': <Square />,
  'select.fence': <PencilLine />
};

// SNAP ICONS
export const SnapIcons: Record<SnapMode, React.ReactNode> = {
  endpoint: <Target />,
  midpoint: <Crosshair />,
  intersection: <Plus />,
  center: <Circle />,
  quadrant: <Dot />,
  tangent: <PencilLine />,
  perpendicular: <Square />,
  parallel: <PencilLine />,
  nearest: <Target />,
  node: <Dot />,
  grid: <Grid3X3 />,
  extension: <Move />
};

export const iconProps = { size: 18, strokeWidth: 1.75 } as const;

export const withIconProps = (icon: React.ReactNode) => {
  if (React.isValidElement(icon)) {
    return React.cloneElement(icon as any, iconProps);
  }
  return icon;
};

export const getCommandIcon = (id: CommandId) => CommandIcons[id] || <Square />;
export const getSnapIcon = (mode: SnapMode) => SnapIcons[mode] || <Target />;
