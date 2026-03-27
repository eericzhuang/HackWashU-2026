import ReactMarkdown from 'react-markdown';
import type { TreeNode } from '@/types';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface NodeContentProps {
  node: TreeNode;
}

export function NodeContent({ node }: NodeContentProps) {
  // Root node: show user question
  if (node.depth === 0) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center max-w-lg">
          <Badge variant="secondary" className="mb-4 text-xs">
            Initial Question
          </Badge>
          <p className="text-foreground text-2xl font-semibold leading-relaxed">
            {node.userQuestion}
          </p>
        </div>
      </div>
    );
  }

  // Non-root node: fill available space, scroll internally
  return (
    <div className="h-full flex flex-col overflow-hidden border-b border-border">
      <div className="shrink-0 px-6 pt-5 pb-2 flex items-baseline gap-3">
        <Badge variant="secondary" className="text-sm px-3 py-1">
          {node.angle}
        </Badge>
        {node.rationale && (
          <span className="text-muted-foreground text-sm truncate">
            {node.rationale}
          </span>
        )}
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <article className="px-6 pb-5 max-w-3xl">
          <div className="prose prose-base max-w-none [&>h2]:text-xl [&>h2]:font-semibold [&>h2]:mt-8 [&>h2]:mb-4 [&>h2]:tracking-tight [&>h3]:text-lg [&>h3]:font-semibold [&>h3]:mt-6 [&>h3]:mb-3 [&>p]:my-4 [&>p]:leading-7 [&>ul]:my-4 [&>ul]:pl-6 [&>ol]:my-4 [&>ol]:pl-6 [&>li]:my-1.5 [&>li]:leading-7 [&>blockquote]:my-4 [&>blockquote]:pl-4 [&>blockquote]:border-l-4 [&>blockquote]:border-muted-foreground/30 [&>blockquote]:italic [&>blockquote]:text-muted-foreground [&_strong]:font-semibold [&>h2:first-child]:mt-0">
            <ReactMarkdown>{node.response ?? ''}</ReactMarkdown>
          </div>
        </article>
      </ScrollArea>
    </div>
  );
}
