// Tekstur kanvas prosedural untuk kit CC0 (lantai kayu herringbone, karpet bermotif, ubin, bata, papan tanda).
import * as THREE from 'three';

const cache = new Map<string, THREE.Texture>();

function canvasTex(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat = 1) {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  cache.set(key, t);
  return t;
}

const shade = (hex: string, k: number) => {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, k);
  return `#${c.getHexString()}`;
};
let seed = 1;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

/** Kayu herringbone (reception, meeting, koridor). Satu tekstur = satu ubin 2.5 m. */
export function herringbone(base: string) {
  return canvasTex(`hb${base}`, 512, 512, (g) => {
    g.fillStyle = shade(base, -0.06); g.fillRect(0, 0, 512, 512);
    seed = 7;
    const L = 128, W = 32;
    for (let row = -4; row < 20; row++) {
      for (let col = -2; col < 10; col++) {
        const x = col * L + row * W, y = row * W - col * 0;
        for (const dir of [0, 1]) {
          g.save();
          g.translate(x + (dir ? W : 0), y + (dir ? 0 : 0));
          g.rotate(dir ? Math.PI / 4 : -Math.PI / 4);
          g.fillStyle = shade(base, (rnd() - 0.5) * 0.08);
          g.fillRect(0, 0, L * 0.7, W * 0.7);
          g.strokeStyle = shade(base, -0.14); g.lineWidth = 2; g.strokeRect(0, 0, L * 0.7, W * 0.7);
          g.restore();
        }
      }
    }
  });
}

/** Papan kayu lurus (lounge, game room). */
export function planks(base: string) {
  return canvasTex(`pl${base}`, 512, 512, (g) => {
    seed = 3;
    const n = 8;
    for (let i = 0; i < n; i++) {
      g.fillStyle = shade(base, (rnd() - 0.5) * 0.07);
      g.fillRect(0, (i * 512) / n, 512, 512 / n);
      g.fillStyle = shade(base, -0.13);
      g.fillRect(0, (i * 512) / n, 512, 2);
      const cut = rnd() * 512;
      g.fillRect(cut, (i * 512) / n, 2, 512 / n);
    }
  });
}

/** Karpet kantor bermotif kotak-kotak (workspace merah bata, ruang manager). */
/** Karpet kantor: serat halus + motif kotak kecil teratur yang samar (seperti karpet di video referensi). */
export function carpet(base: string) {
  return canvasTex(`cp2${base}`, 512, 512, (g) => {
    g.fillStyle = base; g.fillRect(0, 0, 512, 512);
    seed = 11;
    // serat: titik-titik kecil berkontras rendah
    for (let i = 0; i < 6000; i++) { g.fillStyle = shade(base, (rnd() - 0.5) * 0.09); g.fillRect(rnd() * 512, rnd() * 512, 2, 2); }
    // motif: kotak 10 px tiap 32 px, baris berselang digeser setengah
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      g.fillStyle = shade(base, -0.05 - rnd() * 0.03);
      g.fillRect(x * 32 + (y % 2) * 16 + 11, y * 32 + 11, 10, 10);
    }
  });
}

export function tiles(base: string, n = 6) {
  return canvasTex(`tl${base}${n}`, 512, 512, (g) => {
    g.fillStyle = shade(base, -0.12); g.fillRect(0, 0, 512, 512);
    const s = 512 / n;
    seed = 5;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      g.fillStyle = shade(base, (rnd() - 0.5) * 0.04);
      g.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
    }
  });
}

export function brick(base: string) {
  return canvasTex(`br${base}`, 512, 512, (g) => {
    g.fillStyle = shade(base, 0.12); g.fillRect(0, 0, 512, 512);
    seed = 9;
    const bw = 64, bh = 24;
    for (let r = 0; r < 512 / bh; r++) for (let c = -1; c < 512 / bw + 1; c++) {
      g.fillStyle = shade(base, (rnd() - 0.5) * 0.1);
      g.fillRect(c * bw + (r % 2) * (bw / 2) + 2, r * bh + 2, bw - 4, bh - 4);
    }
  });
}

/** Papan nama/tanda: teks putih/hitam di atas warna. */
export function signTexture(text: string, bg: string, fg: string, w = 512, h = 128) {
  return canvasTex(`sg${text}${bg}${fg}${w}`, w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = fg;
    g.font = `800 ${Math.round(h * 0.42)}px Inter, system-ui, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 2, w - 40);
  });
}

/** Layar monitor/TV: kode atau UI kecil. */
export function screenTexture(kind: number) {
  return canvasTex(`scr${kind}`, 256, 160, (g) => {
    g.fillStyle = ['#0f1a2c', '#13213a', '#1a1a24', '#0e2420'][kind % 4]; g.fillRect(0, 0, 256, 160);
    seed = 20 + kind;
    for (let i = 0; i < 14; i++) {
      g.fillStyle = ['#7c9cff', '#22c55e', '#f59e0b', '#e9edf5', '#ec4899'][Math.floor(rnd() * 5)];
      g.globalAlpha = 0.75;
      g.fillRect(12 + (i % 3) * 8, 12 + i * 10, 40 + rnd() * 150, 4);
    }
    g.globalAlpha = 1;
  });
}

/** Grafik di poster/papan presentasi. */
export function chartTexture(title: string) {
  return canvasTex(`ch${title}`, 256, 320, (g) => {
    g.fillStyle = '#f4efe4'; g.fillRect(0, 0, 256, 320);
    g.fillStyle = '#1f2a44'; g.font = '700 26px Inter, sans-serif'; g.fillText(title, 20, 40);
    g.strokeStyle = '#1f2a44'; g.lineWidth = 3; g.beginPath(); g.moveTo(30, 60); g.lineTo(30, 290); g.lineTo(240, 290); g.stroke();
    g.strokeStyle = '#d9473a'; g.lineWidth = 5; g.beginPath();
    [[40, 90], [80, 150], [120, 130], [160, 200], [200, 180], [235, 270]].forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.stroke();
    g.strokeStyle = '#2f5fa8'; g.setLineDash([8, 8]); g.beginPath(); g.moveTo(40, 250); g.lineTo(235, 110); g.stroke();
  });
}

/** Bayangan kontak lembut (hitam → transparan) untuk dasar furnitur & karakter. */
export function blobTexture() {
  return canvasTex('blob', 128, 128, (g) => {
    const r = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    r.addColorStop(0, 'rgba(0,0,0,0.85)');
    r.addColorStop(0.55, 'rgba(0,0,0,0.45)');
    r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  });
}

const loader = new THREE.TextureLoader();
const pbr = new Map<string, THREE.Texture>();
/** Tekstur PBR CC0 (Poly Haven) yang sudah ada di repo: public/assets/textures (LICENSES.md). */
export function pbrTexture(file: string, srgb: boolean) {
  let t = pbr.get(file);
  if (!t) {
    t = loader.load(`/assets/textures/${file}`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    pbr.set(file, t);
  }
  return t;
}

/**
 * Peta warna Poly Haven yang dinetralkan ke abu-abu terang (pola/serat tetap, warna dibuang) supaya bisa diwarnai
 * bebas lewat material.color — kayu/kulit/dinding mengikuti palet office, tapi bertekstur asli.
 */
export function detailTexture(file: string) {
  const key = `detail:${file}`;
  let t = pbr.get(key);
  if (!t) {
    const tex = new THREE.Texture();
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    tex.colorSpace = THREE.SRGBColorSpace;
    new THREE.ImageLoader().load(`/assets/textures/${file}`, (img) => {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const g = c.getContext('2d')!;
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height), px = d.data;
      let sum = 0;
      for (let i = 0; i < px.length; i += 4) sum += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
      const k = 232 / (sum / (px.length / 4) || 1);
      for (let i = 0; i < px.length; i += 4) px[i] = px[i + 1] = px[i + 2] = Math.min(255, (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) * k);
      g.putImageData(d, 0, 0);
      tex.image = c;
      tex.needsUpdate = true;
    });
    pbr.set(key, (t = tex));
  }
  return t;
}
