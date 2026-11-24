const crypto = require("crypto");

const MARCA = "blendercash-cofre";
const TEXTO_DE_TESTE = "blendercash: senha certa";

let chave = null;

function derivarChave(senha, salHex) {
  return crypto.scryptSync(String(senha), Buffer.from(salHex, "hex"), 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

function novoSal() {
  return crypto.randomBytes(16).toString("hex");
}

function definirChave(novaChave) { chave = novaChave; }
function esquecerChave() { chave = null; }
function temChave() { return chave !== null; }

function trancar(texto, chaveUsada) {
  const k = chaveUsada || chave;
  const iv = crypto.randomBytes(12);
  const cifra = crypto.createCipheriv("aes-256-gcm", k, iv);
  const dados = Buffer.concat([cifra.update(String(texto), "utf-8"), cifra.final()]);
  return { [MARCA]: 1, iv: iv.toString("base64"), etiqueta: cifra.getAuthTag().toString("base64"), dados: dados.toString("base64") };
}

function destrancar(envelope, chaveUsada) {
  const k = chaveUsada || chave;
  if (!k) throw new Error("Os dados estão protegidos por senha e o app está trancado.");
  const decifra = crypto.createDecipheriv("aes-256-gcm", k, Buffer.from(envelope.iv, "base64"));
  decifra.setAuthTag(Buffer.from(envelope.etiqueta, "base64"));
  return Buffer.concat([decifra.update(Buffer.from(envelope.dados, "base64")), decifra.final()]).toString("utf-8");
}

function estaTrancado(objeto) {
  return objeto !== null && typeof objeto === "object" && objeto[MARCA] === 1;
}

function criarVerificador(chaveUsada) {
  return trancar(TEXTO_DE_TESTE, chaveUsada);
}

function senhaConfere(verificador, chaveUsada) {
  try {
    return destrancar(verificador, chaveUsada) === TEXTO_DE_TESTE;
  } catch (erro) {
    return false;
  }
}

module.exports = { derivarChave, novoSal, definirChave, esquecerChave, temChave, trancar, destrancar, estaTrancado, criarVerificador, senhaConfere };
