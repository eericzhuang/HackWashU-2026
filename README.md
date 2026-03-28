# Dialogue Divergence Tree

A local-first web app for tree-structured AI conversation exploration. Ask a question, AI generates 4 divergent angles with full responses, pick one, and repeat — building a tree of ideas. You can also ask follow-up questions at any point for linear deep-dives.

Built for HackWashU 2026.

## Tech Stack

React 18 + TypeScript + Vite, Tailwind CSS + shadcn/ui, Dexie.js (IndexedDB), @xyflow/react (tree visualization), Anthropic API (or any OpenAI-compatible provider).

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- An API key from one of: Anthropic, OpenRouter, Groq, or a local Ollama instance

### Install

```bash
git clone https://github.com/eericzhuang/HackWashU-2026.git
cd HackWashU-2026/dialogue-tree
npm install
```

### Configure API Key

Copy the example env file and fill in your API key:

```bash
cp .env.example .env
```

Edit `.env` — pick one provider and uncomment/fill in the relevant lines:

**Option A: Anthropic (recommended)**
```env
LLM_PROVIDER=anthropic
VITE_LLM_PROVIDER=anthropic
LLM_API_KEY=sk-ant-your-key-here
LLM_BASE_URL=https://api.anthropic.com
VITE_LLM_MODEL=claude-sonnet-4-20250514
```

**Option B: OpenRouter**
```env
LLM_PROVIDER=openai
VITE_LLM_PROVIDER=openai
LLM_API_KEY=sk-or-your-key-here
LLM_BASE_URL=https://openrouter.ai/api
VITE_LLM_MODEL=anthropic/claude-sonnet-4-20250514
```

**Option C: Groq (free tier)**
```env
LLM_PROVIDER=openai
VITE_LLM_PROVIDER=openai
LLM_API_KEY=gsk_your-key-here
LLM_BASE_URL=https://api.groq.com/openai
VITE_LLM_MODEL=llama-3.3-70b-versatile
```

**Option D: Local Ollama (no API key needed)**
```env
LLM_PROVIDER=openai
VITE_LLM_PROVIDER=openai
LLM_API_KEY=ollama
LLM_BASE_URL=http://localhost:11434
VITE_LLM_MODEL=qwen2.5:14b
```

> The API key never leaves your machine. Vite's dev server proxies all requests to the LLM provider, injecting the key server-side.

### Run

run start.bat

OR

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

## How It Works

1. **Create an exploration** — type a question to start
2. **Diverge** — AI generates 4 different angles, each with a full response. Cards stream in parallel.
3. **Pick a direction** — click a card to expand the full response, then select it to go deeper
4. **Repeat** — from any node, diverge again into 4 new angles
5. **Follow up** — instead of diverging, type a follow-up question for a focused linear response
6. **Navigate** — click any node in the tree to jump to it. The tree preserves all branches.

### The Tree

The left panel shows your exploration as a tree. The root is your initial question, branches are diverge directions, and linear nodes marked `Q:` are follow-ups. Click any node to view its content. The active node is highlighted in blue.

### Background / Skill

Click the gear icon to set a "Background / Skill" prompt — this is prepended to all AI calls to tailor responses (e.g., "I'm a graduate student in economics" or "Explain things simply with analogies").

### Per-Diverge Guidance

Before diverging, expand "Steer this divergence" to add optional guidance that applies only to that specific diverge (e.g., "Focus on practical applications" or "Challenge this assumption").

### Export

Click the download icon in the tree panel to export the current path (root to active node) as a Markdown file.

## Keyboard Shortcuts

These shortcuts work when no input field is focused:

| Key | Action |
|-----|--------|
| `1` `2` `3` `4` | Select the corresponding card (when cards are complete) |
| `Backspace` | Navigate to parent node |
| `R` | Re-diverge from current node |
| `Escape` | Cancel a running diverge |

## Data Storage

All data is stored locally in your browser via IndexedDB (Dexie.js). Nothing is sent to any server other than the LLM API calls. Clearing browser data will delete all sessions.

## Project Structure

```
src/
  components/
    content/       # ContentPanel, CandidateCard, NodeContent
    layout/        # AppShell, Header
    session/       # SessionList, NewSessionDialog
    tree/          # TreePanel, TreeNodeComponent, PathBreadcrumb
    ui/            # shadcn/ui components
  hooks/           # useDiverge, useFollowUp, useKeyboard, useTheme, useTreeLayout
  lib/             # ai.ts, db.ts, prompts.ts, tree-utils.ts
  pages/           # ExplorationPage
```
