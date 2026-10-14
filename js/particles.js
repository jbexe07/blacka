/*
 * Fundo de partículas fluidas (JavaScript puro, sem React/Tailwind).
 * Uso: adicione data-particles na <section> e carregue com <script defer>.
 * O canvas fica POR CIMA do conteúdo (com pointer-events: none no CSS).
 * O rastro some por transparência, sem pintar a cor de fundo da seção.
 */
(function () {
  var section = document.querySelector('[data-particles]');
  if (!section) return;

  // ---- Ajustes ----
  var PARTICLE_COLOR = [9, 58, 86]; // #8e1d65. Para o original, use [0, 0, 0] em fundo claro
  var DENSITY = 0.1015;      // partículas por pixel² (0.0015 = 1 a cada ~670 px²)
  var MIN_PARTICLES = 150;
  var MAX_PARTICLES = 1600;  // teto, para não pesar em telas grandes
  var SIZE_MIN = 0.5;
  var SIZE_MAX = 2;
  var NOISE_SCALE = 0.003;   // menor = curvas mais suaves e largas
  var SPEED = 90;           // pixels por segundo
  var TRAIL = 0.12;          // quanto o rastro some a cada quadro (maior = rastro curto)
  var FPS = 50;

  var canvas = document.createElement('canvas');
  canvas.className = 'particles-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  section.insertBefore(canvas, section.firstChild);

  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  // ---- Ruído de Perlin 3D (o original chama de "simplex3") ----
  var perlin3 = (function () {
    var permutation = [
      151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140,
      36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247, 120,
      234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33,
      88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71,
      134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133,
      230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161,
      1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130,
      116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217, 226, 250,
      124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227,
      47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44,
      154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9, 129, 22, 39, 253, 19, 98,
      108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228, 251, 34,
      242, 193, 238, 210, 144, 12, 191, 179, 162, 241, 81, 51, 145, 235, 249, 14,
      239, 107, 49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121,
      50, 45, 127, 4, 150, 254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243,
      141, 128, 195, 78, 66, 215, 61, 156, 180
    ];
    var p = new Array(512);
    for (var i = 0; i < 256; i++) p[256 + i] = p[i] = permutation[i];

    function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    function lerp(t, a, b) { return a + t * (b - a); }
    function grad(hash, x, y, z) {
      var h = hash & 15;
      var u = h < 8 ? x : y;
      var v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
      return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    return function (x, y, z) {
      var X = Math.floor(x) & 255;
      var Y = Math.floor(y) & 255;
      var Z = Math.floor(z) & 255;
      x -= Math.floor(x);
      y -= Math.floor(y);
      z -= Math.floor(z);
      var u = fade(x), v = fade(y), w = fade(z);
      var A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z;
      var B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
      return lerp(w,
        lerp(v,
          lerp(u, grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z)),
          lerp(u, grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z))),
        lerp(v,
          lerp(u, grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1)),
          lerp(u, grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1))));
    };
  })();

  var particles = [];
  var raf = 0;
  var last = 0;
  var inView = true;
  var tabVisible = !document.hidden;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function makeParticle(w, h) {
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      size: Math.random() * (SIZE_MAX - SIZE_MIN) + SIZE_MIN,
      life: Math.random() * 100,
      maxLife: 100 + Math.random() * 50
    };
  }

  function resize() {
    var w = section.clientWidth;
    var h = section.clientHeight;
    if (!w || !h) return;
    canvas.width = w;   // redefinir o tamanho também limpa o canvas
    canvas.height = h;
    var count = Math.round(w * h * DENSITY);
    count = Math.max(MIN_PARTICLES, Math.min(MAX_PARTICLES, count));
    particles = [];
    for (var i = 0; i < count; i++) particles.push(makeParticle(w, h));
  }

  function step(now) {
    raf = requestAnimationFrame(step);
    var elapsed = now - last;
    if (elapsed < 1000 / FPS) return;
    last = now;

    var dt = Math.min(elapsed, 100) / 1000; // segundos (limitado, para evitar saltos)
    var f = dt * 60;                        // fator em relação a 60 quadros por segundo
    var w = canvas.width;
    var h = canvas.height;

    // Rastro: apaga um pouco do quadro anterior (deixa mais transparente),
    // em vez de pintar por cima. Assim o canvas pode ficar sobre os cards.
    var fade = 1 - Math.pow(1 - TRAIL, f);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,' + fade + ')';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';

    var move = SPEED * dt;
    var time = now * 0.0001;

    for (var i = 0; i < particles.length; i++) {
      var pt = particles[i];

      pt.life += f;
      if (pt.life > pt.maxLife) {
        pt.life = 0;
        pt.x = Math.random() * w;
        pt.y = Math.random() * h;
      }

      var opacity = Math.sin((pt.life / pt.maxLife) * Math.PI) * 0.15;

      var n = perlin3(pt.x * NOISE_SCALE, pt.y * NOISE_SCALE, time);
      var angle = n * Math.PI * 4;
      pt.x += Math.cos(angle) * move;
      pt.y += Math.sin(angle) * move;

      if (pt.x < 0) pt.x = w;
      if (pt.x > w) pt.x = 0;
      if (pt.y < 0) pt.y = h;
      if (pt.y > h) pt.y = 0;

      ctx.fillStyle = 'rgba(' + PARTICLE_COLOR[0] + ',' + PARTICLE_COLOR[1] + ',' +
        PARTICLE_COLOR[2] + ',' + opacity + ')';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function running() {
    return !reduced && inView && tabVisible;
  }

  function update() {
    if (running()) {
      if (!raf) {
        last = 0;
        raf = requestAnimationFrame(step);
      }
    } else if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  // Pausa quando a seção sai da tela ou a aba fica em segundo plano.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting;
      update();
    }).observe(section);
  }
  document.addEventListener('visibilitychange', function () {
    tabVisible = !document.hidden;
    update();
  });

  // Acompanha o tamanho da seção (que muda com a largura da tela).
  var timer;
  function onResize() {
    clearTimeout(timer);
    timer = setTimeout(resize, 150);
  }
  if ('ResizeObserver' in window) {
    new ResizeObserver(onResize).observe(section);
  } else {
    window.addEventListener('resize', onResize);
  }

  resize();
  update();
})();
