import { useState, useCallback, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Session, TreeNode, DivergeState } from '@/types';
import { NodeContent } from '@/components/content/NodeContent';
import { CandidateCard } from '@/components/content/CandidateCard';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { RotateCcw, X, Eye, ArrowLeft, Check, GitFork, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';

const EXPAND_COLORS = [
  { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/30', badge: 'bg-blue-500/20 text-blue-600 dark:text-blue-400' },
  { bg: 'bg-green-500/10', text: 'text-green-600 dark:text-green-400', border: 'border-green-500/30', badge: 'bg-green-500/20 text-green-600 dark:text-green-400' },
  { bg: 'bg-orange-500/10', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-500/30', badge: 'bg-orange-500/20 text-orange-600 dark:text-orange-400' },
  { bg: 'bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500/30', badge: 'bg-purple-500/20 text-purple-600 dark:text-purple-400' },
] as const;

interface ContentPanelProps {
  session: Session;
  activeNode: TreeNode;
  divergeState: DivergeState;
  onSelectCard: (finalNodeId: string) => void;
  onDiverge: (guidance?: string) => void;
  onReDiverge: () => void;
  onCancel: () => void;
}

export function ContentPanel({
  activeNode,
  divergeState,
  onSelectCard,
  onDiverge,
  onReDiverge,
  onCancel,
}: ContentPanelProps) {
  const [showContext, setShowContext] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [showReDivergeConfirm, setShowReDivergeConfirm] = useState(false);
  const [showGuidance, setShowGuidance] = useState(false);
  const [guidance, setGuidance] = useState('');

  const handleExpand = useCallback((index: number) => {
    setExpandedIndex(index);
  }, []);

  const handleBack = useCallback(() => {
    setExpandedIndex(null);
  }, []);

  const handleSelectFromExpanded = useCallback(
    (finalNodeId: string) => {
      setExpandedIndex(null);
      onSelectCard(finalNodeId);
    },
    [onSelectCard]
  );

  // Vertical split resizer (used only in default view with cards)
  const [splitRatio, setSplitRatio] = useState(0.55);
  const containerRef = useRef<HTMLDivElement>(null);
  const vDragging = useRef(false);

  const handleVDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    vDragging.current = true;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!vDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const ratio = (e.clientY - rect.top) / rect.height;
      setSplitRatio(Math.min(0.7, Math.max(0.3, ratio)));
    };
    const onUp = () => {
      if (!vDragging.current) return;
      vDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const isIdle = divergeState.phase === 'idle' && !divergeState.isRunning;

  // ===== Expanded response detail view =====
  if (expandedIndex !== null) {
    const card = divergeState.cards[expandedIndex];
    const colors = EXPAND_COLORS[expandedIndex];

    return (
      <div className="h-full flex flex-col p-6 gap-4 overflow-hidden">
        <div className="shrink-0 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <Badge variant="secondary" className={`${colors.badge} text-sm px-3 py-1`}>
            {card.angle?.name}
          </Badge>
          <span className="text-muted-foreground text-sm flex-1 truncate">
            {card.angle?.rationale}
          </span>
          {card.status === 'complete' && card.finalNodeId && (
            <Button
              size="sm"
              className={`${colors.text}`}
              onClick={() => handleSelectFromExpanded(card.finalNodeId!)}
            >
              <Check className="w-4 h-4 mr-1" />
              Select this direction
            </Button>
          )}
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <article className="max-w-3xl mx-auto py-2">
            <div className={`rounded-lg border ${colors.border} ${colors.bg} px-10 py-8`}>
              <div className="prose dark:prose-invert prose-base max-w-none prose-headings:text-foreground prose-p:text-foreground/85 prose-strong:text-foreground prose-li:text-foreground/85 prose-a:text-primary prose-code:text-foreground/90 prose-code:bg-foreground/5 prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 prose-pre:bg-foreground/5 prose-pre:border prose-pre:border-foreground/10 [&>h2]:text-xl [&>h2]:font-semibold [&>h2]:mt-8 [&>h2]:mb-4 [&>h2]:tracking-tight [&>h3]:text-lg [&>h3]:font-semibold [&>h3]:mt-6 [&>h3]:mb-3 [&>p]:my-4 [&>p]:leading-7 [&>ul]:my-4 [&>ul]:pl-6 [&>ol]:my-4 [&>ol]:pl-6 [&>li]:my-1.5 [&>li]:leading-7 [&>blockquote]:my-4 [&>blockquote]:pl-4 [&>blockquote]:border-l-4 [&>blockquote]:border-muted-foreground/30 [&>blockquote]:italic [&>blockquote]:text-muted-foreground [&_strong]:font-semibold [&>h2:first-child]:mt-0">
                <ReactMarkdown>{card.streamedText}</ReactMarkdown>
              </div>
            </div>
          </article>
        </ScrollArea>
      </div>
    );
  }

  // ===== Idle view: full response + Diverge button (leaf node) =====
  if (isIdle) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 overflow-hidden">
          <NodeContent node={activeNode} />
        </div>
        <div className="shrink-0 border-t border-border px-6 py-3 space-y-2">
          <button
            type="button"
            onClick={() => setShowGuidance((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showGuidance ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            Steer this divergence (optional)
          </button>
          {showGuidance && (
            <Textarea
              placeholder="e.g. Focus on practical applications, or Challenge this assumption..."
              value={guidance}
              onChange={(e) => setGuidance(e.target.value)}
              className="min-h-[60px] text-sm"
            />
          )}
          <div className="flex items-center justify-center pt-1">
            <Button
              onClick={() => {
                const g = guidance.trim() || undefined;
                setGuidance('');
                setShowGuidance(false);
                onDiverge(g);
              }}
              size="sm"
              className="gap-1.5 shadow-sm hover:shadow-md transition-shadow"
            >
              <GitFork className="w-4 h-4" />
              Diverge from here
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ===== Default view: NodeContent on top + resizable cards below =====
  return (
    <div ref={containerRef} className="h-full flex flex-col overflow-hidden">
      {/* Top: current node content */}
      <div className="min-h-0 overflow-hidden" style={{ flex: `0 0 ${splitRatio * 100}%` }}>
        <NodeContent node={activeNode} />
      </div>

      {/* Vertical drag handle */}
      <div
        onMouseDown={handleVDragStart}
        className="shrink-0 h-1 cursor-row-resize bg-border hover:bg-primary/40 transition-colors"
      />

      {/* Bottom: scrollable cards + context + action bar */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Context summary (collapsible) */}
        {showContext && activeNode.context && (
          <div className="shrink-0 mx-6 mt-2 rounded-lg border border-foreground/10 bg-foreground/[0.03] p-3 text-xs text-muted-foreground">
            <p className="font-medium mb-1 text-foreground/70">Context Summary</p>
            <p className="leading-relaxed">{activeNode.context}</p>
          </div>
        )}

        {/* Candidate cards — scrollable */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 pt-4 pb-2">
            {divergeState.isRunning && (
              <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                {divergeState.phase === 'preparing' && 'Preparing...'}
                {divergeState.phase === 'angles' && 'Generating angles...'}
                {divergeState.phase === 'responses' && 'Streaming responses...'}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {divergeState.cards.map((card) => (
                <CandidateCard
                  key={card.index}
                  card={card}
                  onSelect={onSelectCard}
                  onExpand={handleExpand}
                />
              ))}
            </div>
          </div>
        </ScrollArea>

        {/* Action bar */}
        <div className="shrink-0 px-6 py-2 border-t border-border flex items-center gap-2">
          {divergeState.isRunning ? (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="w-4 h-4 mr-1" />
            Cancel
          </Button>
        ) : (
          <>
            {showReDivergeConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  This will delete all child nodes. Re-diverge?
                </span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setShowReDivergeConfirm(false);
                    onReDiverge();
                  }}
                >
                  Confirm
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowReDivergeConfirm(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => setShowReDivergeConfirm(true)}>
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Re-diverge
                </Button>
                {activeNode.context && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowContext((v) => !v)}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    {showContext ? 'Hide context' : 'View context'}
                  </Button>
                )}
              </>
            )}
          </>
        )}

          {divergeState.phase === 'error' && divergeState.error && (
            <span className="text-destructive text-xs ml-auto">
              {divergeState.error}
            </span>
          )}
          {divergeState.phase === 'done' && !showReDivergeConfirm && (
            <span className="text-muted-foreground/50 text-xs ml-auto">
              Press 1-4 to select · Backspace to go back · R to re-diverge
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
