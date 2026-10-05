/* Stanza — log in / sign up pages (/login, /signup) */
(function () {
  'use strict';
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var AUTH = (window.STANZA_CONFIG && window.STANZA_CONFIG.auth) || {};
  var FR = document.documentElement.lang === 'fr';
  var T = FR
    ? { error: 'Identifiants incorrects ou service indisponible. Réessayez.', sending: 'Un instant…' }
    : { error: 'Wrong details or service unavailable. Please try again.', sending: 'One moment…' };

  function showNotice(form, text) {
    var n = $('[data-auth-notice]', form || document);
    if (!n) return;
    if (text) n.firstChild.textContent = text;
    n.hidden = false;
  }

  // Google / Microsoft
  $$('[data-auth-provider]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var url = AUTH[btn.getAttribute('data-auth-provider') + 'Url'];
      if (AUTH.ready && url) { location.href = url; return; }
      var form = $('[data-auth-form]');
      if (form) form.hidden = false;
      showNotice(form);
    });
  });

  // Sign up: "Sign up with email" reveals the form
  var reveal = $('[data-auth-reveal]');
  if (reveal) {
    reveal.addEventListener('click', function () {
      var form = $('[data-auth-form]');
      form.hidden = false;
      reveal.hidden = true;
      var first = $('input', form);
      if (first) first.focus();
    });
  }

  $$('[data-auth-form]').forEach(function (form) {
    var kind = form.getAttribute('data-auth-form');
    var more = $('[data-auth-more]', form);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      // Log in: email first, then the password (like most sign-in flows)
      if (more && more.hidden) {
        if (!form.email.reportValidity()) return;
        more.hidden = false;
        form.password.required = true;
        form.password.focus();
        return;
      }
      if (!form.reportValidity()) return;
      var endpoint = AUTH[kind + 'Endpoint'];
      if (!AUTH.ready || !endpoint) { showNotice(form); return; }
      var data = {};
      $$('input', form).forEach(function (i) { data[i.name] = i.type === 'checkbox' ? i.checked : i.value; });
      var btn = $('[data-auth-submit]', form);
      btn.disabled = true;
      var label = btn.textContent;
      btn.textContent = T.sending;
      fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'include', body: JSON.stringify(data) })
        .then(function (r) {
          if (!r.ok) throw new Error(r.status);
          location.href = AUTH.redirect || '/';
        })
        .catch(function () {
          btn.disabled = false;
          btn.textContent = label;
          showNotice(form, T.error);
        });
    });
  });

  // Showcase carousel (auto-advance, prev / pause / next, dots)
  var car = $('[data-auth-carousel]');
  if (car) {
    var slides = $$('.auth-slide', car);
    var dots = $$('.auth-carousel__dots i', car);
    var playBtn = $('[data-play]', car);
    var i = 0, timer = null, playing = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var show = function (n) {
      i = (n + slides.length) % slides.length;
      slides.forEach(function (s, k) { s.classList.toggle('is-active', k === i); });
      dots.forEach(function (d, k) { d.classList.toggle('is-on', k === i); });
    };
    var start = function () { stop(); timer = setInterval(function () { show(i + 1); }, 5000); };
    var stop = function () { if (timer) clearInterval(timer); timer = null; };
    var setPlaying = function (p) {
      playing = p;
      $('use', playBtn).setAttribute('href', p ? '#i-pause' : '#i-play');
      if (p) start(); else stop();
    };
    $('[data-prev]', car).addEventListener('click', function () { show(i - 1); if (playing) start(); });
    $('[data-next]', car).addEventListener('click', function () { show(i + 1); if (playing) start(); });
    playBtn.addEventListener('click', function () { setPlaying(!playing); });
    dots.forEach(function (d, k) { d.addEventListener('click', function () { show(k); if (playing) start(); }); });
    setPlaying(playing);
  }
})();
