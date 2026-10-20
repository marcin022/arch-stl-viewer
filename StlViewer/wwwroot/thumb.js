// Render every STL triangle into a small image with a depth buffer.
function stlThumbnail(buffer) {
  const view = new DataView(buffer);
  const declared = buffer.byteLength >= 84 ? view.getUint32(80, true) : 0;
  const binary = declared > 0 && 84 + declared * 50 <= buffer.byteLength;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  let count = 0;
  let text, pattern;
  if (!binary) {
    text = new TextDecoder().decode(buffer);
    pattern = /\bvertex\s+([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s+([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s+([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)/gi;
  }
  function visit(accept) {
    if (binary) {
      const points = new Array(9);
      for (let i = 0; i < declared; i++) {
        const offset = 84 + i * 50 + 12;
        for (let j = 0; j < 9; j++) points[j] = view.getFloat32(offset + j * 4, true);
        accept(points, i);
      }
      return declared;
    }
    pattern.lastIndex = 0;
    let index = 0;
    while (true) {
      const a = pattern.exec(text);
      if (!a) break;
      const b = pattern.exec(text), c = pattern.exec(text);
      if (!b || !c) break;
      accept([...a.slice(1), ...b.slice(1), ...c.slice(1)].map(Number), index++);
    }
    return index;
  }
  count = visit(points => {
    for (let i = 0; i < 9; i++) {
      const value = points[i], axis = i % 3;
      if (!Number.isFinite(value)) throw Error(t('invalidStlCoordinates'));
      min[axis] = Math.min(min[axis], value);
      max[axis] = Math.max(max[axis], value);
    }
  });
  if (!count) throw Error(t('emptyStl'));

  const center = min.map((value, axis) => (value + max[axis]) / 2);
  const yaw = -.65, pitch = .5;
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  function rotate(x, y, z) {
    x -= center[0]; y -= center[1]; z -= center[2];
    const rx = cy * x + sy * z, rz = -sy * x + cy * z;
    return [rx, cp * y - sp * rz, sp * y + cp * rz];
  }
  const canvas = document.createElement('canvas');
  canvas.width = 240; canvas.height = 180;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw Error('Brak rysowania miniatur.');

  // The eight bounding-box corners include the whole model after rotation.
  let left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity;
  for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) {
    const p = rotate(x, y, z);
    left = Math.min(left, p[0]); right = Math.max(right, p[0]);
    bottom = Math.min(bottom, p[1]); top = Math.max(top, p[1]);
  }
  const scale = .82 * Math.min(canvas.width / (right - left || 1), canvas.height / (top - bottom || 1));
  const midX = (left + right) / 2, midY = (bottom + top) / 2;
  const width = canvas.width, height = canvas.height;
  const image = ctx.createImageData(width, height);
  const depth = new Float32Array(width * height);
  depth.fill(-Infinity);
  visit(points => {
    const vertices = [];
    for (let i = 0; i < 9; i += 3) {
      const p = rotate(points[i], points[i + 1], points[i + 2]);
      vertices.push([width / 2 + (p[0] - midX) * scale,
        height / 2 - (p[1] - midY) * scale, p[2], p[0], p[1]]);
    }
    const [a, b, c] = vertices;
    const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (Math.abs(area) < 1e-8) return;
    const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
    const x1 = Math.min(width - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
    const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
    const y1 = Math.min(height - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
    if (x0 > x1 || y0 > y1) return;

    const ux = b[3] - a[3], uy = b[4] - a[4], uz = b[2] - a[2];
    const vx = c[3] - a[3], vy = c[4] - a[4], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const normalLength = Math.hypot(nx, ny, nz) || 1;
    const light = Math.abs((nx * -.35 + ny * .7 + nz * .65) / (normalLength * 1.014));
    const shade = Math.min(1, Math.max(0, light));
    const red = Math.round(53 + shade * 70), green = Math.round(117 + shade * 94), blue = Math.round(73 + shade * 76);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + .5, py = y + .5;
      const wa = ((b[0] - px) * (c[1] - py) - (b[1] - py) * (c[0] - px)) / area;
      const wb = ((c[0] - px) * (a[1] - py) - (c[1] - py) * (a[0] - px)) / area;
      const wc = 1 - wa - wb;
      if (wa < -1e-6 || wb < -1e-6 || wc < -1e-6) continue;
      const offset = y * width + x;
      const z = wa * a[2] + wb * b[2] + wc * c[2];
      if (z <= depth[offset]) continue;
      depth[offset] = z;
      const color = offset * 4;
      image.data[color] = red; image.data[color + 1] = green;
      image.data[color + 2] = blue; image.data[color + 3] = 255;
    }
  });
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}
