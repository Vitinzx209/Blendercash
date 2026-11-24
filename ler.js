const path = require("path");
const fin = require("./src/financeiro");

const PASTA_CONFIG = path.join(__dirname, "config");
const PASTA_DADOS = __dirname;
const MES = 11;
const ANO = 2026;

const IMPORTACOES = [];

function mostrarTabela(lista) {
  for (const t of lista) {
    const data = t.data.dia + "/" + t.data.mes + "/" + t.data.ano;
    console.log(
      data.padEnd(12),
      t.banco.padEnd(9),
      t.descricao.padEnd(24),
      t.categoria.padEnd(16),
      fin.formatarDinheiro(t.valor)
    );
  }

  console.log(lista.length, "transações no total");
}

function mostrarRelatorios(lista, mes, ano) {
  const doMes = fin.transacoesDoMes(lista, mes, ano);
  const resumo = fin.resumoMensal(doMes);

  console.log("");
  console.log("===== Resumo de " + mes + "/" + ano + " =====");
  console.log("Entradas:".padEnd(12), fin.formatarDinheiro(resumo.entradas));
  console.log("Saídas:".padEnd(12), fin.formatarDinheiro(resumo.saidas));
  console.log("Saldo:".padEnd(12), fin.formatarDinheiro(resumo.saldo));

  console.log("");
  console.log("===== Gastos por categoria =====");
  for (const item of fin.gastosPorCategoria(doMes)) {
    console.log(item[0].padEnd(16), fin.formatarDinheiro(item[1]));
  }
}

const config = fin.carregarConfig(PASTA_CONFIG);
const dados = fin.carregarDados(PASTA_DADOS, config.regras);

for (const importacao of IMPORTACOES) {
  const arquivo = path.join(__dirname, importacao.arquivo);
  const perfil = fin.acharPerfil(config.perfis, importacao.perfil);
  const r = fin.importarExtrato(dados, arquivo, perfil, config.regras);

  console.log(importacao.arquivo + " (" + perfil.nome + "): " + r.adicionadas + " importadas, " + r.duplicadas + " ignoradas");
  for (const e of r.erros) {
    console.log("   ⚠ " + e);
  }
}

fin.salvarDados(PASTA_DADOS, dados);

console.log("");
mostrarTabela(dados);
mostrarRelatorios(dados, MES, ANO);
