import {
  Bot,
  Braces,
  Database,
  FileCheck2,
  LockKeyhole,
  MessageSquareText,
  ShieldCheck,
} from "lucide-react";
import { Link } from "wouter";

export function AboutPage() {
  return (
    <section className="section about-page">
      <div className="container narrow">
        <div className="page-intro">
          <p className="eyebrow">Sobre o protótipo</p>
          <h1>Uma ferramenta simples para praticar conversas comerciais</h1>
          <p>
            A aplicação cria um atendimento fictício por texto. O vendedor escolhe uma situação,
            responde ao cliente simulado pela inteligência artificial e recebe um retorno
            formativo sobre aquela conversa.
          </p>
        </div>

        <div className="about-callout">
          <MessageSquareText aria-hidden="true" />
          <div>
            <strong>A promessa do projeto</strong>
            <p>
              Permitir que um vendedor pratique o tratamento de objeções em cenários controlados e
              receba um feedback estruturado, sem usar dados de clientes reais.
            </p>
          </div>
        </div>

        <div className="about-sections">
          <article>
            <div className="about-icon"><Database aria-hidden="true" /></div>
            <div>
              <h2>O que já vem preparado</h2>
              <p>
                Três produtos permitem treino comercial inicial: Spray Reposicionável, V-FLOC e
                Hidracouro. AM 02 e PVC Couro Especial servem somente para treinar a consulta de
                documentação. São seis tipos de objeção e trinta combinações. O desenvolvedor
                administra os conteúdos; o vendedor não cadastra nem altera essas informações.
              </p>
            </div>
          </article>
          <article>
            <div className="about-icon"><Bot aria-hidden="true" /></div>
            <div>
              <h2>Onde a inteligência artificial participa</h2>
              <p>
                A primeira fala do cliente é predefinida para manter o cenário. Depois disso, a IA
                interpreta o cliente durante a conversa e produz o retorno final. Ela recebe apenas
                o produto, a situação, as regras do treino e a base controlada daquele item.
                Os links são referências para conferência humana: a IA não abre páginas ou PDFs
                durante a conversa.
              </p>
            </div>
          </article>
          <article>
            <div className="about-icon"><FileCheck2 aria-hidden="true" /></div>
            <div>
              <h2>Como as respostas são limitadas</h2>
              <p>
                Cada informação possui um identificador e uma fonte. Quando a documentação é
                insuficiente, o comportamento esperado é admitir a limitação e encaminhar a
                confirmação técnica ou comercial.
                A devolutiva distingue contradições de informações ainda não cadastradas e separa
                os fatos atribuídos à sua fala das fontes usadas na sugestão da IA.
              </p>
            </div>
          </article>
          <article>
            <div className="about-icon"><LockKeyhole aria-hidden="true" /></div>
            <div>
              <h2>Como os dados são tratados</h2>
              <p>
                As sessões ficam apenas na memória do servidor e expiram. O protótipo não possui
                usuários, histórico permanente, banco de dados ou cadastro de clientes.
              </p>
            </div>
          </article>
        </div>

        <section className="limits-section">
          <p className="eyebrow">Limites importantes</p>
          <h2>O que este projeto não afirma</h2>
          <div className="limits-grid">
            <div><ShieldCheck aria-hidden="true" /><span>Não comprova aumento de vendas ou conversão.</span></div>
            <div><ShieldCheck aria-hidden="true" /><span>Não mede aprendizagem de vendedores.</span></div>
            <div><ShieldCheck aria-hidden="true" /><span>Não substitui ficha técnica, FDS ou responsável técnico.</span></div>
            <div><ShieldCheck aria-hidden="true" /><span>Não foi desenvolvido como sistema pronto para o mercado.</span></div>
          </div>
        </section>

        <section className="origin-section">
          <Braces aria-hidden="true" />
          <div>
            <h2>Origem acadêmica</h2>
            <p>
              A versão apresentada foi desenvolvida especificamente para os objetivos do TCC,
              mediante seleção, adaptação e refatoração de componentes técnicos de autoria do
              pesquisador. Sua avaliação verifica o funcionamento em cenários controlados, sem
              generalizar os resultados para o uso cotidiano da empresa.
            </p>
          </div>
        </section>

        <div className="center-action">
          <Link className="button primary large" href="/treinar">Iniciar treinamento</Link>
        </div>
      </div>
    </section>
  );
}
