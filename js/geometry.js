import { rectangleMetrics, triangleMetrics, circleMetrics, solidMetrics } from './core.js';

const q = selector => document.querySelector(selector);
const number = selector => Number(q(selector)?.value || 0);
const fmt = value => Number(value).toFixed(2).replace(/\.00$/, '');

function setText(selector, value) {
  const target = q(selector);
  if (target) target.textContent = value;
}

function renderRectangle() {
  const width = number('#rectWidth');
  const height = number('#rectHeight');
  const metrics = rectangleMetrics(width, height);
  const scale = 24;
  q('#rectShape').setAttribute('width', width * scale);
  q('#rectShape').setAttribute('height', height * scale);
  q('#rectHandle').setAttribute('cx', 90 + width * scale);
  q('#rectHandle').setAttribute('cy', 55 + height * scale);
  setText('#rectFormula', `面积 ${fmt(metrics.area)}，周长 ${fmt(metrics.perimeter)}`);
  setText('#rectValues', `长 ${width} · 宽 ${height}`);
}

function renderTriangle() {
  const base = number('#triBase');
  const height = number('#triHeight');
  const half = base * 22 / 2;
  const y = 300 - height * 22;
  q('#triShape').setAttribute('points', `${300-half},300 ${300+half},300 300,${y}`);
  q('#triHeightLine').setAttribute('y2', y);
  setText('#triFormula', `面积 ${fmt(triangleMetrics(base, height).area)}`);
  setText('#triValues', `底 ${base} · 高 ${height}`);
}

function sectorPath(cx, cy, r, angle) {
  if (angle >= 360) return `M ${cx-r} ${cy} a ${r} ${r} 0 1 0 ${2*r} 0 a ${r} ${r} 0 1 0 ${-2*r} 0`;
  const end = -Math.PI / 2 + angle * Math.PI / 180;
  const x1 = cx, y1 = cy - r;
  const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${angle > 180 ? 1 : 0} 1 ${x2} ${y2} Z`;
}

function renderCircle() {
  const radius = number('#circleRadius');
  const angle = number('#sectorAngle');
  const r = radius * 18;
  const metrics = circleMetrics(radius, angle);
  q('#sectorShape').setAttribute('d', sectorPath(300, 180, r, angle));
  q('#circleHandle').setAttribute('cx', 300 + r);
  q('#circleRadiusLine').setAttribute('x2', 300 + r);
  setText('#circleFormula', `圆面积 ${fmt(metrics.area)} · 扇形面积 ${fmt(metrics.sectorArea)} · 弧长 ${fmt(metrics.arcLength)}`);
  setText('#circleValues', `半径 ${radius} · 圆心角 ${angle}°`);
}

function renderSolid() {
  const radius = number('#solidRadius');
  const height = number('#solidHeight');
  const metrics = solidMetrics(radius, height);
  const rx = radius * 15;
  const h = height * 18;
  ['#cylTop', '#cylBottom'].forEach(selector => q(selector).setAttribute('rx', rx));
  q('#cylSide').setAttribute('x', 170-rx);
  q('#cylSide').setAttribute('width', rx*2);
  q('#cylSide').setAttribute('height', h);
  q('#cylBottom').setAttribute('cy', 95+h);
  q('#coneBase').setAttribute('rx', rx);
  q('#coneBase').setAttribute('cy', 95+h);
  q('#coneShape').setAttribute('points', `430,95 ${430-rx},${95+h} ${430+rx},${95+h}`);
  setText('#solidFormula', `圆柱体积 ${fmt(metrics.cylinderVolume)} · 圆锥体积 ${fmt(metrics.coneVolume)}（正好是 1/3）`);
  setText('#solidValues', `半径 ${radius} · 高 ${height}`);
}

function bindRange(selector, render) {
  q(selector)?.addEventListener('input', render);
}

function bindRectangleDrag() {
  const svg = q('#rectSvg');
  const handle = q('#rectHandle');
  let active = false;
  handle.addEventListener('pointerdown', event => { active = true; handle.setPointerCapture(event.pointerId); });
  handle.addEventListener('pointerup', () => { active = false; });
  handle.addEventListener('pointermove', event => {
    if (!active) return;
    const point = svg.createSVGPoint();
    point.x = event.clientX; point.y = event.clientY;
    const local = point.matrixTransform(svg.getScreenCTM().inverse());
    q('#rectWidth').value = Math.max(2, Math.min(12, Math.round((local.x - 90) / 24)));
    q('#rectHeight').value = Math.max(2, Math.min(9, Math.round((local.y - 55) / 24)));
    renderRectangle();
  });
}

bindRange('#rectWidth', renderRectangle);
bindRange('#rectHeight', renderRectangle);
bindRange('#triBase', renderTriangle);
bindRange('#triHeight', renderTriangle);
bindRange('#circleRadius', renderCircle);
bindRange('#sectorAngle', renderCircle);
bindRange('#solidRadius', renderSolid);
bindRange('#solidHeight', renderSolid);
bindRectangleDrag();
renderRectangle();
renderTriangle();
renderCircle();
renderSolid();
