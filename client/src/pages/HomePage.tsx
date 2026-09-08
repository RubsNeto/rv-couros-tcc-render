import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Database,
  MessageSquareText,
  ShieldCheck,
} from "lucide-react";
import { Link } from "wouter";
import type { TrainingConfigResponse } from "@shared/training";
import { loadTrainingConfig } from "../services/trainingApi";

export function HomePage() {
  const [config, setConfig] = useState<TrainingConfigResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    let mounted = true;
    loadTrainingConfig()
      .then((value) => {
        if (mounted) {
          setConfig(value);
          setStatus(value.ai.available ? "ready" : "unavailable");
        }
      })
      .catch(() => {
        if (mounted) {
          setConfig(null);
          setStatus("unavailable");
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <>
      <section className="hero-section">
        <div className="industrial-grid" aria-hidden="true" />
        <div className="container hero-grid">
          <motion.div
            className="hero-copy"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            <div className="status-row">
              <span className={status === "ready" ? "status-dot ready" : "status-dot"} />
              {status === "ready"
                ? "Inteligência artificial pronta"
                : status === "loading"
                  ? "Verificando a inteligência artificial"
                  : config
                    ? "Inteligência artificial não configurada"
                    : "Servidor de treinamento indisponível"}
            </div>
            <p className="eyebrow">Protótipo acadêmico · RV Couros</p>
            <h1>
              Treine conversas difíceis
              <span> antes do atendimento real.</span>
            </h1>
            <p className="hero-lead">
              Escolha uma situação, converse por texto com um cliente fictício e receba orientações
              simples para melhorar sua resposta — sem nota, ranking ou exposição a clientes reais.
            </p>
            <div className="hero-actions">
              <Link href="/treinar" className="button primary large">
                Iniciar treinamento
                <ArrowRight size={19} aria-hidden="true" />
              </Link>
              <Link href="/sobre" className="button secondary large">
                Entender o protótipo
              </Link>
            </div>
            <p className="privacy-note">
              <ShieldCheck size={17} aria-hidden="true" />
              Use somente situações fictícias. Não informe dados de clientes.
            </p>
          </motion.div>

          <motion.div
            className="hero-demo"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            aria-label="Exemplo visual de uma conversa simulada"
          >
            <div className="demo-topbar">
              <div>
                <span className="demo-kicker">SIMULAÇÃO TEXTUAL</span>
                <strong>Cliente fictício · objeção de preço</strong>
              </div>
              <Bot size={22} aria-hidden="true" />
            </div>
            <div className="demo-product">
              <img
                src="/products/v-floc-vonixx-500ml.webp"
                alt="Embalagem do V-FLOC Vonixx 500 ml"
              />
              <div>
                <span>PRODUTO DO CENÁRIO</span>
                <strong>V-FLOC 500 ml</strong>
              </div>
            </div>
            <div className="demo-chat">
              <p className="bubble client">
                Eu já encontro shampoo automotivo por menos. O que devo comparar além do preço?
              </p>
              <p className="bubble seller">
                Entendo. Como você faz a lavagem hoje e qual resultado considera mais importante?
              </p>
            </div>
            <div className="demo-feedback">
              <CheckCircle2 size={20} aria-hidden="true" />
              <div>
                <strong>Boa pergunta de diagnóstico</strong>
                <span>O feedback explica o que funcionou e o que pode melhorar.</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-heading compact">
            <p className="eyebrow">Como funciona</p>
            <h2>Um caminho curto, com três etapas</h2>
          </div>
          <div className="steps-grid">
            <article className="step-card">
              <span className="step-number">01</span>
              <MessageSquareText aria-hidden="true" />
              <h3>Escolha a situação</h3>
              <p>Escolha uma das seis objeções. Há três produtos para treino comercial e dois para consulta documental.</p>
            </article>
            <article className="step-card">
              <span className="step-number">02</span>
              <Bot aria-hidden="true" />
              <h3>Converse com a IA</h3>
              <p>Responda ao cliente fictício em até cinco mensagens, como em um atendimento.</p>
            </article>
            <article className="step-card">
              <span className="step-number">03</span>
              <CheckCircle2 aria-hidden="true" />
              <h3>Leia o retorno</h3>
              <p>Veja pontos fortes, melhorias, uma resposta possível e informações usadas.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="section section-muted">
        <div className="container promise-grid">
          <div>
            <p className="eyebrow">Recorte do projeto</p>
            <h2>Pequeno de propósito. Claro para usar e para avaliar.</h2>
            <p>
              O protótipo não tenta administrar a empresa. Ele faz somente uma tarefa: criar um
              ambiente controlado para o vendedor praticar respostas a objeções comerciais.
            </p>
          </div>
          <div className="promise-list">
            <div><Database aria-hidden="true" /><span>3 produtos para treino comercial e 2 para consulta documental</span></div>
            <div><ShieldCheck aria-hidden="true" /><span>Base de informações controlada no servidor</span></div>
            <div><Bot aria-hidden="true" /><span>Abertura fixa; continuação e feedback com IA</span></div>
            <div><CheckCircle2 aria-hidden="true" /><span>Sem promessa de aumento de vendas</span></div>
          </div>
        </div>
      </section>
    </>
  );
}
