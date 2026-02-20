// Spinning wheel — canvas renderer

const WHEEL_COLORS = [
  '#7c6af7','#f76a8a','#f7a76a','#6af7a7','#6ac8f7','#f7e76a',
  '#c76af7','#6af7d4','#f76a6a','#8af76a'
];

class SpinWheel {
  constructor(canvasIdOrEl, items = []) {
    this.canvas = typeof canvasIdOrEl === 'string'
      ? document.getElementById(canvasIdOrEl)
      : canvasIdOrEl;
    this.ctx    = this.canvas.getContext('2d');
    this.items  = items;
    this.angle  = 0;
    this.spinning = false;
    this._onDone  = null;
    this.draw();
  }

  // Accept either setItems or setSegments
  setItems(labels) {
    this.items = labels;
    this.draw();
  }
  setSegments(labels) { this.setItems(labels); }

  draw() {
    const { ctx, canvas, items, angle } = this;
    const cx = canvas.width  / 2;
    const cy = canvas.height / 2;
    const r  = cx - 10;
    const n  = items.length;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!n) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = '#1a1a24';
      ctx.fill();
      ctx.strokeStyle = '#2e2e42';
      ctx.lineWidth = 3;
      ctx.stroke();
      return;
    }

    const arc = (Math.PI * 2) / n;

    for (let i = 0; i < n; i++) {
      const start = angle + i * arc;
      const end   = start + arc;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, end);
      ctx.closePath();
      ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length];
      ctx.fill();
      ctx.strokeStyle = '#0f0f13';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(start + arc / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff';
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur  = 4;
      const fs = Math.min(15, Math.max(9, Math.floor(280 / n)));
      ctx.font = `bold ${fs}px -apple-system, sans-serif`;
      const label = items[i].length > 20 ? items[i].slice(0, 18) + '…' : items[i];
      ctx.fillText(label, r - 12, fs / 3);
      ctx.restore();
    }

    // Center cap
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fillStyle = '#0f0f13';
    ctx.fill();
    ctx.strokeStyle = 'rgba(124,106,247,0.7)';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  spin(onDone) {
    if (this.spinning || !this.items.length) return;
    this.spinning = true;
    this._onDone  = onDone;

    const totalRot  = Math.PI * 2 * (8 + Math.random() * 5);
    const duration  = 3800 + Math.random() * 1400;
    const start     = performance.now();
    const initAngle = this.angle;
    const ease      = t => 1 - Math.pow(1 - t, 4);

    const step = (now) => {
      const t = Math.min((now - start) / duration, 1);
      this.angle = initAngle + totalRot * ease(t);
      this.draw();
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        this.spinning = false;
        if (this._onDone) this._onDone(this._winner());
      }
    };
    requestAnimationFrame(step);
  }

  _winner() {
    const n   = this.items.length;
    if (!n) return null;
    const arc = (Math.PI * 2) / n;
    // Pointer at top = 12 o'clock. Wheel rotates clockwise.
    const norm = (((- this.angle) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    return this.items[Math.floor(norm / arc) % n];
  }
}
