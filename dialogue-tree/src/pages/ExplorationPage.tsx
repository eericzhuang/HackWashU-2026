import { useCallback, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import type { DivergeState, CandidateCardState } from '@/types';
import { db, setActiveNode, deleteChildren } from '@/lib/db';
import { useDiverge } from '@/hooks/useDiverge';
import { useFollowUp } from '@/hooks/useFollowUp';
import { useKeyboard } from '@/hooks/useKeyboard';
import { AppShell } from '@/components/layout/AppShell';
import { ContentPanel } from '@/components/content/ContentPanel';

function emptyCard(index: number): CandidateCardState {
  return { index, status: 'empty', angle: null, streamedText: '', finalNodeId: null, error: null };
}

const idleState: DivergeState = {
  isRunning: false,
  phase: 'idle',
  cards: [0, 1, 2, 3].map(emptyCard),
  error: null,
  parentNodeId: null,
};

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

  const { state: divergeState, diverge, cancel } = useDiverge();
  const { state: followUpState, ask: askFollowUp, cancel: cancelFollowUp } = useFollowUp();

  // Compute the effective display state:
  // - If the diverge is for the current active node → show live diverge state
  // - Otherwise → compute from DB children (done with cards, or idle)
  const displayState: DivergeState = useMemo(() => {
    if (!activeNode || !allNodes) return idleState;
    if (divergeState.parentNodeId === activeNode.id) return divergeState;
    // Not diverging for this node — check DB children
    const children = allNodes.filter((n) => n.parentId === activeNode.id);
    if (children.length === 0) return idleState;
    // Follow-up children (angle === null, not root) → show idle so user can diverge or ask more
    if (children.length === 1 && children[0].angle === null && children[0].depth > 0) return idleState;
    const cards: CandidateCardState[] = [0, 1, 2, 3].map((i) => {
      const child = children[i];
      if (!child) return emptyCard(i);
      return {
        index: i,
        status: 'complete' as const,
        angle: { name: child.angle ?? '', rationale: child.rationale ?? '' },
        streamedText: child.response ?? '',
        finalNodeId: child.id,
        error: null,
      };
    });
    return { isRunning: false, phase: 'done', cards, error: null, parentNodeId: activeNode.id };
  }, [activeNode, allNodes, divergeState]);

  // Auto-diverge on first visit if root has no children
  useEffect(() => {
    if (!session || !allNodes || allNodes.length === 0) return;
    const root = allNodes.find((n) => n.id === session.rootId);
    if (!root) return;
    const children = allNodes.filter((n) => n.parentId === root.id);
    if (children.length === 0 && divergeState.phase === 'idle' && !divergeState.isRunning) {
      diverge(session, root);
    }
    // Only run on initial load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, allNodes?.length]);

  const handleSelectCard = useCallback(
    async (finalNodeId: string) => {
      if (!session) return;
      await setActiveNode(session.id, finalNodeId);
      // displayState will recompute from allNodes — no need to call loadExisting/reset
    },
    [session]
  );

  const handleDiverge = useCallback(async (guidance?: string) => {
    if (!session || !activeNode) return;
    diverge(session, activeNode, guidance);
  }, [session, activeNode, diverge]);

  const handleFollowUp = useCallback(async (question: string) => {
    if (!session || !activeNode) return;
    askFollowUp(session, activeNode, question);
  }, [session, activeNode, askFollowUp]);

  const handleReDiverge = useCallback(async () => {
    if (!session || !activeNode) return;
    await deleteChildren(session.id, activeNode.id);
    diverge(session, activeNode);
  }, [session, activeNode, diverge]);

  const handleNodeClick = useCallback(
    async (nodeId: string) => {
      if (!session) return;
      if (nodeId === activeNode?.id) return;
      // Just change active node — don't cancel any running diverge.
      // displayState will recompute based on the new active node.
      await setActiveNode(session.id, nodeId);
    },
    [session, activeNode?.id]
  );

  const handleNavigateParent = useCallback(async () => {
    if (!session || !activeNode || !activeNode.parentId) return;
    await setActiveNode(session.id, activeNode.parentId);
  }, [session, activeNode]);

  useKeyboard({
    divergeState: displayState,
    onSelectCard: handleSelectCard,
    onNavigateParent: handleNavigateParent,
    onReDiverge: handleReDiverge,
    onCancel: cancel,
  });

  // allNodes resolves to [] quickly; if it's loaded but session is still undefined, session doesn't exist
  if (!session && allNodes !== undefined) {
    navigate('/', { replace: true });
    return null;
  }

  if (!session || !allNodes) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Loading session...</p>
        </div>
      </div>
    );
  }

  if (!activeNode) {
    navigate('/', { replace: true });
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
        divergeState={displayState}
        followUpState={followUpState}
        onSelectCard={handleSelectCard}
        onDiverge={handleDiverge}
        onFollowUp={handleFollowUp}
        onCancelFollowUp={cancelFollowUp}
        onReDiverge={handleReDiverge}
        onCancel={cancel}
      />
    </AppShell>
  );
}
