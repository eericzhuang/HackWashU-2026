## Inspiration

I have a specific problem when talking to AI: I never know what to ask next.

Not at the start — the first question is easy. The problem is every step after that. I finish reading a response, and I freeze. There are a dozen directions I could go, but I can't commit to any of them. So I either ask something shallow and obvious, or I just close the tab.

This isn't writer's block. It's the paralysis of too many invisible options.

The model that changed my thinking was Stable Diffusion. You start from noise — pure, undirected potential — and the diffusion process gradually resolves it into something concrete. But crucially, you don't get one answer. You get a sample space. Multiple images, each a different resolution of the same latent possibility. You're not imagining what the output could look like; you're reacting to what it actually is.

I wanted that for conversation. Not a single response to evaluate, but a branching sample of directions — each a genuine resolution of where the thinking could go next. You read, you react, you pick. No blank cursor. No decision fatigue. Just forward momentum.

The goal wasn't to automate thinking. It was to make the next step always visible.

## What it does

Dialogue Divergence Tree turns a single question into an explorable tree of ideas.

You ask a question. The system generates **4 divergent angles simultaneously** — not minor rephrasings, but genuinely different dimensions of exploration (a counter-argument, a lateral analogy, a practical application, a deeper mechanism). Each angle comes with a full, streaming AI response. You read, compare, and pick the one that pulls you forward.

From there, you have two choices:
- **Diverge again** — the selected response becomes the new seed, and 4 fresh angles emerge from it
- **Follow up** — ask a targeted question for a linear deep-dive before branching

Every choice is preserved as a node in a visual tree. You can jump back to any branch, explore a path you skipped, or export your current trail as Markdown. Optional **steering prompts** let you nudge each divergence (e.g., "focus on policy implications"), and a **background/skill** setting tailors all responses to your expertise level.

The result is a persistent, navigable map of your thinking — not a flat chat log that scrolls into oblivion.

## How we built it

The entire application runs in the browser. There is no backend server.

The frontend is **React 18 + TypeScript + Vite**, styled with **Tailwind CSS** and **shadcn/ui** components. The tree visualization uses **@xyflow/react** with **dagre** for automatic layout. All conversation data is stored locally in **IndexedDB** via **Dexie.js** — nothing leaves your machine except the LLM API calls.

The core technical challenge was the 4-way parallel streaming architecture. When a user diverges, the system:

1. Sends a non-streaming request to generate 4 angle definitions (JSON)
2. Fires 4 **simultaneous streaming requests** via `Promise.allSettled`, each generating a full response for one angle
3. Parses SSE events in real-time, updating each card's state independently via isolated `setState` callbacks
4. Uses `React.memo` on card components so one card's streaming doesn't trigger re-renders on the other three

Context management was another key problem. As the tree grows deeper, naive approaches would either exceed token limits or lose conversational coherence. We implemented **recursive context compression** — at each depth level, the full conversation history is compressed into a ~200-word summary that preserves key arguments, conclusions, and discussion direction. This compressed context is passed to subsequent API calls, so the AI stays coherent 10 or 20 levels deep without ever hitting token ceilings.

The Vite dev server proxies all API requests, injecting the API key server-side so it never appears in frontend code. The system supports **Anthropic Claude, OpenRouter, Groq, and local Ollama** through a unified provider abstraction.

## Challenges we ran into

**SSE parsing across providers.** Anthropic's streaming format includes `event:` lines, empty lines, and occasional `error` events that don't follow the same structure as OpenAI-compatible providers. Building a parser that handles both cleanly — and fails gracefully on malformed chunks — took several iterations.

**State management during parallel streams.** Four simultaneous streams updating shared React state created subtle race conditions. Cancelling a diverge mid-stream while `onComplete` callbacks were still firing caused UI flickers. We solved this by tying each operation to an `AbortController` and checking signal state before committing state updates.

**Background diverge persistence.** We wanted users to click away to a different node while a diverge was still running, then come back to see the results. This required decoupling the diverge state from the displayed node — we track which node a diverge belongs to and compute a `displayState` via `useMemo` that dynamically shows either live streaming progress or completed results from the database, depending on which node is active.

**Context window budgeting.** Without compression, a tree that's 8 levels deep would exceed most models' context windows. But aggressive compression loses nuance. Finding the right prompt for the compression step — one that preserves argumentative structure while staying under 200 words — required careful prompt engineering and testing across different conversation types.

## Accomplishments that we're proud of

- **True parallel streaming** — 4 responses appear simultaneously, not sequentially. This is the core UX differentiator and it works reliably across providers.
- **Zero-backend architecture** — everything runs in the browser. IndexedDB for persistence, Vite proxy for API key injection. No server to deploy, no database to manage, no data privacy concerns.
- **The tree actually feels useful.** It's not a gimmick — after 3-4 levels of divergence, having a visual map of where you've been and where you haven't been yet genuinely changes how you think about the topic.
- **Follow-up + Diverge as complementary modes.** Linear follow-ups for depth, branching divergence for breadth. This combination covers the two fundamental moves in any intellectual exploration.

## What we learned

Conversation is not linear. The standard chat interface — a single thread scrolling downward — is a UI choice, not a natural law. When you give people a way to branch, compare, and backtrack, the way they interact with AI changes fundamentally. They ask bolder questions because the cost of a "wrong" direction is zero — the other branches are still there.

We also learned that **the hardest part of AI UX isn't the AI — it's the state management around it.** Streaming, cancellation, parallel requests, background persistence, context compression — the LLM call itself is one line of code. Everything around it is where the complexity lives.

## What's next for Dialogue Divergence Tree

- **Collaborative exploration** — multiple users building the same tree in real-time, each pursuing different branches
- **Cross-branch synthesis** — an AI-generated summary that identifies contradictions and convergences across different branches of the same tree
- **Semantic search** — find relevant nodes across all sessions by meaning, not just keywords
- **Exportable knowledge graphs** — turn a completed exploration tree into a structured document, presentation outline, or research brief
