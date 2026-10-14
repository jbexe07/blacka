/*
 * Roda de produtos (JavaScript puro, sem React / framer-motion / next-themes).
 *
 * Como funciona: o script lê os cards que já existem em
 *   <section data-roda> ... <div class="produto"> <img> <h3> <p> </div> ...
 * e monta por cima uma roda giratória com foto, nomes e descrição.
 * Se o JavaScript falhar, os cards continuam aparecendo normalmente.
 */
(function () {
  var section = document.querySelector('[data-roda]');
  if (!section) return;

  var cards = section.querySelectorAll('.produto');
  var lista = section.querySelector('.lista-produtos');
  if (!lista || cards.length < 2) return; // com menos de 2 itens, mantém os cards

  // ---- Ajustes ----
  var SPACING = 16;             // graus entre um nome e o próximo
  var WHEEL_SPEED = 0.008;      // sensibilidade da roda do mouse
  var DRAG_SPEED = 0.02;        // sensibilidade do arrasto
  var MAX_VISIBLE = 7;
  var START = 0;                // índice do item inicial

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Dados: lidos dos cards do HTML ----
  var items = [];
  Array.prototype.forEach.call(cards, function (card) {
    var img = card.querySelector('img');
    var h3 = card.querySelector('h3');
    var p = card.querySelector('p');
    var label = h3 ? h3.textContent.trim() : '';
    items.push({
      label: label,
      src: img ? img.getAttribute('src') : '',
      alt: img && img.getAttribute('alt') ? img.getAttribute('alt') : label,
      text: p ? p.textContent.trim() : ''
    });
  });
  var N = items.length;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  // ---- Monta o HTML da roda ----
  var roda = el('div', 'roda');

  var foto = el('div', 'roda-foto');
  var fotos = items.map(function (it) {
    var img = el('img');
    img.src = it.src;
    img.alt = it.alt;
    img.draggable = false;
    img.setAttribute('aria-hidden', 'true');
    foto.appendChild(img);
    return img;
  });

  var wrap = el('div', 'roda-palco-wrap');
  var palco = el('div', 'roda-palco');
  palco.setAttribute('role', 'listbox');
  palco.setAttribute('aria-label', 'Produtos');
  palco.tabIndex = 0;
  var trilha = el('div', 'roda-trilha');
  var marcador = el('span', 'roda-marcador');
  marcador.setAttribute('aria-hidden', 'true');
  trilha.appendChild(marcador);

  var rotulos = items.map(function (it, i) {
    var r = el('div', 'roda-item', it.label);
    r.id = 'roda-item-' + i;
    r.setAttribute('role', 'option');
    r.setAttribute('aria-selected', 'false');
    trilha.appendChild(r);
    return r;
  });
  palco.appendChild(trilha);

  var controles = el('div', 'roda-controles');
  var btnPrev = el('button', 'roda-btn', '\u25B2');
  var btnNext = el('button', 'roda-btn', '\u25BC');
  btnPrev.type = btnNext.type = 'button';
  btnPrev.setAttribute('aria-label', 'Produto anterior');
  btnNext.setAttribute('aria-label', 'Próximo produto');
  controles.appendChild(btnPrev);
  controles.appendChild(btnNext);

  wrap.appendChild(palco);
  wrap.appendChild(controles);

  var live = el('span', 'sr-only');
  live.setAttribute('aria-live', 'polite');

  roda.appendChild(foto);
  roda.appendChild(wrap);
  roda.appendChild(live);

  section.classList.add('roda-ativa'); // o CSS esconde a lista de cards
  lista.parentNode.insertBefore(roda, lista);

  // ---- Estado ----
  var rotation = START;
  var selected = -1;
  var velocity = 0;
  var dragging = false;
  var raf = 0;
  var lastTime = 0;
  var radius = 300;
  var visible = Math.min(MAX_VISIBLE, N / 2); // com poucos itens, o último some antes de "dar a volta"
  var originY = 0;
  var originRot = 0;
  var prevRot = 0;

  function wrapIndex(i) {
    return ((i % N) + N) % N;
  }

  function shortest(i, rot) {
    var off = i - rot;
    while (off > N / 2) off -= N;
    while (off < -N / 2) off += N;
    return off;
  }

  function setSelected(idx) {
    if (selected >= 0) {
      rotulos[selected].classList.remove('selecionado');
      rotulos[selected].setAttribute('aria-selected', 'false');
      fotos[selected].classList.remove('ativa');
      fotos[selected].setAttribute('aria-hidden', 'true');
    }
    selected = idx;
    rotulos[idx].classList.add('selecionado');
    rotulos[idx].setAttribute('aria-selected', 'true');
    fotos[idx].classList.add('ativa');
    fotos[idx].removeAttribute('aria-hidden');
    palco.setAttribute('aria-activedescendant', rotulos[idx].id);
    live.textContent = items[idx].label + ', item ' + (idx + 1) + ' de ' + N;
  }

  function render() {
    for (var i = 0; i < N; i++) {
      var off = shortest(i, rotation);
      var node = rotulos[i];
      if (Math.abs(off) > visible) {
        node.style.visibility = 'hidden';
        continue;
      }
      node.style.visibility = '';
      var angle = off * SPACING;
      var rad = (angle * Math.PI) / 180;
      var x = -radius * (1 - Math.cos(rad));
      var y = radius * Math.sin(rad);
      var dist = Math.min(Math.abs(off) / visible, 1);
      var scale = 1 - Math.min(Math.abs(off) * 0.04, 0.45);
      node.style.opacity = Math.cos((dist * Math.PI) / 2);
      node.style.transform =
        'translate(' + x + 'px,' + y + 'px) translateY(-50%) rotate(' + angle + 'deg) scale(' + scale + ')';
    }
  }

  function commit(next) {
    rotation = next;
    var idx = wrapIndex(Math.round(next));
    if (idx !== selected) setSelected(idx);
    render();
  }

  // ---- Animação (inércia + encaixe no item mais próximo) ----
  function tick(now) {
    var dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    var f = dt * 60; // mesmo comportamento em telas de 60 e 120 Hz
    var keep = false;

    if (!dragging && Math.abs(velocity) > 0.0008) {
      commit(rotation + velocity * f);
      velocity *= Math.pow(reduced ? 0.8 : 0.9, f);
      keep = true;
    } else if (!dragging) {
      velocity = 0;
      var target = Math.round(rotation);
      var delta = target - rotation;
      if (Math.abs(delta) > 0.001 && !reduced) {
        commit(rotation + delta * (1 - Math.pow(1 - 0.22, f)));
        keep = true;
      } else {
        commit(target);
      }
    }
    raf = keep ? requestAnimationFrame(tick) : 0;
  }

  function run() {
    if (raf) return;
    lastTime = performance.now();
    raf = requestAnimationFrame(tick);
  }

  function moveBy(amount) {
    velocity = 0;
    commit(rotation + amount);
    run();
  }

  // ---- Roda do mouse: só captura depois que a roda recebe foco (clique/Tab) ----
  // Assim a página continua rolando normalmente quando o mouse só passa por cima.
  palco.addEventListener('wheel', function (e) {
    if (e.ctrlKey || e.metaKey) return;
    if (document.activeElement !== palco) return;
    e.preventDefault();
    var delta = e.deltaY * WHEEL_SPEED;
    commit(rotation + delta);
    velocity = delta * 0.2;
    run();
  }, { passive: false });

  // ---- Arrastar (mouse e toque) ----
  palco.addEventListener('pointerdown', function (e) {
    if (!e.isPrimary || e.button !== 0) return;
    dragging = true;
    velocity = 0;
    originY = e.clientY;
    originRot = rotation;
    prevRot = rotation;
    palco.classList.add('arrastando');
    palco.setPointerCapture(e.pointerId);
  });

  palco.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var next = originRot - (e.clientY - originY) * DRAG_SPEED;
    velocity = next - prevRot;
    prevRot = next;
    commit(next);
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    palco.classList.remove('arrastando');
    if (palco.hasPointerCapture(e.pointerId)) palco.releasePointerCapture(e.pointerId);
    run();
  }
  palco.addEventListener('pointerup', endDrag);
  palco.addEventListener('pointercancel', endDrag);

  // ---- Teclado e botões ----
  palco.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      moveBy(1);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      moveBy(-1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      moveBy(-selected);
    } else if (e.key === 'End') {
      e.preventDefault();
      moveBy(N - 1 - selected);
    }
  });
  btnPrev.addEventListener('click', function () { moveBy(-1); });
  btnNext.addEventListener('click', function () { moveBy(1); });

  // ---- Tamanho: o raio da curva acompanha a altura da roda ----
  function resize() {
    var h = palco.clientHeight;
    if (!h) return;
    radius = Math.min(320, h * 0.8);
    render();
  }
  if ('ResizeObserver' in window) {
    new ResizeObserver(resize).observe(palco);
  } else {
    window.addEventListener('resize', resize);
  }

  // ---- Início ----
  setSelected(wrapIndex(START));
  rotation = wrapIndex(START);
  resize();
  render();
})();