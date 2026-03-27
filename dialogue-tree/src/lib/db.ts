import Dexie, { type EntityTable } from 'dexie';
import type { TreeNode, Session } from '@/types';

const db = new Dexie('DialogueTree') as Dexie & {
  sessions: EntityTable<Session, 'id'>;
  nodes: EntityTable<TreeNode, 'id'>;
};

db.version(1).stores({
  sessions: 'id, createdAt, updatedAt',
  nodes: 'id, sessionId, parentId, [sessionId+parentId], depth',
});

export { db };

// ==================== Session Operations ====================

export async function createSession(
  question: string,
  skill: string
): Promise<Session> {
  const rootId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const now = Date.now();

  const root: TreeNode = {
    id: rootId,
    sessionId,
    parentId: null,
    angle: null,
    rationale: null,
    response: null,
    userQuestion: question,
    context: '',
    depth: 0,
    createdAt: now,
  };

  const session: Session = {
    id: sessionId,
    title: question.slice(0, 30),
    rootId,
    activeNodeId: rootId,
    skill,
    createdAt: now,
    updatedAt: now,
  };

  await db.transaction('rw', db.sessions, db.nodes, async () => {
    await db.nodes.add(root);
    await db.sessions.add(session);
  });

  return session;
}

// ==================== Node Operations ====================

export async function getChildren(
  sessionId: string,
  parentId: string
): Promise<TreeNode[]> {
  return db.nodes
    .where({ sessionId, parentId })
    .toArray();
}

export async function getSessionNodes(
  sessionId: string
): Promise<TreeNode[]> {
  return db.nodes.where({ sessionId }).toArray();
}

export async function getPathToNode(
  sessionId: string,
  nodeId: string
): Promise<TreeNode[]> {
  const allNodes = await getSessionNodes(sessionId);
  const nodeMap = new Map(allNodes.map((n) => [n.id, n]));
  const path: TreeNode[] = [];

  let current = nodeMap.get(nodeId);
  while (current) {
    path.unshift(current);
    current = current.parentId ? nodeMap.get(current.parentId) : undefined;
  }

  return path;
}

export async function saveChildNode(
  node: Omit<TreeNode, 'id' | 'createdAt'>
): Promise<TreeNode> {
  const full: TreeNode = {
    ...node,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };
  await db.nodes.add(full);
  return full;
}

export async function setActiveNode(
  sessionId: string,
  nodeId: string
): Promise<void> {
  await db.sessions.update(sessionId, {
    activeNodeId: nodeId,
    updatedAt: Date.now(),
  });
}

export async function deleteChildren(
  sessionId: string,
  parentId: string
): Promise<void> {
  const children = await getChildren(sessionId, parentId);
  for (const child of children) {
    await deleteChildren(sessionId, child.id);
  }
  const childIds = children.map((c) => c.id);
  if (childIds.length > 0) {
    await db.nodes.bulkDelete(childIds);
  }
}

export async function updateNodeContext(
  nodeId: string,
  context: string
): Promise<void> {
  await db.nodes.update(nodeId, { context });
}
