const NOMES_MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const CORES = ["#5eead4", "#a78bfa", "#fbbf24", "#f472b6", "#60a5fa", "#a3e635"];

const estado = {
  tela: "visao",
  mes: null,
  ano: null,
  transacoes: [],
  perfis: [],
  regras: [],
  categorias: [],
  orcamentos: {},
  recorrentes: [],
  transferencia: "Entre minhas contas",
  privado: lerPreferencia("privado") === "sim",
  anoResumo: null,
  animarAbertura: true,
  graficos: [],
  filtros: { busca: "", periodo: "mes", banco: "", categoria: "", tipo: "" },
};

const conteudo = document.getElementById("conteudo");

function lerPreferencia(nome) {
  try { return localStorage.getItem("blendercash." + nome); } catch (erro) { return null; }
}
function salvarPreferencia(nome, valor) {
  try { localStorage.setItem("blendercash." + nome, valor); } catch (erro) {  }
}

function dinheiro(centavos) {
  if (estado.privado) return "R$ •••••";
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function numeroDinheiro(classe, centavos) {
  const el = criar("span", classe, dinheiro(centavos));
  el.dataset.centavos = String(centavos);
  return el;
}

function dinheiroSempre(centavos) {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function valorParaCampo(centavos) {
  return (Math.abs(centavos) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function criar(tag, classe, texto) {
  const elemento = document.createElement(tag);
  if (classe) elemento.className = classe;
  if (texto !== undefined && texto !== null) elemento.textContent = texto;
  return elemento;
}

function foraDaConta(t) {
  return t.categoria === estado.transferencia || t.categoria === estado.investimento;
}

const COR_INVESTIMENTO = "#60a5fa";

function corDaCategoria(nome) {
  let soma = 0;
  for (const letra of nome) soma = soma + letra.charCodeAt(0);
  return CORES[soma % CORES.length];
}

function dois(n) { return String(n).padStart(2, "0"); }
function dataCurta(d) { return dois(d.dia) + "/" + dois(d.mes); }
function dataLonga(d) { return dois(d.dia) + "/" + dois(d.mes) + "/" + d.ano; }
function hojeISO() {
  const h = new Date();
  return h.getFullYear() + "-" + dois(h.getMonth() + 1) + "-" + dois(h.getDate());
}

function icone(caminhoSvg) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  for (const [nome, valor] of Object.entries({ width: "18", height: "18", viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" })) {
    svg.setAttribute(nome, valor);
  }
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", caminhoSvg);
  svg.appendChild(path);
  return svg;
}

const SVG_IMPORTAR = "M12 15V3M7 8l5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4";
const SVG_MAIS = "M12 5v14M5 12h14";
const SVG_ANTERIOR = "M15 18l-6-6 6-6";
const SVG_PROXIMO = "M9 18l6-6-6-6";
const SVG_BAIXAR = "M12 4v12M7 11l5 5 5-5M5 20h14";
const SVG_PDF = "M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M9 14h6M9 18h4";
const SVG_ALERTA = "M12 3l10 18H2zM12 10v5M12 18h.01";
const SVG_IR ="M5 12h14M13 6l6 6-6 6";
const SVG_EDITAR = "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z";
const SVG_PASTA = "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z";
const SVG_LIXEIRA = "M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14";
const SVG_OLHO ="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z";
const SVG_OLHO_FECHADO = "M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.8 9.8 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2";

function botao(texto, classe, aoClicar, svg) {
  const b = criar("button", "glass btn " + (classe || ""));
  b.type = "button";
  if (svg) b.appendChild(icone(svg));
  if (texto) b.appendChild(document.createTextNode(texto));
  b.addEventListener("click", aoClicar);
  return b;
}

function botaoCard(topo, texto, svg, aoClicar) {
  topo.classList.add("painel-topo-com-botao");
  const b = botao(texto, "btn-destaque", aoClicar, svg);
  topo.appendChild(b);
  return b;
}

function campoComEtiqueta(etiqueta, tag, atributos) {
  const grupo = criar("div", "campo-grupo");
  const id = "campo-" + Math.random().toString(36).slice(2, 8);
  const rotulo = criar("label", "rotulo", etiqueta);
  rotulo.htmlFor = id;
  const campo = criar(tag, "campo");
  campo.id = id;
  for (const [nome, valor] of Object.entries(atributos || {})) campo.setAttribute(nome, valor);
  grupo.appendChild(rotulo);
  grupo.appendChild(campo);
  return { grupo: grupo, campo: campo };
}

function opcao(valor, texto, selecionada) {
  const o = criar("option", "", texto);
  o.value = valor;
  if (selecionada) o.selected = true;
  return o;
}

function segmento(nome, opcoes, marcada) {
  const caixa = criar("div", "segmento");
  caixa.setAttribute("role", "radiogroup");
  for (const [valor, texto] of opcoes) {
    const rotulo = criar("label", "segmento-opcao");
    const radio = criar("input");
    radio.type = "radio";
    radio.name = nome;
    radio.value = valor;
    radio.checked = valor === marcada;
    rotulo.appendChild(radio);
    rotulo.appendChild(criar("span", "", texto));
    caixa.appendChild(rotulo);
  }
  return caixa;
}

const janela = document.getElementById("janela");
const janelaForm = document.getElementById("janela-form");
const janelaErro = document.getElementById("janela-erro");
let janelaAoConfirmar = null;
let focoAntes = null;

function abrirJanela(opcoes) {
  focoAntes = document.activeElement;
  document.getElementById("janela-titulo").textContent = opcoes.titulo;
  const corpo = document.getElementById("janela-corpo");
  corpo.replaceChildren(opcoes.corpo);
  janelaErro.hidden = true;

  const botoes = document.getElementById("janela-botoes");
  botoes.replaceChildren();
  for (const extra of opcoes.extras || []) botoes.appendChild(extra);
  const espaco = criar("div", "espaco-flex");
  botoes.appendChild(espaco);
  botoes.appendChild(botao("Cancelar", "", fecharJanela));
  const ok = criar("button", "glass btn btn-main", opcoes.textoOk || "Salvar");
  ok.type = "submit";
  botoes.appendChild(ok);

  janelaAoConfirmar = opcoes.aoConfirmar;
  janela.hidden = false;
  const primeiro = corpo.querySelector("input:not([type=radio]), select, textarea") || ok;
  primeiro.focus();
}

function fecharJanela() {
  janela.hidden = true;
  janelaAoConfirmar = null;
  if (focoAntes && focoAntes.focus) focoAntes.focus();
}

function mostrarErroJanela(texto) {
  janelaErro.textContent = texto;
  janelaErro.hidden = false;
}

janelaForm.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  if (!janelaAoConfirmar) return;
  try {
    const fechar = await janelaAoConfirmar();
    if (fechar !== false) fecharJanela();
  } catch (erro) {
    mostrarErroJanela(erro.message);
  }
});

janela.addEventListener("keydown", (e) => { if (e.key === "Escape") fecharJanela(); });
janela.addEventListener("mousedown", (e) => { if (e.target === janela) fecharJanela(); });

async function pedir(promessa) {
  const resposta = await promessa;
  if (resposta && resposta.ok === false) throw new Error(resposta.mensagem);
  return resposta;
}

async function recarregar() {
  const tudo = await window.blendercash.obterTudo();

  if (tudo.trancado) {
    mostrarCadeado();
    return;
  }

  estado.transacoes = tudo.transacoes;
  estado.perfis = tudo.perfis;
  estado.regras = tudo.regras;
  estado.categorias = tudo.categorias;
  estado.orcamentos = tudo.orcamentos;
  estado.recorrentes = tudo.recorrentes;
  estado.transferencia = tudo.transferencia;
  estado.investimento = tudo.investimento;
  estado.senhaAtiva = tudo.senhaAtiva;
  estado.contasComSaldo = tudo.contasComSaldo;
  estado.saldos = tudo.saldos;
  estado.sugestoes = tudo.sugestoes;
  estado.lembretes = tudo.lembretes;
  document.getElementById("texto-senha").textContent = tudo.senhaAtiva ? "Senha ligada" : "Proteger com senha";

  if (estado.mes === null) {
    const hoje = new Date();
    const temHoje = estado.transacoes.some((t) => t.data.mes === hoje.getMonth() + 1 && t.data.ano === hoje.getFullYear());
    if (!temHoje && estado.transacoes.length > 0) {
      estado.mes = estado.transacoes[0].data.mes;
      estado.ano = estado.transacoes[0].data.ano;
    } else {
      estado.mes = hoje.getMonth() + 1;
      estado.ano = hoje.getFullYear();
    }
  }

  atualizarMenu();
  await desenhar();
}

function atualizarMenu() {
  const qtd = estado.transacoes.length;
  const contas = new Set(estado.transacoes.map((t) => t.banco)).size;
  document.getElementById("info-total").textContent = qtd === 0
    ? "Nenhuma transação ainda"
    : qtd + (qtd === 1 ? " transação" : " transações") + " · " + contas + (contas === 1 ? " conta" : " contas");

  for (const item of document.querySelectorAll(".nav")) {
    const ativo = item.dataset.tela === estado.tela;
    item.classList.toggle("nav-on", ativo);
    if (ativo) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  }
}

async function desenhar() {
  conteudo.replaceChildren();
  estado.graficos = [];
  if (estado.tela === "visao") await desenharVisao();
  else if (estado.tela === "transacoes") await desenharTransacoes();
  else if (estado.tela === "ano") await desenharAno();
  else if (estado.tela === "categorias") await desenharCategorias();
  else if (estado.tela === "recorrentes") await desenharRecorrentes();
  else if (estado.tela === "cartoes") await desenharCartoes();
  else if (estado.tela === "bancos") desenharBancos();

  if (estado.animarAbertura) {
    estado.animarAbertura = false;
    animarEntrada();
    contarNumeros();
  }
}

function animarEntrada() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const alvos = [];
  for (const filho of conteudo.children) {
    if (filho.matches(".cards, .paineis, .grade-destaques")) alvos.push(...filho.children);
    else alvos.push(filho);
  }

  alvos.forEach((el, i) => {
    el.style.setProperty("--atraso", Math.min(i * 70, 770) + "ms");
    el.classList.add("entrando");
    el.addEventListener("animationend", () => el.classList.remove("entrando"), { once: true });
  });
}

function contarNumeros() {
  if (estado.privado || matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const DURACAO = 720;
  const inicio = performance.now();
  const numeros = [...conteudo.querySelectorAll("[data-centavos]")].map((el) => {
    const bloco = el.closest(".entrando");
    const atraso = bloco ? parseFloat(bloco.style.getPropertyValue("--atraso")) || 0 : 0;
    el.textContent = dinheiro(0);
    return { el: el, alvo: Number(el.dataset.centavos), comeca: inicio + atraso };
  });
  if (numeros.length === 0) return;

  function quadro(agora) {
    let terminou = true;
    for (const n of numeros) {
      const t = Math.min(1, Math.max(0, (agora - n.comeca) / DURACAO));
      const freio = 1 - Math.pow(1 - t, 3);
      n.el.textContent = dinheiro(Math.round(n.alvo * freio));
      if (t < 1) terminou = false;
    }
    if (!terminou) requestAnimationFrame(quadro);
  }
  requestAnimationFrame(quadro);
}

function cabecalho(titulo, navegacao) {
  const topo = criar("header", "cabecalho");
  const bloco = criar("div", "titulo-bloco");
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  bloco.appendChild(criar("span", "rotulo", saudacao + "!"));
  bloco.appendChild(criar("h1", "", titulo));
  topo.appendChild(bloco);

  const botoes = criar("div", "botoes");

  const olho = botao("", "btn-redondo", alternarPrivado, estado.privado ? SVG_OLHO_FECHADO : SVG_OLHO);
  olho.setAttribute("aria-label", estado.privado ? "Mostrar valores" : "Esconder valores");
  olho.setAttribute("aria-pressed", estado.privado ? "true" : "false");
  olho.title = estado.privado ? "Mostrar valores" : "Esconder valores";
  botoes.appendChild(olho);

  if (navegacao) {
    const porAno = navegacao === "ano";
    const mudar = (passo) => (porAno ? mudarAno(passo) : mudarMes(passo));
    const anterior = botao("", "btn-redondo", () => mudar(-1), SVG_ANTERIOR);
    anterior.setAttribute("aria-label", porAno ? "Ano anterior" : "Mês anterior");
    const proximo = botao("", "btn-redondo", () => mudar(1), SVG_PROXIMO);
    proximo.setAttribute("aria-label", porAno ? "Próximo ano" : "Próximo mês");
    botoes.appendChild(anterior);
    botoes.appendChild(proximo);
  }

  if (estado.tela === "visao") {
    const pdf = botao("", "btn-redondo", exportarPDF, SVG_PDF);
    pdf.setAttribute("aria-label", "Baixar o fechamento do mês em PDF");
    pdf.title = "Fechamento do mês (PDF)";
    botoes.appendChild(pdf);
  }
  botoes.appendChild(botao("Nova transação", "", abrirNovaTransacao, SVG_MAIS));
  botoes.appendChild(botao("Importar extrato", "btn-main", comecarImportacao, SVG_IMPORTAR));
  topo.appendChild(botoes);
  return topo;
}

function alternarPrivado() {
  estado.privado = !estado.privado;
  salvarPreferencia("privado", estado.privado ? "sim" : "nao");
  desenhar();
}

function nomeDoMes() {
  const nome = NOMES_MES[estado.mes - 1];
  return nome.charAt(0).toUpperCase() + nome.slice(1) + " de " + estado.ano;
}

function mudarAno(passo) {
  estado.anoResumo = estado.anoResumo + passo;
  estado.animarAbertura = true;
  desenhar();
}

async function exportarPDF() {
  try {
    const r = await pedir(window.blendercash.exportarPDF(estado.mes, estado.ano));
    if (!r.cancelado) mostrarAviso("Fechamento de " + nomeDoMes() + " salvo em PDF");
  } catch (erro) {
    mostrarAviso("Não deu pra gerar o PDF: " + erro.message);
  }
}

function mudarMes(passo) {
  estado.animarAbertura = true;
  estado.mes = estado.mes + passo;
  if (estado.mes < 1) { estado.mes = 12; estado.ano = estado.ano - 1; }
  if (estado.mes > 12) { estado.mes = 1; estado.ano = estado.ano + 1; }
  desenhar();
}

async function desenharVisao() {
  const rel = await window.blendercash.relatorio(estado.mes, estado.ano);
  conteudo.appendChild(cabecalho(nomeDoMes(), "mes"));

  if (estado.transacoes.length === 0) {
    conteudo.appendChild(telaVazia());
    return;
  }

  const lembretes = faixaLembretes();
  if (lembretes) conteudo.appendChild(lembretes);

  const estouradas = rel.categorias.filter((c) => c.teto && c.gasto > c.teto);
  if (estouradas.length > 0) {
    const alerta = criar("div", "alerta");
    alerta.setAttribute("role", "status");
    const textos = estouradas.map((c) => c.nome + " passou do teto em " + dinheiro(c.gasto - c.teto));
    alerta.appendChild(criar("strong", "", "Atenção: "));
    alerta.appendChild(document.createTextNode(textos.join(" · ")));
    conteudo.appendChild(alerta);
  }

  const cards = criar("section", "cards");
  cards.setAttribute("aria-label", "Resumo do mês");
  const reais = rel.transacoes.filter((t) => !foraDaConta(t));
  const qtdSaidas = reais.filter((t) => t.valor < 0).length;
  const guardou = rel.resumo.entradas > 0 ? Math.round((rel.resumo.guardado / rel.resumo.entradas) * 100) : 0;

  const ant = rel.anterior;
  cards.appendChild(cardResumo("Entradas", rel.resumo.entradas, "positivo", (reais.length - qtdSaidas) + " entradas no mês",
    etiquetaVariacao(rel.resumo.entradas, ant.entradas, false, { tipo: "valor", temDados: ant.temDados })));
  cards.appendChild(cardResumo("Saídas", rel.resumo.saidas, "negativo",
    qtdSaidas + " gastos" + (rel.resumo.transferido > 0 ? " · " + dinheiro(rel.resumo.transferido) + " entre suas contas (fora da conta)" : ""),
    etiquetaVariacao(rel.resumo.saidas, ant.saidas, true, { tipo: "valor", temDados: ant.temDados })));
  cards.appendChild(cardResumo("Saldo do mês", rel.resumo.saldo, corDoSaldo(rel.resumo.saldo),
    (rel.resumo.investido > 0 ? dinheiro(rel.resumo.investido) + " foram pro investimento · " : "") +
    (rel.resumo.entradas > 0 ? "Você guardou " + guardou + "% do que entrou" : "Sem entradas neste mês"),
    etiquetaVariacao(rel.resumo.saldo, ant.saldo, false, { tipo: "saldo", temDados: ant.temDados })));

  const faltam = rel.previsoes.length;
  cards.appendChild(cardResumo("Previsto no fim do mês", rel.saldoPrevisto, corDoSaldo(rel.saldoPrevisto),
    faltam === 0 ? "Nada mais previsto pra este mês" : faltam + (faltam === 1 ? " conta ainda vai cair" : " contas ainda vão cair")));
  conteudo.appendChild(cards);

  const saldos = faixaSaldos();
  if (saldos) conteudo.appendChild(saldos);

  if (rel.insights.length > 0) {
    conteudo.appendChild(painelInsights(rel.insights));
  }

  const sugestoes = painelSugestoes();
  if (sugestoes) conteudo.appendChild(sugestoes);

  conteudo.appendChild(painelGrafico("Entradas e saídas · últimos 6 meses", rel.serie, { mes: estado.mes, ano: estado.ano }));

  conteudo.appendChild(painelCalendario(rel.calendario, rel.diaDaSemana));

  const paineis = criar("section", "paineis");
  paineis.appendChild(painelCategorias(rel.categorias));
  paineis.appendChild(painelTransacoes("Últimas transações", rel.transacoes.slice(0, 6), true));
  conteudo.appendChild(paineis);

  if (rel.previsoes.length > 0) {
    conteudo.appendChild(painelPrevisoes(rel.previsoes));
  }
}

function corDoSaldo(valor) {
  if (valor > 0) return "positivo saldo-positivo";
  if (valor < 0) return "negativo saldo-negativo";
  return "";
}

function cardResumo(titulo, valor, classeCor, legenda, etiqueta) {
  const card = criar("div", "glass lift card");

  if (classeCor.includes("saldo-positivo")) card.classList.add("card-positivo");
  if (classeCor.includes("saldo-negativo")) card.classList.add("card-negativo");
  const topo = criar("div", "card-topo");
  topo.appendChild(criar("span", "rotulo", titulo));
  if (etiqueta) topo.appendChild(etiqueta);
  card.appendChild(topo);
  card.appendChild(numeroDinheiro("numero " + classeCor, valor));
  card.appendChild(criar("span", "rotulo legenda", legenda));
  return card;
}

function etiquetaVariacao(atual, anterior, menorEhMelhor, opcoes) {
  if (!opcoes.temDados) return null;

  const diferenca = atual - anterior;
  const ant = estado.mes === 1 ? 12 : estado.mes - 1;
  const nomeMes = NOMES_MES[ant - 1];

  if (diferenca === 0) {
    const igual = criar("span", "tag tag-neutra", "= " + nomeMes.slice(0, 3));
    igual.title = "Igual a " + nomeMes;
    return igual;
  }

  const subiu = diferenca > 0;
  const bom = menorEhMelhor ? !subiu : subiu;
  const seta = subiu ? "▲ " : "▼ ";
  const percentual = anterior > 0 ? Math.round((diferenca / anterior) * 100) : null;
  const usarPercentual = opcoes.tipo !== "saldo" && percentual !== null && Math.abs(percentual) <= 200;

  const texto = usarPercentual
    ? seta + Math.abs(percentual) + "% vs. " + nomeMes.slice(0, 3)
    : seta + dinheiroCurto(Math.abs(diferenca)) + " vs. " + nomeMes.slice(0, 3);

  const tag = criar("span", "tag " + (bom ? "tag-boa" : "tag-ruim"), texto);
  tag.title = (subiu ? "Subiu " : "Caiu ") +
    (usarPercentual ? Math.abs(percentual) + "% (" + dinheiro(Math.abs(diferenca)) + ")" : dinheiro(Math.abs(diferenca))) +
    " em relação a " + nomeMes + (bom ? " · bom sinal" : " · atenção");
  return tag;
}

function painelInsights(insights) {
  const painel = criar("div", "glass painel");
  const topo = criar("div", "painel-topo");
  topo.appendChild(criar("h2", "", "O que chamou atenção"));
  painel.appendChild(topo);

  const lista = criar("ul", "lista-insights");
  for (const i of insights) {
    const item = criar("li", "insight");
    const ic = criar("span", "insight-icone");
    ic.appendChild(icone(SVG_ALERTA));
    item.appendChild(ic);

    const texto = criar("div", "insight-texto");
    if (i.tipo === "aumento") {
      texto.appendChild(criar("strong", "", i.descricao + " ficou " + i.percentual + "% mais cara"));
      texto.appendChild(criar("span", "rotulo", "Passou de " + dinheiro(i.de) + " pra " + dinheiro(i.para) + " em relação ao mês passado."));
    } else {
      const vezes = (i.atual / i.media).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
      texto.appendChild(criar("strong", "", i.categoria + ": " +
        (i.percentual > 200 ? vezes + "× a sua média" : i.percentual + "% acima da sua média")));
      texto.appendChild(criar("span", "rotulo", dinheiro(i.atual) + " este mês, contra uma média de " + dinheiro(i.media) +
        " nos " + (i.meses === 1 ? "último mês" : "últimos " + i.meses + " meses") + "."));
    }
    item.appendChild(texto);
    lista.appendChild(item);
  }
  painel.appendChild(lista);
  return painel;
}

const COR_ENTRADA = "#22c55e";
const COR_SAIDA = "#ef4444";
const NOMES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function painelGrafico(titulo, serie, destaque) {
  const painel = criar("div", "glass painel painel-grafico");
  const topo = criar("div", "painel-topo");
  topo.appendChild(criar("h2", "", titulo));

  const legenda = criar("div", "legenda-grafico");
  for (const [cor, nome] of [[COR_ENTRADA, "Entradas"], [COR_SAIDA, "Saídas"]]) {
    const item = criar("span", "legenda-item");
    const amostra = criar("span", "legenda-cor");
    amostra.style.background = cor;
    item.appendChild(amostra);
    item.appendChild(document.createTextNode(nome));
    legenda.appendChild(item);
  }
  topo.appendChild(legenda);
  painel.appendChild(topo);

  const area = criar("div", "grafico-area");
  painel.appendChild(area);
  const balao = criar("div", "grafico-balao");
  balao.hidden = true;
  area.appendChild(balao);

  const detalhes = criar("details", "grafico-tabela");
  detalhes.appendChild(criar("summary", "", "Ver em tabela"));
  const tabela = criar("table");
  const cabeca = criar("tr");
  for (const t of ["Mês", "Entradas", "Saídas", "Saldo"]) cabeca.appendChild(criar("th", "", t));
  tabela.appendChild(cabeca);
  for (const m of serie) {
    const linha = criar("tr");
    linha.appendChild(criar("td", "", NOMES_CURTOS[m.mes - 1] + "/" + m.ano));
    linha.appendChild(criar("td", "num", dinheiro(m.entradas)));
    linha.appendChild(criar("td", "num", dinheiro(m.saidas)));
    linha.appendChild(criar("td", "num", dinheiro(m.saldo)));
    tabela.appendChild(linha);
  }
  detalhes.appendChild(tabela);
  painel.appendChild(detalhes);

  const redesenhar = () => desenharBarras(area, balao, serie, destaque);
  estado.graficos.push(redesenhar);
  requestAnimationFrame(redesenhar);
  return painel;
}

function dinheiroCurto(centavos) {
  if (estado.privado) return "•••";
  const reais = centavos / 100;
  if (reais >= 1000) return "R$ " + (reais / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mil";
  return "R$ " + Math.round(reais);
}

function escalaRedonda(valor) {
  if (valor <= 0) return { passo: 10000, linhas: 4 };
  const bruto = valor / 5;
  const potencia = Math.pow(10, Math.floor(Math.log10(bruto)));
  let passo = 10 * potencia;
  for (const fator of [1, 2, 2.5, 5]) {
    if (fator * potencia >= bruto) { passo = fator * potencia; break; }
  }
  return { passo: passo, linhas: Math.max(1, Math.ceil(valor / passo)) };
}

function caminhoBarra(x, y, largura, altura) {
  const r = Math.min(4, altura, largura / 2);
  return "M" + x + "," + (y + altura) + " V" + (y + r) + " Q" + x + "," + y + " " + (x + r) + "," + y +
    " H" + (x + largura - r) + " Q" + (x + largura) + "," + y + " " + (x + largura) + "," + (y + r) + " V" + (y + altura) + " Z";
}

function desenharBarras(area, balao, serie, destaque) {
  const ns = "http://www.w3.org/2000/svg";
  const W = Math.max(280, area.clientWidth);
  const H = 220;
  const margem = { esquerda: 62, direita: 8, topo: 10, baixo: 28 };
  const larguraUtil = W - margem.esquerda - margem.direita;
  const alturaUtil = H - margem.topo - margem.baixo;

  const escala = escalaRedonda(Math.max(...serie.map((m) => Math.max(m.entradas, m.saidas))));
  const maior = escala.passo * escala.linhas;
  const y = (v) => margem.topo + alturaUtil - (v / maior) * alturaUtil;

  const antigo = area.querySelector("svg");
  if (antigo) antigo.remove();

  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("width", W);
  svg.setAttribute("height", H);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Gráfico de barras com entradas e saídas por mês. Os números estão na tabela logo abaixo.");
  const novo = (tag, atributos) => {
    const el = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(atributos)) el.setAttribute(k, v);
    return el;
  };

  for (let i = 0; i <= escala.linhas; i++) {
    const valor = escala.passo * i;
    const linhaY = Math.round(y(valor)) + 0.5;
    svg.appendChild(novo("line", { x1: margem.esquerda, x2: W - margem.direita, y1: linhaY, y2: linhaY,
      stroke: i === 0 ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.06)" }));
    const rotulo = novo("text", { x: margem.esquerda - 10, y: linhaY + 4, "text-anchor": "end", class: "eixo" });
    rotulo.textContent = dinheiroCurto(valor);
    svg.appendChild(rotulo);
  }

  const larguraGrupo = larguraUtil / serie.length;
  const larguraBarra = Math.min(26, Math.max(6, (larguraGrupo * 0.56 - 2) / 2));

  serie.forEach((m, i) => {
    const centro = margem.esquerda + larguraGrupo * i + larguraGrupo / 2;
    const ehDestaque = destaque && m.mes === destaque.mes && m.ano === destaque.ano;

    const fundo = novo("rect", { x: centro - larguraGrupo / 2 + 2, y: margem.topo, width: larguraGrupo - 4, height: alturaUtil,
      rx: 3, fill: ehDestaque ? "rgba(255,255,255,0.035)" : "transparent", class: "grafico-coluna" });
    svg.appendChild(fundo);

    const altEntrada = alturaUtil * (m.entradas / maior);
    const altSaida = alturaUtil * (m.saidas / maior);
    const xEntrada = centro - larguraBarra - 1;
    const xSaida = centro + 1;
    const barraEntrada = novo("path", { d: caminhoBarra(xEntrada, y(m.entradas), larguraBarra, altEntrada), fill: COR_ENTRADA, class: "grafico-barra" });
    const barraSaida = novo("path", { d: caminhoBarra(xSaida, y(m.saidas), larguraBarra, altSaida), fill: COR_SAIDA, class: "grafico-barra" });
    if (altEntrada > 0) svg.appendChild(barraEntrada);
    if (altSaida > 0) svg.appendChild(barraSaida);

    const nome = novo("text", { x: centro, y: H - 8, "text-anchor": "middle", class: "eixo" + (ehDestaque ? " eixo-destaque" : "") });
    nome.textContent = NOMES_CURTOS[m.mes - 1] + (m.mes === 1 ? " " + String(m.ano).slice(2) : "");
    svg.appendChild(nome);

    const metades = [
      { tipo: "Entradas", valor: m.entradas, cor: COR_ENTRADA, x: centro - larguraGrupo / 2 + 2, barra: barraEntrada, outra: barraSaida, xBarra: xEntrada },
      { tipo: "Saídas", valor: m.saidas, cor: COR_SAIDA, x: centro, barra: barraSaida, outra: barraEntrada, xBarra: xSaida },
    ];

    for (const parte of metades) {
      const area = novo("rect", { x: parte.x, y: margem.topo, width: larguraGrupo / 2 - 2, height: alturaUtil, fill: "transparent", class: "grafico-alvo" });
      svg.appendChild(area);

      area.addEventListener("mouseenter", () => {
        fundo.setAttribute("fill", "rgba(255,255,255,0.06)");
        parte.outra.style.opacity = "0.3";

        balao.replaceChildren();
        const titulo = criar("div", "balao-linha balao-titulo");
        const marca = criar("span", "legenda-cor");
        marca.style.background = parte.cor;
        titulo.appendChild(marca);
        titulo.appendChild(criar("span", "", parte.tipo + " · " + NOMES_MES[m.mes - 1] + " de " + m.ano));
        balao.appendChild(titulo);
        balao.appendChild(criar("span", "balao-total", dinheiro(parte.valor)));
        if (!m.temDados) balao.appendChild(criar("span", "rotulo pequena", "Sem transações neste mês"));
        balao.hidden = false;

        const largura = balao.offsetWidth;
        const altura = balao.offsetHeight;
        const topoBarra = y(parte.valor);
        if (topoBarra - altura - 10 >= 0) {
          const meioBarra = parte.xBarra + larguraBarra / 2;
          balao.style.left = Math.min(Math.max(meioBarra - largura / 2, 0), W - largura) + "px";
          balao.style.top = topoBarra - altura - 10 + "px";
        } else {
          const direita = parte.xBarra + larguraBarra + 10;
          const cabeDireita = direita + largura <= W;
          balao.style.left = (cabeDireita ? direita : Math.max(0, parte.xBarra - largura - 10)) + "px";
          balao.style.top = Math.max(0, topoBarra) + "px";
        }
      });

      area.addEventListener("mouseleave", () => {
        fundo.setAttribute("fill", ehDestaque ? "rgba(255,255,255,0.035)" : "transparent");
        parte.outra.style.opacity = "";
        balao.hidden = true;
      });
    }
  });

  area.insertBefore(svg, balao);
}

let temporizadorTamanho;
window.addEventListener("resize", () => {
  clearTimeout(temporizadorTamanho);
  temporizadorTamanho = setTimeout(() => { for (const g of estado.graficos) g(); }, 150);
});

function painelCategorias(categorias) {
  const painel = criar("div", "glass painel painel-estreito");
  const topo = criar("div", "painel-topo");
  topo.appendChild(criar("h2", "", "Gastos por categoria"));
  botaoCard(topo, "Tetos", SVG_IR, () => irPara("categorias"));
  painel.appendChild(topo);

  if (categorias.length === 0) {
    painel.appendChild(criar("span", "rotulo", "Nenhum gasto neste mês."));
    return painel;
  }

  painel.appendChild(criar("span", "rotulo dica", "Clique numa categoria pra definir quanto quer gastar nela por mês."));

  const lista = criar("div", "lista-categorias");
  painel.appendChild(lista);

  const maior = Math.max(...categorias.map((c) => c.gasto));
  for (const c of categorias) {
    const linhaBotao = criar("button", "categoria");
    linhaBotao.type = "button";
    linhaBotao.addEventListener("click", () => abrirTeto(c.nome));

    const linha = criar("div", "categoria-linha");
    linha.appendChild(criar("span", "", c.nome));
    linha.appendChild(criar("span", "forte", c.teto ? dinheiro(c.gasto) + " de " + dinheiro(c.teto) : dinheiro(c.gasto)));
    linhaBotao.appendChild(linha);

    const trilho = criar("div", "trilho");
    const barra = criar("div", "barra");
    barra.style.width = "0%";
    trilho.appendChild(barra);
    linhaBotao.appendChild(trilho);

    let largura;
    if (c.teto) {
      const fracao = c.gasto / c.teto;
      largura = Math.min(100, Math.round(fracao * 100));
      barra.classList.add(fracao > 1 ? "barra-estourou" : fracao >= 0.8 ? "barra-atencao" : "barra-ok");
      const situacao = fracao > 1
        ? "Estourou " + dinheiro(c.gasto - c.teto)
        : "Faltam " + dinheiro(c.teto - c.gasto) + (estado.privado ? "" : " (" + Math.round(fracao * 100) + "% do teto)");
      linhaBotao.appendChild(criar("span", "rotulo pequena " + (fracao > 1 ? "negativo" : ""), situacao));
    } else {
      largura = maior > 0 ? Math.max(4, Math.round((c.gasto / maior) * 100)) : 0;
      barra.classList.add("barra-neutra");
    }
    lista.appendChild(linhaBotao);

    requestAnimationFrame(() => { barra.style.width = largura + "%"; });
  }
  return painel;
}

function painelTransacoes(titulo, lista, comLinkVerTudo) {
  const painel = criar("div", "glass painel painel-largo");
  const topo = criar("div", "painel-topo");
  topo.appendChild(criar("h2", "", titulo));
  if (comLinkVerTudo) botaoCard(topo, "Ver todas", SVG_IR, () => irPara("transacoes"));
  painel.appendChild(topo);

  if (lista.length === 0) {
    painel.appendChild(criar("span", "rotulo", "Nenhuma transação neste mês."));
    return painel;
  }

  for (const t of lista) painel.appendChild(linhaTransacao(t));
  return painel;
}

function linhaTransacao(t) {
  const linha = criar("button", "transacao");
  linha.type = "button";
  linha.addEventListener("click", () => abrirEdicao(t));

  linha.appendChild(criar("span", "rotulo esconder-pequeno", dataCurta(t.data)));

  const desc = criar("span", "transacao-textos");
  desc.appendChild(criar("span", "transacao-desc", t.descricao));
  let detalhe = t.banco;
  if (t.manual) detalhe = detalhe + " · lançada à mão";
  if (t.fatura) detalhe = detalhe + " · fatura " + dataCurta(t.fatura);
  desc.appendChild(criar("span", "transacao-banco", detalhe));
  linha.appendChild(desc);

  const etiqueta = criar("span", "etiqueta esconder-pequeno", t.categoria);
  etiqueta.style.borderColor = t.categoria === estado.transferencia ? "rgba(255,255,255,0.2)"
    : t.categoria === estado.investimento ? COR_INVESTIMENTO : corDaCategoria(t.categoria);
  linha.appendChild(etiqueta);

  const ehTransferencia = t.categoria === estado.transferencia;
  const ehInvestimento = t.categoria === estado.investimento;
  const sinal = t.valor > 0 ? "+" : "";
  const classe = ehInvestimento ? "investido" : ehTransferencia ? "neutro" : t.valor > 0 ? "positivo" : "negativo";
  linha.appendChild(criar("span", "valor " + classe, sinal + dinheiro(t.valor)));
  return linha;
}

function painelPrevisoes(previsoes) {
  const painel = criar("div", "glass painel");
  const topo = criar("div", "painel-topo");
  topo.appendChild(criar("h2", "", "Ainda vai acontecer neste mês"));
  botaoCard(topo, "Contas fixas", SVG_IR, () => irPara("recorrentes"));
  painel.appendChild(topo);
  painel.appendChild(criar("span", "rotulo dica", "Contas fixas que ainda não apareceram no extrato e parcelas do cartão. Elas entram no “Previsto no fim do mês”."));

  for (const p of previsoes) {
    const linha = criar("div", "transacao previsao");
    linha.appendChild(criar("span", "rotulo esconder-pequeno", dataCurta(p.data)));
    const desc = criar("span", "transacao-textos");
    desc.appendChild(criar("span", "transacao-desc", p.descricao));
    const origem = p.origem === "parcela" ? "Parcela do cartão · " + p.banco : p.atrasada ? "Conta fixa · ainda não apareceu" : "Conta fixa";
    desc.appendChild(criar("span", "transacao-banco", origem));
    linha.appendChild(desc);
    linha.appendChild(criar("span", "etiqueta esconder-pequeno", "Previsto"));
    linha.appendChild(criar("span", "valor " + (p.valor > 0 ? "positivo" : "negativo"), (p.valor > 0 ? "+" : "") + dinheiro(p.valor)));
    painel.appendChild(linha);
  }
  return painel;
}

function telaVazia() {
  const caixa = criar("div", "glass painel vazio");
  caixa.appendChild(criar("h2", "", "Nenhum extrato ainda"));
  caixa.appendChild(criar("span", "rotulo", "Importe o CSV ou o OFX que você baixou do seu banco, ou lance uma transação à mão."));
  const botoes = criar("div", "botoes");
  botoes.appendChild(botao("Nova transação", "", abrirNovaTransacao, SVG_MAIS));
  botoes.appendChild(botao("Importar meu primeiro extrato", "btn-main", comecarImportacao, SVG_IMPORTAR));
  caixa.appendChild(botoes);
  return caixa;
}

async function desenharTransacoes() {
  conteudo.appendChild(cabecalho("Transações", "mes"));

  const f = estado.filtros;
  const barra = criar("div", "glass filtros");
  barra.setAttribute("role", "search");

  const busca = campoComEtiqueta("Buscar", "input", { type: "search", placeholder: "Nome ou valor, ex.: uber, 25,90", autocomplete: "off" });
  busca.campo.value = f.busca;
  busca.grupo.classList.add("filtro-busca");
  barra.appendChild(busca.grupo);

  const periodo = campoComEtiqueta("Período", "select");
  periodo.campo.appendChild(opcao("mes", nomeDoMes(), f.periodo === "mes"));
  periodo.campo.appendChild(opcao("ano", "Ano de " + estado.ano + " inteiro", f.periodo === "ano"));
  periodo.campo.appendChild(opcao("todos", "Todos os meses", f.periodo === "todos"));
  barra.appendChild(periodo.grupo);

  const banco = campoComEtiqueta("Conta", "select");
  banco.campo.appendChild(opcao("", "Todas", f.banco === ""));
  for (const nome of [...new Set(estado.transacoes.map((t) => t.banco))].sort()) banco.campo.appendChild(opcao(nome, nome, f.banco === nome));
  barra.appendChild(banco.grupo);

  const categoria = campoComEtiqueta("Categoria", "select");
  categoria.campo.appendChild(opcao("", "Todas", f.categoria === ""));
  for (const nome of estado.categorias) categoria.campo.appendChild(opcao(nome, nome, f.categoria === nome));
  barra.appendChild(categoria.grupo);

  const tipo = campoComEtiqueta("Tipo", "select");
  for (const [valor, texto] of [["", "Tudo"], ["entrada", "Entradas"], ["saida", "Saídas"], ["investimento", "Investimentos"], ["transferencia", "Entre minhas contas"]]) {
    tipo.campo.appendChild(opcao(valor, texto, f.tipo === valor));
  }
  barra.appendChild(tipo.grupo);
  conteudo.appendChild(barra);

  const resultado = criar("div", "glass painel");
  conteudo.appendChild(resultado);

  function atualizarLista() {
    const lista = filtrarTransacoes();
    resultado.replaceChildren();

    let entradas = 0;
    let saidas = 0;
    let investido = 0;
    for (const t of lista) {
      if (t.categoria === estado.investimento) { investido -= t.valor; continue; }
      if (foraDaConta(t)) continue;
      if (t.valor > 0) entradas += t.valor; else saidas += Math.abs(t.valor);
    }

    const topo = criar("div", "painel-topo");
    topo.appendChild(criar("h2", "", lista.length + (lista.length === 1 ? " transação" : " transações")));
    if (lista.length > 0) {
      botaoCard(topo, "Exportar CSV", SVG_BAIXAR, () => exportarCSV(lista));
    }
    resultado.appendChild(topo);
    resultado.appendChild(criar("span", "rotulo dica", "Entradas " + dinheiro(entradas) + " · Saídas " + dinheiro(saidas) +
      (investido !== 0 ? " · Investido " + dinheiro(investido) : "") +
      " · O CSV leva exatamente o que está na lista (abre no Excel)."));

    if (lista.length === 0) {
      resultado.appendChild(criar("span", "rotulo", "Nada encontrado com esses filtros."));
      return;
    }
    for (const t of lista) resultado.appendChild(linhaTransacao(t));
  }

  busca.campo.addEventListener("input", () => { f.busca = busca.campo.value; atualizarLista(); });
  periodo.campo.addEventListener("change", () => { f.periodo = periodo.campo.value; atualizarLista(); });
  banco.campo.addEventListener("change", () => { f.banco = banco.campo.value; atualizarLista(); });
  categoria.campo.addEventListener("change", () => { f.categoria = categoria.campo.value; atualizarLista(); });
  tipo.campo.addEventListener("change", () => { f.tipo = tipo.campo.value; atualizarLista(); });

  atualizarLista();
}

async function exportarCSV(lista) {
  const f = estado.filtros;
  const partes = ["blendercash"];
  if (f.periodo === "mes") partes.push(estado.ano + "-" + dois(estado.mes));
  else if (f.periodo === "ano") partes.push(String(estado.ano));
  else partes.push("tudo");
  if (f.categoria) partes.push(f.categoria);
  if (f.banco) partes.push(f.banco);
  const nome = partes.join("-").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9-]+/g, "-").toLowerCase();

  try {
    const r = await pedir(window.blendercash.exportarCSV(lista.map((t) => t.id), nome));
    if (!r.cancelado) mostrarAviso(r.quantidade + " transações exportadas em CSV");
  } catch (erro) {
    mostrarAviso("Não deu pra exportar: " + erro.message);
  }
}

function filtrarTransacoes() {
  const f = estado.filtros;
  const termo = f.busca.trim().toUpperCase();
  const termoNumero = termo.replace("R$", "").trim();

  return estado.transacoes.filter((t) => {
    if (f.periodo === "mes" && (t.data.mes !== estado.mes || t.data.ano !== estado.ano)) return false;
    if (f.periodo === "ano" && t.data.ano !== estado.ano) return false;
    if (f.banco && t.banco !== f.banco) return false;
    if (f.categoria && t.categoria !== f.categoria) return false;

    const ehTransferencia = t.categoria === estado.transferencia;
    const ehInvestimento = t.categoria === estado.investimento;
    if (f.tipo === "transferencia" && !ehTransferencia) return false;
    if (f.tipo === "investimento" && !ehInvestimento) return false;
    if (f.tipo === "entrada" && (foraDaConta(t) || t.valor <= 0)) return false;
    if (f.tipo === "saida" && (foraDaConta(t) || t.valor >= 0)) return false;

    if (termo !== "") {
      const naDescricao = t.descricao.includes(termo) || t.categoria.toUpperCase().includes(termo);
      const noValor = termoNumero !== "" && dinheiroSempre(Math.abs(t.valor)).includes(termoNumero);
      if (!naDescricao && !noValor) return false;
    }
    return true;
  });
}

async function desenharAno() {
  if (estado.anoResumo === null) estado.anoResumo = estado.ano;
  const ano = estado.anoResumo;
  const r = await window.blendercash.resumoAnual(ano);
  conteudo.appendChild(cabecalho("Resumo de " + ano, "ano"));

  if (r.quantidade === 0) {
    const vazio = criar("div", "glass painel vazio");
    vazio.appendChild(criar("h2", "", "Nenhuma transação em " + ano));
    vazio.appendChild(criar("span", "rotulo", "Use as setas no topo pra ver outro ano."));
    conteudo.appendChild(vazio);
    return;
  }

  const cards = criar("section", "cards cards-3");
  const guardou = r.resumo.entradas > 0 ? Math.round((r.resumo.guardado / r.resumo.entradas) * 100) : 0;
  cards.appendChild(cardResumo("Entrou no ano", r.resumo.entradas, "positivo", "Em " + r.mesesComDados + (r.mesesComDados === 1 ? " mês com movimento" : " meses com movimento")));
  cards.appendChild(cardResumo("Saiu no ano", r.resumo.saidas, "negativo", "Média de " + dinheiro(r.mediaMensalSaidas) + " por mês"));
  cards.appendChild(cardResumo("Guardou no ano", r.resumo.guardado, corDoSaldo(r.resumo.guardado),
    (r.resumo.entradas > 0 ? guardou + "% de tudo que entrou" : "Sem entradas no ano") +
    (r.resumo.investido > 0 ? " · " + dinheiro(r.resumo.investido) + " investidos" : "")));
  conteudo.appendChild(cards);

  const destaques = criar("section", "grade-destaques");
  const nomeMes = (m) => m ? NOMES_MES[m.mes - 1].replace(/^./, (l) => l.toUpperCase()) : "—";
  const totalSaidas = r.resumo.saidas || 1;

  function destaque(rotulo, titulo, detalhe) {
    const item = criar("div", "glass lift item destaque-ano");
    item.appendChild(criar("span", "rotulo", rotulo));
    item.appendChild(criar("span", "destaque-titulo", titulo));
    if (detalhe) item.appendChild(criar("span", "rotulo pequena", detalhe));
    destaques.appendChild(item);
  }

  if (r.categorias.length > 0) {
    const [nome, valor] = r.categorias[0];
    destaque("Categoria campeã de gastos", nome, dinheiro(valor) + " · " + Math.round((valor / totalSaidas) * 100) + "% de tudo que saiu");
  }
  if (r.mesQueMaisGuardou) destaque("Mês que mais guardou", nomeMes(r.mesQueMaisGuardou), "Guardou " + dinheiro(r.mesQueMaisGuardou.guardado));
  if (r.mesQueMaisGastou) destaque("Mês que mais gastou", nomeMes(r.mesQueMaisGastou), dinheiro(r.mesQueMaisGastou.saidas) + " em saídas");
  if (r.maiorGasto) destaque("Maior gasto único", r.maiorGasto.descricao, dinheiro(Math.abs(r.maiorGasto.valor)) + " em " + dataLonga(r.maiorGasto.data));
  destaque("Transações no ano", String(r.quantidade), "Somando todas as contas e cartões");
  conteudo.appendChild(destaques);

  conteudo.appendChild(painelGrafico("Entradas e saídas mês a mês", r.meses, null));

  const painel = criar("div", "glass painel");
  const topo = criar("div", "painel-topo");
  topo.appendChild(criar("h2", "", "Pra onde foi o dinheiro"));
  painel.appendChild(topo);
  const lista = criar("div", "lista-categorias");
  const maior = r.categorias.length > 0 ? r.categorias[0][1] : 1;
  for (const [nome, valor] of r.categorias.slice(0, 5)) {
    const linha = criar("div", "categoria-ano");
    const textos = criar("div", "categoria-linha");
    textos.appendChild(criar("span", "", nome));
    textos.appendChild(criar("span", "forte", dinheiro(valor) + (estado.privado ? "" : " · " + Math.round((valor / totalSaidas) * 100) + "%")));
    linha.appendChild(textos);
    const trilho = criar("div", "trilho");
    const barra = criar("div", "barra barra-neutra");
    barra.style.width = "0%";
    trilho.appendChild(barra);
    linha.appendChild(trilho);
    lista.appendChild(linha);
    requestAnimationFrame(() => { barra.style.width = Math.max(3, Math.round((valor / maior) * 100)) + "%"; });
  }
  painel.appendChild(lista);
  conteudo.appendChild(painel);
}

async function desenharCategorias() {
  conteudo.appendChild(cabecalho("Categorias e tetos", "mes"));
  const rel = await window.blendercash.relatorio(estado.mes, estado.ano);

  const painelTetos = criar("div", "glass painel");
  const topo = criar("div", "painel-topo");
  topo.appendChild(criar("h2", "", "Teto de gastos por mês"));
  botaoCard(topo, "Definir teto", SVG_MAIS, () => abrirTeto(""));
  painelTetos.appendChild(topo);
  painelTetos.appendChild(criar("span", "rotulo dica", "Quanto você quer gastar, no máximo, em cada categoria. A barra fica amarela perto do teto e vermelha quando passa. Valores de " + nomeDoMes() + "."));

  const grade = criar("div", "grade");
  const comTeto = rel.categorias.filter((c) => c.teto);
  if (comTeto.length === 0) {
    grade.appendChild(criar("span", "rotulo", "Nenhum teto definido ainda."));
  }
  for (const c of comTeto) {
    const item = criar("button", "glass lift item item-botao");
    item.type = "button";
    item.addEventListener("click", () => abrirTeto(c.nome));
    item.appendChild(criar("span", "item-titulo", c.nome));
    item.appendChild(criar("span", "rotulo", "Teto " + dinheiro(c.teto) + " · gasto " + dinheiro(c.gasto)));
    grade.appendChild(item);
  }
  painelTetos.appendChild(grade);
  conteudo.appendChild(painelTetos);

  const painel = criar("div", "glass painel");
  const topoRegras = criar("div", "painel-topo");
  topoRegras.appendChild(criar("h2", "", estado.regras.length + " regras de categoria"));
  botaoCard(topoRegras, "Editar o arquivo", SVG_EDITAR, () => window.blendercash.abrirPasta());
  painel.appendChild(topoRegras);
  painel.appendChild(criar("span", "rotulo dica",
    "Se a descrição tiver a palavra, a transação cai na categoria. A primeira regra que bater ganha. " +
    "O jeito mais fácil de criar uma regra: clique numa transação e mude a categoria dela — o app aprende sozinho."));

  const gradeRegras = criar("div", "grade");
  for (const regra of estado.regras) {
    const item = criar("div", "glass item");
    item.appendChild(criar("span", "rotulo", "Se tiver “" + regra.palavra + "”"));
    const etiqueta = criar("span", "etiqueta", regra.categoria);
    etiqueta.style.borderColor = corDaCategoria(regra.categoria);
    item.appendChild(etiqueta);
    gradeRegras.appendChild(item);
  }
  painel.appendChild(gradeRegras);
  conteudo.appendChild(painel);
}

async function desenharRecorrentes() {
  conteudo.appendChild(cabecalho("Contas fixas", false));

  const painel = criar("div", "glass painel");
  const topo = criar("div", "painel-topo");
  topo.appendChild(criar("h2", "", estado.recorrentes.length + (estado.recorrentes.length === 1 ? " conta fixa" : " contas fixas")));
  topo.classList.add("painel-topo-com-botao");
  topo.appendChild(botao("Adicionar conta fixa", "btn-destaque", abrirNovaRecorrente, SVG_MAIS));
  painel.appendChild(topo);
  painel.appendChild(criar("span", "rotulo dica",
    "Aluguel, internet, academia, salário... O que se repete todo mês. Enquanto ela não aparece no extrato do mês, " +
    "o app conta como “previsto” e mostra o saldo previsto pro fim do mês."));

  if (estado.recorrentes.length === 0) {
    painel.appendChild(criar("span", "rotulo", "Nenhuma conta fixa ainda."));
  }

  let total = 0;
  for (const r of estado.recorrentes) {
    total = total + r.valor;
    const linha = criar("div", "transacao recorrente");
    linha.appendChild(criar("span", "rotulo esconder-pequeno", "Dia " + r.dia));
    const desc = criar("span", "transacao-textos");
    desc.appendChild(criar("span", "transacao-desc", r.descricao));
    desc.appendChild(criar("span", "transacao-banco", "Procura no extrato: “" + r.palavra + "”"));
    linha.appendChild(desc);

    const excluir = botao("Remover", "btn-pequeno", async () => {
      await pedir(window.blendercash.excluirRecorrente(r.id));
      mostrarAviso("Conta fixa removida");
      await recarregar();
    }, SVG_LIXEIRA);
    excluir.setAttribute("aria-label", "Remover " + r.descricao);
    linha.appendChild(excluir);

    linha.appendChild(criar("span", "valor " + (r.valor > 0 ? "positivo" : "negativo"), (r.valor > 0 ? "+" : "") + dinheiro(r.valor)));
    painel.appendChild(linha);
  }

  if (estado.recorrentes.length > 0) {
    painel.appendChild(criar("span", "rotulo total", "Somando tudo, por mês: " + dinheiro(total)));
  }
  conteudo.appendChild(painel);
}

async function desenharCartoes() {
  conteudo.appendChild(cabecalho("Cartões", false));
  const cartoes = await window.blendercash.cartoes();

  if (cartoes.length === 0) {
    const vazio = criar("div", "glass painel");
    vazio.appendChild(criar("h2", "", "Nenhum cartão cadastrado"));
    vazio.appendChild(criar("span", "rotulo dica",
      "Adicione o seu cartão como um banco do tipo “Cartão de crédito”, com o dia em que a fatura fecha."));
    const linhaBotao = criar("div", "botoes");
    linhaBotao.appendChild(botao("Adicionar cartão", "btn-destaque", abrirNovoPerfil, SVG_MAIS));
    vazio.appendChild(linhaBotao);
    conteudo.appendChild(vazio);
    return;
  }

  for (const cartao of cartoes) {
    const painel = criar("div", "glass painel");
    const topo = criar("div", "painel-topo");
    topo.appendChild(criar("h2", "", cartao.nome));
    topo.appendChild(criar("span", "rotulo", "Fecha todo dia " + cartao.diaFechamento));
    painel.appendChild(topo);
    painel.appendChild(criar("span", "rotulo dica",
      "Cada compra entra na fatura pelo dia do fechamento. Parcelas futuras já aparecem nas próximas faturas como “previsto”. " +
      "O pagamento da fatura na conta conta como “Entre minhas contas”, pra o gasto não ser contado duas vezes."));

    if (cartao.faturas.length === 0) {
      painel.appendChild(criar("span", "rotulo", "Nenhuma compra importada deste cartão ainda."));
    }

    const grade = criar("div", "grade faturas");

    const ordem = cartao.faturas.slice().reverse();
    const fechadas = ordem.filter((f) => f.situacao === "fechada").slice(-3);
    const outras = ordem.filter((f) => f.situacao !== "fechada");
    for (const fatura of [...fechadas, ...outras]) {
      const item = criar("div", "glass item fatura fatura-" + fatura.situacao);
      const nomes = { aberta: "Fatura aberta", fechada: "Fatura fechada", futura: "Próxima fatura" };
      item.appendChild(criar("span", "rotulo", nomes[fatura.situacao] + " · fecha " + dataLonga(fatura.fechamento)));
      item.appendChild(numeroDinheiro("numero numero-menor", fatura.total + fatura.previsto));
      const partes = [];
      if (fatura.quantidade > 0) partes.push(fatura.quantidade + (fatura.quantidade === 1 ? " compra" : " compras") + " · " + dinheiro(fatura.total));
      if (fatura.previsto > 0) partes.push("parcelas previstas " + dinheiro(fatura.previsto));
      item.appendChild(criar("span", "rotulo pequena", partes.join(" · ")));
      grade.appendChild(item);
    }
    painel.appendChild(grade);
    conteudo.appendChild(painel);
  }
}

function desenharBancos() {
  conteudo.appendChild(cabecalho("Bancos", false));

  const painelSaldos = criar("div", "glass painel");
  const topoSaldos = criar("div", "painel-topo");
  let total = 0;
  for (const s of estado.saldos) total = total + s.atual;
  topoSaldos.appendChild(criar("h2", "", estado.saldos.length > 0 ? "Saldo nas contas: " + dinheiro(total) : "Saldo nas contas"));
  painelSaldos.appendChild(topoSaldos);
  painelSaldos.appendChild(criar("span", "rotulo dica",
    "Informe o saldo de hoje de cada conta (olhando no app do banco). Daí pra frente, o Blendercash atualiza sozinho com o que você importar. Cartões ficam de fora: o valor deles está em Cartões."));

  const gradeSaldos = criar("div", "grade");
  for (const conta of estado.contasComSaldo) {
    const s = estado.saldos.find((x) => x.conta === conta);
    const item = criar("div", "glass item");
    item.appendChild(criar("span", "item-titulo", conta));
    if (s) {
      item.appendChild(numeroDinheiro("numero numero-menor" + (s.atual < 0 ? " negativo" : ""), s.atual));
      item.appendChild(criar("span", "rotulo pequena", "Informado em " + dataLonga(s.data) + ": " + dinheiro(s.informado) +
        (s.transacoesDepois > 0 ? " · " + s.transacoesDepois + " movimentações depois" : "")));
      item.appendChild(botao("Atualizar saldo", "btn-pequeno", () => abrirSaldo(conta), SVG_EDITAR));
    } else {
      item.appendChild(criar("span", "rotulo", "Saldo ainda não informado"));
      item.appendChild(botao("Informar saldo", "btn-destaque btn-destaque-pequeno", () => abrirSaldo(conta), SVG_MAIS));
    }
    gradeSaldos.appendChild(item);
  }
  painelSaldos.appendChild(gradeSaldos);
  conteudo.appendChild(painelSaldos);

  const painel = criar("div", "glass painel");
  const topo = criar("div", "painel-topo");
  topo.appendChild(criar("h2", "", estado.perfis.length + (estado.perfis.length === 1 ? " perfil de banco" : " perfis de banco")));
  botaoCard(topo, "Adicionar banco", SVG_MAIS, abrirNovoPerfil);
  topo.appendChild(botao("Abrir pasta", "btn-pequeno", () => window.blendercash.abrirPasta(), SVG_PASTA));
  painel.appendChild(topo);
  painel.appendChild(criar("span", "rotulo dica",
    "Cada perfil descreve como um banco escreve o CSV. Arquivos OFX não precisam disso: o app lê sozinho. " +
    "Seu banco não está na lista? Clique em “Adicionar banco” e escolha um extrato CSV dele."));

  const grade = criar("div", "grade");
  for (const perfil of estado.perfis) {
    const qtd = estado.transacoes.filter((t) => t.banco === perfil.nome).length;
    const item = criar("div", "glass item");
    item.appendChild(criar("span", "item-titulo", perfil.nome));
    item.appendChild(criar("span", "rotulo", (perfil.tipo === "cartao" ? "Cartão de crédito" : "Conta") + " · " + qtd + " transações"));
    grade.appendChild(item);
  }
  painel.appendChild(grade);
  conteudo.appendChild(painel);
}

async function comecarImportacao() {
  const caminho = await window.blendercash.escolherArquivo();
  if (!caminho) return;

  const corpo = criar("div", "formulario");
  corpo.appendChild(criar("p", "rotulo arquivo", caminho.split("\\").pop()));
  const perfil = campoComEtiqueta("De qual conta ou cartão é esse extrato?", "select");
  for (const p of estado.perfis) perfil.campo.appendChild(opcao(p.nome, p.nome + (p.tipo === "cartao" ? " (cartão)" : "")));
  corpo.appendChild(perfil.grupo);

  abrirJanela({
    titulo: "Importar extrato",
    corpo: corpo,
    textoOk: "Importar",
    aoConfirmar: async () => {
      const r = await pedir(window.blendercash.importar(caminho, perfil.campo.value));
      let texto = r.adicionadas + " importadas, " + r.duplicadas + " já estavam salvas";
      if (r.erros.length > 0) texto = texto + " · " + r.erros.length + " com problema";
      mostrarAviso(texto);
      estado.mes = null;
      await recarregar();
    },
  });
}

function abrirNovoPerfil() {
  const corpo = criar("div", "formulario");
  const nome = campoComEtiqueta("Nome do banco ou cartão", "input", { type: "text", placeholder: "Ex.: Itaú, Bradesco, Cartão Nubank", autocomplete: "off" });
  corpo.appendChild(nome.grupo);
  const tipo = segmento("tipo-perfil", [["conta", "Conta"], ["cartao", "Cartão de crédito"]], "conta");
  corpo.appendChild(tipo);
  const fechamento = campoComEtiqueta("Dia em que a fatura fecha", "input", { type: "number", min: "1", max: "31", value: "5" });
  fechamento.grupo.hidden = true;
  corpo.appendChild(fechamento.grupo);

  let analise = null;
  const linhaArquivo = criar("div", "formulario");
  const nomeArquivo = criar("p", "rotulo arquivo", "Nenhum CSV escolhido");
  linhaArquivo.appendChild(botao("Escolher um CSV de exemplo", "", escolherExemplo, SVG_PASTA));
  linhaArquivo.appendChild(nomeArquivo);
  linhaArquivo.appendChild(criar("span", "rotulo dica",
    "Baixe um extrato CSV no app ou site do banco e escolha aqui: o Blendercash descobre sozinho como ele é escrito. " +
    "Se o banco só exporta OFX, pode pular esta parte: OFX é lido sem configurar nada."));
  corpo.appendChild(linhaArquivo);

  const colunas = criar("div", "formulario");
  colunas.hidden = true;
  corpo.appendChild(colunas);

  const data = campoComEtiqueta("Coluna da data", "select");
  const formatoData = campoComEtiqueta("Formato da data", "select");
  formatoData.campo.appendChild(opcao("DD/MM/AAAA", "31/12/2026"));
  formatoData.campo.appendChild(opcao("AAAA-MM-DD", "2026-12-31"));
  const descricao = campoComEtiqueta("Coluna da descrição", "select");
  const descricao2 = campoComEtiqueta("Juntar com outra coluna (opcional)", "select");
  const modoValor = segmento("modo-valor", [["unica", "Valor numa coluna só"], ["debitoCredito", "Débito e crédito separados"]], "unica");
  const valor = campoComEtiqueta("Coluna do valor", "select");
  const debito = campoComEtiqueta("Coluna do débito (saídas)", "select");
  const credito = campoComEtiqueta("Coluna do crédito (entradas)", "select");
  const decimal = campoComEtiqueta("Os centavos vêm depois de", "select");
  decimal.campo.appendChild(opcao(",", "vírgula (1.234,56)"));
  decimal.campo.appendChild(opcao(".", "ponto (1,234.56)"));

  const inverter = criar("label", "check");
  const caixaInverter = criar("input");
  caixaInverter.type = "checkbox";
  inverter.appendChild(caixaInverter);
  inverter.appendChild(criar("span", "", "Inverter o sinal (marque se as compras aparecem positivas, como costuma ser em fatura de cartão)"));

  const linha1 = criar("div", "linha-dupla");
  linha1.appendChild(data.grupo);
  linha1.appendChild(formatoData.grupo);
  const linha2 = criar("div", "linha-dupla");
  linha2.appendChild(descricao.grupo);
  linha2.appendChild(descricao2.grupo);
  const linhaUnica = criar("div", "linha-dupla");
  linhaUnica.appendChild(valor.grupo);
  linhaUnica.appendChild(decimal.grupo);
  const linhaDC = criar("div", "linha-dupla");
  linhaDC.appendChild(debito.grupo);
  linhaDC.appendChild(credito.grupo);
  linhaDC.hidden = true;

  const previa = criar("div", "rotulo dica");
  for (const parte of [linha1, linha2, modoValor, linhaUnica, linhaDC, inverter, previa]) colunas.appendChild(parte);

  function preencherColunas(select, a, comNenhuma) {
    select.replaceChildren();
    if (comNenhuma) select.appendChild(opcao("", "Nenhuma"));
    for (let i = 0; i < a.totalColunas; i++) {
      const titulo = (a.cabecalho[i] || "").trim() || "Coluna " + (i + 1);
      const exemplo = (a.amostra[0][i] || "").trim();
      select.appendChild(opcao(String(i), titulo + (exemplo ? " (ex.: " + exemplo.slice(0, 28) + ")" : "")));
    }
  }

  function tipoAtual() { return corpo.querySelector("input[name=tipo-perfil]:checked").value; }
  function modoAtual() { return corpo.querySelector("input[name=modo-valor]:checked").value; }

  function lerFormulario() {
    const f = {
      nome: nome.campo.value,
      tipo: tipoAtual(),
      diaFechamento: fechamento.campo.value,
      inverterSinal: caixaInverter.checked,
    };
    if (!analise) {
      return Object.assign(f, { separador: ";", codificacao: "utf-8", linhasCabecalho: 1, formatoData: "DD/MM/AAAA",
        separadorDecimal: ",", colunaData: 0, colunaDescricao: 1, modoValor: "unica", colunaValor: 2 });
    }
    const desc = [descricao.campo.value];
    if (descricao2.campo.value !== "" && descricao2.campo.value !== descricao.campo.value) desc.push(descricao2.campo.value);
    return Object.assign(f, {
      separador: analise.separador,
      codificacao: analise.codificacao,
      linhasCabecalho: analise.linhasCabecalho,
      formatoData: formatoData.campo.value,
      separadorDecimal: decimal.campo.value,
      colunaData: data.campo.value,
      colunaDescricao: desc,
      modoValor: modoAtual(),
      colunaValor: valor.campo.value,
      colunaDebito: debito.campo.value,
      colunaCredito: credito.campo.value,
    });
  }

  let pedidoPrevia = 0;
  async function atualizarPrevia() {
    if (!analise) return;
    const meu = ++pedidoPrevia;
    const f = lerFormulario();
    if (f.nome.trim() === "") f.nome = "(prévia)";
    const r = await window.blendercash.testarPerfil(f, analise.caminho);
    if (meu !== pedidoPrevia) return;
    previa.replaceChildren();
    if (!r.ok) { previa.textContent = r.mensagem; return; }
    previa.appendChild(criar("strong", "", r.lidas + " linhas lidas do exemplo" + (r.erros.length ? " · com problema: " + r.erros[0] : "")));
    for (const t of r.exemplos) {
      previa.appendChild(criar("div", "", dataLonga(t.data) + " · " + t.descricao + " · " + dinheiroSempre(t.valor)));
    }
  }

  async function escolherExemplo() {
    let a;
    try {
      a = await pedir(window.blendercash.analisarCSV());
    } catch (erro) {
      mostrarErroJanela(erro.message);
      return;
    }
    if (a.cancelado) return;
    analise = a;
    janelaErro.hidden = true;
    nomeArquivo.textContent = a.caminho.split("\\").pop();
    for (const s of [data.campo, descricao.campo, valor.campo, debito.campo, credito.campo]) preencherColunas(s, a, false);
    preencherColunas(descricao2.campo, a, true);
    const p = a.palpite;
    data.campo.value = String(p.colunaData);
    formatoData.campo.value = p.formatoData;
    descricao.campo.value = String(p.colunaDescricao);
    valor.campo.value = String(p.colunaValor);
    debito.campo.value = String(p.colunaValor);
    credito.campo.value = String(p.colunaCredito ?? p.colunaValor);
    decimal.campo.value = p.separadorDecimal;

    const dc = p.colunaCredito !== null && a.amostra.some((c) => (c[p.colunaValor] || "") === "" || (c[p.colunaCredito] || "") === "");
    corpo.querySelector("input[name=modo-valor][value=" + (dc ? "debitoCredito" : "unica") + "]").checked = true;
    linhaUnica.hidden = dc;
    linhaDC.hidden = !dc;
    colunas.hidden = false;
    atualizarPrevia();
  }

  tipo.addEventListener("change", () => {
    const cartao = tipoAtual() === "cartao";
    fechamento.grupo.hidden = !cartao;
    caixaInverter.checked = cartao;
    atualizarPrevia();
  });
  modoValor.addEventListener("change", () => {
    linhaUnica.hidden = modoAtual() !== "unica";
    linhaDC.hidden = modoAtual() === "unica";
    atualizarPrevia();
  });
  colunas.addEventListener("change", (e) => { if (e.target.name !== "modo-valor") atualizarPrevia(); });

  abrirJanela({
    titulo: "Adicionar banco",
    corpo: corpo,
    textoOk: "Adicionar",
    aoConfirmar: async () => {
      const r = await pedir(window.blendercash.adicionarPerfil(lerFormulario(), analise ? analise.caminho : null));
      mostrarAviso(r.nome + " adicionado. Já dá pra importar o extrato dele.");
      await recarregar();
    },
  });
}

function abrirNovaTransacao() {
  const corpo = criar("div", "formulario");
  corpo.appendChild(segmento("tipo", [["saida", "Saída"], ["entrada", "Entrada"]], "saida"));

  const valor = campoComEtiqueta("Valor (R$)", "input", { type: "text", inputmode: "decimal", placeholder: "25,90", autocomplete: "off" });
  const descricao = campoComEtiqueta("Descrição", "input", { type: "text", placeholder: "Ex.: pastel na feira", autocomplete: "off" });
  const data = campoComEtiqueta("Data", "input", { type: "date" });
  data.campo.value = hojeISO();

  const categoria = campoComEtiqueta("Categoria", "select");
  categoria.campo.appendChild(opcao("", "Automática (pelas regras)"));
  for (const nome of estado.categorias) categoria.campo.appendChild(opcao(nome, nome));

  const conta = campoComEtiqueta("Conta", "select");
  conta.campo.appendChild(opcao("Dinheiro", "Dinheiro vivo"));
  for (const p of estado.perfis) conta.campo.appendChild(opcao(p.nome, p.nome));

  const linhaDupla = criar("div", "linha-dupla");
  linhaDupla.appendChild(valor.grupo);
  linhaDupla.appendChild(data.grupo);
  corpo.appendChild(linhaDupla);
  corpo.appendChild(descricao.grupo);
  const linhaDupla2 = criar("div", "linha-dupla");
  linhaDupla2.appendChild(categoria.grupo);
  linhaDupla2.appendChild(conta.grupo);
  corpo.appendChild(linhaDupla2);

  abrirJanela({
    titulo: "Nova transação",
    corpo: corpo,
    textoOk: "Lançar",
    aoConfirmar: async () => {
      if (valor.campo.value.trim() === "") throw new Error("Digite o valor.");
      if (descricao.campo.value.trim() === "") throw new Error("Escreva uma descrição.");
      const r = await pedir(window.blendercash.adicionarManual({
        tipo: corpo.querySelector("input[name=tipo]:checked").value,
        valor: valor.campo.value,
        descricao: descricao.campo.value,
        data: data.campo.value,
        categoria: categoria.campo.value,
        banco: conta.campo.value,
      }));
      mostrarAviso("Lançada: " + r.transacao.descricao + " (" + r.transacao.categoria + ")");
      estado.mes = r.transacao.data.mes;
      estado.ano = r.transacao.data.ano;
      await recarregar();
    },
  });
}

function abrirEdicao(t) {
  const corpo = criar("div", "formulario");

  const resumo = criar("div", "resumo-transacao");
  resumo.appendChild(criar("span", "item-titulo", t.descricao));
  resumo.appendChild(criar("span", "rotulo", dataLonga(t.data) + " · " + t.banco + " · " + dinheiro(t.valor)));
  if (t.parcela) resumo.appendChild(criar("span", "rotulo", "Parcela " + t.parcela.n + " de " + t.parcela.total));
  corpo.appendChild(resumo);

  const categoria = campoComEtiqueta("Categoria", "select");
  for (const nome of estado.categorias) categoria.campo.appendChild(opcao(nome, nome, nome === t.categoria));
  categoria.campo.appendChild(opcao("__nova__", "+ Criar categoria nova…"));
  corpo.appendChild(categoria.grupo);

  const nova = campoComEtiqueta("Nome da categoria nova", "input", { type: "text", autocomplete: "off" });
  nova.grupo.hidden = true;
  corpo.appendChild(nova.grupo);
  categoria.campo.addEventListener("change", () => {
    nova.grupo.hidden = categoria.campo.value !== "__nova__";
    if (!nova.grupo.hidden) nova.campo.focus();
  });

  const iguais = estado.transacoes.filter((x) => x.descricao === t.descricao).length;
  const aprender = criar("label", "check");
  const caixa = criar("input");
  caixa.type = "checkbox";
  caixa.checked = !t.manual;
  aprender.appendChild(caixa);
  aprender.appendChild(criar("span", "",
    "Aprender: usar essa categoria sempre que aparecer “" + t.descricao + "”" + (iguais > 1 ? " (" + iguais + " transações hoje)" : "")));
  corpo.appendChild(aprender);

  corpo.appendChild(criar("span", "rotulo dica",
    "Dica: escolha “" + estado.investimento + "” pra dinheiro que você guardou (poupança, CDB) e “" + estado.transferencia +
    "” pra dinheiro que só mudou de lugar (de uma conta pra outra, pagamento da fatura). Os dois saem das entradas e saídas."));

  const extras = [];
  if (t.manual) {
    let confirmando = false;
    const excluir = botao("Excluir", "btn-perigo", async () => {
      if (!confirmando) {
        confirmando = true;
        excluir.lastChild.textContent = "Clique de novo pra excluir";
        return;
      }
      try {
        await pedir(window.blendercash.excluirTransacao(t.id));
        fecharJanela();
        mostrarAviso("Transação excluída");
        await recarregar();
      } catch (erro) {
        mostrarErroJanela(erro.message);
      }
    });
    extras.push(excluir);
  }

  abrirJanela({
    titulo: "Editar transação",
    corpo: corpo,
    textoOk: "Salvar",
    extras: extras,
    aoConfirmar: async () => {
      let nome = categoria.campo.value;
      if (nome === "__nova__") nome = nova.campo.value.trim();
      if (nome === "") throw new Error("Escreva o nome da categoria nova.");
      const r = await pedir(window.blendercash.mudarCategoria(t.id, nome, caixa.checked));
      mostrarAviso(caixa.checked ? "Aprendido! " + r.iguais + " transação(ões) agora em " + nome : "Categoria trocada só nessa transação");
      await recarregar();
    },
  });
}

function abrirTeto(nomeCategoria) {
  const corpo = criar("div", "formulario");

  const categoria = campoComEtiqueta("Categoria", "select");
  const nomes = estado.categorias.filter((n) => n !== estado.transferencia && n !== estado.investimento);
  for (const nome of nomes) categoria.campo.appendChild(opcao(nome, nome, nome === nomeCategoria));
  corpo.appendChild(categoria.grupo);

  const valor = campoComEtiqueta("Quanto, no máximo, por mês (R$)", "input", { type: "text", inputmode: "decimal", placeholder: "600,00", autocomplete: "off" });
  function preencher() {
    const atual = estado.orcamentos[categoria.campo.value];
    valor.campo.value = atual ? valorParaCampo(atual) : "";
  }
  categoria.campo.addEventListener("change", preencher);
  preencher();
  corpo.appendChild(valor.grupo);
  corpo.appendChild(criar("span", "rotulo dica", "Deixe vazio pra tirar o teto dessa categoria."));

  abrirJanela({
    titulo: "Teto de gastos",
    corpo: corpo,
    textoOk: "Salvar teto",
    aoConfirmar: async () => {
      await pedir(window.blendercash.salvarOrcamento(categoria.campo.value, valor.campo.value));
      mostrarAviso(valor.campo.value.trim() === "" ? "Teto removido" : "Teto salvo para " + categoria.campo.value);
      await recarregar();
    },
  });
}

function abrirNovaRecorrente() {
  const corpo = criar("div", "formulario");
  corpo.appendChild(segmento("tipo", [["saida", "Conta a pagar"], ["entrada", "Dinheiro que entra"]], "saida"));

  const nome = campoComEtiqueta("Nome", "input", { type: "text", placeholder: "Ex.: Aluguel", autocomplete: "off" });
  const palavra = campoComEtiqueta("Como aparece no extrato (opcional)", "input", { type: "text", placeholder: "Ex.: IMOBILIARIA SOL", autocomplete: "off" });
  const valor = campoComEtiqueta("Valor (R$)", "input", { type: "text", inputmode: "decimal", placeholder: "1.200,00", autocomplete: "off" });
  const dia = campoComEtiqueta("Dia do mês", "input", { type: "number", min: "1", max: "31", value: "10" });

  corpo.appendChild(nome.grupo);
  corpo.appendChild(palavra.grupo);
  const linha = criar("div", "linha-dupla");
  linha.appendChild(valor.grupo);
  linha.appendChild(dia.grupo);
  corpo.appendChild(linha);
  corpo.appendChild(criar("span", "rotulo dica", "O app procura esse texto no extrato do mês pra saber se a conta já caiu. Se deixar vazio, usa o nome."));

  abrirJanela({
    titulo: "Nova conta fixa",
    corpo: corpo,
    textoOk: "Adicionar",
    aoConfirmar: async () => {
      if (nome.campo.value.trim() === "") throw new Error("Escreva o nome da conta.");
      if (valor.campo.value.trim() === "") throw new Error("Digite o valor.");
      await pedir(window.blendercash.salvarRecorrente({
        descricao: nome.campo.value,
        palavra: palavra.campo.value,
        tipo: corpo.querySelector("input[name=tipo]:checked").value,
        valor: valor.campo.value,
        dia: dia.campo.value,
      }));
      mostrarAviso("Conta fixa adicionada");
      await recarregar();
    },
  });
}

const cadeado = document.getElementById("cadeado");
const layout = document.getElementById("layout");

function mostrarCadeado() {
  layout.hidden = true;
  cadeado.hidden = false;
  document.getElementById("cadeado-erro").hidden = true;
  const campo = document.getElementById("cadeado-senha");
  campo.value = "";
  campo.focus();
}

document.getElementById("cadeado-form").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const campo = document.getElementById("cadeado-senha");
  const erro = document.getElementById("cadeado-erro");
  try {
    await pedir(window.blendercash.desbloquear(campo.value));
    campo.value = "";
    cadeado.hidden = true;
    layout.hidden = false;
    await recarregar();
  } catch (e) {
    erro.textContent = e.message;
    erro.hidden = false;
    campo.select();
  }
});

const perfil = document.getElementById("perfil");
const perfilBotao = document.getElementById("perfil-botao");
const perfilCard = document.getElementById("perfil-card");

function abrirPerfil(abrir) {
  perfilCard.hidden = !abrir;
  perfilBotao.setAttribute("aria-expanded", String(abrir));
  if (abrir) perfilCard.querySelector(".perfil-opcao").focus();
}
perfilBotao.addEventListener("click", () => abrirPerfil(perfilCard.hidden));
document.addEventListener("click", (e) => {
  if (!perfilCard.hidden && !perfil.contains(e.target)) abrirPerfil(false);
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !perfilCard.hidden) { abrirPerfil(false); perfilBotao.focus(); }
});
for (const opcao of perfilCard.querySelectorAll(".perfil-opcao")) {
  opcao.addEventListener("click", () => abrirPerfil(false));
}

document.getElementById("botao-senha").addEventListener("click", () => {
  if (estado.senhaAtiva) abrirOpcoesSenha(); else abrirAtivarSenha();
});

function abrirAtivarSenha() {
  const corpo = criar("div", "formulario");
  corpo.appendChild(criar("p", "", "Com a senha ligada, o app pede a senha toda vez que abre, e todos os seus arquivos de dados ficam embaralhados (criptografados) no computador."));
  const senha = campoComEtiqueta("Nova senha (mínimo 6 caracteres)", "input", { type: "password", autocomplete: "new-password" });
  const repetir = campoComEtiqueta("Repita a senha", "input", { type: "password", autocomplete: "new-password" });
  corpo.appendChild(senha.grupo);
  corpo.appendChild(repetir.grupo);

  const aviso = criar("div", "alerta");
  aviso.appendChild(criar("strong", "", "Importante: "));
  aviso.appendChild(document.createTextNode("se você esquecer a senha, NÃO tem como recuperar os dados. Faça um backup antes (Backup, no seu perfil) e guarde a senha num lugar seguro."));
  corpo.appendChild(aviso);

  const entendi = criar("label", "check");
  const caixa = criar("input");
  caixa.type = "checkbox";
  entendi.appendChild(caixa);
  entendi.appendChild(criar("span", "", "Entendi: sem a senha, os dados não voltam."));
  corpo.appendChild(entendi);

  abrirJanela({
    titulo: "Proteger com senha",
    corpo: corpo,
    textoOk: "Ligar a senha",
    aoConfirmar: async () => {
      if (senha.campo.value.length < 6) throw new Error("A senha precisa ter pelo menos 6 caracteres.");
      if (senha.campo.value !== repetir.campo.value) throw new Error("As duas senhas não são iguais.");
      if (!caixa.checked) throw new Error("Marque a caixinha confirmando que entendeu.");
      const r = await pedir(window.blendercash.ativarSenha(senha.campo.value));
      mostrarAviso("Senha ligada · " + r.arquivos + " arquivos protegidos");
      await recarregar();
    },
  });
}

function abrirOpcoesSenha() {
  const corpo = criar("div", "formulario");
  corpo.appendChild(criar("p", "", "A senha está ligada: seus dados ficam embaralhados no computador e o app pede a senha ao abrir."));
  const senha = campoComEtiqueta("Pra desligar, digite a senha atual", "input", { type: "password", autocomplete: "current-password" });
  corpo.appendChild(senha.grupo);

  const trancar = botao("Trancar agora", "", async () => {
    try {
      await pedir(window.blendercash.trancar());
      fecharJanela();
      mostrarCadeado();
    } catch (e) {
      mostrarErroJanela(e.message);
    }
  });

  abrirJanela({
    titulo: "Senha",
    corpo: corpo,
    textoOk: "Desligar a senha",
    extras: [trancar],
    aoConfirmar: async () => {
      if (senha.campo.value === "") throw new Error("Digite a senha atual pra desligar.");
      await pedir(window.blendercash.desativarSenha(senha.campo.value));
      mostrarAviso("Senha desligada · os arquivos voltaram ao normal");
      await recarregar();
    },
  });
}

function abrirSaldo(conta) {
  const corpo = criar("div", "formulario");
  const atual = estado.saldos.find((s) => s.conta === conta);
  corpo.appendChild(criar("p", "", "Olhe o app do banco e digite o saldo de hoje. Daí pra frente, o Blendercash soma sozinho o que entrar e sair nessa conta."));

  const valor = campoComEtiqueta("Saldo da conta " + conta + " (R$)", "input", { type: "text", inputmode: "decimal", placeholder: "1.523,40", autocomplete: "off" });
  const data = campoComEtiqueta("Esse era o saldo no fim do dia", "input", { type: "date" });
  data.campo.value = hojeISO();
  if (atual) valor.campo.value = (atual.atual < 0 ? "-" : "") + valorParaCampo(atual.atual);

  const linha = criar("div", "linha-dupla");
  linha.appendChild(valor.grupo);
  linha.appendChild(data.grupo);
  corpo.appendChild(linha);
  corpo.appendChild(criar("span", "rotulo dica", "Pode ser negativo (ex.: -150,00). Deixe vazio pra apagar o saldo dessa conta."));

  abrirJanela({
    titulo: "Saldo · " + conta,
    corpo: corpo,
    textoOk: "Salvar saldo",
    aoConfirmar: async () => {
      await pedir(window.blendercash.salvarSaldo(conta, valor.campo.value, data.campo.value));
      mostrarAviso(valor.campo.value.trim() === "" ? "Saldo apagado" : "Saldo de " + conta + " salvo");
      await recarregar();
    },
  });
}

function faixaSaldos() {
  if (!estado.saldos || estado.saldos.length === 0) return null;
  const faixa = criar("div", "glass faixa-saldos");
  let total = 0;
  for (const s of estado.saldos) total = total + s.atual;

  const bloco = criar("div", "faixa-total");
  bloco.appendChild(criar("span", "rotulo", "Saldo nas contas"));
  bloco.appendChild(numeroDinheiro("numero numero-menor" + (total < 0 ? " negativo" : ""), total));
  faixa.appendChild(bloco);

  const contas = criar("div", "faixa-contas");
  for (const s of estado.saldos) {
    const item = criar("span", "faixa-conta");
    item.appendChild(criar("span", "rotulo", s.conta));
    item.appendChild(criar("span", "forte" + (s.atual < 0 ? " negativo" : ""), dinheiro(s.atual)));
    contas.appendChild(item);
  }
  faixa.appendChild(contas);
  botaoCard(faixa, "Contas", SVG_IR, () => irPara("bancos"));
  return faixa;
}

function painelSugestoes() {
  if (!estado.sugestoes || estado.sugestoes.length === 0) return null;
  const painel = criar("div", "glass painel");
  const topo = criar("div", "painel-topo");
  topo.appendChild(criar("h2", "", "Parece conta fixa"));
  painel.appendChild(topo);
  painel.appendChild(criar("span", "rotulo dica", "Essas aparecem uma vez por mês, com o mesmo valor. Virando conta fixa, elas entram no saldo previsto e nos lembretes."));

  for (const s of estado.sugestoes) {
    const linha = criar("div", "sugestao");
    const textos = criar("div", "transacao-textos");
    textos.appendChild(criar("span", "transacao-desc", s.descricao));
    textos.appendChild(criar("span", "transacao-banco", s.banco + " · todo dia " + s.dia + " · apareceu em " + s.meses + " meses"));
    linha.appendChild(textos);
    linha.appendChild(criar("span", "valor " + (s.valor > 0 ? "positivo" : "negativo"), (s.valor > 0 ? "+" : "") + dinheiro(s.valor)));

    const acoes = criar("div", "sugestao-acoes");
    acoes.appendChild(botao("Ignorar", "btn-pequeno", async () => {
      await pedir(window.blendercash.ignorarSugestao(s.chave));
      mostrarAviso("Ok, não vou mais sugerir " + s.descricao);
      await recarregar();
    }));
    acoes.appendChild(botao("Virar conta fixa", "btn-destaque btn-destaque-pequeno", async () => {
      await pedir(window.blendercash.aceitarSugestao(s.chave));
      mostrarAviso(s.descricao + " agora é conta fixa");
      await recarregar();
    }, SVG_MAIS));
    linha.appendChild(acoes);
    painel.appendChild(linha);
  }
  return painel;
}

const SVG_SINO = "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0";

function faixaLembretes() {
  if (!estado.lembretes || estado.lembretes.length === 0) return null;
  const faixa = criar("div", "faixa-lembretes");
  faixa.setAttribute("role", "status");
  for (const l of estado.lembretes) {
    const item = criar("div", "lembrete");
    const ic = criar("span", "lembrete-icone");
    ic.appendChild(icone(SVG_SINO));
    item.appendChild(ic);
    const textos = criar("div", "insight-texto");
    textos.appendChild(criar("strong", "", l.titulo));
    textos.appendChild(criar("span", "rotulo", estado.privado ? "" : l.corpo));
    item.appendChild(textos);
    faixa.appendChild(item);
  }
  return faixa;
}

const DIAS_SEMANA = ["domingos", "segundas", "terças", "quartas", "quintas", "sextas", "sábados"];

function painelCalendario(cal, semana) {
  const painel = criar("div", "glass painel painel-calendario");
  const topo = criar("div", "painel-topo");
  topo.appendChild(criar("h2", "", "Calendário de gastos"));

  const legenda = criar("div", "legenda-grafico");
  legenda.appendChild(criar("span", "", "Menos"));
  for (const nivel of [0, 0.25, 0.5, 0.75, 1]) {
    const q = criar("span", "legenda-cor legenda-quadrado");
    q.style.background = nivel === 0 ? "rgba(255,255,255,0.05)" : "rgba(239, 68, 68, " + (0.18 + nivel * 0.72) + ")";
    legenda.appendChild(q);
  }
  legenda.appendChild(criar("span", "", "Mais"));
  topo.appendChild(legenda);
  painel.appendChild(topo);

  const grade = criar("div", "calendario");
  for (const letra of ["D", "S", "T", "Q", "Q", "S", "S"]) grade.appendChild(criar("span", "calendario-cabeca", letra));
  for (let i = 0; i < cal.primeiroDiaDaSemana; i++) grade.appendChild(criar("span", "calendario-vazio"));

  const hoje = new Date();
  for (const d of cal.dias) {
    const celula = criar("button", "calendario-dia");
    celula.type = "button";
    celula.appendChild(criar("span", "calendario-numero", String(d.dia)));
    if (d.total > 0) {
      const intensidade = cal.maior > 0 ? d.total / cal.maior : 0;
      celula.style.background = "rgba(239, 68, 68, " + (0.18 + intensidade * 0.72).toFixed(2) + ")";
      celula.appendChild(criar("span", "calendario-valor", estado.privado ? "•••" : dinheiroCurto(d.total).replace("R$ ", "")));
    }
    const ehHoje = hoje.getDate() === d.dia && hoje.getMonth() + 1 === estado.mes && hoje.getFullYear() === estado.ano;
    if (ehHoje) celula.classList.add("calendario-hoje");
    const descricao = "Dia " + d.dia + ": " + (d.quantidade === 0 ? "nenhum gasto" : dinheiro(d.total) + " em " + d.quantidade + (d.quantidade === 1 ? " gasto" : " gastos"));
    celula.title = descricao;
    celula.setAttribute("aria-label", descricao);
    celula.addEventListener("click", () => abrirDia(d.dia));
    grade.appendChild(celula);
  }
  painel.appendChild(grade);

  if (semana.saidas >= 8) {
    const maior = semana.medias.reduce((a, b) => (b.media > a.media ? b : a));
    if (maior.media > 0) {
      painel.appendChild(criar("span", "rotulo dica", "Você costuma gastar mais às " + DIAS_SEMANA[maior.diaDaSemana] +
        ": média de " + dinheiro(maior.media) + " por dia (últimos 3 meses)."));
    }
  }
  return painel;
}

function abrirDia(dia) {
  const doDia = estado.transacoes.filter((t) => t.data.dia === dia && t.data.mes === estado.mes && t.data.ano === estado.ano);
  const corpo = criar("div", "formulario");
  if (doDia.length === 0) {
    corpo.appendChild(criar("p", "rotulo", "Nenhuma transação neste dia."));
  }
  for (const t of doDia) {
    const linha = linhaTransacao(t);
    linha.classList.add("transacao-compacta");
    corpo.appendChild(linha);
  }
  abrirJanela({ titulo: dois(dia) + "/" + dois(estado.mes) + "/" + estado.ano, corpo: corpo, textoOk: "Fechar", aoConfirmar: async () => true });
}

document.getElementById("botao-exportar").addEventListener("click", async () => {
  try {
    const r = await pedir(window.blendercash.exportarBackup());
    if (r.cancelado) return;
    mostrarAviso("Backup salvo com " + r.quantidade + " transações");
  } catch (erro) {
    mostrarAviso("Não deu pra salvar o backup: " + erro.message);
  }
});

document.getElementById("botao-apagar").addEventListener("click", () => {
  const corpo = criar("div", "formulario");
  corpo.appendChild(criar("p", "", "Isso apaga as suas " + estado.transacoes.length + " transações e os saldos das contas. Suas regras, bancos, tetos e contas fixas continuam."));
  corpo.appendChild(criar("p", "rotulo", "Antes de apagar, o app guarda uma cópia na pasta dele (arquivo “antes-de-apagar”). Se se arrepender, é só usar Restaurar com esse arquivo."));
  abrirJanela({
    titulo: "Apagar todas as transações?",
    corpo: corpo,
    textoOk: "Apagar tudo",
    aoConfirmar: async () => {
      const r = await pedir(window.blendercash.apagarTransacoes());
      mostrarAviso(r.quantidade + " transações apagadas");
      estado.mes = null;
      await recarregar();
    },
  });
});

document.getElementById("botao-restaurar").addEventListener("click", async () => {
  let escolhido;
  try {
    escolhido = await pedir(window.blendercash.escolherBackup());
  } catch (erro) {
    mostrarAviso(erro.message);
    return;
  }
  if (escolhido.cancelado) return;

  const corpo = criar("div", "formulario");
  const quando = escolhido.exportadoEm ? new Date(escolhido.exportadoEm).toLocaleString("pt-BR") : "data desconhecida";
  corpo.appendChild(criar("p", "", "Isso troca as suas " + estado.transacoes.length + " transações atuais pelas " + escolhido.quantidade + " do backup (feito em " + quando + "), junto com as regras, os perfis, os tetos e as contas fixas."));
  corpo.appendChild(criar("p", "rotulo", "Antes de trocar, o app guarda uma cópia dos dados de agora na pasta dele, por segurança."));

  abrirJanela({
    titulo: "Restaurar backup?",
    corpo: corpo,
    textoOk: "Restaurar",
    aoConfirmar: async () => {
      const r = await pedir(window.blendercash.restaurarBackup(escolhido.caminho));
      mostrarAviso("Backup restaurado: " + r.quantidade + " transações");
      estado.mes = null;
      await recarregar();
    },
  });
});

function irPara(tela) {
  estado.tela = tela;
  estado.animarAbertura = true;
  window.scrollTo(0, 0);
  atualizarMenu();
  desenhar();
}

for (const item of document.querySelectorAll(".nav")) {
  item.addEventListener("click", () => irPara(item.dataset.tela));
}

let temporizadorAviso;
function mostrarAviso(texto) {
  const aviso = document.getElementById("aviso");
  aviso.textContent = texto;
  aviso.hidden = false;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => { aviso.hidden = true; }, 5000);
}

const rolagem = document.getElementById("rolagem");
const traco = document.getElementById("rolagem-traco");
const MARGEM_ROLAGEM = 8;
const suave = !matchMedia("(prefers-reduced-motion: reduce)").matches;

let posicaoAtual = 0;
let posicaoAlvo = 0;
let alturaTraco = 40;
let animando = false;
let arrastando = false;
let temporizadorEsconder;

function medirRolagem() {
  const total = document.documentElement.scrollHeight;
  const visivel = window.innerHeight;
  if (total <= visivel + 1) {
    rolagem.classList.add("sem-rolagem");
    return false;
  }
  rolagem.classList.remove("sem-rolagem");
  const trilho = visivel - MARGEM_ROLAGEM * 2;
  alturaTraco = Math.max(40, (trilho * visivel) / total);
  posicaoAlvo = (window.scrollY / (total - visivel)) * (trilho - alturaTraco);
  traco.style.height = alturaTraco + "px";
  return true;
}

function animarTraco() {
  posicaoAtual = suave ? posicaoAtual + (posicaoAlvo - posicaoAtual) * 0.2 : posicaoAlvo;
  if (Math.abs(posicaoAlvo - posicaoAtual) < 0.25) posicaoAtual = posicaoAlvo;
  traco.style.transform = "translateY(" + posicaoAtual.toFixed(2) + "px)";
  if (posicaoAtual !== posicaoAlvo) {
    requestAnimationFrame(animarTraco);
  } else {
    animando = false;
  }
}

function mostrarRolagem() {
  if (!medirRolagem()) return;
  rolagem.classList.add("visivel");
  if (!animando) {
    animando = true;
    requestAnimationFrame(animarTraco);
  }

  clearTimeout(temporizadorEsconder);
  temporizadorEsconder = setTimeout(() => {
    if (!arrastando && !rolagem.matches(":hover")) rolagem.classList.remove("visivel");
  }, 1000);
}

window.addEventListener("scroll", mostrarRolagem, { passive: true });
window.addEventListener("resize", mostrarRolagem);

document.addEventListener("mousemove", (e) => { if (window.innerWidth - e.clientX < 28) mostrarRolagem(); });
rolagem.addEventListener("mouseleave", mostrarRolagem);

new ResizeObserver(() => { medirRolagem(); posicaoAtual = posicaoAlvo; traco.style.transform = "translateY(" + posicaoAtual + "px)"; })
  .observe(document.body);

let inicioY = 0;
let inicioRolagem = 0;
traco.addEventListener("pointerdown", (e) => {
  arrastando = true;
  inicioY = e.clientY;
  inicioRolagem = window.scrollY;
  traco.setPointerCapture(e.pointerId);
  rolagem.classList.add("arrastando");
  e.preventDefault();
});
traco.addEventListener("pointermove", (e) => {
  if (!arrastando) return;
  const total = document.documentElement.scrollHeight;
  const visivel = window.innerHeight;
  const trilho = visivel - MARGEM_ROLAGEM * 2;
  const fator = (total - visivel) / (trilho - alturaTraco);
  window.scrollTo(0, inicioRolagem + (e.clientY - inicioY) * fator);
});
traco.addEventListener("pointerup", () => {
  arrastando = false;
  rolagem.classList.remove("arrastando");
  mostrarRolagem();
});

rolagem.addEventListener("pointerdown", (e) => {
  if (e.target !== rolagem) return;
  const total = document.documentElement.scrollHeight;
  const visivel = window.innerHeight;
  const trilho = visivel - MARGEM_ROLAGEM * 2;
  const fracao = Math.min(1, Math.max(0, (e.clientY - MARGEM_ROLAGEM - alturaTraco / 2) / (trilho - alturaTraco)));
  window.scrollTo({ top: fracao * (total - visivel), behavior: "smooth" });
});

recarregar();
