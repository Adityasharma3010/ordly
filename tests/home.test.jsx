import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App";
import { ThemeProvider } from "../src/contexts/ThemeContext";
import { ToastProvider } from "../src/contexts/ToastContext";
import { AuthProvider } from "../src/contexts/AuthContext";
import { SaveProvider } from "../src/contexts/SaveContext";

const mount = (path = "/app") =>
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

// Nothing is written to storage until something is created.
const lists = () =>
  JSON.parse(localStorage.getItem("ordly.local.v1") || '{"lists":[]}').lists;
const nav = () => screen.getByRole("navigation", { name: "Lists" });

// Name a list from the home screen and land inside it.
async function createFromHome(user, name) {
  await user.type(
    await screen.findByLabelText("Name for a new list"),
    `${name}{Enter}`,
  );
  await screen.findByDisplayValue(name);
}
const goHome = (user) =>
  user.click(within(nav()).getByRole("button", { name: /ordly home/i }));

beforeEach(() => localStorage.clear());

describe("home screen (nothing open yet)", () => {
  it("is the first-run screen when you have no lists", async () => {
    mount();
    expect(
      await screen.findByText(/make your first list/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /start with a sample/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/jump back in/i)).not.toBeInTheDocument();
  });

  it("names a list and opens it, with the Enter key or the arrow button", async () => {
    const user = userEvent.setup();
    mount();
    const box = await screen.findByLabelText("Name for a new list");
    const send = screen.getByRole("button", { name: /^create list$/i });
    expect(send).toBeDisabled(); // nothing typed yet

    await user.type(box, "  Groceries  {Enter}");
    expect(await screen.findByDisplayValue("Groceries")).toBeInTheDocument();
    expect(lists().map((l) => l.title)).toEqual(["Groceries"]);

    await goHome(user);
    await user.type(
      await screen.findByLabelText("Name for a new list"),
      "Packing",
    );
    await user.click(screen.getByRole("button", { name: /^create list$/i }));
    expect(await screen.findByDisplayValue("Packing")).toBeInTheDocument();
    expect(lists()).toHaveLength(2);
  });

  it("offers template chips, and creates nothing until you pick one", async () => {
    mount();
    const label = await screen.findByText(/or start from a template/i);
    const chips = within(label.nextElementSibling);
    expect(
      chips.getByRole("button", { name: "Packing list" }),
    ).toBeInTheDocument();
    expect(
      chips.getByRole("button", { name: /all templates/i }),
    ).toBeInTheDocument();
    expect(lists()).toHaveLength(0);
  });

  it("More options opens the full new-list form", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(
      await screen.findByRole("button", { name: /more options/i }),
    );
    expect(
      await screen.findByRole("dialog", { name: /new list/i }),
    ).toBeInTheDocument();
  });

  it("shows your recent lists to jump back into, and the logo brings you home from a list", async () => {
    const user = userEvent.setup();
    mount();
    await createFromHome(user, "Groceries");
    await goHome(user);
    await createFromHome(user, "Packing");
    await goHome(user);

    const recent = await screen.findByRole("region", { name: /jump back in/i });
    const cards = within(recent).getAllByRole("button");
    expect(cards).toHaveLength(2);
    expect(
      screen.getByText(/what are you planning today/i),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("List title")).not.toBeInTheDocument();

    await user.click(
      within(recent).getByRole("button", { name: /groceries/i }),
    );
    expect(await screen.findByDisplayValue("Groceries")).toBeInTheDocument();
  });

  it("does not jump into a list on its own any more", async () => {
    const user = userEvent.setup();
    mount();
    await createFromHome(user, "Groceries");
    await goHome(user);
    expect(
      await screen.findByLabelText("Name for a new list"),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("List title")).not.toBeInTheDocument();
  });
});

describe("list actions in the sidebar", () => {
  const actions = (title) =>
    within(nav()).getByRole("button", {
      name: new RegExp(`actions for “${title}”`, "i"),
    });
  const pick = async (user, title, item) => {
    await user.click(actions(title));
    await user.click(await screen.findByRole("menuitem", { name: item }));
  };

  async function twoLists(user) {
    mount();
    await createFromHome(user, "Groceries");
    await goHome(user);
    await createFromHome(user, "Packing");
    await goHome(user); // nothing open
  }

  it("adds and removes a favorite without opening the list", async () => {
    const user = userEvent.setup();
    await twoLists(user);
    await pick(user, "Groceries", /add to favorites/i);
    await waitFor(() =>
      expect(lists().find((l) => l.title === "Groceries").favorite).toBe(true),
    );
    expect(screen.queryByLabelText("List title")).not.toBeInTheDocument(); // still on home

    await pick(user, "Groceries", /remove from favorites/i);
    await waitFor(() =>
      expect(lists().find((l) => l.title === "Groceries").favorite).toBe(false),
    );
  });

  it("archives and restores from the menu, with Undo", async () => {
    const user = userEvent.setup();
    await twoLists(user);
    await pick(user, "Packing", /archive list/i);
    expect(await screen.findByText("List archived")).toBeInTheDocument();
    await waitFor(() =>
      expect(lists().find((l) => l.title === "Packing").archived).toBe(true),
    );

    await user.click(screen.getByRole("button", { name: /undo/i }));
    await waitFor(() =>
      expect(lists().find((l) => l.title === "Packing").archived).toBe(false),
    );
  });

  it("deletes only after you confirm, and the other list stays", async () => {
    const user = userEvent.setup();
    await twoLists(user);
    await pick(user, "Groceries", /delete list/i);
    const confirm = await screen.findByRole("dialog", {
      name: /delete “groceries”/i,
    });
    expect(lists()).toHaveLength(2); // nothing deleted yet

    await user.click(
      within(confirm).getByRole("button", { name: /^cancel$/i }),
    );
    expect(lists()).toHaveLength(2);

    await pick(user, "Groceries", /delete list/i);
    await user.click(
      within(
        await screen.findByRole("dialog", { name: /delete “groceries”/i }),
      ).getByRole("button", { name: /delete list/i }),
    );
    await waitFor(() =>
      expect(lists().map((l) => l.title)).toEqual(["Packing"]),
    );
    expect(await screen.findByText("List deleted")).toBeInTheDocument();
  });

  it("deleting the list you have open takes you to the home screen", async () => {
    const user = userEvent.setup();
    mount();
    await createFromHome(user, "Groceries"); // open now
    await pick(user, "Groceries", /delete list/i);
    await user.click(
      within(
        await screen.findByRole("dialog", { name: /delete “groceries”/i }),
      ).getByRole("button", { name: /delete list/i }),
    );
    expect(
      await screen.findByText(/make your first list/i),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("List title")).not.toBeInTheDocument();
  });

  it("deleting a different list leaves the open one open", async () => {
    const user = userEvent.setup();
    await twoLists(user);
    await user.click(within(nav()).getByTitle("Packing")); // open Packing
    await screen.findByDisplayValue("Packing");
    await pick(user, "Groceries", /delete list/i);
    await user.click(
      within(
        await screen.findByRole("dialog", { name: /delete “groceries”/i }),
      ).getByRole("button", { name: /delete list/i }),
    );
    await waitFor(() =>
      expect(lists().map((l) => l.title)).toEqual(["Packing"]),
    );
    expect(screen.getByDisplayValue("Packing")).toBeInTheDocument();
  });
});
