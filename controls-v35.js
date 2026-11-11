'use strict';
/* UI-only decoration. Existing registry handlers continue owning every action. */
(() => {
  if (window.controlsV35Ready) return;
  window.controlsV35Ready = true;
  const paths = {
    edit: '<path d="m16 3 5 5-12 12-6 1 1-6L16 3Z"/><path d="m14 5 5 5M4 15l5 5"/>',
    delete: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>'
  };
  function icon(button, kind) {
    if (button.dataset.controlsV35Icon === kind) return;
    const label = kind === 'close' ? 'Закрыть' : kind === 'edit' ? 'Изменить командующего' : 'Удалить командующего';
    button.classList.add('icon-btn');
    if (kind === 'close') button.classList.add('uniform-close');
    if (kind === 'delete') button.classList.add('ui-v31-danger');
    button.setAttribute('aria-label', label);
    button.title = label;
    button.dataset.controlsV35Icon = kind;
    button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + paths[kind] + '</svg>';
  }
  function decorate(root) {
    const buttons = root.matches?.('button') ? [root] : root.querySelectorAll?.('button');
    for (const button of buttons || []) {
      if (button.id === 'registry-close') icon(button, 'close');
      else if (button.dataset.action === 'edit' || button.dataset.action === 'delete') icon(button, button.dataset.action);
      else button.classList.add('primary-btn');
    }
  }
  let attached = null;
  function attach() {
    const dialog = document.getElementById('commander-registry-dialog');
    if (!dialog || dialog === attached) return;
    attached = dialog;
    decorate(dialog);
    // Only new registry subtrees: no attributes, polling, document-wide observer,
    // data writes or action listeners. SVG mutations contain no buttons.
    new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) decorate(node);
      }
    }).observe(dialog, {childList: true, subtree: true});
  }
  attach();
  document.addEventListener('commander-registry-ready', attach);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach, {once: true});
})();
