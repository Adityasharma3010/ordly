import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App";
import { ThemeProvider } from "../src/contexts/ThemeContext";
import { ToastProvider } from "../src/contexts/ToastContext";
import { AuthProvider } from "../src/contexts/AuthContext";
import { SaveProvider } from "../src/contexts/SaveContext";

const mount = () =>
  render(
    <MemoryRouter initialEntries={["/app"]}>
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

beforeEach(() => localStorage.clear());

describe("workspace (local dev mode)", () => {
  it("creates a list, adds items, tracks progress, and persists across a reload", async () => {
    const user = userEvent.setup();
    const first = mount();

    await user.click(
      await screen.findByRole("button", { name: /start with a sample/i }),
    );
    expect(
      await screen.findByDisplayValue("Welcome to Ordly"),
    ).toBeInTheDocument();
    expect(screen.getByText(/of 4 tasks done/i).textContent).toMatch(
      /0\s*of 4 tasks done/,
    );

    // Enter adds an item and keeps focus in the composer for the next one.
    const composer = screen.getByLabelText("New item");
    await user.type(composer, "Buy milk{Enter}");
    await user.type(composer, "Call Sam{Enter}");
    expect(composer).toHaveFocus();
    expect(composer).toHaveValue("");
    expect(screen.getByText("Buy milk")).toBeInTheDocument();
    expect(screen.getByText("Call Sam")).toBeInTheDocument();
    expect(screen.getByText(/of 6 tasks done/i)).toBeInTheDocument();

    // Plain-text items do not change completion totals.
    await user.click(
      screen.getByRole("switch", { name: /checkbox|plain text/i }),
    );
    await user.type(composer, "Just a note{Enter}");
    expect(screen.getByText("Just a note")).toBeInTheDocument();
    expect(screen.getByText(/of 6 tasks done/i)).toBeInTheDocument();

    // Checking an item updates progress immediately.
    await user.click(screen.getByRole("checkbox", { name: /buy milk/i }));
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      String(Math.round((1 / 6) * 100)),
    );

    // Filters respect checkbox-only semantics.
    const group = screen.getByRole("group", { name: /filter items/i });
    await user.click(within(group).getByRole("button", { name: /completed/i }));
    expect(screen.getByText("Buy milk")).toBeInTheDocument();
    // rows animate out before unmounting
    await waitFor(() =>
      expect(screen.queryByText("Call Sam")).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.queryByText("Just a note")).not.toBeInTheDocument(),
    );

    // Saved to storage...
    await waitFor(() => {
      const db = JSON.parse(localStorage.getItem("ordly.local.v1"));
      const items = db.lists[0].items;
      expect(items.find((i) => i.text === "Buy milk").completed).toBe(true);
      expect(items.find((i) => i.text === "Just a note").has_checkbox).toBe(
        false,
      );
    });

    // ...and restored after a fresh mount (a "refresh").
    first.unmount();
    mount();
    // /app is the home screen: jump back into the list from there.
    const recent = await screen.findByRole("region", { name: /jump back in/i });
    await user.click(
      within(recent).getByRole("button", { name: /welcome to ordly/i }),
    );
    expect(
      await screen.findByDisplayValue("Welcome to Ordly"),
    ).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /buy milk/i })).toBeChecked();
    expect(screen.getByText(/of 6 tasks done/i)).toBeInTheDocument();
  });

  it("creates, favorites, and deletes lists with confirmation", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(
      await screen.findByRole("button", { name: /^create new list$/i }),
    );
    const dialog = await screen.findByRole("dialog", { name: /new list/i });
    await user.type(within(dialog).getByLabelText(/name/i), "Groceries");
    await user.click(
      within(dialog).getByRole("button", { name: /create list/i }),
    );
    expect(await screen.findByDisplayValue("Groceries")).toBeInTheDocument();
    expect(screen.getByText(/this list is empty/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /add to favorites/i }));
    expect(
      screen.getByRole("button", { name: /remove from favorites/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /list actions/i }));
    await user.click(
      await screen.findByRole("menuitem", { name: /delete list/i }),
    );
    const confirm = await screen.findByRole("dialog", {
      name: /delete “groceries”/i,
    });
    await user.click(
      within(confirm).getByRole("button", { name: /delete list/i }),
    );
    expect(
      await screen.findByText(/make your first list/i),
    ).toBeInTheDocument();
    expect(
      JSON.parse(localStorage.getItem("ordly.local.v1")).lists,
    ).toHaveLength(0);
  });

  it("shows honest sharing status when no backend is configured", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(
      await screen.findByRole("button", { name: /start with a sample/i }),
    );
    await user.click(
      await screen.findByRole("button", { name: /list actions/i }),
    );
    await user.click(await screen.findByRole("menuitem", { name: /share/i }));
    expect(
      await screen.findByText(/needs a supabase backend/i),
    ).toBeInTheDocument();
  });
});
