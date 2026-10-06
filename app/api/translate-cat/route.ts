import { NextResponse } from 'next/server';

const LANG_NAMES = { en: 'English', zh: 'Simplified Chinese', ja: 'Japanese', ko: 'Korean' } as const;

type Target = keyof typeof LANG_NAMES;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY is not configured' }, { status: 500 });

    const targets = (body.languages || ['en', 'zh', 'ja', 'ko']).filter((x: string): x is Target => x in LANG_NAMES);
    const input = {
      name: String(body.name || ''),
      name_en: String(body.name_en || ''),
      location: String(body.location || ''),
      details: String(body.details || ''),
      belly_text: String(body.belly_text || ''),
    };

    const prompt = `Translate this cat-sighting content into ${targets.map((x: Target) => LANG_NAMES[x]).join(', ')}.\n\nRules:\n- Do NOT translate the cat's name. name is only the source/reference; name_en is already supplied by the user and must not be changed.\n- Preserve meaning, friendliness, uncertainty, and safety warnings.\n- Translate location, details, and belly_text naturally for local readers.\n- Return ONLY valid JSON in this shape: {"en":{"location":"","details":"","belly_text":""},"zh":{...},"ja":{...},"ko":{...}}.\n\nSource:\n${JSON.stringify(input)}`;

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_TRANSLATION_MODEL || 'gpt-5-mini',
        input: prompt,
        text: { format: { type: 'json_object' } },
      }),
    });
    const data = await response.json();
    if (!response.ok) return NextResponse.json({ error: data?.error?.message || 'OpenAI request failed' }, { status: 502 });

    const text = data.output_text || data.output?.flatMap((x: any) => x.content || []).find((x: any) => x.type === 'output_text')?.text;
    if (!text) return NextResponse.json({ error: 'No translation returned' }, { status: 502 });
    return NextResponse.json({ translations: JSON.parse(text) });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Translation failed' }, { status: 500 });
  }
}
