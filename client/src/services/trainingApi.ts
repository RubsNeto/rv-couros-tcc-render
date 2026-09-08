import type {
  ApiError,
  Difficulty,
  TrainingConfigResponse,
  TrainingFinishResponse,
  TrainingMessageResponse,
  TrainingStartResponse,
} from "@shared/training";

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const payload = (await response.json().catch(() => null)) as T | ApiError | null;
  if (!response.ok) {
    const error = payload as ApiError | null;
    throw new ApiRequestError(
      error?.error ?? "Não foi possível concluir a solicitação.",
      error?.code,
      response.status,
    );
  }
  return payload as T;
}

export function loadTrainingConfig(): Promise<TrainingConfigResponse> {
  return request("/api/training/config");
}

export function startTraining(input: {
  productId: string;
  objectionId: string;
  difficulty: Difficulty;
}): Promise<TrainingStartResponse> {
  return request("/api/training/start", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function sendTrainingMessage(
  sessionId: string,
  message: string,
): Promise<TrainingMessageResponse> {
  return request("/api/training/message", {
    method: "POST",
    body: JSON.stringify({ sessionId, message }),
  });
}

export function finishTraining(sessionId: string): Promise<TrainingFinishResponse> {
  return request("/api/training/finish", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });
}

export function cancelTraining(sessionId: string, keepalive = false): Promise<void> {
  return request<void>("/api/training/cancel", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
    keepalive,
  });
}
