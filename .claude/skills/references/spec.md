# 对话迭代树（Dialogue Divergence Tree）— CC 实现规格文档

## 0. 项目概述

一个本地 Web 应用，帮助用户与 AI 进行树状思维发散。用户输入一个初始问题，AI 自动生成 4 个不同角度的深入回答，用户选择其中一个方向继续，形成一棵可回溯的思维探索树。

**技术栈**：React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui + Dexie.js (IndexedDB) + ReactFlow + Anthropic SDK

**不用 Express 后端。不用 SQLite。单体前端应用，API key 通过 Vite dev server proxy 转发。**

---

## 1. 项目初始化

### 1.1 脚手架

```bash
npm create vite@latest dialogue-tree -- --template react-ts
cd dialogue-tree
npm install
npm install @anthropic-ai/sdk dexie dexie-react-hooks @xyflow/react dagre @types/dagre react-markdown react-router-dom lucide-react
npm install -D tailwindcss @tailwindcss/vite
```

安装 shadcn/ui（按 https://ui.shadcn.com/docs/installation/vite 指引操作）。需要的组件：`button`, `card`, `dialog`, `input`, `textarea`, `scroll-area`, `skeleton`, `badge`, `tooltip`, `separator`, `tabs`。

### 1.2 Vite Proxy 配置

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': '/src' },
  },
  server: {
    proxy: {
      '/api/anthropic': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/anthropic/, ''),
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY || '',
          'anthropic-version': '2023-06-01',
        },
      },
    },
  },
});
```

用户在项目根目录创建 `.env` 文件，写入 `ANTHROPIC_API_KEY=sk-ant-...`。

### 1.3 文件结构

```
src/
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx           # 顶层布局壳：header + 左右分栏
│   │   └── Header.tsx             # 顶部栏：session 标题、导航按钮
│   ├── tree/
│   │   ├── TreePanel.tsx          # 左侧面板：ReactFlow 树 + 路径面包屑
│   │   ├── TreeNode.tsx           # ReactFlow 自定义节点组件
│   │   └── PathBreadcrumb.tsx     # 根→当前的线性路径
│   ├── content/
│   │   ├── ContentPanel.tsx       # 右侧面板：当前内容 + 候选卡区
│   │   ├── NodeContent.tsx        # 当前节点的完整内容显示
│   │   └── CandidateCard.tsx      # 单张候选卡（含 streaming 状态机）
│   ├── session/
│   │   ├── SessionList.tsx        # Session 列表页
│   │   └── NewSessionDialog.tsx   # 创建新 session 的对话框
│   └── ui/                        # shadcn/ui 组件目录
├── lib/
│   ├── ai.ts                      # Anthropic API 调用封装
│   ├── prompts.ts                 # 所有 prompt 模板
│   ├── db.ts                      # Dexie.js 数据库定义
│   └── tree-utils.ts              # 树操作工具函数
├── hooks/
│   ├── useSession.ts              # 当前 session 状态
│   ├── useDiverge.ts              # 发散生成流程管理
│   ├── useTreeLayout.ts           # ReactFlow 节点/边计算
│   └── useKeyboard.ts             # 快捷键绑定
├── types.ts                       # 所有 TypeScript 类型定义
├── App.tsx                        # 路由入口
└── main.tsx                       # 应用入口
```

---

## 2. 数据模型

### 2.1 TypeScript 类型 (`types.ts`)

```typescript
// ==================== 核心数据类型 ====================

export interface TreeNode {
  id: string;                     // crypto.randomUUID()
  sessionId: string;
  parentId: string | null;        // null = 根节点

  // 内容字段
  angle: string | null;           // 角度名称，4-8字。根节点为 null
  rationale: string | null;       // 选择该角度的理由，一句话。根节点为 null
  response: string | null;        // AI 完整回答。根节点为 null
  userQuestion: string | null;    // 用户问题。只有根节点有值，其余为 null

  // 上下文
  context: string;                // 压缩上下文摘要。根节点为空字符串

  // 元数据
  depth: number;                  // 0 = 根节点
  createdAt: number;              // Date.now()
}

export interface Session {
  id: string;
  title: string;                  // 取初始问题前 30 字
  rootId: string;
  activeNodeId: string;           // 当前激活节点 ID
  skill: string;                  // 用户填写的背景偏好文本，可为空字符串
  createdAt: number;
  updatedAt: number;
}

// ==================== AI 相关类型 ====================

export interface Angle {
  name: string;                   // 角度名称，4-8字
  rationale: string;              // 为什么有价值，一句话
}

export interface AnglesResponse {
  angles: Angle[];                // 固定 4 个
}

// ==================== UI 状态类型 ====================

export type CardStatus =
  | 'empty'                       // 初始空状态
  | 'loading'                     // 等待角度生成
  | 'angle-ready'                 // 角度已显示，等待回答
  | 'streaming'                   // 回答流式写入中
  | 'complete'                    // 生成完成
  | 'error';                      // 生成失败

export interface CandidateCardState {
  index: number;                  // 0-3
  status: CardStatus;
  angle: Angle | null;
  streamedText: string;           // 流式累积的回答文本
  finalNodeId: string | null;     // 生成完成后保存的节点 ID
  error: string | null;
}

export interface DivergeState {
  isRunning: boolean;
  phase: 'idle' | 'preparing' | 'angles' | 'responses' | 'done' | 'error';
  cards: CandidateCardState[];    // 固定 4 张
  error: string | null;
}
```

### 2.2 IndexedDB Schema (`lib/db.ts`)

```typescript
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
```

复合索引 `[sessionId+parentId]` 用于高效查询某 session 下某节点的所有子节点。

### 2.3 数据库操作

常用查询封装为独立函数，都放在 `lib/db.ts` 中：

```typescript
// 获取某节点的所有子节点
async function getChildren(sessionId: string, parentId: string): Promise<TreeNode[]>

// 获取某 session 的所有节点
async function getSessionNodes(sessionId: string): Promise<TreeNode[]>

// 获取从根到指定节点的路径
async function getPathToNode(sessionId: string, nodeId: string): Promise<TreeNode[]>

// 创建新 session + 根节点（事务）
async function createSession(question: string, skill: string): Promise<Session>

// 保存生成的子节点
async function saveChildNode(node: Omit<TreeNode, 'id' | 'createdAt'>): Promise<TreeNode>

// 更新 session 的 activeNodeId
async function setActiveNode(sessionId: string, nodeId: string): Promise<void>

// 删除某节点的所有子节点（硬删除，递归）
async function deleteChildren(sessionId: string, parentId: string): Promise<void>

// 更新节点的 context
async function updateNodeContext(nodeId: string, context: string): Promise<void>
```

---

## 3. API 调用层

### 3.1 Anthropic 调用封装 (`lib/ai.ts`)

所有 API 调用通过 Vite proxy（`/api/anthropic/v1/messages`）转发。使用 `fetch` + 手动处理 streaming，不直接用 SDK（因为 SDK 需要在 Node 环境设置 API key，proxy 方案下前端直接发 fetch 更简单）。

```typescript
const API_URL = '/api/anthropic/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';

interface StreamCallbacks {
  onChunk: (text: string) => void;      // 每收到一段文本时调用
  onComplete: (fullText: string) => void; // streaming 结束时调用
  onError: (error: Error) => void;       // 出错时调用
}

// 通用 streaming 调用
async function streamMessage(
  system: string,
  userMessage: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      stream: true,
      system,
      messages: [{ role: 'user', content: userMessage }],
    }),
    signal,
  });

  // 处理 SSE stream
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  // 逐块读取，解析 SSE event，提取 content_block_delta 中的 text
  // 每次提取到文本后调用 callbacks.onChunk(delta)
  // 结束时调用 callbacks.onComplete(fullText)
  // 出错时调用 callbacks.onError(error)
}

// 非 streaming 调用（用于角度生成和上下文压缩）
async function sendMessage(
  system: string,
  userMessage: string,
  signal?: AbortSignal
): Promise<string> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system,
      messages: [{ role: 'user', content: userMessage }],
    }),
    signal,
  });
  const data = await response.json();
  return data.content[0].text;
}
```

**SSE 流解析关键逻辑**：Anthropic streaming API 返回的是标准 SSE 格式。关键事件类型：
- `content_block_delta`：包含 `delta.text`，即增量文本
- `message_stop`：流结束
- `error`：错误

解析时按换行符分割，过滤以 `data: ` 开头的行，JSON.parse 后根据 `type` 字段分发处理。

### 3.2 三种 API 调用函数

```typescript
// 1. 生成 4 个角度（非 streaming，返回 JSON）
export async function generateAngles(
  skill: string,
  context: string,
  currentContent: string,   // response 或 userQuestion
  signal?: AbortSignal
): Promise<AnglesResponse>

// 2. 生成单个角度的回答（streaming）
export async function generateResponse(
  skill: string,
  context: string,
  currentContent: string,
  angle: Angle,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<void>

// 3. 上下文压缩（非 streaming）
export async function compressContext(
  parentContext: string,
  nodeAngle: string,
  nodeResponse: string,
  signal?: AbortSignal
): Promise<string>
```

### 3.3 Prompt 模板 (`lib/prompts.ts`)

```typescript
// ===== 角度生成 =====

export function anglesSystemPrompt(skill: string): string {
  return `${skill ? skill + '\n\n' : ''}你是思维发散助手。给定对话上下文和当前内容，判断接下来最有价值的 4 个探索方向。

要求：
- 4 个方向必须覆盖真正不同的维度（如：深化机制、质疑前提、横向类比、实践应用、历史溯源、反面论证等）
- 不要只是措辞不同的同一方向
- 角度名称 4-8 字，附一句话说明价值
- 基于当前内容自然生长，不套模板
- 只返回 JSON，无其他文本，无 markdown 代码块`;
}

export function anglesUserPrompt(context: string, currentContent: string): string {
  return `上下文摘要：${context || '（这是起始问题，尚无上下文）'}

当前内容：${currentContent}

请生成 4 个发散方向。返回格式：
{"angles":[{"name":"角度名称","rationale":"为什么有价值"}]}`;
}

// ===== 回答生成 =====

export function responseSystemPrompt(skill: string): string {
  return `${skill ? skill + '\n\n' : ''}你是深度思考助手。从指定角度出发，给出有深度、有洞见的回答。

要求：
- 直接输出内容，不要开场白，不要重复角度名
- 使用 Markdown 格式（标题、列表、粗体等）增强可读性
- 内容要有实质性，不要泛泛而谈
- 控制在 300-500 字`;
}

export function responseUserPrompt(
  context: string,
  currentContent: string,
  angle: Angle
): string {
  return `背景上下文：${context || '（起始问题）'}

当前讨论内容：${currentContent}

从「${angle.name}」角度深入展开：${angle.rationale}`;
}

// ===== 上下文压缩 =====

export function contextSystemPrompt(): string {
  return `将对话历史压缩为简洁上下文摘要。保留关键论点、结论和讨论走向，去掉冗余细节和修辞。控制在 200 字以内。只输出摘要本身，无任何说明文字。`;
}

export function contextUserPrompt(
  parentContext: string,
  angle: string,
  response: string
): string {
  return `已有上下文：${parentContext || '（无）'}

新增内容（角度：${angle}）：
${response}

请生成更新后的上下文摘要。`;
}
```

---

## 4. 核心业务逻辑

### 4.1 发散流程 (`hooks/useDiverge.ts`)

这是整个应用最核心的 hook。管理一次完整的发散过程。

```typescript
export function useDiverge() {
  const [state, setState] = useState<DivergeState>(initialState);
  const abortRef = useRef<AbortController | null>(null);

  async function diverge(session: Session, currentNode: TreeNode) {
    // 0. 初始化状态
    abortRef.current = new AbortController();
    setState(prev => ({
      ...prev,
      isRunning: true,
      phase: 'preparing',
      cards: [0, 1, 2, 3].map(i => emptyCard(i)),
      error: null,
    }));

    const currentContent = currentNode.response ?? currentNode.userQuestion!;
    const signal = abortRef.current.signal;

    try {
      // 1. 并行：上下文压缩 + 角度生成
      setState(prev => ({ ...prev, phase: 'angles' }));
      // 所有卡片进入 loading 状态
      setAllCardsStatus('loading');

      const contextPromise = (currentNode.depth === 0)
        ? Promise.resolve(currentNode.userQuestion!)  // 根节点直接用问题文本
        : (currentNode.context  // 如果已有 context 就复用
            ? Promise.resolve(currentNode.context)
            : compressContext(/* 父节点 context */, currentNode.angle!, currentNode.response!, signal));

      const anglesPromise = generateAngles(
        session.skill,
        currentNode.context,
        currentContent,
        signal
      );

      const [context, anglesResult] = await Promise.all([contextPromise, anglesPromise]);

      // 更新节点的 context（如果是新生成的）
      if (!currentNode.context && context) {
        await updateNodeContext(currentNode.id, context);
      }

      // 2. 角度就绪，更新卡片状态
      anglesResult.angles.forEach((angle, i) => {
        setCardState(i, { status: 'angle-ready', angle });
      });

      // 3. 并行 streaming 4 个回答
      setState(prev => ({ ...prev, phase: 'responses' }));

      const responsePromises = anglesResult.angles.map((angle, i) =>
        generateResponse(
          session.skill,
          context,
          currentContent,
          angle,
          {
            onChunk: (text) => {
              // 更新对应卡片的 streamedText（追加）
              setCardState(i, prev => ({
                status: 'streaming',
                streamedText: prev.streamedText + text,
              }));
            },
            onComplete: async (fullText) => {
              // 保存节点到 DB
              const saved = await saveChildNode({
                sessionId: session.id,
                parentId: currentNode.id,
                angle: angle.name,
                rationale: angle.rationale,
                response: fullText,
                userQuestion: null,
                context: '',  // context 在被选中时才生成
                depth: currentNode.depth + 1,
              });
              setCardState(i, { status: 'complete', finalNodeId: saved.id });
            },
            onError: (error) => {
              setCardState(i, { status: 'error', error: error.message });
            },
          },
          signal
        )
      );

      await Promise.allSettled(responsePromises);
      setState(prev => ({ ...prev, phase: 'done', isRunning: false }));

    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setState(prev => ({
        ...prev,
        phase: 'error',
        isRunning: false,
        error: (err as Error).message,
      }));
    }
  }

  function cancel() {
    abortRef.current?.abort();
    setState(prev => ({ ...prev, isRunning: false, phase: 'idle' }));
  }

  return { state, diverge, cancel };
}
```

### 4.2 选择卡片流程

用户点击某张候选卡的"选择"按钮时：

```
1. 获取该卡片的 finalNodeId（节点已在 streaming 完成时保存到 DB）
2. 更新 session.activeNodeId = finalNodeId
3. 更新 session.updatedAt
4. 以该节点为当前节点，触发新一轮 diverge()
```

### 4.3 节点跳转流程

用户点击 TreePanel 中的历史节点时：

```
1. 更新 session.activeNodeId = 目标节点 ID
2. 查询该节点的子节点：getChildren(sessionId, nodeId)
3. if (子节点.length > 0):
     展示已有子节点为候选卡（status = 'complete'，不重新生成）
     显示"重新发散"按钮
   else:
     触发 diverge(session, 目标节点)
```

### 4.4 重新发散流程

用户点击"重新发散"时：

```
1. deleteChildren(sessionId, currentNodeId)  // 硬删除所有子节点（递归）
2. 触发 diverge(session, currentNode)
```

### 4.5 树工具函数 (`lib/tree-utils.ts`)

```typescript
// 将扁平节点列表转换为 ReactFlow 的 nodes + edges
export function toReactFlowGraph(
  nodes: TreeNode[],
  activeNodeId: string
): { nodes: RFNode[]; edges: RFEdge[] }

// 使用 dagre 计算纵向树布局
export function layoutTree(
  rfNodes: RFNode[],
  rfEdges: RFEdge[]
): { nodes: RFNode[]; edges: RFEdge[] }

// 获取从根到目标节点的路径（用于面包屑和高亮）
export function getAncestorPath(
  allNodes: TreeNode[],
  targetId: string
): TreeNode[]

// 获取当前节点的内容文本（统一处理根/非根）
export function getNodeContent(node: TreeNode): string {
  return node.response ?? node.userQuestion ?? '';
}

// 获取节点的显示标签（角度名 或 问题前 15 字）
export function getNodeLabel(node: TreeNode): string {
  if (node.angle) return node.angle;
  if (node.userQuestion) return node.userQuestion.slice(0, 15) + (node.userQuestion.length > 15 ? '...' : '');
  return '根节点';
}
```

---

## 5. 组件设计

### 5.1 AppShell (`components/layout/AppShell.tsx`)

顶层布局组件，负责左右分栏。

```
结构：
<div class="h-screen flex flex-col">
  <Header />                           // 固定顶栏
  <div class="flex-1 flex overflow-hidden">
    <TreePanel class="w-[280px]" />     // 左侧固定宽度
    <ContentPanel class="flex-1" />     // 右侧自适应
  </div>
</div>
```

接收当前 session 和节点数据，分发给子组件。

### 5.2 Header (`components/layout/Header.tsx`)

内容：
- 左侧：返回按钮（回到 Session 列表）+ Session 标题
- 右侧：「Skill 设置」按钮（打开 Dialog）、「新建探索」按钮

Skill 设置使用 shadcn/ui `Dialog` 组件，内含一个 `Textarea`，编辑后保存到 session。

### 5.3 TreePanel (`components/tree/TreePanel.tsx`)

**上半部分：ReactFlow 树状图**

```typescript
function TreePanel({ nodes, activeNodeId, onNodeClick }) {
  const { rfNodes, rfEdges } = useTreeLayout(nodes, activeNodeId);

  return (
    <div className="h-full flex flex-col">
      {/* 树状图区域 - 占上方空间 */}
      <div className="flex-1 min-h-0">
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={{ custom: TreeNodeComponent }}
          onNodeClick={(_, node) => onNodeClick(node.id)}
          fitView
          proOptions={{ hideAttribution: true }}
          // 禁止用户手动添加边
          edgesReconnectable={false}
          nodesConnectable={false}
        />
      </div>

      {/* 路径面包屑 - 固定底部 */}
      <PathBreadcrumb
        path={getAncestorPath(nodes, activeNodeId)}
        onNodeClick={onNodeClick}
      />
    </div>
  );
}
```

**自定义节点组件 TreeNodeComponent**：

```
┌─────────────────────┐
│ 批判性视角           │  ← angle 名称（根节点显示"起始问题"）
│ 这个论点的前提...    │  ← response 前 15 字预览
└─────────────────────┘
```

- 当前激活节点：高亮边框 + 背景色
- 当前路径上的祖先节点：半透明高亮
- 其他节点：默认样式
- 尺寸：固定宽 160px，高度自适应

**ReactFlow 配置**：
- dagre 布局：方向 `TB`（top-to-bottom），节点间距 `nodesep: 30, ranksep: 60`
- 启用 `fitView`，每次 activeNodeId 变化时自动 `fitView` 到当前节点
- 启用缩放和平移
- 边样式：`smoothstep` 类型，颜色跟随主题

### 5.4 PathBreadcrumb (`components/tree/PathBreadcrumb.tsx`)

显示从根到当前节点的线性路径。

```
📍 什么是意识的本质... → 批判性视角 → 实践层面 ← 当前
```

- 每个节点可点击（跳转）
- 超过 4 个节点时，中间显示 `...`，只保留前 1 个 + 后 2 个
- 当前节点不可点击，用不同样式标识

### 5.5 ContentPanel (`components/content/ContentPanel.tsx`)

右侧主区域，垂直排列两个区块。

```
结构：
<div class="h-full flex flex-col p-6 gap-6">
  <NodeContent node={activeNode} />           // 当前节点内容（固定高度，内部滚动）
  <div class="flex-1 min-h-0">               // 候选卡区域
    <CandidateGrid cards={divergeState.cards} onSelect={handleSelect} />
  </div>
  <ActionBar />                               // 操作栏
</div>
```

**CandidateGrid**：2×2 网格布局（`grid grid-cols-2 gap-4`），放 4 张 `CandidateCard`。

**ActionBar**：
- 「重新发散」按钮（`RotateCcw` 图标）：对当前节点重新生成
- 「查看上下文」按钮（`Eye` 图标）：展开/折叠当前 context 摘要
- 生成中时显示「取消」按钮

### 5.6 NodeContent (`components/content/NodeContent.tsx`)

显示当前激活节点的完整内容。

- 根节点：显示用户问题，标记为"初始问题"
- 非根节点：顶部显示角度名称（Badge）+ rationale，下方显示完整 response（react-markdown 渲染）
- 固定最大高度 `max-h-[35vh]`，内容超出时使用 shadcn/ui `ScrollArea`

### 5.7 CandidateCard (`components/content/CandidateCard.tsx`)

**这是最复杂的组件**，因为要处理多种状态和 streaming。

状态机渲染：

| 状态 | 渲染内容 |
|------|---------|
| `empty` | 空白卡片，灰色虚线边框 |
| `loading` | shadcn `Skeleton` 脉冲动画（3 行） |
| `angle-ready` | 顶部显示角度名 + rationale，主体区域显示 Skeleton |
| `streaming` | 顶部显示角度名 + rationale，主体区域实时显示 Markdown 文本（react-markdown），底部不显示按钮 |
| `complete` | 顶部角度名 + rationale，主体完整回答（可滚动），底部「选择这个方向 →」按钮 |
| `error` | 错误信息 + 「重试」按钮 |

卡片结构：
```
┌─ Card ──────────────────────────┐
│ Badge: 角度名    (color coded)  │
│ 一句话 rationale（灰色小字）     │
│ ─────────────────────────────── │
│                                 │
│ 回答内容区（ScrollArea）         │
│ Markdown 渲染                   │
│ 支持 streaming 实时更新          │
│                                 │
│ ─────────────────────────────── │
│ [选择这个方向 →]    Button       │
└─────────────────────────────────┘
```

4 张卡片的角度名使用不同颜色标识（固定 4 色：蓝、绿、橙、紫）。

**性能注意**：streaming 期间 react-markdown 会频繁重渲染。使用 `React.memo` 包裹卡片组件，且只在 `streamedText` 变化时触发对应卡片的重渲染，不要让一张卡的 streaming 触发其他三张卡的重渲染。

### 5.8 NewSessionDialog (`components/session/NewSessionDialog.tsx`)

使用 shadcn/ui `Dialog` 组件。

内容：
- 标题："开始新探索"
- 问题输入：`Textarea`，placeholder "输入你想探索的问题..."，最少 5 字
- Skill 区域（默认折叠）：点击"添加背景偏好（可选）"展开一个 `Textarea`，placeholder 提供模板提示
- 底部：「开始」按钮

提交后：
1. 调用 `createSession(question, skill)` 创建 session + 根节点
2. 导航到探索界面
3. 自动触发第一次 diverge

### 5.9 SessionList (`components/session/SessionList.tsx`)

Session 列表页（应用首页）。

- 每个 session 一张卡片：标题 + 创建时间 + 节点数量
- 点击进入探索界面
- 删除按钮（带确认）
- 右上角「新建探索」按钮
- 空状态：提示文案 + 新建按钮

---

## 6. 路由

```typescript
// App.tsx
<BrowserRouter>
  <Routes>
    <Route path="/" element={<SessionList />} />
    <Route path="/session/:sessionId" element={<AppShell />} />
  </Routes>
</BrowserRouter>
```

只有两个页面：列表页和探索页。

---

## 7. 快捷键 (`hooks/useKeyboard.ts`)

在探索界面绑定以下快捷键：

| 快捷键 | 操作 | 条件 |
|--------|------|------|
| `1` `2` `3` `4` | 选择对应候选卡 | 卡片状态为 `complete` |
| `Backspace` | 跳转到父节点 | 当前节点不是根节点 |
| `r` | 重新发散 | 不在生成中 |
| `Escape` | 取消当前生成 | 正在生成中 |

使用 `useEffect` + `keydown` 事件监听实现。注意排除焦点在 input/textarea 时的情况。

---

## 8. 设计规范

### 8.1 整体风格

**审美方向**：干净的工具感。参考 Linear、Raycast 的设计语言。深色主题为主，浅色主题可选。

- 大量留白，紧凑的信息密度
- 无圆角滥用（按钮 `rounded-md`，卡片 `rounded-lg`，不要 `rounded-full`）
- 字体：系统字体栈（`font-sans`），中文标题可用思源黑体
- 主色调：中性灰 + 一个强调色
- 卡片不用阴影，用细边框（`border`）区分层级

### 8.2 候选卡颜色系统

4 张候选卡固定配色：
```
卡 0: blue   — bg-blue-500/10  text-blue-400   border-blue-500/30
卡 1: green  — bg-green-500/10 text-green-400  border-green-500/30
卡 2: orange — bg-orange-500/10 text-orange-400 border-orange-500/30
卡 3: purple — bg-purple-500/10 text-purple-400 border-purple-500/30
```

### 8.3 过渡动画

- 卡片状态切换：`transition-all duration-300`
- 候选卡出现：从下方滑入（`translate-y-2 → translate-y-0`），4 张依次延迟 `delay-0 delay-75 delay-150 delay-200`
- 树节点新增：淡入
- 节点切换：内容区域交叉淡入淡出

### 8.4 响应式

不做移动端适配。最小宽度 `min-w-[900px]`。左侧面板在窄屏时可折叠。

---

## 9. 完整数据流

用一个完整的用户场景串联：

```
用户打开应用 → SessionList 页面
  ↓
点击「新建探索」→ NewSessionDialog 弹出
  ↓
输入问题 "什么是意识的本质？"，跳过 skill → 点击「开始」
  ↓
1. createSession("什么是意识的本质？", "") → 创建 session + 根节点(depth=0)
2. 导航到 /session/:id
3. AppShell 加载 session 数据，activeNode = 根节点
4. 自动触发 diverge(session, rootNode)
  ↓
diverge 执行：
  a. phase='angles' → 4 张卡 loading 状态
  b. 并行发起：
     - generateAngles(skill="", context="", content="什么是意识的本质？")
     - contextPromise = 根节点，直接 resolve("什么是意识的本质？")
  c. angles 返回 4 个角度 → 4 张卡显示角度名和 rationale
  d. phase='responses' → 并行发起 4 个 streaming 请求
  e. 每张卡实时显示流入的文字
  f. 每个 streaming 完成时，保存节点到 DB（depth=1, parentId=rootId）
  g. phase='done' → 4 张卡显示「选择这个方向」按钮
  ↓
用户阅读 4 张卡，按下快捷键 `2` 选择第二张
  ↓
1. 获取第二张卡的 finalNodeId（节点已存在 DB）
2. setActiveNode(session.id, finalNodeId)
3. diverge(session, selectedNode) 触发新一轮
  ↓
diverge 执行：
  a. 并行：
     - compressContext(rootContext, angle, response) → 生成 context 摘要
     - generateAngles(skill, selectedNode.context, selectedNode.response)
  b. ...同上循环
  ↓
用户在 TreePanel 中点击根节点 → 跳转回根节点
  ↓
1. setActiveNode(session.id, rootId)
2. getChildren(session.id, rootId) → 找到之前的 4 个子节点
3. 展示为已完成的候选卡（不重新生成），显示「重新发散」按钮
  ↓
用户点击「重新发散」
  ↓
1. deleteChildren(session.id, rootId) → 递归删除所有子节点
2. diverge(session, rootNode) → 重新生成全新的 4 个方向
```

---

## 10. 错误处理

### API 调用失败

- 角度生成失败：整体失败，4 张卡都显示错误状态，显示全局「重试」按钮
- 单个回答生成失败：只有该卡片显示错误状态 + 单独「重试」按钮，其他 3 张卡正常
- 上下文压缩失败：使用父节点的 context 作为 fallback（不压缩，直接复用），不阻塞流程
- JSON 解析失败（角度生成返回非法 JSON）：重试一次，仍失败则显示错误

### 网络错误

- 断网：全局 toast 提示，所有生成中的请求标记为错误状态
- 超时：单个请求超过 30 秒视为超时，标记该卡片为错误状态

### 数据错误

- IndexedDB 写入失败：阻塞操作，显示错误信息，要求用户刷新

---

## 11. 实现顺序（建议给 CC 的 phase 指令）

### Phase 1：脚手架 + 数据层

```
初始化 Vite 项目，安装所有依赖，配置 Tailwind + shadcn/ui + path alias。
实现 types.ts 和 lib/db.ts（Dexie schema + 所有数据库操作函数）。
实现 lib/prompts.ts（所有 prompt 模板）。
实现 lib/ai.ts（API 调用封装，含 streaming 解析）。
写一个临时测试页面验证 API 调用能跑通。
```

### Phase 2：核心循环 UI

```
实现 NewSessionDialog：创建 session + 根节点。
实现 ContentPanel + NodeContent + CandidateCard（完整状态机）。
实现 useDiverge hook（完整发散流程）。
实现选择卡片 → 触发下一轮的流程。
此时应该能完成"输入问题 → 4 张卡 → 选一张 → 新的 4 张卡"的完整循环。
```

### Phase 3：树导航

```
实现 TreePanel：ReactFlow + dagre 布局 + 自定义节点。
实现 useTreeLayout hook。
实现节点点击跳转逻辑（有子节点 → 展示历史，无子节点 → 触发发散）。
实现 PathBreadcrumb。
实现重新发散功能。
```

### Phase 4：打磨

```
实现 SessionList 页面。
实现路由（react-router-dom）。
实现 useKeyboard 快捷键。
实现 Header（含 Skill 编辑 Dialog）。
添加 loading 动画、过渡效果、骨架屏。
错误处理 UI。
视觉打磨。
```
