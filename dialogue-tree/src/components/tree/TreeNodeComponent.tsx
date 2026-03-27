import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { TreeRFNodeData } from '@/lib/tree-utils';

type TreeNodeComponentProps = NodeProps & { data: TreeRFNodeData };

export const TreeNodeComponent = memo(function TreeNodeComponent({
  data,
}: TreeNodeComponentProps) {
  const { label, preview, isActive, isAncestor, depth } = data;

  let borderClass = 'border-border';
  let bgClass = 'bg-foreground/5';
  let textClass = 'text-muted-foreground';
  let shadow = '';

  if (isActive) {
    borderClass = 'border-blue-500/60';
    bgClass = 'bg-blue-500/15';
    textClass = 'text-foreground';
    shadow = 'shadow-md shadow-blue-500/10';
  } else if (isAncestor) {
    borderClass = 'border-foreground/20';
    bgClass = 'bg-foreground/8';
    textClass = 'text-foreground/80';
  }

  return (
    <div
      className={`w-[160px] rounded-lg border ${borderClass} ${bgClass} ${shadow} px-3 py-2 cursor-pointer transition-all duration-200 hover:border-foreground/30 hover:bg-foreground/10`}
    >
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0 !w-0 !h-0" />

      <p className={`text-xs font-medium ${textClass} truncate`}>
        {depth === 0 ? 'Q' : label}
      </p>
      <p className="text-[10px] text-muted-foreground/50 truncate mt-0.5">
        {preview}
      </p>

      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0 !w-0 !h-0" />
    </div>
  );
});
