import { BY_ID } from '../dishes.ts';
import { chars, dateline, h } from '../dom.ts';
import { icon } from '../icons.ts';
import { figure } from '../photo.ts';
import { kicker, type Pick } from '../recommend.ts';
import { store } from '../store.ts';
import { swipe } from '../swipe.ts';

const SIZES = '(min-width: 900px) 55vw, 100vw';
const THRESHOLD = 0.28;
/** Set once the swipe has been shown, so it plays on the first visit only. */
const COACHED = 'kibun:coached';

export function deck(root: HTMLElement): () => void {
  const count = h('span', { class: 'count' });
  const table = h('div', { class: 'table' });
  const undoBtn = h('button', { class: 'undo', type: 'button', 'aria-label': '一つ戻す', onclick: () => store.undo() },
    icon('undo'));
  const skipBtn = h('button', { class: 'skip', type: 'button', onclick: () => fling(-1) },
    h('span', { class: 'disc' }, icon('x')), h('span', { class: 'label' }, '見送る'));
  const keepBtn = h('button', { class: 'keep', type: 'button', onclick: () => fling(1) },
    h('span', { class: 'disc' }, icon('heart', true)), h('span', { class: 'label' }, '候補に入れる'));

  root.replaceChildren(
    h('header', { class: 'mast' },
      h('a', { class: 'brand', href: '#' }, 'Kibun'),
      h('span', { class: 'dateline' }, dateline()),
      h('a', { class: 'to-list', href: '#list', 'aria-live': 'polite' },
        icon('heart', true), '候補リスト', count, icon('next'))),
    table,
    h('nav', { class: 'verdict', 'aria-label': '判定' }, skipBtn, undoBtn, keepBtn),
  );

  /** Pages currently in the DOM, keyed by dish id, so a loaded photo is never rebuilt. */
  const pages = new Map<string, HTMLElement>();

  function page(p: Pick, top: boolean): HTMLElement {
    const dish = BY_ID.get(p.id)!;
    const from = p.reason.kind === 'near' ? BY_ID.get(p.reason.from) : undefined;
    return h('article', { class: 'page', 'data-id': p.id },
      h('div', { class: 'frame' },
        figure(dish, { sizes: SIZES, priority: top ? 'high' : 'low' }),
        h('span', { class: 'hint hint-keep', 'aria-hidden': 'true' }, icon('heart', true), '候補へ'),
        h('span', { class: 'hint hint-skip', 'aria-hidden': 'true' }, icon('x'), '見送り')),
      h('div', { class: 'caption' },
        h('p', { class: 'kicker' }, kicker(p.reason),
          from && h('span', { class: 'from' }, `${from.name}から`)),
        h('h2', { class: 'name', style: chars(dish.name) }, dish.name),
        h('p', { class: 'en' }, dish.en),
        h('p', { class: 'blurb' }, dish.blurb)));
  }

  function render(): void {
    const s = store.get();
    count.textContent = String(s.shortlist.length);
    count.classList.toggle('zero', s.shortlist.length === 0);
    undoBtn.disabled = !store.canUndo();
    const ids = s.table.map((p) => p.id);
    for (const [id, el] of pages) {
      if (!ids.includes(id)) { el.remove(); pages.delete(id); }
    }
    s.table.forEach((p, i) => {
      let el = pages.get(p.id);
      if (!el) {
        el = page(p, i === 0);
        pages.set(p.id, el);
        table.prepend(el);
      }
      el.classList.toggle('top', i === 0);
      el.inert = i !== 0;
    });
    skipBtn.disabled = keepBtn.disabled = ids.length === 0;
    if (ids.length === 0 && !table.querySelector('.empty')) {
      table.append(h('div', { class: 'empty' },
        h('h2', { class: 'headline' }, '全部見ました'),
        h('p', { class: 'actions' },
          h('a', { class: 'btn', href: '#list' }, '候補リストへ', icon('next')),
          h('button', { class: 'btn quiet', type: 'button', onclick: () => store.restart() }, '最初から'))));
    } else if (ids.length) table.querySelector('.empty')?.remove();
  }

  /** Send the top page off to one side and record the verdict. */
  function fling(dir: 1 | -1): void {
    stopCoach();
    const top = store.get().table[0];
    const el = top && pages.get(top.id);
    if (!el) return;
    pages.delete(top.id);
    el.classList.replace('top', 'gone');
    el.style.transform = `translate3d(${dir * 110}%, 0, 0)`;
    el.style.setProperty('--pull', String(dir));
    const done = () => el.remove();
    el.addEventListener('transitionend', done, { once: true });
    setTimeout(done, 400); // in case no transition runs (reduced motion)
    if (dir === 1) bump();
    store.judge(dir === 1 ? 'keep' : 'skip');
  }

  function bump(): void {
    count.classList.remove('bump');
    void count.offsetWidth;
    count.classList.add('bump');
  }

  swipe(table, {
    target: '.page.top',
    threshold: THRESHOLD,
    dirs: [1, -1],
    onDrag: (el, dx, w) => { stopCoach(); el.style.setProperty('--pull', (dx / (w * THRESHOLD)).toFixed(3)); },
    onEnd: (el, dir) => (dir ? fling(dir) : el.style.removeProperty('--pull')),
  });

  // First visit: the top page sways right then left by itself, with a hand,
  // to show that it can be swiped. Any touch, key or button stops it.
  let coach: HTMLElement | null = null;
  function startCoach(): void {
    try { if (localStorage.getItem(COACHED)) return; } catch { return; }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    coach = h('div', { class: 'coach', 'aria-hidden': 'true' },
      h('span', { class: 'finger' }),
      h('p', null, h('span', null, icon('x'), '左で見送る'), h('span', null, '右で候補に', icon('heart', true))));
    table.append(coach);
    table.classList.add('coaching');
    coach.addEventListener('animationend', stopCoach, { once: true });
  }
  function stopCoach(): void {
    if (!coach) return;
    coach.remove();
    coach = null;
    table.classList.remove('coaching');
    try { localStorage.setItem(COACHED, '1'); } catch { /* fine */ }
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'ArrowRight') fling(1);
    else if (e.key === 'ArrowLeft') fling(-1);
    else if (e.key === 'z' || e.key === 'Backspace') store.undo();
  };
  addEventListener('keydown', onKey);
  const off = store.subscribe(render);
  render();
  startCoach();
  return () => { off(); removeEventListener('keydown', onKey); };
}
