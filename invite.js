/* Prachi & Shail invitation: shared by all three invite pages.
   Tap the envelope to open; then tap or swipe the card stack, pinch a card to zoom in. */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (id) { return document.getElementById(id); };
  var intro = $('intro'), stage = $('stage'), track = $('track'), tabsEl = $('tabs');
  var foot = $('foot'), whereEl = $('where'), go = $('go'), hintEl = $('hint-line');
  var hintText = hintEl.textContent;
  var slides = Array.prototype.slice.call(track.querySelectorAll('.slide'));
  var tabs = [];
  var current = 0;

  /* ---------- sparkles ---------- */
  var sky = $('sky');
  for (var i = 0; i < 22; i++) {
    var sp = document.createElement('span');
    var sz = 6 + Math.random() * 12;
    sp.className = 'spark';
    sp.style.cssText = 'left:' + (Math.random() * 100) + '%;top:' + (Math.random() * 100) + '%;width:' + sz + 'px;height:' + sz +
      'px;--d:' + (2.4 + Math.random() * 3.2) + 's;--delay:-' + (Math.random() * 5) + 's';
    sky.appendChild(sp);
  }

  /* ---------- tabs, one per card ---------- */
  slides.forEach(function (s, k) {
    var b = document.createElement('button');
    var sm = document.createElement('small');
    b.type = 'button';
    b.className = 'tab';
    b.style.setProperty('--i', k);
    b.appendChild(document.createTextNode(s.dataset.tab));
    sm.textContent = s.dataset.sub;
    b.appendChild(sm);
    b.addEventListener('click', function () { setActive(k, 1, current); });
    tabsEl.appendChild(b);
    tabs.push(b);
  });

  function mapLink(s) {
    if (s.dataset.ll) return 'https://www.google.com/maps/search/?api=1&query=' + s.dataset.ll + '&query_place_id=' + s.dataset.pid;
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(s.dataset.q);
  }

  /* show card i; dir 1 = the previous top card flies away, -1 = card i flies in from the left */
  function setActive(k, dir, prev) {
    resetZoom(false);
    current = k;
    var n = slides.length;
    slides.forEach(function (s, j) {
      var d = (j - k + n) % n;
      s.classList.toggle('is-active', j === k);
      s.style.setProperty('--d', d);
      s.dataset.d = Math.min(d, 3);
    });
    tabs.forEach(function (t, j) { if (j === k) t.setAttribute('aria-current', 'true'); else t.removeAttribute('aria-current'); });
    var el = dir > 0 ? slides[prev] : dir < 0 ? slides[k] : null;
    if (el && (dir < 0 || prev !== k)) {
      el.classList.remove('fly', 'flyin');
      void el.offsetWidth;   // restart the animation
      el.classList.add(dir > 0 ? 'fly' : 'flyin');
    }
    var s = slides[k];
    foot.hidden = !s.dataset.q;
    if (s.dataset.q) { whereEl.textContent = s.dataset.where; go.href = mapLink(s); }
    var t = tabs[k];
    tabsEl.scrollTo({ left: t.offsetLeft - (tabsEl.clientWidth - t.offsetWidth) / 2, behavior: 'smooth' });
  }

  var busy = false;   // a short pause between card changes so the stack never jumbles
  function step(dir) {
    if (busy) return;
    busy = true;
    setTimeout(function () { busy = false; }, reduce ? 0 : 550);
    setActive((current + dir + slides.length) % slides.length, dir, current);
  }

  slides.forEach(function (s) {
    s.addEventListener('animationend', function () {
      s.classList.remove('fly', 'flyin');
      s.style.removeProperty('--dx'); s.style.removeProperty('--dr'); s.style.removeProperty('--fx');
    });
  });
  track.addEventListener('keydown', function (e) {
    track.classList.remove('ptr');
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
  });
  $('prev').addEventListener('click', function () { step(-1); });
  $('next').addEventListener('click', function () { step(1); });

  /* ---------- zoom inside the card ---------- */
  var MAXZ = 4, z = 1, tx = 0, ty = 0, clearTimer = 0;
  function cardImg() { return slides[current].querySelector('img'); }
  function clampPan() {   // keep the zoomed card covering its frame
    var im = cardImg(), bw = im.offsetWidth, bh = im.offsetHeight;
    var ar = (im.naturalWidth || 2) / (im.naturalHeight || 3), dw = Math.min(bw, bh * ar), dh = dw / ar;   // card as drawn (object-fit: contain)
    var mx = Math.max(0, (dw * z - bw) / 2), my = Math.max(0, (dh * z - bh) / 2);
    tx = Math.max(-mx, Math.min(mx, tx));
    ty = Math.max(-my, Math.min(my, ty));
  }
  function applyZoom(animate) {
    var im = cardImg(), on = z > 1;
    clearTimeout(clearTimer);
    im.style.transition = animate ? 'transform .25s ease' : 'none';
    im.style.transform = on ? 'translate(' + tx + 'px,' + ty + 'px) scale(' + z + ')' : '';
    if (!on) clearTimer = setTimeout(function () { im.style.transition = ''; }, 300);   // hand the picture back to the stylesheet
    slides[current].classList.toggle('zoomed-in', on);
    stage.classList.toggle('cardzoom', on);
    hintEl.textContent = on ? 'Drag to move around · tap to zoom out' : hintText;
  }
  function resetZoom(animate) {
    if (z === 1 && !tx && !ty) return;
    z = 1; tx = 0; ty = 0;
    applyZoom(animate);
  }

  /* ---------- card gestures: all handled here so every phone behaves the same ----------
     one finger: tap = next card, swipe = next/previous (the card follows the finger);
     two fingers: pinch to zoom; while zoomed, one finger moves around and a tap zooms back out */
  var pts = {}, nPts = 0, gesture = null;
  var sx = 0, sy = 0, st = 0, t0x = 0, t0y = 0;               // one-finger start
  var z0 = 1, d0 = 1, m0x = 0, m0y = 0, cx = 0, cy = 0;        // pinch start
  function twoPts() { var k = Object.keys(pts); return [pts[k[0]], pts[k[1]]]; }
  function startOne(x, y) { sx = x; sy = y; st = Date.now(); t0x = tx; t0y = ty; }
  function startPinch() {
    var p = twoPts(), r = cardImg().getBoundingClientRect();
    d0 = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1;
    m0x = (p[0].x + p[1].x) / 2; m0y = (p[0].y + p[1].y) / 2;
    z0 = z; t0x = tx; t0y = ty;
    cx = r.left + r.width / 2 - tx; cy = r.top + r.height / 2 - ty;   // the card's centre before panning
  }
  function settle(s) {   // a dragged card springs back into the stack
    s.style.transition = 'transform .28s cubic-bezier(.2,.8,.2,1)';
    s.style.transform = '';
    setTimeout(function () { s.style.transition = ''; }, 300);
  }

  track.addEventListener('dragstart', function (e) { e.preventDefault(); });      // mouse drags move the card, not the picture file
  track.addEventListener('gesturestart', function (e) { e.preventDefault(); });   // older iPhones: no page zoom on the card
  track.addEventListener('pointerdown', function (e) {
    track.classList.add('ptr');
    if (e.isPrimary || !nPts) { pts = {}; nPts = 0; gesture = null; }   // every new touch starts clean
    if (!pts[e.pointerId]) nPts++;
    pts[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (e.pointerType === 'mouse') { try { track.setPointerCapture(e.pointerId); } catch (err) {} }
    if (nPts === 1) startOne(e.clientX, e.clientY);
    else if (nPts === 2) {
      if (gesture === 'swipe') settle(slides[current]);
      gesture = 'pinch';
      startPinch();
    }
  });
  track.addEventListener('pointermove', function (e) {
    if (!pts[e.pointerId]) return;
    pts[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (gesture === 'pinch' && nPts >= 2) {
      var p = twoPts(), d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      var mx = (p[0].x + p[1].x) / 2, my = (p[0].y + p[1].y) / 2;
      z = Math.max(1, Math.min(MAXZ, z0 * d / d0));
      tx = mx - cx - z * (m0x - cx - t0x) / z0;   // keep the point between the fingers under the fingers
      ty = my - cy - z * (m0y - cy - t0y) / z0;
      clampPan(); applyZoom(false);
      return;
    }
    if (nPts !== 1) return;
    var dx = e.clientX - sx, dy = e.clientY - sy;
    if (z > 1 || gesture === 'pan') {
      if (gesture === null && Math.abs(dx) + Math.abs(dy) > 6) gesture = 'pan';
      if (gesture === 'pan') { tx = t0x + dx; ty = t0y + dy; clampPan(); applyZoom(false); }
      return;
    }
    if (busy) return;
    if (gesture === null && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) gesture = 'swipe';
    if (gesture === 'swipe' && !reduce) {
      var s = slides[current];
      s.style.transition = 'none';
      s.style.transform = 'translateX(' + dx + 'px) rotate(' + (dx * 0.03) + 'deg)';
    }
  });
  function lift(e, cancelled) {
    if (!pts[e.pointerId]) return;
    delete pts[e.pointerId]; nPts--;
    if (gesture === 'pinch') {
      if (nPts === 1) { var k = Object.keys(pts)[0]; startOne(pts[k].x, pts[k].y); gesture = 'pan'; }   // one finger left: keep moving
      if (z < 1.08) resetZoom(true);
      return;
    }
    if (nPts > 0) return;
    var g = gesture, s = slides[current];
    var dx = e.clientX - sx, dy = e.clientY - sy, quick = Date.now() - st < 300, tap = Math.abs(dx) < 12 && Math.abs(dy) < 12;
    gesture = null;
    if (g === 'pan') { if (z < 1.08) resetZoom(true); return; }
    if (cancelled || busy) { if (g === 'swipe') settle(s); return; }
    if (z > 1) { if (tap) resetZoom(true); return; }   // tap while zoomed: zoom out
    if (g === 'swipe' && (Math.abs(dx) > 60 || (quick && Math.abs(dx) > 25))) {
      if (dx < 0) {   // swipe left: this card flies off to the left from where the finger let go
        s.style.setProperty('--dx', dx + 'px'); s.style.setProperty('--dr', (dx * 0.03) + 'deg'); s.style.setProperty('--fx', '-1');
        s.style.transition = ''; s.style.transform = '';
        step(1);
      } else {        // swipe right: this card slides back and the previous one comes in from the left
        settle(s);
        step(-1);
      }
    } else if (g === 'swipe') settle(s);
    else if (tap) step(1);
  }
  track.addEventListener('pointerup', function (e) { lift(e, false); });
  track.addEventListener('pointercancel', function (e) { lift(e, true); });

  /* ---------- petals ---------- */
  var canvas = $('petals'), ctx = canvas.getContext('2d');
  var W = 0, H = 0, dpr = 1, petals = [], running = false, rafId = 0, lastTick = 0;
  var colors = ['#e9a23b', '#d9822b', '#cfa95f', '#c4525d', '#f0c987'];
  function sizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
  }
  function makePetal() {
    return {
      x: Math.random() * W, y: -20 - Math.random() * 60,
      s: 5 + Math.random() * 7, vy: .45 + Math.random() * .8, sw: Math.random() * 6.28, ss: .012 + Math.random() * .02,
      amp: .35 + Math.random() * .9, r: Math.random() * 6.28, vr: (Math.random() - .5) * .05,
      c: colors[(Math.random() * colors.length) | 0], a: .5 + Math.random() * .45
    };
  }
  function frame(now) {
    if (!running) return;
    var k = lastTick ? Math.min(Math.max((now - lastTick) / 16.67, 0), 3) : 1;   // same speed at 30, 60 or 120 fps
    lastTick = now;
    rafId = requestAnimationFrame(frame);   // book the next frame first so one bad frame can't stop the loop
    if (!W || !H) sizeCanvas();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (var j = 0; j < petals.length; j++) {
      var p = petals[j];
      p.y += p.vy * k; p.sw += p.ss * k; p.x += Math.sin(p.sw) * p.amp * k; p.r += p.vr * k;
      if (p.y > H + 20) petals[j] = p = makePetal();
      var c = Math.cos(p.r) * dpr, s = Math.sin(p.r) * dpr, fy = .55 + .45 * Math.abs(Math.sin(p.sw));
      ctx.setTransform(c, s, -s * fy, c * fy, p.x * dpr, p.y * dpr);   // move, turn and flutter in one step
      ctx.globalAlpha = p.a;
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.s, p.s * .5, 0, 0, 6.2832);
      ctx.fill();
    }
  }
  function startPetals() {
    if (reduce || running) return;
    sizeCanvas();
    petals = [];
    for (var j = 0, count = W < 600 ? 22 : 34; j < count; j++) { var p = makePetal(); p.y = -Math.random() * H; petals.push(p); }
    running = true;
    lastTick = 0;
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(frame);
  }
  function stopPetals() {
    running = false;
    cancelAnimationFrame(rafId);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  /* restart the loop if the phone froze it (switching apps, coming back from Maps, locking the screen) */
  function kickPetals() {
    if (!running || document.hidden || performance.now() - lastTick < 600) return;
    cancelAnimationFrame(rafId);
    lastTick = 0;
    sizeCanvas();
    rafId = requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', kickPetals);
  window.addEventListener('pageshow', kickPetals);
  window.addEventListener('focus', kickPetals);
  setInterval(kickPetals, 1500);
  window.addEventListener('resize', function () { resetZoom(false); if (running) sizeCanvas(); });

  /* ---------- music: starts with the tap on the envelope (phones need a tap before sound) ---------- */
  var music = $('music'), soundBtn = $('sound');
  var muted = false, fadeTimer = 0;
  try { muted = localStorage.getItem('ps-invite-muted') === '1'; } catch (e) {}
  function showSound() {
    var label = muted ? 'Play music' : 'Mute music';
    soundBtn.setAttribute('aria-pressed', muted ? 'false' : 'true');
    soundBtn.setAttribute('aria-label', label);
    soundBtn.title = label;
  }
  function playMusic() {
    if (muted) return;
    clearInterval(fadeTimer);
    try { music.volume = 0; } catch (e) {}
    var pr;
    try { pr = music.play(); } catch (e) {}
    if (pr && pr.catch) pr.catch(function () {});
    fadeTimer = setInterval(function () {   // gentle fade in
      try { music.volume = Math.min(0.6, music.volume + 0.04); } catch (e) {}
      if (music.volume >= 0.6) clearInterval(fadeTimer);
    }, 100);
  }
  soundBtn.addEventListener('click', function () {
    muted = !muted;
    try { localStorage.setItem('ps-invite-muted', muted ? '1' : '0'); } catch (e) {}
    if (muted) music.pause(); else playMusic();
    showSound();
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) music.pause();
    else if (!muted && intro.hidden) playMusic();
  });
  window.addEventListener('pageshow', function (e) {
    if (e.persisted && !muted && intro.hidden) playMusic();
  });
  showSound();

  /* ---------- open and close the envelope ---------- */
  function reveal() {
    stage.removeAttribute('inert');
    stage.classList.add('revealed');
    setActive(0);
    intro.hidden = true;
    setTimeout(function () { track.focus({ preventScroll: true }); }, 1600);
  }
  $('open').addEventListener('click', function () {
    playMusic();
    if (reduce) { reveal(); return; }
    intro.classList.add('leaving');
    startPetals();
    setTimeout(reveal, 700);
  });
  $('back').addEventListener('click', function () {
    stopPetals();
    music.pause();
    try { music.currentTime = 0; } catch (e) {}
    stage.setAttribute('inert', '');
    stage.classList.remove('revealed');
    setActive(0);
    intro.hidden = false;
    void intro.offsetWidth;   // let the envelope fade back in
    intro.classList.remove('leaving');
    $('open').focus({ preventScroll: true });
  });

  setActive(0);
})();
