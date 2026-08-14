# Queijos & Risos — Site de demonstração

Site demo da pizzaria com fluxo de pedido até o WhatsApp.

## WhatsApp

O número já está configurado em `src/App.jsx`:

```js
const WHATSAPP_NUMBER = "5518991313546"; // formato: 55DDDNUMERO, só números
```

## Segurança

Uma revisão de segurança foi feita no código-fonte (veja o histórico de conversa
para o relatório completo). Resumo:

- **Dados do cliente**: tratados só em memória (estado do React) durante a visita;
  nada é salvo no navegador (sem `localStorage`/`sessionStorage`) nem enviado a
  nenhum servidor próprio — os dados só saem daqui dentro da mensagem do WhatsApp,
  que o próprio cliente confirma e envia.
- **Formulário**: todo campo tem limite de caracteres (`maxLength`) e a entrada é
  sanitizada (remove caracteres de controle, normaliza quebras de linha) antes de
  entrar na mensagem.
- **XSS**: não há `dangerouslySetInnerHTML`, `innerHTML` nem `eval` em nenhum lugar
  do código — o React trata todo texto digitado pelo cliente como texto puro,
  nunca como HTML.
- **Link do WhatsApp**: o número de destino é uma constante fixa no código,
  nunca pode ser alterado pelos dados do formulário; a mensagem é sempre
  codificada com `encodeURIComponent` antes de entrar na URL.
- **Links externos** (Instagram, WhatsApp): todos usam `rel="noopener noreferrer"`.
- **Cabeçalhos de segurança**: configurados em `vercel.json` (Content-Security-Policy,
  X-Content-Type-Options, Referrer-Policy, X-Frame-Options, Permissions-Policy) —
  aplicados automaticamente pela Vercel no deploy, sem precisar de nenhuma
  configuração extra.
- **Dependências**: `package.json` usa apenas React, Vite e lucide-react — sem
  pacotes extras ou não usados. Não foi possível rodar `npm audit` neste ambiente
  (sem acesso à internet); rode `npm audit` localmente após o `npm install` antes
  de publicar em produção, por garantia.
- **Segredos/credenciais**: nenhuma chave, senha ou token existe no código. Não é
  necessário nenhum, já que o site não se conecta a nenhuma API própria.

## Rodar localmente (opcional)

```bash
npm install
npm run dev
```

## Publicar na Vercel (grátis)

**Opção mais simples — sem usar GitHub:**

1. Acesse [vercel.com](https://vercel.com) e crie uma conta grátis.
2. Clique em **Add New Project**.
3. Escolha a opção de enviar uma pasta local (**"Deploy" / arrastar pasta**) e envie esta pasta inteira (`queijos-e-risos`).
4. A Vercel detecta automaticamente que é um projeto Vite e faz o build sozinha.
5. Em alguns segundos você recebe um link tipo `queijos-e-risos.vercel.app`.

**Opção com GitHub (recomendada a médio prazo, permite atualizar com 1 clique):**

1. Crie um repositório novo no [GitHub](https://github.com) e suba esta pasta nele.
2. Em [vercel.com](https://vercel.com), clique em **Add New Project** e conecte esse repositório.
3. Deixe as configurações padrão (a Vercel já reconhece Vite) e clique em **Deploy**.
4. A cada atualização que você enviar ao GitHub, o site é republicado automaticamente.

Depois, em **Settings → Domains**, dá pra ligar um domínio próprio (ex: `queijoserisos.com.br`) de graça no plano gratuito.
