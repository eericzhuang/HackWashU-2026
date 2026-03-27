import { useState, useRef, useCallback, useEffect } from 'react';
import type { Session, TreeNode, FollowUpState } from '@/types';
import { generateFollowUp } from '@/lib/ai';
import { saveChildNode, setActiveNode } from '@/lib/db';

const initialState: FollowUpState = {
  phase: 'idle',
  streamedText: '',
  error: null,
  parentNodeId: null,
};

export function useFollowUp() {
  const [state, setState] = useState<FollowUpState>(initialState);
  const abortRef = useRef<AbortController | null>(null);

  const ask = useCallback(
    async (session: Session, currentNode: TreeNode, question: string) => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;

      setState({
        phase: 'streaming',
        streamedText: '',
        error: null,
        parentNodeId: currentNode.id,
      });

      const currentContent = currentNode.response ?? currentNode.userQuestion!;

      try {
        let fullText = '';
        await generateFollowUp(
          session.skill,
          currentNode.context,
          currentContent,
          question,
          {
            onChunk: (text) => {
              setState((prev) => ({
                ...prev,
                streamedText: prev.streamedText + text,
              }));
            },
            onComplete: async (text) => {
              fullText = text;
            },
            onError: (error) => {
              setState((prev) => ({
                ...prev,
                phase: 'error',
                error: error.message,
              }));
            },
          },
          signal
        );

        // Save the follow-up node
        const saved = await saveChildNode({
          sessionId: session.id,
          parentId: currentNode.id,
          angle: null,
          rationale: null,
          response: fullText,
          userQuestion: question,
          context: '',
          depth: currentNode.depth + 1,
        });

        setState((prev) => ({ ...prev, phase: 'done' }));
        await setActiveNode(session.id, saved.id);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          setState(initialState);
          return;
        }
        setState((prev) => ({
          ...prev,
          phase: 'error',
          error: (err as Error).message,
        }));
      }
    },
    []
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setState(initialState);
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return { state, ask, cancel, reset };
}
