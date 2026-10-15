/**
 * scripts/make-icons.js
 * Gera build/icon.ico (multi-resolução) e icon.png a partir de um SVG,
 * desenhando no Chromium e empacotando os PNGs num container ICO.
 *
 * Uso: npx electron scripts/make-icons.js
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'build');
const SIZES = [16, 24, 32, 48, 64, 128, 256];

/** Mesma paleta do app (index.html). */
const BG = '#1a1a2e';
const PANEL = '#16213e';
const ACCENT = '#e94560';
const STRING = '#f2f5fb';

// Um "palmilha" (palm pick) de violão com as cordas: reconhecível a 16px
// porque é uma silhueta cheia, sem detalhe fino.
const SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect x="0" y="0" width="512" height="512" rx="112" fill="${BG}"/>
  <rect x="14" y="14" width="484" height="484" rx="100" fill="${PANEL}"/>
  <g transform="translate(256 268)">
    <!-- corpo da palmilha -->
    <path d="M0 -168
             C 88 -168 172 -74 172 30
             C 172 118 96 176 0 176
             C -96 176 -172 118 -172 30
             C -172 -74 -88 -168 0 -168 Z"
          fill="${ACCENT}"/>
    <!-- cordas -->
    <g stroke="${STRING}" stroke-width="17" stroke-linecap="round" opacity="0.92">
      <line x1="-104" y1="-42" x2="104" y2="-42"/>
      <line x1="-116" y1="12"  x2="116" y2="12"/>
      <line x1="-96"  y1="66"  x2="96"  y2="66"/>
    </g>
  </g>
</svg>`;

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const win = new BrowserWindow({
    width: 512, height: 512, show: false, frame: false,
    transparent: true, backgroundColor: '#00000000'
  });

  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(
    `<!doctype html><meta charset="utf-8">
     <style>html,body{margin:0;padding:0;background:transparent}svg{display:block}</style>
     ${SVG}`
  ));
  await new Promise((r) => setTimeout(r, 400));

  const pngs = await win.webContents.executeJavaScript(`(async () => {
    try {
      const svg = document.querySelector('svg');
      // SVG sem width/height é desenhado em 0x0 num canvas; fixa o tamanho.
      svg.setAttribute('width', '512');
      svg.setAttribute('height', '512');
      // drawImage() não aceita um <svg> inline: serializa e carrega como imagem.
      const url = 'data:image/svg+xml;base64,' + btoa(
        unescape(encodeURIComponent(new XMLSerializer().serializeToString(svg)))
      );
      const img = new Image();
      await new Promise((ok, fail) => {
        img.onload = ok;
        img.onerror = () => fail(new Error('falha ao decodificar o SVG'));
        img.src = url;
      });

      const master = document.createElement('canvas');
      master.width = master.height = 512;
      master.getContext('2d').drawImage(img, 0, 0, 512, 512);

      const out = {};
      for (const s of ${JSON.stringify(SIZES)}) {
        const c = document.createElement('canvas');
        c.width = c.height = s;
        const ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(master, 0, 0, s, s);
        out[s] = c.toDataURL('image/png').split(',')[1];
      }
      return JSON.stringify({ out });
    } catch (e) {
      return JSON.stringify({ erro: String(e && e.stack || e) });
    }
  })()`, true);

const base = JSON.parse(pngs);
  if (base.erro) {
    console.error('ERRO NO RENDERER:', base.erro);
    app.exit(1);
    return;
  }
  if (!base.out || !base.out[16]) {
    console.error('Renderer nao devolveu PNGs:', pngs.slice(0, 300));
    app.exit(1);
    return;
  }

  // ── Container ICO: cabeçalho + diretório + PNGs (Vista+ aceita PNG embutido)
  const images = SIZES.map((s) => Buffer.from(base.out[s], 'base64'));
  const header = Buffer.alloc(6 + SIZES.length * 16);
  header.writeUInt16LE(0, 0);           // reservado
  header.writeUInt16LE(1, 2);           // tipo: ícone
  header.writeUInt16LE(SIZES.length, 4);

  let offset = header.length;
  SIZES.forEach((s, i) => {
    const e = 6 + i * 16;
    header.writeUInt8(s >= 256 ? 0 : s, e);      // 0 = 256
    header.writeUInt8(s >= 256 ? 0 : s, e + 1);
    header.writeUInt8(0, e + 2);                  // paleta: sem cor especial
    header.writeUInt8(0, e + 3);                  // reservado
    header.writeUInt16LE(1, e + 4);               // planos
    header.writeUInt16LE(32, e + 6);              // bits por pixel
    header.writeUInt32LE(images[i].length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += images[i].length;
  });

  const ico = Buffer.concat([header, ...images]);
  fs.writeFileSync(path.join(OUT_DIR, 'icon.ico'), ico);

  // Ícone grande para o BrowserWindow e para Linux/macOS.
  fs.writeFileSync(path.join(ROOT, 'icon.png'), images[images.length - 1]);
  // 512 para o macOS (o .ico não chega nele).
  fs.writeFileSync(path.join(OUT_DIR, 'icon.png'), images[images.length - 1]);

  console.log(`build/icon.ico  ${ico.length} bytes (${SIZES.join(', ')} px)`);
  console.log(`icon.png        ${images[images.length - 1].length} bytes (512 px)`);
  app.exit(0);
}).catch((e) => { console.error(e); app.exit(1); });