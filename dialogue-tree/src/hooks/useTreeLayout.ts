import { useMemo } from 'react';
import type { TreeNode } from '@/types';
import { toReactFlowGraph, layoutTree } from '@/lib/tree-utils';

export function useTreeLayout(nodes: TreeNode[], activeNodeId: string) {
  return useMemo(() => {
    if (nodes.length === 0) {
      return { nodes: [], edges: [] };
    }
    const graph = toReactFlowGraph(nodes, activeNodeId);
    return layoutTree(graph.nodes, graph.edges);
  }, [nodes, activeNodeId]);
}
