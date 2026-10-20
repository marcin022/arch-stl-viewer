// STL pozostaje pełną siatką. Trójkąty są wysyłane do GPU porcjami,
// a bufor głębi rozstrzyga, która powierzchnia jest najbliżej kamery.
function parseStl(buffer, onChunk) {
  const view = new DataView(buffer);
  const binaryCount = buffer.byteLength >= 84 ? view.getUint32(80, true) : 0;
  const binary = binaryCount > 0 && 84 + binaryCount * 50 <= buffer.byteLength;
  const text = binary ? null : new TextDecoder().decode(buffer);
  const vertexPattern = /\bvertex\s+([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s+([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s+([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)/gi;

  function visitTriangles(visitor) {
    if (binary) {
      for (let i = 0; i < binaryCount; i++) {
        const base = 84 + i * 50 + 12;
        visitor(
          view.getFloat32(base, true), view.getFloat32(base + 4, true), view.getFloat32(base + 8, true),
          view.getFloat32(base + 12, true), view.getFloat32(base + 16, true), view.getFloat32(base + 20, true),
          view.getFloat32(base + 24, true), view.getFloat32(base + 28, true), view.getFloat32(base + 32, true)
        );
      }
      return binaryCount;
    }
    vertexPattern.lastIndex = 0;
    let count = 0;
    while (true) {
      const a = vertexPattern.exec(text);
      if (!a) break;
      const b = vertexPattern.exec(text), c = vertexPattern.exec(text);
      if (!b || !c) throw Error(t('incompleteTriangle'));
      visitor(+a[1], +a[2], +a[3], +b[1], +b[2], +b[3], +c[1], +c[2], +c[3]);
      count++;
    }
    return count;
  }

  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  const count = visitTriangles((...p) => {
    for (let i = 0; i < 9; i++) {
      const n = p[i], axis = i % 3;
      if (!Number.isFinite(n)) throw Error(t('invalidCoordinates'));
      min[axis] = Math.min(min[axis], n);
      max[axis] = Math.max(max[axis], n);
    }
  });
  if (!count) throw Error(t('noTriangles'));

  const trianglesPerChunk = 32768;
  let chunk = new Float32Array(trianglesPerChunk * 18), used = 0;
  function flush() {
    if (used) onChunk(chunk.subarray(0, used));
    chunk = new Float32Array(trianglesPerChunk * 18);
    used = 0;
  }
  visitTriangles((ax, ay, az, bx, by, bz, cx, cy, cz) => {
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz) || 1;
    nx /= length; ny /= length; nz /= length;
    for (const [x, y, z] of [[ax, ay, az], [bx, by, bz], [cx, cy, cz]]) {
      chunk[used++] = x; chunk[used++] = y; chunk[used++] = z;
      chunk[used++] = nx; chunk[used++] = ny; chunk[used++] = nz;
    }
    if (used === chunk.length) flush();
  });
  flush();
  return {
    count,
    size: min.map((n, i) => max[i] - n),
    center: min.map((n, i) => (n + max[i]) / 2),
    format: binary ? 'binaryStl' : 'asciiStl'
  };
}

class StlPreview {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl', { alpha: true, depth: true, antialias: true });
    this.buffers = [];
    if (!this.gl) return;
    const gl = this.gl;
    const vertexSource = [
      'attribute vec3 aPosition;',
      'attribute vec3 aNormal;',
      'uniform vec3 uCenter;',
      'uniform float uInvSize, uYaw, uPitch, uZoom, uAspect;',
      'varying vec3 vNormal;',
      'void main() {',
      '  vec3 p = (aPosition - uCenter) * uInvSize;',
      '  float cy = cos(uYaw), sy = sin(uYaw);',
      '  float cp = cos(uPitch), sp = sin(uPitch);',
      '  vec3 q = vec3(cy*p.x + sy*p.z, p.y, -sy*p.x + cy*p.z);',
      '  vec3 r = vec3(q.x, cp*q.y - sp*q.z, sp*q.y + cp*q.z);',
      '  vec3 n = vec3(cy*aNormal.x + sy*aNormal.z, aNormal.y, -sy*aNormal.x + cy*aNormal.z);',
      '  vNormal = vec3(n.x, cp*n.y - sp*n.z, sp*n.y + cp*n.z);',
      '  gl_Position = vec4(r.x * 1.5 * uZoom / uAspect, r.y * 1.5 * uZoom, -r.z * 0.95, 1.0);',
      '}'
    ].join('\n');
    const fragmentSource = [
      'precision mediump float;',
      'varying vec3 vNormal;',
      'void main() {',
      '  float light = abs(dot(normalize(vNormal), normalize(vec3(-0.35, 0.7, 0.65))));',
      '  vec3 color = mix(vec3(0.20, 0.36, 0.30), vec3(0.66, 0.89, 0.73), light);',
      '  gl_FragColor = vec4(color, 1.0);',
      '}'
    ].join('\n');
    function shader(type, source) {
      const item = gl.createShader(type);
      gl.shaderSource(item, source); gl.compileShader(item);
      if (!gl.getShaderParameter(item, gl.COMPILE_STATUS))
        throw Error(t('previewError') + ': ' + gl.getShaderInfoLog(item));
      return item;
    }
    const program = gl.createProgram();
    const vertex = shader(gl.VERTEX_SHADER, vertexSource), fragment = shader(gl.FRAGMENT_SHADER, fragmentSource);
    gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw Error(t('previewError') + ': ' + gl.getProgramInfoLog(program));
    gl.deleteShader(vertex); gl.deleteShader(fragment);
    this.program = program;
    this.locations = {
      position: gl.getAttribLocation(program, 'aPosition'),
      normal: gl.getAttribLocation(program, 'aNormal'),
      center: gl.getUniformLocation(program, 'uCenter'),
      invSize: gl.getUniformLocation(program, 'uInvSize'),
      yaw: gl.getUniformLocation(program, 'uYaw'),
      pitch: gl.getUniformLocation(program, 'uPitch'),
      zoom: gl.getUniformLocation(program, 'uZoom'),
      aspect: gl.getUniformLocation(program, 'uAspect')
    };
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
  }
  clear() {
    if (this.gl) for (const item of this.buffers) this.gl.deleteBuffer(item.buffer);
    this.buffers = [];
    this.mesh = null;
  }
  load(buffer) {
    if (!this.gl) throw Error(t('webglRequired'));
    this.clear();
    try {
      this.mesh = parseStl(buffer, data => {
        const gl = this.gl, gpuBuffer = gl.createBuffer();
        if (!gpuBuffer) throw Error(t('outOfMemory'));
        gl.bindBuffer(gl.ARRAY_BUFFER, gpuBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        if (gl.getError() !== gl.NO_ERROR) {
          gl.deleteBuffer(gpuBuffer);
          throw Error(t('gpuUploadFailed'));
        }
        this.buffers.push({ buffer: gpuBuffer, vertices: data.length / 6 });
      });
      return this.mesh;
    } catch (error) {
      this.clear();
      throw error;
    }
  }
  render(state) {
    const gl = this.gl;
    if (!gl) return;
    const bounds = this.canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(bounds.width * dpr));
    const height = Math.max(1, Math.round(bounds.height * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width; this.canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (!this.mesh) return;
    const m = this.mesh, loc = this.locations;
    gl.useProgram(this.program);
    gl.uniform3f(loc.center, ...m.center);
    gl.uniform1f(loc.invSize, 1 / (Math.hypot(...m.size) || 1));
    gl.uniform1f(loc.yaw, state.yaw);
    gl.uniform1f(loc.pitch, state.pitch);
    gl.uniform1f(loc.zoom, state.zoom);
    gl.uniform1f(loc.aspect, width / height);
    gl.enableVertexAttribArray(loc.position);
    gl.enableVertexAttribArray(loc.normal);
    for (const item of this.buffers) {
      gl.bindBuffer(gl.ARRAY_BUFFER, item.buffer);
      gl.vertexAttribPointer(loc.position, 3, gl.FLOAT, false, 24, 0);
      gl.vertexAttribPointer(loc.normal, 3, gl.FLOAT, false, 24, 12);
      gl.drawArrays(gl.TRIANGLES, 0, item.vertices);
    }
  }
}
