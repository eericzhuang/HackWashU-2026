# Dialogue Divergence Tree

## Project Context
A hackathon project. A local-first React app for tree-structured AI conversation exploration. Users ask a question, AI generates 4 divergent angles with full responses, user picks one, cycle repeats. Full spec in `.claude/skills/dialogue-tree/references/spec.md`.

## Tech Stack (locked — do not change or suggest alternatives)
- React 18 + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- Dexie.js (IndexedDB)
- @xyflow/react (ReactFlow) + dagre
- Anthropic API via Vite dev server proxy
- react-markdown + lucide-react

## Coding Rules

### Always
- Use TypeScript strict mode. No `any` types.
- Import from `@/` path alias (maps to `src/`).
- Use `crypto.randomUUID()` for IDs.
- Use `Date.now()` for timestamps (not ISO strings).
- Functional components only. No class components.
- Use shadcn/ui components for buttons, cards, dialogs, inputs, etc.
- Tailwind utility classes only. No inline styles, no CSS files.
- Handle loading and error states for every async operation.
- All API calls must accept an `AbortSignal` parameter.

### Never
- Do NOT create an Express/Node backend. Everything runs in the browser.
- Do NOT use localStorage or sessionStorage. Use Dexie.js (IndexedDB).
- Do NOT use D3.js. Use @xyflow/react for tree visualization.
- Do NOT install new dependencies without asking me first.
- Do NOT put API keys in frontend code. They go in `.env` and are injected by Vite proxy.
- Do NOT use `useEffect` for data fetching — use Dexie's `useLiveQuery` hook instead.
- Do NOT create files outside the file structure defined in the skill. Ask before adding new directories.

### Streaming
- Anthropic streaming goes through `/api/anthropic/v1/messages` (Vite proxy).
- Parse SSE manually: split by newlines, filter `data: ` lines, JSON.parse, extract `content_block_delta` → `delta.text`.
- 4 response streams run in parallel via `Promise.allSettled`. Never serial.
- Each stream updates only its own card's state. Use `React.memo` to prevent cross-card re-renders.

### Style
- Dark theme. Clean, tool-like aesthetic. Reference: Linear, Raycast.
- Card colors: blue (0), green (1), orange (2), purple (3) — see skill for exact Tailwind classes.
- Buttons `rounded-md`, cards `rounded-lg`. No `rounded-full` on containers.
- Markdown responses rendered via `react-markdown`.

## When I Say...
- "跑一下" / "试试" → Run `npm run dev` and check for errors
- "下一步" → Move to the next phase in implementation order (see skill §Implementation Order)
- "修 UI" / "改样式" → Only touch Tailwind classes and component layout, don't refactor logic
- "重构" → Refactor logic but keep all existing functionality working
