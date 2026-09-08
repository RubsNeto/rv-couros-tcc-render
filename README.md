# RV Couros — Treinamento Comercial com IA

**Cópia de publicação no Render:** consulte `PUBLICACAO_RENDER.md` e `render.yaml`. A entrada `server/render.ts` protege a demonstração; o serviço de treinamento original foi preservado. Use `pnpm build:render` e `pnpm start:render` para essa modalidade. Os resultados acadêmicos abaixo referem-se à avaliação local anterior, não à camada de hospedagem.

Protótipo web desenvolvido no contexto do Trabalho de Conclusão de Curso:

> **Desenvolvimento de um protótipo web com inteligência artificial generativa para treinamento de objeções comerciais**

O vendedor escolhe uma situação e um produto previamente configurados, conversa por texto com um cliente fictício interpretado por IA e recebe um retorno formativo. O sistema não atribui nota, não mantém ranking e não promete aumento de vendas.

## Recorte funcional

- cinco produtos fixos: três para treino comercial inicial e dois somente para consulta documental;
- seis categorias de objeção;
- trinta combinações de cenário;
- três níveis de dificuldade;
- uma a cinco respostas do vendedor;
- abertura predefinida e continuação do cliente conduzida por IA;
- retorno final com pontos fortes, melhorias, resposta possível, próximo passo e rastreabilidade dos fatos;
- sessões temporárias apenas em memória.

Não há cadastro de empresa, produto ou cliente; painel de gestor; banco de dados; voz; gamificação; histórico permanente; preço; estoque; prazo real ou integração com sistemas da empresa.

## Como a IA recebe o contexto

O protótipo **não implementa RAG**. Para cada sessão, o servidor seleciona uma estrutura fixa que contém o produto, a situação, a persona sintética, as regras e os fatos permitidos. Esse conteúdo é inserido diretamente no contexto do modelo. A descrição técnica correta é **geração condicionada por contexto estruturado e controlado**.

O modelo padrão é gpt-5.6-luna, configurável por variável de ambiente. A documentação oficial informa compatibilidade com Chat Completions e Structured Outputs. O esforço de raciocínio usado pelo protótipo é low.

## Execução local

Requisitos:

- Node.js 22.12 ou superior;
- pnpm 10;
- chave de API da OpenAI com acesso ao modelo configurado.

Crie o arquivo .env a partir de .env.example com OPENAI_API_KEY e OPENAI_MODEL. A chave é lida apenas pelo servidor e o arquivo .env é ignorado pelo Git.

Instale e inicie a API:

    pnpm install --frozen-lockfile
    pnpm dev:server

Em outro terminal, inicie a interface:

    pnpm dev

Interface: http://localhost:3000
API: http://localhost:3001

Para a versão compilada:

    pnpm build
    pnpm start

Interface compilada: http://localhost:3001

Por segurança, a versão compilada escuta somente em `127.0.0.1` por padrão. O comando
`pnpm start` carrega o `.env` local, quando presente, e ativa os cabeçalhos de produção.

## Verificação

    pnpm check
    pnpm test
    pnpm build

A avaliação controlada fica em evaluation/. O conjunto principal usa 30 casos sintéticos (5 produtos × 6 objeções) e produz arquivos brutos, tabela de resultados e relatório descritivo. Os resultados se referem ao comportamento técnico do artefato na configuração congelada; não representam clientes reais nem comprovam aprendizagem ou conversão.

### Reexecutar a avaliação

A **pré-verificação não usa a API, não exige `.env`, não cria rodada e não tem custo de IA**:

    pnpm eval:preflight --purpose=primary --run=principal-reproducao-01

Ela verifica a proveniência, os hashes necessários e a matriz v1. Não mede a disponibilidade da API nem a qualidade de respostas novas. Em um checkout Git, registra commit e presença de modificações; no ZIP extraído, verifica `SOURCE_MANIFEST.json` e cada arquivo nele listado. O ZIP não precisa de Git instalado. Um Git localizado somente em uma pasta ancestral não é tratado como repositório do aplicativo.

Antes de qualquer chamada, a matriz deve declarar `rv-couros-eval-v1` e sua configuração de referência congelada (`rv-couros-2026-09-02-v1`), conter exatamente S01–S30 e manter os gabaritos coerentes com a segunda fala dos desafios. O piloto exige exatamente S01, S08, S15, S22, S29 e S30; uma seleção incompleta é recusada, nunca executada silenciosamente com menos casos.

No pacote, o commit de origem é uma declaração do manifesto: o relatório não afirma existir um commit local ou uma árvore Git limpa. O manifesto permite conferir integridade, mas não é assinatura de autenticidade. Arquivo ausente, alterado ou manifesto incompleto interrompe a execução antes da primeira chamada. Para modificar e pesquisar outra versão, trabalhe em um repositório próprio, registre a alteração e não atribua a ela os resultados da versão anterior.

**Os comandos seguintes fazem chamadas reais à OpenAI, podem gerar cobrança e exigem sua própria chave `.env`.** O piloto executa seis casos; a rodada principal executa os trinta casos. São rodadas diferentes e não devem ser misturadas:

    pnpm eval:run --purpose=pilot --run=piloto-reproducao-01
    pnpm eval:run --purpose=primary --run=principal-reproducao-01

Use identificadores novos. Um diretório de rodada já existente, inclusive uma rodada interrompida, nunca é sobrescrito. Sem `--purpose`, o padrão é `pilot`; valores diferentes de `pilot` e `primary` são recusados. Os registros ficam em `evaluation/results/<identificador>/`, com checkpoint e resultados brutos. Não execute `eval:dataset` para reproduzir a pesquisa: use o arquivo `dataset.v1.json` distribuído e congelado.

Para gerar o relatório e CSV, sem chamar IA:

    pnpm eval:report --run=principal-reproducao-01

O gerador mantém compatibilidade com resultados históricos que não possuam o campo `provenance`. Para conferir um resultado antigo, copie-o para **uma pasta de conferência nova**, conservando o original; o comando de relatório escreve somente `SUMMARY.md` e `results.csv` nessa pasta. Não confunda uma conferência de dados salvos ou um teste com provedor simulado com uma nova rodada real.

### Alcance do indicador de outros produtos

O campo histórico `noCrossProductLeakage` é mantido por compatibilidade. Seu significado é **ausência de menção literal aos nomes curtos de outros produtos nos campos examinados**: `clientMessages`, `summary`, `strengths`, `improvements`, `suggestedResponse` e `nextStep`. A busca ignora maiúsculas/minúsculas, mas não examina `claimsToCheck`, sinônimos ou transferência implícita de propriedades. Esse indicador não equivale a uma auditoria semântica completa. A revisão humana deve ser relatada separadamente.

### Gerar outro pacote de fonte

O mantenedor deve registrar as alterações em um commit e deixar a árvore limpa. A ferramenta exige Git apenas no empacotamento, extrai os blobs do commit e inclui manifesto SHA-256; não utiliza os timestamps ou finais de linha do checkout. A ordem, a data interna das entradas ZIP e a serialização são fixas, de modo que o mesmo commit gera o mesmo ZIP. A data no manifesto é a data do commit de origem, não uma data de execução inventada.

    pnpm source:package --out=C:/caminho/externo/RV_Couros_TCC_codigo_fonte.zip

Use caminho absoluto fora do repositório. Um arquivo ZIP existente não será substituído. Não são distribuídos `.git`, `node_modules`, builds, resultados, logs ou arquivos `.env`; `.env.example` é distribuído. Arquivos proibidos que tenham sido versionados por engano fazem o empacotamento falhar. Revise o inventário e verifique a ausência de segredos antes de compartilhar. Teste o ZIP em uma pasta vazia com `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm test`, `pnpm build` e `pnpm eval:preflight`.

Os testes específicos de proveniência Git criam repositórios temporários isolados e precisam do executável Git instalado. Isso é um requisito da suíte de desenvolvimento, não da inicialização do aplicativo nem da pré-verificação/avaliação a partir do ZIP íntegro.

Na revisão de 08/09/2026, a configuração passou para `rv-couros-2026-09-08-v2`: foram alterados fatos, prompts, contexto fictício, contrato de devolutiva e apresentação. O limite de saída da devolutiva passou de 1.200 para 2.000 tokens para acomodar os trechos de evidência. O modelo não foi alterado. Resultados históricos não descrevem automaticamente esta versão: ela exige rodada própria.

A matriz `dataset.v1.json` permanece intacta, incluindo a identificação de sua configuração original. A pré-verificação valida esse metadado congelado e a compatibilidade dos IDs com o aplicativo; a execução registra separadamente a configuração atual e seus hashes. As novas rodadas são regressões sobre as mesmas entradas, não reprodução exata do artefato antigo. Para reproduzir o artefato antigo, use o pacote/commit antigo. `eval:dataset` agora gera somente `dataset.proposed.json`, sem sobrescrever a matriz congelada; a proposta não é adotada automaticamente.

### Devolutiva na versão 2

- `claimsToCheck`: contradições com a base ou promessas absolutas/comerciais sem confirmação.
- `unverifiedClaims`: detalhes apenas ausentes da base; não são automaticamente erros.
- `avoidedUnsupportedClaims`: `false` quando há alerta, `null` quando há somente informação ainda não verificável, `true` quando não há essas pendências.
- `sellerEvidence` e `evidenceIds`: fatos atribuídos ao vendedor com trecho literal; o servidor deriva os IDs dos trechos aceitos.
- `suggestedEvidenceIds` e `suggestedEvidence`: fontes da resposta sugerida, não atribuídas ao vendedor.
- As listas de pontos fortes e melhorias podem estar vazias. Não há obrigação de elogiar uma saudação isolada.

O esquema da devolutiva mudou. Não valide resultados históricos com o esquema novo nem compare o significado dos critérios sem considerar essa mudança. Os indicadores automáticos históricos de formato e menção literal continuam limitados; não detectam toda inversão de papel ou erro de conteúdo.

A configuração corrente é `rv-couros-2026-09-08-v2.1`. Após a primeira rodada da v2, foram explicitados o alto grau de lubrificação declarado pelo fabricante e a distinção entre limpeza e hidratação, além de orientações para aceitar paráfrases e aproveitar dados já informados pelo cliente. `server/evidence-anchors.ts` acrescenta critérios lexicais conservadores por fato e rejeita atribuições genéricas ou trechos já sinalizados como contraditórios. Esses filtros podem omitir paráfrases válidas e não provam veracidade; permanecem necessários conferência da fonte e julgamento humano. Nenhum conteúdo técnico novo é buscado automaticamente nos links.

## Arquitetura resumida

    navegador React
      └─ IDs do produto, situação e nível
           └─ servidor Express
                ├─ configuração fixa e versionada
                ├─ sessão temporária em memória
                ├─ prompt do cliente fictício
                └─ OpenAI Chat Completions
                     ├─ resposta do cliente
                     └─ feedback JSON validado por Zod

O navegador nunca envia descrições de produto ou fatos técnicos. O servidor resolve os IDs e filtra identificadores de evidência que não pertencem à base do produto. Atribuições à fala do vendedor exigem um trecho literal dessa fala; fontes da sugestão da IA são separadas. A presença de um trecho não prova, sozinha, a pertinência semântica do fato.

## Base de produtos

As informações de Tekbond, V-FLOC e Hidracouro foram limitadas a páginas e fichas oficiais dos fabricantes. Para Amazonas AM 02 e PVC Couro Especial, a documentação pública específica não foi localizada; por isso, a base proíbe indicação técnica e orienta buscar ficha técnica, FDS e responsável técnico.

Todo preço, estoque, contato, prazo e dado de cliente foi excluído. Afirmações de fabricante são tratadas como descrição documental, não como eficácia comprovada de forma independente.

## Limitações

- protótipo acadêmico específico, não produto pronto para mercado;
- avaliação técnica, sem estudo com vendedores ou clientes;
- respostas probabilísticas podem variar entre execuções;
- a IA pode cometer erros, apesar das regras e validações;
- sessões são perdidas ao reiniciar o servidor;
- a aplicação não substitui orientação técnica, ficha técnica, FDS ou julgamento humano;
- resultados não podem ser generalizados para ganho de vendas.

## Proveniência

A versão do protótipo apresentada neste trabalho foi desenvolvida especificamente para os objetivos do TCC, mediante seleção, adaptação e refatoração de componentes técnicos de autoria do pesquisador.

Essa formulação registra com transparência o reaproveitamento de componentes próprios, sem apresentar a versão acadêmica como um sistema externo ao trabalho.
