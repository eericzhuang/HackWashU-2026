import { useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, setActiveNode, getChildren, deleteChildren } from '@/lib/db';
import { useDiverge } from '@/hooks/useDiverge';
import { useKeyboard } from '@/hooks/useKeyboard';
import { AppShell } from '@/components/layout/AppShell';
import { ContentPanel } from '@/components/content/ContentPanel';

export function ExplorationPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const session = useLiveQuery(
    () => (sessionId ? db.sessions.get(sessionId) : undefined),
    [sessionId]
  );

  const allNodes = useLiveQuery(
    () => (sessionId ? db.nodes.where({ sessionId }).toArray() : []),
    [sessionId]
  );

  const activeNode = allNodes?.find(
    (n) => n.id === session?.activeNodeId
  );

  const { state: divergeState, diverge, cancel, loadExisting, reset } = useDiverge();

  // Auto-diverge on first visit if root has no children
  useEffect(() => {
    if (!session || !allNodes || allNodes.length === 0) return;
    const root = allNodes.find((n) => n.id === session.rootId);
    if (!root) return;
    const children = allNodes.filter((n) => n.parentId === root.id);
    if (children.length === 0 && divergeState.phase === 'idle' && !divergeState.isRunning) {
      diverge(session, root);
    } else if (children.length > 0 && divergeState.phase === 'idle' && !divergeState.isRunning) {
      // Load existing children for the active node
      const activeChildren = allNodes.filter((n) => n.parentId === session.activeNodeId);
      if (activeChildren.length > 0) {
        loadExisting(activeChildren);
      }
    }
    // Only run on initial load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, allNodes?.length]);

  const handleSelectCard = useCallback(
    async (finalNodeId: string) => {
      if (!session) return;
      await setActiveNode(session.id, finalNodeId);
      reset();
    },
    [session, reset]
  );

  const handleDiverge = useCallback(async () => {
    if (!session || !activeNode) return;
    diverge(session, activeNode);
  }, [session, activeNode, diverge]);

  const handleReDiverge = useCallback(async () => {
    if (!session || !activeNode) return;
    await deleteChildren(session.id, activeNode.id);
    diverge(session, activeNode);
  }, [session, activeNode, diverge]);

  const handleNodeClick = useCallback(
    async (nodeId: string) => {
      if (!session) return;
      if (nodeId === activeNode?.id) return;

      await setActiveNode(session.id, nodeId);
      const node = allNodes?.find((n) => n.id === nodeId);
      if (!node) return;

      const children = await getChildren(session.id, nodeId);
      if (children.length === 0) {
        reset();
      } else {
        loadExisting(children);
      }
    },
    [session, activeNode?.id, allNodes, loadExisting, reset]
  );

  const handleNavigateParent = useCallback(async () => {
    if (!session || !activeNode || !activeNode.parentId) return;
    await setActiveNode(session.id, activeNode.parentId);
    const children = await getChildren(session.id, activeNode.parentId);
    if (children.length > 0) {
      loadExisting(children);
    } else {
      reset();
    }
  }, [session, activeNode, loadExisting, reset]);

  useKeyboard({
    divergeState,
    onSelectCard: handleSelectCard,
    onNavigateParent: handleNavigateParent,
    onReDiverge: handleReDiverge,
    onCancel: cancel,
  });

  if (!session || !allNodes) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!activeNode) {
    navigate('/');
    return null;
  }

  return (
    <AppShell
      session={session}
      allNodes={allNodes}
      activeNodeId={activeNode.id}
      onNodeClick={handleNodeClick}
    >
      <ContentPanel
        session={session}
        activeNode={activeNode}
        divergeState={divergeState}
        onSelectCard={handleSelectCard}
        onDiverge={handleDiverge}
        onReDiverge={handleReDiverge}
        onCancel={cancel}
      />
    </AppShell>
  );
}
