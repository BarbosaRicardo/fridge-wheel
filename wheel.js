// ===== Spinning Wheel (Canvas) =====

const WHEEL_COLORS = [
  '#ff6b35', '#7c3aed', '#2563eb', '#059669',
  '#d97706', '#dc2626', '#0891b2', '#7c3aed',
  '#16a34a', '#b45309', '#4338ca', '#be185d',
];

class SpinWheel {
  constructor(canvasId, items = []) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.items = items;
    this.angle = 0;
    this.spinning = false;
    this.onDone = null;
    this._raf = null;
  }

  setItems(items) {
    this.items = items;
    this.angle = 0;
    this.draw();
  }

  draw(rotation = 0) {
    const { ctx, canvas, items } = this;
    const size = canvas.width;
    const cx = size / 2, cy = size / 2;
    const r = size / 2 - 6;
    const arc = (2 * Math.PI) / items.length;

    ctx.clearRect(0, 0, size, size);

    // Outer glow ring
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r + 4, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(255,107,53,0.3)';
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.restore();

    items.forEach((item, i) => {
      const start = rotation + i * arc;
      const end = start + arc;

      // Slice
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, end);
      ctx.closePath();
      ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length];
      ctx.fill();
      ctx.strokeStyle = '#0f0f13';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Text
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(start + arc / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = 'white';
      const fontSize = Math.max(11, Math.min(16, Math.floor(r * 0.12)));
      ctx.font = `bold ${fontSize}px 'Segoe UI', sans-serif`;
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 4;
      // Truncate long names
      const label = item.length > 18 ? item.slice(0, 17) + '…' : item;
      ctx.fillText(label, r - 14, fontSize / 3);
      ctx.restore();
    });

    // Center circle
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, 2 * Math.PI);
    ctx.fillStyle = '#0f0f13';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,107,53,0.5)';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  spin(onDone) {
    if (this.spinning || this.items.length === 0) return;
    this.spinning = true;
    this.onDone = onDone;

    const totalRotation = (2 * Math.PI * (5 + Math.random() * 5))
      + Math.random() * 2 * Math.PI;
    const duration = 4000 + Math.random() * 1500;
    const start = performance.now();
    const startAngle = this.angle;

    const easeOut = (t) => 1 - Math.pow(1 - t, 4);

    const tick = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      this.angle = startAngle + totalRotation * easeOut(progress);
      this.draw(this.angle);

      if (progress < 1) {
        this._raf = requestAnimationFrame(tick);
      } else {
        this.spinning = false;
        const arc = (2 * Math.PI) / this.items.length;
        // Pointer is at top (−π/2), find which slice is under it
        const normalized = ((-(this.angle % (2 * Math.PI))) + (2 * Math.PI)) % (2 * Math.PI);
        const index = Math.floor(normalized / arc) % this.items.length;
        if (this.onDone) this.onDone(this.items[index]);
      }
    };
    this._raf = requestAnimationFrame(tick);
  }
}
