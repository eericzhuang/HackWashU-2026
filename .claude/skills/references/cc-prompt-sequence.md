# CC Prompt 序列 — 按顺序喂给 Claude Code

每个 prompt 之间，先验证上一步的产物能跑（`npm run dev` 不报错），再继续。
预计总时间：10-14 小时（含调试和返工）。

---

## Prompt 1: 脚手架 ⏱ ~30min

```
读一下 .claude/skills/SKILL.md 和 references/spec.md 的 §1（项目初始化）。

帮我初始化项目：
1. 用 Vite 创建 React + TypeScript 项目
2. 安装 spec 里列出的所有依赖
3. 配置 Tailwind CSS（用 @tailwindcss/vite 插件）
4. 初始化 shadcn/ui，安装这些组件：button, card, dialog, input, textarea, scroll-area, skeleton, badge, tooltip, separator, tabs
5. 配置 tsconfig 的 path alias：@ → src/
6. 配置 vite.config.ts 的 proxy，把 /api/anthropic 转发到 https://api.anthropic.com，在 proxy headers 里注入 .env 中的 ANTHROPIC_API_KEY
7. 创建 .env 文件（带 ANTHROPIC_API_KEY 占位符）和 .env.example
8. 创建 src/types.ts，包含 spec §2.1 定义的所有类型

完成后跑一下 npm run dev 确认没有报错。
```

### 验证点
- `npm run dev` 启动正常
- `src/types.ts` 包含 TreeNode, Session, Angle, CardStatus, CandidateCardState, DivergeState

---

## Prompt 2: 数据层 + API 层 ⏱ ~1h

```
读一下 spec 的 §2（数据模型）和 §3（API 调用层）。

实现以下文件：

1. src/lib/db.ts — Dexie.js 数据库：
   - schema 定义（sessions 表、nodes 表，含复合索引 [sessionId+parentId]）
   - 所有 DB 操作函数：getChildren, getSessionNodes, getPathToNode, createSession, saveChildNode, setActiveNode, deleteChildren, updateNodeContext
   - 每个函数都要 export

2. src/lib/prompts.ts — 所有 prompt 模板：
   - anglesSystemPrompt(skill) / anglesUserPrompt(context, content)
   - responseSystemPrompt(skill) / responseUserPrompt(context, content, angle)
   - contextSystemPrompt() / contextUserPrompt(parentContext, angle, response)
   - 严格按 spec 的 prompt 内容实现

3. src/lib/ai.ts — Anthropic API 封装：
   - streamMessage(system, userMessage, callbacks, signal) — SSE streaming 调用
   - sendMessage(system, userMessage, signal) — 非 streaming 调用
   - generateAngles(skill, context, currentContent, signal) — 返回 AnglesResponse
   - generateResponse(skill, context, currentContent, angle, callbacks, signal) — streaming
   - compressContext(parentContext, angle, response, signal) — 返回 string
   - API 地址固定用 /api/anthropic/v1/messages
   - SSE 解析逻辑：按换行分割，过滤 data: 开头的行，JSON.parse 后根据 type 字段处理 content_block_delta（提取 delta.text）和 message_stop

4. src/lib/tree-utils.ts — 树操作工具函数：
   - getNodeContent(node) — 统一获取节点内容文本（根节点返回 userQuestion，非根返回 response）
   - getNodeLabel(node) — 获取节点显示标签（角度名或问题前 15 字）
   - getAncestorPath(allNodes, targetId) — 从根到目标节点的路径
   - toReactFlowGraph(nodes, activeNodeId) — 转换为 ReactFlow nodes + edges
   - layoutTree(rfNodes, rfEdges) — dagre 自动布局（方向 TB，nodesep: 30, ranksep: 60）

完成后不需要 UI，但可以在 main.tsx 里写个临时测试：调用 createSession 确认 IndexedDB 能写入。
```

### 验证点
- 4 个 lib 文件（db.ts, prompts.ts, ai.ts, tree-utils.ts）都存在且无 TS 报错
- 在浏览器 console 手动调 `createSession` 能在 IndexedDB 看到数据
- tree-utils.ts 的 `getNodeLabel` / `getAncestorPath` 逻辑正确（后续 Prompt 4 依赖）

---

## Prompt 3: 核心循环 — useDiverge + 候选卡 ⏱ ~2-3h

```
读一下 spec 的 §4.1（发散流程）和 §5.5-5.7（ContentPanel, NodeContent, CandidateCard）。

这是最核心的部分。实现：

1. src/hooks/useDiverge.ts — 发散流程 hook：
   - 管理 DivergeState（phase, cards[], error）
   - diverge(session, currentNode) 函数：并行执行 context 压缩 + 角度生成 → 然后并行 streaming 4 个回答
   - cancel() 函数：通过 AbortController 取消
   - 每个 card 的状态独立更新，streaming 时实时追加 streamedText
   - streaming 完成后自动 saveChildNode 到 DB

2. src/components/content/CandidateCard.tsx — 候选卡组件：
   - 接收 CandidateCardState + onSelect 回调
   - 完整实现状态机渲染：empty → loading(skeleton) → angle-ready → streaming(react-markdown) → complete(选择按钮) → error(重试按钮)
   - 用 React.memo 包裹，避免其他卡的 streaming 触发重渲染
   - 4 张卡的颜色编码：blue/green/orange/purple

3. src/components/content/NodeContent.tsx — 当前节点内容：
   - 根节点显示问题，非根节点显示角度 badge + rationale + response（react-markdown）
   - max-h-[35vh]，内部 ScrollArea

4. src/components/content/ContentPanel.tsx — 右侧面板：
   - 上方 NodeContent，下方 2×2 CandidateCard 网格
   - 底部 ActionBar：重新发散按钮、查看上下文按钮
   - 选择卡片后：setActiveNode → 触发新一轮 diverge

5. 一个临时的入口页面（直接在 App.tsx 里）：
   - 一个 textarea 输入问题 + 开始按钮
   - 点击后创建 session，展示 ContentPanel，自动触发第一次 diverge
   - 不需要路由，不需要 SessionList，不需要 TreePanel
   - 能完整跑通"输入 → 4 张卡 streaming → 选一张 → 新的 4 张卡"就算成功

重点：streaming 必须是 4 路并行，卡片同时开始显示内容。如果只有一张卡在动其他三张在等，说明是串行了，需要修。
```

### 验证点
- 输入问题后 4 张卡同时开始 streaming
- 选择一张卡后自动触发新一轮
- 每张卡的 loading/streaming/complete 状态转换正确
- 已生成的节点能在 IndexedDB 中看到

**⚠️ 这是最容易出 bug 的一步。常见问题：**
- SSE 解析出错（Anthropic 的 SSE 格式有时带空行或 `event:` 行，解析时要容错）
- streaming 状态更新导致整个列表重渲染（确认用了 React.memo）
- `Promise.allSettled` 的某一个 reject 了但没被 catch

**完成这步后停下来仔细测试，确认循环跑通了再继续。**

---

## Prompt 4: 树面板 ⏱ ~2-3h

```
读一下 spec 的 §5.3-5.4（TreePanel, PathBreadcrumb）和 §4.2-4.3（选择/跳转流程）。

现在核心循环能跑了，加上左侧的树导航：

1. src/hooks/useTreeLayout.ts — ReactFlow 布局 hook：
   - 接收 TreeNode[] 和 activeNodeId
   - 调用 Prompt 2 已实现的 toReactFlowGraph + layoutTree（来自 lib/tree-utils.ts）
   - 当前节点高亮，祖先路径半高亮

2. src/components/tree/TreeNode.tsx — ReactFlow 自定义节点：
   - 显示角度名 + response 前 15 字预览
   - 根节点显示"起始问题" + 问题前 15 字
   - 固定宽度 160px
   - active 节点高亮样式，祖先节点半高亮样式

3. src/components/tree/PathBreadcrumb.tsx — 路径面包屑：
   - 显示根 → 当前的线性路径
   - 每个节点可点击跳转
   - 超过 4 个节点只显示前 1 + ... + 后 2

4. src/components/tree/TreePanel.tsx — 左侧面板：
   - 上方 ReactFlow（fitView，缩放/平移，自定义节点）
   - 下方 PathBreadcrumb
   - 点击节点触发跳转

5. src/components/layout/AppShell.tsx — 主布局：
   - 左侧 TreePanel（w-[280px]），右侧 ContentPanel（flex-1）
   - 全屏高度 h-screen

6. 更新 App.tsx：
   - 新建 session 后进入 AppShell
   - 实现节点跳转逻辑：有子节点 → 展示历史，无子节点 → 触发发散
   - 实现重新发散：deleteChildren → 重新 diverge

重点：每次 activeNodeId 变化时，ReactFlow 要自动 fitView 到当前节点。dagre 布局在节点增减时要重新计算。
```

### 验证点
- 左侧树正确显示所有已探索的节点和连线
- 点击历史节点能跳转，已有子节点直接展示
- 从历史节点重新发散能正常工作
- 树在新节点添加后自动更新布局

---

## Prompt 5: 完整流程 + 路由 ⏱ ~1-2h

```
现在把临时入口替换成正式的页面结构：

1. src/components/session/NewSessionDialog.tsx：
   - shadcn Dialog 组件
   - 问题 Textarea（必填）+ Skill Textarea（折叠式可选）
   - 提交后创建 session + 根节点，导航到探索页

2. src/components/session/SessionList.tsx：
   - 列出所有 session（useLiveQuery 从 Dexie 查）
   - 每个 session 一张卡：标题 + 时间 + 节点数
   - 点击进入，删除带确认
   - 空状态引导
   - 右上角新建按钮触发 NewSessionDialog

3. src/components/layout/Header.tsx：
   - 左侧：返回 SessionList 的按钮 + session 标题
   - 右侧：Skill 编辑按钮（Dialog + Textarea）

4. src/App.tsx — 路由：
   - / → SessionList
   - /session/:sessionId → AppShell
   - 用 react-router-dom

5. src/hooks/useKeyboard.ts — 快捷键：
   - 1234 选卡、Backspace 回父节点、r 重发散、Escape 取消
   - 焦点在 input/textarea 时忽略
```

### 验证点
- 完整流程：列表 → 新建 → 探索 → 返回列表
- 多个 session 能独立存在
- 快捷键在探索页正常工作

---

## Prompt 6: 视觉打磨 ⏱ ~2h

```
现在功能都有了，做视觉打磨。这是 hackathon demo，外观很重要。

1. 整体暗色主题：
   - 背景用深灰（不要纯黑），卡片用稍浅的灰
   - 文字层次分明：标题白色，正文浅灰，次要信息更淡
   - 强调色用于 active 状态和交互元素

2. 候选卡动画：
   - 从下方滑入（translate-y-2 → 0），4 张依次延迟
   - Streaming 时文字淡入效果
   - 选择后卡片有简短的高亮反馈

3. 树面板美化：
   - ReactFlow 节点样式统一到暗色主题
   - 连线颜色柔和
   - 当前路径连线高亮

4. Loading 状态：
   - 候选卡 skeleton 脉冲要有节奏感
   - 角度名出现时要有淡入
   - 全局 loading 时有 subtle 的进度指示

5. 细节：
   - 按钮 hover 状态
   - 卡片 hover 微微上浮
   - 面包屑的箭头样式
   - 空状态页面的设计

目标：看起来像一个正式产品的 beta 版，不像课程作业。参考 Linear 或 Raycast 的设计感。
```

---

## 时间分配建议（1.5 天 ≈ 14-16 小时可用）

| 步骤 | 预计时间 | 重要度 |
|------|---------|--------|
| Prompt 1: 脚手架 | 30min | 必须 |
| Prompt 2: 数据+API层 | 1-1.5h | 必须 |
| Prompt 3: 核心循环 | 2-3h（含调试） | **最核心** |
| 调试+修bug | 1-2h | 必须 |
| Prompt 4: 树面板 | 2-3h | 必须 |
| Prompt 5: 路由+完整流程 | 1-2h | 建议 |
| Prompt 6: 视觉打磨 | 2h | 加分 |
| 最终测试+修bug | 1-2h | 必须 |
| **总计** | **~12-16h** | |

**如果时间不够，砍掉顺序**：Prompt 6（打磨）→ Prompt 5 中的快捷键 → SessionList（直接硬编码一个 session）

**绝对不能砍**：Prompt 1-4。这四步完成后你就有一个可 demo 的产品了。
