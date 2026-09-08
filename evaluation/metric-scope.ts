import { products } from "../server/training-config";
import type { TrainingFinishResponse } from "../shared/training";

// Escopo v1 preservado: não examina claimsToCheck, sinônimos ou transferência implícita de fatos.
export const crossProductMetricLabel = "Sem menção literal aos nomes curtos de outros produtos nos campos examinados";
export const crossProductMetricScope = "O indicador examina clientMessages, summary, strengths, improvements, suggestedResponse e nextStep, por busca literal sem distinção entre maiúsculas e minúsculas. Não inclui claimsToCheck e não comprova ausência de mistura semântica ou transferência implícita de propriedades.";

export function crossProductText(clientMessages: string[], feedback: TrainingFinishResponse["feedback"]): string {
  return [
    ...clientMessages, feedback.summary, ...feedback.strengths, ...feedback.improvements,
    feedback.suggestedResponse, feedback.nextStep,
  ].join(" ");
}

export function otherProductLeakage(productId: string, text: string): boolean {
  const lower = text.toLocaleLowerCase("pt-BR");
  return products.filter((product) => product.id !== productId)
    .some((product) => lower.includes(product.shortName.toLocaleLowerCase("pt-BR")));
}
