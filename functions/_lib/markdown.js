// Small, safe Markdown renderer for the journal articles written in the portal.
// The whole text is HTML-escaped first, so nothing typed in an article can become markup
// of its own; only the syntax below is turned into HTML:
//   # / ## / ### headings (the shallowest level used becomes <h2>: the page title is the <h1>)
//   paragraphs, - * + bullet lists, 1. numbered lists, > blockquotes, ``` fenced code blocks, ---
//   **bold**, *italic*, `inline code`, [links](https://…) (http, https and mailto only)

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Placeholders for already-rendered inline HTML (code spans, links): \u0000 never survives
// the input clean-up, so the text can't fake one.
const HOLD = '\u0000';

export function inline(text) {
  const held = [];
  const hold = (html) => `${HOLD}${held.push(html) - 1}${HOLD}`;
  let s = String(text).replace(/\u0000/g, '')
    .replace(/`([^`\n]+)`/g, (_, code) => hold(`<code>${code}</code>`))
    // Images : https uniquement (les autres adresses restent du texte).
    .replace(/!\[([^\]\n]*)\]\((https:\/\/[^\s()]+)\)/g, (_, alt, src) => hold(`<img src="${src}" alt="${alt}" loading="lazy" decoding="async">`))
    .replace(/\[([^\]\n]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/g, (_, label, href) => { // one level of (…) in URLs
      // The text is already escaped: &amp; in a URL is the correct attribute value.
      const url = href.replace(/&amp;/g, '&');
      if (/^https?:\/\/[^\s/]/i.test(url)) return hold(`<a href="${href}" rel="noopener" target="_blank">${emphasis(label)}</a>`);
      if (/^mailto:[^\s]/i.test(url)) return hold(`<a href="${href}" rel="noopener">${emphasis(label)}</a>`);
      return emphasis(label); // javascript:, data:, relative… → plain text
    });
  s = emphasis(s);
  // A link can hold a code span: restore until nothing is left (each pass goes one level down).
  const re = new RegExp(`${HOLD}(\\d+)${HOLD}`, 'g');
  while (s.includes(HOLD)) s = s.replace(re, (_, i) => held[+i]);
  return s;
}

function emphasis(s) {
  return s
    .replace(/\*\*(?=\S)([^\n]*?\S)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*(?=[^\s*])([^*\n]*?[^\s*])\*(?![*\w])/g, '$1<em>$2</em>');
}

const HEADING = /^(#{1,3})\s+(.+?)\s*#*\s*$/;
const BULLET = /^\s{0,3}[-*+]\s+(.*)$/;
const NUMBER = /^\s{0,3}(\d{1,9})[.)]\s+(.*)$/;
const QUOTE = /^\s{0,3}&gt;\s?(.*)$/;
const FENCE = /^\s{0,3}```\s*([\w+-]*)\s*$/;
const RULE = /^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/;

export function renderMarkdown(source) {
  const lines = escapeHtml(String(source || '').replace(/\u0000/g, '').replace(/\r\n?/g, '\n')).split('\n');
  const levels = lines.map((l) => (HEADING.exec(l) || [])[1]).filter(Boolean).map((h) => h.length);
  const shift = 2 - (levels.length ? Math.min(...levels) : 1); // shallowest heading → h2
  const out = [];
  let i = 0;

  const isBlockStart = (l) => HEADING.test(l) || BULLET.test(l) || NUMBER.test(l) || QUOTE.test(l) || FENCE.test(l) || RULE.test(l);

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    const fence = FENCE.exec(line);
    if (fence) {
      const code = [];
      i++;
      while (i < lines.length && !FENCE.test(lines[i])) code.push(lines[i++]);
      i++; // closing fence (or end of text)
      const lang = fence[1] ? ` class="language-${fence[1].toLowerCase()}"` : '';
      out.push(`<pre><code${lang}>${code.join('\n')}</code></pre>`);
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      const level = Math.min(heading[1].length + shift, 4);
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    if (RULE.test(line)) { out.push('<hr>'); i++; continue; }

    if (QUOTE.test(line)) {
      const paras = [[]];
      while (i < lines.length && QUOTE.test(lines[i])) {
        const text = QUOTE.exec(lines[i])[1];
        if (text.trim()) paras[paras.length - 1].push(text.trim());
        else if (paras[paras.length - 1].length) paras.push([]);
        i++;
      }
      out.push(`<blockquote>${paras.filter((p) => p.length).map((p) => `<p>${inline(p.join(' '))}</p>`).join('')}</blockquote>`);
      continue;
    }

    const listType = BULLET.test(line) ? 'ul' : NUMBER.test(line) ? 'ol' : null;
    if (listType) {
      const re = listType === 'ul' ? BULLET : NUMBER;
      const items = [];
      const start = listType === 'ol' ? Number(NUMBER.exec(line)[1]) : 1;
      while (i < lines.length) {
        const m = re.exec(lines[i]);
        if (m) { items.push([listType === 'ul' ? m[1] : m[2]]); i++; continue; }
        // A non-empty, indented or plain line right after an item continues it.
        if (lines[i].trim() && items.length && !isBlockStart(lines[i])) { items[items.length - 1].push(lines[i].trim()); i++; continue; }
        break;
      }
      // The numbers are drawn in CSS (counter "jr"): a list that doesn't start at 1 resets it.
      const attr = listType === 'ol' && start !== 1 ? ` start="${start}" style="counter-reset: jr ${start - 1}"` : '';
      out.push(`<${listType}${attr}>${items.map((t) => `<li>${inline(t.join(' '))}</li>`).join('')}</${listType}>`);
      continue;
    }

    const para = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) para.push(lines[i++].trim());
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return out.join('\n');
}

/** Plain text of a Markdown string (search, descriptions, reading time). */
export function plainText(source) {
  return String(source || '')
    .replace(/```[\s\S]*?(```|$)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*`_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
