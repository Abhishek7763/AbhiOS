import { GoogleGenAI, Type } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import {
  isEmailAllowed,
  NO_STORE_HEADERS,
  verifyBearerUser,
} from '@/src/lib/auth-server';
import { consumeAiDailyQuota } from '@/src/db/repository';
import { todayLocal } from '@/src/lib/logic/dates';
import { AISuggestionDraft, InboxItemType } from '@/src/lib/types';

export type AiFallbackReason = 'quota' | 'model_error' | 'no_key' | 'timeout';

const MAX_TEXT_LENGTH = 2000;
const MAX_CONTEXT_BYTES = 8 * 1024; // 8 KB
const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
const AI_TIMEOUT_MS = 20000;

function isGeminiKeyConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY;
  return Boolean(key && key.trim().length > 5 && key !== 'MY_GEMINI_API_KEY');
}

function resolveDailyLimit(): number {
  const parsed = Number(process.env.AI_DAILY_LIMIT);
  if (Number.isFinite(parsed) && parsed >= 1) {
    return Math.floor(parsed);
  }
  return 40;
}

function resolveGeminiModel(): string {
  const configured = process.env.GEMINI_MODEL?.trim();
  return configured || DEFAULT_GEMINI_MODEL;
}

function getAiClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function classifyGeminiError(error: unknown): AiFallbackReason {
  if (error instanceof Error) {
    const msg = `${error.name} ${error.message}`.toLowerCase();
    if (
      error.name === 'TimeoutError' ||
      error.name === 'AbortError' ||
      msg.includes('timeout') ||
      msg.includes('timed out')
    ) {
      return 'timeout';
    }
    if (
      msg.includes('429') ||
      msg.includes('resource_exhausted') ||
      msg.includes('quota') ||
      msg.includes('rate limit')
    ) {
      return 'quota';
    }
  }
  return 'model_error';
}

/**
 * Deterministic local heuristic fallback when GEMINI_API_KEY is not set, quota is reached,
 * or model call fails, ensuring the user always gets helpful structured drafts.
 */
function buildDeterministicDraft(
  mode: string,
  text: string
): AISuggestionDraft {
  const clean = text.trim();
  const lower = clean.toLowerCase();

  if (mode === 'task_split') {
    const lines = clean
      .split(/\n|;|aur|\band\b/i)
      .map((s) => s.trim())
      .filter((s) => s.length > 3);
    const subItems =
      lines.length >= 2
        ? lines.slice(0, 4)
        : [
            `Step 1 (5 min setup): ${clean.slice(0, 50)} ke liye zaruri cheez kholo`,
            `Step 2 (15 min core): Pehla chhota hissa poora karo`,
            `Step 3 (5 min close): Check karke status update karo`,
          ];
    return {
      refinedTitle: clean.slice(0, 80),
      subItems,
      explanation:
        'Rule-based breakdown: Bade kaam ko 15-minute ke actionable tukdon me baanta gaya hai.',
    };
  }

  if (mode === 'goal_gate_assist') {
    return {
      refinedTitle: clean.slice(0, 90),
      purposeReason:
        'Isse rozमर्रा ki tension kam hogi aur long-term stability milegi.',
      tradeoffs: 'Roz 20-30 minute low-priority phone scrolling kam karni hogi.',
      nextAction: `Aaj 10 minute nikal kar "${clean.slice(0, 40)}" ka pehla basic step note karo`,
      subItems: [
        'Milestone 1: Baseline स्थिति aur zarurat clear karna',
        'Milestone 2: Pehle 2 hafte ka chhota repeatable system set karna',
        'Milestone 3: 30 din baad progress review aur adjustment',
      ],
      explanation:
        'Deterministic Goal Gate helper (AI key configure hone par aur gahra personalized draft milega).',
    };
  }

  let suggestedType: InboxItemType = 'task';
  if (/roz|daily|har din|habit|routine|paani|walk|exercise/i.test(lower)) {
    suggestedType = 'habit_candidate';
  } else if (
    /lac|lakh|fund|ban(a|aa)na|seekhna|weight|career|promotion|6 month|year/i.test(
      lower
    )
  ) {
    suggestedType = 'goal_candidate';
  } else if (/wait|rakesh|bheja|reply|approval|expect/i.test(lower)) {
    suggestedType = 'waiting_for';
  } else if (/idea|experiment|shayad|kaisa rahega|\?/i.test(lower)) {
    suggestedType = 'idea';
  } else if (/someday|baad me kabhi|future/i.test(lower)) {
    suggestedType = 'goal_candidate';
  } else if (clean.includes('\n') || /setup|project|plan/i.test(lower)) {
    suggestedType = 'project';
  }

  const lines = clean
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  return {
    suggestedType,
    refinedTitle: lines[0]?.slice(0, 100) || clean.slice(0, 100),
    nextAction:
      suggestedType === 'task'
        ? `15 min nikal kar "${lines[0]?.slice(0, 50)}" shuru karo`
        : `Clarify karke tay karein ki abhi active karna hai ya Someday me rakhna hai`,
    estMinutes: 20,
    subItems: lines.length > 1 ? lines : undefined,
    explanation:
      'Deterministic keyword analysis (AI Draft — aap apni marzi se category chunein).',
  };
}

export async function GET(req: NextRequest) {
  if (req.method !== 'GET') {
    return NextResponse.json(
      { error: 'Method Not Allowed' },
      { status: 405, headers: NO_STORE_HEADERS }
    );
  }
  return NextResponse.json(
    { aiAvailable: isGeminiKeyConfigured() },
    { headers: NO_STORE_HEADERS }
  );
}

export async function POST(req: NextRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json(
      { error: 'Method Not Allowed' },
      { status: 405, headers: NO_STORE_HEADERS }
    );
  }

  const decoded = await verifyBearerUser(req);
  if (!decoded) {
    return NextResponse.json(
      { error: 'Unauthorized: Missing or invalid token' },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  if (!isEmailAllowed(decoded.email)) {
    return NextResponse.json(
      { error: 'Forbidden: Email not in allowlist', code: 'ACCESS_DENIED' },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  let mode = 'inbox_clarify';
  let text = '';

  try {
    const rawBody = await req.text();
    if (Buffer.byteLength(rawBody, 'utf8') > 32 * 1024) {
      return NextResponse.json(
        { error: 'Request payload too large' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    mode = String(body.mode || 'inbox_clarify');
    if (typeof body.text !== 'string') {
      return NextResponse.json(
        { error: 'Input text must be a string' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    text = body.text.trim();
    if (!text) {
      return NextResponse.json(
        { error: 'Input text is required' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json(
        { error: `Input text exceeds ${MAX_TEXT_LENGTH} characters` },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const contextObj = body.context ?? {};
    const contextJson = JSON.stringify(contextObj);
    if (Buffer.byteLength(contextJson, 'utf8') > MAX_CONTEXT_BYTES) {
      return NextResponse.json(
        { error: 'Context JSON exceeds 8 KB limit' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (!isGeminiKeyConfigured()) {
      const draft = buildDeterministicDraft(mode, text);
      return NextResponse.json(
        {
          aiAvailable: false,
          aiUsed: false,
          reason: 'no_key' satisfies AiFallbackReason,
          draft,
        },
        { headers: NO_STORE_HEADERS }
      );
    }

    // Enforce per-user daily call cap in ai_usage(user_id, day, count)
    const today = todayLocal('Asia/Kolkata', 4);
    const dailyLimit = resolveDailyLimit();
    try {
      const quota = await consumeAiDailyQuota(
        decoded.uid,
        decoded.email || '',
        today,
        dailyLimit
      );
      if (!quota.allowed) {
        const draft = buildDeterministicDraft(mode, text);
        return NextResponse.json(
          {
            aiAvailable: true,
            aiUsed: false,
            reason: 'quota' satisfies AiFallbackReason,
            draft,
          },
          { headers: NO_STORE_HEADERS }
        );
      }
    } catch (dbErr) {
      const errClass =
        dbErr instanceof Error ? dbErr.constructor.name : 'UnknownDbError';
      console.error(
        `[AI Suggest] ai_usage quota check failed (${errClass}); continuing with model call.`
      );
    }

    const ai = getAiClient();
    const modelId = resolveGeminiModel();

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        const err = new Error('Gemini request timed out');
        err.name = 'TimeoutError';
        reject(err);
      }, AI_TIMEOUT_MS);
    });

    const response = await Promise.race([
      ai.models.generateContent({
        model: modelId,
        contents: `Mode: ${mode}\nUser Input: ${text}\nContext: ${contextJson}`,
        config: {
          systemInstruction:
            'You are an assistant inside Abhishek’s Personal Goal OS (V2). ' +
            'Follow strict rules: 1. Output JSON only matching the schema. ' +
            '2. Use natural Hinglish (Hindi in Roman script + English terms). ' +
            '3. Never claim authority over the user’s true motives or impose guilt. ' +
            '4. Keep time estimates realistic and conservative (15-45 mins). ' +
            '5. Classify into one of: task, goal_candidate, project, habit_candidate, reference, idea, concern, waiting_for, duplicate.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggestedType: {
                type: Type.STRING,
                description:
                  'One of: task, goal_candidate, project, habit_candidate, reference, idea, concern, waiting_for, duplicate',
              },
              refinedTitle: {
                type: Type.STRING,
                description:
                  'Clean, concise title or desired outcome in Hinglish',
              },
              nextAction: {
                type: Type.STRING,
                description:
                  'Concrete physical first action the user can start without extra planning',
              },
              estMinutes: {
                type: Type.INTEGER,
                description: 'Conservative estimate in minutes (10 to 60)',
              },
              purposeReason: {
                type: Type.STRING,
                description: 'Optional suggested personal reason reflection',
              },
              tradeoffs: {
                type: Type.STRING,
                description: 'Realistic time/energy trade-off to consider',
              },
              subItems: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description:
                  '2 to 4 smaller steps (for task_split or multi-thought split or milestones)',
              },
              explanation: {
                type: Type.STRING,
                description:
                  '1 short sentence in Hinglish explaining this suggestion',
              },
            },
          },
        },
      }),
      timeoutPromise,
    ]).finally(() => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    });

    const rawText = (response.text ?? '{}').trim();
    const parsed = JSON.parse(rawText) as AISuggestionDraft;

    return NextResponse.json(
      {
        aiAvailable: true,
        aiUsed: true,
        draft: parsed,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    const errClass =
      error instanceof Error ? error.constructor.name : typeof error;
    const reason = classifyGeminiError(error);
    console.error(
      `[AI Suggest] Gemini call failed (class=${errClass}, reason=${reason}).`
    );
    const draft = buildDeterministicDraft(mode, text || 'Task');
    return NextResponse.json(
      {
        aiAvailable: isGeminiKeyConfigured(),
        aiUsed: false,
        reason,
        draft,
      },
      { headers: NO_STORE_HEADERS }
    );
  }
}
