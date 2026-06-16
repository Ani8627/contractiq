import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { buildChatContext } from '@/lib/context';
import { streamText } from '@/lib/gemini';
import { CHAT_SYSTEM_PROMPT } from '@/lib/prompts';
import type { ChatMessage } from '@/lib/types';

export const runtime = 'nodejs';

const bodySchema = z.object({
  contractId: z.string().uuid(),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1),
      }),
    )
    .min(1)
    .max(50),
});

export async function POST(request: NextRequest) {
  let body: { contractId: string; messages: ChatMessage[] };
  try {
    const raw = await request.json();
    body = bodySchema.parse(raw);
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid request body', detail: String(err) },
      { status: 400 },
    );
  }

  const { contractId, messages } = body;
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  if (!lastUser) {
    return NextResponse.json({ error: 'No user message found' }, { status: 400 });
  }

  // Build RAG context for the question
  const context = await buildChatContext(contractId, lastUser.content);

  const systemPrompt = `${CHAT_SYSTEM_PROMPT}\n\nCONTRACT ANALYSIS:\n${context}`;

  // Convert message history to Gemini format (exclude the last user message — it's sent as `user` in streamText)
  const historyMessages = messages.slice(0, -1);
  const history = historyMessages.map((m) => ({
    role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
    parts: [{ text: m.content }],
  }));

  // Stream response via native ReadableStream passthrough
  const encoder = new TextEncoder();
  const responseStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const delta of streamText({
          system: systemPrompt,
          user: lastUser.content,
          history,
        })) {
          controller.enqueue(encoder.encode(delta));
        }
      } catch (err) {
        console.error('[chat] Stream error:', err);
        controller.enqueue(
          encoder.encode('\n\n[Error: Failed to generate response]'),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(responseStream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
