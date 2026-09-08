import { describe, expect, it } from "vitest";
import {
  CONFIG_HASH,
  MAX_SELLER_TURNS,
  difficulties,
  getScenario,
  objections,
  products,
} from "./training-config";

describe("configuração fixa de treinamento", () => {
  it("contém cinco produtos, seis objeções e trinta combinações", () => {
    expect(products).toHaveLength(5);
    expect(objections).toHaveLength(6);
    expect(products.flatMap((product) => Object.keys(product.scenarios))).toHaveLength(30);
  });

  it("usa IDs únicos para produtos e evidências", () => {
    const productIds = products.map((product) => product.id);
    const evidenceIds = products.flatMap((product) => product.facts.map((fact) => fact.id));
    expect(new Set(productIds).size).toBe(productIds.length);
    expect(new Set(evidenceIds).size).toBe(evidenceIds.length);
  });

  it("resolve todas as combinações e possui imagens locais", () => {
    for (const product of products) {
      expect(product.image).toMatch(/^\/products\//);
      for (const objection of objections) {
        expect(getScenario(product.id, objection.id)).not.toBeNull();
      }
    }
  });

  it("expõe somente três níveis e limita a cinco respostas", () => {
    expect(difficulties.map((item) => item.id)).toEqual(["easy", "medium", "hard"]);
    expect(MAX_SELLER_TURNS).toBe(5);
  });

  it("gera uma impressão digital SHA-256 da configuração", () => {
    expect(CONFIG_HASH).toMatch(/^[a-f0-9]{64}$/);
  });
});
