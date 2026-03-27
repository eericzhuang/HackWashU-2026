---
name: dialogue-tree
description: >
  Project skill for the Dialogue Divergence Tree app — a React + TypeScript + Vite single-page application
  that lets users explore topics through AI-generated branching conversations. Use this skill whenever
  implementing components, hooks, API calls, data models, or any code in this project. Also use when
  the user asks about project architecture, file structure, naming conventions, or design decisions.
  Trigger on any mention of: nodes, sessions, diverge, candidate cards, tree panel, angles, context chain,
  streaming, ReactFlow, Dexie, or any component/hook/file name from the project structure.
---

# Dialogue Divergence Tree — Project Skill

## What This Project Is

A local-first web app for tree-structured AI conversations. The user asks an initial question, the AI generates 4 divergent exploration angles with full responses, the user picks one, and the cycle repeats — building a navigable tree of ideas. Users can backtrack to any node and branch off in new directions.

**Read `references/spec.md` for the full implementation spec before writing any substantial code.**

## Architecture — Non-Negotiable Decisions

- **Single-page Vite + React + TypeScript app. No Express backend. No SSR.**
- **Data in IndexedDB via Dexie.js. No SQLite, no localStorage.**
- **API calls go through Vite dev server proxy (`/api/anthropic` → `https://api.anthropic.com`). API key lives in `.env`, injected via proxy headers. Frontend never touches the key.**
- **Tree visualization uses `@xyflow/react` (ReactFlow) + dagre layout. Not D3.**
- **Styling: Tailwind CSS + shadcn/ui. No CSS modules, no styled-components.**

## File Structure

```
src/
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx           # Top-level layout: header + left/right split
│   │   └── Header.tsx             # Top bar: session title, nav buttons
│   ├── tree/
│   │   ├── TreePanel.tsx          # Left panel: ReactFlow tree + breadcrumb
│   │   ├── TreeNode.tsx           # Custom ReactFlow node component
│   │   └── PathBreadcrumb.tsx     # Root → current linear path
│   ├── content/
│   │   ├── ContentPanel.tsx       # Right panel: current content + candidate cards
│   │   ├── NodeContent.tsx        # Active node's full content display
│   │   └── CandidateCard.tsx      # Single candidate card (streaming state machine)
│   ├── session/
│   │   ├── SessionList.tsx        # Session list page
│   │   └── NewSessionDialog.tsx   # Create new session dialog
│   └── ui/                        # shadcn/ui components
├── lib/
│   ├── ai.ts                      # Anthropic API: streaming + non-streaming calls
│   ├── prompts.ts                 # All prompt templates (angles, response, context)
│   ├── db.ts                      # Dexie schema + all DB operations
│   └── tree-utils.ts              # Tree traversal, ReactFlow conversion, layout
├── hooks/
│   ├── useSession.ts              # Current session state
│   ├── useDiverge.ts              # Diverge flow orchestration (THE core hook)
│   ├── useTreeLayout.ts           # ReactFlow nodes/edges computation
│   └── useKeyboard.ts             # Keyboard shortcuts
├── types.ts                       # All TypeScript types
├── App.tsx                        # Router entry
└── main.tsx                       # App entry
```

**When creating a new file, place it according to this structure. Do not invent new directories.**

## Core Data Types

```typescript
interface TreeNode {
  id: string;                     // crypto.randomUUID()
  sessionId: string;
  parentId: string | null;        // null = root
  angle: string | null;           // root = null
  rationale: string | null;       // root = null
  response: string | null;        // root = null
  userQuestion: string | null;    // only root has this
  context: string;                // compressed context chain; root = ""
  depth: number;                  // 0 = root
  createdAt: number;              // Date.now()
}

interface Session {
  id: string;
  title: string;                  // first 30 chars of initial question
  rootId: string;
  activeNodeId: string;
  skill: string;                  // user background/preferences, can be ""
  createdAt: number;
  updatedAt: number;
}
```

**No `children` array on nodes — derive via `parentId` query. No `isActive` on nodes — use `session.activeNodeId`. No `tokenEstimate`. No soft-delete flags.**

## Candidate Card State Machine

```
empty → loading → angle-ready → streaming → complete
                                          → error
```

```typescript
type CardStatus = 'empty' | 'loading' | 'angle-ready' | 'streaming' | 'complete' | 'error';

interface CandidateCardState {
  index: number;          // 0-3
  status: CardStatus;
  angle: Angle | null;
  streamedText: string;   // accumulates during streaming
  finalNodeId: string | null;
  error: string | null;
}
```

## Diverge Flow — The Core Loop

This is the most critical piece. **Read `references/spec.md` §4.1 for full pseudocode.**

```
User selects a node (or initial question submitted)
  → Parallel:
      ├── Context compression (skip if root or context exists)
      └── Step 1: Generate 4 angles (1 API call, non-streaming, JSON response)
  → Both complete
  → Step 2: Generate 4 responses IN PARALLEL (4 API calls, all streaming)
  → 4 cards stream content simultaneously
  → Each card saves node to DB on completion
  → User picks one → repeat
```

**Responses MUST be parallel, not serial. Anthropic's rate limit allows it. Serial generation means ~24s wait; parallel means ~8s.**

## API Layer Rules

- All API calls go to `/api/anthropic/v1/messages` (Vite proxy handles auth).
- Model: `claude-sonnet-4-20250514`
- Angle generation: non-streaming, parse JSON from response. Include `"只返回 JSON"` in system prompt.
- Response generation: streaming via SSE. Parse `content_block_delta` events for incremental text.
- Context compression: non-streaming, plain text response.
- All calls accept an `AbortSignal` for cancellation.
- **Read `references/spec.md` §3 for exact prompt templates and SSE parsing details.**

## ReactFlow Tree Rules

- Use dagre for automatic layout: direction `TB`, `nodesep: 30`, `ranksep: 60`.
- Custom node component (`TreeNode.tsx`): fixed width 160px, shows angle name + 15-char preview.
- Active node: highlighted border + background. Ancestor path: semi-highlighted.
- Auto `fitView` on active node change.
- Clicking a node → sets it as active → shows existing children OR triggers diverge.

## Styling Conventions

- Dark theme primary. Clean, tool-like aesthetic (Linear/Raycast reference).
- 4 candidate cards use fixed color coding:
  - Card 0: blue (`bg-blue-500/10 text-blue-400 border-blue-500/30`)
  - Card 1: green (`bg-green-500/10 text-green-400 border-green-500/30`)
  - Card 2: orange (`bg-orange-500/10 text-orange-400 border-orange-500/30`)
  - Card 3: purple (`bg-purple-500/10 text-purple-400 border-purple-500/30`)
- Buttons: `rounded-md`. Cards: `rounded-lg`. Never `rounded-full` on containers.
- Use `lucide-react` for icons.
- Animations: `transition-all duration-300`. Cards stagger in with `delay-75` increments.

## Keyboard Shortcuts

| Key | Action | Condition |
|-----|--------|-----------|
| `1` `2` `3` `4` | Select corresponding card | Card status = `complete` |
| `Backspace` | Jump to parent node | Not at root |
| `r` | Re-diverge current node | Not generating |
| `Escape` | Cancel current generation | Generating |

Ignore shortcuts when focus is in `input` or `textarea`.

## Error Handling Rules

- Angle generation fails → all 4 cards show error → global retry button.
- Single response fails → only that card shows error + retry → other 3 cards unaffected.
- Context compression fails → fallback to parent's context (don't block).
- JSON parse error on angles → retry once automatically, then show error.
- DB write fails → block and show error, data integrity first.

## Implementation Order

When the user asks to build this project, follow this order:

1. **Scaffold**: Vite + deps + Tailwind + shadcn/ui + path alias + Vite proxy
2. **Data layer**: `types.ts`, `lib/db.ts`, `lib/prompts.ts`, `lib/ai.ts`
3. **Core loop UI**: `NewSessionDialog`, `ContentPanel`, `CandidateCard`, `useDiverge`
4. **Tree navigation**: `TreePanel`, `TreeNode`, `useTreeLayout`, node jumping
5. **Polish**: `SessionList`, routing, `useKeyboard`, `Header`, animations, error UI

## References

For detailed specifications on any topic below, read the corresponding section in `references/spec.md`:

| Topic | Section |
|-------|---------|
| Project init, deps, Vite proxy | §1 |
| Data model, Dexie schema, DB operations | §2 |
| API calls, SSE parsing, streaming | §3 |
| Diverge flow pseudocode, select/jump/re-diverge logic | §4 |
| All component designs and props | §5 |
| Routing | §6 |
| Keyboard shortcuts | §7 |
| Visual design spec | §8 |
| End-to-end data flow walkthrough | §9 |
| Error handling matrix | §10 |
| Implementation phases | §11 |
