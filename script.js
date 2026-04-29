const revealTargets = document.querySelectorAll('.reveal');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)'); if ('IntersectionObserver' in window && !prefersReducedMotion.matches) { const observer = new IntersectionObserver( (entries) => { entries.forEach((entry) => { if (!entry.isIntersecting) { return; } entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }); }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' } ); revealTargets.forEach((element) => observer.observe(element));
} else { revealTargets.forEach((element) => element.classList.add('is-visible'));
} const faqItems = document.querySelectorAll('.faq-item'); faqItems.forEach((item) => { item.addEventListener('toggle', () => { if (!item.open) { return; } faqItems.forEach((other) => { if (other !== item) { other.open = false; } }); });
}); 
