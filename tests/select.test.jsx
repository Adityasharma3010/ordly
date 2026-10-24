import { describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Select } from "../src/components/ui/Select";
import { Menu } from "../src/components/ui/Menu";

const OPTIONS = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gamma" },
];
const setup = (props = {}) => {
  const onChange = vi.fn();
  render(
    <div>
      <button>outside</button>
      <Select
        label="Letter"
        value="a"
        onChange={onChange}
        options={OPTIONS}
        {...props}
      />
    </div>,
  );
  return {
    user: userEvent.setup(),
    onChange,
    trigger: screen.getByRole("combobox", { name: "Letter" }),
  };
};
const closed = () =>
  waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());

describe("Select", () => {
  it("shows the current label, opens on click, and picks with the mouse", async () => {
    const { user, onChange, trigger } = setup();
    expect(trigger).toHaveTextContent("Alpha");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("option")).toHaveLength(3);

    await user.click(screen.getByRole("option", { name: "Gamma" }));
    expect(onChange).toHaveBeenCalledWith("c");
    await closed();
  });

  it("moves with the arrow keys, picks with Enter, and keeps focus on the trigger", async () => {
    const { user, onChange, trigger } = setup({ value: "b" });
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("option", { name: "Beta" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith("c");
    await closed();
    expect(trigger).toHaveFocus();
  });

  it("supports Home / End and Space", async () => {
    const { user, onChange, trigger } = setup({ value: "b" });
    trigger.focus();
    await user.keyboard("{ArrowDown}{End}{ }");
    expect(onChange).toHaveBeenLastCalledWith("c");
    await closed();

    await user.keyboard("{ArrowUp}{Home}{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("a");
  });

  it("closes on Escape (without leaking it to listeners further up) and on an outside click", async () => {
    const { user, onChange, trigger } = setup();
    const onDocKey = vi.fn();
    document.addEventListener("keydown", onDocKey);

    await user.click(trigger);
    await user.keyboard("{Escape}");
    await closed();
    expect(onDocKey.mock.calls.some(([e]) => e.key === "Escape")).toBe(false);

    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "outside" }));
    await closed();
    expect(onChange).not.toHaveBeenCalled();

    document.removeEventListener("keydown", onDocKey);
  });

  it("does not call onChange for the option that is already selected", async () => {
    const { user, onChange, trigger } = setup();
    await user.click(trigger);
    await user.click(screen.getByRole("option", { name: "Alpha" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not open when disabled", async () => {
    const { user, trigger } = setup({ disabled: true });
    await user.click(trigger);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});

describe("floating lists and window resizing", () => {
  it("a Select closes cleanly when the window is resized (no error)", async () => {
    const { user, trigger } = setup();
    await user.click(trigger);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    await closed();
  });

  it("a Menu closes cleanly when the window is resized (no error)", async () => {
    const user = userEvent.setup();
    render(
      <Menu
        trigger={({ ref, props }) => (
          <button ref={ref} {...props}>
            Open menu
          </button>
        )}
        items={[{ label: "One", onClick: () => {} }]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    expect(
      await screen.findByRole("menuitem", { name: "One" }),
    ).toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    await waitFor(() =>
      expect(
        screen.queryByRole("menuitem", { name: "One" }),
      ).not.toBeInTheDocument(),
    );
  });
});
