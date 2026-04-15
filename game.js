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
    y: H - 90,
    w: 110,
    h: 110,
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
    state.items.push({
      type,
      x: 40 + Math.random() * (W - 80),
      y: -40,
      size: 44,
      vy: 260 + Math.random() * 120 + state.level * 40,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 3,
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
  function drawKitty(x, y, w, h) {
    ctx.save();
    ctx.translate(x, y);

    // Soft bounce while moving
    const bounce = Math.sin(state.time * 6) * 1.5;
    ctx.translate(0, bounce);

    // --- Magical aura glow ---
    ctx.save();
    const aura = ctx.createRadialGradient(0, -h * 0.1, 10, 0, -h * 0.1, w * 0.9);
    aura.addColorStop(0, "rgba(255, 200, 230, 0.55)");
    aura.addColorStop(0.5, "rgba(255, 180, 220, 0.25)");
    aura.addColorStop(1, "rgba(255, 180, 220, 0)");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, -h * 0.1, w * 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // --- Fairy wings (behind body) ---
    ctx.save();
    const wingFlap = Math.sin(state.time * 4) * 0.08;
    ctx.globalAlpha = 0.75;
    // left wing
    ctx.save();
    ctx.translate(-w * 0.28, -h * 0.05);
    ctx.rotate(-0.35 + wingFlap);
    const lwGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, w * 0.4);
    lwGrad.addColorStop(0, "rgba(255,255,255,0.95)");
    lwGrad.addColorStop(0.7, "rgba(255,200,230,0.7)");
    lwGrad.addColorStop(1, "rgba(200,150,230,0.2)");
    ctx.fillStyle = lwGrad;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(-10, -h * 0.15, w * 0.22, h * 0.25, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(-8, h * 0.08, w * 0.18, h * 0.2, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // right wing
    ctx.save();
    ctx.translate(w * 0.28, -h * 0.05);
    ctx.rotate(0.35 - wingFlap);
    const rwGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, w * 0.4);
    rwGrad.addColorStop(0, "rgba(255,255,255,0.95)");
    rwGrad.addColorStop(0.7, "rgba(255,200,230,0.7)");
    rwGrad.addColorStop(1, "rgba(200,150,230,0.2)");
    ctx.fillStyle = rwGrad;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(10, -h * 0.15, w * 0.22, h * 0.25, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(8, h * 0.08, w * 0.18, h * 0.2, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.restore();

    // Ground shadow
    ctx.save();
    ctx.fillStyle = "rgba(60, 20, 60, 0.3)";
    ctx.beginPath();
    ctx.ellipse(0, h * 0.58, w * 0.42, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // --- Cute little shoes peeking out ---
    ctx.save();
    ctx.fillStyle = "#ff3d79";
    ctx.strokeStyle = "#7a1f4a";
    ctx.lineWidth = 1.5;
    // left shoe
    ctx.beginPath();
    ctx.ellipse(-w * 0.15, h * 0.55, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // right shoe
    ctx.beginPath();
    ctx.ellipse(w * 0.15, h * 0.55, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // little bows on shoes
    ctx.fillStyle = "#fff";
    drawHeartShape(-w * 0.15, h * 0.53, 2.5);
    drawHeartShape(w * 0.15, h * 0.53, 2.5);
    ctx.restore();

    // --- Dress (multi-layer skirt) ---
    // Back/darker layer
    const dressBack = ctx.createLinearGradient(0, h * 0.0, 0, h * 0.58);
    dressBack.addColorStop(0, "#d63384");
    dressBack.addColorStop(1, "#7a1f4a");
    ctx.fillStyle = dressBack;
    ctx.strokeStyle = "#7a1f4a";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-w * 0.38, h * 0.06);
    ctx.quadraticCurveTo(-w * 0.55, h * 0.58, -w * 0.5, h * 0.58);
    ctx.lineTo(w * 0.5, h * 0.58);
    ctx.quadraticCurveTo(w * 0.55, h * 0.58, w * 0.38, h * 0.06);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Front pink layer
    const dressFront = ctx.createLinearGradient(0, h * 0.0, 0, h * 0.5);
    dressFront.addColorStop(0, "#ffb6d5");
    dressFront.addColorStop(1, "#ff7ab0");
    ctx.fillStyle = dressFront;
    ctx.beginPath();
    ctx.moveTo(-w * 0.34, h * 0.08);
    ctx.quadraticCurveTo(-w * 0.48, h * 0.48, -w * 0.44, h * 0.48);
    ctx.lineTo(w * 0.44, h * 0.48);
    ctx.quadraticCurveTo(w * 0.48, h * 0.48, w * 0.34, h * 0.08);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Lace frill (scalloped) at top layer bottom
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    for (let i = 0; i <= 12; i++) {
      const px = -w * 0.46 + (i / 12) * w * 0.92;
      ctx.arc(px, h * 0.48, 4, 0, Math.PI, false);
    }
    ctx.lineTo(w * 0.46, h * 0.52);
    ctx.lineTo(-w * 0.46, h * 0.52);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#d63384";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Waist ribbon with big bow
    ctx.fillStyle = "#ff3d79";
    ctx.strokeStyle = "#7a1f4a";
    ctx.lineWidth = 1.5;
    ctx.fillRect(-w * 0.36, h * 0.08, w * 0.72, 6);
    ctx.strokeRect(-w * 0.36, h * 0.08, w * 0.72, 6);
    // waist bow (center)
    ctx.beginPath();
    ctx.ellipse(-10, h * 0.11, 10, 7, -0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(10, h * 0.11, 10, 7, 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, h * 0.11, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Heart buttons on bodice
    ctx.fillStyle = "#fff";
    drawHeartShape(0, h * 0.22, 4);
    drawHeartShape(0, h * 0.32, 4);
    drawHeartShape(0, h * 0.42, 4);

    // Glittering sparkles on dress
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    for (let i = 0; i < 6; i++) {
      const sx = (i - 2.5) * 11 + Math.sin(state.time * 3 + i) * 1.5;
      const sy = h * 0.17 + (i % 2) * 14;
      drawSparkle(sx, sy, 1.3);
    }

    // --- Arms (white with pink paws) ---
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 2.5;
    // left arm
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(-w * 0.44, h * 0.18, 11, 19, -0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffb6d5";
    ctx.beginPath();
    ctx.arc(-w * 0.47, h * 0.32, 4.5, 0, Math.PI * 2);
    ctx.fill();
    // right arm
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(w * 0.44, h * 0.18, 11, 19, 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffb6d5";
    ctx.beginPath();
    ctx.arc(w * 0.47, h * 0.32, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // --- Pearl necklace with heart pendant ---
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, h * 0.03, w * 0.2, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    // pearls
    for (let i = 0; i < 9; i++) {
      const a = (0.2 + (i / 8) * 0.6) * Math.PI;
      const px = Math.cos(a) * w * 0.2;
      const py = h * 0.03 + Math.sin(a) * w * 0.2;
      const pg = ctx.createRadialGradient(px - 1, py - 1, 0.5, px, py, 3);
      pg.addColorStop(0, "#ffffff");
      pg.addColorStop(1, "#ffd9ea");
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(px, py, 2.3, 0, Math.PI * 2);
      ctx.fill();
    }
    // heart pendant
    ctx.fillStyle = "#ff3d79";
    drawHeartShape(0, h * 0.08, 5);
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.beginPath();
    ctx.arc(-1.5, h * 0.065, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // --- Head with soft gradient shading ---
    const headGrad = ctx.createRadialGradient(-10, -h * 0.26, 5, 0, -h * 0.18, w * 0.5);
    headGrad.addColorStop(0, "#ffffff");
    headGrad.addColorStop(0.7, "#fff5fa");
    headGrad.addColorStop(1, "#f0d5e2");
    ctx.fillStyle = headGrad;
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.18, w * 0.44, h * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // --- Ears ---
    ctx.fillStyle = headGrad;
    // left ear
    ctx.beginPath();
    ctx.moveTo(-w * 0.40, -h * 0.34);
    ctx.quadraticCurveTo(-w * 0.30, -h * 0.62, -w * 0.10, -h * 0.36);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // right ear
    ctx.beginPath();
    ctx.moveTo(w * 0.40, -h * 0.34);
    ctx.quadraticCurveTo(w * 0.30, -h * 0.62, w * 0.10, -h * 0.36);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Ear inner pink (both ears)
    ctx.fillStyle = "#ffb6d5";
    ctx.beginPath();
    ctx.moveTo(-w * 0.33, -h * 0.38);
    ctx.quadraticCurveTo(-w * 0.27, -h * 0.55, -w * 0.15, -h * 0.38);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w * 0.33, -h * 0.38);
    ctx.quadraticCurveTo(w * 0.27, -h * 0.55, w * 0.15, -h * 0.38);
    ctx.closePath();
    ctx.fill();

    // --- Tiny tiara/crown on head ---
    ctx.save();
    ctx.translate(0, -h * 0.52);
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
    // tiara jewels
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
    ctx.translate(w * 0.25, -h * 0.48);
    ctx.fillStyle = "#fff176";
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
    const bowX = -w * 0.25;
    const bowY = -h * 0.48;
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
    const blushL = ctx.createRadialGradient(-w * 0.27, -h * 0.12, 1, -w * 0.27, -h * 0.12, 8);
    blushL.addColorStop(0, "rgba(255, 120, 170, 0.85)");
    blushL.addColorStop(1, "rgba(255, 120, 170, 0)");
    ctx.fillStyle = blushL;
    ctx.fillRect(-w * 0.27 - 10, -h * 0.12 - 10, 20, 20);
    const blushR = ctx.createRadialGradient(w * 0.27, -h * 0.12, 1, w * 0.27, -h * 0.12, 8);
    blushR.addColorStop(0, "rgba(255, 120, 170, 0.85)");
    blushR.addColorStop(1, "rgba(255, 120, 170, 0)");
    ctx.fillStyle = blushR;
    ctx.fillRect(w * 0.27 - 10, -h * 0.12 - 10, 20, 20);
    // blush highlights
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.beginPath();
    ctx.arc(-w * 0.29, -h * 0.13, 1.2, 0, Math.PI * 2);
    ctx.arc(w * 0.25, -h * 0.13, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // --- Eyes (bigger, sparkly with eyelashes) ---
    if (kitty.isBlinking) {
      ctx.strokeStyle = "#222";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-19, -h * 0.2);
      ctx.quadraticCurveTo(-13, -h * 0.17, -7, -h * 0.2);
      ctx.moveTo(7, -h * 0.2);
      ctx.quadraticCurveTo(13, -h * 0.17, 19, -h * 0.2);
      ctx.stroke();
      // eyelashes
      ctx.beginPath();
      ctx.moveTo(-19, -h * 0.2); ctx.lineTo(-22, -h * 0.23);
      ctx.moveTo(-15, -h * 0.185); ctx.lineTo(-16, -h * 0.22);
      ctx.moveTo(19, -h * 0.2); ctx.lineTo(22, -h * 0.23);
      ctx.moveTo(15, -h * 0.185); ctx.lineTo(16, -h * 0.22);
      ctx.stroke();
      ctx.lineCap = "butt";
    } else {
      // eye base (bigger, oval)
      ctx.fillStyle = "#2a1b4e";
      ctx.beginPath();
      ctx.ellipse(-13, -h * 0.2, 5.5, 8, 0, 0, Math.PI * 2);
      ctx.ellipse(13, -h * 0.2, 5.5, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      // purple iris tint
      ctx.fillStyle = "#6b3a8a";
      ctx.beginPath();
      ctx.ellipse(-13, -h * 0.19, 3.5, 5, 0, 0, Math.PI * 2);
      ctx.ellipse(13, -h * 0.19, 3.5, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      // big heart-shaped shine
      ctx.fillStyle = "#fff";
      drawHeartShape(-11.5, -h * 0.22, 2);
      drawHeartShape(14.5, -h * 0.22, 2);
      // small shine
      ctx.beginPath();
      ctx.arc(-14.5, -h * 0.17, 1, 0, Math.PI * 2);
      ctx.arc(11.5, -h * 0.17, 1, 0, Math.PI * 2);
      ctx.fill();
      // eyelashes
      ctx.strokeStyle = "#222";
      ctx.lineWidth = 1.6;
      ctx.lineCap = "round";
      ctx.beginPath();
      // left eye lashes
      ctx.moveTo(-18, -h * 0.24); ctx.lineTo(-22, -h * 0.27);
      ctx.moveTo(-14, -h * 0.26); ctx.lineTo(-15, -h * 0.3);
      ctx.moveTo(-10, -h * 0.26); ctx.lineTo(-9, -h * 0.3);
      // right eye lashes
      ctx.moveTo(18, -h * 0.24); ctx.lineTo(22, -h * 0.27);
      ctx.moveTo(14, -h * 0.26); ctx.lineTo(15, -h * 0.3);
      ctx.moveTo(10, -h * 0.26); ctx.lineTo(9, -h * 0.3);
      ctx.stroke();
      ctx.lineCap = "butt";
    }

    // --- Nose (yellow with shine) ---
    ctx.fillStyle = "#ffcc29";
    ctx.strokeStyle = "#b8860b";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.13, 5.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff7c2";
    ctx.beginPath();
    ctx.arc(-1.5, -h * 0.14, 1.3, 0, Math.PI * 2);
    ctx.fill();

    // --- Tiny smile ---
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-3, -h * 0.08);
    ctx.quadraticCurveTo(0, -h * 0.06, 3, -h * 0.08);
    ctx.stroke();
    ctx.lineCap = "butt";

    // --- Whiskers ---
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 1.8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-14, -h * 0.1); ctx.quadraticCurveTo(-25, -h * 0.13, -36, -h * 0.14);
    ctx.moveTo(-14, -h * 0.07); ctx.quadraticCurveTo(-25, -h * 0.06, -36, -h * 0.05);
    ctx.moveTo(-14, -h * 0.04); ctx.quadraticCurveTo(-25, 0, -36, h * 0.02);
    ctx.moveTo(14, -h * 0.1); ctx.quadraticCurveTo(25, -h * 0.13, 36, -h * 0.14);
    ctx.moveTo(14, -h * 0.07); ctx.quadraticCurveTo(25, -h * 0.06, 36, -h * 0.05);
    ctx.moveTo(14, -h * 0.04); ctx.quadraticCurveTo(25, 0, 36, h * 0.02);
    ctx.stroke();
    ctx.lineCap = "butt";

    // --- Orbiting sparkles around kitty ---
    ctx.save();
    ctx.fillStyle = "rgba(255, 240, 180, 0.95)";
    for (let i = 0; i < 5; i++) {
      const a = state.time * 1.5 + (i / 5) * Math.PI * 2;
      const ox = Math.cos(a) * w * 0.55;
      const oy = Math.sin(a) * h * 0.35 - h * 0.1;
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
