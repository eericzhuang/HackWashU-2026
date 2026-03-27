import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { TreeRFNodeData } from '@/lib/tree-utils';

type TreeNodeComponentProps = NodeProps & { data: TreeRFNodeData };

export const TreeNodeComponent = memo(function TreeNodeComponent({
  data,
}: TreeNodeComponentProps) {
  const { label, preview, isActive, isAncestor, depth } = data;

  let borderClass = 'border-border';
  let bgClass = 'bg-card';
  let textClass = 'text-muted-foreground';

  if (isActive) {
    borderClass = 'border-primary';
    bgClass = 'bg-primary/10';
    textClass = 'text-foreground';
  } else if (isAncestor) {
    borderClass = 'border-primary/40';
    bgClass = 'bg-primary/5';
    textClass = 'text-foreground/80';
  }

  return (
    <div
      className={`w-[160px] rounded-lg border ${borderClass} ${bgClass} px-3 py-2 cursor-pointer transition-colors hover:border-primary/60`}
    >
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0 !w-0 !h-0" />

      <p className={`text-xs font-medium ${textClass} truncate`}>
        {depth === 0 ? 'Q' : label}
      </p>
      <p className="text-[10px] text-muted-foreground/60 truncate mt-0.5">
        {preview}
      </p>

      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0 !w-0 !h-0" />
    </div>
  );
});
