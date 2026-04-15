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
    spawnInterval: 650, // ms
    items: [],
    particles: [],
    clouds: [],
    stars: [],
    sparkles: [],
    time: 0,
    lastTime: 0,
  };

  const kitty = {
    x: W / 2,
    y: H - 110,
    w: 140,
    h: 130,
    speed: 440, // px/sec (keyboard)
    targetX: W / 2,
    facing: 1,
    blinkTimer: 0,
    isBlinking: false,
  };

  const input = { left: false, right: false, mouseX: null };

  // ---------- Background decoration ----------
  function initBackground() {
    state.clouds = [];
    for (let i = 0; i < 4; i++) {
      state.clouds.push({
        x: Math.random() * W,
        y: 60 + Math.random() * 180,
        r: 26 + Math.random() * 18,
        speed: 6 + Math.random() * 10,
      });
    }
    state.stars = [];
    for (let i = 0; i < 60; i++) {
      state.stars.push({
        x: Math.random() * W,
        y: Math.random() * (H * 0.55),
        r: 0.6 + Math.random() * 1.8,
        twinkle: Math.random() * Math.PI * 2,
        twinkleSpeed: 1 + Math.random() * 2,
      });
    }
    state.sparkles = [];
    for (let i = 0; i < 20; i++) {
      state.sparkles.push({
        x: Math.random() * W,
        y: Math.random() * H * 0.7,
        r: 1.5 + Math.random() * 2.5,
        phase: Math.random() * Math.PI * 2,
        speed: 0.8 + Math.random() * 1.2,
      });
    }
  }
  initBackground();

  function updateBackground(dt) {
    for (const c of state.clouds) {
      c.x += c.speed * dt;
      if (c.x - c.r > W) c.x = -c.r;
    }
    for (const s of state.stars) {
      s.twinkle += s.twinkleSpeed * dt;
    }
    for (const sp of state.sparkles) {
      sp.phase += sp.speed * dt;
      sp.y -= 6 * dt;
      if (sp.y < -10) {
        sp.y = H * 0.7 + Math.random() * 40;
        sp.x = Math.random() * W;
      }
    }
  }

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
    state.spawnInterval = 650;
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
    // Keep sensitive items upright, let stars/bows wobble gently
    const canRotate = type.kind === "star" || type.kind === "bow" || type.kind === "cloud";
    state.items.push({
      type,
      x: 40 + Math.random() * (W - 80),
      y: -40,
      size: 56,
      vy: 260 + Math.random() * 120 + state.level * 40,
      rot: canRotate ? (Math.random() - 0.5) * 0.4 : 0,
      vr: canRotate ? (Math.random() - 0.5) * 1.2 : 0,
      wobble: Math.random() * Math.PI * 2,
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

    // Background decoration
    updateBackground(dt);

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

      // Collision with kitty head (oval around face)
      const cx = kitty.x;
      const cy = kitty.y;
      const rx = kitty.w * 0.55;
      const ry = kitty.h * 0.48;
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
            state.spawnInterval = Math.max(220, 650 - (state.level - 1) * 55);
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
    // Magical twilight sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#2a1b4e");
    sky.addColorStop(0.25, "#5a2a7a");
    sky.addColorStop(0.5, "#c24a9a");
    sky.addColorStop(0.75, "#ff8fc0");
    sky.addColorStop(1, "#ffd1e8");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Twinkling stars
    ctx.save();
    ctx.fillStyle = "#fff";
    for (const s of state.stars) {
      const a = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(s.twinkle));
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // Big glowing moon with crater
    ctx.save();
    const moonX = 90;
    const moonY = 95;
    const glow = ctx.createRadialGradient(moonX, moonY, 20, moonX, moonY, 90);
    glow.addColorStop(0, "rgba(255,248,220,0.55)");
    glow.addColorStop(1, "rgba(255,248,220,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(moonX - 90, moonY - 90, 180, 180);
    ctx.fillStyle = "#fff8dc";
    ctx.beginPath();
    ctx.arc(moonX, moonY, 38, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(210,190,140,0.4)";
    ctx.beginPath();
    ctx.arc(moonX - 10, moonY - 8, 6, 0, Math.PI * 2);
    ctx.arc(moonX + 12, moonY + 6, 4, 0, Math.PI * 2);
    ctx.arc(moonX + 4, moonY - 14, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Rainbow arch
    ctx.save();
    const rbX = W * 0.5;
    const rbY = H * 0.72;
    const rbR = 280;
    const colors = ["#ff4d6d", "#ff9a3c", "#ffe14d", "#5ed35e", "#4db8ff", "#9b5de5"];
    ctx.lineWidth = 10;
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < colors.length; i++) {
      ctx.strokeStyle = colors[i];
      ctx.beginPath();
      ctx.arc(rbX, rbY, rbR - i * 10, Math.PI, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // Soft candy clouds
    ctx.save();
    for (const c of state.clouds) {
      const g = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, c.r * 1.8);
      g.addColorStop(0, "rgba(255,255,255,0.95)");
      g.addColorStop(1, "rgba(255,200,230,0.1)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.arc(c.x + c.r * 0.8, c.y + 6, c.r * 0.8, 0, Math.PI * 2);
      ctx.arc(c.x - c.r * 0.9, c.y + 8, c.r * 0.7, 0, Math.PI * 2);
      ctx.arc(c.x + c.r * 0.2, c.y - c.r * 0.6, c.r * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Fairytale castle silhouette
    drawCastle(W * 0.78, H * 0.68);

    // Sparkles
    ctx.save();
    ctx.fillStyle = "#fff";
    for (const sp of state.sparkles) {
      const a = 0.5 + 0.5 * Math.sin(sp.phase);
      ctx.globalAlpha = a;
      drawSparkle(sp.x, sp.y, sp.r);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // Candy ground (two layers of hills)
    ctx.save();
    const hill2 = ctx.createLinearGradient(0, H - 120, 0, H);
    hill2.addColorStop(0, "#ff8fc0");
    hill2.addColorStop(1, "#d63384");
    ctx.fillStyle = hill2;
    ctx.beginPath();
    ctx.moveTo(0, H - 60);
    ctx.quadraticCurveTo(W * 0.2, H - 130, W * 0.45, H - 70);
    ctx.quadraticCurveTo(W * 0.7, H - 20, W, H - 80);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();

    const hill1 = ctx.createLinearGradient(0, H - 60, 0, H);
    hill1.addColorStop(0, "#ffd1e8");
    hill1.addColorStop(1, "#ff8fc0");
    ctx.fillStyle = hill1;
    ctx.beginPath();
    ctx.moveTo(0, H - 30);
    ctx.quadraticCurveTo(W * 0.3, H - 80, W * 0.55, H - 40);
    ctx.quadraticCurveTo(W * 0.82, H - 5, W, H - 50);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();

    // Flowers on ground
    for (let i = 0; i < 10; i++) {
      const fx = ((i * 71 + 25) % W);
      const fy = H - 18 + Math.sin(i * 1.3) * 4;
      drawFlower(fx, fy, 6, i % 3 === 0 ? "#fff176" : i % 2 ? "#ff3d79" : "#9b5de5");
    }
    ctx.restore();
  }

  function drawCastle(x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(60,30,80,0.75)";
    // main keep
    ctx.fillRect(-40, -80, 80, 110);
    // side towers
    ctx.fillRect(-70, -60, 25, 90);
    ctx.fillRect(45, -60, 25, 90);
    // roofs
    ctx.fillStyle = "rgba(120,50,130,0.85)";
    ctx.beginPath();
    ctx.moveTo(-42, -80); ctx.lineTo(0, -120); ctx.lineTo(42, -80); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-72, -60); ctx.lineTo(-57, -90); ctx.lineTo(-43, -60); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(43, -60); ctx.lineTo(58, -90); ctx.lineTo(73, -60); ctx.closePath(); ctx.fill();
    // windows (lit)
    ctx.fillStyle = "#ffe17a";
    ctx.fillRect(-6, -55, 12, 16);
    ctx.fillRect(-55, -40, 6, 10);
    ctx.fillRect(49, -40, 6, 10);
    // flag
    ctx.strokeStyle = "rgba(60,30,80,0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -120); ctx.lineTo(0, -140); ctx.stroke();
    ctx.fillStyle = "#ff3d79";
    ctx.beginPath();
    ctx.moveTo(0, -140); ctx.lineTo(14, -135); ctx.lineTo(0, -130); ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawSparkle(x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y - r * 2);
    ctx.lineTo(x + r * 0.4, y - r * 0.4);
    ctx.lineTo(x + r * 2, y);
    ctx.lineTo(x + r * 0.4, y + r * 0.4);
    ctx.lineTo(x, y + r * 2);
    ctx.lineTo(x - r * 0.4, y + r * 0.4);
    ctx.lineTo(x - r * 2, y);
    ctx.lineTo(x - r * 0.4, y - r * 0.4);
    ctx.closePath();
    ctx.fill();
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
  // Draw Hello Kitty (head only, floating)
  function drawKitty(x, y, w, h) {
    ctx.save();
    ctx.translate(x, y);

    // Soft bounce while floating
    const bounce = Math.sin(state.time * 3) * 3;
    ctx.translate(0, bounce);

    // --- Magical aura glow ---
    ctx.save();
    const aura = ctx.createRadialGradient(0, 0, 10, 0, 0, w * 0.95);
    aura.addColorStop(0, "rgba(255, 200, 230, 0.55)");
    aura.addColorStop(0.5, "rgba(255, 180, 220, 0.22)");
    aura.addColorStop(1, "rgba(255, 180, 220, 0)");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, w * 0.95, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Ground shadow
    ctx.save();
    ctx.fillStyle = "rgba(60, 20, 60, 0.3)";
    ctx.beginPath();
    ctx.ellipse(0, h * 0.58, w * 0.42, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // --- Head with soft gradient shading ---
    const headGrad = ctx.createRadialGradient(-15, -15, 8, 0, 0, w * 0.65);
    headGrad.addColorStop(0, "#ffffff");
    headGrad.addColorStop(0.7, "#fff5fa");
    headGrad.addColorStop(1, "#f0d5e2");
    ctx.fillStyle = headGrad;
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.58, h * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // --- Ears ---
    ctx.fillStyle = headGrad;
    // left ear
    ctx.beginPath();
    ctx.moveTo(-w * 0.52, -h * 0.2);
    ctx.quadraticCurveTo(-w * 0.40, -h * 0.55, -w * 0.14, -h * 0.23);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // right ear
    ctx.beginPath();
    ctx.moveTo(w * 0.52, -h * 0.2);
    ctx.quadraticCurveTo(w * 0.40, -h * 0.55, w * 0.14, -h * 0.23);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Ear inner pink (both ears)
    ctx.fillStyle = "#ffb6d5";
    ctx.beginPath();
    ctx.moveTo(-w * 0.42, -h * 0.24);
    ctx.quadraticCurveTo(-w * 0.34, -h * 0.47, -w * 0.20, -h * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w * 0.42, -h * 0.24);
    ctx.quadraticCurveTo(w * 0.34, -h * 0.47, w * 0.20, -h * 0.25);
    ctx.closePath();
    ctx.fill();

    // --- Tiny tiara on top ---
    ctx.save();
    ctx.translate(0, -h * 0.42);
    ctx.fillStyle = "#ffd65e";
    ctx.strokeStyle = "#b8860b";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-14, 4);
    ctx.lineTo(-10, -6);
    ctx.lineTo(-5, 2);
    ctx.lineTo(0, -8);
    ctx.lineTo(5, 2);
    ctx.lineTo(10, -6);
    ctx.lineTo(14, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ff3d79";
    ctx.beginPath();
    ctx.arc(0, -6, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4db8ff";
    ctx.beginPath();
    ctx.arc(-10, -4, 1.3, 0, Math.PI * 2);
    ctx.arc(10, -4, 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // --- Flower on right ear ---
    ctx.save();
    ctx.translate(w * 0.34, -h * 0.38);
    const petalColors = ["#ff8fc0", "#ffb6d5", "#ff8fc0", "#ffb6d5", "#ff8fc0"];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.fillStyle = petalColors[i];
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 5, Math.sin(a) * 5, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#ffd65e";
    ctx.beginPath();
    ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // --- Bow on left ear (big and fancy) ---
    const bowX = -w * 0.34;
    const bowY = -h * 0.38;
    // bow back layer
    ctx.fillStyle = "#c72864";
    ctx.strokeStyle = "#7a1f4a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(bowX - 14, bowY + 1, 15, 11, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(bowX + 14, bowY + 1, 15, 11, 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // bow main
    ctx.fillStyle = "#ff3d79";
    ctx.beginPath();
    ctx.ellipse(bowX - 13, bowY, 14, 10, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(bowX + 13, bowY, 14, 10, 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // bow highlight
    ctx.fillStyle = "rgba(255,200,220,0.9)";
    ctx.beginPath();
    ctx.ellipse(bowX - 13, bowY - 4, 8, 3, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(bowX + 13, bowY - 4, 8, 3, 0.35, 0, Math.PI * 2);
    ctx.fill();
    // ribbon tails
    ctx.fillStyle = "#ff3d79";
    ctx.strokeStyle = "#7a1f4a";
    ctx.beginPath();
    ctx.moveTo(bowX - 2, bowY + 5);
    ctx.quadraticCurveTo(bowX - 8, bowY + 14, bowX - 10, bowY + 20);
    ctx.lineTo(bowX - 4, bowY + 18);
    ctx.quadraticCurveTo(bowX - 2, bowY + 12, bowX, bowY + 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bowX + 2, bowY + 5);
    ctx.quadraticCurveTo(bowX + 8, bowY + 14, bowX + 10, bowY + 20);
    ctx.lineTo(bowX + 4, bowY + 18);
    ctx.quadraticCurveTo(bowX + 2, bowY + 12, bowX, bowY + 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // knot
    ctx.fillStyle = "#ff3d79";
    ctx.beginPath();
    ctx.arc(bowX, bowY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // white dots on bow
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(bowX - 14, bowY + 1, 1.7, 0, Math.PI * 2);
    ctx.arc(bowX - 8, bowY - 3, 1.4, 0, Math.PI * 2);
    ctx.arc(bowX + 14, bowY + 1, 1.7, 0, Math.PI * 2);
    ctx.arc(bowX + 8, bowY - 3, 1.4, 0, Math.PI * 2);
    ctx.fill();

    // --- Blush cheeks with gradient ---
    ctx.save();
    const blushL = ctx.createRadialGradient(-w * 0.35, h * 0.08, 1, -w * 0.35, h * 0.08, 10);
    blushL.addColorStop(0, "rgba(255, 120, 170, 0.85)");
    blushL.addColorStop(1, "rgba(255, 120, 170, 0)");
    ctx.fillStyle = blushL;
    ctx.fillRect(-w * 0.35 - 12, h * 0.08 - 12, 24, 24);
    const blushR = ctx.createRadialGradient(w * 0.35, h * 0.08, 1, w * 0.35, h * 0.08, 10);
    blushR.addColorStop(0, "rgba(255, 120, 170, 0.85)");
    blushR.addColorStop(1, "rgba(255, 120, 170, 0)");
    ctx.fillStyle = blushR;
    ctx.fillRect(w * 0.35 - 12, h * 0.08 - 12, 24, 24);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.beginPath();
    ctx.arc(-w * 0.37, h * 0.07, 1.4, 0, Math.PI * 2);
    ctx.arc(w * 0.33, h * 0.07, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // --- Eyes (bigger, sparkly with eyelashes) ---
    const eyeY = -h * 0.02;
    if (kitty.isBlinking) {
      ctx.strokeStyle = "#222";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-22, eyeY);
      ctx.quadraticCurveTo(-15, eyeY + 4, -8, eyeY);
      ctx.moveTo(8, eyeY);
      ctx.quadraticCurveTo(15, eyeY + 4, 22, eyeY);
      ctx.stroke();
      // blinking lashes
      ctx.beginPath();
      ctx.moveTo(-22, eyeY); ctx.lineTo(-25, eyeY - 4);
      ctx.moveTo(-16, eyeY + 2); ctx.lineTo(-17, eyeY - 3);
      ctx.moveTo(22, eyeY); ctx.lineTo(25, eyeY - 4);
      ctx.moveTo(16, eyeY + 2); ctx.lineTo(17, eyeY - 3);
      ctx.stroke();
      ctx.lineCap = "butt";
    } else {
      // eye base (oval)
      ctx.fillStyle = "#2a1b4e";
      ctx.beginPath();
      ctx.ellipse(-15, eyeY, 6.5, 10, 0, 0, Math.PI * 2);
      ctx.ellipse(15, eyeY, 6.5, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      // purple iris
      ctx.fillStyle = "#6b3a8a";
      ctx.beginPath();
      ctx.ellipse(-15, eyeY + 1, 4.5, 7, 0, 0, Math.PI * 2);
      ctx.ellipse(15, eyeY + 1, 4.5, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      // heart-shaped shine
      ctx.fillStyle = "#fff";
      drawHeartShape(-13, eyeY - 2, 2.4);
      drawHeartShape(17, eyeY - 2, 2.4);
      // small shines
      ctx.beginPath();
      ctx.arc(-17, eyeY + 3, 1.1, 0, Math.PI * 2);
      ctx.arc(13, eyeY + 3, 1.1, 0, Math.PI * 2);
      ctx.fill();
      // eyelashes
      ctx.strokeStyle = "#222";
      ctx.lineWidth = 1.8;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-21, eyeY - 7); ctx.lineTo(-26, eyeY - 11);
      ctx.moveTo(-16, eyeY - 9); ctx.lineTo(-18, eyeY - 14);
      ctx.moveTo(-10, eyeY - 9); ctx.lineTo(-9, eyeY - 14);
      ctx.moveTo(21, eyeY - 7); ctx.lineTo(26, eyeY - 11);
      ctx.moveTo(16, eyeY - 9); ctx.lineTo(18, eyeY - 14);
      ctx.moveTo(10, eyeY - 9); ctx.lineTo(9, eyeY - 14);
      ctx.stroke();
      ctx.lineCap = "butt";
    }

    // --- Nose (yellow with shine) ---
    ctx.fillStyle = "#ffcc29";
    ctx.strokeStyle = "#b8860b";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, h * 0.10, 6, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff7c2";
    ctx.beginPath();
    ctx.arc(-1.8, h * 0.09, 1.4, 0, Math.PI * 2);
    ctx.fill();

    // --- Tiny smile ---
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 1.6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-3, h * 0.16);
    ctx.quadraticCurveTo(0, h * 0.18, 3, h * 0.16);
    ctx.stroke();
    ctx.lineCap = "butt";

    // --- Whiskers ---
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 1.8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-16, h * 0.12); ctx.quadraticCurveTo(-30, h * 0.09, -44, h * 0.08);
    ctx.moveTo(-16, h * 0.15); ctx.quadraticCurveTo(-30, h * 0.15, -44, h * 0.16);
    ctx.moveTo(-16, h * 0.18); ctx.quadraticCurveTo(-30, h * 0.21, -44, h * 0.24);
    ctx.moveTo(16, h * 0.12); ctx.quadraticCurveTo(30, h * 0.09, 44, h * 0.08);
    ctx.moveTo(16, h * 0.15); ctx.quadraticCurveTo(30, h * 0.15, 44, h * 0.16);
    ctx.moveTo(16, h * 0.18); ctx.quadraticCurveTo(30, h * 0.21, 44, h * 0.24);
    ctx.stroke();
    ctx.lineCap = "butt";

    // --- Orbiting sparkles around head ---
    ctx.save();
    ctx.fillStyle = "rgba(255, 240, 180, 0.95)";
    for (let i = 0; i < 6; i++) {
      const a = state.time * 1.5 + (i / 6) * Math.PI * 2;
      const ox = Math.cos(a) * w * 0.75;
      const oy = Math.sin(a) * h * 0.55;
      drawSparkle(ox, oy, 1.6 + Math.sin(state.time * 4 + i) * 0.6);
    }
    ctx.restore();

    ctx.restore();
  }

  function drawHeartShape(x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, s * 0.6);
    ctx.bezierCurveTo(s * 1.2, -s * 0.2, s * 0.6, -s * 1.3, 0, -s * 0.5);
    ctx.bezierCurveTo(-s * 0.6, -s * 1.3, -s * 1.2, -s * 0.2, 0, s * 0.6);
    ctx.closePath();
    ctx.fill();
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
    const tilt = Math.sin(state.time * 3 + it.wobble) * 0.15;
    ctx.rotate(it.rot + tilt);
    const pulse = 1 + Math.sin(state.time * 4 + it.wobble) * 0.05;
    ctx.scale(pulse, pulse);
    const s = it.size * 0.5;
    switch (it.type.kind) {
      case "heart":  drawHeartItem(s);  break;
      case "star":   drawStarItem(s);   break;
      case "bow":    drawBowItem(s);    break;
      case "cherry": drawCherryItem(s); break;
      case "cloud":  drawStormItem(s);  break;
    }
    ctx.restore();
  }

  function drawHeartItem(s) {
    // soft outer glow
    ctx.save();
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, s * 1.8);
    glow.addColorStop(0, "rgba(255, 100, 160, 0.5)");
    glow.addColorStop(1, "rgba(255, 100, 160, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(-s * 2, -s * 2, s * 4, s * 4);
    ctx.restore();
    // heart body with gradient
    const g = ctx.createRadialGradient(-s * 0.3, -s * 0.4, 1, 0, 0, s * 1.3);
    g.addColorStop(0, "#ffb6d5");
    g.addColorStop(0.6, "#ff3d79");
    g.addColorStop(1, "#b8185a");
    ctx.fillStyle = g;
    ctx.strokeStyle = "#7a1f4a";
    ctx.lineWidth = 2;
    heartPath(0, 0, s);
    ctx.fill();
    ctx.stroke();
    // shine
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.ellipse(-s * 0.35, -s * 0.35, s * 0.25, s * 0.4, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(s * 0.2, -s * 0.1, s * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  function heartPath(cx, cy, s) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.7);
    ctx.bezierCurveTo(cx + s * 1.3, cy - s * 0.1, cx + s * 0.7, cy - s * 1.2, cx, cy - s * 0.4);
    ctx.bezierCurveTo(cx - s * 0.7, cy - s * 1.2, cx - s * 1.3, cy - s * 0.1, cx, cy + s * 0.7);
    ctx.closePath();
  }

  function drawStarItem(s) {
    // glow
    ctx.save();
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, s * 2);
    glow.addColorStop(0, "rgba(255, 240, 150, 0.6)");
    glow.addColorStop(1, "rgba(255, 240, 150, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(-s * 2, -s * 2, s * 4, s * 4);
    ctx.restore();

    // star shape
    const g = ctx.createRadialGradient(-s * 0.3, -s * 0.3, 1, 0, 0, s * 1.4);
    g.addColorStop(0, "#fffbe0");
    g.addColorStop(0.5, "#ffd65e");
    g.addColorStop(1, "#d48806");
    ctx.fillStyle = g;
    ctx.strokeStyle = "#7a5a00";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? s * 1.1 : s * 0.45;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // shine
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.ellipse(-s * 0.3, -s * 0.35, s * 0.2, s * 0.35, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBowItem(s) {
    // glow
    ctx.save();
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, s * 1.9);
    glow.addColorStop(0, "rgba(255, 180, 220, 0.55)");
    glow.addColorStop(1, "rgba(255, 180, 220, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(-s * 2, -s * 2, s * 4, s * 4);
    ctx.restore();

    ctx.strokeStyle = "#7a1f4a";
    ctx.lineWidth = 2;
    // back shadow loops
    ctx.fillStyle = "#c72864";
    ctx.beginPath();
    ctx.ellipse(-s * 0.75, s * 0.05, s * 0.85, s * 0.6, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(s * 0.75, s * 0.05, s * 0.85, s * 0.6, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // front loops with gradient
    const g = ctx.createLinearGradient(0, -s * 0.6, 0, s * 0.6);
    g.addColorStop(0, "#ffb6d5");
    g.addColorStop(0.5, "#ff6fae");
    g.addColorStop(1, "#c72864");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(-s * 0.7, 0, s * 0.8, s * 0.55, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(s * 0.7, 0, s * 0.8, s * 0.55, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // highlights
    ctx.fillStyle = "rgba(255,220,235,0.8)";
    ctx.beginPath();
    ctx.ellipse(-s * 0.7, -s * 0.25, s * 0.45, s * 0.15, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(s * 0.7, -s * 0.25, s * 0.45, s * 0.15, 0.3, 0, Math.PI * 2);
    ctx.fill();
    // knot
    ctx.fillStyle = "#ff3d79";
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.28, s * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // white dots
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(-s * 0.7, s * 0.1, s * 0.09, 0, Math.PI * 2);
    ctx.arc(s * 0.7, s * 0.1, s * 0.09, 0, Math.PI * 2);
    ctx.arc(-s * 0.5, -s * 0.1, s * 0.07, 0, Math.PI * 2);
    ctx.arc(s * 0.5, -s * 0.1, s * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCherryItem(s) {
    // glow
    ctx.save();
    const glow = ctx.createRadialGradient(0, s * 0.3, 2, 0, s * 0.3, s * 1.9);
    glow.addColorStop(0, "rgba(255, 80, 80, 0.5)");
    glow.addColorStop(1, "rgba(255, 80, 80, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(-s * 2, -s * 2, s * 4, s * 4);
    ctx.restore();

    // stems
    ctx.strokeStyle = "#2e7d32";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, s * 0.35);
    ctx.quadraticCurveTo(-s * 0.2, -s * 0.9, 0, -s * 1.0);
    ctx.moveTo(s * 0.55, s * 0.35);
    ctx.quadraticCurveTo(s * 0.2, -s * 0.7, 0, -s * 1.0);
    ctx.stroke();
    ctx.lineCap = "butt";

    // leaf
    ctx.fillStyle = "#4caf50";
    ctx.strokeStyle = "#2e7d32";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(s * 0.25, -s * 0.95, s * 0.35, s * 0.18, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // leaf vein
    ctx.beginPath();
    ctx.moveTo(s * 0.0, -s * 0.88);
    ctx.lineTo(s * 0.5, -s * 1.05);
    ctx.stroke();

    // cherries
    for (const [cx] of [[-s * 0.55], [s * 0.55]]) {
      const cy = s * 0.55;
      const g = ctx.createRadialGradient(cx - s * 0.2, cy - s * 0.25, 1, cx, cy, s * 0.7);
      g.addColorStop(0, "#ff8080");
      g.addColorStop(0.6, "#e63946");
      g.addColorStop(1, "#8a0e1f");
      ctx.fillStyle = g;
      ctx.strokeStyle = "#5a0a14";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // shine
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.ellipse(cx - s * 0.2, cy - s * 0.2, s * 0.15, s * 0.22, -0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawStormItem(s) {
    // cloud body
    const g = ctx.createLinearGradient(0, -s * 0.6, 0, s * 0.4);
    g.addColorStop(0, "#9aa0b0");
    g.addColorStop(1, "#4a4e60");
    ctx.fillStyle = g;
    ctx.strokeStyle = "#2a2d3a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-s * 0.6, 0, s * 0.55, 0, Math.PI * 2);
    ctx.arc(0, -s * 0.25, s * 0.7, 0, Math.PI * 2);
    ctx.arc(s * 0.6, 0, s * 0.55, 0, Math.PI * 2);
    ctx.arc(0, s * 0.15, s * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // lightning
    ctx.fillStyle = "#ffe17a";
    ctx.strokeStyle = "#b8860b";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-s * 0.15, s * 0.35);
    ctx.lineTo(s * 0.2, s * 0.35);
    ctx.lineTo(-s * 0.05, s * 0.75);
    ctx.lineTo(s * 0.25, s * 0.75);
    ctx.lineTo(-s * 0.2, s * 1.3);
    ctx.lineTo(s * 0.0, s * 0.85);
    ctx.lineTo(-s * 0.25, s * 0.85);
    ctx.lineTo(s * 0.0, s * 0.45);
    ctx.lineTo(-s * 0.15, s * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // raindrops
    ctx.fillStyle = "#4db8ff";
    ctx.beginPath();
    ctx.arc(-s * 0.55, s * 0.45, s * 0.08, 0, Math.PI * 2);
    ctx.arc(s * 0.55, s * 0.50, s * 0.08, 0, Math.PI * 2);
    ctx.fill();
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

    state.time += dt;
    if (state.running && !state.paused) {
      update(dt);
    } else {
      // Still animate background on title / pause screen
      updateBackground(dt);
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
