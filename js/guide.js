import { renderMarkup } from './parser.js';

function initExamples() {
  document.querySelectorAll('[data-markup]').forEach((el) => {
    const raw = el.dataset.markup;
    if (el.classList.contains('example-code')) {
      el.textContent = raw;
    } else if (el.classList.contains('example-preview')) {
      el.innerHTML = renderMarkup(raw);
    }
  });
}

function initToc() {
  const links = [...document.querySelectorAll('.sidebar-nav a')];
  const sections = links
    .map((a) => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);

  const onScroll = () => {
    let current = sections[0];
    for (const sec of sections) {
      if (sec.getBoundingClientRect().top <= 120) current = sec;
    }
    links.forEach((a) => {
      a.classList.toggle('active', a.getAttribute('href') === `#${current.id}`);
    });
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

initExamples();
initToc();
