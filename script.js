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
