import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getCurrentTeamMember } from '@/lib/admin-auth';

const client = new Anthropic();

const LANG_NAMES: Record<string, string> = {
  en: 'English',
  pt: 'Brazilian Portuguese',
};

export async function POST(req: NextRequest) {
  const member = await getCurrentTeamMember();
  if (member?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { text, targetLang } = body as { text?: string; targetLang?: string };
  if (!text || !targetLang || !LANG_NAMES[targetLang]) {
    return NextResponse.json({ error: 'Faltan campos: text, targetLang (en|pt)' }, { status: 400 });
  }

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Translate the following Spanish tourism text to ${LANG_NAMES[targetLang]}. Return only the translated text, no explanations, no quotes.\n\n${text}`,
      }],
    });

    const translated = (message.content[0] as { type: string; text: string }).text.trim();
    return NextResponse.json({ translated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error de traducción';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
