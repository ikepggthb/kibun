/**
 * Every photo is cropped by the image CDN to the same 4:5 frame and served in
 * whatever format the browser accepts best (AVIF/WebP). The browser picks one
 * width from `srcset`, so a thumbnail never downloads the full photo.
 *
 * Widths are capped well below what a 3× phone screen could take: past about
 * 2× a photo gets visibly no sharper, only two or three times heavier.
 */
import type { Dish } from './dishes.ts';

const BASE = 'https://images.unsplash.com/';
const WIDTHS = [240, 320, 480, 640, 800, 1080] as const;
/** Largest width offered by default: 800 on phones, 1080 on wide screens. */
const CAP = () => (matchMedia('(min-width: 900px)').matches ? 1080 : 800);

export function src(photo: string, w: number): string {
  const h = Math.round(w * 1.25);
  return `${BASE}${photo}?auto=format&fit=crop&crop=entropy&w=${w}&h=${h}&q=${w >= 640 ? 50 : 60}`;
}

export function srcset(photo: string, max: number): string {
  return WIDTHS.filter((w) => w <= max).map((w) => `${src(photo, w)} ${w}w`).join(', ');
}

export interface PhotoOptions {
  sizes: string;
  /** Largest width worth offering for this slot. */
  max?: number;
  priority?: 'high' | 'low' | 'auto';
  lazy?: boolean;
}

/**
 * A <figure> painted in the dish's tone, with its name set large underneath
 * the image. If there is no photo, or it fails, the name is what you see.
 */
export function figure(dish: Dish, opts: PhotoOptions): HTMLElement {
  const fig = document.createElement('figure');
  fig.className = 'photo';
  fig.style.backgroundColor = dish.tone;
  fig.style.setProperty('--chars', String([...dish.name].length));
  const plate = document.createElement('span');
  plate.className = 'plate';
  plate.setAttribute('aria-hidden', 'true');
  plate.textContent = dish.name;
  fig.append(plate);

  if (dish.photo) {
    const img = new Image();
    img.alt = dish.name;
    img.decoding = 'async';
    img.draggable = false; // a native image drag would cancel the swipe
    img.loading = opts.lazy ? 'lazy' : 'eager';
    img.fetchPriority = opts.priority ?? 'auto';
    img.sizes = opts.sizes;
    const max = Math.min(opts.max ?? Infinity, CAP());
    img.srcset = srcset(dish.photo, max);
    img.src = src(dish.photo, Math.min(640, max));
    const shown = () => fig.classList.add('loaded');
    if (img.complete && img.naturalWidth) shown();
    else {
      img.addEventListener('load', shown, { once: true });
      img.addEventListener('error', () => img.remove(), { once: true });
    }
    fig.append(img);
  }
  return fig;
}
