import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App";
import { ThemeProvider } from "../src/contexts/ThemeContext";
import { ToastProvider } from "../src/contexts/ToastContext";
import { AuthProvider } from "../src/contexts/AuthContext";
import { SaveProvider } from "../src/contexts/SaveContext";
import { STARTER_TEMPLATES } from "../src/data/starterTemplates";
import { countTemplateItems } from "../src/utils/templates";

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

const db = () =>
  JSON.parse(localStorage.getItem("ordly.local.v1") || '{"lists":[]}');
const byText = (items, text) => items.find((i) => i.text === text);
const groceries = STARTER_TEMPLATES.find((t) => t.title === "Groceries");

const chipsRow = async () =>
  within(
    (await screen.findByText(/or start from a template/i)).nextElementSibling,
  );
const goHome = (user) =>
  user.click(screen.getByRole("button", { name: /ordly home/i }));
const box = (text) =>
  screen.getByRole("checkbox", { name: new RegExp(`: ${text}$`, "i") });

// From the home screen: make the Groceries list from its chip, and land inside it.
async function startGroceries(user) {
  await user.click(
    (await chipsRow()).getByRole("button", { name: "Groceries" }),
  );
  await screen.findByDisplayValue("Groceries");
}
async function openSaveDialog(user) {
  await user.click(screen.getByRole("button", { name: /list actions/i }));
  await user.click(
    await screen.findByRole("menuitem", { name: /save as template/i }),
  );
  return screen.findByRole("dialog", { name: /save as template/i });
}
async function saveAs(user, name) {
  const dialog = await openSaveDialog(user);
  const input = within(dialog).getByLabelText("Template name");
  await user.clear(input);
  await user.type(input, name);
  await user.click(
    within(dialog).getByRole("button", { name: /save template/i }),
  );
  await screen.findByText(/template saved/i);
}

beforeEach(() => localStorage.clear());

describe("starting from a template", () => {
  it("a starter chip creates a ready-made list, nested, and opens it", async () => {
    const user = userEvent.setup();
    mount();
    await startGroceries(user);

    expect(
      await screen.findByText(/created “groceries” from a template/i),
    ).toBeInTheDocument();
    const [list] = db().lists;
    expect(list.title).toBe("Groceries");
    expect(list.icon).toBe("🛒");
    expect(list.items).toHaveLength(countTemplateItems(groceries.items));
    const produce = byText(list.items, "Produce");
    expect(produce.parent_id).toBeNull();
    expect(byText(list.items, "Apples").parent_id).toBe(produce.id);
    expect(list.items.every((i) => i.completed === false)).toBe(true);
    expect(
      byText(list.items, "Check the fridge before you go.").has_checkbox,
    ).toBe(false);

    // and it shows nested on screen, with the group's count
    expect(await screen.findByText("Apples")).toBeInTheDocument();
    expect(screen.getByTitle("0 of 5 done")).toBeInTheDocument();
  });

  it("a name typed on the home screen is used instead of the template's", async () => {
    const user = userEvent.setup();
    mount();
    await user.type(
      await screen.findByLabelText("Name for a new list"),
      "Weekly shop",
    );
    await user.click(
      (await chipsRow()).getByRole("button", { name: "Groceries" }),
    );
    await screen.findByDisplayValue("Weekly shop");
    const [list] = db().lists;
    expect(list.title).toBe("Weekly shop");
    expect(byText(list.items, "Milk")).toBeTruthy();
  });

  it("All templates opens a picker with every starter, and picking one makes the list", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(
      (await chipsRow()).getByRole("button", { name: /all templates/i }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: /start from a template/i,
    });
    expect(
      within(dialog).queryByText(/your templates/i),
    ).not.toBeInTheDocument();
    for (const t of STARTER_TEMPLATES)
      expect(
        within(dialog).getByRole("button", { name: new RegExp(`^${t.title}`) }),
      ).toBeInTheDocument();

    await user.click(
      within(dialog).getByRole("button", { name: /^packing list/i }),
    );
    await screen.findByDisplayValue("Packing list");
    expect(db().lists).toHaveLength(1);
    expect(byText(db().lists[0].items, "Passport or ID")).toBeTruthy();
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: /start from a template/i }),
      ).not.toBeInTheDocument(),
    );
  });
});

describe("saving your own template", () => {
  it("keeps the list's items without any ticks, and shows it first on the home screen", async () => {
    const user = userEvent.setup();
    mount();
    await startGroceries(user);
    await user.click(box("Apples")); // ticked lists save as untouched templates
    await saveAs(user, "My weekly shop");

    const [tpl] = db().templates;
    expect(tpl.title).toBe("My weekly shop");
    expect(tpl.icon).toBe("🛒");
    expect(countTemplateItems(tpl.items)).toBe(
      countTemplateItems(groceries.items),
    );
    expect(tpl.items[0].text).toBe("Produce");
    expect(tpl.items[0].children.map((c) => c.text)).toContain("Apples");
    expect(JSON.stringify(tpl.items)).not.toMatch(/completed|"id"|list_id/);

    await goHome(user);
    const chips = await chipsRow();
    const names = chips.getAllByRole("button").map((b) => b.textContent);
    expect(names[0]).toMatch(/My weekly shop/); // your own come first
    await user.click(chips.getByRole("button", { name: "My weekly shop" }));
    await screen.findByDisplayValue("My weekly shop");

    const fresh = db().lists.find((l) => l.title === "My weekly shop");
    const original = db().lists.find((l) => l.title === "Groceries");
    expect(fresh.items).toHaveLength(original.items.length);
    expect(fresh.items.every((i) => i.completed === false)).toBe(true);
    expect(
      fresh.items.some((i) => original.items.some((o) => o.id === i.id)),
    ).toBe(false);
    expect(byText(fresh.items, "Apples").parent_id).toBe(
      byText(fresh.items, "Produce").id,
    );
  });

  it("starts with the list's own name and explains what is saved", async () => {
    const user = userEvent.setup();
    mount();
    await startGroceries(user);
    const dialog = await openSaveDialog(user);
    expect(within(dialog).getByLabelText("Template name")).toHaveValue(
      "Groceries",
    );
    expect(
      within(dialog).getByText(/saves 20 items \(15 of them nested\)/i),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/ticks are not saved/i),
    ).toBeInTheDocument();
  });

  it("asks for a name, and refuses an empty list", async () => {
    const user = userEvent.setup();
    mount();
    await startGroceries(user);
    let dialog = await openSaveDialog(user);
    await user.clear(within(dialog).getByLabelText("Template name"));
    await user.click(
      within(dialog).getByRole("button", { name: /save template/i }),
    );
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      /give the template a name/i,
    );
    expect(db().templates || []).toHaveLength(0);
    await user.click(within(dialog).getByRole("button", { name: /^cancel$/i }));

    await goHome(user);
    await user.type(
      await screen.findByLabelText("Name for a new list"),
      "Blank{Enter}",
    );
    await screen.findByDisplayValue("Blank");
    dialog = await openSaveDialog(user);
    await user.click(
      within(dialog).getByRole("button", { name: /save template/i }),
    );
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      /add some items first/i,
    );
    expect(db().templates || []).toHaveLength(0);
  });
});

describe("managing your templates", () => {
  async function withSavedTemplate(user) {
    mount();
    await startGroceries(user);
    await saveAs(user, "My weekly shop");
    await goHome(user);
    await user.click(
      (await chipsRow()).getByRole("button", { name: /all templates/i }),
    );
    return screen.findByRole("dialog", { name: /start from a template/i });
  }

  it("lists your templates above the starters, and deleting one asks first", async () => {
    const user = userEvent.setup();
    const dialog = await withSavedTemplate(user);
    expect(
      within(dialog).getByRole("region", { name: /your templates/i }),
    ).toBeInTheDocument();
    const del = within(dialog).getByRole("button", {
      name: /delete template “my weekly shop”/i,
    });

    await user.click(del);
    const confirm = await screen.findByRole("dialog", {
      name: /delete the template “my weekly shop”/i,
    });
    await user.click(
      within(confirm).getByRole("button", { name: /^cancel$/i }),
    );
    expect(db().templates).toHaveLength(1);

    await user.click(del);
    await user.click(
      within(
        await screen.findByRole("dialog", { name: /delete the template/i }),
      ).getByRole("button", { name: /delete template/i }),
    );
    await waitFor(() => expect(db().templates).toHaveLength(0));
    expect(await screen.findByText("Template deleted")).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("region", { name: /your templates/i }),
    ).not.toBeInTheDocument();
    // lists already made from it are untouched
    expect(db().lists.some((l) => l.title === "Groceries")).toBe(true);
  });

  it("starter templates cannot be deleted", async () => {
    const user = userEvent.setup();
    const dialog = await withSavedTemplate(user);
    const starters = within(dialog).getByRole("region", {
      name: /starter templates/i,
    });
    expect(
      within(starters).queryByRole("button", { name: /delete template/i }),
    ).not.toBeInTheDocument();
  });
});
