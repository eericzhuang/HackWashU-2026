import { useState, useRef, useCallback } from 'react';
import type { Session, TreeNode, DivergeState, CandidateCardState, Angle } from '@/types';
import { generateAngles, generateResponse, compressContext } from '@/lib/ai';
import { saveChildNode, updateNodeContext } from '@/lib/db';

function emptyCard(index: number): CandidateCardState {
  return {
    index,
    status: 'empty',
    angle: null,
    streamedText: '',
    finalNodeId: null,
    error: null,
  };
}

const initialState: DivergeState = {
  isRunning: false,
  phase: 'idle',
  cards: [0, 1, 2, 3].map(emptyCard),
  error: null,
};

export function useDiverge() {
  const [state, setState] = useState<DivergeState>(initialState);
  const abortRef = useRef<AbortController | null>(null);

  const setCardState = useCallback(
    (index: number, update: Partial<CandidateCardState> | ((prev: CandidateCardState) => Partial<CandidateCardState>)) => {
      setState((prev) => {
        const newCards = [...prev.cards];
        const current = newCards[index];
        const partial = typeof update === 'function' ? update(current) : update;
        newCards[index] = { ...current, ...partial };
        return { ...prev, cards: newCards };
      });
    },
    []
  );

  const diverge = useCallback(
    async (session: Session, currentNode: TreeNode, guidance?: string) => {
      // 0. Initialize
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;

      setState({
        isRunning: true,
        phase: 'preparing',
        cards: [0, 1, 2, 3].map(emptyCard),
        error: null,
      });

      const currentContent = currentNode.response ?? currentNode.userQuestion!;

      try {
        // 1. Parallel: context compression + angle generation
        setState((prev) => ({ ...prev, phase: 'angles' }));
        // Set all cards to loading
        for (let i = 0; i < 4; i++) {
          setCardState(i, { status: 'loading' });
        }

        const contextPromise =
          currentNode.depth === 0
            ? Promise.resolve(currentNode.userQuestion!)
            : currentNode.context
              ? Promise.resolve(currentNode.context)
              : compressContext(
                  currentNode.context,
                  currentNode.angle!,
                  currentNode.response!,
                  signal
                );

        const anglesPromise = generateAngles(
          session.skill,
          currentNode.context,
          currentContent,
          signal,
          guidance
        );

        const [context, anglesResult] = await Promise.all([
          contextPromise,
          anglesPromise,
        ]);

        // Update node context if newly generated
        if (!currentNode.context && context) {
          await updateNodeContext(currentNode.id, context);
        }

        // 2. Angles ready
        anglesResult.angles.forEach((angle, i) => {
          setCardState(i, { status: 'angle-ready', angle });
        });

        // 3. Stream 4 responses in parallel
        setState((prev) => ({ ...prev, phase: 'responses' }));

        const responsePromises = anglesResult.angles.map((angle, i) =>
          generateResponse(
            session.skill,
            context,
            currentContent,
            angle,
            {
              onChunk: (text) => {
                setCardState(i, (prev) => ({
                  status: 'streaming',
                  streamedText: prev.streamedText + text,
                }));
              },
              onComplete: async (fullText) => {
                const saved = await saveChildNode({
                  sessionId: session.id,
                  parentId: currentNode.id,
                  angle: angle.name,
                  rationale: angle.rationale,
                  response: fullText,
                  userQuestion: null,
                  context: '',
                  depth: currentNode.depth + 1,
                });
                setCardState(i, {
                  status: 'complete',
                  finalNodeId: saved.id,
                  streamedText: fullText,
                });
              },
              onError: (error) => {
                setCardState(i, {
                  status: 'error',
                  error: error.message,
                });
              },
            },
            signal,
            guidance
          )
        );

        await Promise.allSettled(responsePromises);
        setState((prev) => ({ ...prev, phase: 'done', isRunning: false }));
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          setState((prev) => ({ ...prev, isRunning: false, phase: 'idle' }));
          return;
        }
        setState((prev) => ({
          ...prev,
          phase: 'error',
          isRunning: false,
          error: (err as Error).message,
        }));
      }
    },
    [setCardState]
  );

  // Load existing children as completed cards (for navigating to historical nodes)
  const loadExisting = useCallback(
    (children: TreeNode[]) => {
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
      setState({ isRunning: false, phase: 'done', cards, error: null });
    },
    []
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState(initialState);
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setState((prev) => ({ ...prev, isRunning: false, phase: 'idle' }));
  }, []);

  return { state, diverge, cancel, loadExisting, reset };
}
