import { test, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { ToolInvocation } from "ai";
import {
  ToolInvocationMessage,
  getToolInvocationLabel,
} from "../ToolInvocationMessage";

vi.mock("lucide-react", () => ({
  Loader2: ({ className }: { className?: string }) => (
    <div className={className} data-testid="spinner">
      Loader2
    </div>
  ),
}));

afterEach(() => {
  cleanup();
});

// Build a tool-invocation fixture in a given state with the supplied args.
function invocation(
  toolName: string,
  args: Record<string, unknown>,
  state: ToolInvocation["state"] = "call"
): ToolInvocation {
  const base = { toolCallId: "id", toolName, args } as any;
  return state === "result" ? { ...base, state, result: "ok" } : { ...base, state };
}

// --- getToolInvocationLabel: str_replace_editor ---

test("create: present and past tense with filename", () => {
  const args = { command: "create", path: "/components/Card.jsx" };
  expect(getToolInvocationLabel(invocation("str_replace_editor", args, "call"))).toBe(
    "Creating file Card.jsx"
  );
  expect(
    getToolInvocationLabel(invocation("str_replace_editor", args, "result"))
  ).toBe("Created file Card.jsx");
});

test("str_replace maps to Editing/Edited", () => {
  const args = { command: "str_replace", path: "/App.jsx" };
  expect(getToolInvocationLabel(invocation("str_replace_editor", args, "call"))).toBe(
    "Editing App.jsx"
  );
  expect(
    getToolInvocationLabel(invocation("str_replace_editor", args, "result"))
  ).toBe("Edited App.jsx");
});

test("insert also maps to Editing/Edited", () => {
  const args = { command: "insert", path: "/App.jsx" };
  expect(getToolInvocationLabel(invocation("str_replace_editor", args, "call"))).toBe(
    "Editing App.jsx"
  );
  expect(
    getToolInvocationLabel(invocation("str_replace_editor", args, "result"))
  ).toBe("Edited App.jsx");
});

test("view maps to Viewing/Viewed", () => {
  const args = { command: "view", path: "/components/Card.jsx" };
  expect(getToolInvocationLabel(invocation("str_replace_editor", args, "call"))).toBe(
    "Viewing Card.jsx"
  );
  expect(
    getToolInvocationLabel(invocation("str_replace_editor", args, "result"))
  ).toBe("Viewed Card.jsx");
});

test("undo_edit maps to Reverting/Reverted", () => {
  const args = { command: "undo_edit", path: "/App.jsx" };
  expect(getToolInvocationLabel(invocation("str_replace_editor", args, "call"))).toBe(
    "Reverting App.jsx"
  );
  expect(
    getToolInvocationLabel(invocation("str_replace_editor", args, "result"))
  ).toBe("Reverted App.jsx");
});

// --- getToolInvocationLabel: file_manager ---

test("rename includes both file names", () => {
  const args = {
    command: "rename",
    path: "/components/Card.jsx",
    new_path: "/components/Card2.jsx",
  };
  expect(getToolInvocationLabel(invocation("file_manager", args, "call"))).toBe(
    "Renaming Card.jsx → Card2.jsx"
  );
  expect(getToolInvocationLabel(invocation("file_manager", args, "result"))).toBe(
    "Renamed Card.jsx → Card2.jsx"
  );
});

test("delete maps to Deleting/Deleted", () => {
  const args = { command: "delete", path: "/components/Card.jsx" };
  expect(getToolInvocationLabel(invocation("file_manager", args, "call"))).toBe(
    "Deleting Card.jsx"
  );
  expect(getToolInvocationLabel(invocation("file_manager", args, "result"))).toBe(
    "Deleted Card.jsx"
  );
});

// --- Fallbacks ---

test("missing path omits the filename", () => {
  const args = { command: "create" };
  expect(getToolInvocationLabel(invocation("str_replace_editor", args, "call"))).toBe(
    "Creating file"
  );
});

test("unknown command falls back to generic label", () => {
  const args = { command: "frobnicate", path: "/App.jsx" };
  expect(getToolInvocationLabel(invocation("str_replace_editor", args, "call"))).toBe(
    "Working…"
  );
  expect(
    getToolInvocationLabel(invocation("str_replace_editor", args, "result"))
  ).toBe("Done");
});

test("partial call with empty args never shows the raw tool name", () => {
  const label = getToolInvocationLabel(
    invocation("str_replace_editor", {}, "partial-call")
  );
  expect(label).toBe("Working…");
  expect(label).not.toContain("str_replace_editor");
});

// --- Component render ---

test("completed invocation shows label and green dot, not spinner", () => {
  const { container } = render(
    <ToolInvocationMessage
      toolInvocation={invocation(
        "str_replace_editor",
        { command: "create", path: "/components/Card.jsx" },
        "result"
      )}
    />
  );

  expect(screen.getByText("Created file Card.jsx")).toBeDefined();
  expect(screen.queryByTestId("spinner")).toBeNull();
  expect(container.querySelector(".bg-emerald-500")).not.toBeNull();
});

test("in-progress invocation shows spinner, not dot", () => {
  const { container } = render(
    <ToolInvocationMessage
      toolInvocation={invocation(
        "str_replace_editor",
        { command: "create", path: "/components/Card.jsx" },
        "call"
      )}
    />
  );

  expect(screen.getByText("Creating file Card.jsx")).toBeDefined();
  expect(screen.getByTestId("spinner")).toBeDefined();
  expect(container.querySelector(".bg-emerald-500")).toBeNull();
});
