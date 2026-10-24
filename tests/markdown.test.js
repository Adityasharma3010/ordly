import { describe, expect, it } from "vitest";
import { parseInline, parseMarkdown, safeHref } from "../src/utils/markdown";
import {
  continueList,
  insertLink,
  toggleLinePrefix,
  wrapSelection,
} from "../src/utils/mdEdit";

// A compact way to look at a parsed note: p(…) b(…) i(…) a[url](…) and so on.
const show = (nodes) =>
  nodes
    .map((n) => {
      const kids =
        (n.c ? show(n.c) : n.items?.map((it) => `<${show(it)}>`).join("")) ??
        "";
      switch (n.t) {
        case "text":
          return n.v;
        case "br":
          return "⏎";
        case "code":
          return `code(${n.v})`;
        case "a":
          return `a[${n.href}](${kids})`;
        case "list":
          return `${n.ordered ? "ol" : "ul"}{${kids}}`;
        case "h":
          return `h${n.level}(${kids})`;
        case "hr":
          return "hr";
        default:
          return `${n.t}(${n.t === "code" ? n.v : kids})`;
      }
    })
    .join("");

describe("web addresses", () => {
  it("only lets safe addresses through", () => {
    expect(safeHref("https://a.com/x?y=1")).toBe("https://a.com/x?y=1");
    expect(safeHref("  http://a.com ")).toBe("http://a.com");
    expect(safeHref("mailto:a@b.co")).toBe("mailto:a@b.co");
    expect(safeHref("example.com/page")).toBe("https://example.com/page");
    for (const bad of [
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      "java\nscript:alert(1)",
      "data:text/html,hi",
      "vbscript:x",
      "tel:123",
      "//evil.com",
      'https://a.com/"onmouseover=',
      "https:// a.com",
      "",
      null,
    ])
      expect(safeHref(bad)).toBeNull();
  });
});

describe("reading Markdown", () => {
  it("handles the everyday marks", () => {
    expect(show(parseMarkdown("a **b** *c* ~~d~~ `e`"))).toBe(
      "p(a b(b) i(c) s(d) code(e))",
    );
    expect(show(parseMarkdown("***both***"))).toBe("p(b(i(both)))");
    expect(show(parseMarkdown("**a *nested* b**"))).toBe("p(b(a i(nested) b))");
    expect(show(parseMarkdown("__bold__ and _it_"))).toBe(
      "p(b(bold) and i(it))",
    );
  });

  it("a new line is a line break, a blank line starts a paragraph", () => {
    expect(show(parseMarkdown("one\ntwo\n\nthree"))).toBe("p(one⏎two)p(three)");
  });

  it("leaves plain-text look-alikes alone", () => {
    expect(show(parseMarkdown("2 * 3 * 4"))).toBe("p(2 * 3 * 4)");
    expect(show(parseMarkdown("snake_case_name"))).toBe("p(snake_case_name)");
    expect(show(parseMarkdown("unclosed **bold and `code and [link("))).toBe(
      "p(unclosed **bold and `code and [link()",
    );
    expect(show(parseMarkdown("\\*not italic\\*"))).toBe("p(*not italic*)");
  });

  it("makes links from [text](url) and bare web addresses", () => {
    expect(show(parseMarkdown("[hi](https://a.com)"))).toBe(
      "p(a[https://a.com](hi))",
    );
    expect(show(parseMarkdown("see https://a.com/x_y, then"))).toBe(
      "p(see a[https://a.com/x_y](https://a.com/x_y), then)",
    );
    expect(show(parseMarkdown("(https://en.wikipedia.org/wiki/A_(b))"))).toBe(
      "p((a[https://en.wikipedia.org/wiki/A_(b)](https://en.wikipedia.org/wiki/A_(b))))",
    );
    expect(show(parseMarkdown("<https://a.com>"))).toBe(
      "p(a[https://a.com](https://a.com))",
    );
    // A link whose text is itself an address keeps that text (it can't be a link inside a link).
    expect(
      show(parseMarkdown("go [https://a.com/x](https://a.com/x) now")),
    ).toBe("p(go a[https://a.com/x](https://a.com/x) now)");
    expect(show(parseMarkdown("[**bold** link](https://a.com)"))).toBe(
      "p(a[https://a.com](b(bold) link))",
    );
    expect(show(parseMarkdown("[a [b] c](https://a.com)"))).toBe(
      "p(a[https://a.com](a [b] c))",
    );
  });

  it("nothing hostile becomes a link or markup: it is shown as text", () => {
    const evil = [
      "[x](javascript:alert(1))",
      "[x](JAVASCRIPT:alert(1))",
      "[x](data:text/html,<script>alert(1)</script>)",
      "<script>alert(1)</script>",
      "<img src=x onerror=alert(1)>",
      '<a href="javascript:alert(1)">x</a>',
      "![img](https://a.com/x.png)",
    ];
    for (const e of evil) {
      const tree = JSON.stringify(parseMarkdown(e));
      // Only text nodes (and a "!" before a link at most); never an unsafe address.
      expect(tree).not.toMatch(/javascript:[^"]*"?,"c"/i);
      const links = [...tree.matchAll(/"href":"([^"]*)"/g)].map((m) => m[1]);
      for (const href of links) expect(href).toMatch(/^https?:\/\//);
    }
    expect(show(parseMarkdown("<script>alert(1)</script>"))).toBe(
      "p(<script>alert(1)</script>)",
    );
    expect(show(parseMarkdown("[x](javascript:alert(1))"))).toBe(
      "p([x](javascript:alert(1)))",
    );
  });

  it("reads lists, nested lists and numbering", () => {
    expect(show(parseMarkdown("- a\n- b\n  - c\n    - d\n- e"))).toBe(
      "ul{<p(a)><p(b)ul{<p(c)ul{<p(d)>}>}><p(e)>}",
    );
    const [list] = parseMarkdown("3. x\n4. y");
    expect(list).toMatchObject({ ordered: true, start: 3 });
    expect(show(parseMarkdown("- a\n\n- b"))).toBe("ul{<p(a)><p(b)>}");
    expect(show(parseMarkdown("- a\nwrapped\n- b"))).toBe(
      "ul{<p(a⏎wrapped)><p(b)>}",
    );
    expect(show(parseMarkdown("- a\n1. b"))).toBe("ul{<p(a)>}ol{<p(b)>}");
    expect(show(parseMarkdown("intro\n- a\n- b"))).toBe(
      "p(intro)ul{<p(a)><p(b)>}",
    );
  });

  it("reads quotes, code blocks, headings and rules", () => {
    expect(show(parseMarkdown("> a\n> b\n\nafter"))).toBe(
      "quote(p(a⏎b))p(after)",
    );
    expect(
      show(parseMarkdown("```js\nlet a = 1 * 2;\n  - not a list\n```\nx")),
    ).toBe("code(let a = 1 * 2;\n  - not a list)p(x)");
    expect(show(parseMarkdown("```\nnever closed\nstill code"))).toBe(
      "code(never closed\nstill code)",
    );
    expect(show(parseMarkdown("# One\n## Two\n#### Four"))).toBe(
      "h1(One)h2(Two)h3(Four)",
    );
    expect(show(parseMarkdown("####### seven"))).toBe("p(####### seven)");
    expect(show(parseMarkdown("a\n\n---\n\nb"))).toBe("p(a)hrp(b)");
  });

  it("survives nonsense and extremes", () => {
    expect(parseMarkdown("")).toEqual([]);
    expect(parseMarkdown(null)).toEqual([]);
    expect(parseMarkdown("   \n\n  ")).toEqual([]);
    const deepQuote = ">".repeat(500) + " hi";
    expect(() => parseMarkdown(deepQuote)).not.toThrow();
    const deepList = Array.from(
      { length: 300 },
      (_, i) => " ".repeat(i * 2) + "- x",
    ).join("\n");
    expect(() => parseMarkdown(deepList)).not.toThrow();
    expect(() => parseMarkdown("*".repeat(5000))).not.toThrow();
    expect(() => parseMarkdown("[".repeat(3000))).not.toThrow();
    expect(() => parseMarkdown("`".repeat(3001))).not.toThrow();
    expect(() => parseInline("**a** ".repeat(2000))).not.toThrow();
    // Quadratic-time traps finish quickly.
    const t = Date.now();
    parseMarkdown("*a ".repeat(3000));
    parseMarkdown("[a](".repeat(2000));
    parseMarkdown("_x ".repeat(4000));
    expect(Date.now() - t).toBeLessThan(3000);
  });

  it("keeps old plain-text notes readable", () => {
    const old = "Call Sam at 5pm\nBring the red folder\nPrice: $5 * 3 = $15";
    expect(show(parseMarkdown(old))).toBe(
      "p(Call Sam at 5pm⏎Bring the red folder⏎Price: $5 * 3 = $15)",
    );
  });
});

describe("Markdown box edits", () => {
  it("wraps, unwraps and inserts marks", () => {
    expect(wrapSelection("say hello now", 4, 9, "**")).toEqual({
      value: "say **hello** now",
      start: 6,
      end: 11,
    });
    // selection just inside the marks -> unwrap
    expect(wrapSelection("say **hello** now", 6, 11, "**").value).toBe(
      "say hello now",
    );
    // selection includes the marks -> unwrap
    expect(wrapSelection("say **hello** now", 4, 13, "**").value).toBe(
      "say hello now",
    );
    // nothing selected -> placeholder, selected
    expect(wrapSelection("a b", 2, 2, "*")).toEqual({
      value: "a *text*b",
      start: 3,
      end: 7,
    });
    // spaces stay outside the marks
    expect(wrapSelection("a b c", 1, 4, "**").value).toBe("a **b** c");
    // italic inside bold doesn't unwrap the bold
    expect(wrapSelection("**hi**", 2, 4, "*").value).toBe("***hi***");
  });

  it("makes links", () => {
    expect(insertLink("see docs", 4, 8)).toEqual({
      value: "see [docs](address)",
      start: 11,
      end: 18,
    });
    const r = insertLink("go https://a.com now", 3, 16);
    expect(r.value).toBe("go [link text](https://a.com) now");
    expect(r.value.slice(r.start, r.end)).toBe("link text");
    const empty = insertLink("", 0, 0);
    expect(empty.value).toBe("[link text](address)");
  });

  it("toggles bullets, numbers and quotes on the selected lines", () => {
    expect(toggleLinePrefix("a\nb\nc", 0, 5, "ul").value).toBe("- a\n- b\n- c");
    expect(toggleLinePrefix("- a\n- b", 0, 7, "ul").value).toBe("a\nb");
    expect(toggleLinePrefix("a\nb\nc", 0, 5, "ol").value).toBe(
      "1. a\n2. b\n3. c",
    );
    expect(toggleLinePrefix("- a\n- b", 0, 7, "ol").value).toBe("1. a\n2. b");
    expect(toggleLinePrefix("a\nb", 0, 3, "quote").value).toBe("> a\n> b");
    expect(toggleLinePrefix("> a", 0, 3, "quote").value).toBe("a");
    // only the line the cursor is on
    expect(toggleLinePrefix("one\ntwo\nthree", 5, 5, "ul")).toMatchObject({
      value: "one\n- two\nthree",
      start: 7,
    });
    // blank lines in the middle are skipped, numbering continues
    expect(toggleLinePrefix("a\n\nb", 0, 4, "ol").value).toBe("1. a\n\n2. b");
    // a blank line gets a bullet too
    expect(toggleLinePrefix("", 0, 0, "ul").value).toBe("- ");
  });

  it("Enter carries a list on, or ends it", () => {
    expect(continueList("- a", 3)).toEqual({
      value: "- a\n- ",
      start: 6,
      end: 6,
    });
    expect(continueList("1. a", 4)).toEqual({
      value: "1. a\n2. ",
      start: 8,
      end: 8,
    });
    expect(continueList("> q", 3)?.value).toBe("> q\n> ");
    expect(continueList("  - a", 5)?.value).toBe("  - a\n  - ");
    expect(continueList("- a\n- ", 6)).toEqual({
      value: "- a\n",
      start: 4,
      end: 4,
    });
    expect(continueList("plain", 5)).toBeNull();
    expect(continueList("- a b", 3)).toBeNull(); // caret not at the end of the line
  });
});
