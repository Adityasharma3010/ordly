import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { SaveProvider, useSave } from "../src/contexts/SaveContext";

const latest = { current: null };
function Probe() {
  const save = useSave();
  useEffect(() => {
    latest.current = save;
  });
  return (
    <p data-testid="s">
      {save.status}:{save.failedCount}
    </p>
  );
}

describe("save queue", () => {
  it("runs writes in order, surfaces failures, and retries them", async () => {
    render(
      <SaveProvider>
        <Probe />
      </SaveProvider>,
    );
    const log = [];
    let fail = true;
    await act(async () => {
      latest.current.run(async () => {
        log.push("insert");
      });
      latest.current.run(async () => {
        log.push("update");
        if (fail) throw new Error("offline");
      });
      await latest.current.run(async () => {
        log.push("last");
      });
    });
    expect(log).toEqual(["insert", "update", "last"]);
    expect(screen.getByTestId("s")).toHaveTextContent("error:1");
    fail = false;
    await act(async () => {
      await latest.current.retry();
    });
    expect(log).toEqual(["insert", "update", "last", "update"]);
    expect(screen.getByTestId("s")).toHaveTextContent("saved:0");
  });
});
