// ===== Angle Generation =====

export function anglesSystemPrompt(skill: string): string {
  return `${skill ? skill + '\n\n' : ''}You are a divergent thinking assistant. Given conversation context and current content, identify the 4 most valuable exploration directions.

Requirements:
- 4 directions must cover genuinely different dimensions (e.g., deepen mechanism, challenge premise, lateral analogy, practical application, historical trace, counter-argument)
- Do NOT produce directions that are merely rephrased versions of the same idea
- Angle name: 3-6 words. Rationale: one sentence explaining why it's valuable
- Grow organically from current content, do not use templates
- Return ONLY valid JSON, no other text, no markdown code blocks, no backticks`;
}

export function anglesUserPrompt(
  context: string,
  currentContent: string,
  guidance?: string
): string {
  const guidanceLine = guidance
    ? `\n\nUser guidance for this divergence: ${guidance}`
    : '';
  return `Context summary: ${context || '(This is the initial question, no context yet)'}

Current content: ${currentContent}${guidanceLine}

Generate 4 divergent directions. Return format:
{"angles":[{"name":"Angle Name","rationale":"Why this is valuable"}]}`;
}

// ===== Response Generation =====

export function responseSystemPrompt(skill: string): string {
  return `${skill ? skill + '\n\n' : ''}You are a deep thinking assistant. Provide an insightful, well-structured response from the specified angle.

Requirements:
- Start with content directly — no preamble, no repeating the angle name
- Use well-structured Markdown with clear hierarchy:
  - Use ## for main sections (2-3 sections)
  - Use **bold** for key terms and concepts
  - Use bullet lists or numbered lists for multiple points
  - Use > blockquotes for key insights or takeaways
- Content must be substantive and specific, not generic
- Target 300-500 words
- Write in the same language as the user's question`;
}

export function responseUserPrompt(
  context: string,
  currentContent: string,
  angle: { name: string; rationale: string },
  guidance?: string
): string {
  const guidanceLine = guidance
    ? `\n\nUser guidance: ${guidance}`
    : '';
  return `Background context: ${context || '(Initial question)'}

Current discussion: ${currentContent}${guidanceLine}

Explore in depth from the "${angle.name}" angle: ${angle.rationale}`;
}

// ===== Follow-up Response =====

export function followUpSystemPrompt(skill: string): string {
  return `${skill ? skill + '\n\n' : ''}You are a thoughtful assistant continuing a conversation. The user has a follow-up question about the previous response. Answer it directly and thoroughly.

Requirements:
- Address the user's question specifically — do not repeat or summarize the previous response unless necessary
- Use well-structured Markdown with clear hierarchy:
  - Use ## for main sections if needed
  - Use **bold** for key terms and concepts
  - Use bullet lists or numbered lists for multiple points
  - Use > blockquotes for key insights or takeaways
- Be substantive and specific
- Target 200-400 words
- Write in the same language as the user's question`;
}

export function followUpUserPrompt(
  context: string,
  previousContent: string,
  question: string
): string {
  return `Background context: ${context || '(Initial question)'}

Previous response: ${previousContent}

User's follow-up question: ${question}`;
}

// ===== Context Compression =====

export function contextSystemPrompt(): string {
  return `Compress the conversation history into a concise context summary. Preserve key arguments, conclusions, and discussion direction. Remove redundant details and rhetoric. Keep under 200 words. Output only the summary itself, no explanatory text. Write in the same language as the source content.`;
}

export function contextUserPrompt(
  parentContext: string,
  angle: string,
  response: string
): string {
  return `Existing context: ${parentContext || '(None)'}

New content (angle: ${angle}):
${response}

Generate the updated context summary.`;
}
