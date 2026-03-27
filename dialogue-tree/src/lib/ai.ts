import type { Angle, AnglesResponse, StreamCallbacks } from '@/types';
import {
  anglesSystemPrompt,
  anglesUserPrompt,
  responseSystemPrompt,
  responseUserPrompt,
  contextSystemPrompt,
  contextUserPrompt,
} from '@/lib/prompts';

// Exposed to client via VITE_ prefix
const PROVIDER = import.meta.env.VITE_LLM_PROVIDER || 'anthropic';
const MODEL = import.meta.env.VITE_LLM_MODEL || 'claude-sonnet-4-20250514';

// API path based on provider
const API_URL =
  PROVIDER === 'anthropic'
    ? '/api/llm/v1/messages'
    : '/api/llm/v1/chat/completions';

// ==================== Request Body Builder ====================

function buildBody(
  system: string,
  userMessage: string,
  stream: boolean
): string {
  if (PROVIDER === 'anthropic') {
    return JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      stream,
      system,
      messages: [{ role: 'user', content: userMessage }],
    });
  }
  // OpenAI-compatible (OpenRouter / Groq / Together / Ollama etc.)
  return JSON.stringify({
    model: MODEL,
    max_tokens: 1024,
    stream,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userMessage },
    ],
  });
}

// ==================== SSE Parsing ====================

function parseAnthropicSSE(
  line: string,
  state: { fullText: string },
  callbacks: StreamCallbacks
): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data: ')) return false;
  const data = trimmed.slice(6);
  if (data === '[DONE]') return true;

  try {
    const event = JSON.parse(data);
    if (event.type === 'content_block_delta' && event.delta?.text) {
      state.fullText += event.delta.text;
      callbacks.onChunk(event.delta.text);
    } else if (event.type === 'message_stop') {
      return true;
    } else if (event.type === 'error') {
      throw new Error(event.error?.message ?? 'Stream error');
    }
  } catch (e) {
    if (e instanceof SyntaxError) return false;
    throw e;
  }
  return false;
}

function parseOpenAISSE(
  line: string,
  state: { fullText: string },
  callbacks: StreamCallbacks
): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data: ')) return false;
  const data = trimmed.slice(6);
  if (data === '[DONE]') return true;

  try {
    const event = JSON.parse(data);
    const delta = event.choices?.[0]?.delta?.content;
    if (delta) {
      state.fullText += delta;
      callbacks.onChunk(delta);
    }
    if (event.choices?.[0]?.finish_reason) {
      return true;
    }
  } catch (e) {
    if (e instanceof SyntaxError) return false;
    throw e;
  }
  return false;
}

// ==================== Core API Calls ====================

export async function streamMessage(
  system: string,
  userMessage: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: buildBody(system, userMessage, true),
    signal,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error ${response.status}: ${text}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const state = { fullText: '' };
  let buffer = '';
  const parseSSE =
    PROVIDER === 'anthropic' ? parseAnthropicSSE : parseOpenAISSE;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const finished = parseSSE(line, state, callbacks);
        if (finished) break;
      }
    }
    callbacks.onComplete(state.fullText);
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    callbacks.onError(err as Error);
  }
}

export async function sendMessage(
  system: string,
  userMessage: string,
  signal?: AbortSignal
): Promise<string> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: buildBody(system, userMessage, false),
    signal,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error ${response.status}: ${text}`);
  }

  const data = await response.json();

  if (PROVIDER === 'anthropic') {
    return data.content[0].text;
  }
  // OpenAI-compatible
  return data.choices[0].message.content;
}

// ==================== Utility Functions ====================

function extractJSON(text: string): string {
  // Strip markdown code block wrappers: ```json ... ``` or ``` ... ```
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) return match[1].trim();
  // Try to find a raw JSON object
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0];
  return text.trim();
}

// ==================== Business Logic ====================

export async function generateAngles(
  skill: string,
  context: string,
  currentContent: string,
  signal?: AbortSignal
): Promise<AnglesResponse> {
  const text = await sendMessage(
    anglesSystemPrompt(skill),
    anglesUserPrompt(context, currentContent),
    signal
  );

  try {
    return JSON.parse(extractJSON(text)) as AnglesResponse;
  } catch {
    // Retry once
    const retry = await sendMessage(
      anglesSystemPrompt(skill),
      anglesUserPrompt(context, currentContent),
      signal
    );
    return JSON.parse(extractJSON(retry)) as AnglesResponse;
  }
}

export async function generateResponse(
  skill: string,
  context: string,
  currentContent: string,
  angle: Angle,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  await streamMessage(
    responseSystemPrompt(skill),
    responseUserPrompt(context, currentContent, angle),
    callbacks,
    signal
  );
}

export async function compressContext(
  parentContext: string,
  nodeAngle: string,
  nodeResponse: string,
  signal?: AbortSignal
): Promise<string> {
  return sendMessage(
    contextSystemPrompt(),
    contextUserPrompt(parentContext, nodeAngle, nodeResponse),
    signal
  );
}
