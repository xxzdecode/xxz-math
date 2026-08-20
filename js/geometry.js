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
  const x2 = 90 + width * scale;
  const y2 = 55 + height * scale;
  [['#rectVertexA', 70, 48], ['#rectVertexB', x2 + 12, 48], ['#rectVertexC', x2 + 12, y2 + 22], ['#rectVertexD', 70, y2 + 22]].forEach(([selector, x, y]) => {
    q(selector).setAttribute('x', x); q(selector).setAttribute('y', y);
  });
  q('#rectWidthLabel').setAttribute('x', (90 + x2) / 2);
  q('#rectWidthLabel').setAttribute('y', y2 + 28);
  q('#rectHeightLabel').setAttribute('x', 65);
  q('#rectHeightLabel').setAttribute('y', (55 + y2) / 2);
  setText('#rectFormula', `面积 = 长 × 宽 = ${width} × ${height} = ${fmt(metrics.area)}；周长 = 2 ×（长 + 宽）= 2 ×（${width} + ${height}）= ${fmt(metrics.perimeter)}`);
  setText('#rectValues', `长 ${width} · 宽 ${height}`);
}

function renderTriangle() {
  const base = number('#triBase');
  const height = number('#triHeight');
  const half = base * 22 / 2;
  const y = 300 - height * 22;
  q('#triShape').setAttribute('points', `${300-half},300 ${300+half},300 300,${y}`);
  q('#triHeightLine').setAttribute('y2', y);
  q('#triVertexA').setAttribute('x', 300); q('#triVertexA').setAttribute('y', y - 14);
  q('#triVertexB').setAttribute('x', 300 - half - 24); q('#triVertexB').setAttribute('y', 322);
  q('#triVertexC').setAttribute('x', 300 + half + 10); q('#triVertexC').setAttribute('y', 322);
  q('#triBaseLabel').setAttribute('x', 300); q('#triBaseLabel').setAttribute('y', 342);
  q('#triHeightLabel').setAttribute('x', 312); q('#triHeightLabel').setAttribute('y', (300 + y) / 2);
  setText('#triFormula', `面积 = 底 × 高 ÷ 2 = ${base} × ${height} ÷ 2 = ${fmt(triangleMetrics(base, height).area)}`);
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
  q('#circleRadiusLabel').setAttribute('x', 300 + r / 2); q('#circleRadiusLabel').setAttribute('y', 170);
  q('#circleArcLabel').setAttribute('x', 300 + r * .75); q('#circleArcLabel').setAttribute('y', 180 - r * .55);
  setText('#circleFormula', `圆面积 = π × ${radius}² ≈ ${fmt(metrics.area)}；扇形面积 = ${angle} ÷ 360 × π × ${radius}² ≈ ${fmt(metrics.sectorArea)}；弧长 = ${angle} ÷ 360 × 2π × ${radius} ≈ ${fmt(metrics.arcLength)}`);
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
  q('#cylHeightGuide').setAttribute('y1', 95); q('#cylHeightGuide').setAttribute('y2', 95 + h);
  q('#coneRadiusGuide').setAttribute('x2', 430 + rx); q('#coneRadiusGuide').setAttribute('y1', 95 + h); q('#coneRadiusGuide').setAttribute('y2', 95 + h);
  q('#solidHeightLabel').setAttribute('x', 178); q('#solidHeightLabel').setAttribute('y', 100 + h / 2);
  q('#solidRadiusLabel').setAttribute('x', 430); q('#solidRadiusLabel').setAttribute('y', 132 + h);
  setText('#solidFormula', `圆柱体积 = π × ${radius}² × ${height} ≈ ${fmt(metrics.cylinderVolume)}；圆锥体积 = π × ${radius}² × ${height} ÷ 3 ≈ ${fmt(metrics.coneVolume)}`);
  setText('#solidValues', `半径 ${radius} · 高 ${height}`);
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
  const scale = 24;
  const yTop = 75;
  const yBottom = yTop + height * scale;
  const baseLeft = 160;
  const baseRight = baseLeft + base * scale;
  const shift = 65;
  const topWidth = (type === 'parallelogram' ? base : Math.min(top, base)) * scale;
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
  q('#quadHeightLabel').setAttribute('x', topLeft + 10); q('#quadHeightLabel').setAttribute('y', (yTop + yBottom) / 2);
  q('#quadTopControl').hidden = type === 'parallelogram';
  if (type === 'parallelogram') {
    const side = Math.hypot(shift / scale, height);
    const metrics = parallelogramMetrics(base, side, height);
    setText('#quadTopLabel', '对边平行且相等');
    setText('#quadValues', `底 ${base} · 高 ${height}`);
    setText('#quadFormula', `面积 = 底 × 高 = ${base} × ${height} = ${fmt(metrics.area)}；斜边 ≈ ${fmt(side)}，周长 = 2 ×（底 + 斜边）≈ ${fmt(metrics.perimeter)}`);
    setText('#quadHint', '高必须垂直于底；斜边不是高。平行四边形的两组对边分别平行。');
  } else {
    const metrics = trapezoidMetrics(top, base, height);
    setText('#quadTopLabel', `上底 ${top}`);
    setText('#quadValues', `上底 ${top} · 下底 ${base} · 高 ${height}`);
    setText('#quadFormula', `面积 =（上底 + 下底）× 高 ÷ 2 =（${top} + ${base}）× ${height} ÷ 2 = ${fmt(metrics.area)}`);
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
  setText('#polygonFormula', `周长 = ${sides} × ${sideLength} = ${fmt(metrics.perimeter)}；内角和 = ${metrics.interiorAngleSum}°`);
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
  setText('#cuboidValues', `长 ${length} · 宽 ${width} · 高 ${height}`);
  setText('#cuboidFormula', `体积 = 长 × 宽 × 高 = ${length} × ${width} × ${height} = ${fmt(metrics.volume)}；表面积 = 2 ×（长×宽 + 长×高 + 宽×高）= ${fmt(metrics.surfaceArea)}`);
}

function bindNumberPair(rangeSelector, numberSelector, render) {
  const range = q(rangeSelector);
  const input = q(numberSelector);
  if (!range || !input) return;
  range.addEventListener('input', () => { input.value = range.value; render(); });
  input.addEventListener('input', () => {
    if (input.value === '') return;
    const min = Number(range.min), max = Number(range.max);
    const value = Math.max(min, Math.min(max, Number(input.value)));
    range.value = String(value);
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
    q('#rectWidth').value = Math.max(2, Math.min(12, Math.round((local.x - 90) / 24)));
    q('#rectHeight').value = Math.max(2, Math.min(9, Math.round((local.y - 55) / 24)));
    q('#rectWidthNumber').value = q('#rectWidth').value;
    q('#rectHeightNumber').value = q('#rectHeight').value;
    renderRectangle();
  });
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
