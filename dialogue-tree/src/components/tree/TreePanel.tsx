import { useCallback, useEffect, useRef } from 'react';
import {
  ReactFlow,
  useReactFlow,
  ReactFlowProvider,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { TreeNode } from '@/types';
import { getAncestorPath } from '@/lib/tree-utils';
import { useTreeLayout } from '@/hooks/useTreeLayout';
import { TreeNodeComponent } from '@/components/tree/TreeNodeComponent';
import { PathBreadcrumb } from '@/components/tree/PathBreadcrumb';

const nodeTypes = { custom: TreeNodeComponent };

interface TreePanelInnerProps {
  allNodes: TreeNode[];
  activeNodeId: string;
  onNodeClick: (nodeId: string) => void;
}

function TreePanelInner({ allNodes, activeNodeId, onNodeClick }: TreePanelInnerProps) {
  const { nodes, edges } = useTreeLayout(allNodes, activeNodeId);
  const { fitView } = useReactFlow();
  const prevActiveRef = useRef(activeNodeId);

  // Auto fitView when active node changes or nodes are added
  useEffect(() => {
    if (nodes.length === 0) return;
    const timer = setTimeout(() => {
      fitView({ padding: 0.3, duration: 300 });
    }, 50);
    return () => clearTimeout(timer);
  }, [nodes.length, activeNodeId, fitView]);

  useEffect(() => {
    prevActiveRef.current = activeNodeId;
  }, [activeNodeId]);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      onNodeClick(node.id);
    },
    [onNodeClick]
  );

  const path = getAncestorPath(allNodes, activeNodeId);

  return (
    <div className="h-full flex flex-col bg-card/50 border-r border-border">
      <div className="flex-1 min-h-0">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.3}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
          panOnScroll
          zoomOnScroll={false}
          className="!bg-transparent"
        />
      </div>
      <div className="shrink-0 border-t border-border">
        <PathBreadcrumb path={path} onNavigate={onNodeClick} />
      </div>
    </div>
  );
}

interface TreePanelProps {
  allNodes: TreeNode[];
  activeNodeId: string;
  onNodeClick: (nodeId: string) => void;
}

export function TreePanel(props: TreePanelProps) {
  return (
    <ReactFlowProvider>
      <TreePanelInner {...props} />
    </ReactFlowProvider>
  );
}
