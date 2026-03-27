import { useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Session } from '@/types';
import { db, createSession, setActiveNode, getChildren, deleteChildren } from '@/lib/db';
import { useDiverge } from '@/hooks/useDiverge';
import { AppShell } from '@/components/layout/AppShell';
import { ContentPanel } from '@/components/content/ContentPanel';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [question, setQuestion] = useState('');

  // Query all nodes for the current session
  const allNodes = useLiveQuery(
    () => (session ? db.nodes.where({ sessionId: session.id }).toArray() : []),
    [session?.id]
  );

  // Query latest session state (activeNodeId may change)
  const liveSession = useLiveQuery(
    () => (session ? db.sessions.get(session.id) : undefined),
    [session?.id]
  );

  // Currently active node
  const activeNode = allNodes?.find(
    (n) => n.id === (liveSession?.activeNodeId ?? session?.activeNodeId)
  );

  const { state: divergeState, diverge, cancel, loadExisting } = useDiverge();

  // Create session and auto-trigger the first diverge
  const handleStart = useCallback(async () => {
    if (question.trim().length < 5) return;
    const s = await createSession(question.trim(), '');
    setSession(s);
    const rootNode = await db.nodes.get(s.rootId);
    if (rootNode) {
      diverge(s, rootNode);
    }
  }, [question, diverge]);

  // Select card → set activeNode → trigger new diverge round
  const handleSelectCard = useCallback(
    async (finalNodeId: string) => {
      if (!liveSession) return;
      await setActiveNode(liveSession.id, finalNodeId);
      const node = await db.nodes.get(finalNodeId);
      if (node) {
        diverge(liveSession, node);
      }
    },
    [liveSession, diverge]
  );

  // Re-diverge: delete existing children, regenerate
  const handleReDiverge = useCallback(async () => {
    if (!liveSession || !activeNode) return;
    await deleteChildren(liveSession.id, activeNode.id);
    diverge(liveSession, activeNode);
  }, [liveSession, activeNode, diverge]);

  // Node click from tree panel: navigate to that node
  const handleNodeClick = useCallback(
    async (nodeId: string) => {
      if (!liveSession) return;
      if (nodeId === activeNode?.id) return;

      await setActiveNode(liveSession.id, nodeId);
      const node = await db.nodes.get(nodeId);
      if (!node) return;

      const children = await getChildren(liveSession.id, nodeId);
      if (children.length === 0) {
        diverge(liveSession, node);
      } else {
        // Load existing children as completed cards
        loadExisting(children);
      }
    },
    [liveSession, activeNode?.id, diverge, loadExisting]
  );

  // No session yet: show input screen
  if (!session) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-md space-y-4 p-6">
          <h1 className="text-2xl font-semibold text-foreground text-center">
            Dialogue Divergence Tree
          </h1>
          <p className="text-muted-foreground text-sm text-center">
            Enter a question to explore — AI will diverge into 4 different angles
          </p>
          <Textarea
            placeholder="Enter a question you want to explore..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="min-h-[100px]"
          />
          <Button
            className="w-full"
            onClick={handleStart}
            disabled={question.trim().length < 5}
          >
            Start Exploring
          </Button>
        </div>
      </div>
    );
  }

  // Waiting for data to load
  if (!activeNode || !liveSession || !allNodes) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Exploration view with tree panel
  return (
    <AppShell
      allNodes={allNodes}
      activeNodeId={activeNode.id}
      onNodeClick={handleNodeClick}
    >
      <ContentPanel
        session={liveSession}
        activeNode={activeNode}
        divergeState={divergeState}
        onSelectCard={handleSelectCard}
        onReDiverge={handleReDiverge}
        onCancel={cancel}
      />
    </AppShell>
  );
}

export default App;
