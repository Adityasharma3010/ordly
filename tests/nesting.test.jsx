import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
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

const stored = () =>
  JSON.parse(localStorage.getItem("ordly.local.v1")).lists.map((l) => ({
    title: l.title,
    items: l.items,
  }));
const byText = (items, text) => items.find((i) => i.text === text);

// Opens the app with a fresh list called "Trip" ready for items.
async function start() {
  const user = userEvent.setup();
  mount();
  await user.click(await screen.findByRole("button", { name: /^new list$/i }));
  const dialog = await screen.findByRole("dialog", { name: /new list/i });
  await user.type(within(dialog).getByLabelText(/name/i), "Trip");
  await user.click(
    within(dialog).getByRole("button", { name: /create list/i }),
  );
  await screen.findByDisplayValue("Trip");
  return user;
}
const addRoot = async (user, text) =>
  user.type(screen.getByLabelText("New item"), `${text}{Enter}`);
const openMenu = async (user, text, item) => {
  await user.click(
    screen.getByRole("button", {
      name: new RegExp(`actions for “${text}”`, "i"),
    }),
  );
  await user.click(await screen.findByRole("menuitem", { name: item }));
};
const addChildren = async (user, parent, ...texts) => {
  await openMenu(user, parent, /add sub-item/i);
  const box = await screen.findByLabelText(
    new RegExp(`new sub-item under “${parent}”`, "i"),
  );
  for (const t of texts) await user.type(box, `${t}{Enter}`);
  await user.keyboard("{Escape}");
};
const box = (text) =>
  screen.getByRole("checkbox", { name: new RegExp(`: ${text}$`, "i") });

beforeEach(() => localStorage.clear());

describe("sub-items (local mode)", () => {
  it("adds sub-items under an item and shows how many are done", async () => {
    const user = await start();
    await addRoot(user, "Pack");
    await addChildren(user, "Pack", "Passport", "Charger");

    expect(await screen.findByText("Passport")).toBeInTheDocument();
    expect(screen.getByTitle("0 of 2 done")).toBeInTheDocument();
    // Parents are roll-ups: the list counts the two tasks inside, not three.
    expect(screen.getByText(/of 2 tasks done/i)).toBeInTheDocument();

    await waitFor(() => {
      const { items } = stored()[0];
      const pack = byText(items, "Pack");
      expect(byText(items, "Passport").parent_id).toBe(pack.id);
      expect(byText(items, "Charger").parent_id).toBe(pack.id);
      expect(pack.parent_id).toBeNull();
    });
  });

  it("completes the parent when its last sub-item is ticked, and unticking the parent unticks them all", async () => {
    const user = await start();
    await addRoot(user, "Pack");
    await addChildren(user, "Pack", "Passport", "Charger");

    await user.click(box("Passport"));
    expect(screen.getByTitle("1 of 2 done")).toBeInTheDocument();
    expect(box("Pack")).not.toBeChecked();

    await user.click(box("Charger"));
    expect(box("Pack")).toBeChecked(); // done automatically
    expect(screen.getByText(/of 2 tasks done/i).textContent).toMatch(
      /2\s*of 2 tasks done/,
    );

    await user.click(box("Pack")); // untick the parent
    expect(box("Passport")).not.toBeChecked();
    expect(box("Charger")).not.toBeChecked();

    await user.click(box("Pack")); // tick the parent
    expect(box("Passport")).toBeChecked();
    expect(box("Charger")).toBeChecked();

    await waitFor(() => {
      const { items } = stored()[0];
      expect(byText(items, "Passport").completed).toBe(true);
      expect(byText(items, "Charger").completed).toBe(true);
    });
  });

  it("deleting an item deletes its sub-items too, and Undo brings the whole branch back", async () => {
    const user = await start();
    await addRoot(user, "Pack");
    await addRoot(user, "Book hotel");
    await addChildren(user, "Pack", "Passport", "Charger");

    await openMenu(user, "Pack", /delete item and sub-items/i);
    expect(
      await screen.findByText(/item and 2 sub-items deleted/i),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText("Passport")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Book hotel")).toBeInTheDocument();
    expect(stored()[0].items.map((i) => i.text)).toEqual(["Book hotel"]);

    await user.click(screen.getByRole("button", { name: /undo/i }));
    expect(await screen.findByText("Passport")).toBeInTheDocument();
    expect(screen.getByText("Charger")).toBeInTheDocument();
    const { items } = stored()[0];
    expect(items).toHaveLength(4);
    expect(byText(items, "Passport").parent_id).toBe(byText(items, "Pack").id);
  });

  it("indents an item under the one above it, and outdents it back", async () => {
    const user = await start();
    await addRoot(user, "Pack");
    await addRoot(user, "Passport");

    await openMenu(user, "Passport", /^indent/i);
    await waitFor(() => {
      const { items } = stored()[0];
      expect(byText(items, "Passport").parent_id).toBe(
        byText(items, "Pack").id,
      );
    });
    expect(screen.getByTitle("0 of 1 done")).toBeInTheDocument();

    await openMenu(user, "Passport", /^outdent/i);
    await waitFor(() => {
      expect(byText(stored()[0].items, "Passport").parent_id).toBeNull();
    });
    expect(screen.queryByTitle("0 of 1 done")).not.toBeInTheDocument();
  });

  it("can only indent when there is an item above, and only outdent a sub-item", async () => {
    const user = await start();
    await addRoot(user, "Pack");
    await user.click(
      screen.getByRole("button", { name: /actions for “pack”/i }),
    );
    expect(
      await screen.findByRole("menuitem", { name: /add sub-item/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /^indent/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /^outdent/i }),
    ).not.toBeInTheDocument();
  });

  it("folds and unfolds a branch", async () => {
    const user = await start();
    await addRoot(user, "Pack");
    await addChildren(user, "Pack", "Passport");

    await user.click(screen.getByRole("button", { name: /collapse “pack”/i }));
    await waitFor(() =>
      expect(screen.queryByText("Passport")).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: /expand “pack”/i }),
    ).toHaveAttribute("aria-expanded", "false");

    await user.click(screen.getByRole("button", { name: /expand “pack”/i }));
    expect(await screen.findByText("Passport")).toBeInTheDocument();
  });

  it("duplicating a list keeps the hierarchy and resets progress", async () => {
    const user = await start();
    await addRoot(user, "Pack");
    await addChildren(user, "Pack", "Passport");
    await user.click(box("Passport"));

    await user.click(screen.getByRole("button", { name: /list actions/i }));
    await user.click(
      await screen.findByRole("menuitem", { name: /duplicate/i }),
    );
    await screen.findByDisplayValue("Trip (copy)");

    await waitFor(() => {
      const copy = stored().find((l) => l.title === "Trip (copy)");
      const pack = byText(copy.items, "Pack");
      const passport = byText(copy.items, "Passport");
      expect(passport.parent_id).toBe(pack.id);
      expect(passport.completed).toBe(false);
      const original = stored().find((l) => l.title === "Trip");
      expect(pack.id).not.toBe(byText(original.items, "Pack").id);
    });
  });
});
