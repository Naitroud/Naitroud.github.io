'use strict';
/* Additive UI only: the registry owns checkbox limits, form state and saves. */
(() => {
  if (window.TraitBrowserV37) return;
  const terms = Object.freeze({disobedience:'Неповиновение',attack:'Атака',defense:'Защита',guard:'Арьергард',rear:'Тыл',center:'Столкновение'});
  // Explicit engine-field / scope mapping. Never infer effects from prose.
  // Lower disobedience / fewer escape rounds are beneficial; other numbers add.
  const mapping = Object.freeze({
    inspiring_leader:{group:'Дисциплина',effects:[['disobedience',['disobedience','center'],-1]]},
    decisive_assault:{group:'Столкновение',effects:[['entryAttack',['attack','center'],1]]},
    iron_discipline:{group:'Дисциплина',effects:[['disobedience',['disobedience','center'],-1],['attack',['attack'],1]]},
    reckless_charge:{group:'Столкновение',effects:[['centerAttack',['attack','center'],1],['disobedience',['disobedience','center'],-1]]},
    // screenDefense belongs to the defending own guard, not the shooter's center.
    protective_screen:{group:'Арьергард',effects:[['screenDefense',['defense','guard'],1],['ownGuardAttack',['attack','guard'],1]]},
    orderly_withdrawal:{group:'Дисциплина',effects:[['withdrawalDisobedience',['disobedience','center','rear'],-1]]},
    seasoned_crew:{group:'Дисциплина',effects:[['disobedience',['disobedience','center'],-1],['centerDefense',['defense','center'],1]]},
    independent_captains:{group:'Столкновение',effects:[['centerAttack',['attack','center'],1],['disobedience',['disobedience','center'],-1]]},
    vanguard_screen:{group:'Столкновение',effects:[['centerDefense',['defense','center'],1]]},
    vanguard_pressure:{group:'Столкновение',effects:[['centerAttack',['attack','center'],1],['centerDefense',['defense','center'],1]]},
    layered_armor:{group:'Арьергард',effects:[['ownGuardDefense',['defense','guard'],1],['ownGuardAttack',['attack','guard'],1]]},
    rear_fortification:{group:'Тыл',effects:[['rearIntruderDefense',['defense','rear'],1]]},
    rapid_evacuation:{group:'Тыл',effects:[['escapeRounds',['rear'],-1,3],['ownRearDefense',['defense','rear'],1]]},
    // A nonzero reentryAttack enables a free rear→own-guard step (engine nextRound).
    // Its numeric penalty then lasts in every sector; do not call it guard-only.
    emergency_reentry:{group:'Тыл',effects:[['reentryAttack',['attack'],1],['reentryAttack',['attack','rear','guard'],-1]]},
    rear_raiders:{group:'Тыл',effects:[['foreignRearAttack',['attack','rear'],1],['foreignRearDefense',['defense','rear'],1]]},
    cautious_recovery:{group:'Дисциплина',effects:[['recoveryDisobedience',['disobedience','center','guard','rear'],-1],['woundedCenterDefense',['defense','center'],1]]}
  });
  const groups = ['Дисциплина','Столкновение','Арьергард','Тыл'];
  const selected = new Set();
  function tagsFor(id) {
    const trait = window.BattleEngine?.traits?.[id];
    const result = new Map();
    for (const [key, categories, direction, baseline = 0] of mapping[id]?.effects || []) {
      const value = trait?.[key];
      if (typeof value !== 'number' || value === baseline) continue;
      const positive = (value - baseline) * direction > 0;
      for (const category of categories) result.set(category + ':' + positive, {category,positive});
    }
    return [...result.values()].sort((a,b) => Object.keys(terms).indexOf(a.category)-Object.keys(terms).indexOf(b.category) || Number(b.positive)-Number(a.positive));
  }
  function identify(card) {
    const input = card.closest('.registry-trait-choice')?.querySelector('input[type="checkbox"]');
    if (input && mapping[input.value]) return input.value;
    const name = card.querySelector('strong,h4,h3')?.textContent?.trim();
    return Object.keys(mapping).find(id => window.BattleEngine?.traits?.[id]?.name === name);
  }
  function decorate(card) {
    const id = identify(card);
    if (!id || card.dataset.traitV37 === id) return;
    card.dataset.traitV37 = id;
    const footer = document.createElement('div');
    footer.className = 'trait-tags-v37';
    footer.setAttribute('aria-label','Эффекты: плюс — преимущество, минус — недостаток');
    for (const {category,positive} of tagsFor(id)) {
      const tag = document.createElement('span');
      tag.className = 'trait-tag-v37 ' + (positive ? 'is-benefit' : 'is-drawback');
      tag.dataset.traitCategory = category;
      tag.dataset.polarity = positive ? 'positive' : 'negative';
      tag.textContent = (positive ? '+ ' : '− ') + terms[category];
      footer.append(tag);
    }
    card.append(footer);
  }
  function toolbar(grid) {
    const fieldset = grid.parentElement;
    let bar = fieldset.querySelector(':scope > .trait-browser-v37');
    if (bar) return bar;
    bar = document.createElement('div');
    bar.className = 'trait-browser-v37';
    const chips = document.createElement('div');
    chips.className = 'trait-filters-v37';
    chips.setAttribute('role','group');
    chips.setAttribute('aria-label','Фильтры черт');
    for (const [key,label] of [['all','Все'],...Object.entries(terms)]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'trait-filter-v37';
      button.dataset.traitFilter = key;
      button.textContent = label;
      button.setAttribute('aria-controls','registry-traits');
      button.addEventListener('click', () => {
        if (key === 'all') selected.clear();
        else if (selected.has(key)) selected.delete(key);
        else selected.add(key);
        apply(grid,bar);
      });
      chips.append(button);
    }
    const note = document.createElement('p');
    note.className = 'trait-filter-note-v37';
    note.textContent = 'Фильтры работают по ИЛИ: преимущество или недостаток в любой выбранной категории. Скрытые черты остаются выбранными; общий лимит — 4. + преимущество · − недостаток.';
    const status = document.createElement('p');
    status.className = 'trait-filter-status-v37';
    status.setAttribute('role','status');
    status.setAttribute('aria-live','polite');
    bar.append(chips,note,status);
    grid.before(bar);
    return bar;
  }
  function organize(grid) {
    const choices = [...grid.querySelectorAll('.registry-trait-choice')];
    if (!choices.length) return;
    // Headers and labels stay under #registry-traits. Move the ORIGINAL labels;
    // never clone inputs or change checked/disabled or the registry's handlers.
    for (const group of groups) {
      let heading = [...grid.children].find(node => node.dataset.traitGroup === group);
      if (!heading) {
        heading = document.createElement('h3');
        heading.className = 'trait-group-title-v37';
        heading.dataset.traitGroup = group;
        heading.textContent = group;
      }
      const members = choices.filter(choice => mapping[choice.querySelector('input')?.value]?.group === group);
      if (!members.length) continue;
      if (!heading.isConnected) grid.append(heading,...members);
    }
    const bar = toolbar(grid);
    if (!grid.dataset.traitBrowserV37) {
      grid.dataset.traitBrowserV37 = 'ready';
      grid.addEventListener('change',() => status(grid,bar));
      // Watch width, not our own height writes: responsive reflow cannot loop.
      let lastWidth = -1;
      if (window.ResizeObserver) new ResizeObserver(entries => {
        const width = entries[0].contentRect.width;
        if (width !== lastWidth) { lastWidth = width; schedule(); }
      }).observe(grid);
    }
    apply(grid,bar);
  }
  function status(grid,bar) {
    const choices = [...grid.querySelectorAll('.registry-trait-choice')];
    const inputs = [...grid.querySelectorAll('input[type="checkbox"]')];
    const checked = inputs.filter(input => input.checked);
    const hidden = checked.filter(input => input.closest('.registry-trait-choice').hidden).length;
    const text = `Показано ${choices.filter(choice => !choice.hidden).length} из ${choices.length} · Выбрано ${checked.length}/4${hidden ? ` · Скрыто выбранных: ${hidden}` : ''}`;
    const target = bar.querySelector('.trait-filter-status-v37');
    if (target.textContent !== text) target.textContent = text;
  }
  function equalize(grid) {
    if (!grid.getClientRects().length) return;
    grid.style.removeProperty('--trait-card-height-v37');
    const heights = [...grid.querySelectorAll('.registry-trait-choice:not([hidden])')].map(node => node.getBoundingClientRect().height);
    if (heights.length) grid.style.setProperty('--trait-card-height-v37',Math.ceil(Math.max(...heights)) + 'px');
  }
  function apply(grid,bar) {
    for (const button of bar.querySelectorAll('[data-trait-filter]')) {
      const active = button.dataset.traitFilter === 'all' ? !selected.size : selected.has(button.dataset.traitFilter);
      button.setAttribute('aria-pressed',String(active));
    }
    for (const choice of grid.querySelectorAll('.registry-trait-choice')) {
      const id = choice.querySelector('input')?.value;
      const visible = !selected.size || tagsFor(id).some(tag => selected.has(tag.category));
      if (choice.hidden === visible) choice.hidden = !visible;
    }
    for (const heading of grid.querySelectorAll('.trait-group-title-v37')) {
      const visible = [...grid.querySelectorAll('.registry-trait-choice')].some(choice => !choice.hidden && mapping[choice.querySelector('input')?.value]?.group === heading.dataset.traitGroup);
      if (heading.hidden === visible) heading.hidden = !visible;
    }
    status(grid,bar);
    equalize(grid);
  }
  let pending = false;
  function refresh() {
    pending = false;
    document.querySelectorAll('.commander-trait').forEach(decorate);
    const grid = document.getElementById('registry-traits');
    if (grid) organize(grid);
  }
  function schedule() {
    if (pending) return;
    pending = true;
    queueMicrotask(refresh);
  }
  window.TraitBrowserV37 = Object.freeze({refresh:schedule,tagsFor,mapping,terms});
  function boot() {
    refresh();
    // Child-list only. Our footer/heading/text mutations do not contain traits,
    // so they cannot schedule themselves. One follow-up after moving cards is inert.
    new MutationObserver(records => {
      if (records.some(record => [...record.addedNodes].some(node => node.nodeType === 1 && (node.matches('.commander-trait,#registry-traits') || node.querySelector('.commander-trait,#registry-traits'))))) schedule();
    }).observe(document.body,{childList:true,subtree:true});
    window.addEventListener('resize',schedule,{passive:true});
    document.addEventListener('commander-registry-ready',schedule);
    document.fonts?.ready.then(schedule);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
