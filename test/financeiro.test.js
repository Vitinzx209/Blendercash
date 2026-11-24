const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const fin = require("../src/financeiro");

function arquivoTemporario(nome, conteudo, codificacao) {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "blendercash-teste-"));
  const caminho = path.join(pasta, nome);
  fs.writeFileSync(caminho, conteudo, codificacao || "utf-8");
  return caminho;
}

const PERFIL_CONTA = {
  nome: "Banco Teste", tipo: "conta", separador: ";", codificacao: "utf-8", linhasCabecalho: 1,
  formatoData: "DD/MM/AAAA", separadorDecimal: ",", colunaData: 0, colunaDescricao: 1,
  modoValor: "unica", colunaValor: 2, inverterSinal: false,
};
const PERFIL_CARTAO = { ...PERFIL_CONTA, nome: "Cartão Teste", tipo: "cartao", diaFechamento: 5, inverterSinal: true };

describe("converterValor: texto do banco → centavos", () => {
  const casos = [
    ["R$ 1.234,56", ",", 123456],
    ["-R$ 25,90", ",", -2590],
    ["(50,00)", ",", -5000],
    ["50,00-", ",", -5000],
    ["50,00D", ",", -5000],
    ["50,00C", ",", 5000],
    ["10,5", ",", 1050],
    ["1,234.56", ".", 123456],
    ["-8.50", ".", -850],
    ["0,01", ",", 1],
    ["1.000.000,00", ",", 100000000],
  ];
  for (const [texto, sep, esperado] of casos) {
    test(texto + " → " + esperado, () => assert.equal(fin.converterValor(texto, sep), esperado));
  }

  test("não perde centavo com arredondamento de float (0,29 e 1,15)", () => {
    assert.equal(fin.converterValor("0,29", ","), 29);
    assert.equal(fin.converterValor("1,15", ","), 115);
    assert.equal(fin.converterValor("4.35", "."), 435);
  });

  test("recusa texto que não é número", () => {
    assert.throws(() => fin.converterValor("abc", ","), /Valor inválido/);
    assert.throws(() => fin.converterValor("", ","), /Valor inválido/);
  });
});

describe("converterData", () => {
  test("DD/MM/AAAA", () => assert.deepEqual(fin.converterData("03/11/2026", "DD/MM/AAAA"), { dia: 3, mes: 11, ano: 2026 }));
  test("AAAA-MM-DD", () => assert.deepEqual(fin.converterData("2026-11-03", "AAAA-MM-DD"), { dia: 3, mes: 11, ano: 2026 }));
  test("aceita 29/02 em ano bissexto", () => assert.deepEqual(fin.converterData("29/02/2028", "DD/MM/AAAA"), { dia: 29, mes: 2, ano: 2028 }));

  test("recusa datas impossíveis", () => {
    assert.throws(() => fin.converterData("32/01/2026", "DD/MM/AAAA"), /Data inválida/);
    assert.throws(() => fin.converterData("10/13/2026", "DD/MM/AAAA"), /Data inválida/);
    assert.throws(() => fin.converterData("31/04/2026", "DD/MM/AAAA"), /Data inválida/);
    assert.throws(() => fin.converterData("29/02/2026", "DD/MM/AAAA"), /Data inválida/);
    assert.throws(() => fin.converterData("texto", "DD/MM/AAAA"), /Data inválida/);
  });

  test("recusa formato desconhecido", () => {
    assert.throws(() => fin.converterData("03/11/2026", "MM/DD/AAAA"), /Formato de data desconhecido/);
  });
});

describe("faturaDaCompra (fechamento no dia 5)", () => {
  test("compra antes do fechamento cai na fatura deste mês", () => {
    assert.deepEqual(fin.faturaDaCompra({ dia: 3, mes: 11, ano: 2026 }, 5), { dia: 5, mes: 11, ano: 2026 });
  });
  test("compra NO dia do fechamento já vai pra fatura seguinte", () => {
    assert.deepEqual(fin.faturaDaCompra({ dia: 5, mes: 11, ano: 2026 }, 5), { dia: 5, mes: 12, ano: 2026 });
  });
  test("dezembro vira janeiro do ano seguinte", () => {
    assert.deepEqual(fin.faturaDaCompra({ dia: 20, mes: 12, ano: 2026 }, 5), { dia: 5, mes: 1, ano: 2027 });
  });
  test("fechamento dia 31 em fevereiro cai no último dia do mês", () => {
    assert.deepEqual(fin.faturaDaCompra({ dia: 10, mes: 2, ano: 2026 }, 31), { dia: 28, mes: 2, ano: 2026 });
  });
});

describe("somarMeses", () => {
  test("31/01 + 1 mês = 28/02", () => assert.deepEqual(fin.somarMeses({ dia: 31, mes: 1, ano: 2026 }, 1), { dia: 28, mes: 2, ano: 2026 }));
  test("voltar meses atravessa o ano", () => assert.deepEqual(fin.somarMeses({ dia: 15, mes: 1, ano: 2026 }, -2), { dia: 15, mes: 11, ano: 2025 }));
});

describe("detectarParcela", () => {
  test("'LOJA X 2/6' no final", () => assert.deepEqual(fin.detectarParcela("LOJA X 2/6"), { n: 2, total: 6, base: "LOJA X" }));
  test("'PARC 02/06' no meio", () => assert.deepEqual(fin.detectarParcela("LOJA PARC 02/06 CENTRO"), { n: 2, total: 6, base: "LOJA CENTRO" }));
  test("'PARCELA 3 DE 10'", () => assert.equal(fin.detectarParcela("TV PARCELA 3 DE 10").total, 10));
  test("ignora o que não é parcela", () => {
    assert.equal(fin.detectarParcela("UBER TRIP"), null);
    assert.equal(fin.detectarParcela("LOJA 7/6"), null);
    assert.equal(fin.detectarParcela("LOJA 1/1"), null);
    assert.equal(fin.detectarParcela("LOJA 1/99"), null);
  });
});

describe("dividirLinha", () => {
  test("respeita separador dentro de aspas", () => {
    assert.deepEqual(fin.dividirLinha('"01/11/2026","LOJA, CENTRO","10.00"', ","), ["01/11/2026", "LOJA, CENTRO", "10.00"]);
  });
});

describe("importar extrato CSV", () => {
  const csv = "Data;Descrição;Valor\n01/11/2026;SALARIO;R$ 3.500,00\n03/11/2026;CAFE;-R$ 5,00\n03/11/2026;CAFE;-R$ 5,00\n";

  test("lê as linhas e soma certo", () => {
    const r = fin.lerExtrato(arquivoTemporario("a.csv", csv), PERFIL_CONTA, []);
    assert.equal(r.transacoes.length, 3);
    assert.equal(r.erros.length, 0);
    assert.equal(r.transacoes.reduce((s, t) => s + t.valor, 0), 349000);
  });

  test("dois cafés iguais no mesmo dia são DUAS transações", () => {
    const r = fin.lerExtrato(arquivoTemporario("a.csv", csv), PERFIL_CONTA, []);
    const ids = new Set(r.transacoes.map((t) => t.id));
    assert.equal(ids.size, 3);
  });

  test("importar o mesmo arquivo duas vezes não duplica", () => {
    const caminho = arquivoTemporario("a.csv", csv);
    const dados = [];
    const primeira = fin.importarExtrato(dados, caminho, PERFIL_CONTA, []);
    const segunda = fin.importarExtrato(dados, caminho, PERFIL_CONTA, []);
    assert.equal(primeira.adicionadas, 3);
    assert.equal(segunda.adicionadas, 0);
    assert.equal(segunda.duplicadas, 3);
    assert.equal(dados.length, 3);
  });

  test("linha quebrada vira erro sem derrubar as outras", () => {
    const r = fin.lerExtrato(arquivoTemporario("b.csv", csv + "99/99/2026;X;1,00\n"), PERFIL_CONTA, []);
    assert.equal(r.transacoes.length, 3);
    assert.equal(r.erros.length, 1);
  });

  test("cartão: inverte o sinal, acha parcela e fatura", () => {
    const r = fin.lerExtrato(arquivoTemporario("c.csv", "Data;Lançamento;Valor\n10/11/2026;LOJA DE TENIS 1/6;R$ 150,00\n"), PERFIL_CARTAO, []);
    const t = r.transacoes[0];
    assert.equal(t.valor, -15000);
    assert.equal(t.cartao, true);
    assert.deepEqual(t.parcela, { n: 1, total: 6, base: "LOJA DE TENIS" });
    assert.deepEqual(t.fatura, { dia: 5, mes: 12, ano: 2026 });
  });

  test("débito e crédito em colunas separadas (latin1)", () => {
    const perfil = { ...PERFIL_CONTA, separador: ",", codificacao: "latin1", formatoData: "AAAA-MM-DD", separadorDecimal: ".",
      modoValor: "debitoCredito", colunaDebito: 2, colunaCredito: 3 };
    const conteudo = '"Data","Histórico","Débito","Crédito"\n"2026-11-02","PADARIA SÃO JOÃO","8.50",""\n"2026-11-14","RECEBIDO","","500.00"\n';
    const r = fin.lerExtrato(arquivoTemporario("d.csv", conteudo, "latin1"), perfil, []);
    assert.deepEqual(r.transacoes.map((t) => t.valor), [-850, 50000]);
    assert.equal(r.transacoes[0].descricao, "PADARIA SÃO JOÃO");
  });
});

describe("importar extrato OFX", () => {
  const ofx = "OFXHEADER:100\n<OFX><BANKTRANLIST>" +
    "<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261103120000[-3:BRT]<TRNAMT>-25.90<FITID>abc1<MEMO>UBER TRIP</STMTTRN>" +
    "<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261105<TRNAMT>100,00<FITID>abc2<MEMO>PIX RECEBIDO</STMTTRN>" +
    "</BANKTRANLIST></OFX>";

  test("lê valores com ponto e com vírgula, usando o FITID como id", () => {
    const r = fin.lerExtrato(arquivoTemporario("e.ofx", ofx), PERFIL_CONTA, []);
    assert.deepEqual(r.transacoes.map((t) => t.valor), [-2590, 10000]);
    assert.equal(r.transacoes[0].id, "Banco Teste|ofx|abc1");
    assert.deepEqual(r.transacoes[0].data, { dia: 3, mes: 11, ano: 2026 });
  });
});

describe("categorizar", () => {
  test("as regras do usuário ganham do dicionário automático", () => {
    assert.equal(fin.categorizar("UBER TRIP", [{ palavra: "UBER", categoria: "Trabalho" }]), "Trabalho");
  });
  test("dicionário automático acha palavra inteira", () => {
    assert.equal(fin.categorizar("BAR DO ZE", []), "Alimentação");
  });
  test("…mas não pedaço de palavra", () => {
    assert.equal(fin.categorizar("JOSE BARBOSA", []), "Sem categoria");
  });
});

describe("Adicionar banco: analisarCSV e montarPerfil", () => {
  test("descobre o formato de um CSV com ponto-e-vírgula e vírgula decimal", () => {
    const a = fin.analisarCSV(arquivoTemporario("f.csv", "Data;Descrição;Valor\n01/11/2026;SALARIO;R$ 3.500,00\n03/11/2026;UBER;-R$ 25,90\n"));
    assert.equal(a.separador, ";");
    assert.equal(a.linhasCabecalho, 1);
    assert.equal(a.palpite.formatoData, "DD/MM/AAAA");
    assert.equal(a.palpite.separadorDecimal, ",");
    assert.equal(a.palpite.colunaValor, 2);
  });

  test("pula as linhas de cabeçalho extras (como as do Inter)", () => {
    const conteudo = "Extrato Conta Corrente\nConta;123\nPeríodo;01/11 a 30/11\n\nSaldo;1.000,00\nData Lançamento;Histórico;Descrição;Valor\n" +
      "01/11/2026;Pix enviado;Cafe;-5,00\n";
    const caminho = arquivoTemporario("g.csv", conteudo);
    const a = fin.analisarCSV(caminho);
    const perfil = fin.montarPerfil({ nome: "X", separador: a.separador, linhasCabecalho: a.linhasCabecalho,
      colunaData: 0, colunaDescricao: [1, 2], colunaValor: 3 }, []);
    const r = fin.lerExtrato(caminho, perfil, []);
    assert.equal(r.erros.length, 0);
    assert.equal(r.transacoes[0].descricao, "PIX ENVIADO · CAFE");
  });

  test("percebe arquivo em latin1", () => {
    const a = fin.analisarCSV(arquivoTemporario("h.csv", "Data,Histórico,Valor\n2026-11-02,PÃO,8.50\n", "latin1"));
    assert.equal(a.codificacao, "latin1");
    assert.equal(a.palpite.formatoData, "AAAA-MM-DD");
    assert.equal(a.palpite.separadorDecimal, ".");
  });

  test("recusa nome vazio, repetido, 'Dinheiro' e fechamento fora de 1..31", () => {
    const existentes = [{ nome: "Nubank" }];
    assert.throws(() => fin.montarPerfil({ nome: " ", colunaDescricao: 1 }, existentes), /nome/);
    assert.throws(() => fin.montarPerfil({ nome: "nubank", colunaDescricao: 1 }, existentes), /Já existe/);
    assert.throws(() => fin.montarPerfil({ nome: "Dinheiro", colunaDescricao: 1 }, existentes), /Dinheiro/);
    assert.throws(() => fin.montarPerfil({ nome: "C", tipo: "cartao", diaFechamento: 0, colunaDescricao: 1 }, existentes), /fechamento/);
  });
});
