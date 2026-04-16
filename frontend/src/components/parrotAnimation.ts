/**
 * ParrotAnimation — brings the hero parrot to life with
 * ambient magic particles, while CSS handles the smooth breathing.
 */

export function initParrotAnimation(): void {
  const parrotEl = document.getElementById('parrot-alive');
  if (!parrotEl) return;

  const MAX_PARTICLES = 8;
  const SPAWN_INTERVAL_MS = 650;
  const SPAWN_WINDOW_MS = 10_000;

  // Add the particles container if it doesn't exist
  let particlesContainer = parrotEl.querySelector('.parrot-particles');
  if (!particlesContainer) {
    particlesContainer = document.createElement('div');
    particlesContainer.className = 'parrot-particles';
    parrotEl.appendChild(particlesContainer);
  }

  let intervalId: ReturnType<typeof setInterval> | null = null;
  let stopSpawnTimer: ReturnType<typeof setTimeout> | null = null;

  function activeParticleCount() {
    return particlesContainer?.childElementCount ?? 0;
  }

  function createParticle() {
    if (!particlesContainer) return;
    if (activeParticleCount() >= MAX_PARTICLES) return;

    const particle = document.createElement('div');
    particle.className = 'particle';

    // Randomize starting position and animation duration
    const leftPos = 20 + Math.random() * 60; // 20% to 80% left
    const duration = 3 + Math.random() * 3; // 3 to 6 seconds
    const delay = Math.random() * 2;
    
    particle.style.left = `${leftPos}%`;
    particle.style.bottom = `${10 + Math.random() * 20}%`;
    particle.style.animationDuration = `${duration}s`;
    particle.style.animationDelay = `${delay}s`;

    particlesContainer.appendChild(particle);

    // Remove particle after animation ends to clean up DOM
    setTimeout(() => {
      particle.remove();
    }, (duration + delay) * 1000);
  }

  function stopSpawn() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    if (stopSpawnTimer) {
      clearTimeout(stopSpawnTimer);
      stopSpawnTimer = null;
    }
  }

  function startSpawn() {
    if (intervalId || document.hidden) return;
    intervalId = setInterval(createParticle, SPAWN_INTERVAL_MS);
    stopSpawnTimer = setTimeout(() => {
      stopSpawn();
    }, SPAWN_WINDOW_MS);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopSpawn();
      return;
    }

    if (activeParticleCount() < 2) {
      startSpawn();
    }
  });

  // Initial burst of particles
  for (let i = 0; i < MAX_PARTICLES; i++) {
    createParticle();
  }

  startSpawn();
}
