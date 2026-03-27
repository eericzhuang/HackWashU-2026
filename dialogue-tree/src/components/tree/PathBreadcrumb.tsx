import type { TreeNode } from '@/types';
import { getNodeLabel } from '@/lib/tree-utils';
import { ChevronRight } from 'lucide-react';

interface PathBreadcrumbProps {
  path: TreeNode[];
  onNavigate: (nodeId: string) => void;
}

export function PathBreadcrumb({ path, onNavigate }: PathBreadcrumbProps) {
  if (path.length === 0) return null;

  // If path > 4: show first + "..." + last 2
  let displayItems: (TreeNode | 'ellipsis')[];
  if (path.length > 4) {
    displayItems = [path[0], 'ellipsis', path[path.length - 2], path[path.length - 1]];
  } else {
    displayItems = [...path];
  }

  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground overflow-hidden px-3 py-2">
      {displayItems.map((item, i) => {
        if (item === 'ellipsis') {
          return (
            <span key="ellipsis" className="flex items-center gap-1">
              <ChevronRight className="w-3 h-3 shrink-0 opacity-40" />
              <span className="opacity-50">...</span>
            </span>
          );
        }

        const isLast = i === displayItems.length - 1;
        const label = item.depth === 0 ? 'Q' : getNodeLabel(item);

        return (
          <span key={item.id} className="flex items-center gap-1 min-w-0">
            {i > 0 && <ChevronRight className="w-3 h-3 shrink-0 opacity-40" />}
            <button
              onClick={() => onNavigate(item.id)}
              className={`truncate max-w-[80px] hover:text-foreground transition-colors ${
                isLast ? 'text-foreground font-medium' : ''
              }`}
              title={label}
            >
              {label}
            </button>
          </span>
        );
      })}
    </div>
  );
}
