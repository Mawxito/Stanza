/* Stanza — journal: filters without reloading, card motion, reading progress (vanilla JS, no dependencies)
 * The list is rendered server side (functions/_lib/journal.js) with every article in the page;
 * this script filters and sorts those cards with the same rules as the server, and keeps the
 * filters in the URL (shareable links, Back button). Without JavaScript, the form still works. */
(function () {
  'use strict';

  var doc = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var EASE = 'cubic-bezier(0.215, 0.61, 0.355, 1)';

  var FR = doc.lang === 'fr';
  var T = FR
    ? {
      count: function (n, total) { return n === total ? n + ' article' + (n > 1 ? 's' : '') : n ? n + ' article' + (n > 1 ? 's' : '') + ' sur ' + total : 'Aucun article'; },
      remove: function (l) { return 'Retirer le filtre : ' + l; },
      pill: { q: 'Recherche', category: 'Catégorie', tag: 'Mot-clé', author: 'Auteur', language: 'Langue', sort: 'Tri' }
    }
    : {
      count: function (n, total) { return n === total ? n + ' article' + (n > 1 ? 's' : '') : n ? n + ' of ' + total + ' articles' : 'No article'; },
      remove: function (l) { return 'Remove filter: ' + l; },
      pill: { q: 'Search', category: 'Category', tag: 'Tag', author: 'Author', language: 'Language', sort: 'Sort' }
    };

  /* ------------------------------------------------------------------
   * Reading progress (article pages)
   * ------------------------------------------------------------------ */
  var progress = $('[data-jr-progress]');
  var article = $('[data-jr-article]');
  if (progress && article) {
    var pending = false;
    var measure = function () {
      pending = false;
      var r = article.getBoundingClientRect();
      var total = r.height - window.innerHeight;
      var p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 1;
      progress.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    };
    var onScroll = function () { if (!pending) { pending = true; requestAnimationFrame(measure); } };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    measure();
  }

  /* ------------------------------------------------------------------
   * Filters (list page)
   * ------------------------------------------------------------------ */
  var form = $('[data-jr-form]');
  var grid = $('[data-jr-slot="list"]');
  if (!form || !grid) return;

  var cards = $$('[data-jr-card]', grid);
  var countEl = $('[data-jr-slot="count"]');
  var activeEl = $('[data-jr-slot="active"]');
  var empty = $('[data-jr-empty]');
  var barReset = $('.jr-bar [data-jr-reset]');
  var total = cards.length;
  var pageLang = doc.lang === 'fr' ? 'fr' : 'en';

  var fold = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); };
  var clean = function (v, max) { return String(v || '').replace(/["<>]/g, '').trim().slice(0, max); };
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var radios = $$('input[name="category"]', form);
  var boxes = $$('input[name="tag"]', form);
  var hasOption = function (select, value) { return $$('option', select).some(function (o) { return o.value === value; }); };

  var uniqueTags = function (list) {
    var out = [];
    list.forEach(function (t) {
      t = clean(t, 40);
      if (t && !out.some(function (x) { return fold(x) === fold(t); })) out.push(t);
    });
    return out.slice(0, 12);
  };

  function fromParams(search) {
    var p = new URLSearchParams(search);
    var category = p.get('category') || '';
    var author = p.get('author') || '';
    var language = p.get('language');
    return {
      q: clean(p.get('q'), 80),
      category: radios.some(function (r) { return r.value === category; }) ? category : '',
      tags: uniqueTags(p.getAll('tag')),
      author: hasOption(form.author, author) ? author : '',
      language: language === 'fr' || language === 'en' ? language : '',
      sort: p.get('sort') === 'oldest' ? 'oldest' : 'newest'
    };
  }

  function fromForm() {
    var checked = radios.filter(function (r) { return r.checked; })[0];
    return {
      q: clean(form.q.value, 80),
      category: checked ? checked.value : '',
      tags: uniqueTags(boxes.filter(function (b) { return b.checked; }).map(function (b) { return b.value; })),
      author: form.author.value,
      language: form.language.value,
      sort: form.sort.value === 'oldest' ? 'oldest' : 'newest'
    };
  }

  function toForm(s) {
    form.q.value = s.q;
    radios.forEach(function (r) { r.checked = r.value === s.category; });
    var tags = s.tags.map(fold);
    boxes.forEach(function (b) { b.checked = tags.indexOf(fold(b.value)) !== -1; });
    form.author.value = s.author;
    form.language.value = s.language;
    form.sort.value = s.sort;
  }

  // Same order and names as filtersQuery() in functions/_lib/journal.js.
  function query(s, extra) {
    var p = new URLSearchParams();
    if (s.q) p.set('q', s.q);
    if (s.category) p.set('category', s.category);
    s.tags.forEach(function (t) { p.append('tag', t); });
    if (s.author) p.set('author', s.author);
    if (s.language) p.set('language', s.language);
    if (s.sort === 'oldest') p.set('sort', 'oldest');
    Object.keys(extra || {}).forEach(function (k) { p.set(k, extra[k]); });
    var str = p.toString();
    return str ? '?' + str : '';
  }

  function matches(card, s) {
    var d = card.dataset;
    if (s.category && d.category !== s.category) return false;
    if (s.author && d.author !== s.author) return false;
    if (s.language && d.lang !== s.language) return false;
    if (s.tags.length) {
      var own = (d.tags || '').split('|');
      if (!s.tags.some(function (t) { return own.indexOf(fold(t)) !== -1; })) return false;
    }
    if (s.q) {
      var text = d.text || '';
      if (!fold(s.q).split(/\s+/).filter(Boolean).every(function (w) { return text.indexOf(w) !== -1; })) return false;
    }
    return true;
  }

  // The page language first (unless a language is chosen), then by date.
  function compare(s) {
    var dir = s.sort === 'oldest' ? 1 : -1;
    return function (a, b) {
      if (!s.language && a.dataset.lang !== b.dataset.lang) return a.dataset.lang === pageLang ? -1 : b.dataset.lang === pageLang ? 1 : 0;
      return dir * (Number(a.dataset.date) - Number(b.dataset.date));
    };
  }

  var isFiltered = function (s) { return Boolean(s.q || s.category || s.tags.length || s.author || s.language || s.sort === 'oldest'); };
  var without = function (s, patch) { var o = {}; Object.keys(s).forEach(function (k) { o[k] = s[k]; }); Object.keys(patch).forEach(function (k) { o[k] = patch[k]; }); return o; };
  var optionText = function (select, value) {
    var o = $$('option', select).filter(function (x) { return x.value === value; })[0];
    return o ? o.textContent.split(' · ')[0] : value;
  };

  // Active filters as removable pills; only the new ones animate in.
  function renderPills(s) {
    if (!activeEl) return;
    var list = [];
    var add = function (kind, value, label, rest) { list.push({ key: kind + ':' + fold(value), kind: kind, label: label, href: '/journal' + query(rest) }); };
    if (s.q) add('q', s.q, '“' + s.q + '”', without(s, { q: '' }));
    if (s.category) {
      var radio = radios.filter(function (r) { return r.value === s.category; })[0];
      var lab = radio && $('.jr-chip__label', radio.parentNode);
      add('category', s.category, lab ? lab.textContent : s.category, without(s, { category: '' }));
    }
    s.tags.forEach(function (t) { add('tag', t, '#' + t, without(s, { tags: s.tags.filter(function (x) { return x !== t; }) })); });
    if (s.author) add('author', s.author, optionText(form.author, s.author), without(s, { author: '' }));
    if (s.language) add('language', s.language, optionText(form.language, s.language), without(s, { language: '' }));
    if (s.sort === 'oldest') add('sort', 'oldest', optionText(form.sort, 'oldest'), without(s, { sort: 'newest' }));

    var before = {};
    $$('li[data-key]', activeEl).forEach(function (li) { before[li.getAttribute('data-key')] = true; });
    activeEl.innerHTML = list.map(function (p) {
      return '<li data-key="' + esc(p.key) + '"' + (before[p.key] ? ' class="is-static"' : '') + '><a class="jr-pill" href="' + esc(p.href) + '" aria-label="' + esc(T.remove(p.label)) + '">'
        + '<small>' + T.pill[p.kind] + '</small><span>' + esc(p.label) + '</span>'
        + '<svg width="14" height="14" aria-hidden="true"><use href="#i-x"/></svg></a></li>';
    }).join('');
  }

  var settled = false;
  function apply(s, history) {
    // The cards' entrance (CSS) is over once the visitor filters: from now on, script motion only.
    if (!settled) { settled = true; cards.forEach(function (c) { c.classList.add('is-settled'); }); }
    var animate = !reduceMotion && typeof Element.prototype.animate === 'function';
    var before = new Map();
    if (animate) cards.forEach(function (c) { if (!c.hidden) before.set(c, c.getBoundingClientRect()); });

    var shown = cards.filter(function (c) { return matches(c, s); }).sort(compare(s));
    var hiddenCards = cards.filter(function (c) { return shown.indexOf(c) === -1; });
    shown.concat(hiddenCards).forEach(function (c) { grid.appendChild(c); });
    shown.forEach(function (c) { c.hidden = false; });
    hiddenCards.forEach(function (c) { c.hidden = true; });

    // FLIP: cards that stay glide to their new place, new ones rise in one after the other.
    if (animate) {
      var entering = 0;
      shown.forEach(function (c) {
        var first = before.get(c);
        if (first) {
          var last = c.getBoundingClientRect();
          var dx = first.left - last.left;
          var dy = first.top - last.top;
          if (dx || dy) c.animate([{ transform: 'translate(' + dx + 'px, ' + dy + 'px)' }, { transform: 'none' }], { duration: 560, easing: EASE });
        } else {
          c.animate(
            [{ opacity: 0, transform: 'translateY(32px) scale(.97)' }, { opacity: 1, transform: 'none' }],
            { duration: 620, delay: Math.min(entering++, 8) * 70, easing: EASE, fill: 'backwards' }
          );
        }
      });
    }

    if (countEl) countEl.textContent = T.count(shown.length, total);
    if (empty) {
      var wasHidden = empty.hidden;
      empty.hidden = shown.length > 0;
      if (wasHidden && !empty.hidden) { empty.classList.remove('is-in'); void empty.offsetWidth; empty.classList.add('is-in'); }
    }
    if (barReset) barReset.hidden = !isFiltered(s);
    renderPills(s);

    // URL: shareable, and the Back button returns to the previous filters.
    var keep = new URLSearchParams(location.search).get('lang');
    var url = '/journal' + query(s, keep === 'fr' || keep === 'en' ? { lang: keep } : null);
    if (history === 'push' && url !== location.pathname + location.search) window.history.pushState({ jr: 1 }, '', url);
    else if (history === 'replace') window.history.replaceState({ jr: 1 }, '', url);
    // The EN / FR switch keeps the filters.
    $$('a[data-lang]').forEach(function (a) { a.setAttribute('href', query(s, { lang: a.getAttribute('data-lang') })); });
  }

  // Chips and selects: one history entry per change. Typing: one entry per search, updated as you type.
  var typingTimer;
  var typing = false;
  form.addEventListener('change', function (e) {
    if (e.target === form.q) return;
    typing = false;
    apply(fromForm(), 'push');
  });
  form.q.addEventListener('input', function () {
    clearTimeout(typingTimer);
    typingTimer = setTimeout(function () {
      apply(fromForm(), typing ? 'replace' : 'push');
      typing = true;
    }, 200);
  });
  form.q.addEventListener('blur', function () { typing = false; });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearTimeout(typingTimer);
    apply(fromForm(), typing ? 'replace' : 'push');
    typing = false;
  });

  // Filter links (tags on the cards, pills, reset): no reload.
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || !a.closest('.jr-catalog')) return;
    var href = a.getAttribute('href');
    if (!/^\/journal(\?|$)/.test(href)) return;
    e.preventDefault();
    var s = fromParams(href.replace(/^\/journal/, ''));
    toForm(s);
    typing = false;
    apply(s, 'push');
    if (a.closest('.jr-card')) form.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  });

  window.addEventListener('popstate', function () {
    var s = fromParams(location.search);
    toForm(s);
    apply(s, 'none');
  });
})();
