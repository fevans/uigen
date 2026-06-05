"use client";

import type { ToolInvocation } from "ai";
import { Loader2 } from "lucide-react";

interface ToolInvocationMessageProps {
  toolInvocation: ToolInvocation;
}

// Extract the file name from a virtual FS path, e.g. "/components/Card.jsx" -> "Card.jsx"
function basename(path?: unknown): string | null {
  if (typeof path !== "string" || path.trim() === "") {
    return null;
  }
  const parts = path.split("/").filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : null;
}

type Tense = "present" | "past";

// Pick the verb form based on whether the tool call has finished executing.
function verb(present: string, past: string, tense: Tense): string {
  return tense === "past" ? past : present;
}

export function getToolInvocationLabel(toolInvocation: ToolInvocation): string {
  const { toolName, state } = toolInvocation;
  const args = (toolInvocation.args ?? {}) as Record<string, unknown>;
  const tense: Tense = state === "result" ? "past" : "present";
  const command = typeof args.command === "string" ? args.command : undefined;
  const file = basename(args.path);
  const target = file ? ` ${file}` : "";

  if (toolName === "str_replace_editor") {
    switch (command) {
      case "create":
        return `${verb("Creating", "Created", tense)} file${target}`;
      case "str_replace":
      case "insert":
        return `${verb("Editing", "Edited", tense)}${target}`;
      case "view":
        return `${verb("Viewing", "Viewed", tense)}${target}`;
      case "undo_edit":
        return `${verb("Reverting", "Reverted", tense)}${target}`;
    }
  }

  if (toolName === "file_manager") {
    switch (command) {
      case "rename": {
        const newFile = basename(args.new_path);
        const suffix = newFile ? ` → ${newFile}` : "";
        return `${verb("Renaming", "Renamed", tense)}${target}${suffix}`;
      }
      case "delete":
        return `${verb("Deleting", "Deleted", tense)}${target}`;
    }
  }

  // Fallback for unknown tools/commands or partial calls without args, so we
  // never surface the raw tool name to the user.
  return verb("Working…", "Done", tense);
}

export function ToolInvocationMessage({
  toolInvocation,
}: ToolInvocationMessageProps) {
  const isComplete =
    toolInvocation.state === "result" && toolInvocation.result != null;
  const label = getToolInvocationLabel(toolInvocation);

  return (
    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs font-mono border border-neutral-200">
      {isComplete ? (
        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
      ) : (
        <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
      )}
      <span className="text-neutral-700">{label}</span>
    </div>
  );
}
