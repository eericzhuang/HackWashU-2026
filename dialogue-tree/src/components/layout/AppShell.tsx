import { type ReactNode, useState, useCallback, useRef, useEffect } from 'react';
import type { TreeNode, Session } from '@/types';
import { TreePanel } from '@/components/tree/TreePanel';

const MIN_WIDTH = 280;

interface AppShellProps {
  session: Session;
  allNodes: TreeNode[];
  activeNodeId: string;
  onNodeClick: (nodeId: string) => void;
  children: ReactNode;
}

export function AppShell({ session, allNodes, activeNodeId, onNodeClick, children }: AppShellProps) {
  const [sidebarWidth, setSidebarWidth] = useState(MIN_WIDTH);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const maxWidth = containerRect.width / 2;
      const newWidth = Math.min(maxWidth, Math.max(MIN_WIDTH, e.clientX - containerRect.left));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div ref={containerRef} className="h-screen flex bg-background">
      <div className="shrink-0 overflow-hidden" style={{ width: sidebarWidth }}>
        <TreePanel
          session={session}
          allNodes={allNodes}
          activeNodeId={activeNodeId}
          onNodeClick={onNodeClick}
        />
      </div>

      {/* Drag handle */}
      <div
        onMouseDown={handleMouseDown}
        className="shrink-0 w-1 cursor-col-resize bg-border hover:bg-primary/40 transition-colors"
      />

      <div className="flex-1 min-w-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
