import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

export type EnrichedTerm = {
  uzbekTranslation: string;
};

function isTranslationPayload(
  value: unknown,
): value is { uzbekTranslation: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).uzbekTranslation === 'string'
  );
}

type AiProvider = 'gemini' | 'openai' | 'serper';

type SerperSearchResponse = {
  organic?: Array<{ title?: string; snippet?: string }>;
  answerBox?: { answer?: string; snippet?: string };
};

function firstSnippetFromSerper(data: SerperSearchResponse): string {
  const fromBox = data.answerBox?.answer ?? data.answerBox?.snippet;
  if (fromBox && typeof fromBox === 'string') {
    return fromBox.trim();
  }
  const first = data.organic?.[0];
  if (!first) {
    return '';
  }
  const parts = [first.title, first.snippet].filter(
    (x): x is string => typeof x === 'string' && x.length > 0,
  );
  return parts.join(' — ').trim();
}

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) {
    return t;
  }
  return `${t.slice(0, max - 1)}…`;
}

@Injectable()
export class OpenAiService {
  private readonly logger = new Logger(OpenAiService.name);
  private readonly openaiClient: OpenAI;

  constructor(private readonly config: ConfigService) {
    const openaiKey = this.config.get<string>('OPENAI_API_KEY');
    const geminiKey = this.config.get<string>('GEMINI_API_KEY');
    const serperKey = this.config.get<string>('SERPER_API_KEY');
    if (!openaiKey && !geminiKey && !serperKey) {
      this.logger.warn(
        'No AI key set: add SERPER_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY',
      );
    }
    this.openaiClient = new OpenAI({ apiKey: openaiKey ?? 'missing-key' });
  }

  private resolveProvider(): AiProvider {
    const explicit = this.config.get<string>('AI_PROVIDER')?.toLowerCase();
    if (
      explicit === 'serper' ||
      explicit === 'gemini' ||
      explicit === 'openai'
    ) {
      return explicit;
    }
    if (this.config.get<string>('SERPER_API_KEY')) {
      return 'serper';
    }
    if (this.config.get<string>('GEMINI_API_KEY')) {
      return 'gemini';
    }
    if (this.config.get<string>('OPENAI_API_KEY')) {
      return 'openai';
    }
    throw new ServiceUnavailableException(
      'No AI provider configured. Set SERPER_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY.',
    );
  }

  private buildTranslationPrompt(englishTerm: string): string {
    return `Translate the English word or phrase below into natural Uzbek for a language learner. Respond with JSON only (no markdown) with exactly one key:
- "uzbekTranslation": natural Uzbek (Latin or Cyrillic; pick one style consistently).

English: ${JSON.stringify(englishTerm)}`;
  }

  private parseTranslationJson(raw: string, source: string): EnrichedTerm {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new BadGatewayException(`invalid JSON from ${source}`);
    }
    if (!isTranslationPayload(parsed)) {
      throw new BadGatewayException(`invalid translation JSON from ${source}`);
    }
    const uzbekTranslation = parsed.uzbekTranslation.trim();
    if (!uzbekTranslation) {
      throw new BadGatewayException(`empty translation from ${source}`);
    }
    return { uzbekTranslation };
  }

  /**
   * @see https://mymemory.translated.net/doc/usagelimits.php
   */
  private async translateEnToUzWithMyMemory(
    text: string,
  ): Promise<string | null> {
    const trimmed = text.trim();
    if (!trimmed) {
      return null;
    }
    const q = encodeURIComponent(trimmed);
    const url = `https://api.mymemory.translated.net/get?q=${q}&langpair=en|uz`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        return null;
      }
      const data = (await res.json()) as {
        responseData?: { translatedText?: string };
        responseStatus?: number;
      };
      if (data.responseStatus !== 200) {
        return null;
      }
      const t = data.responseData?.translatedText?.trim();
      if (!t) {
        return null;
      }
      const lower = t.toLowerCase();
      if (
        lower.includes('query limit') ||
        lower.includes('invalid') ||
        lower.startsWith('mymemory')
      ) {
        return null;
      }
      return t;
    } catch {
      return null;
    }
  }

  private async serperSearch(
    apiKey: string,
    q: string,
  ): Promise<SerperSearchResponse> {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify({ q }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Serper HTTP ${res.status}: ${text.slice(0, 200)}`);
    }

    return (await res.json()) as SerperSearchResponse;
  }

  /** MyMemory first; optional Serper snippet fallback for Uzbek when a key is set. */
  private async enrichWithSerper(englishTerm: string): Promise<EnrichedTerm> {
    const apiKey = this.config.get<string>('SERPER_API_KEY');
    const term = englishTerm.trim();

    try {
      let uzbek = await this.translateEnToUzWithMyMemory(term);
      if (!uzbek && apiKey) {
        const uzFallback = await this.serperSearch(
          apiKey,
          `"${term}" uzbek -site:translate.google.com -"Google Translate"`,
        );
        uzbek = firstSnippetFromSerper(uzFallback) || null;
      }
      if (!uzbek) {
        throw new BadGatewayException(
          'Could not translate to Uzbek. Try again or configure Gemini/OpenAI.',
        );
      }
      return {
        uzbekTranslation: truncate(uzbek, 600),
      };
    } catch (err) {
      if (err instanceof BadGatewayException) {
        throw err;
      }
      this.logger.error('Serper/MyMemory enrichment failed', err);
      throw new BadGatewayException(
        'Failed to translate with Serper/MyMemory.',
      );
    }
  }

  private async enrichWithGemini(englishTerm: string): Promise<EnrichedTerm> {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'GEMINI_API_KEY is not set (required when using Gemini)',
      );
    }

    const modelName =
      this.config.get<string>('GEMINI_MODEL') ?? 'gemini-2.0-flash';
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    try {
      const result = await model.generateContent(
        this.buildTranslationPrompt(englishTerm),
      );
      const raw = result.response.text();
      if (!raw) {
        throw new BadGatewayException('empty response from Gemini');
      }
      return this.parseTranslationJson(raw, 'Gemini');
    } catch (err) {
      if (err instanceof BadGatewayException) {
        throw err;
      }
      this.logger.error('Gemini enrichment failed', err);
      throw new BadGatewayException('Failed to translate with Gemini');
    }
  }

  private async enrichWithOpenAI(englishTerm: string): Promise<EnrichedTerm> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'OPENAI_API_KEY is not set (required when using OpenAI)',
      );
    }

    const model = this.config.get<string>('OPENAI_MODEL') ?? 'gpt-4o-mini';

    try {
      const completion = await this.openaiClient.chat.completions.create({
        model,
        messages: [
          { role: 'user', content: this.buildTranslationPrompt(englishTerm) },
        ],
        response_format: { type: 'json_object' },
      });

      const raw = completion.choices[0]?.message?.content;
      if (!raw) {
        throw new BadGatewayException('empty response from OpenAI');
      }
      return this.parseTranslationJson(raw, 'OpenAI');
    } catch (err) {
      if (err instanceof BadGatewayException) {
        throw err;
      }
      this.logger.error('OpenAI enrichment failed', err);
      throw new BadGatewayException('Failed to translate with OpenAI');
    }
  }

  async enrichTerm(englishTerm: string): Promise<EnrichedTerm> {
    const provider = this.resolveProvider();
    if (provider === 'serper') {
      return this.enrichWithSerper(englishTerm);
    }
    if (provider === 'gemini') {
      return this.enrichWithGemini(englishTerm);
    }
    return this.enrichWithOpenAI(englishTerm);
  }
}
