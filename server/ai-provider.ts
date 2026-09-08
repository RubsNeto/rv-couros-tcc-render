export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  maxTokens?: number;
  reasoningEffort?: "none" | "low" | "medium" | "high" | "xhigh" | "max";
  responseFormat?: {
    name: string;
    schema: Record<string, unknown>;
  };
}

export interface TokenUsage {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
}

export interface ChatResult {
  text: string;
  model: string | null;
  requestId: string | null;
  usage: TokenUsage;
}

export interface AiProvider {
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResult>;
  status(): { available: boolean; provider: string | null; model: string | null };
}

const DEFAULT_MODEL = "gpt-5.6-luna";

function configuredKey(): string | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  return key && key !== "sk-..." ? key : null;
}

function configuredModel(): string {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
}

function isReasoningModel(model: string): boolean {
  return /^(gpt-5|o[1-9])/i.test(model);
}

export const openAiProvider: AiProvider = {
  status() {
    return {
      available: Boolean(configuredKey()),
      provider: configuredKey() ? "openai" : null,
      model: configuredKey() ? configuredModel() : null,
    };
  },

  async chat(messages, options = {}) {
    const apiKey = configuredKey();
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY não configurada no servidor.");
    }

    const model = configuredModel();
    const body: Record<string, unknown> = {
      model,
      messages,
      stream: false,
    };
    const maxTokens = options.maxTokens ?? 900;
    if (isReasoningModel(model)) {
      body.max_completion_tokens = maxTokens;
      body.reasoning_effort = options.reasoningEffort ?? "low";
    } else {
      body.max_tokens = maxTokens;
    }
    if (options.responseFormat) {
      body.response_format = {
        type: "json_schema",
        json_schema: {
          name: options.responseFormat.name,
          strict: true,
          schema: options.responseFormat.schema,
        },
      };
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    });

    const requestId = response.headers.get("x-request-id");
    if (!response.ok) {
      console.error(
        `[AI] Falha em chat/completions: status=${response.status} requestId=${requestId ?? "n/a"} model=${model}`,
      );
      throw new Error(`Serviço de IA indisponível (HTTP ${response.status}).`);
    }

    const data = (await response.json()) as {
      model?: string;
      choices?: Array<{ message?: { content?: string; refusal?: string } }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };
    const text = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) {
      throw new Error("A IA retornou uma resposta vazia.");
    }

    return {
      text,
      model: data.model ?? model,
      requestId,
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? null,
        completionTokens: data.usage?.completion_tokens ?? null,
        totalTokens: data.usage?.total_tokens ?? null,
      },
    };
  },
};
