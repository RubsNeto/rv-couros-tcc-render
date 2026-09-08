import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { EvaluationCase } from "./types";

let cases: EvaluationCase[] = [];

beforeAll(async () => {
  const raw = await readFile(path.resolve(import.meta.dirname, "dataset.v1.json"), "utf8");
  cases = (JSON.parse(raw) as { cases: EvaluationCase[] }).cases;
});

describe("matriz de avaliação", () => {
  it("possui 30 casos, quinze controles e quinze desafios", () => {
    expect(cases).toHaveLength(30);
    expect(cases.filter((item) => item.variant === "control")).toHaveLength(15);
    expect(cases.filter((item) => item.variant === "challenge")).toHaveLength(15);
  });

  it("contém três falas fixas do vendedor em cada caso", () => {
    expect(cases.every((item) => item.sellerMessages.length === 3)).toBe(true);
    expect(cases.every((item) => item.sellerMessages.every((message) => message.length > 20))).toBe(
      true,
    );
  });

  it("tem exatamente uma afirmação-alvo nos desafios e nenhuma nos controles", () => {
    for (const item of cases) {
      if (item.variant === "challenge") {
        expect(item.expectedClaimFlag).toBe(true);
        expect(item.unsupportedClaim).toBe(item.sellerMessages[1]);
        expect(item.unsupportedClaimKeywords.length).toBeGreaterThanOrEqual(3);
      } else {
        expect(item.expectedClaimFlag).toBe(false);
        expect(item.unsupportedClaim).toBeNull();
        expect(item.unsupportedClaimKeywords).toEqual([]);
      }
    }
  });
});
