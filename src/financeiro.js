const fs = require("fs");
const path = require("path");
const cofre = require("./cofre");

const ARQUIVO_PERFIS = "perfis_bancos.json";
const ARQUIVO_REGRAS = "regras_categorias.json";
const ARQUIVO_DADOS = "dados.json";
const ARQUIVO_ORCAMENTOS = "orcamentos.json";
const ARQUIVO_RECORRENTES = "recorrentes.json";

const CATEGORIA_TRANSFERENCIA = "Entre minhas contas";

const CATEGORIA_INVESTIMENTO = "Investimentos";

function foraDaConta(t) {
  return t.categoria === CATEGORIA_TRANSFERENCIA || t.categoria === CATEGORIA_INVESTIMENTO;
}

function lerJSON(caminho) {
  const conteudo = JSON.parse(fs.readFileSync(caminho, "utf-8"));
  return cofre.estaTrancado(conteudo) ? JSON.parse(cofre.destrancar(conteudo)) : conteudo;
}

function salvarJSON(caminho, conteudo) {
  const texto = JSON.stringify(conteudo, null, 2);
  const final = cofre.temChave() ? JSON.stringify(cofre.trancar(texto)) : texto;

  const temporario = caminho + ".tmp";
  fs.writeFileSync(temporario, final, "utf-8");
  fs.renameSync(temporario, caminho);
}

function carregarConfig(pasta) {
  return {
    perfis: lerJSON(path.join(pasta, ARQUIVO_PERFIS)),
    regras: lerJSON(path.join(pasta, ARQUIVO_REGRAS)),
  };
}

function acharPerfil(perfis, nome) {
  const perfil = perfis.find((p) => p.nome === nome);

  if (!perfil) {
    throw new Error("Perfil de banco não encontrado: " + nome);
  }

  return perfil;
}

function converterValor(texto, separadorDecimal) {
  let limpo = texto.toUpperCase();
  limpo = limpo.replace("R$", "");
  limpo = limpo.replaceAll(" ", "");

  let negativo = false;

  if (limpo.startsWith("(") && limpo.endsWith(")")) {
    negativo = true;
    limpo = limpo.slice(1, -1);
  }
  if (limpo.endsWith("D")) {
    negativo = true;
    limpo = limpo.slice(0, -1);
  } else if (limpo.endsWith("C")) {
    limpo = limpo.slice(0, -1);
  }
  if (limpo.endsWith("-")) {
    negativo = true;
    limpo = limpo.slice(0, -1);
  }
  if (limpo.startsWith("-")) {
    negativo = true;
    limpo = limpo.slice(1);
  }

  if (separadorDecimal === ",") {
    limpo = limpo.replaceAll(".", "");
    limpo = limpo.replace(",", ".");
  } else {
    limpo = limpo.replaceAll(",", "");
  }

  const reais = Number(limpo);
  if (limpo === "" || isNaN(reais)) {
    throw new Error("Valor inválido: " + texto);
  }

  let centavos = Math.round(reais * 100);
  if (negativo) {
    centavos = -centavos;
  }
  return centavos;
}

function valorOuZero(texto, separadorDecimal) {
  if (texto === undefined || texto.trim() === "") {
    return 0;
  }
  return converterValor(texto, separadorDecimal);
}

function converterData(texto, formato) {
  let dia;
  let mes;
  let ano;

  if (formato === "DD/MM/AAAA") {
    const partes = texto.split("/");
    dia = Number(partes[0]);
    mes = Number(partes[1]);
    ano = Number(partes[2]);
  } else if (formato === "AAAA-MM-DD") {
    const partes = texto.split("-");
    ano = Number(partes[0]);
    mes = Number(partes[1]);
    dia = Number(partes[2]);
  } else {
    throw new Error("Formato de data desconhecido: " + formato);
  }

  const ultimoDia = new Date(ano, mes, 0).getDate();
  if (isNaN(dia) || isNaN(mes) || isNaN(ano) || mes < 1 || mes > 12 || dia < 1 || dia > ultimoDia) {
    throw new Error("Data inválida: " + texto);
  }

  return { dia: dia, mes: mes, ano: ano };
}

function numeroDaData(d) {
  return d.ano * 10000 + d.mes * 100 + d.dia;
}

function somarMeses(d, quantos) {
  const total = d.ano * 12 + (d.mes - 1) + quantos;
  const ano = Math.floor(total / 12);
  const mes = (total % 12) + 1;
  const ultimoDia = new Date(ano, mes, 0).getDate();
  return { dia: Math.min(d.dia, ultimoDia), mes: mes, ano: ano };
}

function hojeComoData() {
  const agora = new Date();
  return { dia: agora.getDate(), mes: agora.getMonth() + 1, ano: agora.getFullYear() };
}

function dividirLinha(linha, separador) {
  const campos = [];
  let atual = "";
  let dentroDeAspas = false;

  for (const letra of linha) {
    if (letra === '"') {
      dentroDeAspas = !dentroDeAspas;
    } else if (letra === separador && !dentroDeAspas) {
      campos.push(atual.trim());
      atual = "";
    } else {
      atual = atual + letra;
    }
  }

  campos.push(atual.trim());
  return campos;
}

function extrairValor(campos, perfil) {
  let valor;

  if (perfil.modoValor === "unica") {
    valor = converterValor(campos[perfil.colunaValor], perfil.separadorDecimal);
  } else {
    const debito = Math.abs(valorOuZero(campos[perfil.colunaDebito], perfil.separadorDecimal));
    const credito = Math.abs(valorOuZero(campos[perfil.colunaCredito], perfil.separadorDecimal));
    valor = credito - debito;
  }

  if (perfil.inverterSinal) {
    valor = -valor;
  }
  return valor;
}

const CATEGORIAS_AUTOMATICAS = {
  "Compras": ["MERCADO LIVRE", "MERCADOLIVRE", "SHOPEE", "AMAZON", "MAGALU", "MAGAZINE LUIZA", "AMERICANAS",
    "SHEIN", "ALIEXPRESS", "KABUM", "CASAS BAHIA", "RENNER", "RIACHUELO", "C&A", "CENTAURO", "NETSHOES", "LOJA", "LOJAS"],
  "Alimentação": ["CAFE", "CAFES", "CAFETERIA", "COFFEE", "PADARIA", "PANIFICADORA", "CONFEITARIA", "DOCERIA",
    "RESTAURANTE", "LANCHONETE", "LANCHES", "PIZZARIA", "HAMBURGUERIA", "ACAI", "SORVETERIA", "SORVETES",
    "PASTELARIA", "CHURRASCARIA", "SUSHI", "TEMAKERIA", "BAR", "BOTECO", "CHOPERIA",
    "MERCADO", "SUPERMERCADO", "MERCEARIA", "HORTIFRUTI", "SACOLAO", "ATACADAO", "ASSAI", "CARREFOUR",
    "ATACADISTA", "ACOUGUE", "EMPORIO"],
  "Fast-food": ["IFOOD", "RAPPI", "MCDONALDS", "MC DONALDS", "BURGER KING", "SUBWAY", "HABIBS", "BOBS",
    "KFC", "POPEYES", "GIRAFFAS", "SPOLETO", "OUTBACK"],
  "Transporte": ["UBER", "99 POP", "99APP", "99 TAXI", "TAXI", "CABIFY", "POSTO", "COMBUSTIVEL", "COMBUSTIVEIS",
    "SHELL", "IPIRANGA", "PETROBRAS", "ESTACIONAMENTO", "PEDAGIO", "SEM PARAR", "CONECTCAR", "METRO", "ONIBUS"],
  "Saúde": ["FARMACIA", "DROGARIA", "DROGASIL", "DROGA RAIA", "PAGUE MENOS", "PANVEL", "HOSPITAL", "CLINICA",
    "LABORATORIO", "ODONTO", "ODONTOLOGIA", "OTICA", "UNIMED"],
  "Assinaturas": ["NETFLIX", "SPOTIFY", "PRIME VIDEO", "AMAZON PRIME", "DISNEY", "HBO", "GLOBOPLAY",
    "YOUTUBE", "DEEZER", "CRUNCHYROLL", "PARAMOUNT", "APPLE COM BILL", "GOOGLE STORAGE", "ICLOUD"],
  "Lazer": ["CINEMA", "CINEMARK", "INGRESSO", "INGRESSOS", "SYMPLA", "STEAM", "PLAYSTATION", "XBOX", "NINTENDO",
    "EPIC GAMES", "RIOT GAMES"],
  "Educação": ["ESCOLA", "COLEGIO", "FACULDADE", "UNIVERSIDADE", "CURSO", "UDEMY", "ALURA", "LIVRARIA"],
  "Moradia": ["ALUGUEL", "CONDOMINIO", "ENERGIA", "CEMIG", "ENEL", "SABESP", "COPASA", "CONTA DE LUZ", "GAS"],
};

function normalizar(texto) {
  return " " + String(texto).toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9&]+/g, " ").trim() + " ";
}

const LISTA_AUTOMATICA = Object.entries(CATEGORIAS_AUTOMATICAS)
  .flatMap(([categoria, palavras]) => palavras.map((p) => ({ chave: normalizar(p), categoria: categoria })))
  .sort((a, b) => b.chave.length - a.chave.length);

function categoriaAutomatica(descricao) {
  const texto = normalizar(descricao);
  for (const item of LISTA_AUTOMATICA) {
    if (texto.includes(item.chave)) return item.categoria;
  }
  return null;
}

function categorizar(descricao, regras) {
  const maiuscula = descricao.toUpperCase();

  for (const regra of regras) {
    if (maiuscula.includes(regra.palavra.toUpperCase())) {
      return regra.categoria;
    }
  }

  return categoriaAutomatica(descricao) || "Sem categoria";
}

function formatarDinheiro(centavos) {
  const reais = centavos / 100;
  return reais.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function detectarParcela(descricao) {
  const padroes = [
    /\s*PARC(?:ELA)?\.?\s*(\d{1,2})\s*(?:\/|DE)\s*(\d{1,2})\s*/,
    /\s+(\d{1,2})\s*\/\s*(\d{1,2})\s*$/,
  ];

  for (const padrao of padroes) {
    const achou = descricao.match(padrao);
    if (achou) {
      const n = Number(achou[1]);
      const total = Number(achou[2]);
      if (n >= 1 && total >= 2 && n <= total && total <= 48) {
        const base = descricao.replace(achou[0], " ").replace(/\s+/g, " ").trim();
        return { n: n, total: total, base: base };
      }
    }
  }
  return null;
}

function faturaDaCompra(data, diaFechamento) {
  const base = data.dia < diaFechamento ? data : somarMeses({ dia: 1, mes: data.mes, ano: data.ano }, 1);
  const ultimoDia = new Date(base.ano, base.mes, 0).getDate();
  return { dia: Math.min(diaFechamento, ultimoDia), mes: base.mes, ano: base.ano };
}

function completarTransacao(transacao, perfil, regras) {
  transacao.categoria = categorizar(transacao.descricao, regras);
  transacao.banco = perfil.nome;

  if (perfil.tipo === "cartao") {
    transacao.cartao = true;
    const parcela = detectarParcela(transacao.descricao);
    if (parcela) {
      transacao.parcela = parcela;
    }
    transacao.fatura = faturaDaCompra(transacao.data, perfil.diaFechamento || 1);
  }
  return transacao;
}

function montarDescricao(campos, perfil) {
  const colunas = Array.isArray(perfil.colunaDescricao) ? perfil.colunaDescricao : [perfil.colunaDescricao];
  const partes = colunas.map((c) => (campos[c] || "").trim()).filter((p) => p !== "");
  if (partes.length === 0) throw new Error("Linha sem descrição");
  return partes.join(" · ").toUpperCase();
}

function lerCSV(caminho, perfil, regras) {
  const extrato = fs.readFileSync(caminho, perfil.codificacao || "utf-8");
  const linhas = extrato.split("\n");

  const transacoes = [];
  const erros = [];
  const vistas = {};

  for (let i = perfil.linhasCabecalho; i < linhas.length; i++) {
    const limpa = linhas[i].trim();
    if (limpa === "") continue;

    try {
      const campos = dividirLinha(limpa, perfil.separador);

      const transacao = completarTransacao({
        data: converterData(campos[perfil.colunaData], perfil.formatoData),
        descricao: montarDescricao(campos, perfil),
        valor: extrairValor(campos, perfil),
      }, perfil, regras);

      const d = transacao.data;
      const chave = transacao.banco + "|" + d.ano + "-" + d.mes + "-" + d.dia + "|" + transacao.descricao + "|" + transacao.valor;
      const vezes = (vistas[chave] ?? 0) + 1;
      vistas[chave] = vezes;
      transacao.id = chave + "|" + vezes;

      transacoes.push(transacao);
    } catch (erro) {
      erros.push("linha " + (i + 1) + ": " + erro.message);
    }
  }

  return { transacoes: transacoes, erros: erros };
}

const RE_DATA_BR = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
const RE_DATA_ISO = /^\d{4}-\d{1,2}-\d{1,2}$/;
const RE_VALOR = /^[-(]?\s*(R\$)?\s*-?[\d.,]+\s*[)DC-]?$/i;

function analisarCSV(caminho) {
  const bytes = fs.readFileSync(caminho);
  let codificacao = "utf-8";
  let texto = bytes.toString("utf-8");
  if (texto.includes("�")) {
    codificacao = "latin1";
    texto = bytes.toString("latin1");
  }
  const linhas = texto.split("\n").map((l) => l.trim()).filter((l) => l !== "").slice(0, 60);
  if (linhas.length === 0) throw new Error("O arquivo está vazio.");

  let separador = ";";
  let melhor = -1;
  for (const sep of [";", ",", "\t", "|"]) {
    const contagens = linhas.slice(-10).map((l) => dividirLinha(l, sep).length);
    const iguais = contagens.every((c) => c === contagens[0]);
    const nota = iguais && contagens[0] > 1 ? contagens[0] : 0;
    if (nota > melhor) { melhor = nota; separador = sep; }
  }

  const divididas = linhas.map((l) => dividirLinha(l, separador));
  const temData = (campos) => campos.some((c) => RE_DATA_BR.test(c) || RE_DATA_ISO.test(c));
  let primeira = divididas.findIndex(temData);
  if (primeira === -1) throw new Error("Não achei nenhuma data nesse arquivo. Ele é mesmo um extrato em CSV?");

  const amostra = divididas.slice(primeira, primeira + 5);
  const totalColunas = Math.max(...amostra.map((c) => c.length));
  const cabecalho = primeira > 0 && divididas[primeira - 1].length >= totalColunas - 1 ? divididas[primeira - 1] : [];

  const ehData = (i) => amostra.every((c) => RE_DATA_BR.test(c[i] || "") || RE_DATA_ISO.test(c[i] || ""));
  const ehValor = (i) => amostra.every((c) => (c[i] || "") === "" || RE_VALOR.test(c[i])) && amostra.some((c) => /\d/.test(c[i] || ""));
  const colunas = [...Array(totalColunas).keys()];
  const colunaData = colunas.find(ehData) ?? 0;
  const formatoData = RE_DATA_ISO.test(amostra[0][colunaData] || "") ? "AAAA-MM-DD" : "DD/MM/AAAA";
  const colunasValor = colunas.filter((i) => i !== colunaData && ehValor(i));
  const colunaDescricao = colunas.find((i) => i !== colunaData && !colunasValor.includes(i)) ?? 1;

  const numeros = amostra.flatMap((c) => colunasValor.map((i) => c[i] || "")).filter((v) => /\d/.test(v));
  const comVirgula = numeros.filter((v) => /,\d{1,2}\D*$/.test(v)).length;
  const comPonto = numeros.filter((v) => /\.\d{1,2}\D*$/.test(v)).length;

  return {
    codificacao: codificacao,
    separador: separador,
    linhasCabecalho: linhas.length === 0 ? 0 : contarLinhasAte(texto, linhas[primeira]),
    cabecalho: cabecalho,
    amostra: amostra,
    totalColunas: totalColunas,
    palpite: {
      colunaData: colunaData,
      formatoData: formatoData,
      colunaDescricao: colunaDescricao,
      colunaValor: colunasValor[0] ?? 2,
      colunaCredito: colunasValor[1] ?? null,
      separadorDecimal: comPonto > comVirgula ? "." : ",",
    },
  };
}

function contarLinhasAte(texto, linhaAlvo) {
  const cruas = texto.split("\n");
  const i = cruas.findIndex((l) => l.trim() === linhaAlvo);
  return i === -1 ? 0 : i;
}

function montarPerfil(f, perfisExistentes) {
  const nome = String(f.nome || "").trim();
  if (nome === "") throw new Error("Escreva o nome do banco.");
  if (nome.toLowerCase() === "dinheiro") throw new Error("\"Dinheiro\" já é usado pro dinheiro vivo. Escolha outro nome.");
  if (perfisExistentes.some((p) => p.nome.toLowerCase() === nome.toLowerCase())) {
    throw new Error("Já existe um perfil chamado " + nome + ".");
  }
  const tipo = f.tipo === "cartao" ? "cartao" : "conta";
  const perfil = { nome: nome, tipo: tipo };
  if (tipo === "cartao") {
    const dia = Number(f.diaFechamento);
    if (!Number.isInteger(dia) || dia < 1 || dia > 31) throw new Error("O dia de fechamento precisa ser de 1 a 31.");
    perfil.diaFechamento = dia;
  }

  const numero = (v) => Number(v);
  const descricao = (Array.isArray(f.colunaDescricao) ? f.colunaDescricao : [f.colunaDescricao]).map(numero).filter((n) => !isNaN(n));
  if (descricao.length === 0) throw new Error("Escolha a coluna da descrição.");

  Object.assign(perfil, {
    separador: f.separador || ";",
    codificacao: f.codificacao === "latin1" ? "latin1" : "utf-8",
    linhasCabecalho: Math.max(0, numero(f.linhasCabecalho) || 0),
    formatoData: f.formatoData === "AAAA-MM-DD" ? "AAAA-MM-DD" : "DD/MM/AAAA",
    separadorDecimal: f.separadorDecimal === "." ? "." : ",",
    colunaData: numero(f.colunaData) || 0,
    colunaDescricao: descricao.length === 1 ? descricao[0] : descricao,
    modoValor: f.modoValor === "debitoCredito" ? "debitoCredito" : "unica",
  });
  if (perfil.modoValor === "unica") {
    perfil.colunaValor = numero(f.colunaValor);
  } else {
    perfil.colunaDebito = numero(f.colunaDebito);
    perfil.colunaCredito = numero(f.colunaCredito);
    if (perfil.colunaDebito === perfil.colunaCredito) throw new Error("Débito e crédito precisam ser colunas diferentes.");
  }
  perfil.inverterSinal = !!f.inverterSinal;
  return perfil;
}

function lerOFX(caminho, perfil, regras) {
  let bruto = fs.readFileSync(caminho, "latin1");
  if (/ENCODING:\s*UTF-?8|encoding="utf-8"/i.test(bruto.slice(0, 600))) {
    bruto = fs.readFileSync(caminho, "utf-8");
  }

  function etiqueta(bloco, nome) {
    const achou = bloco.match(new RegExp("<" + nome + ">([^<\\r\\n]*)", "i"));
    return achou ? achou[1].trim() : "";
  }

  const blocos = bruto.split(/<STMTTRN>/i).slice(1);
  const transacoes = [];
  const erros = [];
  const vistas = {};

  blocos.forEach((bloco, i) => {
    try {
      const quando = etiqueta(bloco, "DTPOSTED");
      if (!/^\d{8}/.test(quando)) {
        throw new Error("Data inválida: " + quando);
      }
      const data = converterData(quando.slice(0, 4) + "-" + quando.slice(4, 6) + "-" + quando.slice(6, 8), "AAAA-MM-DD");

      const valorTexto = etiqueta(bloco, "TRNAMT");
      const usaVirgula = valorTexto.includes(",") && !valorTexto.includes(".");
      const valor = converterValor(valorTexto, usaVirgula ? "," : ".");

      const descricao = (etiqueta(bloco, "MEMO") || etiqueta(bloco, "NAME") || "SEM DESCRIÇÃO").toUpperCase();
      const transacao = completarTransacao({ data: data, descricao: descricao, valor: valor }, perfil, regras);

      const fitid = etiqueta(bloco, "FITID");
      if (fitid) {
        transacao.id = perfil.nome + "|ofx|" + fitid;
      } else {
        const chave = perfil.nome + "|" + numeroDaData(data) + "|" + descricao + "|" + valor;
        vistas[chave] = (vistas[chave] ?? 0) + 1;
        transacao.id = chave + "|" + vistas[chave];
      }

      transacoes.push(transacao);
    } catch (erro) {
      erros.push("transação " + (i + 1) + ": " + erro.message);
    }
  });

  if (blocos.length === 0) {
    erros.push("Nenhuma transação encontrada. Esse arquivo é mesmo um OFX?");
  }

  return { transacoes: transacoes, erros: erros };
}

function lerExtrato(caminho, perfil, regras) {
  if (caminho.toLowerCase().endsWith(".ofx")) {
    return lerOFX(caminho, perfil, regras);
  }
  return lerCSV(caminho, perfil, regras);
}

function carregarDados(pasta, regras) {
  const caminho = path.join(pasta, ARQUIVO_DADOS);

  if (!fs.existsSync(caminho)) {
    return [];
  }

  const lista = lerJSON(caminho);
  aplicarCategorias(lista, regras);
  return lista;
}

function aplicarCategorias(lista, regras) {
  for (const t of lista) {
    t.categoria = t.categoriaFixa || categorizar(t.descricao, regras);
  }
}

function salvarDados(pasta, lista) {
  salvarJSON(path.join(pasta, ARQUIVO_DADOS), lista);
}

function importarExtrato(dados, arquivo, perfil, regras) {
  const lido = lerExtrato(arquivo, perfil, regras);
  let adicionadas = 0;
  let duplicadas = 0;

  for (const nova of lido.transacoes) {
    const jaExiste = dados.some((t) => t.id === nova.id);

    if (jaExiste) {
      duplicadas = duplicadas + 1;
    } else {
      dados.push(nova);
      adicionadas = adicionadas + 1;
    }
  }

  return { adicionadas: adicionadas, duplicadas: duplicadas, erros: lido.erros };
}

function transacoesDoMes(lista, mes, ano) {
  return lista.filter((t) => t.data.mes === mes && t.data.ano === ano);
}

function resumoMensal(lista) {
  let entradas = 0;
  let saidas = 0;
  let transferido = 0;
  let investido = 0;

  for (const t of lista) {
    if (t.categoria === CATEGORIA_INVESTIMENTO) {
      investido = investido - t.valor;
    } else if (t.categoria === CATEGORIA_TRANSFERENCIA) {
      transferido = transferido + Math.abs(t.valor);
    } else if (t.valor > 0) {
      entradas = entradas + t.valor;
    } else {
      saidas = saidas + Math.abs(t.valor);
    }
  }

  return {
    entradas: entradas,
    saidas: saidas,
    saldo: entradas - saidas - investido,
    guardado: entradas - saidas,
    transferido: transferido,
    investido: investido,
  };
}

function gastosPorCategoria(lista) {
  const totais = {};

  for (const t of lista) {
    if (t.valor < 0 && !foraDaConta(t)) {
      const jaTinha = totais[t.categoria] ?? 0;
      totais[t.categoria] = jaTinha + Math.abs(t.valor);
    }
  }

  const ranking = Object.entries(totais);
  ranking.sort((a, b) => b[1] - a[1]);
  return ranking;
}

function ordenarPorData(lista) {
  return lista.slice().sort((a, b) => numeroDaData(b.data) - numeroDaData(a.data));
}

function salvarRegras(pasta, regras) {
  salvarJSON(path.join(pasta, ARQUIVO_REGRAS), regras);
}

function aprenderCategoria(regras, descricao, categoria) {
  const palavra = descricao.trim().toUpperCase();
  const semEssa = regras.filter((r) => r.palavra.toUpperCase() !== palavra);
  return [{ palavra: palavra, categoria: categoria }, ...semEssa];
}

function criarTransacaoManual(dadosForm, regras) {
  const descricao = String(dadosForm.descricao || "").trim().toUpperCase();
  if (descricao === "") {
    throw new Error("Escreva uma descrição.");
  }

  const centavos = Math.abs(converterValor(String(dadosForm.valor || ""), ","));
  if (centavos === 0) {
    throw new Error("O valor não pode ser zero.");
  }

  const transacao = {
    data: converterData(String(dadosForm.data || ""), "AAAA-MM-DD"),
    descricao: descricao,
    valor: dadosForm.tipo === "entrada" ? centavos : -centavos,
    categoria: "",
    banco: String(dadosForm.banco || "Dinheiro"),
    manual: true,
    id: "manual|" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
  };

  if (dadosForm.categoria) {
    transacao.categoriaFixa = String(dadosForm.categoria);
  }
  transacao.categoria = transacao.categoriaFixa || categorizar(descricao, regras);
  return transacao;
}

function carregarOrcamentos(pasta) {
  const caminho = path.join(pasta, ARQUIVO_ORCAMENTOS);
  return fs.existsSync(caminho) ? lerJSON(caminho) : {};
}

function salvarOrcamentos(pasta, orcamentos) {
  salvarJSON(path.join(pasta, ARQUIVO_ORCAMENTOS), orcamentos);
}

function categoriasComOrcamento(gastos, orcamentos) {
  const lista = gastos.map((item) => ({ nome: item[0], gasto: item[1], teto: orcamentos[item[0]] ?? null }));

  for (const nome of Object.keys(orcamentos)) {
    if (!lista.some((c) => c.nome === nome)) {
      lista.push({ nome: nome, gasto: 0, teto: orcamentos[nome] });
    }
  }
  return lista;
}

function carregarRecorrentes(pasta) {
  const caminho = path.join(pasta, ARQUIVO_RECORRENTES);
  return fs.existsSync(caminho) ? lerJSON(caminho) : [];
}

function salvarRecorrentes(pasta, recorrentes) {
  salvarJSON(path.join(pasta, ARQUIVO_RECORRENTES), recorrentes);
}

function criarRecorrente(dadosForm) {
  const descricao = String(dadosForm.descricao || "").trim();
  if (descricao === "") {
    throw new Error("Escreva o nome da conta.");
  }

  const centavos = Math.abs(converterValor(String(dadosForm.valor || ""), ","));
  if (centavos === 0) {
    throw new Error("O valor não pode ser zero.");
  }

  const dia = Number(dadosForm.dia);
  if (!Number.isInteger(dia) || dia < 1 || dia > 31) {
    throw new Error("O dia tem que ser de 1 a 31.");
  }

  const palavra = String(dadosForm.palavra || descricao).trim().toUpperCase();

  return {
    id: "rec|" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    descricao: descricao,
    palavra: palavra,
    valor: dadosForm.tipo === "entrada" ? centavos : -centavos,
    dia: dia,
  };
}

function previsoesDoMes(dados, recorrentes, mes, ano, hoje) {
  const indiceMes = ano * 12 + mes;
  const indiceHoje = hoje.ano * 12 + hoje.mes;
  if (indiceMes < indiceHoje) {
    return [];
  }

  const doMes = transacoesDoMes(dados, mes, ano);
  const previsoes = [];

  for (const r of recorrentes) {
    const jaApareceu = doMes.some((t) => t.descricao.toUpperCase().includes(r.palavra));
    if (!jaApareceu) {
      const ultimoDia = new Date(ano, mes, 0).getDate();
      previsoes.push({
        origem: "recorrente",
        descricao: r.descricao,
        valor: r.valor,
        data: { dia: Math.min(r.dia, ultimoDia), mes: mes, ano: ano },
        atrasada: indiceMes === indiceHoje && r.dia < hoje.dia,
      });
    }
  }

  const jaPrevistas = new Set();
  const parcelasReais = new Set(
    dados.filter((t) => t.parcela).map((t) => t.banco + "|" + t.parcela.base + "|" + t.parcela.n + "/" + t.parcela.total)
  );

  for (const t of dados) {
    if (!t.parcela) continue;

    for (let k = t.parcela.n + 1; k <= t.parcela.total; k++) {
      const quando = somarMeses(t.data, k - t.parcela.n);
      if (quando.mes !== mes || quando.ano !== ano) continue;

      const chave = t.banco + "|" + t.parcela.base + "|" + k + "/" + t.parcela.total;
      if (parcelasReais.has(chave) || jaPrevistas.has(chave)) continue;
      jaPrevistas.add(chave);

      previsoes.push({
        origem: "parcela",
        descricao: t.parcela.base + " " + k + "/" + t.parcela.total,
        valor: t.valor,
        data: quando,
        banco: t.banco,
        atrasada: false,
      });
    }
  }

  previsoes.sort((a, b) => numeroDaData(a.data) - numeroDaData(b.data));
  return previsoes;
}

function saldoPrevisto(resumo, previsoes) {
  let soma = resumo.saldo;
  for (const p of previsoes) {
    soma = soma + p.valor;
  }
  return soma;
}

function faturasDoCartao(dados, perfil, hoje) {
  const grupos = {};
  const hojeNumero = numeroDaData(hoje);

  function grupo(fechamento) {
    const chave = numeroDaData(fechamento);
    if (!grupos[chave]) {
      grupos[chave] = { fechamento: fechamento, total: 0, previsto: 0, quantidade: 0 };
    }
    return grupos[chave];
  }

  const doCartao = dados.filter((t) => t.banco === perfil.nome && !foraDaConta(t));

  for (const t of doCartao) {
    const fatura = t.fatura || faturaDaCompra(t.data, perfil.diaFechamento || 1);
    const g = grupo(fatura);
    g.total = g.total + Math.abs(Math.min(t.valor, 0)) - Math.max(t.valor, 0);
    g.quantidade = g.quantidade + 1;
  }

  const parcelasReais = new Set(doCartao.filter((t) => t.parcela).map((t) => t.parcela.base + "|" + t.parcela.n));
  const jaPrevistas = new Set();
  for (const t of doCartao) {
    if (!t.parcela) continue;
    for (let k = t.parcela.n + 1; k <= t.parcela.total; k++) {
      const chave = t.parcela.base + "|" + k;
      if (parcelasReais.has(chave) || jaPrevistas.has(chave)) continue;
      jaPrevistas.add(chave);
      const quando = somarMeses(t.data, k - t.parcela.n);
      grupo(faturaDaCompra(quando, perfil.diaFechamento || 1)).previsto += Math.abs(t.valor);
    }
  }

  const lista = Object.values(grupos).sort((a, b) => numeroDaData(b.fechamento) - numeroDaData(a.fechamento));
  const abertas = lista.filter((f) => numeroDaData(f.fechamento) >= hojeNumero);
  const proximaFechar = abertas.length > 0 ? abertas[abertas.length - 1] : null;

  for (const f of lista) {
    if (numeroDaData(f.fechamento) < hojeNumero) f.situacao = "fechada";
    else if (f === proximaFechar) f.situacao = "aberta";
    else f.situacao = "futura";
  }
  return lista;
}

function mesAnterior(mes, ano) {
  return mes === 1 ? { mes: 12, ano: ano - 1 } : { mes: mes - 1, ano: ano };
}

function inicioDoHistorico(dados) {
  let menor = null;
  for (const t of dados) {
    const n = numeroDaData(t.data);
    if (menor === null || n < menor) menor = n;
  }
  return menor;
}

function mesCompleto(dados, mes, ano) {
  const inicio = inicioDoHistorico(dados);
  if (inicio === null) return false;
  const temAlgo = dados.some((t) => t.data.mes === mes && t.data.ano === ano);
  return temAlgo && inicio <= numeroDaData({ dia: 7, mes: mes, ano: ano });
}

function variacao(atual, anterior) {
  if (!anterior) return null;
  return Math.round(((atual - anterior) / Math.abs(anterior)) * 100);
}

function serieMensal(dados, mes, ano, quantos) {
  const serie = [];
  for (let k = quantos - 1; k >= 0; k--) {
    const m = somarMeses({ dia: 1, mes: mes, ano: ano }, -k);
    const doMes = transacoesDoMes(dados, m.mes, m.ano);
    const r = resumoMensal(doMes);
    serie.push({ mes: m.mes, ano: m.ano, entradas: r.entradas, saidas: r.saidas, saldo: r.saldo, guardado: r.guardado, temDados: doMes.length > 0 });
  }
  return serie;
}

function insightsDoMes(dados, recorrentes, mes, ano) {
  const resultado = [];
  const atual = transacoesDoMes(dados, mes, ano);
  const ant = mesAnterior(mes, ano);
  const passado = transacoesDoMes(dados, ant.mes, ant.ano);

  const palavras = recorrentes.map((r) => r.palavra);
  const ehFixa = (t) => t.categoria === "Assinaturas" || palavras.some((p) => t.descricao.includes(p));
  const chave = (t) => t.banco + "|" + t.descricao;
  const unicas = (lista) => {
    const contagem = {};
    for (const t of lista) if (t.valor < 0 && !t.parcela && ehFixa(t)) contagem[chave(t)] = (contagem[chave(t)] ?? 0) + 1;
    return contagem;
  };
  const unicasAgora = unicas(atual);
  const unicasAntes = unicas(passado);

  for (const t of atual) {
    if (unicasAgora[chave(t)] !== 1 || unicasAntes[chave(t)] !== 1) continue;
    const antes = passado.find((x) => chave(x) === chave(t));
    const de = Math.abs(antes.valor);
    const para = Math.abs(t.valor);
    if (para - de >= 100 && para > de * 1.01) {
      resultado.push({ tipo: "aumento", descricao: t.descricao, de: de, para: para, percentual: variacao(para, de) });
    }
  }

  const anteriores = [1, 2, 3]
    .map((k) => somarMeses({ dia: 1, mes: mes, ano: ano }, -k))
    .filter((m) => mesCompleto(dados, m.mes, m.ano))
    .map((m) => transacoesDoMes(dados, m.mes, m.ano));

  if (anteriores.length > 0) {
    const gastosAntes = anteriores.map((lista) => Object.fromEntries(gastosPorCategoria(lista)));
    for (const [categoria, valor] of gastosPorCategoria(atual)) {
      let soma = 0;
      for (const g of gastosAntes) soma = soma + (g[categoria] ?? 0);
      const media = soma / anteriores.length;
      if (media > 0 && valor > media * 1.3 && valor - media >= 2000) {
        resultado.push({ tipo: "acimaDaMedia", categoria: categoria, atual: valor, media: Math.round(media), percentual: variacao(valor, media), meses: anteriores.length });
      }
    }
  }

  resultado.sort((a, b) => (a.tipo === b.tipo ? b.percentual - a.percentual : a.tipo === "aumento" ? -1 : 1));
  return resultado.slice(0, 4);
}

function resumoAnual(dados, ano) {
  const doAno = dados.filter((t) => t.data.ano === ano);
  const meses = serieMensal(dados, 12, ano, 12);
  const comDados = meses.filter((m) => m.temDados);
  const reais = doAno.filter((t) => !foraDaConta(t) && t.valor < 0);

  let maiorGasto = null;
  for (const t of reais) {
    if (!maiorGasto || t.valor < maiorGasto.valor) maiorGasto = t;
  }

  const melhor = (campo, maior) => comDados.reduce((a, b) => (a === null || (maior ? b[campo] > a[campo] : b[campo] < a[campo]) ? b : a), null);
  const resumo = resumoMensal(doAno);

  return {
    ano: ano,
    resumo: resumo,
    meses: meses,
    quantidade: doAno.length,
    mesesComDados: comDados.length,
    categorias: gastosPorCategoria(doAno),
    mesQueMaisGuardou: melhor("guardado", true),
    mesQueMaisGastou: melhor("saidas", true),
    maiorGasto: maiorGasto,
    mediaMensalSaidas: comDados.length > 0 ? Math.round(resumo.saidas / comDados.length) : 0,
  };
}

function gerarCSV(lista) {
  const campo = (texto) => {
    const t = String(texto);
    return /[;"\r\n]/.test(t) ? '"' + t.replaceAll('"', '""') + '"' : t;
  };
  const valor = (centavos) => (centavos < 0 ? "-" : "") + (Math.abs(centavos) / 100).toFixed(2).replace(".", ",");
  const data = (d) => String(d.dia).padStart(2, "0") + "/" + String(d.mes).padStart(2, "0") + "/" + d.ano;

  const linhas = ["Data;Descrição;Categoria;Conta;Valor"];
  for (const t of lista) {
    linhas.push([data(t.data), campo(t.descricao), campo(t.categoria), campo(t.banco), valor(t.valor)].join(";"));
  }

  return "﻿" + linhas.join("\r\n") + "\r\n";
}

const ARQUIVO_SEGURANCA = "seguranca.json";

function lerSeguranca(pasta) {
  const caminho = path.join(pasta, ARQUIVO_SEGURANCA);
  return fs.existsSync(caminho) ? JSON.parse(fs.readFileSync(caminho, "utf-8")) : null;
}

function senhaAtiva(pasta) {
  const s = lerSeguranca(pasta);
  return !!(s && s.ativa);
}

function arquivosDeDados(pasta) {
  return fs.readdirSync(pasta).filter((nome) => nome.endsWith(".json") && nome !== ARQUIVO_SEGURANCA);
}

function desbloquear(pasta, senha) {
  const s = lerSeguranca(pasta);
  if (!s || !s.ativa) return;
  const chave = cofre.derivarChave(senha, s.sal);
  if (!cofre.senhaConfere(s.verificador, chave)) {
    throw new Error("Senha errada.");
  }
  cofre.definirChave(chave);
}

function trancarDeNovo() {
  cofre.esquecerChave();
}

function ativarSenha(pasta, senha) {
  if (String(senha || "").length < 6) throw new Error("A senha precisa ter pelo menos 6 caracteres.");
  if (senhaAtiva(pasta)) throw new Error("A senha já está ligada.");

  const conteudos = arquivosDeDados(pasta).map((nome) => [nome, lerJSON(path.join(pasta, nome))]);

  const sal = cofre.novoSal();
  const chave = cofre.derivarChave(senha, sal);
  fs.writeFileSync(path.join(pasta, ARQUIVO_SEGURANCA),
    JSON.stringify({ ativa: true, sal: sal, verificador: cofre.criarVerificador(chave), desde: new Date().toISOString() }, null, 2), "utf-8");
  cofre.definirChave(chave);

  for (const [nome, conteudo] of conteudos) salvarJSON(path.join(pasta, nome), conteudo);
  return conteudos.length;
}

function desativarSenha(pasta, senha) {
  desbloquear(pasta, senha);
  const conteudos = arquivosDeDados(pasta).map((nome) => [nome, lerJSON(path.join(pasta, nome))]);
  cofre.esquecerChave();
  for (const [nome, conteudo] of conteudos) salvarJSON(path.join(pasta, nome), conteudo);
  fs.unlinkSync(path.join(pasta, ARQUIVO_SEGURANCA));
  return conteudos.length;
}

const ARQUIVO_SALDOS = "saldos.json";

function carregarSaldos(pasta) {
  const caminho = path.join(pasta, ARQUIVO_SALDOS);
  return fs.existsSync(caminho) ? lerJSON(caminho) : {};
}

function salvarSaldos(pasta, saldos) {
  salvarJSON(path.join(pasta, ARQUIVO_SALDOS), saldos);
}

function saldoDasContas(dados, saldos) {
  return Object.entries(saldos).map(([conta, info]) => {
    const marco = numeroDaData(info.data);
    let movimentado = 0;
    let depois = 0;
    for (const t of dados) {
      if (t.banco === conta && numeroDaData(t.data) > marco) {
        movimentado = movimentado + t.valor;
        depois = depois + 1;
      }
    }
    return { conta: conta, informado: info.saldo, data: info.data, movimentado: movimentado, transacoesDepois: depois, atual: info.saldo + movimentado };
  });
}

const ARQUIVO_IGNORADAS = "sugestoes_ignoradas.json";

function carregarIgnoradas(pasta) {
  const caminho = path.join(pasta, ARQUIVO_IGNORADAS);
  return fs.existsSync(caminho) ? lerJSON(caminho) : [];
}

function salvarIgnoradas(pasta, lista) {
  salvarJSON(path.join(pasta, ARQUIVO_IGNORADAS), lista);
}

function sugerirContasFixas(dados, recorrentes, ignoradas, hoje) {
  const meses = [0, 1, 2].map((k) => somarMeses({ dia: 1, mes: hoje.mes, ano: hoje.ano }, -k));
  const aparicoes = {};

  for (const m of meses) {
    const doMes = transacoesDoMes(dados, m.mes, m.ano).filter((t) => !t.parcela && !t.manual && !foraDaConta(t));
    const contagem = {};
    for (const t of doMes) {
      const chave = t.banco + "|" + t.descricao;
      contagem[chave] = (contagem[chave] || []).concat([t]);
    }
    for (const [chave, lista] of Object.entries(contagem)) {
      if (lista.length !== 1) continue;
      aparicoes[chave] = (aparicoes[chave] || []).concat([{ mes: m, valor: lista[0].valor, dia: lista[0].data.dia, t: lista[0] }]);
    }
  }

  const jaCobertas = (descricao) => recorrentes.some((r) => descricao.includes(r.palavra) || r.palavra.includes(descricao));
  const sugestoes = [];

  for (const [chave, lista] of Object.entries(aparicoes)) {
    if (lista.length < 2 || ignoradas.includes(chave)) continue;
    const descricao = lista[0].t.descricao;
    if (jaCobertas(descricao)) continue;
    if (!lista.every((a) => Math.sign(a.valor) === Math.sign(lista[0].valor))) continue;

    let parecido = false;
    for (let i = 0; i < lista.length && !parecido; i++) {
      for (let j = i + 1; j < lista.length && !parecido; j++) {
        const a = Math.abs(lista[i].valor);
        const b = Math.abs(lista[j].valor);
        if (Math.abs(a - b) <= Math.max(a, b) * 0.03) parecido = true;
      }
    }
    if (!parecido) continue;

    const maisRecente = lista[0];
    sugestoes.push({
      chave: chave,
      descricao: descricao,
      banco: maisRecente.t.banco,
      valor: maisRecente.valor,
      dia: maisRecente.dia,
      meses: lista.length,
    });
  }

  sugestoes.sort((a, b) => b.meses - a.meses || Math.abs(b.valor) - Math.abs(a.valor));
  return sugestoes.slice(0, 5);
}

function calendarioDoMes(dados, mes, ano) {
  const totalDeDias = new Date(ano, mes, 0).getDate();
  const dias = [];
  for (let d = 1; d <= totalDeDias; d++) dias.push({ dia: d, total: 0, quantidade: 0 });

  for (const t of transacoesDoMes(dados, mes, ano)) {
    if (t.valor < 0 && !foraDaConta(t)) {
      dias[t.data.dia - 1].total += Math.abs(t.valor);
      dias[t.data.dia - 1].quantidade += 1;
    }
  }

  return {
    dias: dias,
    primeiroDiaDaSemana: new Date(ano, mes - 1, 1).getDay(),
    maior: Math.max(0, ...dias.map((d) => d.total)),
  };
}

function gastosPorDiaDaSemana(dados, mes, ano) {
  const soma = [0, 0, 0, 0, 0, 0, 0];
  const vezes = [0, 0, 0, 0, 0, 0, 0];
  let saidas = 0;

  for (let k = 0; k < 3; k++) {
    const m = somarMeses({ dia: 1, mes: mes, ano: ano }, -k);
    const totalDeDias = new Date(m.ano, m.mes, 0).getDate();
    for (let d = 1; d <= totalDeDias; d++) vezes[new Date(m.ano, m.mes - 1, d).getDay()] += 1;
    for (const t of transacoesDoMes(dados, m.mes, m.ano)) {
      if (t.valor < 0 && !foraDaConta(t)) {
        soma[new Date(t.data.ano, t.data.mes - 1, t.data.dia).getDay()] += Math.abs(t.valor);
        saidas = saidas + 1;
      }
    }
  }

  const medias = soma.map((s, i) => ({ diaDaSemana: i, media: vezes[i] > 0 ? Math.round(s / vezes[i]) : 0 }));
  return { medias: medias, saidas: saidas };
}

function lembretesDoDia(dados, recorrentes, perfis, hoje) {
  const lembretes = [];
  const hojeData = new Date(hoje.ano, hoje.mes - 1, hoje.dia);
  const diasAte = (d) => Math.round((new Date(d.ano, d.mes - 1, d.dia) - hojeData) / 86400000);
  const quando = (n) => (n === 0 ? "hoje" : n === 1 ? "amanhã" : "em " + n + " dias");

  const doMes = transacoesDoMes(dados, hoje.mes, hoje.ano);
  for (const r of recorrentes) {
    if (r.valor >= 0) continue;
    for (const k of [0, 1]) {
      const alvo = somarMeses({ dia: 1, mes: hoje.mes, ano: hoje.ano }, k);
      const ultimoDia = new Date(alvo.ano, alvo.mes, 0).getDate();
      const vencimento = { dia: Math.min(r.dia, ultimoDia), mes: alvo.mes, ano: alvo.ano };
      const n = diasAte(vencimento);
      if (n < 0 || n > 1) continue;
      const pagaNoMes = transacoesDoMes(dados, vencimento.mes, vencimento.ano).some((t) => t.descricao.includes(r.palavra));
      if (pagaNoMes || (k === 0 && doMes.some((t) => t.descricao.includes(r.palavra)))) continue;
      lembretes.push({
        chave: "conta|" + r.id + "|" + vencimento.ano + "-" + vencimento.mes,
        titulo: r.descricao + " vence " + quando(n),
        corpo: formatarDinheiro(Math.abs(r.valor)) + " · conta fixa do dia " + r.dia,
      });
    }
  }

  for (const p of perfis.filter((x) => x.tipo === "cartao")) {
    const fechamento = faturaDaCompra(hoje, p.diaFechamento || 1);
    const n = diasAte(fechamento);
    if (n < 0 || n > 2) continue;
    const fatura = faturasDoCartao(dados, p, hoje).find((f) => numeroDaData(f.fechamento) === numeroDaData(fechamento));
    lembretes.push({
      chave: "fatura|" + p.nome + "|" + numeroDaData(fechamento),
      titulo: "A fatura do " + p.nome + " fecha " + quando(n),
      corpo: "Até agora: " + formatarDinheiro(fatura ? fatura.total : 0),
    });
  }

  return lembretes;
}

function montarBackup(dados, regras, perfis, orcamentos, recorrentes, saldos) {
  return {
    app: "Blendercash",
    versao: 2,
    exportadoEm: new Date().toISOString(),
    transacoes: dados,
    regras: regras,
    perfis: perfis,
    orcamentos: orcamentos,
    recorrentes: recorrentes,
    saldos: saldos || {},
  };
}

function validarBackup(backup) {
  if (!backup || backup.app !== "Blendercash" || !Array.isArray(backup.transacoes)) {
    throw new Error("Esse arquivo não é um backup do Blendercash.");
  }
  if (!Array.isArray(backup.regras) || !Array.isArray(backup.perfis)) {
    throw new Error("O backup está incompleto (faltam regras ou perfis).");
  }
  for (const t of backup.transacoes) {
    if (!t || !t.id || !t.data || typeof t.valor !== "number" || typeof t.descricao !== "string") {
      throw new Error("O backup tem uma transação estragada.");
    }
  }
  return backup;
}

module.exports = {
  CATEGORIA_TRANSFERENCIA,
  CATEGORIA_INVESTIMENTO,
  foraDaConta,
  lerJSON,
  carregarConfig,
  acharPerfil,
  converterValor,
  converterData,
  dividirLinha,
  categorizar,
  formatarDinheiro,
  detectarParcela,
  faturaDaCompra,
  somarMeses,
  hojeComoData,
  lerExtrato,
  carregarDados,
  aplicarCategorias,
  salvarDados,
  importarExtrato,
  transacoesDoMes,
  resumoMensal,
  gastosPorCategoria,
  ordenarPorData,
  salvarRegras,
  aprenderCategoria,
  criarTransacaoManual,
  carregarOrcamentos,
  salvarOrcamentos,
  categoriasComOrcamento,
  carregarRecorrentes,
  salvarRecorrentes,
  criarRecorrente,
  previsoesDoMes,
  saldoPrevisto,
  faturasDoCartao,
  mesAnterior,
  mesCompleto,
  variacao,
  serieMensal,
  insightsDoMes,
  resumoAnual,
  gerarCSV,
  numeroDaData,
  salvarJSON,
  senhaAtiva,
  desbloquear,
  trancarDeNovo,
  ativarSenha,
  desativarSenha,
  carregarSaldos,
  salvarSaldos,
  saldoDasContas,
  carregarIgnoradas,
  salvarIgnoradas,
  sugerirContasFixas,
  calendarioDoMes,
  gastosPorDiaDaSemana,
  lembretesDoDia,
  montarBackup,
  validarBackup,
  analisarCSV,
  montarPerfil,
};
