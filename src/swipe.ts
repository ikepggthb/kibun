/**
 * Horizontal swipe on elements inside `root`. Vertical intent is left to the
 * page (scrolling); only a clearly sideways drag is taken over.
 */
export interface SwipeOptions {
  /** Which elements can be dragged. */
  target: string;
  /** Fraction of the element's width past which letting go decides. */
  threshold: number;
  /** Allowed directions. */
  dirs: readonly (1 | -1)[];
  onDrag?(el: HTMLElement, dx: number, w: number): void;
  /** Called on release: 0 means it springs back. */
  onEnd(el: HTMLElement, dir: 1 | -1 | 0): void;
}

const FLICK = 0.6; // px per ms

export function swipe(root: HTMLElement, o: SwipeOptions): void {
  let d: { el: HTMLElement; x: number; y: number; t: number; w: number; dx: number; on: boolean } | null = null;

  root.addEventListener('pointerdown', (e) => {
    const el = (e.target as Element).closest<HTMLElement>(o.target);
    if (!el || e.button !== 0 || (e.target as Element).closest('button, a')) return;
    d = { el, x: e.clientX, y: e.clientY, t: e.timeStamp, w: el.offsetWidth, dx: 0, on: false };
  });

  root.addEventListener('pointermove', (e) => {
    if (!d) return;
    let dx = e.clientX - d.x;
    if (!d.on) {
      const dy = Math.abs(e.clientY - d.y);
      if (dy > 10 && dy > Math.abs(dx)) { d = null; return; }
      if (Math.abs(dx) < 8) return;
      d.on = true;
      d.el.setPointerCapture(e.pointerId);
      d.el.classList.add('dragging');
    }
    // Resist the way it can't go.
    if (!o.dirs.includes(dx > 0 ? 1 : -1)) dx /= 6;
    d.dx = dx;
    d.el.style.transform = `translate3d(${dx}px, 0, 0)`;
    o.onDrag?.(d.el, dx, d.w);
  });

  const release = (e: PointerEvent) => {
    if (!d) return;
    const { el, dx, w, t, on } = d;
    d = null;
    if (!on) return;
    el.classList.remove('dragging');
    const dir = dx > 0 ? 1 : -1;
    const fast = Math.abs(dx) / Math.max(1, e.timeStamp - t) > FLICK && Math.abs(dx) > 30;
    const decided = o.dirs.includes(dir) && (Math.abs(dx) > w * o.threshold || fast);
    if (!decided) el.style.transform = '';
    o.onEnd(el, decided ? dir : 0);
  };
  root.addEventListener('pointerup', release);
  root.addEventListener('pointercancel', release);
}
