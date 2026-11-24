const fin = require("./financeiro");

const NOMES_MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function escapar(texto) {
  return String(texto)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const dinheiro = (c) => escapar(fin.formatarDinheiro(c));
const dataCurta = (d) => String(d.dia).padStart(2, "0") + "/" + String(d.mes).padStart(2, "0");

function textoVariacao(atual, anterior, menorEhMelhor, tipo, temDados) {
  if (!temDados) return "";
  const diferenca = atual - anterior;
  if (diferenca === 0) return '<span class="var">igual ao mês anterior</span>';
  const subiu = diferenca > 0;
  const bom = menorEhMelhor ? !subiu : subiu;
  const percentual = anterior > 0 ? Math.round((diferenca / anterior) * 100) : null;
  const usarPercentual = tipo !== "saldo" && percentual !== null && Math.abs(percentual) <= 200;
  const quanto = usarPercentual ? Math.abs(percentual) + "%" : dinheiro(Math.abs(diferenca));
  return '<span class="var ' + (bom ? "bom" : "ruim") + '">' + (subiu ? "▲ " : "▼ ") + quanto + " vs. mês anterior</span>";
}

function htmlFechamento(dados) {
  const titulo = NOMES_MES[dados.mes - 1].replace(/^./, (l) => l.toUpperCase()) + " de " + dados.ano;
  const r = dados.resumo;
  const a = dados.anterior;
  const maior = Math.max(1, ...dados.categorias.map((c) => Math.max(c.gasto, c.teto || 0)));

  const linhasCategorias = dados.categorias.map((c) => {
    const largura = Math.round((c.gasto / maior) * 100);
    const estourou = c.teto && c.gasto > c.teto;
    return "<tr><td>" + escapar(c.nome) + "</td>" +
      '<td class="barra-celula"><div class="trilho"><div class="barra' + (estourou ? " estourou" : "") + '" style="width:' + largura + '%"></div></div></td>' +
      '<td class="num">' + dinheiro(c.gasto) + "</td>" +
      '<td class="num suave">' + (c.teto ? dinheiro(c.teto) + (estourou ? " ⚠" : "") : "—") + "</td></tr>";
  }).join("");

  const linhasTransacoes = dados.transacoes.map((t) => {
    const transf = t.categoria === dados.transferencia;
    return "<tr><td>" + dataCurta(t.data) + "</td><td>" + escapar(t.descricao) + '<div class="suave pequeno">' + escapar(t.banco) + "</div></td>" +
      "<td>" + escapar(t.categoria) + "</td>" +
      '<td class="num ' + (transf ? "suave" : t.valor > 0 ? "pos" : "neg") + '">' + (t.valor > 0 ? "+" : "") + dinheiro(t.valor) + "</td></tr>";
  }).join("");

  const blocoPrevisoes = dados.previsoes.length === 0 ? "" :
    "<h2>Ainda previsto pra este mês</h2><table><tbody>" +
    dados.previsoes.map((p) => "<tr><td>" + dataCurta(p.data) + "</td><td>" + escapar(p.descricao) + '</td><td class="num">' + dinheiro(p.valor) + "</td></tr>").join("") +
    "</tbody></table>";

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Fechamento ${escapar(titulo)}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Segoe UI", system-ui, sans-serif; color: #15171c; font-size: 11pt; font-variant-numeric: tabular-nums; }
  header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #15171c; padding-bottom: 10px; margin-bottom: 18px; }
  .marca { font-size: 10pt; color: #5c6270; letter-spacing: .04em; text-transform: uppercase; }
  h1 { margin: 2px 0 0; font-size: 22pt; letter-spacing: -.02em; }
  h2 { font-size: 13pt; margin: 22px 0 8px; }
  .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .card { border: 1px solid #d9dce3; border-radius: 8px; padding: 10px 12px; }
  .card .rot { font-size: 9pt; color: #5c6270; }
  .card .val { font-size: 15pt; font-weight: 700; margin: 4px 0 2px; }
  .var { font-size: 8.5pt; color: #5c6270; }
  .var.bom { color: #0f7a5c; } .var.ruim { color: #b8501f; }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 6px 4px; border-bottom: 1px solid #eceef2; vertical-align: top; text-align: left; }
  th { font-size: 9pt; color: #5c6270; font-weight: 600; }
  tr { break-inside: avoid; }
  .num { text-align: right; white-space: nowrap; }
  .pos { color: #0f7a5c; } .neg { color: #b8501f; }
  .suave { color: #5c6270; } .pequeno { font-size: 8.5pt; }
  .barra-celula { width: 38%; }
  .trilho { height: 7px; border-radius: 4px; background: #eceef2; margin-top: 6px; }
  .barra { height: 7px; border-radius: 4px; background: #22a884; }
  .barra.estourou { background: #e0703a; }
  .nota { font-size: 8.5pt; color: #5c6270; margin-top: 18px; }
</style></head>
<body>
  <header>
    <div><div class="marca">Blendercash · fechamento do mês</div><h1>${escapar(titulo)}</h1></div>
    <div class="suave pequeno">Gerado em ${escapar(new Date().toLocaleString("pt-BR"))}</div>
  </header>

  <div class="cards">
    <div class="card"><div class="rot">Entradas</div><div class="val pos">${dinheiro(r.entradas)}</div>${textoVariacao(r.entradas, a.entradas, false, "valor", a.temDados)}</div>
    <div class="card"><div class="rot">Saídas</div><div class="val neg">${dinheiro(r.saidas)}</div>${textoVariacao(r.saidas, a.saidas, true, "valor", a.temDados)}</div>
    <div class="card"><div class="rot">Saldo do mês</div><div class="val">${dinheiro(r.saldo)}</div>${textoVariacao(r.saldo, a.saldo, false, "saldo", a.temDados)}</div>
    <div class="card"><div class="rot">Previsto no fim do mês</div><div class="val">${dinheiro(dados.saldoPrevisto)}</div><span class="var">${dados.previsoes.length === 0 ? "nada mais previsto" : dados.previsoes.length + (dados.previsoes.length === 1 ? " conta prevista" : " contas previstas")}</span></div>
  </div>
  ${r.investido > 0 ? '<p class="nota">' + dinheiro(r.investido) + " foram investidos neste mês: não contam como gasto, mas já estão descontados do saldo.</p>" : ""}
  ${r.transferido > 0 ? '<p class="nota">' + dinheiro(r.transferido) + " foram movidos entre as suas próprias contas e não entram nas entradas nem nas saídas.</p>" : ""}

  <h2>Gastos por categoria</h2>
  <table><thead><tr><th>Categoria</th><th></th><th class="num">Gasto</th><th class="num">Teto</th></tr></thead>
  <tbody>${linhasCategorias || '<tr><td colspan="4" class="suave">Nenhum gasto neste mês.</td></tr>'}</tbody></table>

  ${blocoPrevisoes}

  <h2>Todas as transações (${dados.transacoes.length})</h2>
  <table><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th class="num">Valor</th></tr></thead>
  <tbody>${linhasTransacoes || '<tr><td colspan="4" class="suave">Nenhuma transação neste mês.</td></tr>'}</tbody></table>
</body></html>`;
}

module.exports = { htmlFechamento };
