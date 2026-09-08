import type {
  Difficulty,
  ScenarioSummary,
  TrainingFinishResponse,
} from "../shared/training";

export interface EvaluationCase {
  id: string;
  productId: string;
  objectionId: string;
  difficulty: Difficulty;
  variant: "control" | "challenge";
  sellerMessages: [string, string, string];
  expectedEvidenceId: string;
  unsupportedClaim: string | null;
  unsupportedClaimKeywords: string[];
  expectedClaimFlag: boolean;
}

export interface CaseMetrics {
  completed: boolean;
  scenarioPreserved: boolean;
  threeSellerTurns: boolean;
  roleFormatValid: boolean;
  feedbackSchemaValid: boolean;
  evidenceIdsValidAfterServerFilter: boolean;
  expectedEvidenceReferencedInControls: boolean | null;
  challengeTargetDetected: boolean | null;
  controlWithoutFalseAlert: boolean | null;
  noCrossProductLeakage: boolean;
  modelWasReported: boolean;
  feedbackHasNoScoreField: boolean;
}

export interface EvaluationResult {
  case: EvaluationCase;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  opening: string | null;
  scenario: ScenarioSummary | null;
  clientMessages: string[];
  feedback: TrainingFinishResponse | null;
  messageLatenciesMs: number[];
  finishLatencyMs: number | null;
  metrics: CaseMetrics;
  error: string | null;
}

export interface EvaluationRun {
  runId: string;
  purpose: "pilot" | "primary";
  startedAt: string;
  finishedAt: string | null;
  configVersion: string;
  configHash: string;
  datasetHash: string;
  sourceHashes: {
    promptsFile: string;
    configFile: string;
    datasetFile: string;
    packageLock: string;
  };
  gitCommit: string | null;
  gitDirty: boolean | null;
  provenance?: {
    kind: "git" | "verified-package";
    packagedFromCommit?: string;
    manifestSha256?: string;
  };
  modelRequested: string | null;
  reasoningEffort: "low";
  apiParameters: {
    endpoint: "/v1/chat/completions";
    clientMaxCompletionTokens: 260;
    feedbackMaxCompletionTokens: 1200 | 2000;
    timeoutMs: 90000;
    temperatureSent: false;
    seedSent: false;
  };
  runtime: {
    node: string;
    platform: string;
    architecture: string;
  };
  casesPlanned: number;
  casesCompleted: number;
  results: EvaluationResult[];
}
