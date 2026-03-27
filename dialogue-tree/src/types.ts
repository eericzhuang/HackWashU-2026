// ==================== Core Data Types ====================

export interface TreeNode {
  id: string;                     // crypto.randomUUID()
  sessionId: string;
  parentId: string | null;        // null = root node

  // Content fields
  angle: string | null;           // Angle name, 3-6 words. Root = null
  rationale: string | null;       // Why this angle is valuable. Root = null
  response: string | null;        // AI full response. Root = null
  userQuestion: string | null;    // User question. Only root has value

  // Context
  context: string;                // Compressed context summary. Root = ""

  // Metadata
  depth: number;                  // 0 = root node
  createdAt: number;              // Date.now()
}

export interface Session {
  id: string;
  title: string;                  // First 30 chars of initial question
  rootId: string;
  activeNodeId: string;           // Currently active node ID
  skill: string;                  // User background/preferences, can be ""
  createdAt: number;
  updatedAt: number;
}

// ==================== AI Types ====================

export interface Angle {
  name: string;                   // Angle name, 3-6 words
  rationale: string;              // Why it's valuable, one sentence
}

export interface AnglesResponse {
  angles: Angle[];                // Fixed 4 angles
}

export interface StreamCallbacks {
  onChunk: (text: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
}

// ==================== UI State Types ====================

export type CardStatus =
  | 'empty'
  | 'loading'
  | 'angle-ready'
  | 'streaming'
  | 'complete'
  | 'error';

export interface CandidateCardState {
  index: number;                  // 0-3
  status: CardStatus;
  angle: Angle | null;
  streamedText: string;           // Accumulated streaming text
  finalNodeId: string | null;     // Saved node ID after completion
  error: string | null;
}

export interface DivergeState {
  isRunning: boolean;
  phase: 'idle' | 'preparing' | 'angles' | 'responses' | 'done' | 'error';
  cards: CandidateCardState[];    // Fixed 4 cards
  error: string | null;
}
