(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const livesEl = document.getElementById("lives");
  const levelEl = document.getElementById("level");
  const overlay = document.getElementById("overlay");
  const startBtn = document.getElementById("startBtn");

  const W = canvas.width;
  const H = canvas.height;

  // ---------- Game state ----------
  const state = {
    running: false,
    paused: false,
    score: 0,
    lives: 3,
    level: 1,
    spawnTimer: 0,
    spawnInterval: 850, // ms
    items: [],
    particles: [],
    clouds: [],
    lastTime: 0,
  };

  const kitty = {
    x: W / 2,
    y: H - 90,
    w: 110,
    h: 110,
    speed: 360, // px/sec (keyboard)
    targetX: W / 2,
    facing: 1,
    blinkTimer: 0,
    isBlinking: false,
  };

  const input = { left: false, right: false, mouseX: null };

  // ---------- Background clouds ----------
  function initClouds() {
    state.clouds = [];
    for (let i = 0; i < 5; i++) {
      state.clouds.push({
        x: Math.random() * W,
        y: 40 + Math.random() * 180,
        r: 28 + Math.random() * 22,
        speed: 8 + Math.random() * 12,
      });
    }
  }
  initClouds();

  // ---------- Input ----------
  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft" || e.key === "a") input.left = true;
    if (e.key === "ArrowRight" || e.key === "d") input.right = true;
    if (e.key === "p" || e.key === "P") togglePause();
    if (e.key === " " && !state.running) startGame();
  });
  window.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft" || e.key === "a") input.left = false;
    if (e.key === "ArrowRight" || e.key === "d") input.right = false;
  });

  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    input.mouseX = (e.clientX - rect.left) * scaleX;
  });
  canvas.addEventListener("mouseleave", () => {
    input.mouseX = null;
  });
  canvas.addEventListener(
    "touchmove",
    (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      input.mouseX = (e.touches[0].clientX - rect.left) * scaleX;
      e.preventDefault();
    },
    { passive: false }
  );

  startBtn.addEventListener("click", startGame);

  function togglePause() {
    if (!state.running) return;
    state.paused = !state.paused;
    if (state.paused) {
      showOverlay("Pause", "Drücke P zum Weiterspielen", "Weiter");
    } else {
      hideOverlay();
    }
  }

  // ---------- Overlay helpers ----------
  function showOverlay(title, subtitle, btnText) {
    overlay.classList.remove("hidden");
    overlay.querySelector("h1").textContent = title;
    overlay.querySelector(".subtitle").textContent = subtitle;
    startBtn.textContent = btnText;
  }
  function hideOverlay() {
    overlay.classList.add("hidden");
  }

  // ---------- Start / reset ----------
  function startGame() {
    state.running = true;
    state.paused = false;
    state.score = 0;
    state.lives = 3;
    state.level = 1;
    state.items = [];
    state.particles = [];
    state.spawnInterval = 850;
    state.spawnTimer = 0;
    kitty.x = W / 2;
    kitty.targetX = W / 2;
    updateHUD();
    hideOverlay();
    state.lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function gameOver() {
    state.running = false;
    showOverlay(
      "Game Over",
      `Punkte: ${state.score}  ·  Level: ${state.level}`,
      "Noch einmal"
    );
  }

  function updateHUD() {
    scoreEl.textContent = state.score;
    livesEl.textContent = "❤".repeat(state.lives) || "—";
    levelEl.textContent = state.level;
  }

  // ---------- Item spawning ----------
  const ITEM_TYPES = [
    { kind: "heart",  emoji: "💖", points: 10, weight: 5, color: "#ff3d79" },
    { kind: "star",   emoji: "⭐", points: 20, weight: 3, color: "#ffcc29" },
    { kind: "bow",    emoji: "🎀", points: 15, weight: 3, color: "#ff8fc0" },
    { kind: "cherry", emoji: "🍒", points: 25, weight: 2, color: "#e63946" },
    { kind: "cloud",  emoji: "⛈",  points: 0,  weight: 3, color: "#6b7280", bad: true },
  ];

  function pickItemType() {
    const total = ITEM_TYPES.reduce((s, t) => s + t.weight, 0);
    let r = Math.random() * total;
    for (const t of ITEM_TYPES) {
      if (r < t.weight) return t;
      r -= t.weight;
    }
    return ITEM_TYPES[0];
  }

  function spawnItem() {
    const type = pickItemType();
    state.items.push({
      type,
      x: 40 + Math.random() * (W - 80),
      y: -40,
      size: 44,
      vy: 120 + Math.random() * 60 + state.level * 20,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 2,
    });
  }

  // ---------- Particles ----------
  function spawnBurst(x, y, color, count = 14) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 80 + Math.random() * 140;
      state.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 40,
        life: 0.6 + Math.random() * 0.3,
        age: 0,
        color,
        size: 3 + Math.random() * 3,
      });
    }
  }

  // ---------- Update ----------
  function update(dt) {
    // Kitty movement
    if (input.mouseX !== null) {
      kitty.targetX = input.mouseX;
    } else {
      if (input.left) kitty.targetX -= kitty.speed * dt;
      if (input.right) kitty.targetX += kitty.speed * dt;
    }
    kitty.targetX = Math.max(kitty.w / 2, Math.min(W - kitty.w / 2, kitty.targetX));
    const dx = kitty.targetX - kitty.x;
    kitty.facing = dx > 1 ? 1 : dx < -1 ? -1 : kitty.facing;
    kitty.x += dx * Math.min(1, dt * 10);

    // Blink
    kitty.blinkTimer -= dt;
    if (kitty.blinkTimer <= 0) {
      kitty.isBlinking = !kitty.isBlinking;
      kitty.blinkTimer = kitty.isBlinking ? 0.12 : 2 + Math.random() * 2;
    }

    // Background clouds
    for (const c of state.clouds) {
      c.x += c.speed * dt;
      if (c.x - c.r > W) c.x = -c.r;
    }

    // Spawn
    state.spawnTimer += dt * 1000;
    if (state.spawnTimer >= state.spawnInterval) {
      state.spawnTimer = 0;
      spawnItem();
    }

    // Items
    for (let i = state.items.length - 1; i >= 0; i--) {
      const it = state.items[i];
      it.y += it.vy * dt;
      it.rot += it.vr * dt;

      // Collision with kitty (circle-ish)
      const cx = kitty.x;
      const cy = kitty.y + 10;
      const rx = kitty.w * 0.40;
      const ry = kitty.h * 0.42;
      const dx2 = (it.x - cx) / rx;
      const dy2 = (it.y - cy) / ry;
      const hit = dx2 * dx2 + dy2 * dy2 <= 1;

      if (hit) {
        if (it.type.bad) {
          state.lives--;
          spawnBurst(it.x, it.y, "#6b7280", 18);
          updateHUD();
          if (state.lives <= 0) {
            state.items.splice(i, 1);
            gameOver();
            return;
          }
        } else {
          state.score += it.type.points;
          spawnBurst(it.x, it.y, it.type.color);
          updateHUD();
          // Level up
          const newLevel = 1 + Math.floor(state.score / 150);
          if (newLevel !== state.level) {
            state.level = newLevel;
            state.spawnInterval = Math.max(320, 850 - (state.level - 1) * 55);
            updateHUD();
          }
        }
        state.items.splice(i, 1);
        continue;
      }

      // Off screen
      if (it.y - it.size > H) {
        if (!it.type.bad) {
          // Missed a good item – small penalty on hearts? keep it gentle
        }
        state.items.splice(i, 1);
      }
    }

    // Particles
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        state.particles.splice(i, 1);
        continue;
      }
      p.vy += 380 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  // ---------- Drawing ----------
  function drawBackground() {
    // Sky gradient is on canvas background; add sun + hills
    // Sun
    ctx.save();
    ctx.globalAlpha = 0.9;
    const sunX = W - 90;
    const sunY = 90;
    const grad = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 70);
    grad.addColorStop(0, "#fff7c2");
    grad.addColorStop(1, "rgba(255,247,194,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(sunX - 70, sunY - 70, 140, 140);
    ctx.fillStyle = "#ffe17a";
    ctx.beginPath();
    ctx.arc(sunX, sunY, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Background clouds
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    for (const c of state.clouds) {
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.arc(c.x + c.r * 0.8, c.y + 6, c.r * 0.8, 0, Math.PI * 2);
      ctx.arc(c.x - c.r * 0.9, c.y + 8, c.r * 0.7, 0, Math.PI * 2);
      ctx.arc(c.x + c.r * 0.2, c.y - c.r * 0.6, c.r * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Ground hills
    ctx.save();
    ctx.fillStyle = "#8bd98b";
    ctx.beginPath();
    ctx.moveTo(0, H - 40);
    ctx.quadraticCurveTo(W * 0.25, H - 110, W * 0.5, H - 50);
    ctx.quadraticCurveTo(W * 0.75, H - 10, W, H - 70);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();

    // Flowers on ground
    for (let i = 0; i < 8; i++) {
      const fx = ((i * 83 + 20) % W);
      const fy = H - 22 + Math.sin(i) * 6;
      drawFlower(fx, fy, 6, i % 2 ? "#ff8fc0" : "#fff176");
    }
    ctx.restore();
  }

  function drawFlower(x, y, r, color) {
    ctx.save();
    ctx.fillStyle = color;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#ffeb3b";
    ctx.beginPath();
    ctx.arc(x, y, r * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Draw Hello Kitty (stylized, original shapes)
  function drawKitty(x, y, w, h) {
    ctx.save();
    ctx.translate(x, y);

    // Body (sitting, pink dress)
    ctx.fillStyle = "#ff7ab0";
    roundRect(-w * 0.38, h * 0.05, w * 0.76, h * 0.45, 20);
    ctx.fill();
    // Dress collar dots
    ctx.fillStyle = "#fff";
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.arc(i * 12, h * 0.1, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Arms
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 2;
    // left arm
    ctx.beginPath();
    ctx.ellipse(-w * 0.42, h * 0.18, 10, 16, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // right arm
    ctx.beginPath();
    ctx.ellipse(w * 0.42, h * 0.18, 10, 16, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Head
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.18, w * 0.42, h * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Ears
    ctx.beginPath();
    ctx.moveTo(-w * 0.38, -h * 0.35);
    ctx.lineTo(-w * 0.18, -h * 0.58);
    ctx.lineTo(-w * 0.12, -h * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(w * 0.38, -h * 0.35);
    ctx.lineTo(w * 0.18, -h * 0.58);
    ctx.lineTo(w * 0.12, -h * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Ear inner (pink)
    ctx.fillStyle = "#ffb6d5";
    ctx.beginPath();
    ctx.moveTo(-w * 0.32, -h * 0.38);
    ctx.lineTo(-w * 0.2, -h * 0.52);
    ctx.lineTo(-w * 0.16, -h * 0.38);
    ctx.closePath();
    ctx.fill();

    // Bow on right ear
    const bowX = w * 0.22;
    const bowY = -h * 0.45;
    ctx.fillStyle = "#ff3d79";
    ctx.beginPath();
    ctx.ellipse(bowX - 10, bowY, 10, 7, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(bowX + 10, bowY, 10, 7, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bowX, bowY, 5, 0, Math.PI * 2);
    ctx.fill();
    // Bow dots
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(bowX - 10, bowY, 2, 0, Math.PI * 2);
    ctx.arc(bowX + 10, bowY, 2, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = "#222";
    if (kitty.isBlinking) {
      ctx.strokeStyle = "#222";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-18, -h * 0.2);
      ctx.lineTo(-8, -h * 0.2);
      ctx.moveTo(8, -h * 0.2);
      ctx.lineTo(18, -h * 0.2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.ellipse(-13, -h * 0.2, 4, 6, 0, 0, Math.PI * 2);
      ctx.ellipse(13, -h * 0.2, 4, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      // eye shine
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(-12, -h * 0.22, 1.3, 0, Math.PI * 2);
      ctx.arc(14, -h * 0.22, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Nose (yellow)
    ctx.fillStyle = "#ffcc29";
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.13, 5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Whiskers
    ctx.strokeStyle = "#444";
    ctx.lineWidth = 2;
    ctx.beginPath();
    // left
    ctx.moveTo(-14, -h * 0.1); ctx.lineTo(-34, -h * 0.14);
    ctx.moveTo(-14, -h * 0.08); ctx.lineTo(-34, -h * 0.07);
    ctx.moveTo(-14, -h * 0.06); ctx.lineTo(-34, 0);
    // right
    ctx.moveTo(14, -h * 0.1); ctx.lineTo(34, -h * 0.14);
    ctx.moveTo(14, -h * 0.08); ctx.lineTo(34, -h * 0.07);
    ctx.moveTo(14, -h * 0.06); ctx.lineTo(34, 0);
    ctx.stroke();

    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawItem(it) {
    ctx.save();
    ctx.translate(it.x, it.y);
    ctx.rotate(it.rot);
    ctx.font = `${it.size}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(it.type.emoji, 0, 0);
    ctx.restore();
  }

  function drawParticles() {
    for (const p of state.particles) {
      const t = 1 - p.age / p.life;
      ctx.globalAlpha = t;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawBackground();

    // Items
    for (const it of state.items) drawItem(it);

    // Kitty
    drawKitty(kitty.x, kitty.y, kitty.w, kitty.h);

    // Particles on top
    drawParticles();
  }

  // ---------- Main loop ----------
  function loop(now) {
    const dt = Math.min(0.05, (now - state.lastTime) / 1000);
    state.lastTime = now;

    if (state.running && !state.paused) {
      update(dt);
    } else {
      // Still animate clouds on title screen
      for (const c of state.clouds) {
        c.x += c.speed * dt;
        if (c.x - c.r > W) c.x = -c.r;
      }
    }

    draw();

    if (state.running || overlay.classList.contains("hidden") === false) {
      requestAnimationFrame(loop);
    }
  }

  // Kick off an idle loop so background is animated on start screen
  state.lastTime = performance.now();
  requestAnimationFrame(loop);
})();
