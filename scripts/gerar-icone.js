const { app, BrowserWindow, nativeImage } = require("electron");
const fs = require("fs");
const path = require("path");

const PASTA = path.join(__dirname, "..", "build");
const TAMANHO = 256;

const SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="${TAMANHO}" height="${TAMANHO}" viewBox="0 0 256 256">
  <rect x="8" y="8" width="240" height="240" rx="56" fill="#7cf5d2"/>
  <g fill="none" stroke="#04221a" stroke-width="24" stroke-linecap="round" stroke-linejoin="round">
    <path d="M128 36v184"/>
    <path d="M172 76H110a30 30 0 0 0 0 60h36a30 30 0 0 1 0 60H80"/>
  </g>
</svg>`;

function montarICO(pngs) {
  const cabecalho = Buffer.alloc(6);
  cabecalho.writeUInt16LE(0, 0);
  cabecalho.writeUInt16LE(1, 2);
  cabecalho.writeUInt16LE(pngs.length, 4);

  const entradas = [];
  let posicao = 6 + 16 * pngs.length;
  for (const { tamanho, dados } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(tamanho >= 256 ? 0 : tamanho, 0);
    e.writeUInt8(tamanho >= 256 ? 0 : tamanho, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(dados.length, 8);
    e.writeUInt32LE(posicao, 12);
    posicao += dados.length;
    entradas.push(e);
  }
  return Buffer.concat([cabecalho, ...entradas, ...pngs.map((p) => p.dados)]);
}

app.whenReady().then(async () => {
  const janela = new BrowserWindow({
    width: TAMANHO, height: TAMANHO, show: false, frame: false, transparent: true,
    backgroundColor: "#00000000", webPreferences: { offscreen: true, javascript: false },
  });
  const html = '<html><body style="margin:0;background:transparent">' + SVG + "</body></html>";
  await janela.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  await new Promise((r) => setTimeout(r, 400));

  const grande = await janela.webContents.capturePage({ x: 0, y: 0, width: TAMANHO, height: TAMANHO });
  const base = nativeImage.createFromBuffer(grande.toPNG()).resize({ width: TAMANHO, height: TAMANHO, quality: "best" });

  fs.mkdirSync(PASTA, { recursive: true });
  fs.writeFileSync(path.join(PASTA, "icone.png"), base.toPNG());

  const pngs = [16, 24, 32, 48, 64, 128, 256].map((t) => ({
    tamanho: t,
    dados: t === TAMANHO ? base.toPNG() : base.resize({ width: t, height: t, quality: "best" }).toPNG(),
  }));
  fs.writeFileSync(path.join(PASTA, "icone.ico"), montarICO(pngs));

  console.log("Ícone gerado em build/icone.png e build/icone.ico");
  app.exit(0);
});
