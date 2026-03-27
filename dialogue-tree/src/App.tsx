import { useState, useCallback, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Session, TreeNode } from '@/types';
import { db, createSession, setActiveNode, getChildren, deleteChildren } from '@/lib/db';
import { useDiverge } from '@/hooks/useDiverge';
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

  const { state: divergeState, diverge, cancel } = useDiverge();

  // Create session and auto-trigger the first diverge
  const handleStart = useCallback(async () => {
    if (question.trim().length < 5) return;
    const s = await createSession(question.trim(), '');
    setSession(s);
    // Get root node and trigger diverge
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

  // Re-diverge
  const handleReDiverge = useCallback(async () => {
    if (!liveSession || !activeNode) return;
    await deleteChildren(liveSession.id, activeNode.id);
    diverge(liveSession, activeNode);
  }, [liveSession, activeNode, diverge]);

  // When jumping to existing child nodes, show history instead of regenerating
  // (Will be implemented in Prompt 4)

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
  if (!activeNode || !liveSession) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Exploration view
  return (
    <div className="h-screen bg-background">
      <ContentPanel
        session={liveSession}
        activeNode={activeNode}
        divergeState={divergeState}
        onSelectCard={handleSelectCard}
        onReDiverge={handleReDiverge}
        onCancel={cancel}
      />
    </div>
  );
}

export default App;
