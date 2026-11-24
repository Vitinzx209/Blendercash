const { app, BrowserWindow, ipcMain, dialog, shell, Notification } = require("electron");
const path = require("path");
const fs = require("fs");
const fin = require("./src/financeiro");
const { htmlFechamento } = require("./src/relatorio-pdf");

let pasta;
let config;
let dados;
let orcamentos;
let recorrentes;
let saldos;
let trancado = false;
let janela;

const ICONE = path.join(__dirname, "build", "icone.png");
const ARQUIVO_AVISADOS = "lembretes_avisados.json";

function prepararPasta() {
  pasta = process.env.BLENDERCASH_PASTA || app.getPath("userData");
  fs.mkdirSync(pasta, { recursive: true });

  for (const nome of ["perfis_bancos.json", "regras_categorias.json"]) {
    const destino = path.join(pasta, nome);
    if (!fs.existsSync(destino)) {
      fs.copyFileSync(path.join(__dirname, "config", nome), destino);
    }
  }
}

function mesclarPerfisPadrao() {
  const padrao = fin.lerJSON(path.join(__dirname, "config", "perfis_bancos.json"));
  const doUsuario = fin.lerJSON(path.join(pasta, "perfis_bancos.json"));
  const caminhoRemovidos = path.join(pasta, "perfis_removidos.json");
  const removidos = fs.existsSync(caminhoRemovidos) ? fin.lerJSON(caminhoRemovidos) : [];
  const faltando = padrao.filter((p) => !doUsuario.some((u) => u.nome === p.nome) && !removidos.includes(p.nome));
  if (faltando.length > 0) {
    fin.salvarJSON(path.join(pasta, "perfis_bancos.json"), [...doUsuario, ...faltando]);
  }
}

function recarregar() {
  if (trancado) throw new Error("O app está trancado. Digite a senha.");
  config = fin.carregarConfig(pasta);
  dados = fin.carregarDados(pasta, config.regras);
  orcamentos = fin.carregarOrcamentos(pasta);
  recorrentes = fin.carregarRecorrentes(pasta);
  saldos = fin.carregarSaldos(pasta);
}

function contasComSaldo() {
  const nomes = config.perfis.filter((p) => p.tipo !== "cartao").map((p) => p.nome);
  for (const t of dados) {
    if (t.banco === "Dinheiro" && !nomes.includes("Dinheiro")) nomes.push("Dinheiro");
  }
  return nomes;
}

let relogioLembretes = null;
function verificarLembretes() {
  if (trancado || !Notification.isSupported() || process.env.BLENDERCASH_FOTO) return;
  try {
    recarregar();
    const lembretes = fin.lembretesDoDia(dados, recorrentes, config.perfis, fin.hojeComoData());
    const caminho = path.join(pasta, ARQUIVO_AVISADOS);
    const avisados = fs.existsSync(caminho) ? fin.lerJSON(caminho) : [];

    for (const l of lembretes) {
      if (avisados.includes(l.chave)) continue;
      const aviso = new Notification({ title: l.titulo, body: l.corpo, icon: ICONE });
      aviso.on("click", () => { if (janela) { janela.show(); janela.focus(); } });
      aviso.show();
      avisados.push(l.chave);
    }
    fin.salvarJSON(caminho, avisados.slice(-200));
  } catch (erro) {
    console.error("Lembretes:", erro.message);
  }
}

function ligarLembretes() {
  verificarLembretes();
  if (!relogioLembretes) relogioLembretes = setInterval(verificarLembretes, 60 * 60 * 1000);
}

function listaDeCategorias() {
  const nomes = new Set([fin.CATEGORIA_TRANSFERENCIA, fin.CATEGORIA_INVESTIMENTO, "Sem categoria"]);
  for (const r of config.regras) nomes.add(r.categoria);
  for (const t of dados) nomes.add(t.categoria);
  for (const nome of Object.keys(orcamentos)) nomes.add(nome);
  return [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function montarRelatorio(mes, ano) {
  const doMes = fin.transacoesDoMes(dados, mes, ano);
  const resumo = fin.resumoMensal(doMes);
  const previsoes = fin.previsoesDoMes(dados, recorrentes, mes, ano, fin.hojeComoData());
  const ant = fin.mesAnterior(mes, ano);
  const doAnterior = fin.transacoesDoMes(dados, ant.mes, ant.ano);
  return {
    resumo: resumo,

    anterior: { ...fin.resumoMensal(doAnterior), temDados: fin.mesCompleto(dados, ant.mes, ant.ano) },
    categorias: fin.categoriasComOrcamento(fin.gastosPorCategoria(doMes), orcamentos),
    transacoes: fin.ordenarPorData(doMes),
    previsoes: previsoes,
    saldoPrevisto: fin.saldoPrevisto(resumo, previsoes),
    serie: fin.serieMensal(dados, mes, ano, 6),
    insights: fin.insightsDoMes(dados, recorrentes, mes, ano),
    calendario: fin.calendarioDoMes(dados, mes, ano),
    diaDaSemana: fin.gastosPorDiaDaSemana(dados, mes, ano),
  };
}

async function perguntarOndeSalvar(titulo, nomeSugerido, tipo, extensao) {
  if (process.env.BLENDERCASH_SALVAR_EM) {
    return path.join(process.env.BLENDERCASH_SALVAR_EM, nomeSugerido);
  }
  const resposta = await dialog.showSaveDialog(janela, {
    title: titulo,
    defaultPath: path.join(app.getPath("documents"), nomeSugerido),
    filters: [{ name: tipo, extensions: [extensao] }],
  });
  return resposta.canceled || !resposta.filePath ? null : resposta.filePath;
}

function seguro(funcao) {
  return async (evento, ...args) => {
    try {
      return { ok: true, ...(await funcao(...args)) };
    } catch (erro) {
      return { ok: false, mensagem: erro.message };
    }
  };
}

function registrarPedidos() {
  ipcMain.handle("obter-tudo", () => {
    if (trancado) return { trancado: true };
    recarregar();
    const hoje = fin.hojeComoData();
    return {
      trancado: false,
      senhaAtiva: fin.senhaAtiva(pasta),
      transacoes: fin.ordenarPorData(dados),
      perfis: config.perfis.map((p) => ({ nome: p.nome, tipo: p.tipo || "conta", diaFechamento: p.diaFechamento || null })),
      regras: config.regras,
      categorias: listaDeCategorias(),
      orcamentos: orcamentos,
      recorrentes: recorrentes,
      transferencia: fin.CATEGORIA_TRANSFERENCIA,
      investimento: fin.CATEGORIA_INVESTIMENTO,
      contasComSaldo: contasComSaldo(),
      saldos: fin.saldoDasContas(dados, saldos),
      sugestoes: fin.sugerirContasFixas(dados, recorrentes, fin.carregarIgnoradas(pasta), hoje),
      lembretes: fin.lembretesDoDia(dados, recorrentes, config.perfis, hoje),
    };
  });

  ipcMain.handle("desbloquear", seguro((senha) => {
    fin.desbloquear(pasta, senha);
    trancado = false;
    mesclarPerfisPadrao();
    ligarLembretes();
    return {};
  }));

  ipcMain.handle("ativar-senha", seguro((senha) => {
    recarregar();
    const quantos = fin.ativarSenha(pasta, senha);
    return { arquivos: quantos };
  }));

  ipcMain.handle("desativar-senha", seguro((senha) => {
    const quantos = fin.desativarSenha(pasta, senha);
    return { arquivos: quantos };
  }));

  ipcMain.handle("trancar", seguro(() => {
    if (!fin.senhaAtiva(pasta)) throw new Error("A senha não está ligada.");
    fin.trancarDeNovo();
    trancado = true;
    dados = [];
    return {};
  }));

  ipcMain.handle("salvar-saldo", seguro((conta, valorTexto, dataTexto) => {
    recarregar();
    const texto = String(valorTexto || "").trim();
    if (texto === "") {
      delete saldos[conta];
    } else {
      saldos[conta] = { saldo: fin.converterValor(texto, ","), data: fin.converterData(String(dataTexto), "AAAA-MM-DD") };
    }
    fin.salvarSaldos(pasta, saldos);
    return {};
  }));

  ipcMain.handle("aceitar-sugestao", seguro((chave) => {
    recarregar();
    const s = fin.sugerirContasFixas(dados, recorrentes, [], fin.hojeComoData()).find((x) => x.chave === chave);
    if (!s) throw new Error("Essa sugestão não existe mais.");
    recorrentes.push(fin.criarRecorrente({
      descricao: s.descricao.charAt(0) + s.descricao.slice(1).toLowerCase(),
      palavra: s.descricao,
      tipo: s.valor > 0 ? "entrada" : "saida",
      valor: (Math.abs(s.valor) / 100).toFixed(2).replace(".", ","),
      dia: String(s.dia),
    }));
    fin.salvarRecorrentes(pasta, recorrentes);
    return {};
  }));

  ipcMain.handle("ignorar-sugestao", seguro((chave) => {
    recarregar();
    const ignoradas = fin.carregarIgnoradas(pasta);
    if (!ignoradas.includes(chave)) ignoradas.push(chave);
    fin.salvarIgnoradas(pasta, ignoradas);
    return {};
  }));

  ipcMain.handle("relatorio", (evento, mes, ano) => montarRelatorio(mes, ano));

  ipcMain.handle("resumo-anual", (evento, ano) => fin.resumoAnual(dados, ano));

  ipcMain.handle("exportar-csv", seguro(async (ids, nomeSugerido) => {
    const escolhidas = new Set(ids);
    const lista = fin.ordenarPorData(dados.filter((t) => escolhidas.has(t.id))).reverse();
    const caminho = await perguntarOndeSalvar("Exportar transações (CSV)", nomeSugerido + ".csv", "Planilha CSV", "csv");
    if (!caminho) return { cancelado: true };
    fs.writeFileSync(caminho, fin.gerarCSV(lista), "utf-8");
    return { caminho: caminho, quantidade: lista.length };
  }));

  ipcMain.handle("exportar-pdf", seguro(async (mes, ano) => {
    const caminho = await perguntarOndeSalvar("Salvar fechamento do mês (PDF)",
      "blendercash-fechamento-" + ano + "-" + String(mes).padStart(2, "0") + ".pdf", "PDF", "pdf");
    if (!caminho) return { cancelado: true };

    const html = htmlFechamento({ mes: mes, ano: ano, transferencia: fin.CATEGORIA_TRANSFERENCIA, ...montarRelatorio(mes, ano) });

    const invisivel = new BrowserWindow({ show: false, webPreferences: { javascript: false } });
    try {
      await invisivel.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
      const pdf = await invisivel.webContents.printToPDF({ pageSize: "A4", printBackground: true });
      fs.writeFileSync(caminho, pdf);
    } finally {
      invisivel.destroy();
    }
    return { caminho: caminho };
  }));

  ipcMain.handle("escolher-arquivo", async () => {
    const resposta = await dialog.showOpenDialog(janela, {
      title: "Escolha o extrato do banco",
      filters: [{ name: "Extrato (CSV ou OFX)", extensions: ["csv", "txt", "ofx"] }],
      properties: ["openFile"],
    });
    return resposta.canceled || resposta.filePaths.length === 0 ? null : resposta.filePaths[0];
  });

  ipcMain.handle("importar", seguro((caminho, nomePerfil) => {
    recarregar();
    const perfil = fin.acharPerfil(config.perfis, nomePerfil);
    const resultado = fin.importarExtrato(dados, caminho, perfil, config.regras);
    fin.salvarDados(pasta, dados);
    return resultado;
  }));

  ipcMain.handle("adicionar-manual", seguro((formulario) => {
    recarregar();
    const nova = fin.criarTransacaoManual(formulario, config.regras);
    dados.push(nova);
    fin.salvarDados(pasta, dados);
    return { transacao: nova };
  }));

  ipcMain.handle("excluir-transacao", seguro((id) => {
    recarregar();
    const alvo = dados.find((t) => t.id === id);
    if (!alvo) throw new Error("Transação não encontrada.");
    if (!alvo.manual) throw new Error("Só dá pra excluir transações lançadas à mão.");
    dados = dados.filter((t) => t.id !== id);
    fin.salvarDados(pasta, dados);
    return {};
  }));

  ipcMain.handle("mudar-categoria", seguro((id, categoria, aprender) => {
    recarregar();
    const alvo = dados.find((t) => t.id === id);
    if (!alvo) throw new Error("Transação não encontrada.");
    const nome = String(categoria || "").trim();
    if (nome === "") throw new Error("Escolha uma categoria.");

    if (aprender) {
      delete alvo.categoriaFixa;
      config.regras = fin.aprenderCategoria(config.regras, alvo.descricao, nome);
      fin.salvarRegras(pasta, config.regras);
    } else {
      alvo.categoriaFixa = nome;
    }

    fin.aplicarCategorias(dados, config.regras);
    fin.salvarDados(pasta, dados);
    const iguais = dados.filter((t) => t.descricao === alvo.descricao).length;
    return { iguais: iguais };
  }));

  ipcMain.handle("salvar-orcamento", seguro((categoria, valorTexto) => {
    recarregar();
    const texto = String(valorTexto || "").trim();
    if (texto === "") {
      delete orcamentos[categoria];
    } else {
      const centavos = Math.abs(fin.converterValor(texto, ","));
      if (centavos === 0) throw new Error("O teto tem que ser maior que zero.");
      orcamentos[categoria] = centavos;
    }
    fin.salvarOrcamentos(pasta, orcamentos);
    return {};
  }));

  ipcMain.handle("salvar-recorrente", seguro((formulario) => {
    recarregar();
    recorrentes.push(fin.criarRecorrente(formulario));
    fin.salvarRecorrentes(pasta, recorrentes);
    return {};
  }));

  ipcMain.handle("excluir-recorrente", seguro((id) => {
    recarregar();
    recorrentes = recorrentes.filter((r) => r.id !== id);
    fin.salvarRecorrentes(pasta, recorrentes);
    return {};
  }));

  ipcMain.handle("cartoes", () => {
    const hoje = fin.hojeComoData();
    return config.perfis
      .filter((p) => p.tipo === "cartao")
      .map((p) => ({ nome: p.nome, diaFechamento: p.diaFechamento || 1, faturas: fin.faturasDoCartao(dados, p, hoje) }));
  });

  ipcMain.handle("exportar-backup", seguro(async () => {
    recarregar();
    const hoje = new Date().toISOString().slice(0, 10);
    const resposta = await dialog.showSaveDialog(janela, {
      title: "Salvar backup do Blendercash",
      defaultPath: path.join(app.getPath("documents"), "blendercash-backup-" + hoje + ".json"),
      filters: [{ name: "Backup do Blendercash", extensions: ["json"] }],
    });
    if (resposta.canceled || !resposta.filePath) return { cancelado: true };

    const backup = fin.montarBackup(dados, config.regras, config.perfis, orcamentos, recorrentes, saldos);
    fs.writeFileSync(resposta.filePath, JSON.stringify(backup, null, 2), "utf-8");
    return { caminho: resposta.filePath, quantidade: dados.length };
  }));

  ipcMain.handle("escolher-backup", seguro(async () => {
    const resposta = await dialog.showOpenDialog(janela, {
      title: "Escolha o backup do Blendercash",
      filters: [{ name: "Backup do Blendercash", extensions: ["json"] }],
      properties: ["openFile"],
    });
    if (resposta.canceled || resposta.filePaths.length === 0) return { cancelado: true };

    const caminho = resposta.filePaths[0];
    const backup = fin.validarBackup(fin.lerJSON(caminho));
    return { caminho: caminho, quantidade: backup.transacoes.length, exportadoEm: backup.exportadoEm || null };
  }));

  ipcMain.handle("restaurar-backup", seguro((caminho) => {
    const backup = fin.validarBackup(fin.lerJSON(caminho));
    recarregar();

    const agora = new Date().toISOString().replace(/[:.]/g, "-");
    const copia = fin.montarBackup(dados, config.regras, config.perfis, orcamentos, recorrentes, saldos);
    fin.salvarJSON(path.join(pasta, "antes-de-restaurar-" + agora + ".json"), copia);

    fin.salvarDados(pasta, backup.transacoes);
    fin.salvarRegras(pasta, backup.regras);
    fin.salvarJSON(path.join(pasta, "perfis_bancos.json"), backup.perfis);
    fin.salvarOrcamentos(pasta, backup.orcamentos || {});
    fin.salvarRecorrentes(pasta, backup.recorrentes || []);
    if (backup.saldos) fin.salvarSaldos(pasta, backup.saldos);

    const padrao = fin.lerJSON(path.join(__dirname, "config", "perfis_bancos.json"));
    const removidos = padrao.map((p) => p.nome).filter((nome) => !backup.perfis.some((p) => p.nome === nome));
    fin.salvarJSON(path.join(pasta, "perfis_removidos.json"), removidos);
    return { quantidade: backup.transacoes.length };
  }));

  ipcMain.handle("apagar-transacoes", seguro(() => {
    recarregar();
    const quantas = dados.length;
    const agora = new Date().toISOString().replace(/[:.]/g, "-");
    fin.salvarJSON(path.join(pasta, "antes-de-apagar-" + agora + ".json"),
      fin.montarBackup(dados, config.regras, config.perfis, orcamentos, recorrentes, saldos));
    fin.salvarDados(pasta, []);
    fin.salvarSaldos(pasta, {});
    return { quantidade: quantas };
  }));

  ipcMain.handle("analisar-csv", seguro(async () => {
    if (process.env.BLENDERCASH_FOTO && process.env.BLENDERCASH_EXEMPLO) {
      return { caminho: process.env.BLENDERCASH_EXEMPLO, ...fin.analisarCSV(process.env.BLENDERCASH_EXEMPLO) };
    }
    const resposta = await dialog.showOpenDialog(janela, {
      title: "Escolha um extrato CSV desse banco (de exemplo)",
      filters: [{ name: "Extrato CSV", extensions: ["csv", "txt"] }],
      properties: ["openFile"],
    });
    if (resposta.canceled || resposta.filePaths.length === 0) return { cancelado: true };
    const caminho = resposta.filePaths[0];
    return { caminho: caminho, ...fin.analisarCSV(caminho) };
  }));

  ipcMain.handle("testar-perfil", seguro((formulario, caminho) => {
    recarregar();
    const perfil = fin.montarPerfil(formulario, config.perfis);
    const lido = fin.lerExtrato(caminho, perfil, config.regras);
    return {
      lidas: lido.transacoes.length,
      erros: lido.erros.slice(0, 3),
      exemplos: lido.transacoes.slice(0, 3).map((t) => ({ data: t.data, descricao: t.descricao, valor: t.valor })),
    };
  }));

  ipcMain.handle("adicionar-perfil", seguro((formulario, caminho) => {
    recarregar();
    const perfil = fin.montarPerfil(formulario, config.perfis);
    if (caminho) {
      const lido = fin.lerExtrato(caminho, perfil, config.regras);
      if (lido.transacoes.length === 0) {
        throw new Error("Com essas colunas, nenhuma linha do exemplo foi lida" + (lido.erros[0] ? " (" + lido.erros[0] + ")" : "") + ". Confira as escolhas.");
      }
    }
    fin.salvarJSON(path.join(pasta, "perfis_bancos.json"), [...config.perfis, perfil]);

    const caminhoRemovidos = path.join(pasta, "perfis_removidos.json");
    if (fs.existsSync(caminhoRemovidos)) {
      const removidos = fin.lerJSON(caminhoRemovidos).filter((n) => n !== perfil.nome);
      fin.salvarJSON(caminhoRemovidos, removidos);
    }
    return { nome: perfil.nome };
  }));

  ipcMain.handle("abrir-pasta", () => shell.openPath(pasta));
}

function criarJanela() {
  janela = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 900,
    minHeight: 640,
    title: "Blendercash",
    icon: ICONE,
    backgroundColor: "#0b0c10",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const carregando = janela.loadFile(path.join(__dirname, "renderer", "index.html"));

  if (process.env.BLENDERCASH_FOTO) {
    janela.webContents.on("console-message", (evento) => console.log("[tela]", evento.message));
    setTimeout(() => app.exit(1), 25000);
    carregando.then(async () => {
      await new Promise((pronto) => setTimeout(pronto, 1500));
      if (process.env.BLENDERCASH_ROTEIRO) {
        const resultado = await janela.webContents.executeJavaScript(fs.readFileSync(process.env.BLENDERCASH_ROTEIRO, "utf-8"));
        console.log("[roteiro]", JSON.stringify(resultado));
        await new Promise((pronto) => setTimeout(pronto, 900));
      }
      const imagem = await janela.webContents.capturePage();
      fs.writeFileSync(process.env.BLENDERCASH_FOTO, imagem.toPNG());
      console.log("foto salva");
      app.exit(0);
    });
  }
}

app.setAppUserModelId("com.vitor.blendercash");

app.whenReady().then(() => {
  prepararPasta();
  trancado = fin.senhaAtiva(pasta);
  if (!trancado) {
    mesclarPerfisPadrao();
    recarregar();
  }
  registrarPedidos();
  criarJanela();
  if (!trancado) ligarLembretes();
});

app.on("window-all-closed", () => app.quit());
