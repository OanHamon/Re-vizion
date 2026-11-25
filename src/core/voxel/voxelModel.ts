// Modèle voxel et format .vox (MagicaVoxel).
// Ce fichier n'importe rien : il est aussi lancé tel quel par Node dans scripts/voxels/.
//
// Repère du jeu : x = longueur (vers la bouche du canon), y = haut, z = profondeur.
// Repère MagicaVoxel : z = haut. Conversion sans effet miroir :
//   jeu (x, y, z)  <->  vox (x, sz - 1 - z, y)

export interface VoxelModel {
  readonly sx: number;
  readonly sy: number;
  readonly sz: number;
  /** 0 = vide, sinon index de palette 1..255. Index = x + sx * (y + sy * z). */
  readonly data: Uint8Array;
  /** 256 couleurs 0xRRGGBB ; l'entrée 0 n'est pas utilisée. */
  readonly palette: Uint32Array;
}

export const VOX_MAX_SIZE = 256;

export function createVoxelModel(sx: number, sy: number, sz: number): VoxelModel {
  for (const [axis, n] of [['x', sx], ['y', sy], ['z', sz]] as const) {
    if (!Number.isInteger(n) || n < 1 || n > VOX_MAX_SIZE) throw new Error(`Taille ${axis} invalide : ${n} (1 à ${VOX_MAX_SIZE})`);
  }
  return { sx, sy, sz, data: new Uint8Array(sx * sy * sz), palette: new Uint32Array(256) };
}

export function inBounds(m: VoxelModel, x: number, y: number, z: number): boolean {
  return x >= 0 && y >= 0 && z >= 0 && x < m.sx && y < m.sy && z < m.sz;
}

/** Index de palette du voxel (0 si vide ou hors du modèle). */
export function getVoxel(m: VoxelModel, x: number, y: number, z: number): number {
  return inBounds(m, x, y, z) ? (m.data[x + m.sx * (y + m.sy * z)] ?? 0) : 0;
}

export function setVoxel(m: VoxelModel, x: number, y: number, z: number, colorIndex: number): void {
  if (inBounds(m, x, y, z)) m.data[x + m.sx * (y + m.sy * z)] = colorIndex;
}

export function countVoxels(m: VoxelModel): number {
  let n = 0;
  for (const v of m.data) if (v !== 0) n++;
  return n;
}

// ---------- écriture ----------

export function writeVox(m: VoxelModel): Uint8Array {
  const voxels: number[] = [];
  for (let z = 0; z < m.sz; z++) {
    for (let y = 0; y < m.sy; y++) {
      for (let x = 0; x < m.sx; x++) {
        const c = getVoxel(m, x, y, z);
        if (c !== 0) voxels.push(x, m.sz - 1 - z, y, c);
      }
    }
  }
  const sizeContent = 12;
  const xyziContent = 4 + voxels.length;
  const rgbaContent = 256 * 4;
  const children = 12 + sizeContent + 12 + xyziContent + 12 + rgbaContent;
  const buffer = new ArrayBuffer(8 + 12 + children);
  const view = new DataView(buffer);
  let o = 0;
  const id = (s: string) => {
    for (let i = 0; i < 4; i++) view.setUint8(o++, s.charCodeAt(i));
  };
  const u32 = (n: number) => {
    view.setUint32(o, n, true);
    o += 4;
  };
  const u8 = (n: number) => view.setUint8(o++, n);

  id('VOX ');
  u32(150);
  id('MAIN');
  u32(0);
  u32(children);

  id('SIZE');
  u32(sizeContent);
  u32(0);
  u32(m.sx);
  u32(m.sz); // vox y = profondeur
  u32(m.sy); // vox z = haut

  id('XYZI');
  u32(xyziContent);
  u32(0);
  u32(voxels.length / 4);
  for (const b of voxels) u8(b);

  id('RGBA');
  u32(rgbaContent);
  u32(0);
  // l'entrée k du chunk RGBA est la couleur de l'index k + 1
  for (let k = 0; k < 256; k++) {
    const rgb = m.palette[k + 1] ?? 0;
    u8((rgb >> 16) & 0xff);
    u8((rgb >> 8) & 0xff);
    u8(rgb & 0xff);
    u8(k + 1 < 256 ? 255 : 0);
  }
  return new Uint8Array(buffer);
}

// ---------- lecture ----------

export function readVox(input: ArrayBuffer | Uint8Array): VoxelModel {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (at: number) => String.fromCharCode(bytes[at]!, bytes[at + 1]!, bytes[at + 2]!, bytes[at + 3]!);

  if (bytes.byteLength < 20 || tag(0) !== 'VOX ') throw new Error('Fichier .vox invalide : en-tête « VOX » absent');
  if (tag(8) !== 'MAIN') throw new Error('Fichier .vox invalide : chunk MAIN absent');

  let size: [number, number, number] | null = null;
  let xyzi: { at: number; count: number } | null = null;
  let rgbaAt = -1;

  const mainContent = view.getUint32(12, true);
  let o = 20 + mainContent;
  while (o + 12 <= bytes.byteLength) {
    const chunk = tag(o);
    const content = view.getUint32(o + 4, true);
    const body = o + 12;
    // Un seul modèle par fichier : on garde le premier SIZE et le premier XYZI.
    if (chunk === 'SIZE' && !size) size = [view.getUint32(body, true), view.getUint32(body + 4, true), view.getUint32(body + 8, true)];
    else if (chunk === 'XYZI' && !xyzi) xyzi = { at: body + 4, count: view.getUint32(body, true) };
    else if (chunk === 'RGBA') rgbaAt = body;
    o = body + content + view.getUint32(o + 8, true);
  }
  if (!size || !xyzi) throw new Error('Fichier .vox invalide : chunk SIZE ou XYZI absent');

  const [vx, vy, vz] = size;
  const m = createVoxelModel(vx, vz, vy);
  for (let i = 0; i < xyzi.count; i++) {
    const p = xyzi.at + i * 4;
    const x = bytes[p]!;
    const depth = bytes[p + 1]!;
    const up = bytes[p + 2]!;
    setVoxel(m, x, up, m.sz - 1 - depth, bytes[p + 3]!);
  }
  for (let i = 1; i < 256; i++) {
    if (rgbaAt >= 0) {
      const p = rgbaAt + (i - 1) * 4;
      m.palette[i] = (bytes[p]! << 16) | (bytes[p + 1]! << 8) | bytes[p + 2]!;
    } else {
      m.palette[i] = 0x9a9a9a; // pas de palette dans le fichier : gris neutre
    }
  }
  return m;
}
