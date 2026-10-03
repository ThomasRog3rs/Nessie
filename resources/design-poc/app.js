(() => {
  const screens = Array.from(document.querySelectorAll('[data-screen]'));
  const navLinks = Array.from(document.querySelectorAll('[data-nav]'));
  const ids = screens.map((s) => s.dataset.screen);
  const fallback = ids[0];
  let firstRender = true;

  function show() {
    const id = ids.includes(location.hash.slice(1)) ? location.hash.slice(1) : fallback;
    screens.forEach((s) => (s.hidden = s.dataset.screen !== id));
    navLinks.forEach((a) => {
      const active = a.dataset.nav === id;
      if (active) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    const current = screens.find((s) => s.dataset.screen === id);
    const heading = current.querySelector('h1');
    document.title = `${heading.textContent.trim()} · Nesse (design prototype)`;
    if (!firstRender) {
      window.scrollTo(0, 0);
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
    firstRender = false;
  }

  // Sample calendar: November 2026 (1 Nov is a Sunday, weeks start Monday).
  const OFFSET = 6;
  const DAYS = 30;
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  const off = new Set([...range(3, 5), ...range(24, 27)]);
  const confirmed = new Set(range(7, 9));
  const pending = new Set(range(14, 18));
  const weekday = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const icon = (n) => `<svg class="ico !h-4 !w-4" aria-hidden="true"><use href="#i-${n}"/></svg>`;

  function renderCalendar(el) {
    const picker = el.dataset.calendar === 'picker';
    let html = '<span></span>'.repeat(OFFSET);
    for (let d = 1; d <= DAYS; d++) {
      const dayName = weekday[(OFFSET + d - 1) % 7];
      const label = `${dayName} ${d} November`;
      let cls = 'cal-open', mark = '', state = 'open';
      if (off.has(d)) { cls = 'cal-off'; mark = icon('x'); state = 'unavailable'; }
      else if (confirmed.has(d)) { cls = 'cal-booked'; mark = icon('check'); state = 'confirmed booking'; }
      else if (pending.has(d) && !picker) { cls = 'cal-pending'; mark = icon('clock'); state = 'booking, times pending'; }
      else if (picker && d === 14) { cls = 'cal-edge'; mark = '<span class="text-[10px] font-semibold uppercase">Start</span>'; state = 'selected start'; }
      else if (picker && d === 18) { cls = 'cal-edge'; mark = '<span class="text-[10px] font-semibold uppercase">End</span>'; state = 'selected end'; }
      else if (picker && d > 14 && d < 18) { cls = 'cal-sel'; state = 'in selected range'; }
      const tag = picker && state !== 'unavailable' && state !== 'confirmed booking' ? 'button' : 'div';
      const attrs = tag === 'button'
        ? ' type="button" data-mock="Select date" class="cal-day cursor-pointer ' + cls + '"'
        : ' class="cal-day ' + cls + '"';
      html += `<${tag}${attrs} aria-label="${label}, ${state}"><span>${d}</span>${mark}</${tag}>`;
    }
    el.innerHTML = html;
  }
  document.querySelectorAll('[data-calendar]').forEach(renderCalendar);

  window.addEventListener('hashchange', show);
  show();

  // Mock actions: nothing is saved or sent.
  const toast = document.getElementById('toast');
  const toastText = document.getElementById('toast-text');
  let timer;
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-mock]');
    if (!btn) return;
    e.preventDefault();
    toastText.textContent = `${btn.dataset.mock} — prototype only, nothing was saved or sent.`;
    toast.classList.remove('opacity-0', 'translate-y-2');
    clearTimeout(timer);
    timer = setTimeout(() => toast.classList.add('opacity-0', 'translate-y-2'), 3500);
  });

  document.querySelectorAll('form').forEach((f) => f.addEventListener('submit', (e) => e.preventDefault()));
})();
