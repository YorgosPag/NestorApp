/**
 * MODIFY TOOL PROPS — the canonical prop shape of a selection-driven modify tool.
 *
 * The AutoCAD-style modify tools (Scale, Mirror, …) are all driven by the same four
 * things: which tool is active, what is selected, how to reach the scene, and how to
 * commit. Their prop interfaces were therefore byte-identical, declared once per hook.
 *
 * This names that shape once. A tool with extra inputs extends it rather than
 * redeclaring the common half:
 *
 *   export interface UseRotationToolProps extends ModifyToolProps {
 *     currentOverlays?: Overlay[];
 *   }
 *
 * Adoption is incremental (Boy Scout): several older tool hooks still redeclare the
 * shape inline — migrate them when you next touch them, not in a big-bang sweep.
 *
 * @see systems/tools/useModifyToolActivation — the shared activation FSM these tools run
 */
import type React from 'react';
import type { ICommand } from '../../core/commands/interfaces';
import type { PreviewCanvasHandle } from '../../canvas-v2/preview-canvas/PreviewCanvas';
import type { SceneAdapterLevelManager } from '../../systems/entity-creation/useSceneManagerAdapter';

export interface ModifyToolProps {
  /** Current active tool name — the hook matches its own name against this. */
  activeTool: string;
  selectedEntityIds: string[];
  /** Level manager for scene access (the hook builds an ISceneManager adapter from it). */
  levelManager: SceneAdapterLevelManager;
  /** Command executor (from `useCommandHistory`). */
  executeCommand: (cmd: ICommand) => void;
  /** PreviewCanvas ref — cleared on commit / escape / phase change. */
  previewCanvasRef: React.RefObject<PreviewCanvasHandle | null>;
  /** Switches the tool back to 'select' once the gesture completes. */
  onToolChange?: (tool: string) => void;
}
