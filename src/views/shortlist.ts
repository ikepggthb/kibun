import { BY_ID } from '../dishes.ts';
import { chars, h, pad2 } from '../dom.ts';
import { icon } from '../icons.ts';
import { figure } from '../photo.ts';
import { store } from '../store.ts';
import { swipe } from '../swipe.ts';

export function shortlist(root: HTMLElement): () => void {
  const body = h('section', { class: 'sheet' });
  const toast = h('div', { class: 'toast', role: 'status' });
  let toastTimer = 0;

  root.replaceChildren(
    h('header', { class: 'mast' },
      h('a', { class: 'back', href: '#' }, icon('back'), '料理を見る')),
    body,
    toast,
  );

  function notice(text: string): void {
    clearTimeout(toastTimer);
    toast.replaceChildren(h('span', null, text),
      h('button', { type: 'button', onclick: () => { store.undo(); hide(); } }, icon('undo'), '元に戻す'));
    toast.classList.add('shown');
    toastTimer = window.setTimeout(hide, 5000);
  }
  function hide(): void { toast.classList.remove('shown'); }

  function drop(id: string): void {
    store.drop(id);
    notice(`${BY_ID.get(id)!.name}を外しました`);
  }

  function render(): void {
    const ids = store.get().shortlist;
    const n = ids.length;
    const lede = n === 0 ? 'まだ何もありません。気になった料理を右へスワイプすると、ここに並びます。'
      : n === 1 ? 'ひとつだけ。これに決めても、もう少し探しても。'
      : `${n}皿。ここからひとつに決めましょう。右へスワイプで外せます。`;

    body.replaceChildren(
      h('div', { class: 'sheet-head' },
        h('h1', { class: 'headline' }, '候補リスト'),
        n > 0 && h('button', { class: 'clear', type: 'button', onclick: () => {
          store.clear();
          notice('候補をすべて外しました');
        } }, icon('trash'), 'すべて外す')),
      h('p', { class: 'lede' }, lede),
      n === 0 ? '' : h('ol', { class: 'list' }, ...ids.map((id, i) => {
        const dish = BY_ID.get(id)!;
        return h('li', { 'data-id': id },
          h('span', { class: 'under', 'aria-hidden': 'true' }, icon('trash'), '外す'),
          h('div', { class: 'row' },
            figure(dish, { sizes: '96px', lazy: i > 5 }),
            h('div', { class: 'entry' },
              h('span', { class: 'num' }, pad2(i + 1)),
              h('h2', { class: 'name', style: chars(dish.name) }, dish.name),
              h('p', { class: 'en' }, dish.en)),
            h('div', { class: 'row-actions' },
              h('button', { class: 'btn quiet small', type: 'button', onclick: () => { store.choose(id); location.hash = '#today'; } }, 'これにする'),
              h('button', { class: 'drop', type: 'button', 'aria-label': `${dish.name}を外す`, onclick: () => drop(id) }, icon('x')))));
      })),
      h('div', { class: 'actions' },
        n >= 2 && h('a', { class: 'btn', href: '#compare' }, icon('scale'), '二つずつ比べて決める'),
        h('a', { class: n >= 2 ? 'btn quiet' : 'btn', href: '#' }, icon('back'), n ? '料理をもっと見る' : '料理を見に行く')),
    );
  }

  swipe(body, {
    target: '.list .row',
    threshold: 0.35,
    dirs: [1],
    onDrag: (el, dx, w) => el.parentElement!.style.setProperty('--pull', Math.min(1, dx / (w * 0.35)).toFixed(3)),
    onEnd: (el, dir) => {
      const li = el.parentElement!;
      if (!dir) { li.style.removeProperty('--pull'); return; }
      el.style.transform = 'translate3d(105%, 0, 0)';
      li.classList.add('leaving');
      setTimeout(() => drop(li.dataset.id!), 220);
    },
  });

  const off = store.subscribe(render);
  render();
  return () => { off(); clearTimeout(toastTimer); };
}
