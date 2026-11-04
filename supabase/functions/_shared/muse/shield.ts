// Privacy shield for scene photos: SAM 3.1 finds faces and number plates and
// we pixelate every box before the photo is stored or shown to anyone.
// Built during the Meta Global AI Developer Hackathon (Oct 26 to Nov 4, 2026).
//
// Fail closed: if segmentation is unavailable the photo is not shared at all.

import { Image } from "imagescript";
import type { Box } from "./client.ts";

export const MAX_SIDE = 1280;

export async function decodeAndFit(bytes: Uint8Array): Promise<Image> {
  const decoded = await Image.decode(bytes);
  if (!(decoded instanceof Image)) throw new Error("not a still image");
  const img = decoded;
  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  if (scale < 1) img.resize(Math.round(img.width * scale), Math.round(img.height * scale));
  return img;
}

/** Pixelates each box (scaled from SAM's w/h to the image), padded by 20%. */
export function pixelate(img: Image, boxes: Box[]): number {
  let applied = 0;
  for (const b of boxes) {
    const sx = img.width / (b.w || img.width);
    const sy = img.height / (b.h || img.height);
    const bw = (b.x2 - b.x1 + 1) * sx;
    const bh = (b.y2 - b.y1 + 1) * sy;
    const x1 = Math.max(0, Math.floor(b.x1 * sx - bw * 0.2));
    const y1 = Math.max(0, Math.floor(b.y1 * sy - bh * 0.2));
    const x2 = Math.min(img.width - 1, Math.ceil(b.x2 * sx + bw * 0.2));
    const y2 = Math.min(img.height - 1, Math.ceil(b.y2 * sy + bh * 0.2));
    if (x2 <= x1 || y2 <= y1) continue;
    // Big blocks: at most ~6 across the box, so nothing identifiable survives.
    const block = Math.max(8, Math.ceil(Math.max(x2 - x1, y2 - y1) / 6));
    for (let by = y1; by <= y2; by += block) {
      for (let bx = x1; bx <= x2; bx += block) {
        const ex = Math.min(x2, bx + block - 1);
        const ey = Math.min(y2, by + block - 1);
        let r = 0, g = 0, bl = 0, n = 0;
        for (let y = by; y <= ey; y++) {
          for (let x = bx; x <= ex; x++) {
            const [pr, pg, pb] = Image.colorToRGBA(img.getPixelAt(x + 1, y + 1));
            r += pr;
            g += pg;
            bl += pb;
            n++;
          }
        }
        const color = Image.rgbaToColor(Math.round(r / n), Math.round(g / n), Math.round(bl / n), 255);
        for (let y = by; y <= ey; y++) for (let x = bx; x <= ex; x++) img.setPixelAt(x + 1, y + 1, color);
      }
    }
    applied++;
  }
  return applied;
}

export function toBase64(bytes: Uint8Array): string {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(s);
}

export function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const clean = b64.replace(/^data:[^;]+;base64,/, "");
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
