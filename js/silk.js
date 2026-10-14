/*
 * Fundo animado "silk" para a hero (JavaScript puro, sem React/Tailwind).
 * Uso: adicione data-silk na seção da hero e carregue este arquivo com <script defer>.
 */
(function () {
  var hero = document.querySelector('[data-silk]');
  if (!hero) return;

  // ---- Ajustes ----
  var COLOR = [202, 80, 19]; // cor da seda (#8e1d65). Original: [123, 116, 129]
  var SCALE = 0.4;            // resolução interna em relação à tela (menor = mais leve)
  var MAX_SIDE = 720;         // limite do maior lado do canvas interno, em pixels
  var FPS = 30;               // quadros por segundo
  var SPEED = 0.02;
  var PATTERN_SCALE = 2;
  var NOISE = 0.8;

  var canvas = document.createElement('canvas');
  canvas.className = 'silk-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  hero.insertBefore(canvas, hero.firstChild);

  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var image = null;
  var grain = null;
  var raf = 0;
  var last = 0;
  var inView = true;
  var tabVisible = !document.hidden;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Mesma função de ruído do original. Como depende só da posição do pixel,
  // calculamos uma vez por redimensionamento, e não a cada quadro.
  function noise(x, y) {
    var G = 2.71828;
    var rx = G * Math.sin(G * x);
    var ry = G * Math.sin(G * y);
    return (rx * ry * (1 + x)) % 1;
  }

  function resize() {
    var w = hero.clientWidth;
    var h = hero.clientHeight;
    if (!w || !h) return;
    var k = Math.min(SCALE, MAX_SIDE / Math.max(w, h));
    canvas.width = Math.max(1, Math.round(w * k));
    canvas.height = Math.max(1, Math.round(h * k));

    image = ctx.createImageData(canvas.width, canvas.height);
    grain = new Float32Array(canvas.width * canvas.height);
    for (var y = 0; y < canvas.height; y++) {
      for (var x = 0; x < canvas.width; x++) {
        var i = y * canvas.width + x;
        grain[i] = (noise(x, y) / 15) * NOISE;
        image.data[i * 4 + 3] = 255; // opacidade total, definida uma vez
      }
    }
    if (!running()) draw(0);
  }

  function draw(time) {
    if (!image) return;
    var width = canvas.width;
    var height = canvas.height;
    var data = image.data;
    var t = SPEED * time;

    for (var y = 0; y < height; y++) {
      var v = (y / height) * PATTERN_SCALE;
      for (var x = 0; x < width; x++) {
        var u = (x / width) * PATTERN_SCALE;
        var ty = v + 0.03 * Math.sin(8.0 * u - t);
        var pattern =
          0.6 +
          0.4 *
            Math.sin(
              5.0 * (u + ty + Math.cos(3.0 * u + 5.0 * ty) + 0.02 * t) +
                Math.sin(20.0 * (u + ty - 0.1 * t))
            );
        var i = y * width + x;
        var intensity = Math.max(0, pattern - grain[i]);
        var p = i * 4;
        data[p] = COLOR[0] * intensity;
        data[p + 1] = COLOR[1] * intensity;
        data[p + 2] = COLOR[2] * intensity;
      }
    }
    ctx.putImageData(image, 0, 0);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (now - last < 1000 / FPS) return;
    last = now;
    draw((now / 1000) * 60);
  }

  function running() {
    return !reduced && inView && tabVisible;
  }

  function update() {
    if (running()) {
      if (!raf) raf = requestAnimationFrame(frame);
    } else if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  // Pausa quando a hero sai da tela ou a aba fica em segundo plano.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting;
      update();
    }).observe(hero);
  }
  document.addEventListener('visibilitychange', function () {
    tabVisible = !document.hidden;
    update();
  });

  var timer;
  window.addEventListener('resize', function () {
    clearTimeout(timer);
    timer = setTimeout(resize, 150);
  });

  resize();
  draw(0); // quadro estático (também é o resultado com movimento reduzido)
  update();
})();
