import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Select } from "../src/components/ui/Select";

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
