import type { ReactNode } from 'react';
import type { TreeNode } from '@/types';
import { TreePanel } from '@/components/tree/TreePanel';

interface AppShellProps {
  allNodes: TreeNode[];
  activeNodeId: string;
  onNodeClick: (nodeId: string) => void;
  children: ReactNode;
}

export function AppShell({ allNodes, activeNodeId, onNodeClick, children }: AppShellProps) {
  return (
    <div className="h-screen flex bg-background">
      <div className="w-[280px] shrink-0">
        <TreePanel
          allNodes={allNodes}
          activeNodeId={activeNodeId}
          onNodeClick={onNodeClick}
        />
      </div>
      <div className="flex-1 min-w-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
