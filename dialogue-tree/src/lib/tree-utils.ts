import type { TreeNode } from '@/types';
import type { Node as RFNode, Edge as RFEdge } from '@xyflow/react';
import dagre from 'dagre';

// ==================== Node Content Utils ====================

export function getNodeContent(node: TreeNode): string {
  return node.response ?? node.userQuestion ?? '';
}

export function getNodeLabel(node: TreeNode): string {
  if (node.angle) return node.angle;
  if (node.userQuestion) {
    return node.userQuestion.slice(0, 15) +
      (node.userQuestion.length > 15 ? '...' : '');
  }
  return 'Root';
}

// ==================== Ancestor Path ====================

export function getAncestorPath(
  allNodes: TreeNode[],
  targetId: string
): TreeNode[] {
  const nodeMap = new Map(allNodes.map((n) => [n.id, n]));
  const path: TreeNode[] = [];

  let current = nodeMap.get(targetId);
  while (current) {
    path.unshift(current);
    current = current.parentId ? nodeMap.get(current.parentId) : undefined;
  }

  return path;
}

// ==================== ReactFlow Conversion ====================

export interface TreeRFNodeData {
  label: string;
  preview: string;
  isActive: boolean;
  isAncestor: boolean;
  depth: number;
  [key: string]: unknown;
}

export function toReactFlowGraph(
  nodes: TreeNode[],
  activeNodeId: string
): { nodes: RFNode<TreeRFNodeData>[]; edges: RFEdge[] } {
  const ancestorIds = new Set(
    getAncestorPath(nodes, activeNodeId).map((n) => n.id)
  );

  const rfNodes: RFNode<TreeRFNodeData>[] = nodes.map((node) => ({
    id: node.id,
    type: 'custom',
    position: { x: 0, y: 0 },
    data: {
      label: getNodeLabel(node),
      preview: getNodeContent(node).slice(0, 15),
      isActive: node.id === activeNodeId,
      isAncestor: ancestorIds.has(node.id) && node.id !== activeNodeId,
      depth: node.depth,
    },
  }));

  const rfEdges: RFEdge[] = nodes
    .filter((n) => n.parentId !== null)
    .map((node) => ({
      id: `${node.parentId}-${node.id}`,
      source: node.parentId!,
      target: node.id,
      type: 'smoothstep',
      animated: ancestorIds.has(node.id) && ancestorIds.has(node.parentId!),
    }));

  return { nodes: rfNodes, edges: rfEdges };
}

// ==================== Dagre Layout ====================

export function layoutTree(
  rfNodes: RFNode<TreeRFNodeData>[],
  rfEdges: RFEdge[]
): { nodes: RFNode<TreeRFNodeData>[]; edges: RFEdge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 30, ranksep: 60 });

  const nodeWidth = 160;
  const nodeHeight = 60;

  for (const node of rfNodes) {
    g.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  }

  for (const edge of rfEdges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const layoutedNodes = rfNodes.map((node) => {
    const dagreNode = g.node(node.id);
    return {
      ...node,
      position: {
        x: dagreNode.x - nodeWidth / 2,
        y: dagreNode.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges: rfEdges };
}
