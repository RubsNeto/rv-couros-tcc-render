# Demonstração do TCC no Render

Esta cópia deriva dos 55 arquivos da aplicação-base, com acréscimo de uma entrada de publicação e ajustes nos comandos, nas instruções e na exclusão de arquivos secretos. Os produtos, prompts, serviço de IA, interface e sessões do aplicativo avaliado não foram modificados. O original e os registros científicos permanecem em suas pastas anteriores.

## Implantação

Criar um Blueprint no Render a partir deste repositório privado, usando `render.yaml`. O arquivo define um serviço web Node, plano gratuito, região Virginia, sem banco de dados, disco ou escalonamento. Publicações automáticas estão desativadas para evitar alterar a demonstração após a conferência.

Informar `OPENAI_API_KEY` somente no ambiente privado do serviço, nunca no repositório, no navegador do professor ou no manuscrito. O Render gera `DEMO_PASSWORD`; consultar esse valor no painel e compartilhá-lo diretamente com o professor por canal privado. O usuário da demonstração é `orientador`. Não reutilizar senha pessoal. O serviço não inicia sem a chave e uma senha de pelo menos 20 caracteres.

O professor acessa a URL HTTPS do serviço e preenche o pedido de usuário e senha exibido pelo navegador. Não há criação de conta ou cadastro no aplicativo. Fechar a janela privada do navegador encerra o uso das credenciais nessa janela. O navegador pode manter credenciais HTTP Basic durante sua sessão; não há botão de logout.

O serviço gratuito pode adormecer após inatividade. A primeira abertura pode demorar. Reinícios, suspensão e novas publicações eliminam conversas em andamento; não há histórico. Uma única instância deve ser mantida, pois as sessões ficam em memória.

## Proteções específicas da publicação

- Senha antes da interface, dos arquivos estáticos e das rotas de treinamento.
- Somente `/api/health` é acessível sem senha, com resposta mínima.
- Respostas sem cache e indicação de não indexação; não indexação não substitui a senha.
- Limite de tentativas de autenticação; não se confia em cabeçalhos de IP fornecidos pelo visitante. Atrás do proxy, o limite pode ser compartilhado entre visitantes.
- Cota conjunta de 60 requisições autenticadas às rotas de mensagem e devolutiva em uma janela de 24 horas, por processo. Uma chamada interna de reparo pode gerar consumo adicional; requisições inválidas autenticadas também contam. O contador reinicia quando o processo reinicia. Esta cota NÃO é um limite financeiro da OpenAI. Custos devem ser acompanhados na conta do provedor.
- Produtos, fatos e prompts permanecem iguais. Não há uso de conversas reais ou dados pessoais de clientes.

## Verificação

Executar `pnpm check`, `pnpm test` e `pnpm build:render`. Os novos testes usam provedor simulado e não geram cobrança de IA. Os 72 testes anteriores e os registros do TCC não devem ser apresentados como se já tivessem avaliado esta camada de publicação.

Depois da implantação, confirmar HTTPS, saúde, bloqueio sem senha, leitura da configuração com senha e uma conversa fictícia até a devolutiva. Registrar esse teste como demonstração de publicação, fora das 53 execuções do artigo.

O manuscrito descreve a avaliação local realizada. A disponibilização posterior ao orientador não transforma automaticamente o estudo em avaliação com participantes e não autoriza coleta de conversas do professor como dados de pesquisa. Se a hospedagem for acrescentada ao texto, identificá-la como disponibilização posterior, preservando datas e condições dos resultados originais.

Referências de configuração: https://render.com/docs/blueprint-spec, https://render.com/docs/deploy-node-express-app e https://render.com/docs/free (consultadas em 8 de setembro de 2026).
