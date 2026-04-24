const reveals = document.querySelectorAll(".reveal");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function startCountup(scope) {
  const counters = scope.querySelectorAll("[data-countup]");

  counters.forEach((counter) => {
    if (counter.dataset.countupStarted === "true") {
      return;
    }

    counter.dataset.countupStarted = "true";

    const target = Number(counter.getAttribute("data-countup") || "0");

    if (prefersReducedMotion.matches || target <= 0) {
      counter.textContent = String(target);
      return;
    }

    const duration = 1400;
    const start = performance.now();

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      counter.textContent = String(Math.round(target * eased));

      if (progress < 1) {
        window.requestAnimationFrame(tick);
      }
    }

    window.requestAnimationFrame(tick);
  });
}

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("is-visible");
        startCountup(entry.target);
        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.16,
      rootMargin: "0px 0px -8% 0px"
    }
  );

  reveals.forEach((element) => observer.observe(element));
} else {
  reveals.forEach((element) => {
    element.classList.add("is-visible");
    startCountup(element);
  });
}

document.querySelectorAll(".faq-item").forEach((item) => {
  item.addEventListener("toggle", () => {
    if (!item.open) {
      return;
    }

    document.querySelectorAll(".faq-item").forEach((other) => {
      if (other !== item) {
        other.open = false;
      }
    });
  });
});

const countdowns = document.querySelectorAll("[data-countdown]");

function formatCountdownValue(value) {
  return String(value).padStart(2, "0");
}

function updateCountdown(element) {
  const target = element.getAttribute("data-countdown");

  if (!target) {
    return;
  }

  const targetDate = new Date(target);
  const now = new Date();
  const remaining = Math.max(0, targetDate.getTime() - now.getTime());

  const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
  const hours = Math.floor((remaining / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((remaining / (1000 * 60)) % 60);
  const seconds = Math.floor((remaining / 1000) % 60);

  const daysNode = element.querySelector('[data-countdown-unit="days"]');
  const hoursNode = element.querySelector('[data-countdown-unit="hours"]');
  const minutesNode = element.querySelector('[data-countdown-unit="minutes"]');
  const secondsNode = element.querySelector('[data-countdown-unit="seconds"]');
  const labelNode = element.querySelector(".countdown__label");

  if (daysNode) {
    daysNode.textContent = formatCountdownValue(days);
  }

  if (hoursNode) {
    hoursNode.textContent = formatCountdownValue(hours);
  }

  if (minutesNode) {
    minutesNode.textContent = formatCountdownValue(minutes);
  }

  if (secondsNode) {
    secondsNode.textContent = formatCountdownValue(seconds);
  }

  if (labelNode && remaining === 0) {
    labelNode.textContent = "Offre terminée";
  }
}

if (countdowns.length > 0) {
  countdowns.forEach(updateCountdown);
  window.setInterval(() => {
    countdowns.forEach(updateCountdown);
  }, 1000);
}
