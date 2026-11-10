/* UI decoration only: no data, dialog-flow, guide-layout or layer-default changes. */
(() => {
  'use strict';
  const obsoleteNote = 'Границы по системам; ручные правки — в редакторе территорий.';
  const fieldSelector = 'dialog input, dialog textarea, dialog select, #territory-tools input, #territory-tools select';
  let frame = 0;

  function decorate() {
    frame = 0;
    document.querySelectorAll('#layers .layer-note').forEach(note => {
      if (note.textContent.trim() === obsoleteNote) note.remove();
    });
    document.querySelectorAll('button').forEach(button => {
      const label = (button.getAttribute('aria-label') || button.textContent).trim();
      if (/^Удалить(?:\s|$)/u.test(label)) button.classList.add('ui-v31-danger');
      // A disabled button must not inherit any old enabled :hover rule.
      // Snapshot before hover; never derive an idle state from a hover state.
      if (!button.matches(':hover')) {
        const style = getComputedStyle(button);
        const values = {
          color: style.color, border: style.borderColor,
          bg: style.backgroundColor, shadow: style.boxShadow
        };
        Object.entries(values).forEach(([key, value]) => {
          const property = '--ui-v31-idle-' + key;
          if (button.style.getPropertyValue(property) !== value) {
            button.style.setProperty(property, value);
          }
        });
      }
    });
    document.querySelectorAll(fieldSelector).forEach(field => {
      if (field.classList.contains('ui-v31-field')) return;
      if (/^(checkbox|radio|range|color|file|hidden|button|submit|reset)$/u.test(field.type)) return;
      const width = field.getBoundingClientRect().width;
      const parentWidth = field.parentElement.getBoundingClientRect().width;
      // Only full-row or full-grid-cell fields. Keep 60/70px stats and
      // multiattack controls compact, even when their containing row is wide.
      if (width > 0 && parentWidth > 0 && width >= parentWidth * 0.88) {
        field.classList.add('ui-v31-field');
      }
    });
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(decorate);
  }
  const observer = new MutationObserver(records => {
    if (records.some(record => record.type === 'childList' ||
      ['open', 'hidden', 'disabled', 'aria-disabled'].includes(record.attributeName))) schedule();
  });
  observer.observe(document.body, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ['open', 'hidden', 'disabled', 'aria-disabled']
  });
  window.addEventListener('resize', schedule, { passive: true });
  document.addEventListener('pointerout', schedule, { passive: true });
  decorate();
})();
