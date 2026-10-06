/* Stanza — site interactions (vanilla JS, no dependencies) */
(function () {
  'use strict';

  var doc = document.documentElement;
  doc.classList.add('js');
  var CFG = window.STANZA_CONFIG || { tally: {}, stripe: {} };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var isSet = function (v) { return typeof v === 'string' && v && v.indexOf('REPLACE_') !== 0; };

  // The page language is set on <html lang> by the server (functions/_middleware.js).
  var FR = doc.lang === 'fr';
  var T = FR
    ? { redirect: 'Redirection vers le paiement…', openMenu: 'Ouvrir le menu', closeMenu: 'Fermer le menu', slide: 'Diapositive ' }
    : { redirect: 'Redirecting to checkout…', openMenu: 'Open menu', closeMenu: 'Close menu', slide: 'Slide ' };

  /* ------------------------------------------------------------------
   * Tally + Stripe wiring
   * ------------------------------------------------------------------ */
  var tallyLoaded = false;
  function loadTally() {
    if (tallyLoaded) return;
    tallyLoaded = true;
    var s = document.createElement('script');
    s.src = 'https://tally.so/widgets/embed.js';
    s.async = true;
    document.head.appendChild(s);
  }
  // hidden: values for the form's hidden fields, e.g. { domains: 10 }
  function openTally(key, hidden) {
    var id = CFG.tally && CFG.tally[key];
    if (!isSet(id)) id = CFG.tally && CFG.tally.contact;
    if (!isSet(id)) {
      console.warn('[Stanza] Tally form "' + key + '" is not configured in assets/js/config.js');
      location.href = '/pricing';
      return;
    }
    if (window.Tally && typeof window.Tally.openPopup === 'function') {
      window.Tally.openPopup(id, { layout: 'modal', width: 640, overlay: true, emoji: { text: '👋', animation: 'wave' }, hiddenFields: hidden || {} });
    } else {
      var qs = hidden ? '?' + Object.keys(hidden).map(function (k) { return k + '=' + encodeURIComponent(hidden[k]); }).join('&') : '';
      window.open('https://tally.so/r/' + id + qs, '_blank', 'noopener');
    }
  }
  if (isSet(CFG.tally && CFG.tally.contact)) loadTally();

  $$('[data-tally]').forEach(function (el) {
    var id = CFG.tally[el.getAttribute('data-tally')];
    if (isSet(id)) el.setAttribute('href', 'https://tally.so/r/' + id);
    el.addEventListener('click', function (e) {
      e.preventDefault();
      closeMenus();
      openTally(el.getAttribute('data-tally'));
    });
  });

  // Quote requests (multi-domain): the number of domains goes to the Tally "quote" form.
  $$('[data-quote]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = form.querySelector('[name="domains"]');
      if (!form.reportValidity()) return;
      openTally('quote', { domains: input.value, offer: form.getAttribute('data-quote'), lang: doc.lang });
    });
  });
  if (isSet(CFG.tally && CFG.tally.quote)) loadTally();

  // Checkout forms POST to /api/checkout (Cloudflare Pages Function → Stripe Checkout).
  // Forms and prices are rendered server-side from functions/_lib/catalog.js.
  $$('[data-checkout]').forEach(function (form) {
    form.addEventListener('submit', function () {
      var btn = form.querySelector('button');
      if (!btn) return;
      btn.setAttribute('data-label', btn.textContent);
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      btn.textContent = T.redirect;
    });
  });
  // Re-enable buttons when the buyer comes back from Checkout with the Back button.
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    $$('[data-checkout] button[aria-busy]').forEach(function (btn) {
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      btn.textContent = btn.getAttribute('data-label');
    });
  });
  if (/[?&]checkout=error/.test(location.search)) {
    var checkoutError = $('[data-checkout-error]');
    if (checkoutError) checkoutError.hidden = false;
  }

  $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ------------------------------------------------------------------
   * Header: scrolled state, dropdowns, mobile menu
   * ------------------------------------------------------------------ */
  var header = $('[data-header]');
  var dropItems = $$('[data-dropdown]');
  var burger = $('[data-burger]');
  var desktopMq = window.matchMedia('(min-width: 992px)');

  function onScroll() { if (header) header.classList.toggle('is-scrolled', window.scrollY > 40); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  function setOpen(item, open) {
    item.classList.toggle('is-open', open);
    var btn = item.querySelector('.nav__link');
    if (btn) btn.setAttribute('aria-expanded', String(open));
  }
  function closeMenus() {
    dropItems.forEach(function (i) { setOpen(i, false); });
    if (header) header.classList.remove('is-menu-open');
    document.body.classList.remove('menu-open');
    if (burger) burger.setAttribute('aria-expanded', 'false');
  }

  dropItems.forEach(function (item) {
    var timer;
    var btn = item.querySelector('.nav__link');
    item.addEventListener('mouseenter', function () {
      if (!desktopMq.matches) return;
      clearTimeout(timer);
      dropItems.forEach(function (o) { if (o !== item) setOpen(o, false); });
      setOpen(item, true);
    });
    item.addEventListener('mouseleave', function () {
      if (!desktopMq.matches) return;
      timer = setTimeout(function () { setOpen(item, false); }, 150);
    });
    btn.addEventListener('click', function () {
      var open = !item.classList.contains('is-open');
      if (desktopMq.matches) dropItems.forEach(function (o) { setOpen(o, false); });
      setOpen(item, open);
    });
  });
  $$('.dropdown a, .nav > .nav__list > .nav__item > a.nav__link, .nav__mobile-actions a').forEach(function (a) {
    a.addEventListener('click', function () { if (!a.hasAttribute('data-tally')) closeMenus(); });
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenus(); });
  document.addEventListener('click', function (e) { if (desktopMq.matches && !e.target.closest('[data-dropdown]')) dropItems.forEach(function (o) { setOpen(o, false); }); });

  if (burger) {
    burger.setAttribute('aria-label', T.openMenu);
    burger.addEventListener('click', function () {
      var open = !header.classList.contains('is-menu-open');
      header.classList.toggle('is-menu-open', open);
      document.body.classList.toggle('menu-open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? T.closeMenu : T.openMenu);
    });
  }
  desktopMq.addEventListener('change', closeMenus);

  /* ------------------------------------------------------------------
   * Hero intro: split headline into words, staggered rise
   * ------------------------------------------------------------------ */
  $$('[data-split]').forEach(function (el) {
    var i = 0;
    var walk = function (node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            var w = document.createElement('span');
            w.className = 'split-word';
            var inner = document.createElement('span');
            inner.textContent = part;
            inner.style.transitionDelay = (0.08 + i++ * 0.06) + 's';
            w.appendChild(inner);
            frag.appendChild(w);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1 && child.tagName !== 'BR') {
          walk(child);
        }
      });
    };
    walk(el);
  });
  requestAnimationFrame(function () { requestAnimationFrame(function () { doc.classList.add('is-ready'); }); });

  /* ------------------------------------------------------------------
   * Count-up numbers inside stages
   * ------------------------------------------------------------------ */
  function countUp(el, delay, duration) {
    var from = +el.getAttribute('data-count-from');
    var to = +el.getAttribute('data-count-to');
    el.textContent = from;
    var start = null;
    clearTimeout(el._t);
    cancelAnimationFrame(el._raf);
    el._t = setTimeout(function () {
      var step = function (ts) {
        if (!start) start = ts;
        var p = Math.min((ts - start) / duration, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(from + (to - from) * eased);
        if (p < 1) el._raf = requestAnimationFrame(step);
      };
      el._raf = requestAnimationFrame(step);
    }, delay);
  }

  /* Step stack: rotate list items so the active one sits on top */
  function runSteps(stage) {
    var list = $('.stage__steps', stage);
    if (!list) return;
    clearInterval(list._i);
    var original = list._orig || (list._orig = $$('li', list).map(function (li) { return li.textContent; }));
    var items = $$('li', list);
    items.forEach(function (li, k) { li.textContent = original[k]; });
    var idx = 0;
    list._i = setInterval(function () {
      idx = (idx + 1) % original.length;
      items.forEach(function (li, k) { li.textContent = original[(idx + k) % original.length]; });
    }, 1500);
  }

  /* ------------------------------------------------------------------
   * Hero tabs with auto-advance + progress bar
   * ------------------------------------------------------------------ */
  var tabsRoot = $('[data-tabs]');
  if (tabsRoot) {
    var tabs = $$('.tab-card', tabsRoot);
    var stages = $$('.stage', tabsRoot);
    var DURATION = 9000;
    var current = 0;
    var elapsed = 0;
    var last = null;
    var visible = true;
    var raf;

    var activate = function (index, userInitiated) {
      current = index;
      elapsed = 0;
      tabs.forEach(function (t, i) {
        var on = i === index;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', String(on));
        t.setAttribute('tabindex', on ? '0' : '-1');
        var bar = $('.tab-card__progress span', t);
        if (bar) bar.style.transform = 'scaleX(0)';
      });
      stages.forEach(function (s, i) {
        var on = i === index;
        s.classList.remove('is-active');
        s.hidden = !on;
        if (on) {
          void s.offsetWidth; // restart CSS animations
          s.classList.add('is-active');
          $$('[data-count-to]', s).forEach(function (n) { countUp(n, 900, 4200); });
          runSteps(s);
        }
      });
      if (userInitiated && !desktopMq.matches) {
        tabs[index].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
      }
    };

    var tick = function (ts) {
      if (last === null) last = ts;
      var dt = ts - last;
      last = ts;
      if (visible && !document.hidden) {
        elapsed += dt;
        var bar = $('.tab-card__progress span', tabs[current]);
        if (bar) bar.style.transform = 'scaleX(' + Math.min(elapsed / DURATION, 1) + ')';
        if (elapsed >= DURATION) activate((current + 1) % tabs.length);
      }
      raf = requestAnimationFrame(tick);
    };

    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { activate(i, true); });
      t.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          var n = (i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
          activate(n, true);
          tabs[n].focus();
        }
      });
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; }, { threshold: 0.2 }).observe(tabsRoot);
    }
    activate(0);
    if (!reduceMotion) raf = requestAnimationFrame(tick);
  }

  /* ------------------------------------------------------------------
   * Reveal on scroll (start: "top 70%")
   * ------------------------------------------------------------------ */
  var revealEls = $$('[data-reveal]');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -30% 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* Transition glow — light scroll parallax */
  var glow = $('[data-parallax]');
  if (glow && !reduceMotion) {
    var parallax = function () {
      var r = glow.parentNode.getBoundingClientRect();
      var vh = window.innerHeight;
      var p = Math.max(0, Math.min(1, (vh - r.top) / (vh + r.height)));
      glow.style.transform = 'scaleY(' + (1.12 - p * 0.24).toFixed(3) + ')';
    };
    window.addEventListener('scroll', parallax, { passive: true });
    parallax();
  }

  /* Typing prompt */
  $$('.typing').forEach(function (el) {
    var text = el.getAttribute('data-type') || '';
    if (reduceMotion) { el.textContent = text; return; }
    var started = false;
    var type = function () {
      var i = 0;
      el.textContent = '';
      var loop = setInterval(function () {
        el.textContent = text.slice(0, ++i);
        if (i >= text.length) { clearInterval(loop); setTimeout(type, 3200); }
      }, 55);
    };
    new IntersectionObserver(function (en, obs) {
      if (en[0].isIntersecting && !started) { started = true; type(); obs.disconnect(); }
    }).observe(el);
  });

  /* Consent toggle demo */
  $$('[data-toggle]').forEach(function (t) {
    if (!reduceMotion) setInterval(function () { t.classList.toggle('is-on'); }, 2400);
  });

  /* ------------------------------------------------------------------
   * Standards tiles: staggered fade cycling
   * ------------------------------------------------------------------ */
  var row = $('[data-logo-row]');
  if (row && !reduceMotion) {
    var tiles = $$('.logo-tile', row);
    var t = 0;
    setInterval(function () {
      var tile = tiles[t % tiles.length];
      var spans = $$('span', tile);
      var on = spans.findIndex(function (s) { return s.classList.contains('is-on'); });
      var next = (on + 1) % spans.length;
      spans[on].classList.remove('is-on');
      spans[on].classList.add('is-out');
      spans[next].classList.remove('is-out');
      spans[next].classList.add('is-on');
      setTimeout(function () { spans[on].classList.remove('is-out'); }, 900);
      t++;
    }, 1600);
  }

  /* ------------------------------------------------------------------
   * Proof slider (desktop: active slide grows to 52%, loop)
   * ------------------------------------------------------------------ */
  var slider = $('[data-slider]');
  if (slider) {
    var track = $('.slider__track', slider);
    var slides = $$('.slide', track);
    var bulletsWrap = $('.slider__bullets', slider);
    var order = slides.slice();
    var active = 0;
    var busy = false;

    var bullets = slides.map(function (s, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-label', T.slide + (i + 1));
      b.addEventListener('click', function () { goTo(i); });
      bulletsWrap.appendChild(b);
      return b;
    });
    var syncBullets = function () { bullets.forEach(function (b, i) { b.setAttribute('aria-selected', String(i === active)); }); };

    var goTo = function (index) {
      if (busy || index === active) return;
      if (!desktopMq.matches) {
        active = index;
        syncBullets();
        track.scrollTo({ left: slides[index].offsetLeft - track.offsetLeft - 16, behavior: 'smooth' });
        return;
      }
      busy = true;
      var currentEl = slides[active];
      var content = $('.slide__content', currentEl);
      content.classList.remove('is-showing');
      content.classList.add('is-fading');
      setTimeout(function () {
        currentEl.classList.remove('is-active');
        // rotate DOM so the target slide comes first (seamless loop)
        var k = order.indexOf(slides[index]);
        order = order.slice(k).concat(order.slice(0, k));
        order.forEach(function (s) { track.appendChild(s); });
        content.classList.remove('is-fading');
        active = index;
        var next = slides[index];
        next.classList.add('is-active');
        var nc = $('.slide__content', next);
        nc.classList.add('is-fading');
        requestAnimationFrame(function () { requestAnimationFrame(function () {
          nc.classList.remove('is-fading');
          nc.classList.add('is-showing');
        }); });
        syncBullets();
        setTimeout(function () { busy = false; }, 500);
      }, 300);
    };

    // The blue glow follows the pointer on each card.
    slides.forEach(function (s) {
      s.addEventListener('pointermove', function (e) {
        var r = s.getBoundingClientRect();
        s.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        s.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
    slides.forEach(function (s, i) {
      s.addEventListener('click', function () { if (!s.classList.contains('is-active')) goTo(i); });
    });
    slider.setAttribute('tabindex', '0');
    slider.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') goTo((active + 1) % slides.length);
      if (e.key === 'ArrowLeft') goTo((active + slides.length - 1) % slides.length);
    });
    // swipe / trackpad on desktop
    var wheelLock = false;
    slider.addEventListener('wheel', function (e) {
      if (!desktopMq.matches || Math.abs(e.deltaX) < Math.abs(e.deltaY) || Math.abs(e.deltaX) < 20 || wheelLock) return;
      e.preventDefault();
      wheelLock = true;
      goTo((active + (e.deltaX > 0 ? 1 : slides.length - 1)) % slides.length);
      setTimeout(function () { wheelLock = false; }, 700);
    }, { passive: false });
    // mobile: sync bullets with native scroll
    track.addEventListener('scroll', function () {
      if (desktopMq.matches) return;
      var center = track.scrollLeft + track.clientWidth / 2;
      var best = 0, bestD = Infinity;
      slides.forEach(function (s, i) {
        var d = Math.abs(s.offsetLeft - track.offsetLeft + s.offsetWidth / 2 - center);
        if (d < bestD) { bestD = d; best = i; }
      });
      if (best !== active) { active = best; syncBullets(); }
    }, { passive: true });
    syncBullets();
  }

  /* ------------------------------------------------------------------
   * Integrations marquee
   * ------------------------------------------------------------------ */
  var B = window.STANZA_BRANDS || {};
  var rows = {
    row1: ['google:Google Workspace', 'shopify', 'webflow', 'wordpress', 'cloudflare', '#Axeptio', 'mailchimp:Mailchimp', 'hubspot', '#Make', 'stripe', 'googletagmanager:Tag Manager', '#Slack'],
    row2: ['gmail', '#Microsoft 365', 'brevo', '#Cookiebot', 'zoho:Zoho Mail', '#Zapier', 'godaddy:GoDaddy', 'ovh:OVHcloud', '#Didomi', 'googleanalytics:Analytics', '#WhatsApp', 'squarespace', 'gandi', 'meta']
  };
  var itemHtml = function (spec) {
    if (spec.charAt(0) === '#') {
      return '<div class="int-item int-item--text"><span>' + spec.slice(1) + '</span></div>';
    }
    var parts = spec.split(':');
    var b = B[parts[0]];
    if (!b) return '';
    var label = parts[1] || b.name;
    return '<div class="int-item" style="--brand:' + b.hex + '"><svg viewBox="0 0 24 24" role="img" aria-label="' + b.name + '"><path d="' + b.path + '"/></svg><span>' + label + '</span></div>';
  };
  $$('[data-marquee]').forEach(function (m) {
    var list = rows[m.getAttribute('data-marquee')] || [];
    var html = list.map(itemHtml).join('');
    m.innerHTML = '<div class="marquee__group">' + html + '</div><div class="marquee__group" aria-hidden="true">' + html + '</div>';
  });

  /* ------------------------------------------------------------------
   * Footer accordions
   * ------------------------------------------------------------------ */
  $$('.footer__drop > button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var li = btn.parentNode;
      var open = !li.classList.contains('is-open');
      li.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
    });
  });

  /* Cookie settings link — reopen your CMP if installed */
  $$('[data-cookie-settings]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      if (window.axeptioSDK && window.axeptioSDK.openCookies) window.axeptioSDK.openCookies();
      else if (window.Cookiebot && window.Cookiebot.renew) window.Cookiebot.renew();
      else if (window.Didomi && window.Didomi.preferences) window.Didomi.preferences.show();
    });
  });

  // Cards with a glow that follows the pointer (service cards on the home page).
  $$('[data-glow]').forEach(function (el) {
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      el.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });

  /* ------------------------------------------------------------------
   * Starfields: CTA (data-stars) and the slow sky behind the hero
   * (data-stars-pace="slow": fewer stars, slower drift and twinkle)
   * ------------------------------------------------------------------ */
  function starfield(canvas) {
    if (!canvas.getContext) return;
    var slow = canvas.getAttribute('data-stars-pace') === 'slow';
    var ctx = canvas.getContext('2d');
    var stars = [];
    var W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    var running = false;
    var resize = function () {
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var count = Math.round(W * H / (slow ? 4200 : 3200));
      stars = [];
      for (var i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * W, y: Math.random() * H,
          r: Math.random() * 1.1 + 0.25,
          a: Math.random() * 0.7 + 0.15,
          s: slow ? Math.random() * 0.006 + 0.0015 : Math.random() * 0.015 + 0.004,
          p: Math.random() * Math.PI * 2,
          v: slow ? Math.random() * 0.018 + 0.004 : Math.random() * 0.06 + 0.01,
          h: slow ? (Math.random() - 0.5) * 0.008 : 0,
          blue: Math.random() < 0.25
        });
      }
    };
    var draw = function () {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        s.p += s.s;
        s.y -= s.v;
        s.x += s.h;
        if (s.y < -2) { s.y = H + 2; s.x = Math.random() * W; }
        if (s.x < -2) s.x = W + 2; else if (s.x > W + 2) s.x = -2;
        var alpha = s.a * (0.55 + 0.45 * Math.sin(s.p));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = s.blue ? 'rgba(124,180,255,' + alpha + ')' : 'rgba(249,250,252,' + alpha + ')';
        ctx.fill();
      }
      if (running) requestAnimationFrame(draw);
    };
    resize();
    // Rebuild only when the canvas itself changes size (fonts loading, layout, rotation).
    var onResize = function () {
      if (canvas.clientWidth === W && canvas.clientHeight === H) return;
      resize();
      if (!running) draw();
    };
    if ('ResizeObserver' in window) new ResizeObserver(onResize).observe(canvas);
    else window.addEventListener('resize', onResize);
    if (reduceMotion || !('IntersectionObserver' in window)) { draw(); return; }
    new IntersectionObserver(function (en) {
      var was = running;
      running = en[0].isIntersecting;
      if (running && !was) requestAnimationFrame(draw);
    }).observe(canvas);
  }
  $$('[data-stars]').forEach(starfield);
})();
