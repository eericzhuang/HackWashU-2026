import { useEffect } from 'react';
import type { DivergeState } from '@/types';

interface UseKeyboardOptions {
  divergeState: DivergeState;
  onSelectCard: (finalNodeId: string) => void;
  onNavigateParent: () => void;
  onReDiverge: () => void;
  onCancel: () => void;
}

export function useKeyboard({
  divergeState,
  onSelectCard,
  onNavigateParent,
  onReDiverge,
  onCancel,
}: UseKeyboardOptions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when focus is in an input/textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      switch (e.key) {
        case '1':
        case '2':
        case '3':
        case '4': {
          const idx = Number(e.key) - 1;
          const card = divergeState.cards[idx];
          if (card?.status === 'complete' && card.finalNodeId) {
            onSelectCard(card.finalNodeId);
          }
          break;
        }
        case 'Backspace':
          e.preventDefault();
          onNavigateParent();
          break;
        case 'r':
          if (!divergeState.isRunning) {
            onReDiverge();
          }
          break;
        case 'Escape':
          if (divergeState.isRunning) {
            onCancel();
          }
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [divergeState, onSelectCard, onNavigateParent, onReDiverge, onCancel]);
}
