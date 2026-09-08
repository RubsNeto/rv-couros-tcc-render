import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  ExternalLink,
  FileCheck2,
  LoaderCircle,
  MessageSquareText,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  UserRound,
} from "lucide-react";
import type {
  Difficulty,
  TrainingConfigResponse,
  TrainingFinishResponse,
  TrainingStartResponse,
} from "@shared/training";
import {
  cancelTraining,
  finishTraining,
  loadTrainingConfig,
  sendTrainingMessage,
  startTraining,
} from "../services/trainingApi";

type Phase = "setup" | "chat" | "feedback";
type BusyState = "config" | "start" | "message" | "finish" | null;

interface UiMessage {
  id: string;
  role: "client" | "seller";
  text: string;
}

const criterionLabels: Record<keyof TrainingFinishResponse["feedback"]["criteria"], string> = {
  acknowledgedObjection: "Reconheceu a preocupação do cliente",
  askedRelevantQuestion: "Fez uma pergunta útil",
  usedSupportedFact: "Usou a base de informações",
  avoidedUnsupportedClaims: "Evitou promessas sem apoio",
  proposedNextStep: "Propôs um próximo passo",
};

export function TrainingPage() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [config, setConfig] = useState<TrainingConfigResponse | null>(null);
  const [productId, setProductId] = useState("");
  const [objectionId, setObjectionId] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [session, setSession] = useState<TrainingStartResponse | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [feedback, setFeedback] = useState<TrainingFinishResponse | null>(null);
  const [busy, setBusy] = useState<BusyState>("config");
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const phaseHeadingRef = useRef<HTMLHeadingElement>(null);
  const activeSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;
    loadTrainingConfig()
      .then((value) => {
        if (!mounted) return;
        setConfig(value);
        setBusy(null);
      })
      .catch((requestError: Error) => {
        if (!mounted) return;
        setError(requestError.message);
        setBusy(null);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (phase === "chat") bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, phase, busy]);

  useEffect(() => {
    phaseHeadingRef.current?.focus({ preventScroll: true });
  }, [phase]);

  useEffect(
    () => () => {
      const sessionId = activeSessionIdRef.current;
      if (sessionId) void cancelTraining(sessionId, true).catch(() => undefined);
    },
    [],
  );

  const selectedProduct = useMemo(
    () => config?.products.find((product) => product.id === productId) ?? null,
    [config, productId],
  );
  const selectedObjection = useMemo(
    () => config?.objections.find((objection) => objection.id === objectionId) ?? null,
    [config, objectionId],
  );

  async function beginTraining() {
    if (!productId || !objectionId || !config?.ai.available) return;
    setError("");
    setBusy("start");
    try {
      const value = await startTraining({ productId, objectionId, difficulty });
      activeSessionIdRef.current = value.sessionId;
      setSession(value);
      setMessages([{ id: crypto.randomUUID(), role: "client", text: value.message }]);
      setFeedback(null);
      setPhase("chat");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível iniciar.");
    } finally {
      setBusy(null);
    }
  }

  async function submitMessage(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!session || text.length < 2 || busy) return;
    const previous = messages;
    setError("");
    setDraft("");
    setMessages([...previous, { id: crypto.randomUUID(), role: "seller", text }]);
    setBusy("message");
    try {
      const value = await sendTrainingMessage(session.sessionId, text);
      setSession((current) =>
        current ? { ...current, turnCount: value.turnCount } : current,
      );
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "client", text: value.message },
      ]);
    } catch (requestError) {
      setMessages(previous);
      setDraft(text);
      setError(requestError instanceof Error ? requestError.message : "Não foi possível enviar.");
    } finally {
      setBusy(null);
    }
  }

  async function concludeTraining() {
    if (!session || session.turnCount < 1 || busy) return;
    setBusy("finish");
    setError("");
    try {
      const value = await finishTraining(session.sessionId);
      activeSessionIdRef.current = null;
      setFeedback(value);
      setPhase("feedback");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Não foi possível gerar o retorno.",
      );
    } finally {
      setBusy(null);
    }
  }

  function resetTraining(confirmAbandon = false) {
    if (
      confirmAbandon &&
      session &&
      !window.confirm("Trocar de cenário? A conversa atual será encerrada.")
    ) {
      return;
    }
    const sessionId = activeSessionIdRef.current;
    activeSessionIdRef.current = null;
    if (sessionId) void cancelTraining(sessionId).catch(() => undefined);
    setPhase("setup");
    setSession(null);
    setMessages([]);
    setDraft("");
    setFeedback(null);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (busy === "config") {
    return (
      <div className="centered-state">
        <LoaderCircle className="spin" aria-hidden="true" />
        <p>Preparando os cenários de treinamento…</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="centered-state">
        <div className="state-card" role="alert">
          <AlertCircle aria-hidden="true" />
          <p className="eyebrow">Falha de conexão</p>
          <h1>Não foi possível carregar o treinamento.</h1>
          <p>{error || "Confirme se o servidor está em execução e tente novamente."}</p>
          <button className="button primary" type="button" onClick={() => window.location.reload()}>
            <RefreshCw size={18} aria-hidden="true" />
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="training-section">
      <div className="container">
        <div className="training-topline">
          <div>
            <p className="eyebrow">Treinamento de objeções</p>
            <h1 ref={phaseHeadingRef} tabIndex={-1}>
              {phase === "setup" && "Escolha uma situação para praticar"}
              {phase === "chat" && "Converse com o cliente fictício"}
              {phase === "feedback" && "Retorno do seu treinamento"}
            </h1>
          </div>
          <div className="phase-indicator" aria-label="Etapas do treinamento">
            {["Escolha", "Conversa", "Retorno"].map((label, index) => {
              const activeIndex = phase === "setup" ? 0 : phase === "chat" ? 1 : 2;
              return (
                <span
                  key={label}
                  className={index <= activeIndex ? "done" : ""}
                  aria-current={index === activeIndex ? "step" : undefined}
                >
                  {index < activeIndex ? <Check size={14} aria-hidden="true" /> : index + 1}
                  <b>{label}</b>
                </span>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="inline-alert" role="alert" aria-live="assertive">
            <AlertCircle size={19} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <AnimatePresence mode="wait">
          {phase === "setup" && (
            <motion.div
              key="setup"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="setup-stack"
            >
              {!config.ai.available && (
                <div className="inline-alert" role="alert">
                  <ShieldAlert size={20} aria-hidden="true" />
                  <span>
                    A chave da OpenAI não está configurada no servidor. O treinamento fica
                    indisponível até essa configuração ser concluída.
                  </span>
                </div>
              )}

              <fieldset className="choice-section">
                <legend>
                  <span>1</span>
                  Qual situação você quer treinar?
                </legend>
                <p className="field-help">Escolha o tipo de dúvida que o cliente apresentará.</p>
                <div className="objection-grid" role="radiogroup" aria-label="Situação comercial">
                  {config.objections.map((objection) => (
                    <button
                      type="button"
                      role="radio"
                      key={objection.id}
                      className={objectionId === objection.id ? "choice-card selected" : "choice-card"}
                      aria-checked={objectionId === objection.id}
                      onClick={() => setObjectionId(objection.id)}
                    >
                      <span className="radio-mark">
                        {objectionId === objection.id ? <Check size={15} /> : <Circle size={15} />}
                      </span>
                      <strong>{objection.label}</strong>
                      <small>{objection.summary}</small>
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="choice-section">
                <legend>
                  <span>2</span>
                  Sobre qual produto será a conversa?
                </legend>
                <p className="field-help">
                  Três produtos têm treino comercial inicial. AM 02 e PVC Couro Especial permitem
                  somente praticar a consulta de documentação, sem indicar uso ou vantagens.
                </p>
                <div className="product-choice-grid" role="radiogroup" aria-label="Produto">
                  {config.products.map((product) => (
                    <button
                      type="button"
                      role="radio"
                      key={product.id}
                      className={productId === product.id ? "product-choice selected" : "product-choice"}
                      aria-checked={productId === product.id}
                      onClick={() => setProductId(product.id)}
                    >
                      <div className="product-image-wrap">
                        <img src={product.image} alt={`Embalagem de ${product.name}`} />
                      </div>
                      <div>
                        <span>{product.brand}</span>
                        <strong>{product.shortName}</strong>
                        <small>{product.trainingMode === "documentary" ? "Somente consulta documental" : "Treino comercial inicial"}</small>
                      </div>
                      <span className="select-check">
                        <Check size={15} aria-hidden="true" />
                      </span>
                    </button>
                  ))}
                </div>
                {selectedProduct && (
                  <div className="sidebar-note" role="status">
                    <FileCheck2 size={18} aria-hidden="true" />
                    <div>
                      <p><strong>{selectedProduct.trainingNote}</strong></p>
                      <p>{selectedProduct.summary}</p>
                      <p>{selectedProduct.caution}</p>
                    </div>
                  </div>
                )}
              </fieldset>

              <fieldset className="choice-section">
                <legend>
                  <span>3</span>
                  Escolha o nível da conversa
                </legend>
                <div className="difficulty-row" role="radiogroup" aria-label="Nível da conversa">
                  {config.difficulties.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      className={difficulty === item.id ? "difficulty selected" : "difficulty"}
                      aria-checked={difficulty === item.id}
                      onClick={() => setDifficulty(item.id)}
                    >
                      <strong>{item.label}</strong>
                      <small>{item.summary}</small>
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="start-summary">
                <div>
                  <span>CENÁRIO ESCOLHIDO</span>
                  <strong>
                    {selectedObjection?.label ?? "Escolha uma situação"}
                    <ChevronRight size={16} aria-hidden="true" />
                    {selectedProduct?.shortName ?? "Escolha um produto"}
                  </strong>
                  <small>
                    Nível {config.difficulties.find((item) => item.id === difficulty)?.label} · até{" "}
                    {config.maxSellerTurns} respostas · conversa somente por texto
                  </small>
                </div>
                <button
                  className="button primary large"
                  type="button"
                  disabled={!productId || !objectionId || !config.ai.available || busy === "start"}
                  onClick={beginTraining}
                >
                  {busy === "start" ? (
                    <LoaderCircle className="spin" size={19} aria-hidden="true" />
                  ) : (
                    <ArrowRight size={19} aria-hidden="true" />
                  )}
                  {busy === "start" ? "Iniciando…" : "Começar conversa"}
                </button>
              </div>
              <p className="data-reminder">
                <ShieldAlert size={17} aria-hidden="true" />
                Não copie uma conversa real. Nomes, empresas e situações deste treino são fictícios.
              </p>
            </motion.div>
          )}

          {phase === "chat" && session && selectedProduct && selectedObjection && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="chat-layout"
            >
              <aside className="scenario-sidebar">
                <button className="text-button" type="button" onClick={() => resetTraining(true)}>
                  <ArrowLeft size={16} aria-hidden="true" />
                  Trocar cenário
                </button>
                <div className="sidebar-product">
                  <img src={selectedProduct.image} alt={`Embalagem de ${selectedProduct.name}`} />
                  <span>{selectedProduct.brand}</span>
                  <strong>{selectedProduct.shortName}</strong>
                </div>
                <dl className="scenario-details">
                  <div><dt>Situação</dt><dd>{selectedObjection.label}</dd></div>
                  <div><dt>Nível</dt><dd>{config.difficulties.find((item) => item.id === difficulty)?.label}</dd></div>
                  <div><dt>Cliente</dt><dd>{session.persona.firstName}, {session.persona.role}</dd></div>
                </dl>
                <div className="sidebar-note">
                  <FileCheck2 size={18} aria-hidden="true" />
                  <p>
                    Responda com sinceridade. Quando não souber um fato, proponha uma verificação.
                  </p>
                </div>
                <p className="field-help">{selectedProduct.trainingNote}</p>
              </aside>

              <div className="chat-panel">
                <div className="chat-header">
                  <div className="avatar"><UserRound aria-hidden="true" /></div>
                  <div>
                    <strong>{session.persona.firstName}</strong>
                    <span>{session.persona.companyType} · cliente fictício</span>
                  </div>
                  <div className="turn-counter">
                    {session.turnCount}/{session.maxSellerTurns} respostas
                  </div>
                </div>

                <div className="messages" aria-live="polite" aria-label="Conversa simulada">
                  {messages.map((message) => (
                    <div key={message.id} className={`message-row ${message.role}`}>
                      <div className="message-label">
                        {message.role === "client" ? <Bot size={15} /> : <UserRound size={15} />}
                        {message.role === "client" ? session.persona.firstName : "Você"}
                      </div>
                      <p>{message.text}</p>
                    </div>
                  ))}
                  {busy === "message" && (
                    <div className="message-row client typing" role="status">
                      <div className="message-label"><Bot size={15} />{session.persona.firstName}</div>
                      <p><span /><span /><span /><b className="sr-only">Digitando resposta</b></p>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>

                <form className="composer" onSubmit={submitMessage}>
                  <label htmlFor="seller-message">Sua resposta ao cliente</label>
                  <textarea
                    id="seller-message"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value.slice(0, 1200))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                    placeholder="Escreva como você responderia no atendimento…"
                    rows={3}
                    disabled={busy !== null || session.turnCount >= session.maxSellerTurns}
                  />
                  <div className="composer-footer">
                    <span>{draft.length}/1200 · Enter envia; Shift + Enter quebra a linha</span>
                    <button
                      className="button primary"
                      type="submit"
                      disabled={draft.trim().length < 2 || busy !== null || session.turnCount >= session.maxSellerTurns}
                    >
                      <Send size={17} aria-hidden="true" />
                      Enviar
                    </button>
                  </div>
                </form>

                <div className="chat-actions">
                  <p>
                    {session.turnCount < 1
                      ? "Envie ao menos uma resposta para liberar o retorno."
                      : session.turnCount >= session.maxSellerTurns
                        ? "Limite alcançado. Gere agora o retorno do treino."
                        : "Você pode continuar ou finalizar quando achar suficiente."}
                  </p>
                  <button
                    type="button"
                    className="button secondary"
                    disabled={session.turnCount < 1 || busy !== null}
                    onClick={concludeTraining}
                  >
                    {busy === "finish" ? (
                      <LoaderCircle className="spin" size={18} aria-hidden="true" />
                    ) : (
                      <Sparkles size={18} aria-hidden="true" />
                    )}
                    {busy === "finish" ? "Analisando conversa…" : "Finalizar e receber retorno"}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {phase === "feedback" && feedback && selectedProduct && selectedObjection && (
            <motion.div
              key="feedback"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="feedback-stack"
            >
              <div className="feedback-hero">
                <div className="feedback-icon"><Sparkles aria-hidden="true" /></div>
                <div>
                  <span>ANÁLISE FORMATIVA · SEM NOTA</span>
                  <h2>{selectedObjection.label} · {selectedProduct.shortName}</h2>
                  <p>{feedback.feedback.summary}</p>
                </div>
              </div>

              <div className="feedback-grid">
                <article className="feedback-card positive">
                  <div className="card-title"><CheckCircle2 aria-hidden="true" /><h3>Pontos fortes</h3></div>
                  {feedback.feedback.strengths.length > 0
                    ? <ul>{feedback.feedback.strengths.map((item) => <li key={item}>{item}</li>)}</ul>
                    : <p>Ainda não há comportamento comercial suficiente para destacar um ponto forte.</p>}
                </article>
                <article className="feedback-card improve">
                  <div className="card-title"><ArrowRight aria-hidden="true" /><h3>O que pode melhorar</h3></div>
                  {feedback.feedback.improvements.length > 0
                    ? <ul>{feedback.feedback.improvements.map((item) => <li key={item}>{item}</li>)}</ul>
                    : <p>Nenhuma melhoria específica foi apontada nesta conversa. Isso não representa uma certificação.</p>}
                </article>
              </div>

              <article className="suggested-response">
                <span>UMA RESPOSTA POSSÍVEL</span>
                <blockquote>“{feedback.feedback.suggestedResponse}”</blockquote>
                <p><strong>Próximo passo:</strong> {feedback.feedback.nextStep}</p>
              </article>

              <article className="criteria-card">
                <div className="card-title"><FileCheck2 aria-hidden="true" /><h3>O que foi observado</h3></div>
                <p className="card-intro">
                  Estes itens descrevem somente esta conversa. Eles não são uma nota nem comprovam
                  aprendizado ou aumento de vendas.
                </p>
                <div className="criteria-list">
                  {Object.entries(feedback.feedback.criteria).map(([key, passed]) => (
                    <div key={key} className={passed ? "criterion passed" : "criterion"}>
                      {passed ? <Check size={16} aria-hidden="true" /> : <Circle size={16} aria-hidden="true" />}
                      <span>{criterionLabels[key as keyof typeof criterionLabels]}</span>
                      <small>{passed === null ? "Não verificado pela base" : passed ? "Observado" : "A melhorar / não observado"}</small>
                    </div>
                  ))}
                </div>
              </article>

              {feedback.feedback.claimsToCheck.length > 0 && (
                <article className="check-card">
                  <div className="card-title"><ShieldAlert aria-hidden="true" /><h3>Contradições ou promessas sem confirmação</h3></div>
                  <p>
                    A IA apontou possíveis conflitos com a base ou garantias sem confirmação.
                    Confira as fontes: a avaliação também pode errar.
                  </p>
                  <ul>{feedback.feedback.claimsToCheck.map((claim) => <li key={claim}>{claim}</li>)}</ul>
                </article>
              )}

              {feedback.feedback.unverifiedClaims.length > 0 && (
                <article className="check-card">
                  <div className="card-title"><FileCheck2 aria-hidden="true" /><h3>Informações ainda não verificadas pela base</h3></div>
                  <p>Não significa que você errou. O aplicativo não consulta os documentos inteiros;
                    estes detalhes precisam ser conferidos na fonte pelo responsável pela base.</p>
                  <ul>{feedback.feedback.unverifiedClaims.map((claim) => <li key={claim}>{claim}</li>)}</ul>
                </article>
              )}

              <details className="evidence-card">
                <summary>
                  <FileCheck2 size={18} aria-hidden="true" />
                  Informações atribuídas à sua fala ({feedback.evidenceUsed.length})
                </summary>
                {feedback.evidenceUsed.length === 0 ? (
                  <p>Nenhuma informação específica da base foi atribuída à sua resposta.</p>
                ) : (
                  <div className="evidence-list">
                    {feedback.evidenceUsed.map((fact) => (
                      <div key={fact.id}>
                        <span>{fact.id} · {fact.status === "documented" ? "documentado" : "validação pendente"}</span>
                        <p>{fact.statement}</p>
                        {feedback.feedback.sellerEvidence.filter((item) => item.evidenceId === fact.id).map((item, index) => (
                          <p key={index}><strong>Trecho da sua fala:</strong> “{item.sellerQuote}”</p>
                        ))}
                        <a href={fact.sourceUrl} target="_blank" rel="noreferrer">
                          {fact.sourceLabel}<ExternalLink size={14} aria-hidden="true" />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </details>

              <details className="evidence-card">
                <summary><FileCheck2 size={18} aria-hidden="true" />Fontes da resposta sugerida pela IA ({feedback.suggestedEvidence.length})</summary>
                <p>Estas fontes apoiam a sugestão acima; não significam que você citou esses fatos.</p>
                <div className="evidence-list">
                  {feedback.suggestedEvidence.map((fact) => (
                    <div key={fact.id}>
                      <span>{fact.id} · consulta em {fact.consultedAt}</span>
                      <p>{fact.statement}</p>
                      <a href={fact.sourceUrl} target="_blank" rel="noreferrer">{fact.sourceLabel}<ExternalLink size={14} aria-hidden="true" /></a>
                    </div>
                  ))}
                </div>
              </details>

              <details className="technical-details">
                <summary>Dados técnicos desta execução</summary>
                <dl>
                  <div><dt>Modelo solicitado</dt><dd>{feedback.metadata.modelRequested ?? "não informado"}</dd></div>
                  <div><dt>Modelo retornado</dt><dd>{feedback.metadata.modelReturned ?? "não informado"}</dd></div>
                  <div><dt>Versão da base</dt><dd>{feedback.metadata.configVersion}</dd></div>
                  <div><dt>Respostas do vendedor</dt><dd>{feedback.metadata.sellerTurns}</dd></div>
                  <div><dt>Tokens totais</dt><dd>{feedback.metadata.totalTokens ?? "não informado"}</dd></div>
                </dl>
              </details>

              <div className="feedback-actions">
                <button className="button primary large" type="button" onClick={() => resetTraining()}>
                  <RefreshCw size={18} aria-hidden="true" />
                  Fazer outro treinamento
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
