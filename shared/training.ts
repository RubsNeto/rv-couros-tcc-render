import { z } from "zod";

export const difficultySchema = z.enum(["easy", "medium", "hard"]);
export type Difficulty = z.infer<typeof difficultySchema>;

export const startTrainingSchema = z
  .object({
    productId: z.string().min(1).max(80),
    objectionId: z.string().min(1).max(80),
    difficulty: difficultySchema,
  })
  .strict();

export const trainingMessageSchema = z
  .object({
    sessionId: z.string().uuid(),
    message: z.string().trim().min(2).max(1200),
  })
  .strict();

export const finishTrainingSchema = z
  .object({
    sessionId: z.string().uuid(),
  })
  .strict();

export const cancelTrainingSchema = finishTrainingSchema;

export const feedbackSchema = z
  .object({
    summary: z.string().min(20).max(700),
    strengths: z.array(z.string().min(4).max(300)).max(3),
    improvements: z.array(z.string().min(4).max(300)).max(3),
    suggestedResponse: z.string().min(20).max(700),
    nextStep: z.string().min(4).max(300),
    criteria: z
      .object({
        acknowledgedObjection: z.boolean(),
        askedRelevantQuestion: z.boolean(),
        usedSupportedFact: z.boolean(),
        avoidedUnsupportedClaims: z.boolean().nullable(),
        proposedNextStep: z.boolean(),
      })
      .strict(),
    evidenceIds: z.array(z.string().min(1).max(80)).max(8),
    sellerEvidence: z.array(z.object({
      evidenceId: z.string().min(1).max(80),
      sellerQuote: z.string().min(4).max(1200),
    }).strict()).max(8),
    suggestedEvidenceIds: z.array(z.string().min(1).max(80)).max(8),
    claimsToCheck: z.array(z.string().min(4).max(300)).max(5),
    unverifiedClaims: z.array(z.string().min(4).max(300)).max(5),
  })
  .strict();

export type TrainingFeedback = z.infer<typeof feedbackSchema>;

export const feedbackJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "strengths",
    "improvements",
    "suggestedResponse",
    "nextStep",
    "criteria",
    "evidenceIds",
    "sellerEvidence",
    "suggestedEvidenceIds",
    "claimsToCheck",
    "unverifiedClaims",
  ],
  properties: {
    summary: { type: "string" },
    strengths: {
      type: "array",
      minItems: 0,
      maxItems: 3,
      items: { type: "string" },
    },
    improvements: {
      type: "array",
      minItems: 0,
      maxItems: 3,
      items: { type: "string" },
    },
    suggestedResponse: { type: "string" },
    nextStep: { type: "string" },
    criteria: {
      type: "object",
      additionalProperties: false,
      required: [
        "acknowledgedObjection",
        "askedRelevantQuestion",
        "usedSupportedFact",
        "avoidedUnsupportedClaims",
        "proposedNextStep",
      ],
      properties: {
        acknowledgedObjection: { type: "boolean" },
        askedRelevantQuestion: { type: "boolean" },
        usedSupportedFact: { type: "boolean" },
        avoidedUnsupportedClaims: { type: ["boolean", "null"] },
        proposedNextStep: { type: "boolean" },
      },
    },
    evidenceIds: {
      type: "array",
      maxItems: 8,
      items: { type: "string" },
    },
    sellerEvidence: {
      type: "array", maxItems: 8,
      items: {
        type: "object", additionalProperties: false,
        required: ["evidenceId", "sellerQuote"],
        properties: { evidenceId: { type: "string" }, sellerQuote: { type: "string" } },
      },
    },
    suggestedEvidenceIds: { type: "array", maxItems: 8, items: { type: "string" } },
    claimsToCheck: {
      type: "array",
      maxItems: 5,
      items: { type: "string" },
    },
    unverifiedClaims: { type: "array", maxItems: 5, items: { type: "string" } },
  },
} as const;

export interface EvidenceFact {
  id: string;
  statement: string;
  sourceLabel: string;
  sourceUrl: string;
  consultedAt: string;
  status: "documented" | "internal-validation-required";
}

export interface PublicProduct {
  id: string;
  name: string;
  shortName: string;
  brand: string;
  category: string;
  image: string;
  summary: string;
  applications: string[];
  caution?: string;
  trainingMode: "commercial" | "documentary";
  trainingNote: string;
}

export interface PublicObjection {
  id: string;
  label: string;
  summary: string;
  openingPattern: string;
}

export interface TrainingConfigResponse {
  company: {
    name: string;
    appName: string;
    purpose: string;
  };
  academicDisclosure: string;
  dataPolicy: string;
  configVersion: string;
  configHash: string;
  ai: {
    available: boolean;
    provider: string | null;
    model: string | null;
  };
  products: PublicProduct[];
  objections: PublicObjection[];
  difficulties: Array<{
    id: Difficulty;
    label: string;
    summary: string;
  }>;
  maxSellerTurns: number;
  scenarioCount: number;
}

export interface Persona {
  firstName: string;
  role: string;
  companyType: string;
  style: string;
}

export interface ScenarioSummary {
  productId: string;
  productName: string;
  productImage: string;
  objectionId: string;
  objectionLabel: string;
  difficulty: Difficulty;
}

export interface TrainingStartResponse {
  sessionId: string;
  persona: Persona;
  scenario: ScenarioSummary;
  message: string;
  turnCount: number;
  maxSellerTurns: number;
  startedAt: string;
}

export interface TrainingMessageResponse {
  message: string;
  turnCount: number;
  mustFinish: boolean;
}

export interface TrainingFinishResponse {
  feedback: TrainingFeedback;
  evidenceUsed: EvidenceFact[];
  suggestedEvidence: EvidenceFact[];
  metadata: {
    sessionId: string;
    configVersion: string;
    modelRequested: string | null;
    modelReturned: string | null;
    sellerTurns: number;
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
    requestId: string | null;
  };
}

export interface ApiError {
  error: string;
  code?: string;
  fields?: Array<{ field: string; message: string }>;
}
