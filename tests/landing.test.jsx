import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App";
import { ThemeProvider } from "../src/contexts/ThemeContext";
import { ToastProvider } from "../src/contexts/ToastContext";
import { AuthProvider } from "../src/contexts/AuthContext";
import { SaveProvider } from "../src/contexts/SaveContext";

// A tiny stand-in for the backend: who is signed in is up to each test.
const h = vi.hoisted(() => ({ user: null, pending: null }));
vi.mock("../src/services/api", () => ({
  backendMode: "supabase",
  api: {
    capabilities: { auth: true, sharing: true, realtime: false },
    getUser: () => h.pending ?? Promise.resolve(h.user),
    onAuthChange: () => () => {},
  },
}));

const mount = (path = "/") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <SaveProvider>
              <App />
            </SaveProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </MemoryRouter>,
  );
const hero = () =>
  screen.findByRole("heading", { level: 1, name: /lists that stay put/i });
const hrefs = (links) => links.map((a) => a.getAttribute("href"));

beforeEach(() => {
  h.user = null;
  h.pending = null;
  localStorage.clear();
});

describe("landing page: who sees what", () => {
  it("shows visitors Get started and Sign in, and no way into the app that would just bounce them", async () => {
    mount("/");
    await hero();
    const start = await screen.findAllByRole("link", { name: /get started/i });
    expect(start.length).toBeGreaterThanOrEqual(3); // top bar, hero, closing section, footer
    expect(new Set(hrefs(start))).toEqual(new Set(["/signup"]));
    const signIn = screen.getAllByRole("link", { name: /^sign in$/i });
    expect(new Set(hrefs(signIn))).toEqual(new Set(["/login"]));
    expect(
      screen.queryByRole("link", { name: /open ordly/i }),
    ).not.toBeInTheDocument();
  });

  it("shows people who are signed in an Open Ordly button, not Get started or Sign in", async () => {
    h.user = { id: "u1", email: "a@b.co", name: "Aditya" };
    mount("/");
    await hero();
    const open = await screen.findAllByRole("link", { name: /open ordly/i });
    expect(new Set(hrefs(open))).toEqual(new Set(["/app"]));
    expect(
      screen.queryByRole("link", { name: /get started/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /^sign in$/i }),
    ).not.toBeInTheDocument();
  });

  it("does not guess while it is still finding out who you are", async () => {
    let finish;
    h.pending = new Promise((r) => (finish = r));
    mount("/");
    await hero();
    expect(
      screen.queryByRole("link", { name: /get started|open ordly/i }),
    ).not.toBeInTheDocument();
    finish(null);
    expect(
      (await screen.findAllByRole("link", { name: /get started/i })).length,
    ).toBeGreaterThan(0);
  });
});

describe("landing page: structure", () => {
  it("has the page landmarks, one h1, and a heading for each section", async () => {
    mount("/");
    await hero();
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const h2 = screen.getAllByRole("heading", { level: 2 });
    expect(h2).toHaveLength(4);
    [
      "Capture. Nest. Share.",
      "Everything a list needs. Nothing it doesn’t.",
      "Share it the way you share a doc.",
      "Start a list that stays put.",
    ].forEach((name, i) => expect(h2[i]).toHaveAccessibleName(name));
    // The split-up animated words are not read out a piece at a time.
    expect(screen.getByRole("heading", { level: 1 })).toHaveAccessibleName(
      "Lists that stay put.",
    );
  });

  it("every link in the top bar points at a section that exists", async () => {
    mount("/");
    await hero();
    const nav = screen.getByRole("navigation", { name: /page sections/i });
    const links = within(nav).getAllByRole("link");
    expect(links.map((a) => a.textContent)).toEqual([
      "How it works",
      "Features",
      "Sharing",
    ]);
    for (const a of links) {
      const id = a.getAttribute("href").slice(1);
      expect(document.getElementById(id), `#${id}`).not.toBeNull();
    }
    expect(document.getElementById("top")).not.toBeNull();
  });

  it("offers a skip link and hides the pretend app screens from screen readers", async () => {
    mount("/");
    await hero();
    expect(
      screen.getByRole("link", { name: /skip to content/i }),
    ).toHaveAttribute("href", "#main");
    // The pictures of the app are decoration: the text next to them says it all.
    for (const el of document.querySelectorAll(
      "[data-share-card], [data-demo=window]",
    ))
      expect(el.closest("[aria-hidden=true]")).not.toBeNull();
  });

  it("shows the finished picture when animation is off (the test browser has no motion)", async () => {
    mount("/");
    await hero();
    // Nothing is left half-hidden by an animation that never ran.
    const word = document.querySelector("[data-hero=word]");
    expect(word.style.transform).toBe("");
    expect(document.querySelector("[data-demo=count]").textContent).toBe(
      "4 of 5 tasks done",
    );
    expect(document.querySelector("[data-s=share]").className).toMatch(
      /invisible/,
    ); // share window only appears in the animated story
    expect(
      document.querySelector("[data-share=access-label]").textContent,
    ).toBe("Anyone with the link");
  });
});

describe("landing page: theme and routes", () => {
  it("follows the site theme and can switch it", async () => {
    const user = userEvent.setup();
    mount("/");
    await hero();
    const before = document.documentElement.dataset.theme;
    const label = (name) => screen.getByRole("button", { name });
    const was = label(/switch to (light|dark) theme/i).getAttribute(
      "aria-label",
    );
    await user.click(label(/switch to (light|dark) theme/i));
    expect(document.documentElement.dataset.theme).not.toBe(before);
    expect(
      label(/switch to (light|dark) theme/i).getAttribute("aria-label"),
    ).not.toBe(was);
  });

  it("the sign-in page is still at /login, and /app sends visitors there", async () => {
    mount("/login");
    expect(await screen.findByLabelText(/email/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", {
        level: 2,
        name: /capture\. nest\. share\./i,
      }),
    ).not.toBeInTheDocument();
  });

  it("/app without an account lands on the sign-in page", async () => {
    mount("/app");
    expect(await screen.findByLabelText(/email/i)).toBeInTheDocument();
  });
});
