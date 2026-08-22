import {
  angleKind,
  circleMetrics,
  cuboidMetrics,
  parallelogramMetrics,
  rectangleMetrics,
  regularPolygonMetrics,
  solidMetrics,
  trapezoidMetrics,
  translatePoint,
  triangleMetrics
} from './core.js';

const q = selector => document.querySelector(selector);
const number = selector => Number(q(selector)?.value || 0);
const fmt = value => Number(value).toFixed(2).replace(/\.00$/, '');
const GRID_UNIT = 20;
const SVG_NS = 'http://www.w3.org/2000/svg';

function setText(selector, value) {
  const target = q(selector);
  if (target) target.textContent = value;
}

function installUnitGrids() {
  document.querySelectorAll('.unit-grid-canvas, #chapter-cut .derive-step svg').forEach((svg, index) => {
    const viewBox = svg.viewBox.baseVal;
    const minorId = `unit-grid-minor-${index}`;
    const majorId = `unit-grid-major-${index}`;
    const defs = document.createElementNS(SVG_NS, 'defs');
    defs.innerHTML = `
      <pattern id="${minorId}" width="${GRID_UNIT}" height="${GRID_UNIT}" patternUnits="userSpaceOnUse">
        <path d="M ${GRID_UNIT} 0 L 0 0 0 ${GRID_UNIT}" class="svg-grid-minor"></path>
      </pattern>
      <pattern id="${majorId}" width="${GRID_UNIT * 5}" height="${GRID_UNIT * 5}" patternUnits="userSpaceOnUse">
        <rect width="${GRID_UNIT * 5}" height="${GRID_UNIT * 5}" fill="url(#${minorId})"></rect>
        <path d="M ${GRID_UNIT * 5} 0 L 0 0 0 ${GRID_UNIT * 5}" class="svg-grid-major"></path>
      </pattern>`;
    const background = document.createElementNS(SVG_NS, 'rect');
    background.setAttribute('x', viewBox.x);
    background.setAttribute('y', viewBox.y);
    background.setAttribute('width', viewBox.width);
    background.setAttribute('height', viewBox.height);
    background.setAttribute('fill', `url(#${majorId})`);
    background.setAttribute('class', 'svg-grid-background');
    background.setAttribute('aria-hidden', 'true');
    svg.insertBefore(defs, svg.firstChild);
    svg.insertBefore(background, defs.nextSibling);
  });
}

function renderRectangle() {
  const width = number('#rectWidth');
  const height = number('#rectHeight');
  const metrics = rectangleMetrics(width, height);
  const scale = GRID_UNIT;
  const originX = 100;
  const originY = 60;
  q('#rectShape').setAttribute('width', width * scale);
  q('#rectShape').setAttribute('height', height * scale);
  const x2 = originX + width * scale;
  const y2 = originY + height * scale;
  q('#rectHandle').setAttribute('cx', x2);
  q('#rectHandle').setAttribute('cy', y2);
  [['#rectVertexA', originX - 22, originY - 10], ['#rectVertexB', x2 + 10, originY - 10], ['#rectVertexC', x2 + 10, y2 + 22], ['#rectVertexD', originX - 22, y2 + 22]].forEach(([selector, x, y]) => {
    q(selector).setAttribute('x', x); q(selector).setAttribute('y', y);
  });
  q('#rectWidthLabel').setAttribute('x', (originX + x2) / 2);
  q('#rectWidthLabel').setAttribute('y', y2 + 28);
  q('#rectHeightLabel').setAttribute('x', originX - 36);
  q('#rectHeightLabel').setAttribute('y', (originY + y2) / 2);
  q('#rectRightAngle').setAttribute('d', `M ${originX} ${originY + GRID_UNIT} L ${originX + GRID_UNIT} ${originY + GRID_UNIT} L ${originX + GRID_UNIT} ${originY}`);
  setText('#rectWidthLabel', `长 a＝${width}`);
  setText('#rectHeightLabel', `宽 b＝${height}`);
  setText('#rectAreaFormula', `S＝a×b＝${width}×${height}＝${fmt(metrics.area)}`);
  setText('#rectPerimeterFormula', `C＝2（a＋b）＝2×（${width}＋${height}）＝${fmt(metrics.perimeter)}`);
  setText('#rectValues', `长 a＝${width} · 宽 b＝${height}`);
}

function renderTriangle() {
  const base = number('#triBase');
  const height = number('#triHeight');
  const baseLeft = 160;
  const baseRight = baseLeft + base * GRID_UNIT;
  const baseY = 300;
  const apexX = baseLeft + Math.floor(base / 2) * GRID_UNIT;
  const apexY = baseY - height * GRID_UNIT;
  q('#triShape').setAttribute('points', `${baseLeft},${baseY} ${baseRight},${baseY} ${apexX},${apexY}`);
  q('#triHeightLine').setAttribute('x1', apexX); q('#triHeightLine').setAttribute('x2', apexX);
  q('#triHeightLine').setAttribute('y1', baseY); q('#triHeightLine').setAttribute('y2', apexY);
  q('#triRightAngle').setAttribute('d', `M ${apexX} ${baseY - GRID_UNIT} L ${apexX + GRID_UNIT} ${baseY - GRID_UNIT} L ${apexX + GRID_UNIT} ${baseY}`);
  q('#triVertexA').setAttribute('x', apexX); q('#triVertexA').setAttribute('y', apexY - 14);
  q('#triVertexB').setAttribute('x', baseLeft - 24); q('#triVertexB').setAttribute('y', baseY + 22);
  q('#triVertexC').setAttribute('x', baseRight + 10); q('#triVertexC').setAttribute('y', baseY + 22);
  q('#triBaseLabel').setAttribute('x', (baseLeft + baseRight) / 2); q('#triBaseLabel').setAttribute('y', baseY + 42);
  q('#triHeightLabel').setAttribute('x', apexX + 30); q('#triHeightLabel').setAttribute('y', (baseY + apexY) / 2);
  setText('#triBaseLabel', `底 a＝${base}`);
  setText('#triHeightLabel', `高 h＝${height}`);
  setText('#triAreaFormula', `S＝a×h÷2＝${base}×${height}÷2＝${fmt(triangleMetrics(base, height).area)}`);
  setText('#triValues', `底 a＝${base} · 高 h＝${height}`);
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
  const r = radius * GRID_UNIT;
  const metrics = circleMetrics(radius, angle);
  q('#sectorShape').setAttribute('d', sectorPath(300, 180, r, angle));
  q('#circleHandle').setAttribute('cx', 300 + r);
  q('#circleRadiusLine').setAttribute('x2', 300 + r);
  q('#circleRadiusLabel').setAttribute('x', 300 + r / 2); q('#circleRadiusLabel').setAttribute('y', 158);
  q('#circleArcLabel').setAttribute('x', 300 + r * .82); q('#circleArcLabel').setAttribute('y', 168 - r * .62);
  setText('#circlePerimeterFormula', `C＝2πr＝2×π×${radius}≈${fmt(metrics.circumference)}`);
  setText('#circleAreaFormula', `S＝πr²＝π×${radius}²≈${fmt(metrics.area)}`);
  setText('#arcLengthFormula', `l＝n/360×2πr＝${angle}/360×2π×${radius}≈${fmt(metrics.arcLength)}`);
  setText('#sectorAreaFormula', `S扇＝n/360×πr²＝${angle}/360×π×${radius}²≈${fmt(metrics.sectorArea)}`);
  setText('#circleValues', `半径 r＝${radius} · 圆心角 n＝${angle}°`);
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
  q('#cylHeightGuide').setAttribute('y1', 95); q('#cylHeightGuide').setAttribute('y2', 95 + h);
  q('#coneRadiusGuide').setAttribute('x2', 430 + rx); q('#coneRadiusGuide').setAttribute('y1', 95 + h); q('#coneRadiusGuide').setAttribute('y2', 95 + h);
  q('#solidHeightLabel').setAttribute('x', 198); q('#solidHeightLabel').setAttribute('y', 100 + h / 2);
  q('#solidRadiusLabel').setAttribute('x', 430); q('#solidRadiusLabel').setAttribute('y', 132 + h);
  setText('#solidHeightLabel', `高 h＝${height}`);
  setText('#solidRadiusLabel', `底面半径 r＝${radius}`);
  setText('#cylinderVolumeFormula', `V柱＝πr²h＝π×${radius}²×${height}≈${fmt(metrics.cylinderVolume)}`);
  setText('#coneVolumeFormula', `V锥＝⅓πr²h＝⅓×π×${radius}²×${height}≈${fmt(metrics.coneVolume)}`);
  setText('#solidValues', `半径 r＝${radius} · 高 h＝${height}`);
}

function renderAngle() {
  const angle = number('#angleDegree');
  const radians = angle * Math.PI / 180;
  const ox = 300, oy = 250, length = 220, arcRadius = 82;
  const bx = ox + length * Math.cos(radians);
  const by = oy - length * Math.sin(radians);
  const ax = ox + length;
  ['#angleRayA', '#angleRayB'].forEach(selector => { q(selector).setAttribute('x1', ox); q(selector).setAttribute('y1', oy); });
  q('#angleRayA').setAttribute('x2', ax); q('#angleRayA').setAttribute('y2', oy);
  q('#angleRayB').setAttribute('x2', bx); q('#angleRayB').setAttribute('y2', by);
  q('#angleVertex').setAttribute('cx', ox); q('#angleVertex').setAttribute('cy', oy);
  q('#angleVertexLabel').setAttribute('x', ox - 52); q('#angleVertexLabel').setAttribute('y', oy + 28);
  q('#anglePointA').setAttribute('x', ax + 10); q('#anglePointA').setAttribute('y', oy + 6);
  q('#anglePointB').setAttribute('x', bx + 8); q('#anglePointB').setAttribute('y', by - 8);
  q('#angleRayALabel').setAttribute('x', ox + 85); q('#angleRayALabel').setAttribute('y', oy + 28);
  q('#angleRayBLabel').setAttribute('x', ox + 125 * Math.cos(radians) - 70 * Math.sin(radians));
  q('#angleRayBLabel').setAttribute('y', oy - 125 * Math.sin(radians) - 12);
  const arcEndX = ox + arcRadius * Math.cos(radians);
  const arcEndY = oy - arcRadius * Math.sin(radians);
  q('#angleArc').setAttribute('d', `M ${ox + arcRadius} ${oy} A ${arcRadius} ${arcRadius} 0 0 0 ${arcEndX} ${arcEndY}`);
  const labelRadians = radians / 2;
  q('#angleDegreeLabel').setAttribute('x', ox + 105 * Math.cos(labelRadians));
  q('#angleDegreeLabel').setAttribute('y', oy - 105 * Math.sin(labelRadians));
  setText('#angleDegreeLabel', `${angle}°`);
  setText('#angleValues', `${angle}° · ${angleKind(angle)}`);
  setText('#angleFormula', `∠AOB = ${angle}°，它是${angleKind(angle)}。`);
}

function renderQuadrilateral() {
  const type = q('#quadType').value;
  const top = number('#quadTop');
  const base = number('#quadBase');
  const height = number('#quadHeight');
  const scale = GRID_UNIT;
  const yTop = 60;
  const yBottom = yTop + height * scale;
  const baseLeft = 160;
  const baseRight = baseLeft + base * scale;
  const shift = 60;
  const topWidth = (type === 'parallelogram' ? base : top) * scale;
  const topLeft = baseLeft + shift;
  const topRight = topLeft + topWidth;
  q('#quadShape').setAttribute('points', `${topLeft},${yTop} ${topRight},${yTop} ${baseRight},${yBottom} ${baseLeft},${yBottom}`);
  q('#quadHeightLine').setAttribute('x1', topLeft); q('#quadHeightLine').setAttribute('x2', topLeft);
  q('#quadHeightLine').setAttribute('y1', yTop); q('#quadHeightLine').setAttribute('y2', yBottom);
  q('#quadRightAngle').setAttribute('d', `M ${topLeft} ${yBottom - 23} L ${topLeft + 23} ${yBottom - 23} L ${topLeft + 23} ${yBottom}`);
  [['#quadVertexA', topLeft - 20, yTop - 12], ['#quadVertexB', topRight + 8, yTop - 12], ['#quadVertexC', baseRight + 8, yBottom + 22], ['#quadVertexD', baseLeft - 24, yBottom + 22]].forEach(([selector, x, y]) => {
    q(selector).setAttribute('x', x); q(selector).setAttribute('y', y);
  });
  q('#quadTopLabel').setAttribute('x', (topLeft + topRight) / 2); q('#quadTopLabel').setAttribute('y', yTop - 18);
  q('#quadBottomLabel').setAttribute('x', (baseLeft + baseRight) / 2); q('#quadBottomLabel').setAttribute('y', yBottom + 30);
  q('#quadHeightLabel').setAttribute('x', topLeft + 30); q('#quadHeightLabel').setAttribute('y', (yTop + yBottom) / 2);
  q('#quadTopControl').hidden = type === 'parallelogram';
  setText('#quadHeightLabel', `高 h＝${height}`);
  if (type === 'parallelogram') {
    const side = Math.hypot(shift / scale, height);
    const metrics = parallelogramMetrics(base, side, height);
    setText('#quadTopLabel', `底 a＝${base}`);
    setText('#quadBottomLabel', `底 a＝${base}`);
    setText('#quadLeftSideLabel', `边 b≈${fmt(side)}`);
    setText('#quadRightSideLabel', '');
    setText('#quadBaseControlLabel', '底 a');
    q('#quadLeftSideLabel').setAttribute('x', baseLeft - 18); q('#quadLeftSideLabel').setAttribute('y', (yTop + yBottom) / 2);
    setText('#quadValues', `底 a＝${base} · 边 b≈${fmt(side)} · 高 h＝${height}`);
    setText('#quadAreaFormula', `S＝a×h＝${base}×${height}＝${fmt(metrics.area)}`);
    setText('#quadAreaNote', '割补成长方形：底 × 高');
    setText('#quadPerimeterFormula', `C＝2（a＋b）＝2×（${base}＋${fmt(side)}）≈${fmt(metrics.perimeter)}`);
    setText('#quadHint', '高必须垂直于底；斜边不是高。平行四边形的两组对边分别平行。');
  } else {
    const metrics = trapezoidMetrics(top, base, height);
    setText('#quadTopLabel', `上底 a＝${top}`);
    setText('#quadBottomLabel', `下底 b＝${base}`);
    setText('#quadBaseControlLabel', '下底 b');
    setText('#quadValues', `上底 a＝${top} · 下底 b＝${base} · 高 h＝${height}`);
    const leftSide = Math.hypot(shift / scale, height);
    const rightOffset = (base * scale - shift - top * scale) / scale;
    const rightSide = Math.hypot(rightOffset, height);
    setText('#quadLeftSideLabel', `腰 c≈${fmt(leftSide)}`);
    setText('#quadRightSideLabel', `腰 d≈${fmt(rightSide)}`);
    q('#quadLeftSideLabel').setAttribute('x', baseLeft - 18); q('#quadLeftSideLabel').setAttribute('y', (yTop + yBottom) / 2);
    q('#quadRightSideLabel').setAttribute('x', baseRight + 12); q('#quadRightSideLabel').setAttribute('y', (yTop + yBottom) / 2);
    setText('#quadAreaFormula', `S＝（a＋b）×h÷2＝（${top}＋${base}）×${height}÷2＝${fmt(metrics.area)}`);
    setText('#quadAreaNote', '两个相同梯形拼成平行四边形');
    setText('#quadPerimeterFormula', `C＝a＋b＋c＋d≈${top}＋${base}＋${fmt(leftSide)}＋${fmt(rightSide)}＝${fmt(top + base + leftSide + rightSide)}`);
    setText('#quadHint', '梯形只有一组对边平行；两条平行边叫上底和下底，它们之间的垂直距离叫高。');
  }
}

function renderPolygon() {
  const sides = Math.round(number('#polygonSides'));
  const sideLength = number('#polygonSideLength');
  const metrics = regularPolygonMetrics(sides, sideLength);
  const cx = 300, cy = 165, radius = 115;
  const points = Array.from({ length: sides }, (_, index) => {
    const angle = -Math.PI / 2 + index * 2 * Math.PI / sides;
    return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
  });
  q('#polygonShape').setAttribute('points', points.map(point => `${point.x},${point.y}`).join(' '));
  const labels = q('#polygonLabels');
  labels.replaceChildren();
  points.forEach((point, index) => {
    const angle = -Math.PI / 2 + index * 2 * Math.PI / sides;
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', String(cx + (radius + 22) * Math.cos(angle)));
    label.setAttribute('y', String(cy + (radius + 22) * Math.sin(angle) + 6));
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('class', 'diagram-label');
    label.textContent = String.fromCharCode(65 + index);
    labels.append(label);
  });
  const vertex = points[0], previous = points.at(-1), next = points[1];
  const inset = (point, distance = 38) => {
    const dx = point.x - vertex.x, dy = point.y - vertex.y, length = Math.hypot(dx, dy);
    return { x: vertex.x + dx / length * distance, y: vertex.y + dy / length * distance };
  };
  const start = inset(previous), end = inset(next);
  q('#polygonAngleArc').setAttribute('d', `M ${start.x} ${start.y} A 38 38 0 0 0 ${end.x} ${end.y}`);
  q('#polygonAngleLabel').setAttribute('x', cx + 48); q('#polygonAngleLabel').setAttribute('y', cy - radius + 54);
  setText('#polygonAngleLabel', `内角 ${fmt(metrics.interiorAngle)}°`);
  setText('#polygonValues', `${sides} 边 · 边长 ${sideLength}`);
  setText('#polygonPerimeterFormula', `C＝n×a＝${sides}×${sideLength}＝${fmt(metrics.perimeter)}`);
  setText('#polygonAngleFormula', `内角和＝（n－2）×180°＝（${sides}－2）×180°＝${metrics.interiorAngleSum}°；每个内角＝内角和÷n＝${metrics.interiorAngleSum}°÷${sides}＝${fmt(metrics.interiorAngle)}°`);
}

function renderCoordinateGrid() {
  const group = q('#coordinateGrid');
  group.replaceChildren();
  const createLine = (x1, y1, x2, y2) => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1); line.setAttribute('y1', y1); line.setAttribute('x2', x2); line.setAttribute('y2', y2);
    group.append(line);
  };
  for (let x = 60; x <= 540; x += 30) createLine(x, 30, x, 330);
  for (let y = 30; y <= 330; y += 25) createLine(60, y, 540, y);
}

function renderCoordinate() {
  const x = number('#pointX'), y = number('#pointY'), deltaX = number('#deltaX'), deltaY = number('#deltaY');
  const moved = translatePoint(x, y, deltaX, deltaY);
  const plot = point => ({ x: 300 + point.x * 30, y: 180 - point.y * 25 });
  const originalPixel = plot({ x, y });
  const movedPixel = plot(moved);
  q('#pointOriginal').setAttribute('cx', originalPixel.x); q('#pointOriginal').setAttribute('cy', originalPixel.y);
  q('#pointMoved').setAttribute('cx', movedPixel.x); q('#pointMoved').setAttribute('cy', movedPixel.y);
  q('#translationVector').setAttribute('x1', originalPixel.x); q('#translationVector').setAttribute('y1', originalPixel.y);
  q('#translationVector').setAttribute('x2', movedPixel.x); q('#translationVector').setAttribute('y2', movedPixel.y);
  q('#pointOriginalLabel').setAttribute('x', originalPixel.x + 12); q('#pointOriginalLabel').setAttribute('y', originalPixel.y - 12);
  q('#pointMovedLabel').setAttribute('x', movedPixel.x + 12); q('#pointMovedLabel').setAttribute('y', movedPixel.y - 12);
  q('#translationLabel').setAttribute('x', (originalPixel.x + movedPixel.x) / 2 + 8);
  q('#translationLabel').setAttribute('y', (originalPixel.y + movedPixel.y) / 2 - 8);
  setText('#pointOriginalLabel', `A(${x}, ${y})`);
  setText('#pointMovedLabel', `A′(${moved.x}, ${moved.y})`);
  setText('#translationLabel', `平移 (${deltaX}, ${deltaY})`);
  setText('#coordinateValues', `A(${x}, ${y}) → A′(${moved.x}, ${moved.y})`);
  const operation = (value, delta) => `${value} ${delta >= 0 ? '+' : '−'} ${Math.abs(delta)}`;
  setText('#coordinateFormula', `A′ = (${operation(x, deltaX)}, ${operation(y, deltaY)}) = (${moved.x}, ${moved.y})`);
}

function renderCuboid() {
  const length = number('#cuboidLength'), width = number('#cuboidWidth'), height = number('#cuboidHeight');
  const metrics = cuboidMetrics(length, width, height);
  const x = 115, y = 90, w = length * 30, h = height * 24, dx = width * 12, dy = -width * 7;
  const front = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  const back = front.map(([px, py]) => [px + dx, py + dy]);
  const path = points => `M ${points.map(point => point.join(' ')).join(' L ')} Z`;
  q('#cuboidFront').setAttribute('d', path(front));
  q('#cuboidBack').setAttribute('d', path(back));
  q('#cuboidEdges').setAttribute('d', front.map((point, index) => `M ${point.join(' ')} L ${back[index].join(' ')}`).join(' '));
  q('#cuboidLengthLabel').setAttribute('x', x + w / 2); q('#cuboidLengthLabel').setAttribute('y', y + h + 30);
  q('#cuboidWidthLabel').setAttribute('x', x + w + dx / 2 + 8); q('#cuboidWidthLabel').setAttribute('y', y + h + dy / 2 + 18);
  q('#cuboidHeightLabel').setAttribute('x', x - 28); q('#cuboidHeightLabel').setAttribute('y', y + h / 2);
  q('#cuboidVertexLabel').setAttribute('x', back[1][0] + 8); q('#cuboidVertexLabel').setAttribute('y', back[1][1] - 8);
  q('#cuboidEdgeLabel').setAttribute('x', x + w / 2); q('#cuboidEdgeLabel').setAttribute('y', y - 10);
  q('#cuboidFaceLabel').setAttribute('x', x + w / 2); q('#cuboidFaceLabel').setAttribute('y', y + h / 2);
  setText('#cuboidLengthLabel', `长 a＝${length}`);
  setText('#cuboidWidthLabel', `宽 b＝${width}`);
  setText('#cuboidHeightLabel', `高 h＝${height}`);
  setText('#cuboidValues', `长 a＝${length} · 宽 b＝${width} · 高 h＝${height}`);
  setText('#cuboidVolumeFormula', `V＝abh＝${length}×${width}×${height}＝${fmt(metrics.volume)}`);
  setText('#cuboidSurfaceFormula', `S＝2（ab＋ah＋bh）＝2×（${length}×${width}＋${length}×${height}＋${width}×${height}）＝${fmt(metrics.surfaceArea)}`);
}

function bindNumberPair(rangeSelector, numberSelector, render) {
  const range = q(rangeSelector);
  const input = q(numberSelector);
  if (!range || !input) return;
  range.addEventListener('input', () => { input.value = range.value; render(); });
  input.addEventListener('input', () => {
    if (input.value === '') return;
    const min = Number(range.min), max = Number(range.max);
    const step = Number(range.step) || 1;
    const raw = Math.max(min, Math.min(max, Number(input.value)));
    const value = min + Math.round((raw - min) / step) * step;
    range.value = String(value);
    input.value = String(value);
    render();
  });
  input.addEventListener('change', () => { input.value = range.value; });
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
    q('#rectWidth').value = Math.max(2, Math.min(12, Math.round((local.x - 100) / GRID_UNIT)));
    q('#rectHeight').value = Math.max(2, Math.min(9, Math.round((local.y - 60) / GRID_UNIT)));
    q('#rectWidthNumber').value = q('#rectWidth').value;
    q('#rectHeightNumber').value = q('#rectHeight').value;
    renderRectangle();
  });
}

function setPrinciplesVisible(visible) {
  document.querySelectorAll('[data-principle]').forEach(element => {
    element.hidden = !visible;
  });
  const showButton = q('#showPrinciples');
  const hideButton = q('#hidePrinciples');
  showButton?.setAttribute('aria-pressed', String(visible));
  hideButton?.setAttribute('aria-pressed', String(!visible));
}

[
  ['#rectWidth', '#rectWidthNumber', renderRectangle], ['#rectHeight', '#rectHeightNumber', renderRectangle],
  ['#triBase', '#triBaseNumber', renderTriangle], ['#triHeight', '#triHeightNumber', renderTriangle],
  ['#circleRadius', '#circleRadiusNumber', renderCircle], ['#sectorAngle', '#sectorAngleNumber', renderCircle],
  ['#solidRadius', '#solidRadiusNumber', renderSolid], ['#solidHeight', '#solidHeightNumber', renderSolid],
  ['#angleDegree', '#angleDegreeNumber', renderAngle], ['#quadTop', '#quadTopNumber', renderQuadrilateral],
  ['#quadBase', '#quadBaseNumber', renderQuadrilateral], ['#quadHeight', '#quadHeightNumber', renderQuadrilateral],
  ['#polygonSides', '#polygonSidesNumber', renderPolygon], ['#polygonSideLength', '#polygonSideLengthNumber', renderPolygon],
  ['#pointX', '#pointXNumber', renderCoordinate], ['#pointY', '#pointYNumber', renderCoordinate],
  ['#deltaX', '#deltaXNumber', renderCoordinate], ['#deltaY', '#deltaYNumber', renderCoordinate],
  ['#cuboidLength', '#cuboidLengthNumber', renderCuboid], ['#cuboidWidth', '#cuboidWidthNumber', renderCuboid],
  ['#cuboidHeight', '#cuboidHeightNumber', renderCuboid]
].forEach(args => bindNumberPair(...args));
q('#quadType')?.addEventListener('change', renderQuadrilateral);
q('#showPrinciples')?.addEventListener('click', () => setPrinciplesVisible(true));
q('#hidePrinciples')?.addEventListener('click', () => setPrinciplesVisible(false));
installUnitGrids();
setPrinciplesVisible(true);
bindRectangleDrag();
renderRectangle();
renderTriangle();
renderCircle();
renderSolid();
renderAngle();
renderQuadrilateral();
renderCoordinateGrid();
renderPolygon();
renderCoordinate();
renderCuboid();
