/* ConfessMo Story Studio — scene renderer, animated Story export and the export dialog. */
(() => {
  "use strict";
  /* =====================================================================
   * ConfessMo Story Studio
   * One scene renderer drives: 4:5 posts, 9:16 stills, the live preview and
   * the animated Story video, so every export looks exactly like the preview.
   * Draws with Canvas 2D only (no emoji glyphs, no external requests).
   * ===================================================================== */
  const TAU = Math.PI * 2;
  const SERIF = '"Cormorant Garamond", "Cormorant", Georgia, "Times New Roman", serif';
  const SANS = 'Poppins, "Helvetica Neue", Arial, sans-serif';
  const DURATION = 7.5; // seconds — inside the requested 5–8s window
  const FPS = 30;
  const SIZES = { story: { W: 1080, H: 1920 }, post: { W: 1080, H: 1350 } };
  let deps = null;

  /* ---------- small helpers ---------- */
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const easeOut = (v) => 1 - Math.pow(1 - clamp01(v), 3);
  const easeInOut = (v) => {
    v = clamp01(v);
    return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2;
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  function rgb(c) {
    c = String(c).replace("#", "");
    if (c.length === 3) c = c.split("").map((x) => x + x).join("");
    const n = parseInt(c.slice(0, 6), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const toHex = (a) =>
    "#" + a.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
  const mix = (a, b, t) => {
    const A = rgb(a), B = rgb(b);
    return toHex(A.map((v, i) => v + (B[i] - v) * t));
  };
  const rgba = (c, a) => {
    const [r, g, b] = rgb(c);
    return `rgba(${r},${g},${b},${a})`;
  };
  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashString(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  }
  function mkCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }

  /* ---------- path + paint primitives ---------- */
  function rr(ctx, x, y, w, h, r) {
    const [a, b, c, d] = Array.isArray(r) ? r : [r, r, r, r];
    const m = Math.min(w, h) / 2;
    const tl = Math.min(a, m), tr = Math.min(b, m), br = Math.min(c, m), bl = Math.min(d, m);
    ctx.beginPath();
    ctx.moveTo(x + tl, y);
    ctx.lineTo(x + w - tr, y);
    ctx.arcTo(x + w, y, x + w, y + tr, tr);
    ctx.lineTo(x + w, y + h - br);
    ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
    ctx.lineTo(x + bl, y + h);
    ctx.arcTo(x, y + h, x, y + h - bl, bl);
    ctx.lineTo(x, y + tl);
    ctx.arcTo(x, y, x + tl, y, tl);
    ctx.closePath();
  }
  function withAlpha(ctx, a, fn) {
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = prev * clamp01(a);
    fn();
    ctx.globalAlpha = prev;
  }
  function glow(ctx, x, y, r, color, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(color, a));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Gold foil with a slow shimmer band that travels across it.
  function foil(ctx, r, t) {
    const span = r.w * 1.3;
    const off = t === null ? r.w * 0.28 : ((t * 150) % (r.w * 2.4)) - r.w * 0.5;
    const g = ctx.createLinearGradient(r.x + off, r.y, r.x + off + span, r.y + r.h * 0.6);
    g.addColorStop(0, "#b48a43");
    g.addColorStop(0.3, "#d6b673");
    g.addColorStop(0.5, "#fbefc9");
    g.addColorStop(0.7, "#d6b673");
    g.addColorStop(1, "#b48a43");
    return g;
  }
  let _noise = null;
  function grain(ctx, r, radius, a) {
    if (!_noise) {
      _noise = mkCanvas(200, 200);
      const g = _noise.getContext("2d");
      const id = g.createImageData(200, 200);
      const rnd = mulberry32(11);
      for (let i = 0; i < id.data.length; i += 4) {
        const v = (rnd() * 255) | 0;
        id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
        id.data[i + 3] = 255;
      }
      g.putImageData(id, 0, 0);
    }
    ctx.save();
    rr(ctx, r.x, r.y, r.w, r.h, radius);
    ctx.clip();
    ctx.globalAlpha *= a;
    ctx.fillStyle = ctx.createPattern(_noise, "repeat");
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.restore();
  }
  function plate(ctx, r, radius, fill, sh) {
    ctx.save();
    if (sh) {
      ctx.shadowColor = sh.color;
      ctx.shadowBlur = sh.blur;
      ctx.shadowOffsetY = sh.dy;
    }
    rr(ctx, r.x, r.y, r.w, r.h, radius);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.restore();
  }
  function strokeRR(ctx, x, y, w, h, radius, style, lw) {
    rr(ctx, x, y, w, h, radius);
    ctx.strokeStyle = style;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
  function sparkle(ctx, x, y, size, color, a = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha *= a;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.quadraticCurveTo(size * 0.16, -size * 0.16, size, 0);
    ctx.quadraticCurveTo(size * 0.16, size * 0.16, 0, size);
    ctx.quadraticCurveTo(-size * 0.16, size * 0.16, -size, 0);
    ctx.quadraticCurveTo(-size * 0.16, -size * 0.16, 0, -size);
    ctx.fill();
    ctx.restore();
  }
  function diamond(ctx, x, y, s, fill) {
    ctx.save();
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s * 0.7, y);
    ctx.lineTo(x, y + s);
    ctx.lineTo(x - s * 0.7, y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  function crescent(ctx, x, y, s, color) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, s / 2, 0, TAU);
    ctx.clip();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.rect(x - s, y - s, s * 2, s * 2);
    ctx.arc(x + s * 0.24, y - s * 0.12, s * 0.42, 0, TAU, true);
    ctx.fill("evenodd");
    ctx.restore();
  }
  function heartPath(ctx, x, y, s) {
    ctx.save();
    ctx.translate(x - s / 2, y - s / 2);
    ctx.scale(s / 24, s / 24);
    ctx.beginPath();
    ctx.moveTo(12, 20.5);
    ctx.bezierCurveTo(10, 18.5, 3, 13.2, 3, 8.5);
    ctx.bezierCurveTo(3, 5.3, 5.4, 3.2, 8.3, 3.2);
    ctx.bezierCurveTo(10.1, 3.2, 11.4, 4.1, 12, 5);
    ctx.bezierCurveTo(12.6, 4.1, 13.9, 3.2, 15.7, 3.2);
    ctx.bezierCurveTo(18.6, 3.2, 21, 5.3, 21, 8.5);
    ctx.bezierCurveTo(21, 13.2, 14, 18.5, 12, 20.5);
    ctx.restore();
  }
  function heart(ctx, x, y, s, color, fill = false, lw = 2) {
    ctx.save();
    heartPath(ctx, x, y, s);
    if (fill) {
      ctx.fillStyle = color;
      ctx.fill();
    } else {
      ctx.strokeStyle = color;
      ctx.lineJoin = "round";
      ctx.lineWidth = Math.max(1.5, s * 0.085);
      ctx.stroke();
    }
    ctx.restore();
  }
  function moodIcon(ctx, name, x, y, s, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(1.6, s * 0.09);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (name === "heart") heart(ctx, x, y, s, color);
    else if (name === "crescent") crescent(ctx, x, y, s * 0.92, color);
    else if (name === "sun") {
      ctx.beginPath();
      ctx.arc(x, y, s * 0.2, 0, TAU);
      ctx.stroke();
      for (let i = 0; i < 8; i += 1) {
        const a = (TAU * i) / 8;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * s * 0.34, y + Math.sin(a) * s * 0.34);
        ctx.lineTo(x + Math.cos(a) * s * 0.5, y + Math.sin(a) * s * 0.5);
        ctx.stroke();
      }
    } else if (name === "up-right") {
      ctx.beginPath();
      ctx.moveTo(x - s * 0.3, y + s * 0.3);
      ctx.lineTo(x + s * 0.3, y - s * 0.3);
      ctx.moveTo(x - s * 0.04, y - s * 0.3);
      ctx.lineTo(x + s * 0.3, y - s * 0.3);
      ctx.lineTo(x + s * 0.3, y + s * 0.04);
      ctx.stroke();
    } else sparkle(ctx, x, y, s * 0.5, color);
    ctx.restore();
  }

  /* ---------- text helpers ---------- */
  function tracked(ctx, str, x, y, spacing, align = "left") {
    const chars = [...String(str)];
    const widths = chars.map((c) => ctx.measureText(c).width);
    const total = widths.reduce((a, b) => a + b, 0) + spacing * Math.max(0, chars.length - 1);
    let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
    const prev = ctx.textAlign;
    ctx.textAlign = "left";
    chars.forEach((c, i) => {
      ctx.fillText(c, cx, y);
      cx += widths[i] + spacing;
    });
    ctx.textAlign = prev;
    return total;
  }
  function ellipsize(ctx, str, maxW) {
    if (ctx.measureText(str).width <= maxW) return str;
    let s = str;
    while (s.length > 1 && ctx.measureText(`${s}…`).width > maxW) s = s.slice(0, -1);
    return `${s.trimEnd()}…`;
  }
  // Word-wrap that honours line breaks and hard-breaks over-long words.
  function wrapText(ctx, text, maxW) {
    const out = [];
    String(text).replace(/\r/g, "").split("\n").forEach((para) => {
      const words = para.split(/\s+/).filter(Boolean);
      if (!words.length) {
        out.push("");
        return;
      }
      let line = "";
      words.forEach((word) => {
        let w = word;
        while (ctx.measureText(w).width > maxW && w.length > 1) {
          let n = w.length;
          while (n > 1 && ctx.measureText(w.slice(0, n)).width > maxW) n -= 1;
          if (line) {
            out.push(line);
            line = "";
          }
          out.push(w.slice(0, n));
          w = w.slice(n);
        }
        const test = line ? `${line} ${w}` : w;
        if (!line || ctx.measureText(test).width <= maxW) line = test;
        else {
          out.push(line);
          line = w;
        }
      });
      if (line) out.push(line);
    });
    return out;
  }
  function fitText(ctx, text, fontFn, maxW, maxH, start, min, lh) {
    let size = start;
    let lines = [];
    for (; size >= min; size -= 2) {
      ctx.font = fontFn(size);
      lines = wrapText(ctx, text, maxW);
      if (lines.length * size * lh <= maxH) break;
    }
    size = Math.max(size, min);
    ctx.font = fontFn(size);
    const maxLines = Math.max(1, Math.floor(maxH / (size * lh)));
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      lines[maxLines - 1] = `${lines[maxLines - 1].replace(/\s*\S*$/, "")}…`;
    }
    return { lines, size, lh: size * lh };
  }

  /* ---------- clouds, record, sticker, photo ---------- */
  const CLOUDS_BACK = [
    { x: -80, y: 0.05, s: 1.5, v: 24, a: 0.95 },
    { x: 560, y: 0.085, s: 1.05, v: 15, a: 0.75 },
    { x: 300, y: 0.36, s: 1.3, v: 11, a: 0.5 },
    { x: 760, y: 0.64, s: 1.2, v: 13, a: 0.5 },
    { x: 120, y: 0.94, s: 1.45, v: 20, a: 0.9 },
    { x: 700, y: 0.97, s: 1.1, v: 28, a: 0.7 },
  ];
  const CLOUDS_FRONT = [
    { x: 100, y: 0.32, s: 1.7, v: 30, a: 0.55 },
    { x: 650, y: 0.7, s: 1.9, v: 22, a: 0.5 },
  ];
  function puff(ctx, x, y, s, color, a) {
    [[0, 0, 74], [78, -34, 96], [160, -8, 80], [230, 10, 58], [-58, 14, 54]].forEach(([dx, dy, r]) => {
      const cx = x + dx * s, cy = y + dy * s, rad = r * s;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      g.addColorStop(0, rgba(color, 0.95 * a));
      g.addColorStop(0.55, rgba(color, 0.5 * a));
      g.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    });
  }
  function drawClouds(ctx, S, t, list, mul) {
    const tt = t === null ? 2.6 : t;
    const span = S.W + 760;
    list.forEach((c) => {
      const x = ((((c.x + tt * c.v * 3.2) % span) + span) % span) - 380;
      puff(ctx, x, c.y * S.H, c.s, S.P.cloud, S.P.cloudA * c.a * mul);
    });
  }
  function spinAngle(t) {
    if (t === null) return 0.7;
    const w = 3.9, ramp = 1.0; // ~33⅓ rpm, with a short spin-up
    return t < ramp ? (w * t * t) / (2 * ramp) : w * (t - ramp / 2);
  }
  function drawRecord(ctx, cx, cy, R, ang, S, sideLabel) {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.38)";
    ctx.shadowBlur = R * 0.3;
    ctx.shadowOffsetY = R * 0.1;
    ctx.fillStyle = "#151413";
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.fill();
    ctx.shadowColor = "transparent";
    const body = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R);
    body.addColorStop(0, "#2d2b29");
    body.addColorStop(0.6, "#181716");
    body.addColorStop(1, "#0d0c0c");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.055)";
    ctx.lineWidth = 1.2;
    for (let r = R * 0.42; r < R * 0.97; r += R * 0.045) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TAU);
      ctx.stroke();
    }
    // light scratches rotate with the disc so the spin is easy to see
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    ctx.lineCap = "round";
    [[0.55, 0.2, 0.9, 0.17], [0.7, 1.9, 0.7, 0.13], [0.82, 3.6, 0.8, 0.15], [0.63, 4.9, 0.5, 0.11], [0.9, 2.8, 0.35, 0.1]].forEach(
      ([k, a0, len, al]) => {
        ctx.strokeStyle = `rgba(255,255,255,${al})`;
        ctx.lineWidth = Math.max(1.5, R * 0.012);
        ctx.beginPath();
        ctx.arc(0, 0, R * k, a0, a0 + len);
        ctx.stroke();
      },
    );
    ctx.restore();
    if (ctx.createConicGradient) {
      const cg = ctx.createConicGradient(-0.6, cx, cy);
      [[0, 0], [0.06, 0.15], [0.12, 0], [0.5, 0], [0.56, 0.1], [0.62, 0], [1, 0]].forEach(([p, a]) =>
        cg.addColorStop(p, `rgba(255,255,255,${a})`),
      );
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.98, 0, TAU);
      ctx.arc(cx, cy, R * 0.4, 0, TAU, true);
      ctx.clip("evenodd");
      ctx.fillStyle = cg;
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      ctx.restore();
    }
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    const lab = ctx.createLinearGradient(-R * 0.4, -R * 0.4, R * 0.4, R * 0.4);
    lab.addColorStop(0, S.th.soft);
    lab.addColorStop(1, S.th.accent);
    ctx.fillStyle = lab;
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.36, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.6)";
    ctx.lineWidth = Math.max(1.5, R * 0.012);
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.3, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = "rgba(40,28,22,.84)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `600 ${R * 0.118}px ${SERIF}`;
    ctx.fillText("ConfessMo.", 0, -R * 0.1);
    ctx.font = `600 ${R * 0.052}px ${SANS}`;
    tracked(ctx, sideLabel, 0, R * 0.105, R * 0.014, "center");
    ctx.beginPath();
    ctx.arc(R * 0.225, 0, R * 0.02, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#0d0c0c";
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.035, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }
  function drawSticker(ctx, img, crop, x, y, size, rot, bob) {
    if (!img) return;
    ctx.save();
    ctx.translate(x + size / 2, y + size / 2 + bob);
    ctx.rotate(rot);
    ctx.translate(-size / 2, -size / 2);
    ctx.shadowColor = "rgba(55,41,31,.2)";
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 12;
    rr(ctx, 0, 0, size, size, size * 0.24);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.shadowColor = "transparent";
    rr(ctx, size * 0.04, size * 0.04, size * 0.92, size * 0.92, size * 0.2);
    ctx.clip();
    const sw = img.naturalWidth * crop.width, sh = img.naturalHeight * crop.height;
    const s = Math.min(sw, sh);
    const sx = img.naturalWidth * crop.x + (sw - s) / 2;
    const sy = img.naturalHeight * crop.y + (sh - s) * 0.2;
    ctx.drawImage(img, sx, sy, s, s, size * 0.04, size * 0.04, size * 0.92, size * 0.92);
    ctx.restore();
  }
  function drawPhoto(ctx, img, b, frame, S, t) {
    if (!img) return;
    const P = S.P;
    const k = t === null ? 1.04 : 1 + 0.08 * clamp01(t / DURATION);
    const drift = t === null ? 0 : Math.sin(t * 0.6) * 9;
    const cover = (x, y, w, h, radius) => {
      ctx.save();
      rr(ctx, x, y, w, h, radius);
      ctx.clip();
      const sc = Math.max(w / img.naturalWidth, h / img.naturalHeight) * k;
      const dw = img.naturalWidth * sc, dh = img.naturalHeight * sc;
      ctx.drawImage(img, x + (w - dw) / 2 + drift, y + (h - dh) / 2, dw, dh);
      ctx.restore();
    };
    ctx.save();
    if (frame === "mat") {
      plate(ctx, b, 4, "#FBF9F5", { color: "rgba(40,30,22,.22)", blur: 36, dy: 16 });
      strokeRR(ctx, b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1, 4, "rgba(60,48,36,.14)", 1.5);
      cover(b.x + 26, b.y + 26, b.w - 52, b.h - 52, 2);
      strokeRR(ctx, b.x + 26, b.y + 26, b.w - 52, b.h - 52, 2, "rgba(0,0,0,.2)", 2);
    } else if (frame === "sharp") {
      cover(b.x, b.y, b.w, b.h, 0);
      ctx.fillStyle = "rgba(15,13,10,.62)";
      ctx.fillRect(b.x, b.y + b.h - 46, 190, 46);
      ctx.fillStyle = "#fff";
      ctx.font = `600 15px ${SANS}`;
      ctx.textBaseline = "middle";
      tracked(ctx, "FIG. 01 — A MEMORY", b.x + 18, b.y + b.h - 23, 2.2);
    } else if (frame === "arch") {
      const rad = [b.w * 0.42, b.w * 0.42, 18, 18];
      ctx.shadowColor = "rgba(0,0,0,.35)";
      ctx.shadowBlur = 34;
      ctx.shadowOffsetY = 14;
      rr(ctx, b.x, b.y, b.w, b.h, rad);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.shadowColor = "transparent";
      cover(b.x + 12, b.y + 12, b.w - 24, b.h - 24, rad.map((v) => Math.max(8, v - 12)));
      strokeRR(ctx, b.x + 2, b.y + 2, b.w - 4, b.h - 4, rad, foil(ctx, b, t), 3.5);
    } else {
      ctx.shadowColor = "rgba(40,28,20,.24)";
      ctx.shadowBlur = 34;
      ctx.shadowOffsetY = 14;
      rr(ctx, b.x, b.y, b.w, b.h, 30);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.shadowColor = "transparent";
      cover(b.x + 6, b.y + 6, b.w - 12, b.h - 12, 25);
      if (P.gold) strokeRR(ctx, b.x, b.y, b.w, b.h, 30, foil(ctx, b, t), 3);
    }
    ctx.restore();
  }

  /* ---------- palettes + backdrops + card faces: the 10 designs ---------- */
  const baseGrad = (ctx, S) => {
    const g = ctx.createLinearGradient(0, 0, S.W * 0.45, S.H);
    g.addColorStop(0, S.P.bg[0]);
    g.addColorStop(0.55, S.P.bg[1]);
    g.addColorStop(1, S.P.bg[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S.W, S.H);
  };
  function twinkle(ctx, S, t, color, count, scale = 1) {
    S.stars.slice(0, count).forEach((s) => {
      const a = t === null ? 0.7 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 1.8 + s.ph));
      sparkle(ctx, s.x, s.y, s.r * 4.2 * scale, color, a * s.a);
    });
  }
  function dust(ctx, S, t, color) {
    const tt = t === null ? 3 : t;
    S.dust.forEach((d) => {
      const y = (((d.y - tt * d.v) % (S.H + 40)) + S.H + 40) % (S.H + 40) - 20;
      const x = d.x + Math.sin(tt * 0.5 + d.ph) * 14;
      ctx.fillStyle = rgba(color, d.a * (0.5 + 0.5 * Math.sin(tt * 1.4 + d.ph)));
      ctx.beginPath();
      ctx.arc(x, y, d.r, 0, TAU);
      ctx.fill();
    });
  }
  function shimmerSheen(ctx, r, radius, t, strength) {
    const shift = t === null ? r.w * 0.1 : ((t * 90) % (r.w * 2.2)) - r.w * 0.7;
    const g = ctx.createLinearGradient(r.x + shift, r.y, r.x + shift + r.w * 0.7, r.y + r.h * 0.55);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5, `rgba(255,255,255,${strength})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.save();
    rr(ctx, r.x, r.y, r.w, r.h, radius);
    ctx.clip();
    ctx.fillStyle = g;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.restore();
  }
  function deco(ctx, x, y, dx, dy, c, len = 70) {
    // art-deco corner bracket with a diamond
    ctx.save();
    ctx.strokeStyle = c;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(x + dx * len, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + dy * len);
    ctx.stroke();
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x + dx * (len - 18), y + dy * 14);
    ctx.lineTo(x + dx * 14, y + dy * 14);
    ctx.lineTo(x + dx * 14, y + dy * (len - 18));
    ctx.stroke();
    diamond(ctx, x + dx * 14, y + dy * 14, 7, c);
    ctx.restore();
  }

  const DESIGNS = {
    classic: {
      name: "Letterpress", hint: "quiet paper luxury", align: "left", head: "brand", photoFrame: "round",
      pal: (th) => ({
        dark: false, gold: true, deboss: true,
        bg: [mix(th.bg, "#fff", 0.5), th.bg, mix(th.bg, th.soft, 0.5)],
        card: "#FFFCF7", ink: mix(th.ink, "#241810", 0.4), accent: th.accent,
        cloud: "#ffffff", cloudA: 0.9, cloudMid: 0.4,
      }),
      back(ctx, S) {
        baseGrad(ctx, S);
        glow(ctx, S.W * 0.9, S.H * 0.07, 600, S.th.soft, 0.55);
        glow(ctx, S.W * 0.05, S.H * 0.95, 640, S.th.soft, 0.45);
      },
      face(ctx, S, t) {
        const r = S.L.r;
        const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
        g.addColorStop(0, "#FFFEFB");
        g.addColorStop(1, mix("#FFFCF7", S.th.tint, 0.42));
        plate(ctx, r, 46, g, { color: "rgba(70,45,30,.22)", blur: 70, dy: 30 });
        grain(ctx, r, 46, 0.07);
        strokeRR(ctx, r.x + 28, r.y + 28, r.w - 56, r.h - 56, 30, foil(ctx, r, t), 2.6);
        strokeRR(ctx, r.x + 40, r.y + 40, r.w - 80, r.h - 80, 22, rgba(S.P.accent, 0.3), 1);
      },
    },
    polaroid: {
      name: "Gallery", hint: "framed like fine art", align: "left", head: "plate", photoFrame: "mat", sig: "plate",
      pal: (th) => ({
        dark: false,
        bg: [mix("#EFE9E0", th.bg, 0.22), mix("#E6DFD4", th.bg, 0.2), mix("#DAD1C4", th.soft, 0.18)],
        card: "#FFFFFF", ink: "#2A2825", accent: th.accent, cloud: "#ffffff", cloudA: 0.45, cloudMid: 0.25,
      }),
      back(ctx, S) {
        baseGrad(ctx, S);
        glow(ctx, S.W * 0.2, S.H * 0.12, 700, "#ffffff", 0.55);
        const v = ctx.createRadialGradient(S.W / 2, S.H / 2, S.H * 0.3, S.W / 2, S.H / 2, S.H * 0.75);
        v.addColorStop(0, "rgba(60,45,30,0)");
        v.addColorStop(1, "rgba(60,45,30,.2)");
        ctx.fillStyle = v;
        ctx.fillRect(0, 0, S.W, S.H);
      },
      face(ctx, S) {
        const r = S.L.r;
        const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
        g.addColorStop(0, "#FFFFFF");
        g.addColorStop(1, "#FAF8F4");
        plate(ctx, r, 8, g, { color: "rgba(40,30,22,.32)", blur: 90, dy: 42 });
        strokeRR(ctx, r.x + 26, r.y + 26, r.w - 52, r.h - 52, 3, "rgba(120,104,84,.28)", 1.5);
      },
    },
    kawaii: {
      name: "Cloud Couture", hint: "soft + collectible", align: "left", head: "brand", photoFrame: "round", sticker: true, sparkles: true,
      pal: (th) => ({
        dark: false,
        bg: [mix(th.bg, "#fff", 0.2), mix(th.soft, "#fff", 0.55), mix(th.soft, th.bg, 0.3)],
        card: "#FFFFFF", ink: th.ink, accent: th.accent, cloud: "#ffffff", cloudA: 1.15, cloudMid: 0.5,
      }),
      back(ctx, S, t) {
        baseGrad(ctx, S);
        glow(ctx, S.W * 0.85, S.H * 0.1, 520, "#ffffff", 0.7);
        twinkle(ctx, S, t, "#ffffff", 14, 1.4);
      },
      face(ctx, S) {
        const r = S.L.r;
        const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
        g.addColorStop(0, "#FFFFFF");
        g.addColorStop(1, mix("#FFFFFF", S.th.tint, 0.6));
        plate(ctx, r, 80, g, { color: rgba(S.th.accent, 0.3), blur: 70, dy: 28 });
        strokeRR(ctx, r.x + 3, r.y + 3, r.w - 6, r.h - 6, 77, "#ffffff", 6);
        ctx.save();
        ctx.setLineDash([0.1, 17]);
        ctx.lineCap = "round";
        strokeRR(ctx, r.x + 22, r.y + 22, r.w - 44, r.h - 44, 60, rgba(S.th.accent, 0.7), 5);
        ctx.restore();
      },
    },
    vinyl: {
      name: "Record Atelier", hint: "album-sleeve mood", align: "left", head: "brand", photoFrame: "round", recordStyle: "peek", spine: true,
      pal: (th) => ({
        dark: false, backDark: true,
        bg: ["#1f1a17", mix("#2c241f", th.accent, 0.14), "#14100d"],
        card: "#F7F0E4", ink: "#2B2118", accent: th.accent, cloud: th.soft, cloudA: 0.16, cloudMid: 0.3,
      }),
      back(ctx, S) {
        baseGrad(ctx, S);
        glow(ctx, S.W * 0.85, S.H * 0.08, 640, S.th.accent, 0.3);
        ctx.strokeStyle = "rgba(255,255,255,.035)";
        ctx.lineWidth = 2;
        for (let r = 140; r < 700; r += 36) {
          ctx.beginPath();
          ctx.arc(S.W * 0.9, S.H * 0.96, r, 0, TAU);
          ctx.stroke();
        }
      },
      face(ctx, S) {
        const r = S.L.r;
        const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
        g.addColorStop(0, "#FBF6EC");
        g.addColorStop(1, mix("#F3EADB", S.th.tint, 0.35));
        plate(ctx, r, 22, g, { color: "rgba(0,0,0,.5)", blur: 80, dy: 40 });
        grain(ctx, r, 22, 0.11);
        ctx.save();
        rr(ctx, r.x, r.y, r.w, r.h, 22);
        ctx.clip();
        ctx.fillStyle = S.th.soft;
        ctx.fillRect(r.x, r.y, 46, r.h);
        ctx.fillStyle = "rgba(0,0,0,.08)";
        ctx.fillRect(r.x + 46, r.y, 2, r.h);
        ctx.translate(r.x + 30, r.y + r.h - 70);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = "rgba(43,33,24,.62)";
        ctx.font = `600 15px ${SANS}`;
        ctx.textBaseline = "middle";
        tracked(ctx, "SIDE A  ·  CONFESSMO.  ·  STEREO", 0, 0, 3.2);
        ctx.restore();
      },
    },
    midnight: {
      name: "Nocturne", hint: "cinematic night sky", align: "center", head: "crest", crestText: "CONFESSMO.", photoFrame: "round", italic: true, moon: true,
      pal: (th) => ({
        dark: true, gold: true,
        bg: ["#0B0E1E", "#171C38", "#080A15"],
        card: "#1B2040", ink: "#F6F1FF", accent: mix(th.accent, "#F2D9A0", 0.45),
        cloud: "#9FB1FF", cloudA: 0.14, cloudMid: 0.35,
      }),
      back(ctx, S, t) {
        baseGrad(ctx, S);
        glow(ctx, S.W * 0.82, S.H * 0.08, 560, "#8EA0FF", 0.22);
        glow(ctx, S.W * 0.1, S.H * 0.9, 600, S.th.accent, 0.12);
        twinkle(ctx, S, t, "#FFF4D6", 60);
      },
      face(ctx, S, t) {
        const r = S.L.r;
        const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w * 0.3, r.y + r.h);
        g.addColorStop(0, "#232950");
        g.addColorStop(1, "#12162C");
        plate(ctx, r, 58, g, { color: "rgba(0,0,0,.55)", blur: 80, dy: 36 });
        grain(ctx, r, 58, 0.05);
        strokeRR(ctx, r.x + 1, r.y + 1, r.w - 2, r.h - 2, 57, "rgba(255,255,255,.1)", 2);
        strokeRR(ctx, r.x + 26, r.y + 26, r.w - 52, r.h - 52, 36, foil(ctx, r, t), 2);
        crescent(ctx, r.x + r.w - 104, r.y + 112, 60, "#F2D9A0");
        sparkle(ctx, r.x + r.w - 150, r.y + 84, 9, "#F2D9A0", 0.9);
        sparkle(ctx, r.x + r.w - 70, r.y + 160, 6, "#F2D9A0", 0.7);
      },
    },
    editorial: {
      name: "Editorial", hint: "magazine cover", align: "left", head: "masthead", photoFrame: "sharp", quote: true,
      pal: (th) => ({
        dark: false,
        bg: [mix("#F1EDE6", th.bg, 0.25), mix("#E9E3D9", th.bg, 0.2), mix("#DDD6CA", th.soft, 0.2)],
        card: "#FBF9F5", ink: "#171512", accent: th.accent, cloud: "#ffffff", cloudA: 0.5, cloudMid: 0.25,
      }),
      back(ctx, S) {
        baseGrad(ctx, S);
        glow(ctx, S.W * 0.9, S.H * 0.1, 560, S.th.soft, 0.4);
      },
      face(ctx, S) {
        const r = S.L.r;
        plate(ctx, r, 6, "#FBF9F5", { color: "rgba(30,24,18,.3)", blur: 70, dy: 30 });
        grain(ctx, r, 6, 0.06);
        strokeRR(ctx, r.x + 22, r.y + 22, r.w - 44, r.h - 44, 0, "rgba(23,21,18,.85)", 1.6);
      },
    },
    glass: {
      name: "Glass House", hint: "frosted modern luxe", align: "left", head: "brand", photoFrame: "round",
      pal: (th) => ({
        dark: false,
        bg: [mix(th.soft, "#fff", 0.35), mix(th.accent, "#fff", 0.45), mix(th.tint, th.soft, 0.5)],
        card: "#FFFFFF", ink: mix(th.ink, "#000", 0.25), accent: th.accent, cloud: "#ffffff", cloudA: 0.7, cloudMid: 0.3,
      }),
      back(ctx, S, t) {
        baseGrad(ctx, S);
        const tt = t === null ? 1.5 : t;
        glow(ctx, S.W * 0.2 + Math.sin(tt * 0.5) * 70, S.H * 0.22, 560, S.th.accent, 0.6);
        glow(ctx, S.W * 0.86, S.H * 0.52 + Math.cos(tt * 0.4) * 90, 640, S.th.soft, 0.7);
        glow(ctx, S.W * 0.3 + Math.cos(tt * 0.45) * 60, S.H * 0.92, 600, "#ffffff", 0.7);
      },
      face(ctx, S, t) {
        const r = S.L.r;
        const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
        g.addColorStop(0, "rgba(255,255,255,.62)");
        g.addColorStop(1, "rgba(255,255,255,.3)");
        plate(ctx, r, 66, g, { color: rgba(S.th.accent, 0.3), blur: 90, dy: 38 });
        shimmerSheen(ctx, r, 66, t, 0.28);
        strokeRR(ctx, r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3, 64, "rgba(255,255,255,.92)", 3);
        strokeRR(ctx, r.x + 16, r.y + 16, r.w - 32, r.h - 32, 52, "rgba(255,255,255,.4)", 1.5);
      },
    },
    silk: {
      name: "Silk", hint: "satin gradient couture", align: "center", head: "crest", crestText: "CONFESSMO.", photoFrame: "round", italic: true,
      pal: (th) => ({
        dark: false, gold: true,
        bg: [mix(th.soft, "#fff", 0.55), mix(th.bg, "#fff", 0.25), mix(th.accent, th.soft, 0.4)],
        card: "#FFFFFF", ink: mix(th.ink, "#1a1014", 0.3), accent: th.accent, cloud: "#ffffff", cloudA: 0.8, cloudMid: 0.35,
      }),
      back(ctx, S, t) {
        baseGrad(ctx, S);
        const tt = t === null ? 2 : t;
        ctx.save();
        ctx.lineCap = "round";
        [[0.22, 170, 0.34], [0.55, 130, 0.26], [0.82, 190, 0.3]].forEach(([k, w, a], i) => {
          const dy = Math.sin(tt * 0.6 + i * 1.7) * 60;
          const g = ctx.createLinearGradient(0, 0, S.W, 0);
          g.addColorStop(0, rgba("#ffffff", 0));
          g.addColorStop(0.5, rgba("#ffffff", a));
          g.addColorStop(1, rgba(S.th.accent, a * 0.6));
          ctx.strokeStyle = g;
          ctx.lineWidth = w;
          ctx.beginPath();
          ctx.moveTo(-120, S.H * k + dy);
          ctx.bezierCurveTo(S.W * 0.3, S.H * (k - 0.12) - dy, S.W * 0.6, S.H * (k + 0.16) + dy, S.W + 120, S.H * (k - 0.03) - dy);
          ctx.stroke();
        });
        ctx.restore();
      },
      face(ctx, S, t) {
        const r = S.L.r;
        const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
        g.addColorStop(0, "#FFFFFF");
        g.addColorStop(0.5, mix("#FFFFFF", S.th.tint, 0.55));
        g.addColorStop(1, mix("#FFFFFF", S.th.soft, 0.4));
        plate(ctx, r, 66, g, { color: rgba(S.th.accent, 0.32), blur: 80, dy: 34 });
        shimmerSheen(ctx, r, 66, t, 0.5);
        grain(ctx, r, 66, 0.035);
        strokeRR(ctx, r.x + 24, r.y + 24, r.w - 48, r.h - 48, 46, foil(ctx, r, t), 2);
      },
    },
    maison: {
      name: "Maison Gold", hint: "ivory + gold foil", align: "center", head: "crest", crestText: "MAISON CONFESSMO", photoFrame: "arch", italic: true, gold: true, ornament: true,
      pal: (th) => ({
        dark: false, gold: true, backDark: true,
        bg: ["#0A0908", "#18130D", "#060504"],
        card: "#F8F1E3", ink: "#2A2118", accent: mix("#B08A4A", th.accent, 0.18),
        cloud: "#D9B77A", cloudA: 0.1, cloudMid: 0,
      }),
      back(ctx, S, t) {
        baseGrad(ctx, S);
        glow(ctx, S.W * 0.5, S.H * 0.04, 760, "#C9A25C", 0.28);
        glow(ctx, S.W * 0.5, S.H * 1.0, 800, "#C9A25C", 0.16);
        dust(ctx, S, t, "#F0D9A0");
      },
      face(ctx, S, t) {
        const r = S.L.r;
        const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
        g.addColorStop(0, "#FBF5E8");
        g.addColorStop(1, "#EFE3CB");
        plate(ctx, r, 10, g, { color: "rgba(0,0,0,.6)", blur: 90, dy: 40 });
        grain(ctx, r, 10, 0.09);
        strokeRR(ctx, r.x + 24, r.y + 24, r.w - 48, r.h - 48, 4, foil(ctx, r, t), 3.2);
        strokeRR(ctx, r.x + 38, r.y + 38, r.w - 76, r.h - 76, 2, rgba("#B08A4A", 0.7), 1.2);
        const c = foil(ctx, r, t);
        deco(ctx, r.x + 24, r.y + 24, 1, 1, c);
        deco(ctx, r.x + r.w - 24, r.y + 24, -1, 1, c);
        deco(ctx, r.x + 24, r.y + r.h - 24, 1, -1, c);
        deco(ctx, r.x + r.w - 24, r.y + r.h - 24, -1, -1, c);
      },
    },
    velvet: {
      name: "Velvet Rouge", hint: "burgundy + champagne", align: "center", head: "crest", crestText: "CONFESSMO.", photoFrame: "round", italic: true, gold: true, ornament: true,
      pal: (th) => ({
        dark: true, gold: true,
        bg: [mix("#2A0A14", th.accent, 0.1), mix("#4A1424", th.accent, 0.1), "#1B060D"],
        card: "#4A1424", ink: "#F7E8D0", accent: "#D9B77A",
        cloud: "#FF9FB4", cloudA: 0.11, cloudMid: 0.25,
      }),
      back(ctx, S, t) {
        baseGrad(ctx, S);
        glow(ctx, S.W * 0.2, S.H * 0.1, 640, "#C2415F", 0.3);
        dust(ctx, S, t, "#F0D9A0");
      },
      face(ctx, S, t) {
        const r = S.L.r;
        const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
        g.addColorStop(0, "#64203A");
        g.addColorStop(1, "#3A0E1B");
        plate(ctx, r, 46, g, { color: "rgba(0,0,0,.6)", blur: 80, dy: 36 });
        ctx.save();
        rr(ctx, r.x, r.y, r.w, r.h, 46);
        ctx.clip();
        const v = ctx.createRadialGradient(r.x + r.w / 2, r.y + r.h / 2, r.h * 0.2, r.x + r.w / 2, r.y + r.h / 2, r.h * 0.7);
        v.addColorStop(0, "rgba(0,0,0,0)");
        v.addColorStop(1, "rgba(0,0,0,.42)");
        ctx.fillStyle = v;
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.restore();
        shimmerSheen(ctx, r, 46, t, 0.1);
        grain(ctx, r, 46, 0.09);
        strokeRR(ctx, r.x + 28, r.y + 28, r.w - 56, r.h - 56, 30, foil(ctx, r, t), 2.4);
        [[r.x + 28, r.y + 28], [r.x + r.w - 28, r.y + 28], [r.x + 28, r.y + r.h - 28], [r.x + r.w - 28, r.y + r.h - 28]].forEach(
          ([x, y]) => diamond(ctx, x, y, 9, "#E6CF94"),
        );
      },
    },
  };
  const DESIGN_ORDER = Object.keys(DESIGNS);

  /* ---------- layout + scene ---------- */
  const TEXT_START = 1.5;
  const END_START = 6.1;
  function makeLayout(shape, design, hasPhoto, hasSong) {
    const mast = design.head === "masthead";
    if (shape === "story") {
      // Keeps everything inside Instagram/Facebook Story safe zones.
      const r = { x: 60, y: 196, w: 960, h: 1508 };
      const pad = 88;
      const L = { shape, r, pad, left: r.x + pad, right: r.x + r.w - pad, cx: r.x + r.w / 2, innerW: r.w - pad * 2 };
      L.headY = r.y + 104;
      L.toY = r.y + (mast ? 296 : 248);
      const pTop = r.y + (mast ? 336 : 296);
      L.photo = hasPhoto ? { x: L.left, y: pTop, w: L.innerW, h: 380 } : null;
      L.textTop = L.photo ? pTop + 380 + 52 : r.y + (mast ? 344 : 316);
      const peek = design.recordStyle === "peek";
      L.textBottom = r.y + r.h - (peek ? 470 : 392);
      L.record = peek
        ? { cx: r.x + r.w - 20, cy: r.y + r.h - 212, R: 236 }
        : { cx: L.left + 124, cy: r.y + r.h - 214, R: 124 };
      L.sticker = { x: r.x + r.w - pad - 168, y: r.y + r.h - 322, size: 168 };
      L.tagY = r.y + r.h - 56;
      return L;
    }
    const r = { x: 70, y: 70, w: 940, h: 1210 };
    const pad = 82;
    const L = { shape, r, pad, left: r.x + pad, right: r.x + r.w - pad, cx: r.x + r.w / 2, innerW: r.w - pad * 2 };
    L.headY = r.y + 98;
    L.toY = r.y + (mast ? 262 : 206);
    const pTop = r.y + (mast ? 296 : 240);
    L.photo = hasPhoto ? { x: L.left, y: pTop, w: L.innerW, h: 300 } : null;
    L.textTop = L.photo ? pTop + 300 + 44 : r.y + (mast ? 304 : 252);
    L.musicY = r.y + r.h - 252;
    L.textBottom = hasSong ? L.musicY - 36 : r.y + r.h - 150;
    L.sticker = { x: r.x + r.w - pad - 150, y: r.y + r.h - 252, size: 150 };
    L.tagY = r.y + r.h - 62;
    return L;
  }

  function trackedWidth(ctx, str, sp) {
    return [...String(str)].reduce((a, c) => a + ctx.measureText(c).width, 0) + sp * Math.max(0, [...String(str)].length - 1);
  }
  function ornamentRule(ctx, cx, y, w, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, y);
    ctx.lineTo(cx - 16, y);
    ctx.moveTo(cx + 16, y);
    ctx.lineTo(cx + w / 2, y);
    ctx.stroke();
    diamond(ctx, cx, y, 6, color);
    ctx.restore();
  }
  function moodPill(ctx, S, rightX, y, size) {
    const { P, mood } = S;
    ctx.font = `600 ${size}px ${SANS}`;
    const label = mood.label.toUpperCase();
    const tw = trackedWidth(ctx, label, 2.2);
    const w = tw + 82, h = size * 3;
    const x = rightX - w;
    rr(ctx, x, y - h / 2, w, h, h / 2);
    ctx.fillStyle = P.pillBg;
    ctx.fill();
    moodIcon(ctx, mood.icon, x + 34, y, size * 1.5, P.ink);
    ctx.fillStyle = P.ink;
    ctx.textBaseline = "middle";
    tracked(ctx, label, x + 58, y + 1, 2.2);
  }
  function drawHead(ctx, S, t) {
    const { P, L, design, mood } = S;
    const y = L.headY;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    if (design.head === "brand") {
      ctx.fillStyle = P.ink;
      ctx.font = `600 50px ${SERIF}`;
      ctx.fillText("ConfessMo.", L.left, y + 18);
      moodPill(ctx, S, L.right, y, 17);
    } else if (design.head === "plate") {
      ctx.fillStyle = P.mute;
      ctx.font = `600 15px ${SANS}`;
      ctx.textBaseline = "middle";
      tracked(ctx, "CONFESSMO.  ·  THE GALLERY", L.left, y, 3.4);
      ctx.font = `600 15px ${SANS}`;
      const label = mood.label.toUpperCase();
      const tw = trackedWidth(ctx, label, 3);
      moodIcon(ctx, mood.icon, L.right - tw - 26, y, 22, P.ink);
      ctx.fillStyle = P.ink;
      tracked(ctx, label, L.right, y, 3, "right");
      ctx.fillStyle = P.faint;
      ctx.fillRect(L.left, y + 34, L.innerW, 1.5);
    } else if (design.head === "masthead") {
      ctx.fillStyle = P.ink;
      ctx.fillRect(L.left, y - 56, L.innerW, 5);
      ctx.font = `600 88px ${SERIF}`;
      ctx.textAlign = "center";
      ctx.fillText("ConfessMo.", L.cx, y + 28);
      ctx.fillRect(L.left, y + 52, L.innerW, 1.6);
      ctx.font = `600 15px ${SANS}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      tracked(ctx, `VOL. 01  —  Nº ${S.issue}`, L.left, y + 90, 3.2);
      const label = mood.label.toUpperCase();
      const tw = trackedWidth(ctx, label, 3);
      moodIcon(ctx, mood.icon, L.right - tw - 24, y + 90, 22, P.accent);
      tracked(ctx, label, L.right, y + 90, 3, "right");
    } else {
      // crest: centred wordmark between two diamonds, mood underneath
      ctx.font = `600 23px ${SANS}`;
      ctx.textBaseline = "middle";
      ctx.fillStyle = P.dark ? foil(ctx, { x: L.cx - 200, y: y - 20, w: 400, h: 40 }, t) : P.accent;
      const tw = tracked(ctx, design.crestText, L.cx, y, 7, "center");
      diamond(ctx, L.cx - tw / 2 - 34, y, 7, P.accent);
      diamond(ctx, L.cx + tw / 2 + 34, y, 7, P.accent);
      ctx.font = `600 15px ${SANS}`;
      const label = mood.label.toUpperCase();
      const mw = trackedWidth(ctx, label, 3.4);
      moodIcon(ctx, mood.icon, L.cx - mw / 2 - 20, y + 54, 22, P.mute);
      ctx.fillStyle = P.mute;
      tracked(ctx, label, L.cx + 14, y + 54, 3.4, "center");
    }
  }

  function drawRecordZone(ctx, S, t) {
    const { P, L, design, song } = S;
    const rec = L.record;
    const peek = design.recordStyle === "peek";
    const a = t === null ? 1 : easeOut((t - 0.7) / 0.8);
    withAlpha(ctx, a, () => {
      ctx.save();
      if (peek) {
        rr(ctx, L.r.x, L.r.y, L.r.w, L.r.h, 22);
        ctx.clip();
      }
      ctx.translate(t === null ? 0 : (1 - a) * (peek ? 60 : -40), 0);
      drawRecord(ctx, rec.cx, rec.cy, rec.R, spinAngle(t), S, "SIDE A");
      ctx.restore();
      const tx = peek ? L.left : rec.cx + rec.R + 44;
      const maxW = peek ? rec.cx - rec.R - 44 - L.left : (design.sticker ? L.sticker.x - 24 : L.right) - tx;
      const eyebrow = song ? "NOW PLAYING" : "SIDE A";
      const title = song ? song.title : "your heart, out loud.";
      const sub = song ? song.artist : "a ConfessMo. original";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = P.accent;
      ctx.font = `600 16px ${SANS}`;
      tracked(ctx, eyebrow, tx, rec.cy - 38, 4);
      ctx.fillStyle = P.ink;
      ctx.font = `600 ${peek ? 52 : 46}px ${SERIF}`;
      ctx.fillText(ellipsize(ctx, title, maxW), tx, rec.cy + 14);
      ctx.fillStyle = P.mute;
      ctx.font = `500 22px ${SANS}`;
      ctx.fillText(ellipsize(ctx, sub, maxW), tx, rec.cy + 54);
    });
  }

  function drawMusicStrip(ctx, S) {
    const { P, L, song, note, th } = S;
    if (!song) return;
    const style = note.musicStyle || "box";
    const y = L.musicY;
    const w = S.design.sticker ? L.sticker.x - 24 - L.left : L.innerW;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    if (style === "vinyl") {
      drawRecord(ctx, L.left + 62, y + 62, 62, 0.7, S, "SIDE A");
      ctx.fillStyle = P.ink;
      ctx.font = `600 38px ${SERIF}`;
      ctx.fillText(ellipsize(ctx, song.title, w - 160), L.left + 156, y + 56);
      ctx.fillStyle = P.mute;
      ctx.font = `500 20px ${SANS}`;
      ctx.fillText(ellipsize(ctx, song.artist, w - 160), L.left + 156, y + 92);
    } else if (style === "text") {
      sparkle(ctx, L.left + 12, y + 56, 11, P.accent);
      ctx.fillStyle = P.ink;
      ctx.font = `600 22px ${SANS}`;
      ctx.fillText(ellipsize(ctx, `${song.title} — ${song.artist}`, w - 40), L.left + 38, y + 63);
    } else {
      rr(ctx, L.left, y, w, 112, 26);
      ctx.fillStyle = P.dark ? "rgba(255,255,255,.07)" : rgba(P.accent, 0.13);
      ctx.fill();
      rr(ctx, L.left + 18, y + 18, 76, 76, 18);
      ctx.fillStyle = song.color || th.soft;
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `600 38px ${SERIF}`;
      ctx.textAlign = "center";
      ctx.fillText(song.title.slice(0, 1).toUpperCase(), L.left + 56, y + 68);
      ctx.textAlign = "left";
      ctx.fillStyle = P.ink;
      ctx.font = `600 24px ${SANS}`;
      ctx.fillText(ellipsize(ctx, song.title, w - 140), L.left + 114, y + 52);
      ctx.fillStyle = P.mute;
      ctx.font = `500 19px ${SANS}`;
      ctx.fillText(ellipsize(ctx, song.artist, w - 140), L.left + 114, y + 82);
    }
  }

  function drawContent(ctx, S, t) {
    const { P, L, design, note, img } = S;
    const center = design.align === "center";
    const ax = center ? L.cx : L.left;
    const ta = center ? "center" : "left";
    const T = (a, b) => (t === null ? 1 : easeOut((t - a) / (b - a)));

    withAlpha(ctx, T(0.45, 1.1), () => drawHead(ctx, S, t));

    withAlpha(ctx, T(0.8, 1.4), () => {
      ctx.textAlign = ta;
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = P.mute;
      ctx.font = `italic 500 38px ${SERIF}`;
      ctx.fillText(ellipsize(ctx, `To ${note.to || "whoever needs this"}`, L.innerW), ax, L.toY);
    });

    if (L.photo && img.photo) {
      const pa = T(0.9, 1.7);
      withAlpha(ctx, pa, () => {
        ctx.save();
        ctx.translate(0, t === null ? 0 : (1 - pa) * 26);
        drawPhoto(ctx, img.photo, L.photo, design.photoFrame, S, t);
        ctx.restore();
      });
    }

    const { lines, size, lh } = S.fit;
    const n = lines.length;
    const zoneH = L.textBottom - L.textTop;
    const groupH = n * lh + S.sigH;
    const y0 = L.textTop + Math.max(0, (zoneH - groupH) / 2);
    const d = Math.min(0.5, 3.0 / Math.max(1, n));

    if (design.quote) {
      withAlpha(ctx, T(1.2, 1.9) * 0.9, () => {
        ctx.fillStyle = rgba(P.accent, 0.4);
        ctx.font = `600 230px ${SERIF}`;
        ctx.textAlign = "right";
        ctx.fillText("”", L.right + 4, L.toY + 86);
      });
    }

    ctx.textAlign = ta;
    ctx.textBaseline = "alphabetic";
    ctx.font = S.fontFn(size);
    lines.forEach((line, i) => {
      if (!line) return;
      const p = t === null ? 1 : easeOut((t - (TEXT_START + i * d)) / 0.6);
      if (p <= 0) return;
      const base = y0 + i * lh + size * 0.82;
      ctx.save();
      ctx.globalAlpha *= p;
      ctx.translate(0, (1 - p) * 22);
      if (P.deboss) {
        ctx.fillStyle = "rgba(255,255,255,.9)";
        ctx.fillText(line, ax, base + 1.8);
      }
      ctx.fillStyle = P.ink;
      ctx.fillText(line, ax, base);
      ctx.restore();
    });

    const sigStart = t === null ? 0 : Math.min(5.0, TEXT_START + n * d + 0.35);
    const sp = t === null ? 1 : easeOut((t - sigStart) / 0.6);
    withAlpha(ctx, sp, () => {
      const sy = y0 + n * lh + 34;
      ctx.textAlign = ta;
      ctx.textBaseline = "alphabetic";
      if (design.sig === "plate") {
        ctx.font = `italic 500 28px ${SERIF}`;
        const line2 = "anonymously, with feeling";
        const pw = Math.min(L.innerW, Math.max(ctx.measureText(line2).width + 150, 400));
        const px = ax;
        rr(ctx, px, sy, pw, 92, 3);
        ctx.fillStyle = "#FBFAF7";
        ctx.fill();
        ctx.strokeStyle = "rgba(60,48,36,.3)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.textAlign = "left";
        ctx.fillStyle = P.ink;
        ctx.font = `600 14px ${SANS}`;
        tracked(ctx, `UNTITLED, ${S.year}`, px + 24, sy + 34, 3);
        ctx.fillStyle = P.mute;
        ctx.font = `italic 500 28px ${SERIF}`;
        ctx.fillText(line2, px + 24, sy + 70);
      } else {
        if (design.ornament) ornamentRule(ctx, ax, sy + 2, 240, P.accent);
        ctx.fillStyle = P.mute;
        ctx.font = `italic 500 32px ${SERIF}`;
        ctx.fillText("— anonymously, with feeling.", ax, sy + (design.ornament ? 44 : 30));
      }
    });

    if (L.shape === "story") drawRecordZone(ctx, S, t);
    else {
      drawMusicStrip(ctx, S);
      withAlpha(ctx, 1, () => {
        ctx.textAlign = ta;
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = P.mute;
        ctx.font = `italic 500 26px ${SERIF}`;
        ctx.fillText("a little less unsaid.", ax, L.tagY);
      });
    }

    if (design.sticker && img.char) {
      const a = T(3.2, 4.0);
      withAlpha(ctx, a, () => {
        const bob = t === null ? 0 : Math.sin(t * 2.1) * 8;
        drawSticker(ctx, img.char, S.charCrop, L.sticker.x, L.sticker.y, L.sticker.size, 0.045, bob);
      });
    }
  }

  function drawEnd(ctx, S, t) {
    const a = easeOut((t - END_START) / 0.7);
    if (a <= 0) return;
    const { P, W, H } = S;
    ctx.save();
    ctx.fillStyle = rgba(P.endBg, 0.992 * a);
    ctx.fillRect(0, 0, W, H);
    glow(ctx, W / 2, H / 2, 700, P.accent, 0.2 * a);
    const w = easeOut((t - END_START - 0.2) / 0.85);
    ctx.save();
    ctx.globalAlpha = w;
    const sc = 0.93 + 0.07 * w;
    ctx.translate(W / 2, H / 2 - 20);
    ctx.scale(sc, sc);
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.font = `600 170px ${SERIF}`;
    const tw = ctx.measureText("ConfessMo.").width;
    ctx.fillStyle = P.gold ? foil(ctx, { x: -tw / 2, y: -120, w: tw, h: 160 }, t) : P.endInk;
    ctx.fillText("ConfessMo.", 0, 0);
    heart(ctx, tw / 2 + 10, -118, 44, P.accent, false);
    ctx.restore();
    withAlpha(ctx, easeOut((t - END_START - 0.7) / 0.7), () => {
      ctx.textAlign = "center";
      ctx.fillStyle = rgba(P.endInk, 0.7);
      ctx.font = `italic 500 48px ${SERIF}`;
      ctx.fillText("a little less unsaid.", W / 2, H / 2 + 86);
      ornamentRule(ctx, W / 2, H / 2 + 140, 160, P.accent);
    });
    ctx.restore();
  }

  function buildScene(note, shape, designId, themeId, img) {
    const { W, H } = SIZES[shape];
    const design = DESIGNS[designId] || DESIGNS.classic;
    const th = deps.themes[themeId] || deps.themes.cream;
    const P = design.pal(th);
    P.mute = rgba(P.ink, 0.64);
    P.faint = rgba(P.ink, 0.18);
    P.pillBg = P.dark ? "rgba(255,255,255,.1)" : rgba(P.accent, 0.16);
    P.endBg = P.backDark || P.dark ? P.bg[0] : mix(P.bg[0], "#ffffff", 0.35);
    P.endInk = P.backDark || P.dark ? "#F6EFE2" : P.ink;
    if (P.backDark && !P.dark) P.endInk = "#F4EBDA";
    const mood = deps.moods[note.mood] || deps.moods.life;
    const song = note.song && note.musicStyle !== "none" ? deps.normalizeSong(note.song) : null;
    const L = makeLayout(shape, design, Boolean(img && img.photo), Boolean(song));
    const rnd = mulberry32(hashString(String(note.id || note.message || "x")));
    const stars = Array.from({ length: 90 }, () => ({ x: rnd() * W, y: rnd() * H * 0.82, r: 0.6 + rnd() * 1.6, ph: rnd() * TAU, a: 0.45 + rnd() * 0.55 }));
    const dustList = Array.from({ length: 46 }, () => ({ x: rnd() * W, y: rnd() * H, v: 10 + rnd() * 24, r: 0.8 + rnd() * 2.2, ph: rnd() * TAU, a: 0.25 + rnd() * 0.5 }));
    const fontFn = (s) => `${design.italic ? "italic " : ""}500 ${s}px ${SERIF}`;
    const sigH = design.sig === "plate" ? 150 : design.ornament ? 108 : 86;
    const sc = mkCanvas(8, 8).getContext("2d");
    const zoneH = L.textBottom - L.textTop;
    const start = shape === "story" ? (L.photo ? 62 : 92) : L.photo ? 52 : 70;
    const fit = fitText(sc, note.message, fontFn, L.innerW, zoneH - sigH, start, shape === "story" ? 30 : 26, 1.2);
    const ts = Number(note.createdAt) > 1e11 ? Number(note.createdAt) : Date.now();
    const S = {
      W, H, shape, design, th, P, mood, song, note, L, img: img || {}, stars, dust: dustList, fit, fontFn, sigH,
      charCrop: img && img.charCrop ? img.charCrop : { x: 0, y: 0, width: 1, height: 1 },
      issue: String((hashString(String(note.id || note.message)) % 900) + 100),
      year: String(new Date(ts).getFullYear()),
    };
    S.draw = (ctx, t) => {
      ctx.save();
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      design.back(ctx, S, t);
      drawClouds(ctx, S, t, CLOUDS_BACK, 1);
      const A = t === null ? 1 : easeOut(t / 0.9);
      ctx.save();
      ctx.globalAlpha = A;
      ctx.translate(0, (1 - A) * 80);
      design.face(ctx, S, t);
      ctx.save();
      rr(ctx, L.r.x, L.r.y, L.r.w, L.r.h, 40);
      ctx.clip();
      drawClouds(ctx, S, t, CLOUDS_FRONT, P.cloudMid / Math.max(0.01, P.cloudA * 0.55));
      ctx.restore();
      drawContent(ctx, S, t);
      ctx.restore();
      if (t !== null && t > END_START) drawEnd(ctx, S, t);
      ctx.restore();
    };
    return S;
  }

  /* ---------- tiny H.264 MP4 muxer (for the WebCodecs export path) ---------- */
  function mp4Box(type, ...parts) {
    const size = 8 + parts.reduce((a, p) => a + p.byteLength, 0);
    const out = new Uint8Array(size);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, size);
    for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i);
    let o = 8;
    parts.forEach((p) => { out.set(p, o); o += p.byteLength; });
    return out;
  }
  function mp4Bytes(len, fill) {
    const a = new Uint8Array(len);
    fill(new DataView(a.buffer), a);
    return a;
  }
  const MP4_MATRIX = [0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000];
  // samples: [{ data: Uint8Array (AVCC, length-prefixed), key: bool }], constant frame duration.
  function buildMp4({ width, height, timescale, frameDuration, description, samples }) {
    const n = samples.length;
    const total = n * frameDuration;
    const mvhd = mp4Box("mvhd", mp4Bytes(100, (d) => {
      d.setUint32(12, timescale); d.setUint32(16, total); d.setUint32(20, 0x00010000); d.setUint16(24, 0x0100);
      MP4_MATRIX.forEach((v, i) => d.setUint32(36 + i * 4, v));
      d.setUint32(96, 2);
    }));
    const tkhd = mp4Box("tkhd", mp4Bytes(84, (d) => {
      d.setUint32(0, 3); d.setUint32(12, 1); d.setUint32(20, total);
      MP4_MATRIX.forEach((v, i) => d.setUint32(40 + i * 4, v));
      d.setUint32(76, width << 16); d.setUint32(80, height << 16);
    }));
    const mdhd = mp4Box("mdhd", mp4Bytes(24, (d) => {
      d.setUint32(12, timescale); d.setUint32(16, total); d.setUint16(20, 0x55c4);
    }));
    const name = new TextEncoder().encode("ConfessMo\0");
    const hdlr = mp4Box("hdlr", mp4Bytes(20 + name.length, (d, a) => {
      "vide".split("").forEach((c, i) => { a[8 + i] = c.charCodeAt(0); });
      a.set(name, 20);
    }));
    const vmhd = mp4Box("vmhd", mp4Bytes(12, (d) => d.setUint32(0, 1)));
    const dref = mp4Box("dref", mp4Bytes(8, (d) => d.setUint32(4, 1)), mp4Box("url ", mp4Bytes(4, (d) => d.setUint32(0, 1))));
    const dinf = mp4Box("dinf", dref);
    const avcC = mp4Box("avcC", description);
    const avc1 = mp4Box("avc1", mp4Bytes(78, (d, a) => {
      d.setUint16(6, 1); d.setUint16(24, width); d.setUint16(26, height);
      d.setUint32(28, 0x00480000); d.setUint32(32, 0x00480000); d.setUint16(40, 1);
      d.setUint16(74, 0x0018); d.setUint16(76, 0xffff);
    }), avcC);
    const stsd = mp4Box("stsd", mp4Bytes(8, (d) => d.setUint32(4, 1)), avc1);
    const stts = mp4Box("stts", mp4Bytes(16, (d) => { d.setUint32(4, 1); d.setUint32(8, n); d.setUint32(12, frameDuration); }));
    const keys = samples.map((s, i) => (s.key ? i + 1 : 0)).filter(Boolean);
    const stss = mp4Box("stss", mp4Bytes(8 + keys.length * 4, (d) => {
      d.setUint32(4, keys.length); keys.forEach((k, i) => d.setUint32(8 + i * 4, k));
    }));
    const stsc = mp4Box("stsc", mp4Bytes(20, (d) => { d.setUint32(4, 1); d.setUint32(8, 1); d.setUint32(12, n); d.setUint32(16, 1); }));
    const stsz = mp4Box("stsz", mp4Bytes(12 + n * 4, (d) => {
      d.setUint32(8, n); samples.forEach((s, i) => d.setUint32(12 + i * 4, s.data.byteLength));
    }));
    const stcoFor = (offset) => mp4Box("stco", mp4Bytes(12, (d) => { d.setUint32(4, 1); d.setUint32(8, offset); }));
    const ftyp = mp4Box("ftyp", new TextEncoder().encode("isom"), mp4Bytes(4, (d) => d.setUint32(0, 512)), new TextEncoder().encode("isomiso2avc1mp41"));
    const moovFor = (offset) => mp4Box("moov", mvhd, mp4Box("trak", tkhd, mp4Box("mdia", mdhd, hdlr, mp4Box("minf", vmhd, dinf, mp4Box("stbl", stsd, stts, stss, stsc, stsz, stcoFor(offset)))))) ;
    const moovSize = moovFor(0).byteLength;
    const moov = moovFor(ftyp.byteLength + moovSize + 8);
    const dataSize = samples.reduce((a, s) => a + s.data.byteLength, 0);
    const mdatHead = mp4Bytes(8, (d, a) => { d.setUint32(0, 8 + dataSize); "mdat".split("").forEach((c, i) => { a[4 + i] = c.charCodeAt(0); }); });
    return new Blob([ftyp, moov, mdatHead, ...samples.map((s) => s.data)], { type: "video/mp4" });
  }

  /* ---------- assets + fonts ---------- */
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error("image"));
      im.src = src;
    });
  }
  async function ensureFonts() {
    if (!document.fonts || !document.fonts.load) return;
    const specs = [
      `500 40px "Cormorant Garamond"`, `600 40px "Cormorant Garamond"`,
      `italic 500 40px "Cormorant Garamond"`, `italic 600 40px "Cormorant Garamond"`,
      `400 20px Poppins`, `500 20px Poppins`, `600 20px Poppins`,
    ];
    try {
      await Promise.all(specs.map((s) => document.fonts.load(s, "Aa—…“")));
      await document.fonts.ready;
    } catch (e) { /* fall back to system serif */ }
  }
  async function loadAssets(note) {
    const img = {};
    const key = deps.characterFor(note);
    const ch = deps.characters[key];
    if (ch) {
      try {
        img.char = await loadImage(ch.src);
        img.charCrop = ch.crop;
      } catch (e) { /* sticker is optional */ }
    }
    if (note.hasPhoto && deps.getPhoto) {
      try {
        const blob = await deps.getPhoto(note.id);
        if (blob) img.photo = await deps.loadBlobImage(blob);
      } catch (e) { /* photo is optional */ }
    }
    return img;
  }
  function defaultsFor(note) {
    const design = DESIGNS[note.design] ? note.design : "classic";
    const theme = Object.hasOwn(deps.themes, note.theme) ? note.theme : deps.defaultThemeByMood[note.mood] || "cream";
    return { design, theme };
  }

  /* ---------- exports ---------- */
  function toBlob(canvas, type, q) {
    return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("blob"))), type, q));
  }
  async function renderStill(note, img, shape, design, theme, format) {
    await ensureFonts();
    const S = buildScene(note, shape, design, theme, img);
    const c = mkCanvas(S.W, S.H);
    const ctx = c.getContext("2d", { alpha: false });
    S.draw(ctx, null);
    return toBlob(c, format === "jpg" ? "image/jpeg" : "image/png", 0.95);
  }
  function pickMime() {
    if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return "";
    const ok = (m) => MediaRecorder.isTypeSupported(m);
    const avc = ["video/mp4;codecs=avc1.640028", "video/mp4;codecs=avc1.4D0028", "video/mp4;codecs=avc1.42E028", "video/mp4;codecs=avc1.42E01E", "video/mp4;codecs=avc1"];
    const h264 = avc.find(ok);
    if (h264) return h264;
    // Safari records H.264 for plain video/mp4; Chromium-based browsers may wrap VP9 instead, so skip it there.
    const safari = /safari/i.test(navigator.userAgent) && !/chrome|chromium|crios|android|edg/i.test(navigator.userAgent);
    if (safari && ok("video/mp4")) return "video/mp4";
    return ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find(ok) || "";
  }
  // Preferred path: WebCodecs renders every frame deterministically (exact 30fps, 7.5s) and writes a real H.264 MP4.
  async function encodeMp4(S, hooks) {
    if (!window.VideoEncoder || !window.VideoFrame) return null;
    let cfg = null;
    for (const codec of ["avc1.640028", "avc1.4D0028", "avc1.42E028"]) {
      const c = { codec, width: S.W, height: S.H, bitrate: 9_000_000, framerate: FPS, avc: { format: "avc" }, latencyMode: "quality" };
      try {
        if ((await VideoEncoder.isConfigSupported(c)).supported) { cfg = c; break; }
      } catch (e) { /* try next */ }
    }
    if (!cfg) return null;
    const canvas = mkCanvas(S.W, S.H);
    const ctx = canvas.getContext("2d", { alpha: false });
    const samples = [];
    let description = null;
    let failure = null;
    const encoder = new VideoEncoder({
      output: (chunk, meta) => {
        const d = meta && meta.decoderConfig && meta.decoderConfig.description;
        if (d && !description) description = new Uint8Array(ArrayBuffer.isView(d) ? d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength) : d.slice(0));
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        samples.push({ data, key: chunk.type === "key" });
      },
      error: (e) => { failure = e; },
    });
    encoder.configure(cfg);
    const total = Math.round(DURATION * FPS);
    const yieldNow = () => new Promise((res) => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
    for (let f = 0; f < total; f += 1) {
      if (hooks.aborted()) { try { encoder.close(); } catch (e) { /* closed */ } return { aborted: true }; }
      if (failure) throw failure;
      S.draw(ctx, Math.min(DURATION, f / FPS));
      const frame = new VideoFrame(canvas, { timestamp: Math.round((f * 1e6) / FPS), duration: Math.round(1e6 / FPS) });
      encoder.encode(frame, { keyFrame: f % FPS === 0 });
      frame.close();
      while (encoder.encodeQueueSize > 6 && !failure) await yieldNow();
      if (f % 3 === 0) { hooks.progress((f + 1) / total, false); await yieldNow(); }
    }
    await encoder.flush();
    encoder.close();
    if (failure || !description || samples.length !== total) throw failure || new Error("encode");
    const blob = buildMp4({ width: S.W, height: S.H, timescale: FPS * 1000, frameDuration: 1000, description, samples });
    return { blob, type: "video/mp4", hidden: false };
  }
  async function recordVideo(S, hooks) {
    if (!HTMLCanvasElement.prototype.captureStream || typeof MediaRecorder === "undefined")
      throw new Error("unsupported");
    const canvas = mkCanvas(S.W, S.H);
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText = "position:fixed;right:0;bottom:0;width:2px;height:2px;opacity:.01;pointer-events:none";
    document.body.append(canvas);
    const ctx = canvas.getContext("2d", { alpha: false });
    S.draw(ctx, 0);
    const stream = canvas.captureStream(FPS);
    const mime = pickMime();
    let rec;
    try {
      rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 10_000_000 } : { videoBitsPerSecond: 10_000_000 });
    } catch (e) {
      rec = new MediaRecorder(stream);
    }
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise((res, rej) => {
      rec.onstop = res;
      rec.onerror = (e) => rej(e.error || new Error("record"));
    });
    let hidden = false;
    const onVis = () => { if (document.hidden) hidden = true; };
    document.addEventListener("visibilitychange", onVis);
    rec.start(250);
    const t0 = performance.now();
    let lastFrame = -1;
    await new Promise((resolve) => {
      const step = (now) => {
        if (hooks.aborted()) return resolve();
        const t = Math.min(DURATION, (now - t0) / 1000);
        const f = Math.floor(t * FPS);
        if (f !== lastFrame) {
          lastFrame = f;
          S.draw(ctx, t);
          hooks.progress(t / DURATION, true);
        }
        if (t < DURATION) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
    S.draw(ctx, DURATION);
    await sleep(400); // let the encoder flush the closing frame
    try { rec.requestData(); } catch (e) { /* ignore */ }
    if (rec.state !== "inactive") rec.stop();
    await stopped;
    stream.getTracks().forEach((tr) => tr.stop());
    document.removeEventListener("visibilitychange", onVis);
    canvas.remove();
    if (hooks.aborted()) return null;
    const type = (rec.mimeType || mime || "video/webm").split(";")[0];
    return { blob: new Blob(chunks, { type }), type, hidden };
  }
  function saveBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  async function shareBlob(blob, name) {
    const file = new File([blob], name, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "ConfessMo." });
      } catch (e) {
        if (e && e.name !== "AbortError") throw e;
      }
      return true;
    }
    return false;
  }

  /* ---------- Story Studio dialog ---------- */
  const U = { ready: false, open: false, note: null, img: {}, shape: "story", design: "classic", theme: "cream",
    t: 0, playing: true, scrubbing: false, scene: null, dirty: true, raf: 0, last: 0, busy: false, abort: false, result: null, thumbTimer: 0 };
  const $s = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const reduceMotion = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function rebuildScene() {
    U.scene = buildScene(U.note, U.shape, U.design, U.theme, U.img);
    const c = U.canvas;
    const w = 540, h = Math.round((540 * U.scene.H) / U.scene.W);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    c.style.aspectRatio = `${U.scene.W} / ${U.scene.H}`;
    U.dirty = true;
  }
  function paint() {
    if (!U.scene) return;
    const k = U.canvas.width / U.scene.W;
    U.ctx.setTransform(k, 0, 0, k, 0, 0);
    U.scene.draw(U.ctx, U.shape === "story" ? Math.min(U.t, DURATION) : null);
    U.ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (U.shape === "story") {
      U.scrub.value = String(Math.round((Math.min(U.t, DURATION) / DURATION) * 1000));
      U.time.textContent = `${Math.min(U.t, DURATION).toFixed(1)}s / ${DURATION.toFixed(1)}s`;
    }
  }
  function loop(now) {
    if (!U.open) return;
    const dt = Math.min(0.1, (now - U.last) / 1000);
    U.last = now;
    if (U.shape === "story" && U.playing && !U.scrubbing && !U.busy) {
      U.t += dt;
      if (U.t > DURATION + 0.9) U.t = 0;
      U.dirty = true;
    }
    if (U.dirty) { paint(); U.dirty = false; }
    U.raf = requestAnimationFrame(loop);
  }
  function setPlaying(on) {
    U.playing = on;
    U.playBtn.setAttribute("aria-label", on ? "Pause preview" : "Play preview");
    U.playBtn.dataset.state = on ? "pause" : "play";
  }
  function refreshThumbs() {
    clearTimeout(U.thumbTimer);
    U.thumbTimer = setTimeout(() => {
      DESIGN_ORDER.forEach((id) => {
        const cv = U.thumbs[id];
        if (!cv) return;
        const S = buildScene(U.note, U.shape, id, U.theme, U.img);
        cv.width = 96;
        cv.height = Math.round((96 * S.H) / S.W);
        const g = cv.getContext("2d");
        const k = cv.width / S.W;
        g.setTransform(k, 0, 0, k, 0, 0);
        S.draw(g, null);
      });
    }, 60);
  }
  function syncUi() {
    U.tabs.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.shape === U.shape)));
    DESIGN_ORDER.forEach((id) => U.chips[id].setAttribute("aria-pressed", String(id === U.design)));
    Object.entries(U.swatches).forEach(([id, b]) => b.setAttribute("aria-pressed", String(id === U.theme)));
    U.transport.hidden = U.shape !== "story";
    U.videoBlock.hidden = U.shape !== "story";
    U.help.textContent = U.shape === "story"
      ? "Story layout keeps text inside the safe zone so Instagram & Facebook buttons won’t cover it."
      : "4:5 post — the best size for the Instagram & Facebook feed.";
  }
  function clearResult() {
    U.result = null;
    U.ready.hidden = true;
  }
  function setBusy(on, label) {
    U.busy = on;
    U.videoBtn.disabled = on;
    U.png.disabled = on;
    U.jpg.disabled = on;
    U.videoBtn.querySelector("span").textContent = label || "Animated Story · 7.5s";
    U.progress.hidden = !on;
    U.cancel.hidden = !on;
  }
  function filename(ext) {
    return `confessmo-${U.shape}-${String(U.note.id || "preview").replace(/[^a-z0-9]/gi, "").slice(-6) || "card"}.${ext}`;
  }
  async function exportStill(format) {
    try {
      setBusy(true, "Preparing…");
      const blob = await renderStill(U.note, U.img, U.shape, U.design, U.theme, format);
      saveBlob(blob, filename(format));
      deps.toast(`Saved ${U.shape === "story" ? "Story" : "post"} ${format.toUpperCase()}.`);
    } catch (e) {
      deps.toast("Couldn’t create the image. Try again.", true);
    } finally {
      setBusy(false);
    }
  }
  async function exportVideo() {
    U.abort = false;
    clearResult();
    const wasPlaying = U.playing;
    try {
      await ensureFonts();
      const S = buildScene(U.note, "story", U.design, U.theme, U.img);
      setBusy(true, "Recording…");
      U.bar.style.width = "0%";
      const hooks = {
        aborted: () => U.abort || !U.open,
        progress: (p, realtime) => {
          U.bar.style.width = `${Math.round(p * 100)}%`;
          U.progressText.textContent = realtime
            ? `Recording ${Math.round(p * DURATION * 10) / 10}s of ${DURATION}s — keep this tab open`
            : `Rendering your Story… ${Math.round(p * 100)}%`;
          U.t = p * DURATION;
          U.dirty = true;
        },
      };
      let out = null;
      try {
        out = await encodeMp4(S, hooks);
        if (out && out.aborted) return;
      } catch (e) {
        out = null; // fall back to the browser's recorder
      }
      if (!out) out = await recordVideo(S, hooks);
      if (!out) return;
      const ext = out.type.includes("mp4") ? "mp4" : "webm";
      U.result = { blob: out.blob, name: filename(ext), ext };
      U.readyText.textContent = out.hidden
        ? "Ready, but the tab was in the background, so it may stutter. Re-record while keeping this tab open."
        : ext === "mp4"
          ? "Your animated Story is ready — MP4, 1080×1920, 30fps."
          : "Ready as WebM. If Instagram/Facebook rejects it, convert to MP4 first (e.g. CloudConvert).";
      U.shareBtn.hidden = !(navigator.canShare && navigator.canShare({ files: [new File([out.blob], U.result.name, { type: out.blob.type })] }));
      U.ready.hidden = false;
    } catch (e) {
      deps.toast(e && e.message === "unsupported"
        ? "This browser can’t record video. Try Chrome, Edge or Safari — or save the Story as PNG."
        : "Couldn’t record the video. Try again.", true);
    } finally {
      setBusy(false);
      setPlaying(wasPlaying);
      U.t = 0;
      U.dirty = true;
    }
  }
  function buildUi() {
    U.dlg = $s("studioDialog");
    U.canvas = $s("studioCanvas");
    U.ctx = U.canvas.getContext("2d");
    U.playBtn = $s("studioPlay");
    U.scrub = $s("studioScrub");
    U.time = $s("studioTime");
    U.transport = $s("studioTransport");
    U.videoBlock = $s("studioVideoBlock");
    U.videoBtn = $s("studioVideo");
    U.png = $s("studioPng");
    U.jpg = $s("studioJpg");
    U.progress = $s("studioProgress");
    U.bar = $s("studioBar");
    U.progressText = $s("studioProgressText");
    U.cancel = $s("studioCancel");
    U.ready = $s("studioReady");
    U.readyText = $s("studioReadyText");
    U.saveBtn = $s("studioSave");
    U.shareBtn = $s("studioShare");
    U.help = $s("studioHelp");
    U.tabs = [...U.dlg.querySelectorAll("[data-shape]")];
    U.tabs.forEach((b) => b.addEventListener("click", () => {
      if (U.busy) return;
      U.shape = b.dataset.shape;
      U.t = 0;
      clearResult();
      rebuildScene();
      syncUi();
      refreshThumbs();
    }));
    U.chips = {};
    U.thumbs = {};
    const grid = $s("studioDesigns");
    DESIGN_ORDER.forEach((id) => {
      const b = el("button", "sx-chip");
      b.type = "button";
      b.setAttribute("aria-label", `${DESIGNS[id].name} design`);
      const cv = document.createElement("canvas");
      cv.className = "sx-thumb";
      cv.setAttribute("aria-hidden", "true");
      b.append(cv, el("b", "", DESIGNS[id].name), el("small", "", DESIGNS[id].hint));
      b.addEventListener("click", () => {
        if (U.busy) return;
        U.design = id;
        clearResult();
        rebuildScene();
        syncUi();
      });
      grid.append(b);
      U.chips[id] = b;
      U.thumbs[id] = cv;
    });
    U.swatches = {};
    const row = $s("studioThemes");
    Object.entries(deps.themes).forEach(([id, th]) => {
      const b = el("button", "sx-swatch");
      b.type = "button";
      b.title = th.label;
      b.setAttribute("aria-label", `${th.label} color`);
      b.style.setProperty("--swatch", th.soft);
      b.style.setProperty("--swatch-ring", th.accent);
      b.addEventListener("click", () => {
        if (U.busy) return;
        U.theme = id;
        clearResult();
        rebuildScene();
        syncUi();
        refreshThumbs();
      });
      row.append(b);
      U.swatches[id] = b;
    });
    U.playBtn.addEventListener("click", () => {
      if (U.t >= DURATION) U.t = 0;
      setPlaying(!U.playing);
    });
    U.scrub.addEventListener("input", () => {
      U.scrubbing = true;
      U.t = (Number(U.scrub.value) / 1000) * DURATION;
      U.dirty = true;
    });
    U.scrub.addEventListener("change", () => { U.scrubbing = false; });
    U.videoBtn.addEventListener("click", exportVideo);
    U.png.addEventListener("click", () => exportStill("png"));
    U.jpg.addEventListener("click", () => exportStill("jpg"));
    U.cancel.addEventListener("click", () => { U.abort = true; });
    U.saveBtn.addEventListener("click", () => U.result && saveBlob(U.result.blob, U.result.name));
    U.shareBtn.addEventListener("click", async () => {
      if (!U.result) return;
      try { await shareBlob(U.result.blob, U.result.name); }
      catch (e) { deps.toast("Sharing isn’t available here. Use Save instead.", true); }
    });
    $s("studioClose").addEventListener("click", closeStudio);
    U.dlg.addEventListener("close", teardown);
    U.dlg.addEventListener("cancel", teardown);
    U.ready = $s("studioReady");
    U.built = true;
  }
  function teardown() {
    U.open = false;
    U.abort = true;
    cancelAnimationFrame(U.raf);
    U.img = {};
    U.scene = null;
  }
  function closeStudio() {
    deps.closeDialog("studioDialog");
    teardown();
  }
  async function openStudio(note) {
    if (!U.built) buildUi();
    U.note = note;
    const d = defaultsFor(note);
    U.design = d.design;
    U.theme = d.theme;
    U.shape = "story";
    U.t = 0;
    U.abort = false;
    U.busy = false;
    setBusy(false);
    clearResult();
    setPlaying(!reduceMotion());
    deps.openDialog("studioDialog");
    U.open = true;
    await ensureFonts();
    U.img = await loadAssets(note);
    if (!U.open) return;
    rebuildScene();
    syncUi();
    refreshThumbs();
    if (reduceMotion()) U.t = DURATION - 0.01;
    U.last = performance.now();
    cancelAnimationFrame(U.raf);
    U.raf = requestAnimationFrame(loop);
  }

  window.ConfessMoStudio = {
    init(d) { deps = d; },
    open: openStudio,
    designs: DESIGNS,
    order: DESIGN_ORDER,
    duration: DURATION,
    // test hooks (also useful for tooling)
    _buildScene: buildScene,
    _ensureFonts: ensureFonts,
    _loadAssets: loadAssets,
  };
})();
