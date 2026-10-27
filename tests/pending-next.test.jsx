import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import App from "../src/App";
import { ThemeProvider } from "../src/contexts/ThemeContext";
import { ToastProvider } from "../src/contexts/ToastContext";
import { AuthProvider } from "../src/contexts/AuthContext";
import { SaveProvider } from "../src/contexts/SaveContext";
import { savePendingNext, takePendingNext } from "../src/utils/pendingNext";

const ID = "aaaaaaaa-1111-4222-8333-bbbbbbbbbbbb";
const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => localStorage.clear());

describe("remembering where an invited person was headed", () => {
  it("hands back a remembered list once, then forgets it", () => {
    savePendingNext(`/app/${ID}`);
    expect(takePendingNext()).toBe(`/app/${ID}`);
    expect(takePendingNext()).toBeNull();
  });

  it("only ever remembers a list inside the app", () => {
    for (const bad of [
      "https://evil.example",
      "//evil.example",
      "/login",
      "/app",
      "/app/../x",
      "/app/not-a-uuid",
      `/app/${ID}?x=1`,
      null,
      undefined,
    ]) {
      savePendingNext(bad);
      expect(takePendingNext()).toBeNull();
    }
    // a tampered entry in storage is refused too
    localStorage.setItem(
      "ordly.next",
      JSON.stringify({ p: "https://evil.example", t: Date.now() }),
    );
    expect(takePendingNext()).toBeNull();
  });

  it("forgets it after two days, and ignores garbage", () => {
    const t0 = Date.now();
    savePendingNext(`/app/${ID}`, t0);
    expect(takePendingNext(t0 + 3 * DAY)).toBeNull();
    savePendingNext(`/app/${ID}`, t0);
    expect(takePendingNext(t0 + DAY)).toBe(`/app/${ID}`);
    localStorage.setItem("ordly.next", "{not json");
    expect(takePendingNext()).toBeNull();
  });
});

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}
const mountAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <SaveProvider>
              <App />
              <Where />
            </SaveProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </MemoryRouter>,
  );

describe("landing on /app after confirming an email", () => {
  it("carries on to the remembered list", async () => {
    savePendingNext(`/app/${ID}`);
    mountAt("/app");
    await waitFor(() =>
      expect(screen.getByTestId("where")).toHaveTextContent(`/app/${ID}`),
    );
    expect(localStorage.getItem("ordly.next")).toBeNull();
  });

  it("does nothing when nothing was remembered, or a list is already open", async () => {
    mountAt("/app");
    await screen.findByRole("button", { name: /start with a sample/i });
    expect(screen.getByTestId("where")).toHaveTextContent(/^\/app$/);
  });
});
