# Queijos & Risos — Site de demonstração

Site demo da pizzaria com fluxo de pedido até o WhatsApp.

## Antes de publicar

Abra `src/App.jsx` e troque o número de WhatsApp de teste pelo número real da pizzaria:

```js
const WHATSAPP_NUMBER = "5511999999999"; // formato: 55DDDNUMERO, só números
```

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
