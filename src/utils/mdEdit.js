// Text edits for the Markdown notes box (bold, links, lists…). Each function takes the text
// and the selection (start, end) and returns { value, start, end }: the new text and where the
// selection should be afterwards. No screen code in here, so it is easy to test.
import { safeHref } from "./markdown";

const splice = (v, a, b, s) => v.slice(0, a) + s + v.slice(b);

// Wraps the selection in `mark` (**bold**, *italic*…), or takes the marks off if they are
// already there. With nothing selected it inserts the marks around a placeholder word.
export function wrapSelection(value, start, end, mark, placeholder = "text") {
  const sel = value.slice(start, end);
  const n = mark.length;
  const single = n === 1;

  // The selection sits just inside a pair of marks -> unwrap. (A single * next to another
  // * belongs to **bold**, so leave that alone.)
  const outer =
    value.slice(start - n, start) === mark &&
    value.slice(end, end + n) === mark;
  const partOfDouble =
    single && (value[start - 2] === mark || value[end + 1] === mark);
  if (start >= n && outer && !partOfDouble) {
    return {
      value: value.slice(0, start - n) + sel + value.slice(end + n),
      start: start - n,
      end: end - n,
    };
  }
  // The selection includes its own marks -> unwrap.
  if (sel.length > n * 2 && sel.startsWith(mark) && sel.endsWith(mark)) {
    const inner = sel.slice(n, -n);
    return {
      value: splice(value, start, end, inner),
      start,
      end: start + inner.length,
    };
  }

  const core = sel.trim();
  if (!core) {
    const at = start;
    return {
      value: splice(value, at, end, mark + placeholder + mark),
      start: at + n,
      end: at + n + placeholder.length,
    };
  }
  // Keep leading/trailing spaces outside the marks ("** bold**" would not work).
  const lead = sel.length - sel.trimStart().length;
  const text =
    sel.slice(0, lead) + mark + core + mark + sel.slice(lead + core.length);
  return {
    value: splice(value, start, end, text),
    start: start + lead + n,
    end: start + lead + n + core.length,
  };
}

// [text](address). If the selection already looks like a web address it becomes the address
// and "link text" is selected to type over; otherwise the selection becomes the link text and
// "address" is selected.
export function insertLink(value, start, end) {
  const sel = value.slice(start, end);
  if (
    sel &&
    !/\s/.test(sel) &&
    safeHref(sel) &&
    /^(https?:|mailto:)/i.test(sel)
  ) {
    const text = `[link text](${sel})`;
    return {
      value: splice(value, start, end, text),
      start: start + 1,
      end: start + 10,
    };
  }
  const label = sel || "link text";
  const text = `[${label}](address)`;
  const a = start + label.length + 3;
  return { value: splice(value, start, end, text), start: a, end: a + 7 };
}

const PATTERNS = {
  ul: /^(\s*)[-*+] /,
  ol: /^(\s*)\d+[.)] /,
  quote: /^(\s*)> ?/,
};

// Turns the lines the selection touches into a bulleted list ("- "), a numbered list
// ("1. ") or a quote ("> "), or back into plain lines if they already are one.
export function toggleLinePrefix(value, start, end, kind) {
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const tail = end > start && value[end - 1] === "\n" ? end - 1 : end;
  let lineEnd = value.indexOf("\n", tail);
  if (lineEnd === -1) lineEnd = value.length;
  const lines = value.slice(lineStart, lineEnd).split("\n");
  const filled = lines.filter((l) => l.trim());
  const pattern = PATTERNS[kind];
  const allHave = filled.length > 0 && filled.every((l) => pattern.test(l));

  let n = 0;
  const next = lines.map((line) => {
    if (allHave) return line.replace(pattern, "$1");
    if (!line.trim() && lines.length > 1) return line;
    n += 1;
    let body = line;
    if (kind !== "quote")
      body = body.replace(PATTERNS.ul, "$1").replace(PATTERNS.ol, "$1");
    const indent = /^\s*/.exec(body)[0];
    const prefix = kind === "ul" ? "- " : kind === "ol" ? `${n}. ` : "> ";
    return indent + prefix + body.slice(indent.length);
  });
  const block = next.join("\n");
  const delta = block.length - lines.join("\n").length;
  const out = splice(value, lineStart, lineEnd, block);
  if (start === end) {
    const caret = Math.max(lineStart, start + delta);
    return { value: out, start: caret, end: caret };
  }
  return { value: out, start: lineStart, end: lineStart + block.length };
}

// Pressing Enter at the end of a list or quote line: carry on with the next bullet / number /
// "> ", or, on an empty one, end the list. Returns null when it isn't a list line.
export function continueList(value, caret) {
  const lineStart = value.lastIndexOf("\n", caret - 1) + 1;
  let lineEnd = value.indexOf("\n", caret);
  if (lineEnd === -1) lineEnd = value.length;
  if (caret !== lineEnd) return null;
  const line = value.slice(lineStart, lineEnd);
  const m = /^(\s*)([-*+]|\d+[.)]|>)[ \t]+(.*)$/.exec(line);
  if (!m) return null;
  const [, indent, marker, body] = m;
  if (!body.trim()) {
    return {
      value: splice(value, lineStart, lineEnd, ""),
      start: lineStart,
      end: lineStart,
    };
  }
  const nextMarker = /^\d/.test(marker)
    ? `${parseInt(marker, 10) + 1}${marker.slice(-1)}`
    : marker;
  const insert = `\n${indent}${nextMarker} `;
  const at = lineEnd + insert.length;
  return { value: splice(value, lineEnd, lineEnd, insert), start: at, end: at };
}
