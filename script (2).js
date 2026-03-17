// ── 3D TITLE MOUSE TRACKING ──
const titleLines = document.querySelectorAll('.title-line');
const heroSection = document.querySelector('.hero');
if (heroSection) {
  heroSection.addEventListener('mousemove', e => {
    const rect = heroSection.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    titleLines.forEach((line, i) => {
      const depth = 1 + i * 0.4;
      line.style.transform = `rotateY(${dx * 12 * depth}deg) rotateX(${-dy * 8 * depth}deg) translateZ(${i * 6}px)`;
    });
  });
  heroSection.addEventListener('mouseleave', () => {
    titleLines.forEach(line => {
      line.style.transform = 'rotateY(0deg) rotateX(0deg) translateZ(0)';
    });
  });
}

// ── RIPPLE BUTTON ──
document.querySelectorAll('.ripple-btn').forEach(btn => {
  btn.addEventListener('click', function (e) {
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    const ripple = document.createElement('span');
    ripple.classList.add('ripple');
    ripple.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px`;
    btn.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  });
});
const glow = document.querySelector(".cursor-glow");
document.addEventListener("mousemove", e => {
  glow.style.left = e.clientX + "px";
  glow.style.top = e.clientY + "px";
});

// ── TILT CARDS ──
document.querySelectorAll(".tilt").forEach(card => {
  card.addEventListener("mousemove", e => {
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    card.style.transform = `rotateX(${-y * 14}deg) rotateY(${x * 14}deg) scale(1.03)`;
  });
  card.addEventListener("mouseleave", () => {
    card.style.transform = "rotateX(0) rotateY(0) scale(1)";
  });
});

// ── SYSTEM CARD SHIMMER ──
document.querySelectorAll(".system-card").forEach(card => {
  card.addEventListener("mousemove", e => {
    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    card.style.setProperty("--mx", `${x}%`);
    card.style.setProperty("--my", `${y}%`);
  });
});

// ── D3 GLOBE WITH KARNATAKA HIGHLIGHT ──
(function () {
  const canvas = document.getElementById("globe");
  const size = 480;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  // Karnataka centroid (lon, lat)
  const KARNATAKA_CENTER = [76.5, 15.0];
  const GLOBE_R = size / 2 - 10;

  let projection = d3.geoOrthographic()
    .scale(GLOBE_R)
    .translate([size / 2, size / 2])
    .clipAngle(90);

  const path = d3.geoPath(projection, ctx);

  // Rotation state
  let rotation = [0, -20, 0];
  let targetRotation = null;
  let isDragging = false;
  let prevMouse = null;
  let velocity = [0, 0];
  let autoSpin = true;
  let zoomedIn = false;
  let zoomProgress = 0; // 0 = full globe, 1 = zoomed Karnataka

  canvas.style.cursor = "grab";

  // ── DATA ──
  let worldData = null;
  let karnatakaFeature = null;

  // Fetch world topojson + India states geojson
  Promise.all([
    fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json").then(r => r.json()),
    fetch("https://raw.githubusercontent.com/datameet/maps/master/States/karnataka.geojson").then(r => r.json())
  ]).then(([world, kgeo]) => {
    worldData = topojson.feature(world, world.objects.countries);
    karnatakaFeature = kgeo;
    startSequence();
    loop();
  }).catch(() => {
    // fallback: load world only
    fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
      .then(r => r.json())
      .then(world => {
        worldData = topojson.feature(world, world.objects.countries);
        loop();
      });
  });

  // ── SCROLL-DRIVEN ZOOM ──
  const globeSection = document.getElementById("globe-section");

  function getScrollProgress() {
    if (!globeSection) return 0;
    const rect = globeSection.getBoundingClientRect();
    const windowH = window.innerHeight;
    // starts when section top hits bottom of viewport, ends when section center passes midscreen
    const start = windowH;
    const end = windowH * 0.1;
    const pos = rect.top;
    return Math.min(1, Math.max(0, (start - pos) / (start - end)));
  }

  window.addEventListener("scroll", () => {
    if (isDragging) return;
    const p = getScrollProgress();
    if (p > 0.05) {
      autoSpin = false;
      // smoothly face Karnataka as scroll increases
      targetRotation = [-KARNATAKA_CENTER[0], -KARNATAKA_CENTER[1], 0];
      zoomedIn = p > 0.55;
      // drive zoomProgress directly from scroll for snappy feel
      const scrollZoom = Math.min(1, Math.max(0, (p - 0.1) / 0.7));
      zoomProgress += (scrollZoom - zoomProgress) * 0.12;
    } else {
      autoSpin = true;
      zoomedIn = false;
    }
  }, { passive: true });

  // ── SEQUENCE: initial spin only ──
  function startSequence() {
    // just spin until user scrolls
  }

  // ── DRAW ──
  function draw() {
    ctx.clearRect(0, 0, size, size);

    // Lerp zoom
    const targetZoom = zoomedIn ? 1 : 0;
    zoomProgress += (targetZoom - zoomProgress) * 0.03;

    const baseScale = GLOBE_R;
    const zoomedScale = GLOBE_R * 4.5;
    const currentScale = baseScale + (zoomedScale - baseScale) * easeInOut(zoomProgress);
    projection.scale(currentScale);

    // Lerp rotation toward target
    if (targetRotation) {
      rotation[0] += (targetRotation[0] - rotation[0]) * 0.04;
      rotation[1] += (targetRotation[1] - rotation[1]) * 0.04;
    }
    projection.rotate(rotation);

    // Ocean
    ctx.beginPath();
    path({ type: "Sphere" });
    const oceanGrad = ctx.createRadialGradient(size * 0.38, size * 0.35, 0, size / 2, size / 2, currentScale);
    oceanGrad.addColorStop(0, "#1a3a5c");
    oceanGrad.addColorStop(1, "#050e1a");
    ctx.fillStyle = oceanGrad;
    ctx.fill();

    // Countries
    if (worldData) {
      ctx.beginPath();
      path(worldData);
      ctx.fillStyle = "rgba(30, 50, 80, 0.9)";
      ctx.fill();
      ctx.strokeStyle = "rgba(100, 160, 220, 0.2)";
      ctx.lineWidth = 0.4;
      ctx.stroke();
    }

    // Karnataka highlight
    if (karnatakaFeature) {
      // Glow layer
      ctx.save();
      ctx.beginPath();
      path(karnatakaFeature);
      ctx.fillStyle = "rgba(168, 85, 247, 0.25)";
      ctx.shadowColor = "rgba(168, 85, 247, 0.9)";
      ctx.shadowBlur = 18 + 10 * Math.sin(Date.now() * 0.003);
      ctx.fill();
      ctx.restore();

      // Fill
      ctx.beginPath();
      path(karnatakaFeature);
      ctx.fillStyle = "rgba(168, 85, 247, 0.55)";
      ctx.fill();

      // Outline
      ctx.beginPath();
      path(karnatakaFeature);
      ctx.strokeStyle = "rgba(220, 160, 255, 0.95)";
      ctx.lineWidth = zoomProgress > 0.5 ? 1.5 : 0.8;
      ctx.stroke();
    }

    // Globe outline
    ctx.beginPath();
    path({ type: "Sphere" });
    ctx.strokeStyle = "rgba(100, 160, 255, 0.25)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Pin dot at Karnataka center (only when zoomed)
    if (zoomProgress > 0.3 && karnatakaFeature) {
      const [px, py] = projection(KARNATAKA_CENTER) || [];
      if (px && py) {
        const alpha = Math.min(1, (zoomProgress - 0.3) / 0.4);
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 100, 100, ${alpha})`;
        ctx.shadowColor = "rgba(255, 80, 80, 0.9)";
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Pulse ring
        const pulse = (Date.now() % 1500) / 1500;
        ctx.beginPath();
        ctx.arc(px, py, 5 + pulse * 14, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 100, 100, ${alpha * (1 - pulse)})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  // ── LOOP ──
  function loop() {
    if (autoSpin && !isDragging) {
      rotation[0] += 0.15;
    }
    if (!isDragging && !autoSpin) {
      velocity[0] *= 0.9;
      velocity[1] *= 0.9;
      rotation[0] += velocity[0];
      rotation[1] += velocity[1];
    }
    draw();
    requestAnimationFrame(loop);
  }

  // ── DRAG ──
  canvas.addEventListener("mousedown", e => {
    isDragging = true;
    autoSpin = false;
    zoomedIn = false;
    targetRotation = null;
    prevMouse = [e.clientX, e.clientY];
    velocity = [0, 0];
    canvas.style.cursor = "grabbing";
  });

  window.addEventListener("mousemove", e => {
    if (!isDragging) return;
    const dx = e.clientX - prevMouse[0];
    const dy = e.clientY - prevMouse[1];
    const sens = 0.3;
    velocity[0] = dx * sens;
    velocity[1] = -dy * sens;
    rotation[0] += velocity[0];
    rotation[1] += velocity[1];
    prevMouse = [e.clientX, e.clientY];
  });

  window.addEventListener("mouseup", () => {
    if (!isDragging) return;
    isDragging = false;
    canvas.style.cursor = "grab";
  });

  // Touch
  canvas.addEventListener("touchstart", e => {
    isDragging = true;
    autoSpin = false;
    zoomedIn = false;
    targetRotation = null;
    prevMouse = [e.touches[0].clientX, e.touches[0].clientY];
    velocity = [0, 0];
  }, { passive: true });

  window.addEventListener("touchmove", e => {
    if (!isDragging) return;
    const dx = e.touches[0].clientX - prevMouse[0];
    const dy = e.touches[0].clientY - prevMouse[1];
    rotation[0] += dx * 0.3;
    rotation[1] -= dy * 0.3;
    prevMouse = [e.touches[0].clientX, e.touches[0].clientY];
  }, { passive: true });

  window.addEventListener("touchend", () => {
    isDragging = false;
  });
})();

// ── CONTACT TITLE — replay animation on scroll into view ──
const contactSection = document.querySelector('#contact');
const animatedWords = document.querySelectorAll('#contact .word, #contact .contact-sub');

const contactObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      animatedWords.forEach(el => {
        el.style.animation = 'none';
        el.offsetHeight; // reflow
        el.style.animation = '';
      });
    }
  });
}, { threshold: 0.3 });

if (contactSection) contactObserver.observe(contactSection);
