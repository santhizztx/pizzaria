import React, { useState, useRef, useEffect } from "react";
import { User, Home, MapPin, StickyNote, Check, MessageCircle, ChevronRight, Clock, Instagram } from "lucide-react";

/* ------------------------------------------------------------------
   TAXA DE ENTREGA POR DISTÂNCIA
   R$ 1,00 por km (linha reta) entre a pizzaria e o endereço do
   cliente. Endereço convertido em coordenadas via Nominatim
   (OpenStreetMap) — serviço público e gratuito, sem chave de API
   (o projeto é 100% frontend estático, então nunca colocamos chave
   nenhuma no código). Se o endereço não puder ser localizado, a
   taxa NÃO é inventada — fica marcada como "a confirmar com a
   pizzaria" tanto no resumo quanto na mensagem do WhatsApp.
------------------------------------------------------------------- */
const PIZZERIA_ADDRESS = "Rua Luiz Delfino, 475, Alvorada, Araçatuba, SP, Brasil";
const DELIVERY_RATE_PER_KM = 1.0;
const DEFAULT_CITY = "Araçatuba"; // usado se o cliente não preencher a cidade

/* ------------------------------------------------------------------
   HORÁRIO DE FUNCIONAMENTO
   Pedidos só podem ser finalizados das 18h às 23h (mesmo horário já
   anunciado na faixa do topo do site), com base no horário local do
   aparelho do cliente.
------------------------------------------------------------------- */
const OPENING_HOUR = 18; // 18h
const CLOSING_HOUR = 23; // até 22h59

function isStoreOpenNow() {
  const hour = new Date().getHours();
  return hour >= OPENING_HOUR && hour < CLOSING_HOUR;
}

let pizzeriaCoordsCache = null;

async function geocodeAddress(query) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const lat = parseFloat(data[0].lat);
    const lon = parseFloat(data[0].lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
    return { lat, lon };
  } catch {
    return null;
  }
}

async function getPizzeriaCoords() {
  if (pizzeriaCoordsCache) return pizzeriaCoordsCache;
  pizzeriaCoordsCache = await geocodeAddress(PIZZERIA_ADDRESS);
  return pizzeriaCoordsCache;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ------------------------------------------------------------------
   DADOS DO CARDÁPIO
   8 categorias: TODAS, PIZZAS COM CALABRESA, PIZZAS COM FRANGO,
   PIZZAS COM BACON, TRADICIONAIS, BRÓCOLIS, AGRIDOCE, ECONÔMICAS.
   Uma pizza pode pertencer a mais de uma categoria (ex.: "Brócolis
   com Bacon" está em BACON e BRÓCOLIS). "TODAS" nunca filtra —
   mostra o array inteiro. Todos os ingredientes abaixo incluem
   molho de tomate e orégano, presentes em toda pizza do cardápio.
------------------------------------------------------------------- */
const BORDA_PRICE = 5.0;
const CHOCOLATE_BORDA_PRICE = 9.49; // Chocolate Preta e Chocolate Branca custam um valor fixo diferente das demais
const BASE_INGREDIENTS = "Molho de tomate e orégano, ";

// Opções de borda recheada disponíveis pra qualquer pizza do carrinho.
// Catupiry/Cheddar seguem o preço padrão de cada pizza (bordaPriceFor);
// as duas de chocolate têm preço fixo próprio (CHOCOLATE_BORDA_PRICE).
const BORDA_OPTIONS = [
  { value: "nenhuma", label: "Sem borda" },
  { value: "catupiry", label: "Catupiry" },
  { value: "cheddar", label: "Cheddar" },
  { value: "chocolate-preta", label: "Chocolate Preta" },
  { value: "chocolate-branca", label: "Chocolate Branca" },
];
const CHOCOLATE_BORDAS = ["chocolate-preta", "chocolate-branca"];
const BORDA_LABELS = Object.fromEntries(BORDA_OPTIONS.map((o) => [o.value, o.label]));

const ALL_PIZZAS = [
  { id: "calabresa", name: "Calabresa", price: 39.99, categories: ["calabresa"], ingredients: BASE_INGREDIENTS + "queijo, calabresa e cebola.", image: "/images/calabresa.png"},
  { id: "frango", name: "Frango", price: 41.99, categories: ["frango"], ingredients: BASE_INGREDIENTS + "queijo, frango e catupiry.", image: "/images/frango.png"},
  { id: "portuguesa", name: "Portuguesa", price: 49.99, categories: ["tradicionais"], ingredients: BASE_INGREDIENTS + "queijo, presunto, ovo, palmito e cebola.", image: "/images/portuguesa.png"},
  { id: "mussarela", name: "Mussarela", price: 43.99, categories: ["tradicionais"], ingredients: BASE_INGREDIENTS + "queijo, presunto e tomate.", image: "/images/mussarela.png"},
  { id: "calabresa-catupiry", name: "Calabresa com Catupiry", price: 41.99, categories: ["calabresa"], ingredients: BASE_INGREDIENTS + "queijo, calabresa, catupiry e cebola.", image: "/images/calabresa-catupiry.jpg"},
  { id: "bacon", name: "Bacon", price: 45.99, categories: ["bacon"], ingredients: BASE_INGREDIENTS + "queijo, muçarela, bacon e cebola.", image: "/images/bacon.jpg"},
  { id: "marguerita", name: "Marguerita", price: 46.99, categories: ["tradicionais"], ingredients: BASE_INGREDIENTS + "queijo, manjericão e tomate.", image: "/images/marguerita.png"},
  { id: "calabacon", name: "Calabacon", price: 47.99, categories: ["calabresa"], ingredients: BASE_INGREDIENTS + "queijo, bacon, calabresa e cebola.", image: "/images/calabacon.jpg"},
  { id: "tres-queijos", name: "Três Queijos", price: 47.99, categories: ["tradicionais"], ingredients: BASE_INGREDIENTS + "queijo, muçarela, catupiry e gorgonzola.", image: "/images/tres-queijos.png"},
  { id: "presunto-queijo", name: "Presunto e Queijo", price: 39.99, categories: ["tradicionais"], ingredients: BASE_INGREDIENTS + "presunto e queijo.", image: "/images/presunto-queijo.jpg"},
  { id: "calafrango", name: "Calafrango", price: 43.99, categories: ["frango"], ingredients: BASE_INGREDIENTS + "queijo, frango, calabresa e catupiry.", image: "/images/calafrango.png"},
  { id: "frango-batata-palha", name: "Frango com Batata Palha", price: 42.99, categories: ["frango"], ingredients: BASE_INGREDIENTS + "queijo, frango, batata palha e catupiry.", image: "/images/frango-batata-palha.jpg"},
  { id: "brocolis-bacon", name: "Brócolis com Bacon", price: 46.99, categories: ["bacon", "brocolis"], ingredients: BASE_INGREDIENTS + "queijo, bacon e brócolis.", image: "/images/brocolis-bacon.jpg"},
  { id: "pizza-brocolis", name: "Pizza de Brócolis", price: 45.99, categories: ["brocolis"], ingredients: BASE_INGREDIENTS + "queijo e brócolis.", image: "/images/pizza-brocolis.jpg"},
  { id: "hot-dog", name: "Hot Dog", price: 42.99, categories: ["tradicionais"], ingredients: BASE_INGREDIENTS + "salsicha, queijo e batata palha.", image: "/images/hot-dog.jpg"},
  { id: "hawaiana-bacon", name: "Hawaiana com Bacon", price: 46.99, categories: ["agridoce"], ingredients: BASE_INGREDIENTS + "queijo, bacon e abacaxi.", image: "/images/hawaiana-bacon.jpg"},
  { id: "hawaiana-presunto", name: "Hawaiana com Presunto", price: 44.99, categories: ["agridoce"], ingredients: BASE_INGREDIENTS + "queijo, presunto e abacaxi.", image: "/images/hawaiana-presunto.jpg"},
  { id: "bacon-ovo", name: "Bacon com Ovo", price: 46.99, categories: ["bacon"], ingredients: BASE_INGREDIENTS + "queijo, bacon, ovo e cebola.", image: "/images/bacon-ovo.jpg"},

  // Econômicas (Tamanho G) — R$ 29,90 (não fazem parte da fonte oficial enviada; mantidas como já estavam)
  { id: "eco-portuguesa", name: "Portuguesa (Econômica)", price: 29.9, categories: ["economica"] , image: "/images/eco-portuguesa.jpg"},
  { id: "eco-mussarela", name: "Mussarela (Econômica)", price: 29.9, categories: ["economica"] , image: "/images/eco-mussarela.jpg"},
  { id: "eco-calabresa", name: "Calabresa (Econômica)", price: 29.9, categories: ["economica"] , image: "/images/eco-calabresa.jpg"},
  { id: "eco-tres-queijos", name: "3 Queijos (Econômica)", price: 29.9, categories: ["economica"] , image: "/images/eco-tres-queijos.jpg"},
  { id: "eco-frango-catupiry", name: "Frango com Catupiry (Econômica)", price: 29.9, categories: ["economica"] , image: "/images/eco-frango-catupiry.jpg"},
  { id: "eco-calafrango", name: "Calafrango (Econômica)", price: 29.9, categories: ["economica"] , image: "/images/eco-calafrango.jpg"},
  { id: "eco-marguerita", name: "Marguerita (Econômica)", price: 29.9, categories: ["economica"] , image: "/images/eco-marguerita.jpg"},

  // Pizzas Doces — borda recheada nessas tem preço próprio (R$ 4,99, diferente do padrão salgado)
  { id: "dois-amores", name: "Dois Amores", price: 49.99, categories: ["doce"], ingredients: "Chocolate branco e chocolate preto.", bordaPrice: 4.99, image: "/images/dois-amores.jpg" },
  { id: "bis-preto", name: "Bis Preto", price: 45.0, categories: ["doce"], ingredients: "Chocolate preto e Bis preto.", bordaPrice: 4.99, image: "/images/bis-preto.jpg" },
  { id: "banana-caramelizada", name: "Banana Caramelizada", price: 39.99, categories: ["doce"], ingredients: "Banana, chocolate branco, leite condensado, canela e açúcar.", bordaPrice: 4.99, image: "/images/banana-caramelizada.jpg" },
];

/* ------------------------------------------------------------------
   REFRIGERANTES
   Sem fotos ainda (mostram o mesmo placeholder "Foto em breve" dos
   outros produtos até você mandar as imagens). Dois itens vieram
   sem preço informado — ficam marcados "Preço a confirmar" e sem
   poder ser adicionados ao carrinho até você me passar o valor.
------------------------------------------------------------------- */
const BEBIDAS = [
  { id: "paulistinha", name: "Paulistinha 2 litros", price: 8.0, isDrink: true, image: "/images/paulistinha.png" },
  { id: "coca-600-normal", name: "Coca-Cola 600ml Normal", price: 6.5, isDrink: true, image: "/images/coca-600-normal.png" },
  { id: "coca-600-zero", name: "Coca-Cola 600ml Zero", price: 6.5, isDrink: true, image: "/images/coca-600-zero.png" },
  { id: "coca-1l-casco", name: "Coca-Cola 1 litro (retornável)", price: 7.5, isDrink: true, note: "É preciso devolver o casco/vasilhame vazio na hora da entrega.", image: "/images/coca-1l-casco.png" },
  { id: "coca-2l-retornavel", name: "Coca-Cola 2 litros (retornável)", price: 11.5, isDrink: true, note: "É preciso devolver o casco/vasilhame vazio na hora da entrega.", image: "/images/coca-2l-retornavel.png" },
];

const ALL_PRODUCTS = [...ALL_PIZZAS, ...BEBIDAS];

/* ------------------------------------------------------------------
   PIZZA MEIO A MEIO
   Não cria nenhuma lista paralela — usa ALL_PRODUCTS (a mesma fonte
   de dados do cardápio) pra montar a combinação. Uma entrada do
   carrinho meio a meio é identificada por uma chave sintética
   "half::idA::idB" (IDs sempre ordenados, então "Calabresa + Frango"
   e "Frango + Calabresa" viram a mesma entrada). O preço é sempre o
   maior valor entre as duas metades — nunca soma, nunca faz média.
------------------------------------------------------------------- */
function bordaPriceFor(product, bordaType) {
  if (bordaType && CHOCOLATE_BORDAS.includes(bordaType)) return CHOCOLATE_BORDA_PRICE;
  return product.bordaPrice ?? BORDA_PRICE;
}

function makeHalfKey(id1, id2) {
  const [a, b] = [id1, id2].sort();
  return `half::${a}::${b}`;
}
function isHalfKey(key) {
  return typeof key === "string" && key.startsWith("half::");
}
function parseHalfKey(key) {
  const parts = key.split("::");
  return [parts[1], parts[2]];
}

// Pizzas elegíveis pro meio a meio: qualquer pizza do cardápio
// (tradicional, econômica, doce...), nunca bebidas.
const HALF_HALF_OPTIONS = ALL_PIZZAS.filter((p) => !p.isDrink);

function resolveCartProduct(id) {
  if (isHalfKey(id)) {
    const [id1, id2] = parseHalfKey(id);
    const p1 = ALL_PRODUCTS.find((p) => p.id === id1);
    const p2 = ALL_PRODUCTS.find((p) => p.id === id2);
    if (!p1 || !p2) return null;
    return {
      id,
      name: "Pizza Meio a Meio",
      isHalfHalf: true,
      half1: p1,
      half2: p2,
      price: Math.max(p1.price ?? 0, p2.price ?? 0),
      bordaPrice: Math.max(bordaPriceFor(p1), bordaPriceFor(p2)),
      isDrink: false,
      categories: [],
      image: p1.image || p2.image || null,
    };
  }
  return ALL_PRODUCTS.find((p) => p.id === id) || null;
}

const TABS = [
  { key: "todas", label: "Todas" },
  { key: "calabresa", label: "Pizzas com Calabresa" },
  { key: "frango", label: "Pizzas com Frango" },
  { key: "bacon", label: "Pizzas com Bacon" },
  { key: "tradicionais", label: "Tradicionais" },
  { key: "brocolis", label: "Brócolis" },
  { key: "agridoce", label: "Agridoce" },
  { key: "economica", label: "Econômicas" },
  { key: "doce", label: "Pizzas Doces" },
];

function formatBRL(value) {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

// TODO: substituir pelo número real de WhatsApp da pizzaria (formato: 55DDDNUMERO)
const WHATSAPP_NUMBER = "5518991313546";

/* ------------------------------------------------------------------
   MASCOTE — fatia de pizza sorridente, traço grosso, cores chapadas
------------------------------------------------------------------- */
function Mascot({ size = 120, mood = "feliz" }) {
  return (
    <svg viewBox="0 0 200 220" width={size} height={size * 1.1} aria-hidden="true">
      {/* braço esquerdo */}
      <path d="M55 150 Q20 145 15 175" stroke="#3A2318" strokeWidth="9" fill="none" strokeLinecap="round" />
      <circle cx="14" cy="180" r="11" fill="#F6E8D3" stroke="#3A2318" strokeWidth="7" />
      {/* braço direito */}
      <path d="M145 150 Q180 145 185 175" stroke="#3A2318" strokeWidth="9" fill="none" strokeLinecap="round" />
      <circle cx="186" cy="180" r="11" fill="#F6E8D3" stroke="#3A2318" strokeWidth="7" />
      {/* fatia (triângulo arredondado) */}
      <path
        d="M100 18 C110 18 116 24 120 34 L172 158 C176 168 170 178 158 178 L42 178 C30 178 24 168 28 158 L80 34 C84 24 90 18 100 18 Z"
        fill="#F5C542"
        stroke="#3A2318"
        strokeWidth="9"
        strokeLinejoin="round"
      />
      {/* borda da crosta */}
      <path d="M42 178 L158 178 C160 190 152 200 138 200 L62 200 C48 200 40 190 42 178 Z" fill="#E38B2C" stroke="#3A2318" strokeWidth="9" strokeLinejoin="round" />
      {/* pepperoni */}
      <circle cx="92" cy="70" r="11" fill="#8F2C23" stroke="#3A2318" strokeWidth="4" />
      <circle cx="128" cy="100" r="11" fill="#8F2C23" stroke="#3A2318" strokeWidth="4" />
      <circle cx="108" cy="140" r="11" fill="#8F2C23" stroke="#3A2318" strokeWidth="4" />
      {/* folhinhas verdes */}
      <circle cx="70" cy="110" r="6" fill="#58703B" stroke="#3A2318" strokeWidth="3" />
      <circle cx="140" cy="65" r="6" fill="#58703B" stroke="#3A2318" strokeWidth="3" />
      {/* rosto */}
      <circle cx="82" cy="130" r="10" fill="#FFFFFF" stroke="#3A2318" strokeWidth="5" />
      <circle cx="118" cy="130" r="10" fill="#FFFFFF" stroke="#3A2318" strokeWidth="5" />
      <circle cx="84" cy="132" r="4" fill="#3A2318" />
      <circle cx="120" cy="132" r="4" fill="#3A2318" />
      {mood === "feliz" ? (
        <path d="M85 152 Q100 168 115 152" stroke="#3A2318" strokeWidth="6" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M85 158 Q100 148 115 158" stroke="#3A2318" strokeWidth="6" fill="none" strokeLinecap="round" />
      )}
      <circle cx="70" cy="144" r="7" fill="#E38B2C" opacity="0.55" />
      <circle cx="130" cy="144" r="7" fill="#E38B2C" opacity="0.55" />
    </svg>
  );
}

/* ------------------------------------------------------------------
   LOGO — arquivo real da marca, enviado pelo cliente.
------------------------------------------------------------------- */
const LOGO_SRC =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJYAAACWCAIAAACzY+a1AAAQAElEQVR4Aby7BYAdt5YmfCQVX77N7jYzQ+LYYWYGh8lhZgaHmemFmZk5Thw0xszsZrh9ubhK+s+18968N7P/7s7O7CqndVUqlerofIekcij5v1mAArAKEYJNQoERkAE0IBqACiBTotJKJwD5B1EAiVJJokwBqhKiyzSqS7pCNBkUBpQBUAAJQAFQAeIAKZCrwWiAZH+oHQ6NY2jjBLnfZL3vFKPf1MjAqdGBO0QGbacPnKD2H6vXDVGqBqrxRqLVgJwAEgHQATmq8IWsSVtnloDIQCVgEnYrMkmoUkKiMaiM05BnWTIISIxIkqRgkWWZYdm6Agrk/3Gh8P++EA7AqcwoY0KEBAQygSRJIMlE1RQmA+dByMOQ8pAKx+emEzi+cAPwBMgqxKqgtknrOzQ9aFT16LG148fXTprUd+LEgWNGDhjY1JhOpqKanozEEqoRlVSNyYaiJoxoTSrdp7Zm2JAhI4YPHT9m9IQJIydMGDJqbNOw4TWDhqTqmpTqehpNgaIBYSCQRQKhACEFvrDcwAq4AxDIEpFliVKCYuOCh0EQeD4yK4TghCB8guCd/6eEovu/+r6tC0J5QKVBgZMKhQAhhRBEgD0SIaqk6IpGBA084dkODwIcjsDiuABAMECbaOgX6TcsOXJi48jtBo8YP7zf0L7VdcloXDftcqFY7OnpyXR1l4pFykVNNDGgpmFgXZ8hffoOa+o/vO+AYY39BzY04QMNySqdERZ65VIun+3OFjN+6GhRJV2bHDx84LARg0eNGThibMOAodF0PUgGAIMAODAfyFYCRMz2PBOJQYh8MQBa4RUEZ4JIgsoCO/7H9H9LzvT/1sT/mLeilmTbFa/8YMWBhCHCxREgLkTIOYrG8wPsB0SOyaDoIBugxqG6URk5oXHKrqMaB6D8o1y4pVx3qacDSsU0kAHRxIXHnHz9qec+fMWNr9/96OdPvTzzlfdmvvHxN29+8skzb3yM9NxbHz//9kfPv/Xhs69/8LdXP3z6pbfue+Sdh55479GnXrrr/jsuuuzE/Q6c0H9gtaqVu7vNfNa3TYlBKh3vO6Bh1Nj60ds3NA5PRWtl9KcIJ0gga8CkyjIEFYKGaHgARABDc0WsAc22gh/8vyz/9yGsLIkijkiVxeJ6odIUWBBZClQiAeEu56jNOFaJglCBRqDPgOSE7YeNHj9Mj0mdmeaCmYkYbPvxI88+YdqjN9z08eNP/fDyG5+++u5Vx559zj7HHj50yqQwoS1p3fzO97Pvf+GH6x/47Io7P73s9o8vmvHJ+Td9euGMLy+785tr7//6poc7v/i5/OufqU1dU9XUCTvscct5l736+NNfv/fhD++888z9955+wrRRwweqjLtOwXOLAE6iWh04qs/oqf36jUxGUuAFECBcFH1IhXzCAxryyqLQ+1IGQAX6DQqoiUj/giSKGulfuv5bLv6vTPovnOGS/nEtCF4hgFhXACMVxXXRDAkwDfQqKdGgDRpeN2mHAdtPHl5TmyiXeq1cdlB97ZF77/XCvfe/eu+DL99+z7VnX7T/+MnQ0vXdcy+/fMkVNx9z/PXHnnT1Caddfsa5t1557eP3PvD6cy9+/Na7P33zHdLP3/3w8/czZ333w8xvv/vuq6+//+KLZx5/4r5bbrv0zHNPOeyoCw46/NbjTnnu4qvfvunO7OI1Q9TkJSdMf/3Z13774PPX73vsvCOP32nkaCVwSFDWlKBPY2r0eHSz6WQagfonAiwccSMQEqisDK//X9L/XQgRMQIV26OckopWUoGuB7soRhpGFUDvhNqrRiFZr9UPqG4aUheJq+VirqertTpunHjUkU/de+87jz350B0PbK9VSUs3fX37Y3cdeMx5u+x78xkXfvjKa3/++aeI6/HBTaP22fmQ8049564br3324VvefOa29164/7M3H/jy7Ye/ee/h795/8Jt37/3izTs/efWOD1666pkHr3rynovuuXHahdPH77oDWs3yefN/fOfDGSdecu2hJ9y879GvnHzBguffHeoplx5/1nNPvvTeY0+ddcwxNYaW62x1rUJdn6oxk4aPn9yvT6NeW6PFDapSdKMY44MQMBKEgnD4B8E/Fw4Vjf3nnv+e9v9dCJHHCop/V01BsOMvCpwQQ6ERh6YB8WHD+/TvXxOPUOqW41wcu+d+7zzy1Nevv3fDuZfUueTDx5+794Tppx1y9G1XXz/r2+9lJu29/36XXnvl/U8+9uTrL9353pvXv/C36XfO2O+CM8cfffCAvXeu22lS9eRx8sAGeUA9bawifdKsb40ysMEYPiAyanD/nSeP2G/vqaeccPg1V5770P23vvzi4++9+/zHH9//8F2nnHJa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";

function Logo({ size = 84 }) {
  return (
    <img
      src={LOGO_SRC}
      alt="Logo Pizzaria Queijos & Risos"
      width={size}
      height={size}
      className="pz-logo-img"
    />
  );
}

function SpeechBubble({ children }) {
  return (
    <div className="pz-bubble">
      <p>{children}</p>
      <span className="pz-bubble-tail" aria-hidden="true" />
    </div>
  );
}

/* ------------------------------------------------------------------
   BARRA DE TOPO — horário de funcionamento e Instagram.
   Fica ACIMA do cabeçalho fixo (não é sticky), pra dar visibilidade
   logo na primeira dobra sem ocupar espaço permanente da tela
   enquanto o usuário rola a página.
------------------------------------------------------------------- */
function TopBar() {
  return (
    <div className="pz-topbar">
      <div className="pz-topbar-inner">
        <span className="pz-topbar-item">
          <Clock size={16} /> Seg a Dom e feriados • 18h às 23h
        </span>
        <a
          href="https://www.instagram.com/pizzaria.queijoserisos"
          target="_blank"
          rel="noopener noreferrer"
          className="pz-topbar-item pz-topbar-ig"
        >
          <Instagram size={16} /> @pizzaria.queijoserisos
        </a>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   CABEÇALHO
------------------------------------------------------------------- */
function Header({ onNavClick }) {
  return (
    <header className="pz-header">
      <div className="pz-header-inner">
        <a href="#topo" className="pz-brand" onClick={(e) => onNavClick(e, "topo")}>
          <Logo size={64} />
          <span className="pz-brand-text">
            <strong>Queijos</strong> &amp; <strong>Risos</strong>
            <small>PIZZARIA</small>
          </span>
        </a>
        <nav className="pz-nav">
          <a href="#cardapio" onClick={(e) => onNavClick(e, "cardapio")}>Cardápio</a>
          <a href="#bebidas" onClick={(e) => onNavClick(e, "bebidas")} className="pz-nav-cta pz-nav-cta-drinks">🥤 Bebidas</a>
          <a href="#como-funciona" onClick={(e) => onNavClick(e, "como-funciona")}>Como funciona</a>
          <a href="#pedido" onClick={(e) => onNavClick(e, "pedido")} className="pz-nav-cta">Fazer pedido</a>
        </nav>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------
   BARRA DE CATEGORIAS — separada da logo, presa junto com o
   cabeçalho ao rolar a página. Rolagem horizontal no celular.
------------------------------------------------------------------- */
function CategoryBar({ activeTab, onSelectTab }) {
  return (
    <div className="pz-catbar">
      <div className="pz-catbar-inner">
        <div className="pz-tabs" role="tablist" aria-label="Categorias do cardápio">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              className={`pz-tab${activeTab === tab.key ? " is-active" : ""}`}
              onClick={() => onSelectTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   HERO
------------------------------------------------------------------- */
function Hero({ onCtaClick, onHalfHalfClick, onDrinksClick }) {
  return (
    <section id="topo" className="pz-hero">
      <div className="pz-hero-text pz-hero-text-anim">
        <span className="pz-eyebrow">🍕 Feita na hora, com carinho</span>
        <h1>
          Peça já a sua<br />fatia de <span>felicidade!</span>
        </h1>
        <p>
          Pizza artesanal, atendimento de perto e aquele clima de família.
          Escolha o sabor, preencha seus dados e o pedido vai direto pro
          nosso WhatsApp. 👇
        </p>
        <button className="pz-btn pz-btn-primary" onClick={onCtaClick}>
          Ver cardápio <ChevronRight size={18} />
        </button>
        <div className="pz-hero-chips">
          <button type="button" className="pz-hero-chip" onClick={onHalfHalfClick}>🍕🍕 Meio a Meio</button>
          <button type="button" className="pz-hero-chip" onClick={onDrinksClick}>🥤 Bebidas</button>
        </div>
      </div>
      <div className="pz-hero-mascot pz-hero-mascot-anim">
        <Mascot size={220} />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------
   COMO FUNCIONA
------------------------------------------------------------------- */
function HowItWorks() {
  const steps = [
    { emoji: "🍕", title: "Escolha a pizza", text: "Toque no sabor que você quer no cardápio abaixo." },
    { emoji: "📝", title: "Preencha seus dados", text: "Nome, telefone e endereço para a entrega certinha." },
    { emoji: "💬", title: "Envie no WhatsApp", text: "Confirme e o pedido chega prontinho pra gente." },
  ];
  return (
    <section id="como-funciona" className="pz-how">
      <span className="pz-eyebrow pz-eyebrow-center">😄 É rapidinho</span>
      <h2>Como funciona</h2>
      <div className="pz-how-strip">
        <div className="pz-how-mascot">
          <Mascot size={100} />
        </div>
        <div className="pz-how-grid">
          {steps.map((s, i) => (
            <React.Fragment key={s.title}>
              <div className={`pz-how-card${i === steps.length - 1 ? " pz-how-card-last" : ""}`}>
                <span className="pz-how-num" aria-hidden="true">{s.emoji}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
              {i < steps.length - 1 && <span className="pz-how-arrow" aria-hidden="true">➜</span>}
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------
   CARDÁPIO
------------------------------------------------------------------- */
function PizzaCard({ pizza, quantity, onAdd, onIncrement, onDecrement, onStartHalfHalf }) {
  return (
    <div className={`pz-pizza-card${quantity > 0 ? " is-selected" : ""}`}>
      {pizza.image ? (
        <div className="pz-pizza-img pz-pizza-img-photo">
          <img src={pizza.image} alt={pizza.name} loading="lazy" decoding="async" />
        </div>
      ) : (
        <div className="pz-pizza-img" aria-hidden="true">
          <svg viewBox="0 0 64 64" width="30" height="30">
            <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="6 5" />
            <path d="M20 40 L28 28 L34 36 L40 26 L46 40" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
            <circle cx="24" cy="24" r="3" fill="currentColor" />
          </svg>
          <span className="pz-pizza-img-label">Foto em breve</span>
        </div>
      )}

      <p className="pz-pizza-name">{pizza.name}</p>
      {pizza.ingredients && <small className="pz-pizza-ingredients">{pizza.ingredients}</small>}
      <p className="pz-pizza-price">{pizza.price == null ? "Preço a confirmar" : formatBRL(pizza.price)}</p>
      {pizza.note && <span className="pz-pizza-note">⚠️ {pizza.note}</span>}

      {pizza.price == null ? (
        <span className="pz-pizza-unavailable">Aguardando preço</span>
      ) : quantity > 0 ? (
        <div className="pz-pizza-stepper">
          <button type="button" className="pz-pizza-stepper-btn" onClick={() => onDecrement(pizza.id)} aria-label={`Remover uma unidade de ${pizza.name}`}>
            −
          </button>
          <span className="pz-pizza-stepper-count" aria-live="polite">{quantity}</span>
          <button type="button" className="pz-pizza-stepper-btn" onClick={() => onIncrement(pizza.id)} aria-label={`Adicionar mais uma unidade de ${pizza.name}`}>
            +
          </button>
        </div>
      ) : (
        <button type="button" className="pz-pizza-select" onClick={() => onAdd(pizza.id)}>
          <span className="pz-pizza-select-check" aria-hidden="true">
            <Check size={14} />
          </span>
          Adicionar
        </button>
      )}

      {!pizza.isDrink && pizza.price != null && onStartHalfHalf && (
        <button type="button" className="pz-pizza-half-link" onClick={() => onStartHalfHalf(pizza.id)}>
          🍕 Meio a meio com essa
        </button>
      )}
    </div>
  );
}

function Menu({ cart, onAdd, onIncrement, onDecrement, onStartHalfHalf, activeTab }) {
  // Categorias reais (exclui "todas", que não é uma categoria em si).
  // Vem direto de TABS, então qualquer categoria nova cadastrada no
  // futuro entra automaticamente aqui — nada de lista manual.
  const REAL_CATEGORIES = TABS.filter((t) => t.key !== "todas");

  function renderCard(p) {
    return (
      <PizzaCard
        key={p.id}
        pizza={p}
        quantity={cart[p.id]?.quantity || 0}
        onAdd={onAdd}
        onIncrement={onIncrement}
        onDecrement={onDecrement}
        onStartHalfHalf={onStartHalfHalf}
      />
    );
  }

  return (
    <section id="cardapio" className="pz-menu">
      <span className="pz-eyebrow pz-eyebrow-center">🧀 Nosso cardápio</span>
      <h2>Escolha o seu sabor</h2>
      <p className="pz-menu-sub">Adicione quantas pizzas quiser — dá pra misturar sabores no mesmo pedido.</p>

      {activeTab === "todas" ? (
        // Visão agrupada: cada categoria cadastrada vira uma seção,
        // com todas as pizzas que pertencem a ela.
        REAL_CATEGORIES.map((cat) => {
          const pizzasDaCategoria = ALL_PIZZAS.filter((p) => p.categories.includes(cat.key));
          if (pizzasDaCategoria.length === 0) return null;
          return (
            <div key={cat.key} className="pz-menu-group">
              <h3 className="pz-menu-group-title">🍕 {cat.label}</h3>
              <div className="pz-menu-grid">{pizzasDaCategoria.map(renderCard)}</div>
            </div>
          );
        })
      ) : (
        // Visão filtrada: só as pizzas da categoria escolhida.
        <div className="pz-menu-grid">
          {ALL_PIZZAS.filter((p) => p.categories.includes(activeTab)).map(renderCard)}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------
   PIZZA MEIO A MEIO
   Usa a mesma fonte de dados do cardápio (HALF_HALF_OPTIONS, derivada
   de ALL_PIZZAS) — qualquer pizza nova cadastrada no futuro já entra
   automaticamente nas opções, sem precisar mexer aqui.
------------------------------------------------------------------- */
function HalfHalfBuilder({ half1Id, half2Id, onSetHalf1, onSetHalf2, onAdd, onClear }) {
  const half1 = HALF_HALF_OPTIONS.find((p) => p.id === half1Id) || null;
  const half2 = HALF_HALF_OPTIONS.find((p) => p.id === half2Id) || null;
  const bothChosen = half1 && half2;
  const price = bothChosen ? Math.max(half1.price, half2.price) : null;

  return (
    <section id="meio-a-meio" className="pz-menu pz-halfhalf">
      <span className="pz-eyebrow pz-eyebrow-center">🍕🍕 Combine dois sabores</span>
      <h2>Monte sua Pizza Meio a Meio</h2>
      <p className="pz-menu-sub">
        Escolha duas pizzas do cardápio — o valor cobrado é sempre o preço da mais cara entre as duas.
      </p>

      <div className="pz-halfhalf-picker">
        <label className="pz-halfhalf-slot">
          <span className="pz-halfhalf-slot-label">1ª metade</span>
          <select
            className="pz-halfhalf-select"
            value={half1Id || ""}
            onChange={(e) => onSetHalf1(e.target.value || null)}
          >
            <option value="">Escolha o 1º sabor…</option>
            {HALF_HALF_OPTIONS.filter((p) => p.id !== half2Id).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {formatBRL(p.price)}
              </option>
            ))}
          </select>
        </label>

        <span className="pz-halfhalf-plus" aria-hidden="true">+</span>

        <label className="pz-halfhalf-slot">
          <span className="pz-halfhalf-slot-label">2ª metade</span>
          <select
            className="pz-halfhalf-select"
            value={half2Id || ""}
            onChange={(e) => onSetHalf2(e.target.value || null)}
          >
            <option value="">Escolha o 2º sabor…</option>
            {HALF_HALF_OPTIONS.filter((p) => p.id !== half1Id).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {formatBRL(p.price)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {bothChosen && (
        <div className="pz-halfhalf-preview">
          <div className="pz-halfhalf-preview-halves">
            <span>🍕 1/2 {half1.name}</span>
            <span>🍕 1/2 {half2.name}</span>
          </div>
          <div className="pz-halfhalf-preview-price">
            Valor: <strong>{formatBRL(price)}</strong>
          </div>
          <div className="pz-halfhalf-preview-actions">
            <button type="button" className="pz-btn pz-btn-primary" onClick={() => onAdd(half1.id, half2.id)}>
              <Check size={16} /> Adicionar ao pedido
            </button>
            <button type="button" className="pz-halfhalf-clear" onClick={onClear}>
              Limpar seleção
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------
   REFRIGERANTES
------------------------------------------------------------------- */
function Drinks({ cart, onAdd, onIncrement, onDecrement }) {
  return (
    <section id="bebidas" className="pz-menu pz-drinks">
      <span className="pz-eyebrow pz-eyebrow-center">🥤 Pra acompanhar</span>
      <h2>Refrigerantes</h2>
      <p className="pz-menu-sub">Escolha sua bebida pra completar o pedido.</p>

      <div className="pz-menu-grid">
        {BEBIDAS.map((drink) => (
          <PizzaCard
            key={drink.id}
            pizza={drink}
            quantity={cart[drink.id]?.quantity || 0}
            onAdd={onAdd}
            onIncrement={onIncrement}
            onDecrement={onDecrement}
          />
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------
   BARRA FLUTUANTE DE RESUMO DO CARRINHO
------------------------------------------------------------------- */
function OrderBar({ itemCount, total, onContinue }) {
  if (itemCount === 0) return null;
  return (
    <div className="pz-orderbar">
      <div className="pz-orderbar-inner">
        <div className="pz-orderbar-info">
          <Mascot size={40} />
          <div>
            <small>{itemCount} {itemCount === 1 ? "pizza" : "pizzas"} no pedido</small>
            <strong>{formatBRL(total)}</strong>
          </div>
        </div>
        <button className="pz-btn pz-btn-secondary" onClick={onContinue}>
          Ver pedido <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   FORMULÁRIO DE PEDIDO
------------------------------------------------------------------- */
const EMPTY_FORM = {
  nome: "",
  endereco: "",
  numero: "",
  bairro: "",
  cidade: "",
  complemento: "",
  observacoes: "",
};

// Limites de caracteres por campo — evita entradas excessivamente
// grandes (defesa em profundidade; o React já trata tudo como texto
// puro na renderização, isto é uma camada extra de segurança).
const FIELD_LIMITS = {
  nome: 80,
  endereco: 120,
  numero: 10,
  bairro: 60,
  cidade: 60,
  complemento: 120,
  observacoes: 300,
};
const FIELDS_WITH_NEWLINE = ["observacoes"];

// Remove caracteres de controle (exceto quebra de linha/tab onde
// permitido), normaliza quebras de linha em campos de uma linha só,
// e corta no limite do campo. Sempre trata a entrada como texto puro.
function sanitizeField(name, rawValue) {
  const allowNewline = FIELDS_WITH_NEWLINE.includes(name);
  let value = String(rawValue).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  if (!allowNewline) value = value.replace(/[\r\n]+/g, " ");
  const limit = FIELD_LIMITS[name];
  if (limit && value.length > limit) value = value.slice(0, limit);
  return value;
}

function OrderForm({ cart, onIncrement, onDecrement, onRemove, onBordaChange, formRef }) {
  const [data, setData] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [sent, setSent] = useState(false);
  const [lastUrl, setLastUrl] = useState("");
  const [delivery, setDelivery] = useState({ status: "idle", distanceKm: null, fee: null });
  const [storeOpen, setStoreOpen] = useState(isStoreOpenNow());
  const whatsappLinkRef = useRef(null);
  const debounceRef = useRef(null);

  // Reconfere o horário periodicamente — se o cliente deixar a aba
  // aberta até passar das 23h (ou até abrir às 18h), o aviso atualiza
  // sozinho, sem precisar recarregar a página.
  useEffect(() => {
    const interval = setInterval(() => setStoreOpen(isStoreOpenNow()), 30000);
    return () => clearInterval(interval);
  }, []);

  const requiredFields = ["nome", "endereco", "numero", "bairro"];

  const cartItems = Object.entries(cart)
    .map(([id, info]) => {
      const pizza = resolveCartProduct(id);
      if (!pizza) return null;
      return { pizza, quantity: info.quantity, borda: info.borda };
    })
    .filter(Boolean);

  function lineTotal(item) {
    const extra = !item.pizza.isDrink && item.borda !== "nenhuma" ? bordaPriceFor(item.pizza, item.borda) : 0;
    return (item.pizza.price + extra) * item.quantity;
  }
  const subtotal = cartItems.reduce((sum, item) => sum + lineTotal(item), 0);
  const grandTotal = subtotal + (delivery.status === "ok" ? delivery.fee : 0);

  // Calcula a taxa de entrega automaticamente (com uma pequena pausa
  // depois que o cliente para de digitar, pra não disparar um pedido
  // de geolocalização a cada letra) sempre que endereço, número e
  // bairro estiverem preenchidos.
  useEffect(() => {
    const endereco = data.endereco.trim();
    const numero = data.numero.trim();
    const bairro = data.bairro.trim();

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!endereco || !numero || !bairro) {
      setDelivery({ status: "idle", distanceKm: null, fee: null });
      return;
    }

    setDelivery((prev) => ({ ...prev, status: "loading" }));
    debounceRef.current = setTimeout(async () => {
      const cidade = data.cidade.trim() || DEFAULT_CITY;
      const enderecoCompleto = `${endereco}, ${numero}, ${bairro}, ${cidade}, SP, Brasil`;
      const [origem, destino] = await Promise.all([getPizzeriaCoords(), geocodeAddress(enderecoCompleto)]);
      if (!origem || !destino) {
        setDelivery({ status: "failed", distanceKm: null, fee: null });
        return;
      }
      const km = haversineKm(origem.lat, origem.lon, destino.lat, destino.lon);
      const fee = Math.round(km * DELIVERY_RATE_PER_KM * 100) / 100;
      setDelivery({ status: "ok", distanceKm: km, fee });
    }, 900);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.endereco, data.numero, data.bairro, data.cidade]);

  function handleChange(e) {
    const { name, value } = e.target;
    const clean = sanitizeField(name, value);
    setData((prev) => ({ ...prev, [name]: clean }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
  }

  function validate() {
    const nextErrors = {};
    requiredFields.forEach((field) => {
      if (!data[field].trim()) nextErrors[field] = "Campo obrigatório";
    });
    if (cartItems.length === 0) nextErrors.cart = "Adicione pelo menos uma pizza no cardápio";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function bordaLabelFor(item) {
    if (item.borda === "nenhuma") return "Sem borda recheada";
    return `${BORDA_LABELS[item.borda] || item.borda} (+ ${formatBRL(bordaPriceFor(item.pizza, item.borda))} cada)`;
  }

  function buildMessage() {
    const nome = data.nome.trim();
    const endereco = data.endereco.trim();
    const numero = data.numero.trim();
    const bairro = data.bairro.trim();
    const cidade = data.cidade.trim();
    const complemento = data.complemento.trim();
    const observacoes = data.observacoes.trim();

    const linhas = ["Novo Pedido", "", "Itens do pedido:"];
    cartItems.forEach((item, i) => {
      if (item.pizza.isHalfHalf) {
        linhas.push(`${i + 1}. ${item.quantity}x 🍕 Pizza Meio a Meio`);
        linhas.push(`   1/2 ${item.pizza.half1.name}`);
        linhas.push(`   1/2 ${item.pizza.half2.name}`);
      } else {
        const tamanho = item.pizza.categories?.includes("economica") ? " (Tamanho G)" : "";
        linhas.push(`${i + 1}. ${item.quantity}x ${item.pizza.name}${tamanho}`);
      }
      if (!item.pizza.isDrink) linhas.push(`   Borda: ${bordaLabelFor(item)}`);
      if (item.pizza.note) linhas.push(`   Atenção: ${item.pizza.note}`);
      linhas.push(`   Subtotal: ${formatBRL(lineTotal(item))}`);
    });

    linhas.push(
      "",
      "Cliente:",
      `- ${nome}`,
      "",
      "Endereço:",
      `- ${endereco}, ${numero}`,
      `- Bairro ${bairro}${cidade ? " — " + cidade : ""}`
    );
    if (complemento) linhas.push(`- Complemento: ${complemento}`);
    linhas.push("");
    linhas.push("Observações:");
    linhas.push(observacoes ? `- ${observacoes}` : "- Nenhuma");

    linhas.push("", "Subtotal dos produtos:", `- ${formatBRL(subtotal)}`);

    if (delivery.status === "ok") {
      linhas.push("", "Distância aproximada:", `- ~${delivery.distanceKm.toFixed(1)} km`);
      linhas.push("", "Taxa de entrega:", `- ${formatBRL(delivery.fee)} (R$ 1,00/km)`);
      linhas.push("", "Total do pedido:", `- ${formatBRL(grandTotal)}`);
    } else {
      linhas.push("", "Distância / taxa de entrega:", "- Não foi possível calcular automaticamente — a confirmar com a pizzaria");
      linhas.push("", "Total do pedido (sem taxa de entrega):", `- ${formatBRL(subtotal)} + taxa a confirmar`);
    }
    return linhas.join("\n");
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!storeOpen) return;
    if (!validate()) return;
    const mensagem = buildMessage();
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(mensagem)}`;

    // Clique programático num link <a> real: método mais confiável para
    // abrir o WhatsApp em uma nova aba, evitando bloqueios de pop-up que
    // afetam chamadas diretas a window.open() em alguns navegadores/ambientes.
    if (whatsappLinkRef.current) {
      whatsappLinkRef.current.href = url;
      whatsappLinkRef.current.click();
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
    setLastUrl(url);
    setSent(true);
  }

  return (
    <section id="pedido" className="pz-form-section" ref={formRef}>
      <span className="pz-eyebrow pz-eyebrow-center">📝 Últimos passos</span>
      <h2>Finalize seu pedido</h2>

      <div className="pz-form-wrap">
        <SpeechBubble>
          {!storeOpen
            ? "Estamos fechados agora — funcionamos das 18h às 23h. Mas fica à vontade pra montar seu pedido, viu? 😉"
            : cartItems.length === 0
            ? "Adicione pizzas no cardápio pra eu poder anotar seu pedido! 🍕"
            : sent
            ? "Show! Seu pedido tá a caminho do WhatsApp da pizzaria. 🎉"
            : "Confira seu pedido, preencha os dados e mande pro nosso zap!"}
        </SpeechBubble>

        {!storeOpen && (
          <div className="pz-closed-banner">
            <Clock size={18} />
            <div>
              <strong>Fora do horário de atendimento</strong>
              <span>Fazemos pedidos todos os dias, das 18h às 23h. Volte nesse período pra finalizar!</span>
            </div>
          </div>
        )}

        <form className="pz-form" onSubmit={handleSubmit} noValidate>
          {cartItems.length > 0 && (
            <div className="pz-cart">
              {cartItems.map((item) => (
                <div className="pz-cart-item" key={item.pizza.id}>
                  <div className="pz-cart-item-top">
                    <p className="pz-cart-item-name">
                      {item.pizza.isHalfHalf ? "🍕 Pizza Meio a Meio" : item.pizza.name}
                    </p>
                    <button
                      type="button"
                      className="pz-cart-item-remove"
                      onClick={() => onRemove(item.pizza.id)}
                      aria-label={`Remover ${item.pizza.name} do pedido`}
                    >
                      Remover
                    </button>
                  </div>

                  {item.pizza.isHalfHalf && (
                    <p className="pz-cart-item-halves">
                      🍕 1/2 {item.pizza.half1.name}
                      <br />
                      🍕 1/2 {item.pizza.half2.name}
                    </p>
                  )}

                  <div className="pz-cart-item-row">
                    <div className="pz-pizza-stepper pz-cart-stepper">
                      <button type="button" className="pz-pizza-stepper-btn" onClick={() => onDecrement(item.pizza.id)} aria-label={`Diminuir quantidade de ${item.pizza.name}`}>
                        −
                      </button>
                      <span className="pz-pizza-stepper-count">{item.quantity}</span>
                      <button type="button" className="pz-pizza-stepper-btn" onClick={() => onIncrement(item.pizza.id)} aria-label={`Aumentar quantidade de ${item.pizza.name}`}>
                        +
                      </button>
                    </div>

                    {!item.pizza.isDrink && (
                      <div className="pz-borda-options pz-cart-borda-options">
                        {BORDA_OPTIONS.map((opt) => (
                          <label key={opt.value} className={`pz-borda-option${item.borda === opt.value ? " is-checked" : ""}`}>
                            <input
                              type="radio"
                              name={`borda-${item.pizza.id}`}
                              value={opt.value}
                              checked={item.borda === opt.value}
                              onChange={() => onBordaChange(item.pizza.id, opt.value)}
                            />
                            {opt.label}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <p className="pz-cart-item-subtotal">Subtotal: <strong>{formatBRL(lineTotal(item))}</strong></p>
                </div>
              ))}
            </div>
          )}
          {errors.cart && <p className="pz-form-error pz-form-error-top">{errors.cart}</p>}

          {cartItems.length > 0 && (
            <div className="pz-form-summary">
              <div className="pz-form-summary-row">
                <span>Subtotal dos produtos</span>
                <strong>{formatBRL(subtotal)}</strong>
              </div>
              <div className="pz-form-summary-row">
                <span>
                  Taxa de entrega
                  {delivery.status === "ok" && ` (~${delivery.distanceKm.toFixed(1)} km)`}
                </span>
                <strong>
                  {delivery.status === "idle" && "Preencha o endereço"}
                  {delivery.status === "loading" && "Calculando…"}
                  {delivery.status === "ok" && formatBRL(delivery.fee)}
                  {delivery.status === "failed" && "A confirmar"}
                </strong>
              </div>
              <div className="pz-form-summary-row pz-form-summary-grand">
                <span>Total</span>
                <strong>
                  {formatBRL(grandTotal)}
                  {delivery.status !== "ok" && " + taxa"}
                </strong>
              </div>
              {delivery.status === "failed" && (
                <p className="pz-form-summary-note">
                  Não conseguimos calcular a distância automaticamente. A taxa de entrega será confirmada
                  pela pizzaria pelo WhatsApp.
                </p>
              )}
            </div>
          )}

          <div className="pz-form-grid">
            <label className="pz-field pz-field-wide">
              <span><User size={15} /> Nome</span>
              <input name="nome" value={data.nome} onChange={handleChange} placeholder="Seu nome completo" maxLength={FIELD_LIMITS.nome} autoComplete="name" />
              {errors.nome && <em>{errors.nome}</em>}
            </label>

            <label className="pz-field pz-field-wide">
              <span><Home size={15} /> Endereço</span>
              <input name="endereco" value={data.endereco} onChange={handleChange} placeholder="Rua, avenida..." maxLength={FIELD_LIMITS.endereco} autoComplete="address-line1" />
              {errors.endereco && <em>{errors.endereco}</em>}
            </label>

            <label className="pz-field">
              <span>Número</span>
              <input name="numero" value={data.numero} onChange={handleChange} placeholder="123" maxLength={FIELD_LIMITS.numero} inputMode="numeric" autoComplete="off" />
              {errors.numero && <em>{errors.numero}</em>}
            </label>

            <label className="pz-field">
              <span><MapPin size={15} /> Bairro</span>
              <input name="bairro" value={data.bairro} onChange={handleChange} placeholder="Seu bairro" maxLength={FIELD_LIMITS.bairro} autoComplete="address-level3" />
              {errors.bairro && <em>{errors.bairro}</em>}
            </label>

            <label className="pz-field">
              <span>Cidade</span>
              <input name="cidade" value={data.cidade} onChange={handleChange} placeholder="Opcional" maxLength={FIELD_LIMITS.cidade} autoComplete="address-level2" />
            </label>

            <label className="pz-field pz-field-wide">
              <span>Complemento</span>
              <input name="complemento" value={data.complemento} onChange={handleChange} placeholder="Casa, apto, ponto de referência (opcional)" maxLength={FIELD_LIMITS.complemento} autoComplete="off" />
            </label>

            <label className="pz-field pz-field-wide">
              <span><StickyNote size={15} /> Observações do pedido</span>
              <textarea name="observacoes" value={data.observacoes} onChange={handleChange} placeholder="Sem cebola, borda recheada... (opcional)" rows={3} maxLength={FIELD_LIMITS.observacoes} />
            </label>
          </div>

          <button
            type="submit"
            className={`pz-btn pz-btn-primary pz-btn-wide${!storeOpen ? " is-disabled" : ""}`}
            disabled={!storeOpen}
            aria-disabled={!storeOpen}
          >
            <MessageCircle size={18} />
            {storeOpen ? "Enviar pedido no WhatsApp" : "Fechado — abre às 18h"}
          </button>
          <a
            ref={whatsappLinkRef}
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "none" }}
            aria-hidden="true"
            tabIndex={-1}
          >
            abrir whatsapp
          </a>

          {sent && (
            <p className="pz-form-success">
              Pedido pronto! Se a aba do WhatsApp não abriu sozinha, toque{" "}
              <a
                href={lastUrl || `https://wa.me/${WHATSAPP_NUMBER}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--red)", fontWeight: 700, textDecoration: "underline" }}
              >
                aqui
              </a>{" "}
              para abrir manualmente. ✅
            </p>
          )}
        </form>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------
   AVALIAÇÕES
------------------------------------------------------------------- */
const REVIEWS = [
  {
    name: "Mariana Costa",
    stars: 5,
    verified: true,
    text: "Pedimos a calabresa e a frango com catupiry. Chegou bem quentinha e a massa estava ótima. Com certeza vamos pedir de novo.",
  },
  {
    name: "Rodrigo A.",
    stars: 4,
    verified: false,
    text: "Gostei bastante da massa. Chegou certinho, dentro do prazo.",
  },
  {
    name: "Juliana Prado",
    stars: 5,
    verified: true,
    text: "Já pedi algumas vezes por aqui e nunca tive problema. A de quatro queijos é muito boa, bem equilibrada no sal.",
  },
  {
    name: "Carlos Eduardo",
    stars: 4,
    verified: false,
    text: "Pizza bem recheada, minha família aprovou. Achei o tempo de entrega mediano, mas nada que atrapalhe.",
  },
  {
    name: "Fernanda M.",
    stars: 3,
    verified: false,
    text: "Numa sexta demorou um pouco mais que o esperado, imagino que seja dia de mais pedido. A pizza em si tava boa.",
  },
  {
    name: "Bruno S.",
    stars: 5,
    verified: true,
    text: "Muito boa, chegou rápido. Recomendo a portuguesa.",
  },
  {
    name: "Diego",
    stars: 5,
    verified: false,
    text: "Custo-benefício bom pro tamanho da pizza. Pedi duas vezes esse mês já.",
  },
];

function Stars({ count }) {
  return (
    <span className="pz-stars" aria-label={`${count} de 5 estrelas`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < count ? "is-filled" : ""} aria-hidden="true">★</span>
      ))}
    </span>
  );
}

function Reviews() {
  return (
    <section id="avaliacoes" className="pz-reviews">
      <span className="pz-eyebrow pz-eyebrow-center">💬 Quem já pediu</span>
      <h2>Avaliações da pizzaria</h2>
      <div className="pz-reviews-columns">
        {REVIEWS.map((r, i) => (
          <div className="pz-review-card" key={r.name + i}>
            <div className="pz-review-top">
              <span className="pz-review-name">{r.name}</span>
              <Stars count={r.stars} />
            </div>
            {r.verified && (
              <span className="pz-review-verified">
                <Check size={11} /> Cliente verificado
              </span>
            )}
            <p className="pz-review-text">{r.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------
   RODAPÉ
------------------------------------------------------------------- */
function Footer() {
  const mapsUrl = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(PIZZERIA_ADDRESS);
  return (
    <footer className="pz-footer">
      <Mascot size={64} />
      <p>
        <strong>Queijos &amp; Risos</strong> — pizza boa é aquela que a gente
        come rindo junto. 🧡
      </p>
      <div className="pz-footer-info">
        <span className="pz-footer-info-item"><Clock size={13} /> Seg a Dom e feriados • 18h às 23h</span>
        <a
          href="https://www.instagram.com/pizzaria.queijoserisos"
          target="_blank"
          rel="noopener noreferrer"
          className="pz-footer-info-item"
        >
          <Instagram size={13} /> @pizzaria.queijoserisos
        </a>
      </div>
      <p className="pz-footer-address">
        <MapPin size={14} /> Rua Luiz Delfino, 475 — Alvorada, Araçatuba/SP
      </p>
      <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="pz-footer-maps-btn">
        <MapPin size={15} /> Ver no Google Maps
      </a>
      <span className="pz-footer-seal">Feita com carinho, todos os dias.</span>
    </footer>
  );
}

/* ------------------------------------------------------------------
   APP
------------------------------------------------------------------- */
export default function App() {
  // Carrinho: { [id]: { quantity, borda } } — "id" pode ser o id de
  // uma pizza/bebida normal, ou uma chave sintética "half::a::b" pra
  // uma pizza meio a meio (ver resolveCartProduct).
  const [cart, setCart] = useState({});
  const [activeTab, setActiveTab] = useState("todas");
  const [half1Id, setHalf1Id] = useState(null);
  const [half2Id, setHalf2Id] = useState(null);
  const formRef = useRef(null);

  const cartItemCount = Object.values(cart).reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = Object.entries(cart).reduce((sum, [id, item]) => {
    const product = resolveCartProduct(id);
    if (!product) return sum;
    const bordaExtra = !product.isDrink && item.borda !== "nenhuma" ? bordaPriceFor(product, item.borda) : 0;
    return sum + (product.price + bordaExtra) * item.quantity;
  }, 0);

  function scrollToId(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleNavClick(e, id) {
    e.preventDefault();
    scrollToId(id);
  }

  function handleSelectTab(tab) {
    setActiveTab(tab);
    scrollToId("cardapio");
  }

  function handleAdd(id) {
    setCart((prev) => ({
      ...prev,
      [id]: { quantity: (prev[id]?.quantity || 0) + 1, borda: prev[id]?.borda || "nenhuma" },
    }));
  }

  function handleIncrement(id) {
    handleAdd(id);
  }

  function handleDecrement(id) {
    setCart((prev) => {
      const current = prev[id];
      if (!current) return prev;
      if (current.quantity <= 1) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: { ...current, quantity: current.quantity - 1 } };
    });
  }

  function handleRemove(id) {
    setCart((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function handleBordaChange(id, borda) {
    setCart((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], borda } } : prev));
  }

  function handleContinue() {
    scrollToId("pedido");
  }

  // Pizza Meio a Meio: começar a montagem a partir de um card
  // específico (pré-preenche a 1ª metade) e ir direto pra seção.
  function handleStartHalfHalf(pizzaId) {
    setHalf1Id(pizzaId);
    setHalf2Id(null);
    scrollToId("meio-a-meio");
  }

  function handleAddHalfHalf(id1, id2) {
    handleAdd(makeHalfKey(id1, id2));
    setHalf1Id(null);
    setHalf2Id(null);
  }

  function handleClearHalfHalf() {
    setHalf1Id(null);
    setHalf2Id(null);
  }

  return (
    <div className="pz-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Luckiest+Guy&family=Baloo+2:wght@500;600;700;800&family=Poppins:wght@400;500;600;700&display=swap');

        html, body {
          margin: 0;
          padding: 0;
          width: 100%;
          overflow-x: hidden;
        }

        .pz-root {
          --red: #8F2C23;
          --red-dark: #6E211A;
          --orange: #E38B2C;
          --yellow: #F5C542;
          --cream: #F6E8D3;
          --olive: #58703B;
          --ink: #3A2318;
          font-family: 'Poppins', sans-serif;
          color: var(--ink);
          background: var(--cream);
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cg fill='none' stroke='%233A2318' stroke-width='2' stroke-linejoin='round' stroke-linecap='round' opacity='0.06'%3E%3Cpath d='M22 18 L38 18 L30 34 Z'/%3E%3Ccircle cx='95' cy='26' r='4'/%3E%3Cpath d='M64 82 q12 -17 24 0 q-12 17 -24 0 Z'/%3E%3Ccircle cx='24' cy='96' r='3'/%3E%3Cpath d='M100 92 L116 92 L108 108 Z'/%3E%3Ccircle cx='60' cy='24' r='2.5'/%3E%3C/g%3E%3C/svg%3E");
          background-size: 140px 140px;
          background-repeat: repeat;
          background-attachment: fixed;
          min-height: 100vh;
          width: 100%;
          max-width: 100%;
          overflow-x: hidden;
        }
        @media (max-width: 768px) {
          .pz-root { background-attachment: scroll; }
        }
        .pz-root * { box-sizing: border-box; }
        .pz-tabs { touch-action: pan-x; }
        #cardapio, #meio-a-meio, #bebidas, #como-funciona, #pedido { scroll-margin-top: 132px; }
        @media (max-width: 560px) { #cardapio, #meio-a-meio, #bebidas, #como-funciona, #pedido { scroll-margin-top: 128px; } }
        @media (max-width: 430px) { #cardapio, #meio-a-meio, #bebidas, #como-funciona, #pedido { scroll-margin-top: 108px; } }
        .pz-root h1, .pz-root h2, .pz-root h3 { font-family: 'Baloo 2', sans-serif; margin: 0; }
        .pz-root a { text-decoration: none; color: inherit; }
        .pz-root button { font-family: 'Baloo 2', sans-serif; cursor: pointer; }
        .pz-root :focus-visible { outline: 3px solid var(--olive); outline-offset: 2px; }

        /* ---- header ---- */
        /* ---- barra de topo ---- */
        .pz-topbar { background: var(--ink); color: var(--cream); border-bottom: 2px solid var(--yellow); }
        .pz-topbar-inner {
          max-width: 1100px; margin: 0 auto; padding: 10px 20px;
          display: flex; align-items: center; justify-content: center; gap: 22px;
          font-size: 0.92rem; font-weight: 700; flex-wrap: wrap;
        }
        .pz-topbar-item { display: inline-flex; align-items: center; gap: 7px; color: var(--cream); white-space: nowrap; }
        .pz-topbar-ig { color: var(--yellow); }
        .pz-topbar-ig:hover { color: #fff; }
        @media (max-width: 480px) {
          .pz-topbar-inner { padding: 8px 14px; gap: 10px; font-size: 0.78rem; justify-content: center; }
        }

        .pz-sticky-nav { position: sticky; top: 0; z-index: 40; }
        .pz-header {
          background: var(--red);
          border-bottom: 5px solid var(--yellow);
        }
        .pz-header-inner {
          max-width: 1100px; margin: 0 auto; padding: 10px 20px;
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
        }
        .pz-brand { display: flex; align-items: center; gap: 12px; }
        .pz-logo-img {
          border-radius: 50%; object-fit: cover; background: var(--cream);
          border: 3px solid var(--yellow); box-shadow: 0 3px 0 var(--red-dark);
        }
        .pz-brand-text { display: flex; flex-direction: column; line-height: 1.05; color: var(--cream); font-family: 'Baloo 2', sans-serif; font-size: 1.15rem; }
        .pz-brand-text small { font-size: 0.6rem; letter-spacing: 0.18em; color: var(--yellow); font-weight: 700; }
        .pz-nav { display: flex; align-items: center; gap: 18px; }
        .pz-nav a { color: var(--cream); font-weight: 600; font-size: 0.95rem; }
        .pz-nav a:hover { color: var(--yellow); }
        .pz-nav-cta { background: var(--yellow); color: var(--ink) !important; padding: 8px 16px; border-radius: 999px; font-weight: 700; }
        .pz-nav-cta:hover { background: var(--orange); }
        .pz-nav-cta-drinks { background: var(--olive); color: var(--cream) !important; }
        .pz-nav-cta-drinks:hover { background: #4a5e30; }
        @media (max-width: 640px) { .pz-nav { gap: 8px; } .pz-nav a:not(.pz-nav-cta) { display: none; } }

        /* ---- botões ---- */
        .pz-btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          border: 3px solid var(--ink); border-radius: 999px; padding: 13px 26px;
          font-weight: 700; font-size: 1rem; transition: transform .12s ease, box-shadow .12s ease, background .12s ease;
        }
        .pz-btn:hover { transform: translate(-2px, -2px); }
        .pz-btn-primary { background: var(--red); color: var(--cream); box-shadow: 5px 5px 0 var(--ink); }
        .pz-btn-primary:hover { background: var(--red-dark); box-shadow: 7px 7px 0 var(--ink); }
        .pz-btn-secondary { background: var(--yellow); color: var(--ink); box-shadow: 4px 4px 0 var(--ink); }
        .pz-btn-secondary:hover { box-shadow: 6px 6px 0 var(--ink); }
        .pz-btn-wide { width: 100%; }
        @media (prefers-reduced-motion: reduce) { .pz-btn:hover { transform: none; } }

        /* ---- eyebrow ---- */
        .pz-eyebrow { display: inline-block; background: var(--yellow); color: var(--ink); font-weight: 700; font-size: 0.85rem; padding: 6px 14px; border-radius: 999px; margin-bottom: 14px; }
        .pz-eyebrow-center { display: block; width: fit-content; margin-left: auto; margin-right: auto; }

        /* ---- hero ---- */
        .pz-hero { max-width: 1100px; margin: 0 auto; padding: 60px 20px 40px; display: flex; align-items: center; gap: 40px; flex-wrap: wrap; overflow: hidden; }
        .pz-hero-text { flex: 1 1 380px; }
        .pz-hero-text h1 { font-size: clamp(2.1rem, 5vw, 3.2rem); line-height: 1.08; color: var(--red); }
        .pz-hero-text h1 span { color: var(--olive); }
        .pz-hero-text p { font-size: 1.05rem; margin: 18px 0 26px; max-width: 46ch; }
        .pz-hero-mascot { flex: 0 0 auto; margin-left: auto; }
        .pz-hero-chips { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
        .pz-hero-chip {
          background: #fff; border: 2px solid var(--ink); border-radius: 999px; padding: 7px 14px;
          font-family: 'Baloo 2', sans-serif; font-weight: 700; font-size: 0.82rem; color: var(--ink);
          cursor: pointer; box-shadow: 2px 2px 0 var(--ink); transition: background .12s ease, transform .12s ease;
        }
        .pz-hero-chip:hover { background: var(--yellow); transform: translate(-1px, -1px); }

        .pz-hero-text-anim { animation: pz-fade-up .6s ease both; }
        .pz-hero-mascot-anim { animation: pz-hop-in .7s cubic-bezier(.34,1.56,.64,1) .1s both; }
        @keyframes pz-fade-up { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pz-hop-in {
          0% { opacity: 0; transform: translateY(-40px) rotate(-8deg) scale(0.8); }
          60% { opacity: 1; transform: translateY(6px) rotate(3deg) scale(1.03); }
          100% { opacity: 1; transform: translateY(0) rotate(0deg) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .pz-hero-text-anim, .pz-hero-mascot-anim { animation: none; }
        }

        /* ---- como funciona ---- */
        .pz-how { max-width: 1100px; margin: 0 auto; padding: 30px 20px 60px; text-align: center; }
        .pz-how h2 { font-size: 2rem; color: var(--red); margin-bottom: 26px; }
        .pz-how-strip { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; justify-content: center; }
        .pz-how-mascot { flex: 0 0 auto; filter: drop-shadow(4px 4px 0 rgba(58,35,24,0.15)); }
        .pz-how-grid { display: flex; align-items: stretch; gap: 14px; flex-wrap: wrap; justify-content: center; flex: 1 1 480px; }
        .pz-how-card { background: #fff; border: 3px solid var(--ink); border-radius: 18px; padding: 20px 18px; text-align: left; box-shadow: 5px 5px 0 var(--orange); flex: 1 1 200px; max-width: 240px; }
        .pz-how-num { font-size: 1.8rem; display: block; margin-bottom: 6px; }
        .pz-how-card h3 { font-size: 1.05rem; margin-bottom: 6px; }
        .pz-how-card p { margin: 0; font-size: 0.9rem; }
        .pz-how-arrow { color: var(--olive); font-size: 1.4rem; align-self: center; }
        @media (max-width: 780px) { .pz-how-arrow { display: none; } .pz-how-mascot { margin: 0 auto; } }
        @media (max-width: 560px) {
          .pz-how-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; width: 100%; }
          .pz-how-card { max-width: none; padding: 14px 12px; }
          .pz-how-card-last { grid-column: 1 / -1; max-width: 260px; margin: 0 auto; }
          .pz-how-mascot svg { width: 76px; height: auto; }
        }

        /* ---- cardápio ---- */
        .pz-menu { max-width: 1100px; margin: 0 auto; padding: 20px 20px 40px; text-align: center; }
        .pz-catbar { background: var(--cream); border-bottom: 3px solid var(--ink); padding-top: 6px; box-shadow: 0 3px 6px rgba(58,35,24,0.12); }
        .pz-catbar-inner { max-width: 1100px; margin: 0 auto; padding: 6px 20px 10px; }
        .pz-tabs {
          display: flex; gap: 10px; overflow-x: auto; -webkit-overflow-scrolling: touch;
          scroll-snap-type: x proximity; padding: 2px 2px 4px; scrollbar-width: none;
        }
        .pz-tabs::-webkit-scrollbar { display: none; }
        .pz-tab {
          flex: 0 0 auto; scroll-snap-align: start; white-space: nowrap;
          border: 2.5px solid var(--ink); background: #fff; border-radius: 999px;
          padding: 8px 16px; font-family: 'Baloo 2', sans-serif; font-weight: 700; font-size: 0.82rem;
          color: var(--ink); cursor: pointer; box-shadow: 3px 3px 0 var(--ink);
          transition: background .12s ease, color .12s ease, transform .12s ease, box-shadow .12s ease;
        }
        .pz-tab:hover { transform: translate(-1px, -1px); box-shadow: 4px 4px 0 var(--ink); }
        .pz-tab.is-active { background: var(--red); border-color: var(--red); color: var(--cream); box-shadow: 3px 3px 0 var(--red-dark); }
        @media (prefers-reduced-motion: reduce) { .pz-tab:hover { transform: none; } }
        .pz-menu h2 { font-size: 2rem; color: var(--red); }
        .pz-menu-group { margin-bottom: 34px; text-align: left; }
        .pz-menu-group-title {
          font-family: 'Baloo 2', sans-serif; font-weight: 800; font-size: 1.15rem; text-transform: uppercase;
          color: var(--red); text-align: left; margin: 0 0 14px; padding-bottom: 8px;
          border-bottom: 3px dashed var(--orange);
        }
        .pz-menu-sub { max-width: 50ch; margin: 10px auto 30px; opacity: 0.85; }
        .pz-menu-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 18px; }
        @media (max-width: 520px) {
          .pz-menu-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
          .pz-pizza-card { padding: 10px; gap: 6px; }
          .pz-pizza-img { aspect-ratio: 4 / 3; }
          .pz-pizza-img svg { width: 26px; height: 26px; }
          .pz-pizza-img span { font-size: 0.62rem; }
          .pz-pizza-name { font-size: 0.9rem; }
          .pz-pizza-ingredients { font-size: 0.66rem; }
          .pz-pizza-select { padding: 9px 10px; font-size: 0.78rem; min-height: 40px; }
        }
        .pz-pizza-card {
          display: flex; flex-direction: column; align-items: stretch; gap: 12px;
          background: #fff; border: 3px solid var(--ink);
          border-radius: 255px 15px 225px 15px/15px 225px 15px 255px;
          padding: 14px; box-shadow: 5px 5px 0 var(--ink); transition: transform .12s ease, box-shadow .12s ease;
        }
        .pz-pizza-card:hover { transform: translate(-2px, -2px); box-shadow: 7px 7px 0 var(--ink); }
        .pz-pizza-card.is-selected { border-color: var(--red); box-shadow: 5px 5px 0 var(--red); background: #FFFBF2; }
        @media (prefers-reduced-motion: reduce) { .pz-pizza-card:hover { transform: none; } }
        /* O botão/contador de quantidade sempre gruda na base do card,
           mesmo quando o conteúdo acima varia de tamanho (ex.: alguns
           refrigerantes têm um aviso extra e outros não) — assim toda
           a fileira fica com os botões alinhados na mesma altura. */
        .pz-pizza-card > .pz-pizza-select,
        .pz-pizza-card > .pz-pizza-stepper,
        .pz-pizza-card > .pz-pizza-unavailable {
          margin-top: auto;
        }
        .pz-pizza-card > .pz-pizza-half-link {
          margin-top: 0;
        }

        .pz-pizza-img {
          position: relative;
          aspect-ratio: 1 / 1; width: 100%;
          border-radius: 255px 15px 225px 15px/15px 225px 15px 255px;
          background:
            repeating-linear-gradient(45deg, var(--cream), var(--cream) 10px, #EFE0C4 10px, #EFE0C4 20px);
          border: 2.5px dashed var(--orange); color: var(--orange);
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
        }
        .pz-pizza-img-photo {
          border: 2.5px solid var(--ink); background: var(--cream); overflow: hidden; padding: 0;
        }
        .pz-pizza-img-photo img {
          width: 100%; height: 100%; object-fit: cover; object-position: center; display: block;
        }
        .pz-pizza-img-label { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.03em; color: var(--ink); opacity: 0.6; }
        .pz-pizza-name { margin: 0; font-family: 'Baloo 2', sans-serif; font-weight: 700; font-size: 1.05rem; color: var(--ink); text-align: center; }
        .pz-pizza-ingredients { display: block; text-align: center; font-size: 0.72rem; color: var(--ink); opacity: 0.65; line-height: 1.3; }
        .pz-pizza-price { margin: -2px 0 2px; text-align: center; font-family: 'Baloo 2', sans-serif; font-weight: 800; font-size: 0.95rem; color: var(--olive); }

        .pz-pizza-select {
          position: relative; display: flex; align-items: center; justify-content: center; gap: 6px;
          background: var(--cream); border: 2.5px solid var(--ink); border-radius: 999px;
          padding: 9px 14px; font-weight: 700; font-size: 0.88rem; color: var(--ink);
          box-shadow: 3px 3px 0 var(--ink); transition: background .12s ease, color .12s ease, box-shadow .12s ease, transform .12s ease;
        }
        .pz-pizza-select:hover { background: var(--yellow); transform: translate(-1px, -1px); box-shadow: 4px 4px 0 var(--ink); }
        .is-selected .pz-pizza-select { background: var(--red); border-color: var(--red); color: var(--cream); box-shadow: 3px 3px 0 var(--red-dark); }
        .pz-pizza-unavailable {
          display: block; text-align: center; font-size: 0.78rem; font-weight: 700; color: var(--ink); opacity: 0.55;
          border: 2px dashed var(--ink); border-radius: 999px; padding: 8px 10px;
        }
        .pz-pizza-note {
          display: block; text-align: center; font-size: 0.7rem; font-weight: 700; line-height: 1.3;
          background: var(--yellow); color: var(--ink); border: 1.5px solid var(--ink); border-radius: 8px;
          padding: 5px 8px; margin: 0 0 2px;
        }
        .pz-pizza-half-link {
          display: block; width: 100%; text-align: center; background: none; border: none;
          color: var(--olive); font-weight: 700; font-size: 0.72rem; text-decoration: underline;
          cursor: pointer; padding: 4px 2px 0; margin-top: -2px;
        }
        .pz-pizza-half-link:hover { color: var(--red); }

        /* ---- meio a meio ---- */
        .pz-halfhalf-picker {
          display: flex; align-items: center; justify-content: center; gap: 14px; flex-wrap: wrap;
          max-width: 720px; margin: 0 auto 20px;
        }
        .pz-halfhalf-slot { display: flex; flex-direction: column; gap: 6px; flex: 1 1 260px; text-align: left; }
        .pz-halfhalf-slot-label { font-family: 'Baloo 2', sans-serif; font-weight: 700; font-size: 0.85rem; color: var(--ink); }
        .pz-halfhalf-select {
          font-family: 'Poppins', sans-serif; font-size: 0.92rem; padding: 11px 12px;
          border: 2.5px solid var(--ink); border-radius: 10px; background: #fff; color: var(--ink);
          width: 100%;
        }
        .pz-halfhalf-plus {
          font-family: 'Baloo 2', sans-serif; font-weight: 800; font-size: 1.4rem; color: var(--orange);
          flex: 0 0 auto; padding-top: 22px;
        }
        @media (max-width: 640px) {
          .pz-halfhalf-picker { flex-direction: column; gap: 10px; }
          .pz-halfhalf-plus { padding-top: 0; }
        }
        .pz-halfhalf-preview {
          max-width: 480px; margin: 0 auto; background: #fff; border: 3px solid var(--ink); border-radius: 16px;
          padding: 18px; text-align: center; box-shadow: 5px 5px 0 var(--ink);
        }
        .pz-halfhalf-preview-halves {
          display: flex; flex-direction: column; gap: 4px; font-weight: 700; font-size: 0.98rem;
          color: var(--ink); margin-bottom: 10px;
        }
        .pz-halfhalf-preview-price { font-size: 1rem; color: var(--ink); margin-bottom: 14px; }
        .pz-halfhalf-preview-price strong { font-family: 'Baloo 2', sans-serif; font-size: 1.3rem; color: var(--red); }
        .pz-halfhalf-preview-actions { display: flex; flex-direction: column; align-items: center; gap: 8px; }
        .pz-halfhalf-clear { background: none; border: none; color: var(--ink); opacity: 0.6; font-size: 0.82rem; text-decoration: underline; cursor: pointer; }
        .pz-halfhalf-clear:hover { opacity: 1; }

        .pz-pizza-select-check {
          display: inline-flex; width: 18px; height: 18px; border-radius: 50%; background: var(--olive);
          color: #fff; align-items: center; justify-content: center; opacity: 0; transform: scale(0.6);
          transition: all .15s ease; flex: 0 0 auto;
        }
        .is-selected .pz-pizza-select-check { opacity: 1; transform: scale(1); }

        .pz-pizza-stepper {
          display: flex; align-items: center; justify-content: center; gap: 0;
          border: 2.5px solid var(--red); border-radius: 999px; overflow: hidden;
          background: var(--red); box-shadow: 3px 3px 0 var(--red-dark);
        }
        .pz-pizza-stepper-btn {
          flex: 1 1 auto; border: none; background: var(--red); color: var(--cream);
          font-family: 'Baloo 2', sans-serif; font-weight: 800; font-size: 1.1rem; line-height: 1;
          padding: 9px 14px; cursor: pointer; transition: background .12s ease;
        }
        .pz-pizza-stepper-btn:hover { background: var(--red-dark); }
        .pz-pizza-stepper-count {
          flex: 0 0 auto; min-width: 32px; text-align: center; background: var(--cream); color: var(--ink);
          font-family: 'Baloo 2', sans-serif; font-weight: 800; font-size: 0.95rem; padding: 9px 6px;
        }

        /* ---- barra flutuante ---- */
        .pz-orderbar { position: sticky; bottom: 0; z-index: 30; background: var(--red); border-top: 5px solid var(--yellow); }
        .pz-orderbar-inner { max-width: 1100px; margin: 0 auto; padding: 10px 20px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .pz-orderbar-info { display: flex; align-items: center; gap: 10px; color: var(--cream); min-width: 0; }
        .pz-orderbar-info small { display: block; font-size: 0.7rem; opacity: 0.85; }
        .pz-orderbar-info strong { font-family: 'Baloo 2', sans-serif; font-size: 1.05rem; }

        /* ---- bolha de fala ---- */
        .pz-bubble { position: relative; background: #fff; border: 3px solid var(--ink); border-radius: 16px; padding: 14px 18px; max-width: 420px; margin: 0 auto 24px; text-align: center; font-weight: 600; }
        .pz-bubble-tail { position: absolute; left: 50%; bottom: -14px; transform: translateX(-50%); width: 0; height: 0; border-left: 10px solid transparent; border-right: 10px solid transparent; border-top: 14px solid var(--ink); }
        .pz-bubble-tail::before { content: ""; position: absolute; left: -8px; top: -13px; width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 11px solid #fff; }

        /* ---- formulário ---- */
        .pz-form-section { max-width: 720px; margin: 0 auto; padding: 40px 20px 70px; text-align: center; }
        .pz-form-section h2 { font-size: 2rem; color: var(--red); margin-bottom: 20px; }
        .pz-form-wrap { text-align: left; }
        .pz-form { background: #fff; border: 3px solid var(--ink); border-radius: 20px; padding: 26px; box-shadow: 7px 7px 0 var(--orange); }
        .pz-cart { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
        .pz-cart-item { background: var(--cream); border: 2.5px solid var(--ink); border-radius: 14px; padding: 12px 14px; }
        .pz-cart-item-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
        .pz-cart-item-name { margin: 0; font-family: 'Baloo 2', sans-serif; font-weight: 700; font-size: 1rem; color: var(--ink); }
        .pz-cart-item-halves { margin: -6px 0 10px; font-size: 0.85rem; color: var(--ink); opacity: 0.8; line-height: 1.5; }
        .pz-cart-item-remove { border: none; background: none; color: var(--red); font-weight: 700; font-size: 0.78rem; text-decoration: underline; cursor: pointer; padding: 4px; }
        .pz-cart-item-remove:hover { color: var(--red-dark); }
        .pz-cart-item-row { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; margin-bottom: 8px; }
        .pz-cart-stepper { flex: 0 0 auto; }
        .pz-cart-stepper .pz-pizza-stepper-btn { padding: 6px 12px; font-size: 0.95rem; }
        .pz-cart-stepper .pz-pizza-stepper-count { padding: 6px 4px; min-width: 26px; font-size: 0.88rem; }
        .pz-cart-borda-options { flex: 1 1 auto; gap: 6px; }
        .pz-cart-borda-options .pz-borda-option { padding: 5px 11px; font-size: 0.76rem; }
        .pz-cart-item-subtotal { margin: 0; text-align: right; font-size: 0.85rem; color: var(--ink); }
        .pz-cart-item-subtotal strong { color: var(--olive); font-family: 'Baloo 2', sans-serif; }

        .pz-borda-options { display: flex; flex-wrap: wrap; gap: 8px; }
        .pz-borda-option {
          display: inline-flex; align-items: center; gap: 6px; background: #fff; border: 2px solid var(--ink);
          border-radius: 999px; padding: 7px 14px; font-size: 0.84rem; font-weight: 600; cursor: pointer;
          transition: background .12s ease, color .12s ease;
        }
        .pz-borda-option input { accent-color: var(--red); margin: 0; }
        .pz-borda-option.is-checked { background: var(--olive); border-color: var(--olive); color: #fff; }
        .pz-form-summary {
          background: var(--cream); border: 2.5px solid var(--ink); border-radius: 12px;
          padding: 12px 16px; margin-bottom: 16px;
        }
        .pz-form-summary-row {
          display: flex; align-items: baseline; justify-content: space-between; gap: 10px;
          font-size: 0.88rem; padding: 4px 0; color: var(--ink);
        }
        .pz-form-summary-row strong { font-family: 'Baloo 2', sans-serif; font-weight: 700; }
        .pz-form-summary-grand {
          border-top: 2px dashed var(--orange); margin-top: 4px; padding-top: 8px;
          font-size: 1rem; font-weight: 700;
        }
        .pz-form-summary-grand strong { color: var(--red); font-size: 1.2rem; }
        .pz-form-summary-note { margin: 8px 0 0; font-size: 0.78rem; color: var(--ink); opacity: 0.75; }
        .pz-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .pz-field { display: flex; flex-direction: column; gap: 6px; font-size: 0.85rem; font-weight: 700; color: var(--ink); }
        .pz-field-wide { grid-column: 1 / -1; }
        .pz-field span { display: flex; align-items: center; gap: 6px; }
        .pz-field input, .pz-field textarea {
          font-family: 'Poppins', sans-serif; font-size: 0.95rem; font-weight: 400; padding: 10px 12px;
          border: 2px solid var(--ink); border-radius: 10px; background: var(--cream); resize: vertical;
        }
        .pz-field input:focus, .pz-field textarea:focus { background: #fff; }
        .pz-field em { font-style: normal; color: var(--red); font-size: 0.78rem; font-weight: 600; }
        .pz-form-error { color: var(--red); font-weight: 700; font-size: 0.9rem; }
        .pz-form-error-top { margin: -6px 0 14px; }
        .pz-form button[type="submit"] { margin-top: 18px; }
        .pz-form-success { margin-top: 14px; text-align: center; color: var(--olive); font-weight: 700; }
        .pz-closed-banner {
          display: flex; align-items: flex-start; gap: 10px; background: var(--yellow);
          border: 2.5px solid var(--ink); border-radius: 12px; padding: 12px 14px; margin: 0 auto 20px;
          box-shadow: 3px 3px 0 var(--ink); color: var(--ink);
        }
        .pz-closed-banner strong { display: block; font-family: 'Baloo 2', sans-serif; font-size: 0.95rem; margin-bottom: 2px; }
        .pz-closed-banner span { display: block; font-size: 0.85rem; }
        .pz-btn.is-disabled, .pz-btn:disabled {
          opacity: 0.55; cursor: not-allowed; box-shadow: none !important; transform: none !important;
        }
        .pz-btn.is-disabled:hover, .pz-btn:disabled:hover { transform: none !important; }
        @media (max-width: 560px) { .pz-form-grid { grid-template-columns: 1fr; } }

        /* ---- avaliações ---- */
        .pz-reviews { max-width: 1000px; margin: 0 auto; padding: 20px 20px 56px; text-align: center; }
        .pz-reviews h2 { font-size: 1.8rem; color: var(--red); margin-bottom: 30px; }
        .pz-reviews-columns { column-count: 3; column-gap: 18px; text-align: left; }
        .pz-review-card {
          break-inside: avoid; margin-bottom: 18px; background: #fff;
          border: 2.5px solid var(--ink); border-radius: 14px; padding: 16px 18px;
          box-shadow: 3px 3px 0 var(--ink);
        }
        .pz-review-card:nth-child(3n+1) { transform: rotate(-0.6deg); }
        .pz-review-card:nth-child(3n+2) { transform: rotate(0.5deg); }
        .pz-review-card:nth-child(3n+3) { transform: rotate(-0.3deg); }
        .pz-review-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 4px; }
        .pz-review-name { font-family: 'Baloo 2', sans-serif; font-weight: 700; font-size: 0.95rem; color: var(--ink); }
        .pz-stars { font-size: 0.85rem; letter-spacing: 1px; color: rgba(58,35,24,0.25); white-space: nowrap; }
        .pz-stars .is-filled { color: var(--yellow); text-shadow: 0 0 0 var(--ink); -webkit-text-stroke: 0.5px var(--ink); }
        .pz-review-verified {
          display: inline-flex; align-items: center; gap: 4px; background: var(--cream); color: var(--olive);
          font-size: 0.68rem; font-weight: 700; padding: 2px 8px; border-radius: 999px; border: 1.5px solid var(--olive);
          margin-bottom: 8px;
        }
        .pz-review-text { margin: 0; font-size: 0.92rem; line-height: 1.5; color: var(--ink); }
        @media (max-width: 820px) { .pz-reviews-columns { column-count: 2; } }
        @media (max-width: 560px) { .pz-reviews-columns { column-count: 1; } .pz-review-card { transform: none !important; } }
        @media (prefers-reduced-motion: reduce) { .pz-review-card { transform: none !important; } }

        /* ---- rodapé ---- */
        .pz-footer { background: var(--red); color: var(--cream); text-align: center; padding: 34px 20px 40px; border-top: 5px solid var(--yellow); display: flex; flex-direction: column; align-items: center; gap: 10px; }
        .pz-footer p { max-width: 40ch; margin: 0; }
        .pz-footer-info { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 16px; font-size: 0.82rem; }
        .pz-footer-info-item { display: inline-flex; align-items: center; gap: 6px; color: var(--cream); font-weight: 600; }
        .pz-footer-info-item:is(a):hover { color: var(--yellow); }
        .pz-footer-address { display: flex; align-items: center; gap: 6px; font-size: 0.82rem; color: var(--cream); opacity: 0.9; margin: 2px 0 0; }
        .pz-footer-maps-btn {
          display: inline-flex; align-items: center; gap: 6px; background: var(--yellow); color: var(--ink);
          font-weight: 700; font-size: 0.85rem; padding: 9px 16px; border-radius: 999px; border: 2.5px solid var(--ink);
          box-shadow: 3px 3px 0 var(--red-dark); margin-top: 2px;
        }
        .pz-footer-maps-btn:hover { background: #fff; }
        .pz-footer-seal { font-size: 0.8rem; color: var(--yellow); font-weight: 700; letter-spacing: 0.04em; }

        /* ---- compactação geral para telas pequenas (menos rolagem) ---- */
        @media (max-width: 560px) {
          .pz-hero { padding: 22px 18px 20px; gap: 14px; }
          .pz-hero-mascot svg { width: 108px; height: auto; }
          .pz-hero-text h1 { font-size: 1.7rem; }
          .pz-hero-text p { margin: 8px 0 14px; font-size: 0.92rem; }
          .pz-eyebrow { padding: 4px 12px; font-size: 0.76rem; margin-bottom: 8px; }
          .pz-btn { padding: 11px 22px; font-size: 0.92rem; }
          .pz-how { padding: 16px 18px 28px; }
          .pz-how h2 { font-size: 1.35rem; margin-bottom: 12px; }
          .pz-menu { padding: 12px 18px 20px; }
          .pz-catbar-inner { padding: 5px 18px 8px; }
          .pz-tab { padding: 9px 14px; font-size: 0.76rem; min-height: 38px; }
          .pz-menu h2 { font-size: 1.35rem; }
          .pz-menu-group { margin-bottom: 24px; }
          .pz-menu-group-title { font-size: 0.98rem; margin-bottom: 10px; }
          .pz-menu-sub { margin: 6px auto 14px; font-size: 0.85rem; }
          .pz-form-section { padding: 20px 18px 34px; }
          .pz-form-section h2 { font-size: 1.35rem; margin-bottom: 12px; }
          .pz-form { padding: 16px; }
          .pz-reviews { padding: 10px 18px 26px; }
          .pz-reviews h2 { font-size: 1.25rem; margin-bottom: 14px; }
          .pz-footer { padding: 20px 18px 54px; }
        }
        @media (max-width: 430px) {
          .pz-hero { flex-direction: column-reverse; text-align: center; }
          .pz-hero-mascot { margin: 0 auto; }
          .pz-hero-mascot svg { width: 84px; }
          .pz-hero-text p { max-width: 34ch; margin-left: auto; margin-right: auto; }
          .pz-hero-chips { justify-content: center; }
          .pz-logo-img { width: 46px; height: 46px; }
          .pz-header-inner { padding: 8px 16px; }
          .pz-brand-text { font-size: 0.98rem; }
          .pz-nav-cta { padding: 7px 11px; font-size: 0.82rem; }
        }
      `}</style>

      <TopBar />
      <div className="pz-sticky-nav">
        <Header onNavClick={handleNavClick} />
        <CategoryBar activeTab={activeTab} onSelectTab={handleSelectTab} />
      </div>
      <Hero
        onCtaClick={() => scrollToId("cardapio")}
        onHalfHalfClick={() => scrollToId("meio-a-meio")}
        onDrinksClick={() => scrollToId("bebidas")}
      />
      <HowItWorks />
      <Menu
        cart={cart}
        onAdd={handleAdd}
        onIncrement={handleIncrement}
        onDecrement={handleDecrement}
        onStartHalfHalf={handleStartHalfHalf}
        activeTab={activeTab}
      />
      <HalfHalfBuilder
        half1Id={half1Id}
        half2Id={half2Id}
        onSetHalf1={setHalf1Id}
        onSetHalf2={setHalf2Id}
        onAdd={handleAddHalfHalf}
        onClear={handleClearHalfHalf}
      />
      <Drinks cart={cart} onAdd={handleAdd} onIncrement={handleIncrement} onDecrement={handleDecrement} />
      <OrderForm
        cart={cart}
        onIncrement={handleIncrement}
        onDecrement={handleDecrement}
        onRemove={handleRemove}
        onBordaChange={handleBordaChange}
        formRef={formRef}
      />
      <Reviews />
      <Footer />
      <OrderBar itemCount={cartItemCount} total={cartTotal} onContinue={handleContinue} />
    </div>
  );
}
