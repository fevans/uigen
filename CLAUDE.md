# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

UIGen is an AI-powered React component generator. The user describes a component in a chat; Claude (via the Vercel AI SDK) edits a **virtual file system** through tool calls, and the result is rendered live in an iframe preview. No generated files are ever written to disk — everything lives in memory and (for signed-in users) is persisted as JSON in SQLite.

## Commands

```bash
npm run setup        # install deps, generate Prisma client, run migrations (run first)
npm run dev          # dev server with Turbopack at http://localhost:3000
npm run dev:daemon   # same, backgrounded, logs to logs.txt
npm run build        # production build
npm run lint         # next lint
npm test             # run vitest (all tests)
npm run db:reset     # wipe and re-run migrations (destroys local data)
```

Run a single test file or filter by name:

```bash
npx vitest run src/lib/__tests__/file-system.test.ts
npx vitest run -t "creates a file"
```

- **Do not run `npm audit fix`** — dependencies are pinned to compatible versions; bumping them breaks the app.
- The app runs **without** an `ANTHROPIC_API_KEY`. When the key is missing or left as the `your-api-key-here` placeholder, `getLanguageModel()` returns `MockLanguageModel`, which streams canned counter/form/card components. Set a real key in `.env` to use Claude.

## Architecture

### The virtual file system is the core abstraction
`src/lib/file-system.ts` (`VirtualFileSystem`) is an in-memory tree of `FileNode`s keyed by absolute path. It is the single source of truth for generated code and is shared across three boundaries:

1. **Client** — `FileSystemProvider` (`src/lib/contexts/file-system-context.tsx`) holds one instance and exposes mutation methods + a `refreshTrigger` counter that components watch to re-render.
2. **Server** — the chat API reconstructs a fresh `VirtualFileSystem` per request from the serialized tree the client sends.
3. **Persistence** — `serialize()` / `deserializeFromNodes()` convert the tree to/from the JSON stored in `Project.data`.

When editing FS behavior, remember it has two parallel method sets: low-level (`createFile`, `updateFile`, …) and the tool-facing command methods (`viewFile`, `createFileWithParents`, `replaceInFile`, `insertInFile`) that return human-readable strings starting with `"Error:"` on failure.

### Tool-call round trip
The AI never touches the FS directly. The flow:
- API route `src/app/api/chat/route.ts` wires two tools onto `streamText`: `str_replace_editor` (`src/lib/tools/str-replace.ts`) and `file_manager` (`src/lib/tools/file-manager.ts`). These execute against the **server-side** FS instance so the model gets real results.
- The same tool calls stream to the client, where `handleToolCall` in the file-system context replays them against the **client-side** FS instance to keep the UI in sync.
- So tool semantics live in two places: the `execute` functions (server) and `handleToolCall` (client). Changes to a tool's command set must be made in both.

The system prompt that governs generation is `src/lib/prompts/generation.tsx` — it mandates a root `/App.jsx` default export and the `@/` import alias.

### Live preview transform
`src/lib/transform/jsx-transformer.ts` compiles the in-memory files in the browser with `@babel/standalone` (no bundler), builds an **import map** that points bare specifiers at `esm.sh` and local paths at `blob:` URLs, generates placeholder modules for not-yet-created imports, and assembles a full HTML document (with Tailwind via CDN and an error boundary) rendered into the preview iframe. This is why imports must use the `@/` alias and projects must have `/App.jsx` as the entry point.

### Auth & persistence
- JWT sessions in an httpOnly cookie via `jose` (`src/lib/auth.ts`, enforced in `src/middleware.ts`). `getSession()` is server-only.
- Prisma + SQLite. **The Prisma client is generated to `src/generated/prisma`** (not `node_modules`), configured in `prisma/schema.prisma`. Run `npx prisma generate` after schema changes.
- Anonymous users work without an account. Their messages + FS state are stashed in `sessionStorage` (`src/lib/anon-work-tracker.ts`); on sign-up/in this work is adopted into a real `Project`. Signed-in users' work is saved in the API route's `onFinish` callback.
- `src/app/page.tsx` redirects authenticated users to their most recent project (creating one if none exists); anonymous users get a project-less `MainContent`.

## Conventions
- Path alias `@/*` maps to `src/*` (tsconfig).
- Tests use Vitest + Testing Library with jsdom, colocated in `__tests__/` dirs.
- UI primitives in `src/components/ui` are shadcn-style (Radix + `class-variance-authority`); `cn()` from `src/lib/utils.ts` merges classes.
- Server Actions live in `src/actions`.
- Use comments sparingly. Only comment on complex code.
- The database schema is defined in `prisma/schema.prisma`. Reference it anytime you need to understand the structure of the data stored in the database.
