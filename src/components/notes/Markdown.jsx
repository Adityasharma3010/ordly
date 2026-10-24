import { Fragment, memo, useMemo } from "react";
import { parseMarkdown } from "../../utils/markdown";

// Draws a note. The text is turned into a tree of plain data (utils/markdown.js) and every
// piece becomes a React element: no HTML from the note is ever inserted into the page, so a
// note can't run code. Links open in a new tab and tell search engines not to trust them.
function Inline({ nodes }) {
  return nodes.map((n, i) => {
    switch (n.t) {
      case "text":
        return <Fragment key={i}>{n.v}</Fragment>;
      case "br":
        return <br key={i} />;
      case "b":
        return (
          <strong key={i} className="font-semibold text-fg">
            <Inline nodes={n.c} />
          </strong>
        );
      case "i":
        return (
          <em key={i}>
            <Inline nodes={n.c} />
          </em>
        );
      case "s":
        return (
          <del key={i}>
            <Inline nodes={n.c} />
          </del>
        );
      case "code":
        return <code key={i}>{n.v}</code>;
      case "a":
        return (
          <a
            key={i}
            href={n.href}
            target="_blank"
            rel="noopener noreferrer nofollow ugc"
          >
            <Inline nodes={n.c} />
          </a>
        );
      default:
        return null;
    }
  });
}

function Blocks({ blocks }) {
  return blocks.map((b, i) => {
    switch (b.t) {
      case "p":
        return (
          <p key={i}>
            <Inline nodes={b.c} />
          </p>
        );
      case "h": {
        const Tag = `h${b.level}`;
        return (
          <Tag key={i}>
            <Inline nodes={b.c} />
          </Tag>
        );
      }
      case "quote":
        return (
          <blockquote key={i}>
            <Blocks blocks={b.c} />
          </blockquote>
        );
      case "code":
        return (
          <pre key={i}>
            <code>{b.v}</code>
          </pre>
        );
      case "hr":
        return <hr key={i} />;
      case "list": {
        const Tag = b.ordered ? "ol" : "ul";
        return (
          <Tag key={i} start={b.ordered && b.start !== 1 ? b.start : undefined}>
            {b.items.map((item, k) => (
              <li key={k}>
                <Blocks blocks={item} />
              </li>
            ))}
          </Tag>
        );
      }
      default:
        return null;
    }
  });
}

export const Markdown = memo(function Markdown({ text, className = "" }) {
  const blocks = useMemo(() => parseMarkdown(text), [text]);
  return (
    <div className={`notes-md ${className}`}>
      <Blocks blocks={blocks} />
    </div>
  );
});
