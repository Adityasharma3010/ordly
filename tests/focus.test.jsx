import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  focusQueue,
  formatClock,
  orderQueue,
  skipItem,
} from "../src/utils/focus";
import { FocusMode } from "../src/components/focus/FocusMode";

const item = (id, text, extra = {}) => ({
  id,
  text,
  has_checkbox: true,
  completed: false,
  parent_id: null,
  position: 0,
  notes: "",
  tags: [],
  priority: 0,
  due_date: null,
  due_time: null,
  created_at: "2026-01-01T00:00:00Z",
  ...extra,
});

const items = [
  item("a", "Plan trip", { position: 1 }),
  item("b", "Book flights", { parent_id: "a", position: 1 }),
  item("c", "Pack bag", { parent_id: "a", position: 2 }),
  item("d", "Water plants", { position: 2 }),
  item("e", "Heading only", { position: 3, has_checkbox: false }),
  item("f", "Already done", { position: 4, completed: true }),
];

describe("focus queue", () => {
  it("lists only open tasks at the bottom of each branch, with their path", () => {
    const q = focusQueue(items);
    expect(q.map((x) => x.item.text)).toEqual([
      "Book flights",
      "Pack bag",
      "Water plants",
    ]);
    expect(q[0].path).toEqual(["Plan trip"]);
    expect(q[2].path).toEqual([]);
  });

  it("puts skipped tasks last, in the order they were skipped", () => {
    const q = focusQueue(items);
    const skipped = skipItem(skipItem([], "b"), "c");
    expect(orderQueue(q, skipped).map((x) => x.item.id)).toEqual([
      "d",
      "b",
      "c",
    ]);
    // skipping again sends it to the back
    expect(skipItem(skipped, "b")).toEqual(["c", "b"]);
  });

  it("formats the clock", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(75)).toBe("1:15");
    expect(formatClock(3725)).toBe("1:02:05");
  });
});

function Harness() {
  const [list, setList] = useState({ id: "l", title: "Trip", items });
  return (
    <FocusMode
      open
      onClose={() => {}}
      list={list}
      onToggle={(id, completed) =>
        setList((l) => ({
          ...l,
          items: l.items.map((i) => (i.id === id ? { ...i, completed } : i)),
        }))
      }
    />
  );
}

async function ready() {
  const dialog = await screen.findByRole("dialog");
  await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  return dialog;
}

describe("FocusMode", () => {
  it("shows one task, moves on when done, and can undo", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await ready();
    expect(screen.getByRole("heading", { name: "Book flights" })).toBeInTheDocument();
    expect(screen.getByText("3 tasks left")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^done$/i }));
    expect(
      await screen.findByRole("heading", { name: "Pack bag" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /undo/i }));
    expect(
      await screen.findByRole("heading", { name: "Book flights" }),
    ).toBeInTheDocument();
  });

  it("skips to the next task and keyboard shortcuts work", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await ready();
    await user.click(screen.getByRole("button", { name: /skip for now/i }));
    expect(
      await screen.findByRole("heading", { name: "Pack bag" }),
    ).toBeInTheDocument();
    await user.keyboard("d");
    expect(
      await screen.findByRole("heading", { name: "Water plants" }),
    ).toBeInTheDocument();
    await user.keyboard("d");
    // the skipped one comes back last
    expect(
      await screen.findByRole("heading", { name: "Book flights" }),
    ).toBeInTheDocument();
    await user.keyboard("d");
    expect(
      await screen.findByRole("heading", { name: "All clear" }),
    ).toBeInTheDocument();
  });

  it("counts time on the current task", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await ready();
    expect(screen.getByTestId("focus-clock")).toHaveTextContent("0:00");
    await user.click(screen.getByRole("button", { name: /start timer/i }));
    await waitFor(
      () => expect(screen.getByTestId("focus-clock")).toHaveTextContent("0:01"),
      { timeout: 3000 },
    );
    expect(screen.getByRole("button", { name: /pause timer/i })).toBeInTheDocument();
  });
});
