import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  useReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { TreeNode, Session } from '@/types';
import { db } from '@/lib/db';
import { getAncestorPath } from '@/lib/tree-utils';
import { useTreeLayout } from '@/hooks/useTreeLayout';
import { TreeNodeComponent } from '@/components/tree/TreeNodeComponent';
import { PathBreadcrumb } from '@/components/tree/PathBreadcrumb';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ArrowLeft, Settings, Sun, Moon } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

const nodeTypes = { custom: TreeNodeComponent };

interface TreePanelInnerProps {
  session: Session;
  allNodes: TreeNode[];
  activeNodeId: string;
  onNodeClick: (nodeId: string) => void;
}

function TreePanelInner({ session, allNodes, activeNodeId, onNodeClick }: TreePanelInnerProps) {
  const navigate = useNavigate();
  const { nodes, edges } = useTreeLayout(allNodes, activeNodeId);
  const { fitView } = useReactFlow();
  const prevActiveRef = useRef(activeNodeId);
  const [skillOpen, setSkillOpen] = useState(false);
  const [skillDraft, setSkillDraft] = useState(session.skill);
  const { theme, toggleTheme } = useTheme();

  // Only fitView when the tree grows (new nodes added), not on every node click
  useEffect(() => {
    if (nodes.length === 0) return;
    const timer = setTimeout(() => {
      fitView({ padding: 0.3, duration: 300 });
    }, 50);
    return () => clearTimeout(timer);
  }, [nodes.length, fitView]);

  useEffect(() => {
    prevActiveRef.current = activeNodeId;
  }, [activeNodeId]);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      onNodeClick(node.id);
    },
    [onNodeClick]
  );

  const handleSaveSkill = async () => {
    await db.sessions.update(session.id, { skill: skillDraft });
    setSkillOpen(false);
  };

  const path = getAncestorPath(allNodes, activeNodeId);

  return (
    <div className="h-full flex flex-col bg-sidebar border-r border-border">
      {/* Top bar: back + title + settings */}
      <div className="shrink-0 px-2 py-1.5 border-b border-border bg-card/80 flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate('/')}>
          <ArrowLeft className="w-3.5 h-3.5" />
        </Button>
        <span className="flex-1 text-xs font-medium text-foreground truncate">
          {session.title}
        </span>
        <Button variant="ghost" size="icon-sm" onClick={toggleTheme} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
          {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            setSkillDraft(session.skill);
            setSkillOpen(true);
          }}
        >
          <Settings className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Tree */}
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
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        </ReactFlow>
      </div>

      {/* Breadcrumb */}
      <div className="shrink-0 border-t border-border">
        <PathBreadcrumb path={path} onNavigate={onNodeClick} />
      </div>

      {/* Skill dialog */}
      <Dialog open={skillOpen} onOpenChange={setSkillOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Background / Skill</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Describe your background or preferences to tailor AI responses..."
            value={skillDraft}
            onChange={(e) => setSkillDraft(e.target.value)}
            className="min-h-[80px]"
          />
          <DialogFooter>
            <Button onClick={handleSaveSkill}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface TreePanelProps {
  session: Session;
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
