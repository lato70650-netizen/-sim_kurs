document.querySelectorAll('.module-toggle').forEach((button) => {
  button.addEventListener('click', () => {
    const expanded = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!expanded));
    document.getElementById(button.getAttribute('aria-controls')).hidden = expanded;
    button.querySelector('span').textContent = expanded ? '+' : '−';
  });
});

const scooterScene = document.querySelector('.scooter-scene');
if (scooterScene) {
  const rider = scooterScene.querySelector('.scooter-rider');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finishRide = () => {
    scooterScene.classList.remove('is-riding');
    scooterScene.classList.add('is-finished');
  };
  const startRide = () => {
    if (reducedMotion.matches) {
      finishRide();
      return;
    }
    if (scooterScene.classList.contains('is-riding')) return;
    scooterScene.classList.remove('is-finished');
    scooterScene.classList.add('is-riding');
  };
  rider.addEventListener('animationend', (event) => {
    if (event.animationName === 'scooter-journey') finishRide();
  });
  rider.addEventListener('click', startRide);
  reducedMotion.addEventListener('change', (event) => {
    if (event.matches) finishRide();
  });
  if (reducedMotion.matches || !('IntersectionObserver' in window)) {
    finishRide();
  } else {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        startRide();
        observer.disconnect();
      }
    }, { threshold: 0.6 });
    observer.observe(scooterScene);
  }
}
