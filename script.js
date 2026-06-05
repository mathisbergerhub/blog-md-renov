const revealTargets = document.querySelectorAll('.reveal');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)'); if ('IntersectionObserver' in window && !prefersReducedMotion.matches) { const observer = new IntersectionObserver( (entries) => { entries.forEach((entry) => { if (!entry.isIntersecting) { return; } entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }); }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' } ); revealTargets.forEach((element) => observer.observe(element));
} else { revealTargets.forEach((element) => element.classList.add('is-visible'));
} const faqItems = document.querySelectorAll('.faq-item'); faqItems.forEach((item) => { item.addEventListener('toggle', () => { if (!item.open) { return; } faqItems.forEach((other) => { if (other !== item) { other.open = false; } }); });
}); 

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
