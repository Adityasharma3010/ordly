import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { Placeholder } from "@tiptap/extensions";
import { NotesToolbar } from "./NotesToolbar";
import { safeHref } from "../../utils/markdown";

const LIMIT = 10000;

// The rich note editor (loaded on demand). It reads and writes the very same Markdown text
// the other editor does, so you can switch between them at any time. Only the kinds of
// formatting the finished note can show are switched on: bold, italic, strike, code, links,
// lists, quotes, code blocks and three heading sizes.
export default function RichEditor({ value, onChange, autoFocus, extras }) {
  const lastSent = useRef(value); // the text we last handed to the parent
  const [tooLong, setTooLong] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [href, setHref] = useState("");
  const [linkError, setLinkError] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        underline: false, // no Markdown for it
        horizontalRule: false,
        heading: { levels: [1, 2, 3] },
        link: {
          openOnClick: false,
          autolink: true,
          linkOnPaste: true,
          // Only web and mail addresses, like the finished note.
          isAllowedUri: (url) => !!safeHref(url),
          HTMLAttributes: {
            rel: "noopener noreferrer nofollow ugc",
            target: "_blank",
          },
        },
      }),
      Markdown.configure({ markedOptions: { gfm: true, breaks: true } }),
      Placeholder.configure({ placeholder: "Add details…" }),
    ],
    content: value || "",
    contentType: "markdown",
    autofocus: autoFocus ? "end" : false,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "Item notes",
      },
    },
    onUpdate: ({ editor: ed }) => {
      const md = ed.getMarkdown();
      lastSent.current = md;
      if (md.length > LIMIT) {
        setTooLong(true); // not saved until it is short enough again
        return;
      }
      setTooLong(false);
      onChange(md);
    },
  });

  // Changes that come from outside (another person editing, Undo) while you aren't typing.
  useEffect(() => {
    if (!editor || editor.isFocused || value === lastSent.current) return;
    lastSent.current = value;
    editor.commands.setContent(value || "", {
      contentType: "markdown",
      emitUpdate: false,
    });
  }, [editor, value]);

  const active = useEditorState({
    editor,
    selector: ({ editor: ed }) =>
      ed
        ? {
            bold: ed.isActive("bold"),
            italic: ed.isActive("italic"),
            strike: ed.isActive("strike"),
            code: ed.isActive("code"),
            link: ed.isActive("link"),
            ul: ed.isActive("bulletList"),
            ol: ed.isActive("orderedList"),
            quote: ed.isActive("blockquote"),
          }
        : {},
  });

  const act = (id) => {
    if (!editor) return;
    const chain = editor.chain().focus();
    switch (id) {
      case "bold":
        return chain.toggleBold().run();
      case "italic":
        return chain.toggleItalic().run();
      case "strike":
        return chain.toggleStrike().run();
      case "code":
        return chain.toggleCode().run();
      case "ul":
        return chain.toggleBulletList().run();
      case "ol":
        return chain.toggleOrderedList().run();
      case "quote":
        return chain.toggleBlockquote().run();
      case "link":
        setHref(editor.getAttributes("link").href || "");
        setLinkError("");
        return setLinkOpen((v) => !v);
    }
  };

  const applyLink = () => {
    const safe = safeHref(href);
    if (!href.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else if (!safe) {
      setLinkError("Use a web address like https://example.com");
      return;
    } else {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: safe })
        .run();
    }
    setLinkOpen(false);
  };

  return (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-line px-1.5 py-1">
        <NotesToolbar onAction={act} active={active} disabled={!editor} />
        {extras}
      </div>
      {linkOpen && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-2 py-1.5">
          <input
            autoFocus
            aria-label="Link address"
            aria-invalid={!!linkError}
            value={href}
            placeholder="https://example.com"
            onChange={(e) => {
              setHref(e.target.value);
              setLinkError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink();
              } else if (e.key === "Escape") {
                e.stopPropagation();
                setLinkOpen(false);
                editor?.commands.focus();
              }
            }}
            className="h-7 min-w-40 flex-1 rounded-md border border-line bg-surface px-2 text-[13px] text-fg placeholder:text-faint focus:border-accent focus:outline-none aria-[invalid=true]:border-danger"
          />
          <button
            type="button"
            onClick={applyLink}
            className="h-7 cursor-pointer rounded-md border border-line px-2.5 text-xs text-fg transition-colors hover:border-line-strong"
          >
            {href.trim() ? "Apply" : "Remove link"}
          </button>
          {linkError && (
            <p role="alert" className="basis-full text-xs text-danger">
              {linkError}
            </p>
          )}
        </div>
      )}
      <EditorContent editor={editor} className="notes-rich" />
      {tooLong && (
        <p
          role="alert"
          className="border-t border-line px-3 py-1.5 text-xs text-danger"
        >
          This note is over {LIMIT.toLocaleString()} characters, so the latest
          changes aren’t being saved. Shorten it a little.
        </p>
      )}
    </>
  );
}
