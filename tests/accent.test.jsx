import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App";
import { ThemeProvider } from "../src/contexts/ThemeContext";
import { ToastProvider } from "../src/contexts/ToastContext";
import { AuthProvider } from "../src/contexts/AuthContext";
import { SaveProvider } from "../src/contexts/SaveContext";
import { accentHex, accentStyle, ACCENTS } from "../src/utils/appearance";
import {
  contrast,
  hexToHsv,
  hsvToHex,
  isHardToSee,
  isHex,
  normalizeHex,
  readableOn,
} from "../src/utils/color";

describe("colour maths", () => {
  it("tidies up typed colours", () => {
    expect(normalizeHex("#F0B24B")).toBe("#f0b24b");
    expect(normalizeHex("f0b24b")).toBe("#f0b24b");
    expect(normalizeHex("  #fb4 ")).toBe("#ffbb44");
    for (const bad of [
      "",
      "#12",
      "#12345",
      "#1234567",
      "#gggggg",
      "red",
      null,
      undefined,
    ])
      expect(normalizeHex(bad)).toBeNull();
    expect(isHex("#a1B2c3")).toBe(true);
    expect(isHex("amber")).toBe(false);
    expect(isHex("#abc")).toBe(false);
  });

  it("converts between hex and hue/saturation/brightness", () => {
    expect(hsvToHex({ h: 0, s: 1, v: 1 })).toBe("#ff0000");
    expect(hsvToHex({ h: 120, s: 1, v: 1 })).toBe("#00ff00");
    expect(hsvToHex({ h: 240, s: 1, v: 1 })).toBe("#0000ff");
    expect(hsvToHex({ h: 0, s: 0, v: 1 })).toBe("#ffffff");
    expect(hsvToHex({ h: 200, s: 0.5, v: 0 })).toBe("#000000");
    expect(hexToHsv("#ff0000")).toEqual({ h: 0, s: 1, v: 1 });
    expect(hexToHsv("#808080")).toMatchObject({ s: 0 });
    for (const hex of ["#f0b24b", "#4f8cff", "#123456", "#fedcba", "#0a0b0c"])
      expect(hsvToHex(hexToHsv(hex))).toBe(hex);
  });

  it("picks readable text for any accent", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(readableOn("#f0b24b")).toBe("#17130a"); // amber: dark text
    expect(readableOn("#ffffff")).toBe("#17130a");
    expect(readableOn("#0b2a6f")).toBe("#ffffff"); // dark blue: white text
    expect(readableOn("#000000")).toBe("#ffffff");
  });

  it("warns about colours that vanish into the page", () => {
    expect(isHardToSee("#101418", "dark")).toBe(true);
    expect(isHardToSee("#f0b24b", "dark")).toBe(false);
    expect(isHardToSee("#f4f4f4", "light")).toBe(true);
    expect(isHardToSee("#4f8cff", "light")).toBe(false);
  });
});

describe("list colours", () => {
  it("names stay as they were; custom colours are used as typed", () => {
    expect(accentHex("coral")).toBe(ACCENTS.coral);
    expect(accentHex("#A1B2C3")).toBe("#a1b2c3");
    expect(accentHex("nonsense")).toBe(ACCENTS.amber);
    expect(accentHex(undefined)).toBe(ACCENTS.amber);
    // Lists that were set to "system" by the earlier version just look amber now.
    expect(accentHex("system")).toBe(ACCENTS.amber);
  });

  it("a custom colour sets the accent and a readable text colour", () => {
    expect(accentStyle("#0b2a6f")).toEqual({
      className: "accent-custom",
      style: { "--c-accent": "#0b2a6f", "--c-on-accent": "#ffffff" },
    });
  });

  it("a named colour also resets anything the whole-app colour set", () => {
    const { className, style } = accentStyle("sky");
    expect(className).toBe("");
    expect(style["--c-accent"]).toBe(ACCENTS.sky);
    expect(style["--c-on-accent"]).toBe("#17130a");
    expect(style["--c-ink"]).toBe("initial");
  });
});

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
const html = () => document.documentElement;
const db = () => JSON.parse(localStorage.getItem("ordly.local.v1"));
const seedList = (o = {}) =>
  localStorage.setItem(
    "ordly.local.v1",
    JSON.stringify({
      lists: [
        {
          id: "l1",
          owner_id: "local-user",
          title: "Home",
          description: "",
          icon: "",
          color: "amber",
          favorite: false,
          archived: false,
          created_at: "2026-10-01T00:00:00Z",
          updated_at: "2026-10-20T00:00:00Z",
          items: [],
          ...o,
        },
      ],
    }),
  );
const openSettings = async (user) => {
  const buttons = await screen.findAllByRole("button", {
    name: "Account menu",
  });
  await user.click(buttons[0]);
  await user.click(await screen.findByRole("menuitem", { name: "Settings" }));
  return screen.findByRole("dialog", { name: "Settings" });
};
const setHexBox = (box, value) => fireEvent.change(box, { target: { value } });

beforeEach(() => {
  localStorage.clear();
  html().classList.remove("accent-custom");
  html().style.removeProperty("--c-accent");
  html().style.removeProperty("--c-on-accent");
});
afterEach(() => vi.unstubAllGlobals());

describe("Settings: the app-wide accent colour", () => {
  it("starts on Ordly amber; Custom colour opens the picker and applies the colour", async () => {
    const user = userEvent.setup();
    mount();
    const dialog = await openSettings(user);
    const amber = within(dialog).getByRole("button", { name: /ordly amber/i });
    const custom = within(dialog).getByRole("button", {
      name: /custom colour/i,
    });
    expect(amber).toHaveAttribute("aria-pressed", "true");
    expect(custom).toHaveAttribute("aria-pressed", "false");
    expect(within(dialog).queryByLabelText("Hex colour")).toBeNull();

    await user.click(custom);
    expect(custom).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(html()).toHaveClass("accent-custom"));
    expect(html().style.getPropertyValue("--c-accent")).toBe("#4f8cff");
    expect(html().style.getPropertyValue("--c-on-accent")).toBeTruthy();
    expect(localStorage.getItem("ordly.accent.color")).toBe("#4f8cff");
    expect(within(dialog).getByLabelText("Hex colour")).toBeVisible();
  });

  it("typing a hex colour, or using a ready-made one, changes the accent", async () => {
    const user = userEvent.setup();
    mount();
    const dialog = await openSettings(user);
    await user.click(
      within(dialog).getByRole("button", { name: /custom colour/i }),
    );
    const box = within(dialog).getByLabelText("Hex colour");
    setHexBox(box, "#FF8800");
    await waitFor(() =>
      expect(html().style.getPropertyValue("--c-accent")).toBe("#ff8800"),
    );
    expect(localStorage.getItem("ordly.accent.color")).toBe("#ff8800");
    await user.click(
      within(dialog).getByRole("button", { name: `Use ${ACCENTS.violet}` }),
    );
    await waitFor(() =>
      expect(html().style.getPropertyValue("--c-accent")).toBe(ACCENTS.violet),
    );
    expect(box).toHaveValue(ACCENTS.violet);
  });

  it("a short colour is only applied on Enter, so typing it isn't disturbed", async () => {
    const user = userEvent.setup();
    mount();
    const dialog = await openSettings(user);
    await user.click(
      within(dialog).getByRole("button", { name: /custom colour/i }),
    );
    const box = within(dialog).getByLabelText("Hex colour");
    await user.clear(box);
    await user.type(box, "#f80");
    expect(box).toHaveValue("#f80"); // not rewritten while typing
    await user.keyboard("{Enter}");
    await waitFor(() => expect(box).toHaveValue("#ff8800"));
    expect(html().style.getPropertyValue("--c-accent")).toBe("#ff8800");
  });

  it("nonsense in the hex box is put back on leaving it", async () => {
    const user = userEvent.setup();
    mount();
    const dialog = await openSettings(user);
    await user.click(
      within(dialog).getByRole("button", { name: /custom colour/i }),
    );
    const box = within(dialog).getByLabelText("Hex colour");
    await user.clear(box);
    await user.type(box, "banana");
    await user.tab();
    expect(box).toHaveValue("#4f8cff");
    expect(html().style.getPropertyValue("--c-accent")).toBe("#4f8cff");
  });

  it("the shade square works from the keyboard", async () => {
    const user = userEvent.setup();
    mount();
    const dialog = await openSettings(user);
    await user.click(
      within(dialog).getByRole("button", { name: /custom colour/i }),
    );
    const before = html().style.getPropertyValue("--c-accent");
    within(dialog).getByRole("slider", { name: "Colour shade" }).focus();
    await user.keyboard("{ArrowLeft}{ArrowDown}");
    await waitFor(() =>
      expect(html().style.getPropertyValue("--c-accent")).not.toBe(before),
    );
    fireEvent.change(within(dialog).getByRole("slider", { name: "Hue" }), {
      target: { value: "0" },
    });
    await waitFor(() =>
      expect(within(dialog).getByLabelText("Hex colour").value).toMatch(/^#/),
    );
  });

  it("going back to Ordly amber removes the custom colour completely", async () => {
    const user = userEvent.setup();
    mount();
    const dialog = await openSettings(user);
    await user.click(
      within(dialog).getByRole("button", { name: /custom colour/i }),
    );
    await waitFor(() => expect(html()).toHaveClass("accent-custom"));
    await user.click(
      within(dialog).getByRole("button", { name: /ordly amber/i }),
    );
    await waitFor(() => expect(html()).not.toHaveClass("accent-custom"));
    expect(html().style.getPropertyValue("--c-accent")).toBe("");
    expect(localStorage.getItem("ordly.accent.color")).toBeNull();
  });

  it("is remembered on this device; junk or the old 'system' setting is ignored", async () => {
    localStorage.setItem("ordly.accent.color", "#12ab34");
    localStorage.setItem("ordly.accent", "system");
    mount();
    await waitFor(() => expect(html()).toHaveClass("accent-custom"));
    expect(html().style.getPropertyValue("--c-accent")).toBe("#12ab34");
  });

  it("ignores a stored colour that isn't a real one", async () => {
    localStorage.setItem("ordly.accent.color", "url(javascript:alert(1))");
    mount();
    await screen.findAllByRole("button", { name: "Account menu" });
    expect(html()).not.toHaveClass("accent-custom");
    expect(html().style.getPropertyValue("--c-accent")).toBe("");
  });

  it("warns when the colour would be hard to see", async () => {
    localStorage.setItem("ordly.accent.color", "#101418");
    const user = userEvent.setup();
    mount();
    const dialog = await openSettings(user);
    expect(await within(dialog).findByRole("status")).toHaveTextContent(
      /hard to see/i,
    );
    setHexBox(within(dialog).getByLabelText("Hex colour"), "#f0b24b");
    await waitFor(() =>
      expect(within(dialog).queryByRole("status")).toBeNull(),
    );
  });

  it("'Pick from screen' appears only where the browser has an eyedropper, and uses what it returns", async () => {
    const user = userEvent.setup();
    mount();
    let dialog = await openSettings(user);
    await user.click(
      within(dialog).getByRole("button", { name: /custom colour/i }),
    );
    expect(
      within(dialog).queryByRole("button", { name: /pick from screen/i }),
    ).toBeNull();
    await user.click(within(dialog).getByRole("button", { name: /close/i }));

    vi.stubGlobal(
      "EyeDropper",
      class {
        open() {
          return Promise.resolve({ sRGBHex: "#4a4a4a" });
        }
      },
    );
    dialog = await openSettings(user);
    await user.click(
      within(dialog).getByRole("button", { name: /pick from screen/i }),
    );
    await waitFor(() =>
      expect(html().style.getPropertyValue("--c-accent")).toBe("#4a4a4a"),
    );
    expect(html().style.getPropertyValue("--c-on-accent")).toBe("#ffffff");
  });

  it("cancelling the eyedropper changes nothing", async () => {
    vi.stubGlobal(
      "EyeDropper",
      class {
        open() {
          return Promise.reject(new DOMException("closed", "AbortError"));
        }
      },
    );
    const user = userEvent.setup();
    mount();
    const dialog = await openSettings(user);
    await user.click(
      within(dialog).getByRole("button", { name: /custom colour/i }),
    );
    await user.click(
      within(dialog).getByRole("button", { name: /pick from screen/i }),
    );
    expect(html().style.getPropertyValue("--c-accent")).toBe("#4f8cff");
  });
});

describe("a list's own custom colour", () => {
  const openForm = async (user) => {
    await user.click(
      await screen.findByRole("button", { name: /create new list/i }),
    );
    const dialog = await screen.findByRole("dialog", { name: /^new list$/i });
    await user.type(within(dialog).getByLabelText("Name"), "Mine");
    await user.click(
      within(dialog).getByRole("button", { name: /change icon and colour/i }),
    );
    return dialog;
  };

  it("the Custom swatch opens the picker, and the list is saved with that colour", async () => {
    const user = userEvent.setup();
    mount();
    const dialog = await openForm(user);
    const swatch = await within(dialog).findByRole("button", {
      name: "Custom colour",
    });
    expect(swatch).toHaveAttribute("aria-pressed", "false");
    await user.click(swatch);
    setHexBox(await within(dialog).findByLabelText("Hex colour"), "#2bb673");
    await waitFor(() => expect(swatch).toHaveAttribute("aria-pressed", "true"));
    await user.click(
      within(dialog).getByRole("button", { name: /create list/i }),
    );
    await waitFor(() => expect(db().lists[0].color).toBe("#2bb673"));
  });

  it("choosing a named colour afterwards switches the custom one off", async () => {
    const user = userEvent.setup();
    mount();
    const dialog = await openForm(user);
    const swatch = await within(dialog).findByRole("button", {
      name: "Custom colour",
    });
    await user.click(swatch);
    setHexBox(await within(dialog).findByLabelText("Hex colour"), "#2bb673");
    await user.click(
      within(dialog).getByRole("button", { name: /coral accent/i }),
    );
    expect(swatch).toHaveAttribute("aria-pressed", "false");
    await user.click(
      within(dialog).getByRole("button", { name: /create list/i }),
    );
    await waitFor(() => expect(db().lists[0].color).toBe("coral"));
  });

  it("the open list uses its custom colour", async () => {
    seedList({ color: "#c0ffee" });
    mount("/app/l1");
    const title = await screen.findByLabelText("List title");
    const area = title.closest("[style]");
    expect(area.style.getPropertyValue("--c-accent")).toBe("#c0ffee");
    expect(area).toHaveClass("accent-custom");
  });

  it("a list with a named colour keeps it even when the whole app has a custom one", async () => {
    localStorage.setItem("ordly.accent.color", "#12ab34");
    seedList({ color: "sky" });
    mount("/app/l1");
    const area = (await screen.findByLabelText("List title")).closest(
      "[style]",
    );
    expect(area.style.getPropertyValue("--c-accent")).toBe(ACCENTS.sky);
    expect(area.style.getPropertyValue("--c-ink")).toBe("initial");
    expect(html().style.getPropertyValue("--c-accent")).toBe("#12ab34");
  });

  it("an old 'system' list just shows amber", async () => {
    seedList({ color: "system" });
    mount("/app/l1");
    const area = (await screen.findByLabelText("List title")).closest(
      "[style]",
    );
    expect(area.style.getPropertyValue("--c-accent")).toBe(ACCENTS.amber);
  });
});
