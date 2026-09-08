import { createHash } from "node:crypto";
import { z } from "zod";
import type {
  Difficulty,
  EvidenceFact,
  Persona,
  PublicObjection,
  PublicProduct,
  TrainingConfigResponse,
} from "../shared/training";

export const CONFIG_VERSION = "rv-couros-2026-09-08-v2.1";
export const MAX_SELLER_TURNS = 5;
export const CLIENT_MAX_TOKENS = 260;
export const FEEDBACK_MAX_TOKENS = 2000;

export type ObjectionId =
  | "price"
  | "current-supplier"
  | "trust"
  | "delay"
  | "need"
  | "deadline";

interface ScenarioDefinition {
  persona: Persona;
  opening: string;
  trainingFocus: string;
}

export interface ProductDefinition extends PublicProduct {
  facts: EvidenceFact[];
  scenarios: Record<ObjectionId, ScenarioDefinition>;
}

export const objections: PublicObjection[] = [
  {
    id: "price",
    label: "Preço",
    summary: "O cliente questiona o valor percebido, sem mencionar um preço real.",
    openingPattern: "Achei mais caro do que esperava. Por que eu deveria considerar?",
  },
  {
    id: "current-supplier",
    label: "Fornecedor atual",
    summary: "O cliente já compra uma solução semelhante e não vê motivo para mudar.",
    openingPattern: "Já tenho um fornecedor que atende minha rotina.",
  },
  {
    id: "trust",
    label: "Confiança no produto",
    summary: "O cliente pede explicação ou fonte antes de considerar a solução.",
    openingPattern: "Quero uma orientação confiável antes de testar.",
  },
  {
    id: "delay",
    label: "Deixar para depois",
    summary: "O cliente prefere adiar a decisão e não quer ser pressionado.",
    openingPattern: "Prefiro conversar sobre isso em outro momento.",
  },
  {
    id: "need",
    label: "Não vê necessidade",
    summary: "O cliente acredita que a prática atual já é suficiente.",
    openingPattern: "O que uso hoje já resolve. Por que mudar?",
  },
  {
    id: "deadline",
    label: "Prazo e disponibilidade",
    summary: "O cliente tem urgência, mas o vendedor não pode inventar estoque ou entrega.",
    openingPattern: "Você consegue garantir que serve e chega a tempo?",
  },
];

export const difficulties: TrainingConfigResponse["difficulties"] = [
  {
    id: "easy",
    label: "Fácil",
    summary: "Cliente receptivo, com respostas mais claras e abertura para entender.",
  },
  {
    id: "medium",
    label: "Intermediário",
    summary: "Cliente realista, que precisa ser ouvido e receber uma resposta bem fundamentada.",
  },
  {
    id: "hard",
    label: "Desafiador",
    summary: "Cliente mais breve e desconfiado, que não aceita promessas vagas.",
  },
];

const consultedAt = "2026-09-08";

function documented(
  id: string,
  statement: string,
  sourceLabel: string,
  sourceUrl: string,
): EvidenceFact {
  return {
    id,
    statement,
    sourceLabel,
    sourceUrl,
    consultedAt,
    status: "documented",
  };
}

function pending(
  id: string,
  statement: string,
  sourceLabel: string,
  sourceUrl: string,
): EvidenceFact {
  return {
    id,
    statement,
    sourceLabel,
    sourceUrl,
    consultedAt,
    status: "internal-validation-required",
  };
}

const tekbondSource =
  "https://www.tekbond.com.br/produtos/colas-e-adesivos/cola-spray/cola-spray-reposicionavel";
const tekbondTechnicalSource = "https://www.tekbond.com.br/sites/Tekbond.com.br/files/media/downloadable/2025-09/Cola_Spray_Reposicionavel-BRSR000-ficha_tecnica_01.pdf";
const amazonasSource = "https://www.amazonas.com.br/catalogo-de-produtos/";
const kisafixSource = "https://www.kisafix.com/en/products/shoes";
const vflocSource = "https://www.vonixx.com.br/produto/v-floc/";
const hidracouroSource = "https://www.vonixx.com.br/produto/hidracouro/";

export const products: ProductDefinition[] = [
  {
    id: "tekbond-spray-reposicionavel",
    name: "Cola Spray Reposicionável Tekbond 340 g/500 ml",
    shortName: "Spray Reposicionável",
    brand: "Tekbond",
    trainingMode: "commercial",
    trainingNote: "Treino comercial inicial com fatos do fabricante. Não substitui a ficha técnica ou a FDS.",
    category: "Adesivos",
    image: "/products/cola-spray-reposicionavel-340g-500ml.jpg",
    summary:
      "Adesivo em spray para fixação temporária e reposicionamento de materiais compatíveis.",
    applications: ["Papel e papelão", "Tecidos e feltros", "Espumas, couro, EVA e MDF compatíveis"],
    caution:
      "Não é adesivo estrutural. Compatibilidade, preparo e segurança devem seguir a ficha do fabricante.",
    facts: [
      documented(
        "TEK-01",
        "A finalidade declarada é a fixação temporária, com possibilidade de reposicionamento antes da colagem definitiva.",
        "Página oficial Tekbond",
        tekbondSource,
      ),
      documented(
        "TEK-02",
        "A apresentação oficial usada no protótipo é 340 g/500 ml.",
        "Página oficial Tekbond",
        tekbondSource,
      ),
      documented(
        "TEK-03",
        "A fabricante inclui papel, papelão, tecidos, feltros, espumas, madeiras, carpetes, couro, EVA e MDF entre aplicações, condicionadas à compatibilidade.",
        "Página oficial Tekbond — aplicações",
        tekbondSource,
      ),
      documented(
        "TEK-04",
        "A ficha restringe o uso em polietileno, polipropileno, nylon, Teflon, contato direto com alimentos e aplicações estruturais.",
        "Ficha técnica Tekbond — revisão 2025, p. 2",
        tekbondTechnicalSource,
      ),
      documented("TEK-05", "A ficha orienta manter a lata entre 15 e 20 cm da superfície durante a aplicação; essa instrução não elimina as restrições de materiais.", "Ficha técnica Tekbond — revisão 2025, p. 2", tekbondTechnicalSource),
      documented("TEK-06", "A fabricante descreve poder de cobertura e tempo para posicionamento como benefícios; não há comparação comprovada com concorrentes nem economia garantida nesta base.", "Ficha técnica Tekbond — revisão 2025, p. 1", tekbondTechnicalSource),
    ],
    scenarios: {
      price: {
        persona: { firstName: "Marina", role: "Responsável pelo ateliê", companyType: "Ateliê de decoração", style: "prática e cuidadosa" },
        opening: "Achei esta opção mais cara do que eu esperava. O que justifica considerar esse produto no meu trabalho?",
        trainingFocus: "Entender o tipo de trabalho e explicar a finalidade sem inventar economia.",
      },
      "current-supplier": {
        persona: { firstName: "Paulo", role: "Comprador", companyType: "Oficina de estofamento", style: "leal ao fornecedor atual" },
        opening: "Já tenho uma marca que compro há bastante tempo e não vejo razão para trocar agora.",
        trainingFocus: "Reconhecer a relação atual e propor comparação responsável sem depreciar concorrentes.",
      },
      trust: {
        persona: { firstName: "Renata", role: "Artesã", companyType: "Produção artesanal", style: "cautelosa com materiais" },
        opening: "Como eu sei que posso reposicionar sem estragar o material? Quero uma orientação confiável antes de testar.",
        trainingFocus: "Perguntar o material e explicar limites. Somente após confirmar compatibilidade considerar teste; se o material for expressamente restrito, não recomendar aplicação nem teste para liberar o uso.",
      },
      delay: {
        persona: { firstName: "Diego", role: "Produtor", companyType: "Montagem para eventos", style: "objetivo e sem urgência" },
        opening: "Pode ser útil, mas prefiro deixar essa conversa para quando aparecer um trabalho específico.",
        trainingFocus: "Entender quando a solução faria sentido e combinar retorno sem pressão.",
      },
      need: {
        persona: { firstName: "Sônia", role: "Costureira", companyType: "Oficina de costura", style: "satisfeita com o método atual" },
        opening: "Eu já consigo posicionar as peças do jeito que faço hoje. Para que eu precisaria de um spray reposicionável?",
        trainingFocus: "Investigar dificuldades reais e aceitar que o produto pode não ser necessário.",
      },
      deadline: {
        persona: { firstName: "André", role: "Montador", companyType: "Cenografia", style: "apressado" },
        opening: "Meu trabalho começa logo. Você consegue confirmar agora se o produto serve e se chega a tempo?",
        trainingFocus: "Separar adequação técnica de estoque e prazo, sem prometer entrega.",
      },
    },
  },
  {
    id: "amazonas-am02-14kg",
    name: "Cola de Contato Amazonas AM 02 14 kg",
    shortName: "Amazonas AM 02",
    brand: "Amazonas",
    trainingMode: "documentary",
    trainingNote: "Somente treino de consulta documental. Faltam ficha técnica e FDS específicas; não há base para indicar uso ou vantagem do AM 02.",
    category: "Adesivos",
    image: "/products/cola-de-contato-adesivo-am-02-lata.webp",
    summary:
      "Adesivo de contato AM 02 em apresentação de 14 kg; a ficha específica não está disponível nesta base.",
    applications: ["Levantamento da necessidade", "Comparação comercial responsável", "Encaminhamento para validação técnica"],
    caution:
      "Não indicar substrato, aplicação ou desempenho sem ficha técnica e FDS específicas vigentes.",
    facts: [
      pending(
        "AM02-01",
        "O item foi identificado para o protótipo como Cola de Contato Amazonas AM 02, apresentação de 14 kg.",
        "Curadoria interna do protótipo; validação específica pendente",
        amazonasSource,
      ),
      documented(
        "AM02-02",
        "O site institucional confirma a atuação geral da Amazonas com adesivos e soluções para processos calçadistas, mas não valida a aplicação específica do AM 02.",
        "Site institucional Amazonas",
        "https://www.amazonas.com.br/",
      ),
      pending(
        "AM02-03",
        "Composição, materiais compatíveis, aplicação, desempenho e segurança devem ser confirmados em ficha técnica e FDS específicas.",
        "Regra de segurança da base controlada",
        amazonasSource,
      ),
    ],
    scenarios: {
      price: {
        persona: { firstName: "Carlos", role: "Comprador", companyType: "Oficina calçadista", style: "focado em custo" },
        opening: "Antes de avançar, preciso entender por que eu deveria considerar esse item se estou buscando reduzir custo.",
        trainingFocus: "Investigar processo e critério de compra sem inventar vantagem financeira.",
      },
      "current-supplier": {
        persona: { firstName: "Fabiana", role: "Responsável por suprimentos", companyType: "Fábrica de calçados", style: "avessa a risco" },
        opening: "Meu fornecedor já conhece minha rotina e me atende há anos. Trocar agora parece gerar mais risco do que benefício.",
        trainingFocus: "Reconhecer o risco e propor somente avaliação documental.",
      },
      trust: {
        persona: { firstName: "Leandro", role: "Coordenador de produção", companyType: "Produção calçadista", style: "técnico e criterioso" },
        opening: "Você tem a ficha técnica e a FDS atualizadas do AM 02 de 14 quilos? Sem isso eu não consigo avaliar.",
        trainingFocus: "Admitir a ausência documental e encaminhar a obtenção, sem improvisar.",
      },
      delay: {
        persona: { firstName: "Juliana", role: "Administradora", companyType: "Oficina calçadista", style: "organizada e sem pressa" },
        opening: "Ainda tenho produto para usar e não quero analisar outra opção neste mês.",
        trainingFocus: "Perguntar quando retomar e encerrar sem urgência artificial.",
      },
      need: {
        persona: { firstName: "Roberto", role: "Proprietário", companyType: "Pequena produção", style: "satisfeito com a solução atual" },
        opening: "O que eu uso hoje não está me dando problema. Por que eu deveria analisar o AM 02?",
        trainingFocus: "Explorar se há necessidade real e não atribuir vantagens sem documento.",
      },
      deadline: {
        persona: { firstName: "Aline", role: "Assistente de compras", companyType: "Produção calçadista", style: "urgente e direta" },
        opening: "Preciso fechar a compra hoje. Você garante que este produto atende meu processo e que estará disponível?",
        trainingFocus: "Coletar dados e encaminhar confirmações técnica e comercial separadamente.",
      },
    },
  },
  {
    id: "kisafix-pvc-couro-especial",
    name: "Cola PVC Couro Especial Kisafix/Killing",
    shortName: "PVC Couro Especial",
    brand: "Kisafix/Killing",
    trainingMode: "documentary",
    trainingNote: "Somente treino de consulta documental. Código, rótulo e documentação do item exato ainda precisam ser confirmados.",
    category: "Adesivos",
    image: "/products/pvc-couro-especial-lata.webp",
    summary:
      "Adesivo identificado comercialmente como PVC Couro Especial; a indicação depende de documentação técnica vigente.",
    applications: ["Investigação do processo do cliente", "Coleta do código e do rótulo", "Encaminhamento para validação técnica"],
    caution:
      "O nome comercial não basta para indicar materiais, procedimento, desempenho ou segurança.",
    facts: [
      pending(
        "PVC-01",
        "O item foi identificado no projeto como Cola PVC Couro Especial Kisafix/Killing; o código oficial atual ainda precisa ser confirmado.",
        "Curadoria interna do protótipo; validação específica pendente",
        kisafixSource,
      ),
      documented(
        "PVC-02",
        "O catálogo oficial Kisafix apresenta famílias de adesivos para processos calçadistas, mas não confirma o nome comercial exato usado no protótipo.",
        "Linha oficial Kisafix para calçados",
        kisafixSource,
      ),
      pending(
        "PVC-03",
        "A indicação exige rótulo, código, ficha técnica e FDS vigentes; não se deve inferir composição ou equivalência pelo termo PVC.",
        "Regra de segurança da base controlada",
        "https://www.killing.com.br/empresa",
      ),
    ],
    scenarios: {
      price: {
        persona: { firstName: "Marcelo", role: "Sapateiro", companyType: "Oficina artesanal", style: "prático e comparador" },
        opening: "O custo parece maior do que o de uma cola que já uso. Que informação concreta você tem para eu avaliar?",
        trainingFocus: "Perguntar a necessidade e informar a pendência documental sem alegar superioridade.",
      },
      "current-supplier": {
        persona: { firstName: "Beatriz", role: "Compradora", companyType: "Confecção de artefatos", style: "cuidadosa com o processo" },
        opening: "Já tenho um fornecedor e um produto definidos. Não quero colocar meu processo em risco só para experimentar.",
        trainingFocus: "Reconhecer a preocupação e encaminhar somente análise documental, sem teste de aplicação ou troca nesta etapa.",
      },
      trust: {
        persona: { firstName: "Henrique", role: "Técnico", companyType: "Oficina de produção", style: "criterioso com documentos" },
        opening: "Qual é o código oficial desse produto e onde está o boletim do fabricante? PVC Couro Especial é pouco para eu aprovar.",
        trainingFocus: "Declarar a pendência e solicitar rótulo, código, ficha e FDS.",
      },
      delay: {
        persona: { firstName: "Natália", role: "Gestora", companyType: "Oficina de artefatos", style: "planejadora" },
        opening: "Agora não é o momento de mexer nisso. Podemos conversar quando eu revisar os insumos do próximo período.",
        trainingFocus: "Compreender o calendário e combinar retomada sem pressionar.",
      },
      need: {
        persona: { firstName: "Eduardo", role: "Responsável pela operação", companyType: "Produção artesanal", style: "satisfeito com o processo" },
        opening: "Minha colagem atual atende o que preciso. Não vejo uma necessidade clara para outro produto.",
        trainingFocus: "Investigar requisito não atendido e aceitar a ausência de necessidade.",
      },
      deadline: {
        persona: { firstName: "Patrícia", role: "Compradora", companyType: "Produção de artefatos", style: "pressionada pelo prazo" },
        opening: "Preciso iniciar um lote em poucos dias. Você confirma agora que essa cola é adequada e que consigo receber antes?",
        trainingFocus: "Separar a validação técnica da disponibilidade, sem prometer.",
      },
    },
  },
  {
    id: "vonixx-vfloc-500ml",
    name: "V-FLOC Vonixx 500 ml",
    shortName: "V-FLOC 500 ml",
    brand: "Vonixx",
    trainingMode: "commercial",
    trainingNote: "Treino comercial inicial para lavagem externa. Benefícios declarados não são garantia de resultado ou economia.",
    category: "Cuidados automotivos",
    image: "/products/v-floc-vonixx-500ml.webp",
    summary:
      "Lava-autos automotivo de pH neutro para lavagem externa, conforme orientação da fabricante.",
    applications: ["Lavagem externa com balde", "Lavagem externa com snow foam", "Uso conforme diluição e rótulo"],
    caution:
      "Não é limpador de couro. Técnica, enxágue, rótulo e FDS devem ser respeitados.",
    facts: [
      documented("VFL-01", "A fabricante informa pH 7,0 e apresenta o V-FLOC como lava-autos automotivo de pH neutro.", "Página oficial V-FLOC", vflocSource),
      documented("VFL-02", "A versão de 500 ml integra as apresentações oficiais.", "Página oficial V-FLOC", vflocSource),
      documented("VFL-03", "A fabricante publica diluição de 1:20 para snow foam e de até 1:400 para lavagem comum com balde, conforme o nível de sujeira.", "Página oficial V-FLOC", vflocSource),
      documented("VFL-04", "A página oficial indica lavagem da pintura externa. Esta base não documenta indicação para limpeza de couro.", "Página oficial V-FLOC — indicação", vflocSource),
      documented("VFL-05", "A fabricante declara alto grau de lubrificação, que melhora o deslize da luva de microfibra e ajuda a reduzir o atrito na pintura; isso não é garantia de ausência de riscos.", "Página oficial V-FLOC — descrição e FAQ", vflocSource),
      documented("VFL-06", "O modo de uso publicado inclui pré-lavagem, diluição conforme a sujeira e enxágue até retirar o produto. pH neutro não dispensa as orientações de uso e segurança.", "Página oficial V-FLOC — modo de uso", vflocSource),
    ],
    scenarios: {
      price: {
        persona: { firstName: "Lucas", role: "Entusiasta automotivo", companyType: "Uso doméstico", style: "comparador e curioso" },
        opening: "Eu já encontro shampoo automotivo por menos. O que devo comparar além do preço?",
        trainingFocus: "Entender o método e explicar características sem calcular economia.",
      },
      "current-supplier": {
        persona: { firstName: "Camila", role: "Responsável pela operação", companyType: "Lava-rápido", style: "fiel à rotina da equipe" },
        opening: "Meu fornecedor entrega o shampoo que usamos e a equipe já conhece o processo. Por que eu mudaria?",
        trainingFocus: "Reconhecer o custo de mudança e propor comparação ou teste controlado.",
      },
      trust: {
        persona: { firstName: "Gustavo", role: "Proprietário de veículo", companyType: "Uso doméstico", style: "cuidadoso com a pintura" },
        opening: "Tenho receio de marcar a pintura. Onde o fabricante informa o pH e a forma correta de diluir?",
        trainingFocus: "Apontar dados oficiais e evitar promessa de risco zero.",
      },
      delay: {
        persona: { firstName: "Fernanda", role: "Usuária", companyType: "Uso doméstico", style: "sem urgência" },
        opening: "Parece interessante, mas só vou pensar nisso quando o meu shampoo atual acabar.",
        trainingFocus: "Identificar quando retomar e respeitar o adiamento.",
      },
      need: {
        persona: { firstName: "Tiago", role: "Gestor", companyType: "Estética automotiva", style: "experiente e direto" },
        opening: "Já trabalho com um shampoo de pH neutro. Que necessidade diferente este produto atenderia?",
        trainingFocus: "Perguntar critérios, apresentar fatos e aceitar funções semelhantes.",
      },
      deadline: {
        persona: { firstName: "Larissa", role: "Organizadora da operação", companyType: "Frota empresarial fictícia", style: "orientada por prazo" },
        opening: "Preciso começar as lavagens logo. Você garante a quantidade e a entrega no prazo?",
        trainingFocus: "Separar orientação de uso de estoque e entrega.",
      },
    },
  },
  {
    id: "vonixx-hidracouro-500ml",
    name: "Hidracouro Vonixx 500 ml",
    shortName: "Hidracouro 500 ml",
    brand: "Vonixx",
    trainingMode: "commercial",
    trainingNote: "Treino comercial inicial para hidratação e proteção. Não confundir com limpeza ou recuperação de rachaduras.",
    category: "Cuidados com couro",
    image: "/products/hidracouro-500ml.webp",
    summary:
      "Hidratante e protetor de couro pronto para uso, formulado à base de lanolina.",
    applications: ["Couro natural", "Couro sintético", "Couro vinil e couro plástico, conforme a FAQ"],
    caution:
      "Não aplicar em couro danificado ou rachado, superfície quente ou sob luz solar direta.",
    facts: [
      documented("HID-01", "A fabricante apresenta o Hidracouro como produto pronto para uso, formulado à base de lanolina, destinado à hidratação e proteção de bancos de couro.", "Página oficial Hidracouro", hidracouroSource),
      documented("HID-02", "A FAQ oficial inclui couro natural, couro sintético, couro vinil e couro plástico entre os tipos de couro indicados; isso não autoriza generalizar o uso para qualquer peça plástica.", "Página oficial Hidracouro — FAQ", hidracouroSource),
      documented("HID-03", "A fabricante recomenda limpeza prévia e aplicação uniforme com aplicador de espuma. Portanto, neste procedimento, hidratar e proteger é uma etapa posterior e não substitui a limpeza.", "Página oficial Hidracouro — modo de uso; distinção de etapas derivada dessa orientação", hidracouroSource),
      documented("HID-04", "A fabricante orienta não aplicar em couro danificado ou rachado, superfície quente ou sob luz solar direta.", "Página oficial Hidracouro — FAQ", hidracouroSource),
      documented("HID-05", "Para quem prefere aspecto fosco, a fabricante recomenda acabamento com toalha de microfibra limpa e seca após a aplicação.", "Página oficial Hidracouro — modo de uso", hidracouroSource),
    ],
    scenarios: {
      price: {
        persona: { firstName: "Daniela", role: "Proprietária de veículo", companyType: "Uso doméstico", style: "atenta ao valor" },
        opening: "Vi opções mais baratas. O que preciso observar para decidir se este produto faz sentido?",
        trainingFocus: "Perguntar o tipo e estado da superfície e não prometer durabilidade ou economia.",
      },
      "current-supplier": {
        persona: { firstName: "Vinícius", role: "Profissional de detalhamento", companyType: "Estética automotiva", style: "apegado à rotina da equipe" },
        opening: "Minha equipe já está acostumada com outro hidratante. Trocar significa rever a rotina.",
        trainingFocus: "Reconhecer o impacto e propor análise responsável sem depreciar concorrentes.",
      },
      trust: {
        persona: { firstName: "Elisa", role: "Proprietária de veículo", companyType: "Uso doméstico", style: "cuidadosa com material sintético" },
        opening: "Meu banco não é de couro natural. A fabricante realmente informa uso em material sintético?",
        trainingFocus: "Responder com a indicação oficial e confirmar o estado da superfície.",
      },
      delay: {
        persona: { firstName: "Sérgio", role: "Usuário", companyType: "Uso doméstico", style: "sem prioridade imediata" },
        opening: "Vou deixar a hidratação para outra época. Agora não é prioridade.",
        trainingFocus: "Entender o momento e aceitar o adiamento sem alarmismo.",
      },
      need: {
        persona: { firstName: "Priscila", role: "Proprietária de veículo", companyType: "Uso doméstico", style: "focada apenas em limpeza" },
        opening: "Eu já limpo os bancos com frequência. Não vejo por que usar outro produto depois.",
        trainingFocus: "Explicar a finalidade específica segundo a fabricante, sem impor a compra.",
      },
      deadline: {
        persona: { firstName: "João", role: "Preparador de veículo", companyType: "Serviço automotivo", style: "apressado e exigente" },
        opening: "Preciso deixar os bancos prontos até amanhã. Você garante o resultado e a entrega hoje?",
        trainingFocus: "Não garantir resultado nem entrega e conferir as condições de aplicação.",
      },
    },
  },
];

const configSchema = z
  .object({
    version: z.string().min(1),
    products: z.array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        facts: z.array(z.object({ id: z.string().min(1), statement: z.string().min(1) })).min(1),
        scenarios: z.record(z.string(), z.object({ opening: z.string().min(1) })),
      }).passthrough(),
    ).length(5),
    objections: z.array(z.object({ id: z.string().min(1) }).passthrough()).length(6),
  })
  .strict();

configSchema.parse({ version: CONFIG_VERSION, products, objections });

const productIds = new Set(products.map((product) => product.id));
const evidenceIds = new Set(products.flatMap((product) => product.facts.map((fact) => fact.id)));
if (productIds.size !== products.length) throw new Error("IDs de produto duplicados.");
if (evidenceIds.size !== products.flatMap((product) => product.facts).length) {
  throw new Error("IDs de evidência duplicados.");
}
for (const product of products) {
  for (const objection of objections) {
    if (!(objection.id in product.scenarios)) {
      throw new Error(`Cenário ausente: ${product.id}/${objection.id}`);
    }
  }
}

export const CONFIG_HASH = createHash("sha256")
  .update(JSON.stringify({ version: CONFIG_VERSION, products, objections, difficulties }))
  .digest("hex");

export function getProduct(productId: string): ProductDefinition | undefined {
  return products.find((product) => product.id === productId);
}

export function getObjection(objectionId: string): PublicObjection | undefined {
  return objections.find((objection) => objection.id === objectionId);
}

export function getDifficulty(difficulty: Difficulty) {
  return difficulties.find((item) => item.id === difficulty);
}

export function getScenario(productId: string, objectionId: string) {
  const product = getProduct(productId);
  const objection = getObjection(objectionId);
  if (!product || !objection) return null;
  const scenario = product.scenarios[objection.id as ObjectionId];
  return scenario ? { product, objection, scenario } : null;
}

export function publicProducts(): PublicProduct[] {
  return products.map(({ facts: _facts, scenarios: _scenarios, ...product }) => product);
}
