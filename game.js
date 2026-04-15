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
    y: H - 95,
    w: 100,
    h: 95,
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
    { kind: "heart",  emoji: "🖤", points: 10, weight: 5, color: "#8b0012", sizeMul: 0.65 },
    { kind: "star",   emoji: "⭐", points: 20, weight: 3, color: "#ffcc29", sizeMul: 1.0 },
    { kind: "bow",    emoji: "🎀", points: 15, weight: 3, color: "#5a0010", sizeMul: 0.65 },
    { kind: "cherry", emoji: "🍒", points: 25, weight: 2, color: "#e63946", sizeMul: 1.0 },
    { kind: "cloud",  emoji: "⛈",  points: 0,  weight: 3, color: "#1a0a14", sizeMul: 0.65, bad: true },
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
      size: 56 * (type.sizeMul || 1),
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
    // Dark demonic blood sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#05020a");
    sky.addColorStop(0.3, "#1a0310");
    sky.addColorStop(0.6, "#3a0612");
    sky.addColorStop(0.85, "#2a0308");
    sky.addColorStop(1, "#0a0104");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Faint dim stars
    ctx.save();
    ctx.fillStyle = "#d0b0b0";
    for (const s of state.stars) {
      const a = 0.15 + 0.35 * (0.5 + 0.5 * Math.sin(s.twinkle));
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // Blood moon with dark glow
    ctx.save();
    const moonX = 90;
    const moonY = 95;
    const glow = ctx.createRadialGradient(moonX, moonY, 20, moonX, moonY, 120);
    glow.addColorStop(0, "rgba(200, 20, 30, 0.65)");
    glow.addColorStop(0.5, "rgba(120, 10, 20, 0.35)");
    glow.addColorStop(1, "rgba(120, 10, 20, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(moonX - 120, moonY - 120, 240, 240);
    // moon body
    const moonGrad = ctx.createRadialGradient(moonX - 12, moonY - 12, 5, moonX, moonY, 42);
    moonGrad.addColorStop(0, "#e63946");
    moonGrad.addColorStop(0.6, "#8b0012");
    moonGrad.addColorStop(1, "#3a0008");
    ctx.fillStyle = moonGrad;
    ctx.beginPath();
    ctx.arc(moonX, moonY, 42, 0, Math.PI * 2);
    ctx.fill();
    // dark craters
    ctx.fillStyle = "rgba(20, 0, 5, 0.6)";
    ctx.beginPath();
    ctx.arc(moonX - 10, moonY - 8, 7, 0, Math.PI * 2);
    ctx.arc(moonX + 13, moonY + 6, 5, 0, Math.PI * 2);
    ctx.arc(moonX + 5, moonY - 16, 4, 0, Math.PI * 2);
    ctx.arc(moonX - 16, moonY + 10, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Dark storm clouds drifting
    ctx.save();
    for (const c of state.clouds) {
      const g = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, c.r * 1.8);
      g.addColorStop(0, "rgba(30, 15, 25, 0.9)");
      g.addColorStop(0.6, "rgba(20, 5, 15, 0.7)");
      g.addColorStop(1, "rgba(10, 2, 8, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.arc(c.x + c.r * 0.8, c.y + 6, c.r * 0.8, 0, Math.PI * 2);
      ctx.arc(c.x - c.r * 0.9, c.y + 8, c.r * 0.7, 0, Math.PI * 2);
      ctx.arc(c.x + c.r * 0.2, c.y - c.r * 0.6, c.r * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Haunted castle silhouette
    drawCastle(W * 0.78, H * 0.68);

    // Dead tree silhouettes on the left
    drawDeadTree(W * 0.1, H * 0.74);
    drawDeadTree(W * 0.22, H * 0.77);

    // Embers (instead of sparkles) rising
    ctx.save();
    for (const sp of state.sparkles) {
      const a = 0.4 + 0.6 * Math.sin(sp.phase);
      ctx.globalAlpha = a;
      const eg = ctx.createRadialGradient(sp.x, sp.y, 0.3, sp.x, sp.y, sp.r * 3);
      eg.addColorStop(0, "#ff4422");
      eg.addColorStop(0.6, "#8b0000");
      eg.addColorStop(1, "rgba(80,0,0,0)");
      ctx.fillStyle = eg;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.r * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // Blood-red ground hills
    ctx.save();
    const hill2 = ctx.createLinearGradient(0, H - 120, 0, H);
    hill2.addColorStop(0, "#2a0308");
    hill2.addColorStop(1, "#050102");
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
    hill1.addColorStop(0, "#1a0208");
    hill1.addColorStop(1, "#000000");
    ctx.fillStyle = hill1;
    ctx.beginPath();
    ctx.moveTo(0, H - 30);
    ctx.quadraticCurveTo(W * 0.3, H - 80, W * 0.55, H - 40);
    ctx.quadraticCurveTo(W * 0.82, H - 5, W, H - 50);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();

    // Grave crosses on ground
    ctx.strokeStyle = "#1a0a14";
    ctx.fillStyle = "#1a0a14";
    ctx.lineWidth = 3;
    const graves = [[W * 0.08, H - 22], [W * 0.35, H - 18], [W * 0.6, H - 20], [W * 0.92, H - 24]];
    for (const [gx, gy] of graves) {
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx, gy - 14);
      ctx.moveTo(gx - 5, gy - 9);
      ctx.lineTo(gx + 5, gy - 9);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawDeadTree(x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = "#0a0206";
    ctx.fillStyle = "#0a0206";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    // trunk
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-3, -30, 2, -60);
    ctx.quadraticCurveTo(6, -90, -2, -110);
    ctx.stroke();
    // branches
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(1, -70); ctx.quadraticCurveTo(-15, -82, -25, -95);
    ctx.moveTo(1, -80); ctx.quadraticCurveTo(15, -92, 22, -105);
    ctx.moveTo(-1, -95); ctx.quadraticCurveTo(-10, -105, -18, -108);
    ctx.moveTo(1, -100); ctx.quadraticCurveTo(8, -110, 14, -113);
    ctx.stroke();
    ctx.lineCap = "butt";
    ctx.restore();
  }

  function drawCastle(x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#050108";
    ctx.strokeStyle = "#1a0a14";
    ctx.lineWidth = 1.5;
    // main keep
    ctx.fillRect(-40, -80, 80, 110);
    ctx.strokeRect(-40, -80, 80, 110);
    // side towers
    ctx.fillRect(-70, -60, 25, 90);
    ctx.strokeRect(-70, -60, 25, 90);
    ctx.fillRect(45, -60, 25, 90);
    ctx.strokeRect(45, -60, 25, 90);
    // jagged roofs
    ctx.beginPath();
    ctx.moveTo(-42, -80); ctx.lineTo(0, -125); ctx.lineTo(42, -80); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-72, -60); ctx.lineTo(-57, -95); ctx.lineTo(-43, -60); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(43, -60); ctx.lineTo(58, -95); ctx.lineTo(73, -60); ctx.closePath(); ctx.fill(); ctx.stroke();
    // blood-red glowing windows (flicker)
    const flicker = 0.7 + 0.3 * Math.sin(state.time * 8);
    ctx.fillStyle = `rgba(255, ${Math.floor(30 * flicker)}, ${Math.floor(20 * flicker)}, ${flicker})`;
    ctx.fillRect(-6, -55, 12, 18);
    ctx.fillRect(-55, -40, 6, 12);
    ctx.fillRect(49, -40, 6, 12);
    ctx.fillRect(-6, -25, 12, 10);
    // arched gate
    ctx.fillStyle = "#0a0206";
    ctx.beginPath();
    ctx.moveTo(-8, 30); ctx.lineTo(-8, 5); ctx.quadraticCurveTo(0, -8, 8, 5); ctx.lineTo(8, 30); ctx.closePath(); ctx.fill();
    // bat flag
    ctx.strokeStyle = "#1a0a14";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -125); ctx.lineTo(0, -148); ctx.stroke();
    ctx.fillStyle = "#1a0208";
    ctx.beginPath();
    ctx.moveTo(0, -148); ctx.lineTo(16, -143); ctx.lineTo(0, -135); ctx.closePath();
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

    // --- Dark red demonic aura ---
    ctx.save();
    const aura = ctx.createRadialGradient(0, 0, 5, 0, 0, w * 1.1);
    const pulseA = 0.4 + 0.2 * Math.sin(state.time * 2.5);
    aura.addColorStop(0, `rgba(200, 0, 20, ${pulseA})`);
    aura.addColorStop(0.4, `rgba(100, 0, 10, ${pulseA * 0.6})`);
    aura.addColorStop(1, "rgba(60, 0, 5, 0)");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, w * 1.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Ground shadow
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.beginPath();
    ctx.ellipse(0, h * 0.58, w * 0.42, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // --- Demonic horns (behind head) ---
    ctx.save();
    ctx.fillStyle = "#1a0a0a";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    // left horn
    ctx.beginPath();
    ctx.moveTo(-w * 0.32, -h * 0.38);
    ctx.quadraticCurveTo(-w * 0.55, -h * 0.62, -w * 0.48, -h * 0.82);
    ctx.quadraticCurveTo(-w * 0.40, -h * 0.65, -w * 0.20, -h * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // right horn
    ctx.beginPath();
    ctx.moveTo(w * 0.32, -h * 0.38);
    ctx.quadraticCurveTo(w * 0.55, -h * 0.62, w * 0.48, -h * 0.82);
    ctx.quadraticCurveTo(w * 0.40, -h * 0.65, w * 0.20, -h * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // horn ridges
    ctx.strokeStyle = "#3a0a0a";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-w * 0.42, -h * 0.48); ctx.lineTo(-w * 0.32, -h * 0.5);
    ctx.moveTo(-w * 0.46, -h * 0.6); ctx.lineTo(-w * 0.38, -h * 0.62);
    ctx.moveTo(w * 0.42, -h * 0.48); ctx.lineTo(w * 0.32, -h * 0.5);
    ctx.moveTo(w * 0.46, -h * 0.6); ctx.lineTo(w * 0.38, -h * 0.62);
    ctx.stroke();
    ctx.restore();

    // --- Head (pale, cold gradient) ---
    const headGrad = ctx.createRadialGradient(-15, -15, 5, 0, 0, w * 0.65);
    headGrad.addColorStop(0, "#e8dce0");
    headGrad.addColorStop(0.7, "#bfa8b0");
    headGrad.addColorStop(1, "#6a4a54");
    ctx.fillStyle = headGrad;
    ctx.strokeStyle = "#1a0a10";
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

    // Ear inner dark red (both ears)
    ctx.fillStyle = "#3a0008";
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

    // --- Black bow on left ear ---
    const bowX = -w * 0.34;
    const bowY = -h * 0.38;
    ctx.fillStyle = "#0a0206";
    ctx.strokeStyle = "#3a0008";
    ctx.lineWidth = 2;
    // back shadow loops
    ctx.beginPath();
    ctx.ellipse(bowX - 14, bowY + 1, 14, 10, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(bowX + 14, bowY + 1, 14, 10, 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // dark red highlight
    ctx.fillStyle = "#5a0010";
    ctx.beginPath();
    ctx.ellipse(bowX - 13, bowY - 3, 8, 3, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(bowX + 13, bowY - 3, 8, 3, 0.35, 0, Math.PI * 2);
    ctx.fill();
    // knot
    ctx.fillStyle = "#0a0206";
    ctx.beginPath();
    ctx.arc(bowX, bowY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // blood drop hanging from bow
    ctx.fillStyle = "#8b0012";
    ctx.beginPath();
    ctx.moveTo(bowX, bowY + 6);
    ctx.quadraticCurveTo(bowX - 3, bowY + 14, bowX, bowY + 18);
    ctx.quadraticCurveTo(bowX + 3, bowY + 14, bowX, bowY + 6);
    ctx.closePath();
    ctx.fill();

    // --- Glowing red eyes ---
    const eyeY = -h * 0.02;
    const eyeGlow = 0.7 + 0.3 * Math.sin(state.time * 4);
    // red eye glow
    ctx.save();
    const lgGlow = ctx.createRadialGradient(-15, eyeY, 1, -15, eyeY, 14);
    lgGlow.addColorStop(0, `rgba(255, 30, 0, ${eyeGlow})`);
    lgGlow.addColorStop(1, "rgba(255, 30, 0, 0)");
    ctx.fillStyle = lgGlow;
    ctx.fillRect(-30, eyeY - 16, 30, 32);
    const rgGlow = ctx.createRadialGradient(15, eyeY, 1, 15, eyeY, 14);
    rgGlow.addColorStop(0, `rgba(255, 30, 0, ${eyeGlow})`);
    rgGlow.addColorStop(1, "rgba(255, 30, 0, 0)");
    ctx.fillStyle = rgGlow;
    ctx.fillRect(0, eyeY - 16, 30, 32);
    ctx.restore();

    if (kitty.isBlinking) {
      ctx.strokeStyle = "#8b0000";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-22, eyeY);
      ctx.quadraticCurveTo(-15, eyeY + 4, -8, eyeY);
      ctx.moveTo(8, eyeY);
      ctx.quadraticCurveTo(15, eyeY + 4, 22, eyeY);
      ctx.stroke();
      ctx.lineCap = "butt";
    } else {
      // eye base (dark red ring)
      ctx.fillStyle = "#1a0004";
      ctx.beginPath();
      ctx.ellipse(-15, eyeY, 7, 9, 0, 0, Math.PI * 2);
      ctx.ellipse(15, eyeY, 7, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      // glowing red iris
      ctx.fillStyle = "#e60020";
      ctx.beginPath();
      ctx.ellipse(-15, eyeY + 1, 5, 7, 0, 0, Math.PI * 2);
      ctx.ellipse(15, eyeY + 1, 5, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      // bright red hot center
      ctx.fillStyle = "#ff4422";
      ctx.beginPath();
      ctx.ellipse(-15, eyeY + 1, 2.5, 4, 0, 0, Math.PI * 2);
      ctx.ellipse(15, eyeY + 1, 2.5, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      // vertical cat slit pupil
      ctx.fillStyle = "#0a0000";
      ctx.beginPath();
      ctx.ellipse(-15, eyeY + 1, 1.2, 5.5, 0, 0, Math.PI * 2);
      ctx.ellipse(15, eyeY + 1, 1.2, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // --- Black nose ---
    ctx.fillStyle = "#1a0a0a";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, h * 0.10, 6, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#3a1a1a";
    ctx.beginPath();
    ctx.arc(-1.8, h * 0.09, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // --- Evil grin with fangs ---
    ctx.strokeStyle = "#1a0000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-8, h * 0.17);
    ctx.quadraticCurveTo(0, h * 0.24, 8, h * 0.17);
    ctx.stroke();
    ctx.lineCap = "butt";
    // fangs
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#8b0000";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-5, h * 0.19);
    ctx.lineTo(-3, h * 0.19);
    ctx.lineTo(-4, h * 0.26);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(5, h * 0.19);
    ctx.lineTo(3, h * 0.19);
    ctx.lineTo(4, h * 0.26);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // blood tip on left fang
    ctx.fillStyle = "#8b0012";
    ctx.beginPath();
    ctx.arc(-4, h * 0.265, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // --- Whiskers ---
    ctx.strokeStyle = "#2a1a1a";
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

    // --- Orbiting dark embers around head ---
    ctx.save();
    for (let i = 0; i < 6; i++) {
      const a = state.time * 1.5 + (i / 6) * Math.PI * 2;
      const ox = Math.cos(a) * w * 0.75;
      const oy = Math.sin(a) * h * 0.55;
      const eg = ctx.createRadialGradient(ox, oy, 0.5, ox, oy, 5);
      eg.addColorStop(0, "#ff3300");
      eg.addColorStop(0.5, "#8b0000");
      eg.addColorStop(1, "rgba(80,0,0,0)");
      ctx.fillStyle = eg;
      ctx.beginPath();
      ctx.arc(ox, oy, 4, 0, Math.PI * 2);
      ctx.fill();
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
    // dark blood glow
    ctx.save();
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, s * 1.8);
    glow.addColorStop(0, "rgba(200, 0, 20, 0.55)");
    glow.addColorStop(1, "rgba(100, 0, 10, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(-s * 2, -s * 2, s * 4, s * 4);
    ctx.restore();
    // heart body with dark gradient
    const g = ctx.createRadialGradient(-s * 0.3, -s * 0.4, 1, 0, 0, s * 1.3);
    g.addColorStop(0, "#8b0012");
    g.addColorStop(0.6, "#3a0008");
    g.addColorStop(1, "#0a0002");
    ctx.fillStyle = g;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    heartPath(0, 0, s);
    ctx.fill();
    ctx.stroke();
    // red shine
    ctx.fillStyle = "rgba(255, 50, 30, 0.8)";
    ctx.beginPath();
    ctx.ellipse(-s * 0.35, -s * 0.35, s * 0.22, s * 0.35, -0.4, 0, Math.PI * 2);
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
    // dark red glow
    ctx.save();
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, s * 1.9);
    glow.addColorStop(0, "rgba(150, 0, 15, 0.5)");
    glow.addColorStop(1, "rgba(100, 0, 10, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(-s * 2, -s * 2, s * 4, s * 4);
    ctx.restore();

    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    // back shadow loops
    ctx.fillStyle = "#0a0206";
    ctx.beginPath();
    ctx.ellipse(-s * 0.75, s * 0.05, s * 0.85, s * 0.6, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(s * 0.75, s * 0.05, s * 0.85, s * 0.6, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // front loops with dark gradient
    const g = ctx.createLinearGradient(0, -s * 0.6, 0, s * 0.6);
    g.addColorStop(0, "#5a0010");
    g.addColorStop(0.5, "#2a0008");
    g.addColorStop(1, "#0a0002");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(-s * 0.7, 0, s * 0.8, s * 0.55, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(s * 0.7, 0, s * 0.8, s * 0.55, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // blood highlights
    ctx.fillStyle = "rgba(200,20,30,0.7)";
    ctx.beginPath();
    ctx.ellipse(-s * 0.7, -s * 0.25, s * 0.4, s * 0.12, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(s * 0.7, -s * 0.25, s * 0.4, s * 0.12, 0.3, 0, Math.PI * 2);
    ctx.fill();
    // knot
    ctx.fillStyle = "#1a0004";
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.28, s * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
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
    // dark cloud body
    const g = ctx.createLinearGradient(0, -s * 0.6, 0, s * 0.4);
    g.addColorStop(0, "#2a1a26");
    g.addColorStop(1, "#0a0208");
    ctx.fillStyle = g;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-s * 0.6, 0, s * 0.55, 0, Math.PI * 2);
    ctx.arc(0, -s * 0.25, s * 0.7, 0, Math.PI * 2);
    ctx.arc(s * 0.6, 0, s * 0.55, 0, Math.PI * 2);
    ctx.arc(0, s * 0.15, s * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // red lightning
    ctx.fillStyle = "#e60020";
    ctx.strokeStyle = "#8b0012";
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
    // blood drops
    ctx.fillStyle = "#8b0012";
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
