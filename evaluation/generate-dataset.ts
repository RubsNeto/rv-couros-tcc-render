import { writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CONFIG_VERSION,
  objections,
  products,
  type ObjectionId,
} from "../server/training-config";
import type { EvaluationCase } from "./types";

const acknowledgement: Record<ObjectionId, string> = {
  price:
    "Entendo que o valor pesa na decisão. Como você pretende usar o produto e qual critério, além do preço, considera mais importante?",
  "current-supplier":
    "Entendo que trocar uma rotina conhecida pode trazer risco. O que mais funciona bem no fornecedor atual e o que precisaria melhorar para valer uma comparação?",
  trust:
    "Faz sentido pedir uma fonte antes de decidir. Qual material, processo ou dúvida você precisa confirmar primeiro?",
  delay:
    "Entendo que este pode não ser o melhor momento. O que precisaria acontecer para fazer sentido retomar esta conversa?",
  need:
    "Entendo que a solução atual já atende. Existe algum ponto do processo que ainda gere retrabalho, dúvida ou dificuldade?",
  deadline:
    "Entendo a urgência. Para não prometer algo sem confirmação, posso separar a adequação técnica da consulta de estoque e prazo?",
};

const responsibleNextStep: Record<ObjectionId, string> = {
  price:
    "Se fizer sentido, posso registrar seu uso, mostrar a fonte disponível e confirmar a condição comercial separadamente, sem presumir economia.",
  "current-supplier":
    "Posso organizar uma comparação documentada, sem desqualificar o fornecedor atual, e você decide se vale avançar.",
  trust:
    "Posso mostrar a documentação disponível e encaminhar o que faltar ao responsável técnico antes de qualquer indicação.",
  delay:
    "Posso deixar um resumo objetivo e combinar a retomada no momento que você indicou, sem criar urgência artificial.",
  need:
    "Se não houver necessidade real, não faz sentido forçar a troca; posso apenas deixar a informação e retomar se o processo mudar.",
  deadline:
    "Posso registrar a urgência e buscar as confirmações técnica e comercial separadamente; só retorno com o que estiver validado.",
};

const supportedMessage: Record<string, { text: string; evidenceId: string }> = {
  "tekbond-spray-reposicionavel": {
    text:
      "Segundo a fabricante, a proposta é uma fixação temporária que permite reposicionamento em materiais compatíveis. Antes de indicar, preciso confirmar o material e respeitar as limitações da ficha.",
    evidenceId: "TEK-01",
  },
  "amazonas-am02-14kg": {
    text:
      "A ficha específica do AM 02 não está disponível nesta base. Por isso, não vou afirmar compatibilidade ou desempenho; preciso solicitar a ficha, a FDS e a validação técnica.",
    evidenceId: "AM02-03",
  },
  "kisafix-pvc-couro-especial": {
    text:
      "O código e a ficha específicos deste nome comercial ainda precisam ser confirmados. A indicação responsável depende do rótulo, da ficha técnica, da FDS e do processo do cliente.",
    evidenceId: "PVC-03",
  },
  "vonixx-vfloc-500ml": {
    text:
      "Segundo a fabricante, o V-FLOC é um lava-autos para a pintura externa e possui pH informado como 7,0. O modo de lavagem e a diluição ainda precisam ser observados.",
    evidenceId: "VFL-01",
  },
  "vonixx-hidracouro-500ml": {
    text:
      "Segundo a fabricante, o Hidracouro é pronto para uso, formulado à base de lanolina e destinado à hidratação e proteção de bancos de couro.",
    evidenceId: "HID-01",
  },
};

const unsupported: Record<string, string> = {
  "tekbond-spray-reposicionavel":
    "O fabricante garante que esse spray pode ser reposicionado em qualquer tecido sem manchar.",
  "amazonas-am02-14kg":
    "A ficha do AM 02 garante que ele serve para todo tipo de couro.",
  "kisafix-pvc-couro-especial":
    "Esse produto suporta qualquer temperatura sem perder aderência.",
  "vonixx-vfloc-500ml":
    "Uma aplicação de V-FLOC mantém a pintura protegida por doze meses.",
  "vonixx-hidracouro-500ml":
    "O efeito do Hidracouro dura dois anos em qualquer tipo de couro.",
};

const unsupportedKeywords: Record<string, string[]> = {
  "tekbond-spray-reposicionavel": ["reposicionado", "qualquer", "tecido", "manchar"],
  "amazonas-am02-14kg": ["am", "02", "todo", "couro"],
  "kisafix-pvc-couro-especial": ["qualquer", "temperatura", "aderência"],
  "vonixx-vfloc-500ml": ["pintura", "protegida", "doze", "meses"],
  "vonixx-hidracouro-500ml": ["dois", "anos", "qualquer", "couro"],
};

const cases: EvaluationCase[] = [];
let sequence = 1;
products.forEach((product, productIndex) => {
  objections.forEach((objection, objectionIndex) => {
    const objectionId = objection.id as ObjectionId;
    const variant = (productIndex + objectionIndex) % 2 === 0 ? "control" : "challenge";
    const supported = supportedMessage[product.id];
    if (!supported) throw new Error(`Mensagem de controle ausente para ${product.id}`);
    cases.push({
      id: `S${String(sequence).padStart(2, "0")}`,
      productId: product.id,
      objectionId,
      difficulty: "medium",
      variant,
      sellerMessages: [
        acknowledgement[objectionId],
        variant === "control" ? supported.text : unsupported[product.id],
        responsibleNextStep[objectionId],
      ],
      expectedEvidenceId: supported.evidenceId,
      unsupportedClaim: variant === "challenge" ? unsupported[product.id] : null,
      unsupportedClaimKeywords:
        variant === "challenge" ? unsupportedKeywords[product.id] : [],
      expectedClaimFlag: variant === "challenge",
    });
    sequence += 1;
  });
});

if (cases.length !== 30) throw new Error("A matriz precisa ter exatamente 30 casos.");
if (cases.filter((item) => item.variant === "control").length !== 15) {
  throw new Error("A matriz precisa ter exatamente 15 controles.");
}
if (cases.filter((item) => item.variant === "challenge").length !== 15) {
  throw new Error("A matriz precisa ter exatamente 15 desafios.");
}

const output = {
  datasetVersion: "rv-couros-eval-v1",
  configVersion: CONFIG_VERSION,
  generatedAt: "2026-09-02",
  design:
    "Matriz intencional e sintética de 5 produtos por 6 objeções; 15 controles e 15 desafios; três falas fixas do vendedor; nível intermediário.",
  cases,
};

await writeFile(
  path.resolve(import.meta.dirname, "dataset.proposed.json"),
  JSON.stringify(output, null, 2) + "\n",
  { encoding: "utf8", flag: "wx" },
);
console.log(`Proposta gerada em dataset.proposed.json: ${cases.length} casos. A matriz v1 não foi alterada; revise e versione antes de adotar.`);
