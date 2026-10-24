// A small, safe Markdown reader for item notes. It turns text into a tree of plain data
// (never HTML), and the screen draws that tree with React elements, so nothing a note
// contains can run as code or inject markup: `<script>` and `<img onerror=…>` just show up
// as text, and only web (http/https) and mail (mailto) links are ever made clickable.
//
// Supported: paragraphs (a new line is a line break), **bold**, *italic*, ~~strike~~, `code`,
// [links](https://…) and bare web addresses, bullet and numbered lists (nested), > quotes,
// ``` code blocks, # headings and --- lines. Anything else is shown as typed.

const MAX_CHARS = 20_000; // longer text is cut (the database keeps notes under 10,000)
const MAX_DEPTH = 20; // how deep quotes and lists may nest

// ---------------------------------------------------------------- links

// A web address we are willing to link to, or null. Adds https:// to "example.com/page".
export function safeHref(raw) {
  const url = String(raw ?? "").trim();
  // eslint-disable-next-line no-control-regex
  if (!url || /[\u0000-\u0020\u007f<>"]/.test(url)) return null;
  if (/^(https?:\/\/|mailto:)[^/\s]/i.test(url)) return url;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return null; // javascript:, data:, tel:, …
  if (/^[\w-]+(\.[\w-]+)+([/:?#].*)?$/i.test(url)) return `https://${url}`;
  return null;
}

// ---------------------------------------------------------------- inline

const PUNCT = /[!-/:-@[-`{-~]/;
const isSpace = (c) => c === undefined || /\s/.test(c);
const isWord = (c) => c !== undefined && /[\p{L}\p{N}]/u.test(c);

// Finds the `]` that closes the `[` at `open`, skipping escapes and nested brackets.
function closingBracket(s, open) {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === "\\") i++;
    else if (s[i] === "[") depth++;
    else if (s[i] === "]" && --depth === 0) return i;
    else if (s[i] === "`") {
      const run = /^`+/.exec(s.slice(i))[0];
      const end = s.indexOf(run, i + run.length);
      if (end !== -1) i = end + run.length - 1;
    }
  }
  return -1;
}

// Reads "(url)" or '(url "title")' starting at the "(" at `open`.
function linkTarget(s, open) {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === "\\") i++;
    else if (s[i] === "(") depth++;
    else if (s[i] === ")" && --depth === 0) {
      const inner = s
        .slice(open + 1, i)
        .trim()
        .replace(/\s+("[^"]*"|'[^']*')$/, "");
      return { url: inner.replace(/^<(.*)>$/, "$1"), end: i };
    } else if (s[i] === "\n") return null;
  }
  return null;
}

// Finds where the emphasis that opened with `mark` ends, or -1.
function findCloser(s, from, mark) {
  for (let i = from; i < s.length; i++) {
    const c = s[i];
    if (c === "\\") {
      i++;
      continue;
    }
    if (c === "`") {
      const run = /^`+/.exec(s.slice(i))[0];
      const end = s.indexOf(run, i + run.length);
      if (end !== -1) i = end + run.length - 1;
      continue;
    }
    if (!s.startsWith(mark, i)) continue;
    const before = s[i - 1];
    const after = s[i + mark.length];
    if (i === from || isSpace(before)) continue; // a closer can't follow a space
    if (mark[0] === "_" && isWord(after)) continue; // snake_case isn't emphasis
    if (mark.length === 1 && after === mark) {
      i += 1; // skip a doubled mark, it belongs to bold
      continue;
    }
    return i;
  }
  return -1;
}

// `inLink` is true while reading the text of a link, where another link can't start.
export function parseInline(text, depth = 0, inLink = false) {
  const out = [];
  let buf = "";
  const flush = () => {
    if (buf) out.push({ t: "text", v: buf });
    buf = "";
  };
  const s = text;
  let i = 0;
  while (i < s.length) {
    const c = s[i];

    if (c === "\\" && i + 1 < s.length) {
      if (PUNCT.test(s[i + 1])) {
        buf += s[i + 1];
        i += 2;
        continue;
      }
      if (s[i + 1] === "\n") {
        flush();
        out.push({ t: "br" });
        i += 2;
        continue;
      }
    }

    if (c === "\n") {
      buf = buf.replace(/ +$/, "");
      flush();
      out.push({ t: "br" });
      i += 1;
      while (s[i] === " ") i++;
      continue;
    }

    if (c === "`") {
      const run = /^`+/.exec(s.slice(i))[0];
      const end = s.indexOf(run, i + run.length);
      if (end !== -1) {
        flush();
        let code = s.slice(i + run.length, end).replace(/\n/g, " ");
        if (/^ .* $/.test(code) && code.trim()) code = code.slice(1, -1);
        out.push({ t: "code", v: code });
        i = end + run.length;
        continue;
      }
      buf += run;
      i += run.length;
      continue;
    }

    if (c === "[" && depth < MAX_DEPTH && !inLink) {
      const close = closingBracket(s, i);
      if (close !== -1 && s[close + 1] === "(") {
        const target = linkTarget(s, close + 1);
        const href = target && safeHref(target.url);
        if (href) {
          flush();
          out.push({
            t: "a",
            href,
            c: parseInline(s.slice(i + 1, close), depth + 1, true),
          });
          i = target.end + 1;
          continue;
        }
      }
    }

    if (c === "<" && !inLink) {
      const m = /^<((?:https?:\/\/|mailto:)[^\s<>]+)>/i.exec(s.slice(i));
      const href = m && safeHref(m[1]);
      if (href) {
        flush();
        out.push({ t: "a", href, c: [{ t: "text", v: m[1] }] });
        i += m[0].length;
        continue;
      }
    }

    if ((c === "h" || c === "H") && !inLink && !isWord(s[i - 1])) {
      const m = /^https?:\/\/[^\s<]+/i.exec(s.slice(i));
      if (m) {
        let url = m[0];
        // Trailing punctuation belongs to the sentence, not the address.
        for (;;) {
          const last = url[url.length - 1];
          if (/[.,;:!?'"*_~]/.test(last)) url = url.slice(0, -1);
          else if (
            last === ")" &&
            (url.match(/\(/g) || []).length < (url.match(/\)/g) || []).length
          )
            url = url.slice(0, -1);
          else break;
        }
        const href = safeHref(url);
        if (href && url.length > 8) {
          flush();
          out.push({ t: "a", href, c: [{ t: "text", v: url }] });
          i += url.length;
          continue;
        }
      }
    }

    if ((c === "*" || c === "_" || c === "~") && depth < MAX_DEPTH) {
      const run = /^(\*{1,3}|_{1,2}|~~)/.exec(s.slice(i));
      if (run) {
        let mark = run[0];
        // `***both***`
        if (mark === "***" && s.indexOf("***", i + 3) > i + 3) {
          const end = findCloser(s, i + 3, "***");
          if (end !== -1 && !isSpace(s[i + 3])) {
            flush();
            out.push({
              t: "b",
              c: [
                {
                  t: "i",
                  c: parseInline(s.slice(i + 3, end), depth + 1, inLink),
                },
              ],
            });
            i = end + 3;
            continue;
          }
        }
        if (mark === "***") mark = "**";
        if (mark === "~") mark = "";
        const canOpen =
          mark &&
          !isSpace(s[i + mark.length]) &&
          !(mark[0] === "_" && isWord(s[i - 1]));
        const end = canOpen ? findCloser(s, i + mark.length, mark) : -1;
        if (end !== -1) {
          flush();
          const kind = { "**": "b", __: "b", "*": "i", _: "i", "~~": "s" }[
            mark
          ];
          out.push({
            t: kind,
            c: parseInline(s.slice(i + mark.length, end), depth + 1, inLink),
          });
          i = end + mark.length;
          continue;
        }
        buf += run[0];
        i += run[0].length;
        continue;
      }
    }

    buf += c;
    i += 1;
  }
  flush();
  return out;
}

// ---------------------------------------------------------------- blocks

const FENCE = /^ {0,3}(```+|~~~+)\s*([\w+#.-]*)\s*$/;
const HEADING = /^ {0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/;
const RULE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const QUOTE = /^ {0,3}>[ ]?(.*)$/;
const ITEM = /^( *)([-*+]|\d{1,9}[.)])[ \t]+(.*)$/;
const startsBlock = (line) =>
  FENCE.test(line) ||
  HEADING.test(line) ||
  RULE.test(line) ||
  QUOTE.test(line) ||
  ITEM.test(line);
const indentOf = (line) => /^ */.exec(line)[0].length;

function parseList(lines, from, depth) {
  const first = ITEM.exec(lines[from]);
  const base = first[1].length;
  const ordered = /\d/.test(first[2]);
  const list = {
    t: "list",
    ordered,
    start: ordered ? parseInt(first[2], 10) : 1,
    items: [],
  };
  let i = from;
  while (i < lines.length) {
    const m = ITEM.exec(lines[i]);
    if (!m || m[1].length > base + 1 || /\d/.test(m[2]) !== ordered) break;
    const content = [m[3]];
    i += 1;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) {
        // A blank line only continues the item if indented text follows.
        let k = i;
        while (k < lines.length && !lines[k].trim()) k++;
        if (k < lines.length && indentOf(lines[k]) >= base + 2) {
          content.push("");
          i += 1;
          continue;
        }
        break;
      }
      const ind = indentOf(line);
      if (ind >= base + 2) {
        content.push(line.slice(base + 2 > ind ? ind : base + 2));
        i += 1;
      } else if (!startsBlock(line) && content[content.length - 1] !== "") {
        content.push(line.trim()); // a wrapped line of the same item
        i += 1;
      } else break;
    }
    list.items.push(parseBlocks(content, depth + 1));
    // Skip blank lines between items of the same list.
    let k = i;
    while (k < lines.length && !lines[k].trim()) k++;
    const next = k < lines.length && ITEM.exec(lines[k]);
    if (next && next[1].length <= base + 1 && /\d/.test(next[2]) === ordered)
      i = k;
  }
  return { list, next: i };
}

function parseBlocks(lines, depth = 0) {
  const blocks = [];
  if (depth > MAX_DEPTH) {
    const text = lines.join("\n").trim();
    return text ? [{ t: "p", c: [{ t: "text", v: text }] }] : [];
  }
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }

    let m = FENCE.exec(line);
    if (m) {
      const body = [];
      i += 1;
      while (
        i < lines.length &&
        !new RegExp(`^ {0,3}${m[1][0]}{${m[1].length},}\\s*$`).test(lines[i])
      ) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1; // the closing fence (or the end of the text)
      blocks.push({ t: "code", lang: m[2], v: body.join("\n") });
      continue;
    }

    m = HEADING.exec(line);
    if (m) {
      blocks.push({
        t: "h",
        level: Math.min(m[1].length, 3),
        c: parseInline(m[2]),
      });
      i += 1;
      continue;
    }

    if (RULE.test(line)) {
      blocks.push({ t: "hr" });
      i += 1;
      continue;
    }

    if (QUOTE.test(line)) {
      const inner = [];
      while (i < lines.length && QUOTE.test(lines[i])) {
        inner.push(QUOTE.exec(lines[i])[1]);
        i += 1;
      }
      blocks.push({ t: "quote", c: parseBlocks(inner, depth + 1) });
      continue;
    }

    if (ITEM.test(line)) {
      const { list, next } = parseList(lines, i, depth);
      blocks.push(list);
      i = next;
      continue;
    }

    const para = [line.trim()];
    i += 1;
    while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) {
      para.push(lines[i].trim());
      i += 1;
    }
    blocks.push({ t: "p", c: parseInline(para.join("\n")) });
  }
  return blocks;
}

export function parseMarkdown(text) {
  const src = String(text ?? "")
    .slice(0, MAX_CHARS)
    .replace(/\r\n?/g, "\n");
  return parseBlocks(src.split("\n"));
}
