/**
 * 🌳 QUADTREE SPATIAL INDEX
 * Enterprise-level QuadTree implementation για complex hit testing και selection
 *
 * ✅ ΦΑΣΗ 1: Full QuadTree implementation
 * - Hierarchical spatial partitioning
 * - Optimized για complex geometry queries
 * - Dynamic node splitting και merging
 *
 * The query algebra (queryNear/queryBounds/querySnap/querySelection/hitTest/
 * queryClosest/update/stats) lives in `BaseSpatialIndex`; this class only owns the
 * recursive-quadrant storage and exposes candidates via `getCandidates`. ADR-583
 * (N.18) — no twin logic.
 */

import type {
  SpatialItem,
  SpatialBounds,
  SpatialDebugInfo
} from './ISpatialIndex';
import { SpatialIndexType } from './ISpatialIndex';
import { SpatialUtils } from './SpatialUtils';
import { BaseSpatialIndex } from './BaseSpatialIndex';

/**
 * Internal QuadTree node structure
 */
interface QuadTreeNode {
  bounds: SpatialBounds;
  items: SpatialItem[];
  children?: [QuadTreeNode, QuadTreeNode, QuadTreeNode, QuadTreeNode]; // NW, NE, SW, SE
  depth: number;
}

/**
 * 🌳 QUADTREE SPATIAL INDEX
 * High-performance spatial index using recursive quadrants
 */
export class QuadTreeSpatialIndex extends BaseSpatialIndex {
  private root: QuadTreeNode;

  constructor(
    bounds: SpatialBounds,
    private maxDepth: number = 8,
    private maxItemsPerNode: number = 10
  ) {
    super(bounds, SpatialIndexType.QUADTREE);
    this.root = this.createNode(this.bounds, 0);
  }

  // ========================================
  // CORE OPERATIONS
  // ========================================

  insert(item: SpatialItem): void {
    if (!SpatialUtils.boundsIntersect(item.bounds, this.bounds)) {
      console.warn('🚧 QuadTree: Item outside index bounds, skipping insertion');
      return;
    }

    this.insertIntoNode(this.root, item);
    this.bumpItemCount(1);
  }

  remove(itemId: string): boolean {
    const removed = this.removeFromNode(this.root, itemId);
    if (removed) {
      this.bumpItemCount(-1);
    }
    return removed;
  }

  clear(): void {
    this.root = this.createNode(this.bounds, 0);
    this.resetItemCount();
  }

  // ========================================
  // PERFORMANCE & DIAGNOSTICS
  // ========================================

  optimize(): void {
    // Rebuild tree με optimized parameters
    const allItems = this.getAllItems();
    this.clear();
    for (const item of allItems) {
      this.insert(item);
    }
  }

  debug(): SpatialDebugInfo {
    return {
      indexType: SpatialIndexType.QUADTREE,
      itemCount: this._itemCount,
      bounds: this.bounds,
      structure: {
        depth: this.maxDepth,
        nodeCount: this.getNodeCount(),
        treeStructure: this.getTreeStructure(this.root)
      },
      performance: this.getStats()
    };
  }

  // 🏢 ENTERPRISE: Public method to count total nodes (required by ISpatialIndex)
  getNodeCount(): number {
    let count = 0;
    const countNodes = (node: QuadTreeNode): void => {
      count++;
      if (node.children) {
        node.children.forEach(countNodes);
      }
    };
    countNodes(this.root);
    return count;
  }

  // ========================================
  // PRIVATE IMPLEMENTATION
  // ========================================

  /** Base hook: every item whose bounds intersect the query window (recursive descent). */
  protected getCandidates(queryBounds: SpatialBounds): SpatialItem[] {
    const results: SpatialItem[] = [];
    this.queryBoundsRecursive(this.root, queryBounds, results);
    return results;
  }

  private createNode(bounds: SpatialBounds, depth: number): QuadTreeNode {
    return {
      bounds,
      items: [],
      depth
    };
  }

  private insertIntoNode(node: QuadTreeNode, item: SpatialItem): void {
    // If node has children, try to insert into appropriate child
    if (node.children) {
      const childIndex = this.getChildIndex(node, item.bounds);
      if (childIndex !== -1) {
        this.insertIntoNode(node.children[childIndex], item);
        return;
      }
    }

    // Insert into current node
    node.items.push(item);

    // Check if we need to split
    if (!node.children &&
        node.items.length > this.maxItemsPerNode &&
        node.depth < this.maxDepth) {
      this.splitNode(node);
    }
  }

  private splitNode(node: QuadTreeNode): void {
    const { bounds } = node;
    const midX = (bounds.minX + bounds.maxX) / 2;
    const midY = (bounds.minY + bounds.maxY) / 2;

    // Create four children (NW, NE, SW, SE)
    const children: [QuadTreeNode, QuadTreeNode, QuadTreeNode, QuadTreeNode] = [
      this.createNode({ minX: bounds.minX, minY: midY, maxX: midX, maxY: bounds.maxY }, node.depth + 1), // NW
      this.createNode({ minX: midX, minY: midY, maxX: bounds.maxX, maxY: bounds.maxY }, node.depth + 1), // NE
      this.createNode({ minX: bounds.minX, minY: bounds.minY, maxX: midX, maxY: midY }, node.depth + 1), // SW
      this.createNode({ minX: midX, minY: bounds.minY, maxX: bounds.maxX, maxY: midY }, node.depth + 1)  // SE
    ];

    node.children = children;

    // Redistribute items
    const itemsToRedistribute = [...node.items];
    node.items = [];

    for (const item of itemsToRedistribute) {
      this.insertIntoNode(node, item);
    }
  }

  private getChildIndex(node: QuadTreeNode, bounds: SpatialBounds): number {
    if (!node.children) return -1;

    for (let i = 0; i < 4; i++) {
      if (SpatialUtils.boundsContains(node.children[i].bounds, bounds)) {
        return i;
      }
    }

    return -1; // Doesn't fit completely in any child
  }

  private removeFromNode(node: QuadTreeNode, itemId: string): boolean {
    // Check current node items
    const itemIndex = node.items.findIndex(item => item.id === itemId);
    if (itemIndex !== -1) {
      node.items.splice(itemIndex, 1);
      return true;
    }

    // Check children
    if (node.children) {
      for (const child of node.children) {
        if (this.removeFromNode(child, itemId)) {
          return true;
        }
      }
    }

    return false;
  }

  private queryBoundsRecursive(node: QuadTreeNode, queryBounds: SpatialBounds, results: SpatialItem[]): void {
    // Check if query bounds intersect with node bounds
    if (!SpatialUtils.boundsIntersect(node.bounds, queryBounds)) {
      return;
    }

    // Add intersecting items from current node
    for (const item of node.items) {
      if (SpatialUtils.boundsIntersect(item.bounds, queryBounds)) {
        results.push(item);
      }
    }

    // Recursively check children
    if (node.children) {
      for (const child of node.children) {
        this.queryBoundsRecursive(child, queryBounds, results);
      }
    }
  }

  private getAllItems(): SpatialItem[] {
    const items: SpatialItem[] = [];
    this.collectAllItems(this.root, items);
    return items;
  }

  private collectAllItems(node: QuadTreeNode, items: SpatialItem[]): void {
    items.push(...node.items);

    if (node.children) {
      for (const child of node.children) {
        this.collectAllItems(child, items);
      }
    }
  }

  // 🏢 ENTERPRISE: Type-safe tree structure
  private getTreeStructure(node: QuadTreeNode): TreeNodeInfo {
    return {
      bounds: node.bounds,
      depth: node.depth,
      itemCount: node.items.length,
      hasChildren: !!node.children,
      children: node.children ? node.children.map(child => this.getTreeStructure(child)) : undefined
    };
  }
}

// 🏢 ENTERPRISE: Type-safe tree node structure for debug
interface TreeNodeInfo {
  bounds: SpatialBounds;
  depth: number;
  itemCount: number;
  hasChildren: boolean;
  children?: TreeNodeInfo[];
}
