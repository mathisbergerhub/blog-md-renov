// Shared media query, used by the mobile menu and entrance-motion code below.
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const mobileMenus = document.querySelectorAll('.mdr-topnav__menu');
const closeMobileMenu = (menu) => {
  if (!menu.open || menu.classList.contains('is-closing')) {
    return;
  }

  const summary = menu.querySelector('summary');
  const finishClose = () => {
    menu.open = false;
    menu.classList.remove('is-closing');
    summary?.setAttribute('aria-expanded', 'false');
    summary?.setAttribute('aria-label', 'Ouvrir le menu');
  };

  summary?.setAttribute('aria-expanded', 'false');
  summary?.setAttribute('aria-label', 'Ouvrir le menu');

  if (prefersReducedMotion.matches) {
    finishClose();
    return;
  }

  menu.classList.add('is-closing');
  window.setTimeout(finishClose, 170);
};

mobileMenus.forEach((menu) => {
  const summary = menu.querySelector('summary');
  summary?.setAttribute('aria-expanded', menu.open ? 'true' : 'false');
  summary?.setAttribute('aria-label', menu.open ? 'Fermer le menu' : 'Ouvrir le menu');

  menu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => closeMobileMenu(menu));
  });

  summary?.addEventListener('click', (event) => {
    if (!menu.open) {
      mobileMenus.forEach((other) => {
        if (other !== menu) {
          closeMobileMenu(other);
        }
      });
      summary.setAttribute('aria-expanded', 'true');
      summary.setAttribute('aria-label', 'Fermer le menu');
      return;
    }

    event.preventDefault();
    closeMobileMenu(menu);
  });
});

document.addEventListener('click', (event) => {
  mobileMenus.forEach((menu) => {
    if (!menu.contains(event.target)) {
      closeMobileMenu(menu);
    }
  });
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') {
    return;
  }

  mobileMenus.forEach(closeMobileMenu);
});

/* ---- Reading progress bar (article pages) ---- */
(function () {
  if (!document.body.classList.contains('mdr-article-page')) return;
  const bar = document.createElement('div');
  bar.className = 'mdr-readbar';
  bar.setAttribute('aria-hidden', 'true');
  const fill = document.createElement('i');
  bar.appendChild(fill);
  document.body.appendChild(bar);
  let ticking = false;
  const update = () => {
    const root = document.documentElement;
    const max = root.scrollHeight - root.clientHeight;
    const ratio = max > 0 ? Math.min(1, Math.max(0, root.scrollTop / max)) : 0;
    fill.style.transform = 'scaleX(' + ratio + ')';
    ticking = false;
  };
  const onScroll = () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  update();
})();

/* ---- Sticky mobile "Devis gratuit" CTA (article pages, thumb zone) ---- */
(function () {
  if (!document.body.classList.contains('mdr-article-page')) return;
  const cta = document.createElement('a');
  cta.className = 'mdr-stickycta';
  cta.href = 'https://www.mdrenov-menuiserie.com/contact#Contact-Form';
  cta.target = '_blank';
  cta.rel = 'noopener noreferrer';
  cta.textContent = 'Devis gratuit';
  document.body.appendChild(cta);
  // Hide it whenever a footer is on screen, so it never covers the footer CTA.
  const footer = document.querySelector('.mdr-article-footer, .mdr-site-footer');
  if (footer && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        document.body.classList.toggle('mdr-stickycta-hide', entry.isIntersecting);
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    io.observe(footer);
  }
})();

/* ---- Entrance motion: progressive enhancement only (content is visible by default) ---- */
(function () {
  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.documentElement.classList.add('js-anim');
  const targets = document.querySelectorAll(
    '.mdr-home-featured, .mdr-home-card, .mdr-home-shortcuts > a, .mdr-keyfacts > div, .mdr-value-grid > div, .mdr-prose > h2, .mdr-source-card'
  );
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      io.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  targets.forEach((element, index) => {
    element.classList.add('mdr-reveal');
    element.style.setProperty('--mdr-reveal-delay', (index % 6) * 45 + 'ms');
    io.observe(element);
  });
})();

/* ---- Article immersif : hero photo plein écran (progressive enhancement) ---- */
(function () {
  if (!document.body.classList.contains('mdr-article-page')) return;
  const head = document.querySelector('.mdr-article-head');
  const img = document.querySelector('.mdr-prose .mdr-article-figure img');
  if (!head || !img) return;
  const src = img.currentSrc || img.src;
  if (!src) return;
  head.classList.add('mdr-head-immersive');
  head.style.setProperty('--mdr-hero-img', 'url("' + src + '")');
  const figure = img.closest('.mdr-article-figure');
  if (figure) figure.classList.add('mdr-figure-moved');
})();

/* ---- Sommaire en pilules horizontales, collant, avec scroll-spy ---- */
(function () {
  if (!document.body.classList.contains('mdr-article-page')) return;
  const head = document.querySelector('.mdr-article-head');
  const prose = document.querySelector('.mdr-prose');
  if (!head || !prose) return;
  const headings = Array.from(prose.querySelectorAll('h2[id]'));
  if (headings.length < 3) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const nav = document.createElement('nav');
  nav.className = 'mdr-toc-pills';
  nav.setAttribute('aria-label', 'Sommaire de l’article');

  const pills = new Map();
  headings.forEach((h) => {
    const pill = document.createElement('a');
    pill.className = 'mdr-toc-pill';
    pill.href = '#' + h.id;
    pill.textContent = h.textContent.trim();
    pill.addEventListener('click', (event) => {
      event.preventDefault();
      h.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
      history.replaceState(null, '', '#' + h.id);
    });
    nav.appendChild(pill);
    pills.set(h.id, pill);
  });
  head.insertAdjacentElement('afterend', nav);

  let currentId = null;
  const setActive = (id) => {
    if (id === currentId) return;
    if (currentId && pills.has(currentId)) pills.get(currentId).classList.remove('is-active');
    currentId = id;
    const pill = pills.get(id);
    if (!pill) return;
    pill.classList.add('is-active');
    const target = pill.offsetLeft - nav.clientWidth / 2 + pill.offsetWidth / 2;
    nav.scrollTo({ left: Math.max(0, target), behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  };

  const pickCurrent = () => {
    let best = headings[0].id;
    headings.forEach((h) => {
      if (h.getBoundingClientRect().top <= 130) best = h.id;
    });
    setActive(best);
  };
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { pickCurrent(); ticking = false; });
  }, { passive: true });
  pickCurrent();
})();

/* ---- CTA final : rapatrie les badges de confiance de l'encart latéral ---- */
(function () {
  if (!document.body.classList.contains('mdr-article-page')) return;
  const badges = document.querySelector('.mdr-cta-box .mdr-cta-box__badges');
  const cta = document.querySelector('.mdr-prose-cta');
  if (badges && cta) cta.appendChild(badges);
})();
