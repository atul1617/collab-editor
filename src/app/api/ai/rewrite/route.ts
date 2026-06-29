import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const RewriteSchema = z.object({
  text: z.string().min(5).max(5000),
  tone: z.enum(['formal', 'casual', 'concise', 'detailed']).default('formal'),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = RewriteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const toneInstructions = {
    formal: 'Rewrite in a professional, formal tone suitable for business documents.',
    casual: 'Rewrite in a friendly, conversational tone.',
    concise: 'Rewrite to be as concise as possible while keeping all key information.',
    detailed: 'Rewrite with more detail and explanation.',
  };

  const stream = await client.chat.completions.create({
    model: 'gpt-4o',
    stream: true,
    max_tokens: 1000,
    messages: [
      {
        role: 'system',
        content: `You are a writing assistant. ${toneInstructions[parsed.data.tone]} Only return the rewritten text — no explanations, no preamble.`,
      },
      {
        role: 'user',
        content: parsed.data.text,
      },
    ],
  });

  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? '';
        if (text) {
          controller.enqueue(new TextEncoder().encode(text));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  });
}