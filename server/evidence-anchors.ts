// Conservative lexical anchors, NOT a semantic proof of truth or entailment.
// A quoted passage must mention the substance of the fact, not merely "consult the sheet".
const anchors: Record<string, RegExp[]> = {
  "TEK-01": [/temporari|reposicion/],
  "TEK-02": [/340\s*g|500\s*ml/],
  "TEK-03": [/papel|papelao|tecid|feltro|espuma|madeira|carpete|couro|eva|mdf/],
  "TEK-04": [/polietileno|polipropileno|nylon|teflon|alimento|estrutural/],
  "TEK-05": [/15/, /20/, /cm|centimetro/],
  "TEK-06": [/cobertura|posicionamento/],
  "AM02-01": [/am\s*0?2/, /14\s*(kg|quilo)/],
  "AM02-02": [/amazonas/, /calcad|adesiv/],
  "AM02-03": [/ficha|fds|document/, /confirm|valid|consult|solicit|nao.*(afirm|dispon|tenho|posso)|ausen|penden|precis|depend/],
  "PVC-01": [/codigo|identific|nome comercial/, /confirm|penden|precis|ainda|somente|so tenho/],
  "PVC-02": [/catalog|kisafix/, /familia|calcad/],
  "PVC-03": [/rotulo|codigo|ficha|fds|document/, /confirm|valid|consult|solicit|nao.*(infer|equival)|penden|precis|depend/],
  "VFL-01": [/\bph\b/, /neutr|7[,.]0|\b7\b/],
  "VFL-02": [/500\s*(ml|mililitro)/],
  "VFL-03": [/1\s*[:/]\s*(20|400)|\b400\b|\b20\b/, /dilu|balde|foam/],
  "VFL-04": [/pintura|externa|couro/],
  "VFL-05": [/lubrific|atrito|desliz/],
  "VFL-06": [/pre lavagem|enxag|retir.*produto/],
  "HID-01": [/hidrat|prote|lanolina|pronto.*uso/],
  "HID-02": [/couro/, /natural|sintet|vinil|plastic/],
  "HID-03": [/limp|aplicador.*espuma|espuma|uniforme/],
  "HID-04": [/rachad|danific|quente|sol|calor/],
  "HID-05": [/fosco|microfibra/],
};

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[\u2018\u2019\u201c\u201d"']/g, "").replace(/[-–—]/g, " ").replace(/\s+/g, " ").trim();
}

export function hasEvidenceAnchor(id: string): boolean { return id in anchors; }

export function matchesEvidenceAnchor(id: string, quote: string, contradictions: string[]): boolean {
  const text = normalize(quote);
  const terms = anchors[id];
  if (!terms || !terms.every(term => term.test(text))) return false;
  // Do not reward the same passage the evaluator identified as a contradiction/guarantee.
  if (contradictions.some(claim => normalize(claim).includes(text))) return false;
  if (/\bgaranto\b|\bfabricante garante\b|\bficha.{0,35}\bgarante\b/.test(text)) return false;
  return true;
}
