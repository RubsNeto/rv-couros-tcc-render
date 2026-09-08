import { describe, expect, it } from "vitest";
import type { TrainingFinishResponse } from "../shared/training";
import { crossProductText, otherProductLeakage } from "./metric-scope";

const feedback: TrainingFinishResponse["feedback"] = {
  summary: "Resumo", strengths: ["Escuta"], improvements: ["Pergunta"],
  suggestedResponse: "Resposta", nextStep: "Consultar documentação",
  evidenceIds: [], claimsToCheck: ["Spray Reposicionável"],
  sellerEvidence: [], suggestedEvidenceIds: [], unverifiedClaims: [],
  criteria: {
    acknowledgedObjection: true, askedRelevantQuestion: true, usedSupportedFact: false,
    avoidedUnsupportedClaims: true, proposedNextStep: true,
  },
};

describe("alcance v1 do indicador de outros produtos", () => {
  it("busca nomes curtos literalmente, sem distinção de caixa", () => {
    expect(otherProductLeakage("vonixx-vfloc-500ml", "sPrAy RePoSiCiOnÁvEl")).toBe(true);
    expect(otherProductLeakage("tekbond-spray-reposicionavel", "Spray Reposicionável")).toBe(false);
  });
  it("mantém claimsToCheck fora do escopo histórico", () => {
    const text = crossProductText(["Cliente fictício"], feedback);
    expect(otherProductLeakage("vonixx-vfloc-500ml", feedback.claimsToCheck.join(" "))).toBe(true);
    expect(text).not.toContain("Spray Reposicionável");
    expect(otherProductLeakage("vonixx-vfloc-500ml", text)).toBe(false);
  });
  it("inclui os seis grupos de campos declarados", () => {
    expect(crossProductText(["Abertura", "Continuação"], feedback))
      .toBe("Abertura Continuação Resumo Escuta Pergunta Resposta Consultar documentação");
  });
});
