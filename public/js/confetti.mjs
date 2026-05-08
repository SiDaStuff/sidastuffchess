const palette = ['#f7c631', '#0d8f8b', '#346ea5', '#b88d58', '#ffffff', '#202721'];

function makeCanvas() {
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti-canvas';
  canvas.style.position = 'fixed';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '9999';
  document.body.appendChild(canvas);
  return canvas;
}

export function burst() {
  const canvas = makeCanvas();
  const ctx = canvas.getContext('2d');
  const ratio = window.devicePixelRatio || 1;
  const resize = () => {
    canvas.width = Math.floor(window.innerWidth * ratio);
    canvas.height = Math.floor(window.innerHeight * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  };

  resize();
  const particles = Array.from({ length: 150 }, () => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
    const speed = 7 + Math.random() * 9;
    return {
      x: window.innerWidth / 2,
      y: window.innerHeight * 0.62,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      gravity: 0.22 + Math.random() * 0.08,
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.28,
      size: 5 + Math.random() * 8,
      color: palette[Math.floor(Math.random() * palette.length)],
      life: 90 + Math.random() * 45,
    };
  });

  let frame = 0;
  const tick = () => {
    frame += 1;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= 0.992;
      p.rotation += p.spin;

      const alpha = Math.max(0, Math.min(1, (p.life - frame) / 35));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.55);
      ctx.restore();
    }

    if (particles.some((p) => frame < p.life && p.y < window.innerHeight + 40)) {
      requestAnimationFrame(tick);
    } else {
      canvas.remove();
    }
  };

  requestAnimationFrame(tick);
}

window.SiDaStuffConfetti = { burst };
