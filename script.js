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

/* ---- Sommaire collant + scroll-spy (pages articles, desktop) ---- */
(function () {
  if (!document.body.classList.contains('mdr-article-page')) return;
  const sidebar = document.querySelector('.mdr-sidebar');
  const prose = document.querySelector('.mdr-prose');
  if (!sidebar || !prose) return;

  const headings = Array.from(prose.querySelectorAll('h2[id]'));
  if (headings.length < 3) return;

  const toc = document.createElement('nav');
  toc.className = 'mdr-toc';
  toc.setAttribute('aria-label', 'Sommaire de l’article');
  const title = document.createElement('p');
  title.className = 'mdr-toc__title';
  title.textContent = 'Dans cet article';
  const list = document.createElement('div');
  list.className = 'mdr-toc__list';
  toc.appendChild(title);
  toc.appendChild(list);

  const links = new Map();
  headings.forEach((h) => {
    const a = document.createElement('a');
    a.className = 'mdr-toc__link';
    a.href = '#' + h.id;
    a.textContent = h.textContent.trim();
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      h.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      history.replaceState(null, '', '#' + h.id);
    });
    list.appendChild(a);
    links.set(h.id, a);
  });

  sidebar.insertBefore(toc, sidebar.firstChild);

  let current = null;
  const setActive = (id) => {
    if (id === current) return;
    if (current && links.get(current)) links.get(current).classList.remove('is-active');
    current = id;
    if (id && links.get(id)) links.get(id).classList.add('is-active');
  };

  if ('IntersectionObserver' in window) {
    const visible = new Set();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) visible.add(entry.target.id);
        else visible.delete(entry.target.id);
      });
      let best = null, bestTop = Infinity;
      headings.forEach((h) => {
        const top = h.getBoundingClientRect().top;
        if (top < 140 && top > bestTop) return;
        if (top < 140) { best = h.id; bestTop = top; }
      });
      if (!best && visible.size) best = headings.find((h) => visible.has(h.id))?.id || null;
      if (best) setActive(best);
    }, { rootMargin: '-120px 0px -60% 0px', threshold: [0, 1] });
    headings.forEach((h) => io.observe(h));
  }
  setActive(headings[0].id);
})();

/* ---- Partage de l'article (tous formats) ---- */
(function () {
  if (!document.body.classList.contains('mdr-article-page')) return;
  const head = document.querySelector('.mdr-article-head');
  if (!head) return;

  const canonical = document.querySelector('link[rel="canonical"]');
  const url = (canonical && canonical.href) || window.location.href;
  const title = document.title;
  const enc = encodeURIComponent;

  const targets = [
    { label: 'Partager sur Facebook', href: 'https://www.facebook.com/sharer/sharer.php?u=' + enc(url), svg: '<path d="M13.5 21v-7h2.3l.4-2.8h-2.7V9.4c0-.8.2-1.4 1.4-1.4h1.4V5.5c-.3 0-1.2-.1-2.2-.1-2.1 0-3.6 1.3-3.6 3.7v2.1H8.2V14h2.2v7z"/>' },
    { label: 'Partager sur X', href: 'https://twitter.com/intent/tweet?text=' + enc(title) + '&url=' + enc(url), svg: '<path d="M17.5 4h2.6l-5.7 6.5L21 20h-5.2l-4.1-5.3L6.9 20H4.3l6.1-7L4 4h5.3l3.7 4.9zm-.9 14.4h1.4L8.2 5.5H6.6z"/>' },
    { label: 'Partager sur LinkedIn', href: 'https://www.linkedin.com/sharing/share-offsite/?url=' + enc(url), svg: '<path d="M6.9 8.4H4.2V20h2.7zM5.5 4a1.6 1.6 0 100 3.1 1.6 1.6 0 000-3.1zM20 20h-2.7v-6.1c0-1.5-.5-2.4-1.8-2.4-1 0-1.5.7-1.8 1.3-.1.2-.1.5-.1.9V20H10.9s.1-10.5 0-11.6h2.7v1.6c.4-.6 1-1.5 2.6-1.5 1.9 0 3.4 1.2 3.4 3.9z"/>' }
  ];

  const wrap = document.createElement('div');
  wrap.className = 'mdr-share';
  const label = document.createElement('span');
  label.className = 'mdr-share__label';
  label.textContent = 'Partager';
  const row = document.createElement('div');
  row.className = 'mdr-share__row';
  wrap.appendChild(label);
  wrap.appendChild(row);

  targets.forEach((t) => {
    const a = document.createElement('a');
    a.className = 'mdr-share__btn';
    a.href = t.href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.setAttribute('aria-label', t.label);
    a.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + t.svg + '</svg>';
    row.appendChild(a);
  });

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'mdr-share__btn';
  copyBtn.setAttribute('aria-label', 'Copier le lien');
  copyBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 14.5a3 3 0 010-4.2l2.6-2.6a3 3 0 014.2 4.2l-1.3 1.3M14.5 9.5a3 3 0 010 4.2l-2.6 2.6a3 3 0 01-4.2-4.2l1.3-1.3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(url);
      copyBtn.classList.add('is-copied');
      copyBtn.setAttribute('aria-label', 'Lien copié');
      setTimeout(() => {
        copyBtn.classList.remove('is-copied');
        copyBtn.setAttribute('aria-label', 'Copier le lien');
      }, 1600);
    } catch (_e) {}
  });
  row.appendChild(copyBtn);

  head.appendChild(wrap);
})();
