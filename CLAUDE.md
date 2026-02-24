# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Initial setup (install deps, generate Prisma client, run migrations)
npm run setup

# Development server (Turbopack)
npm run dev

# Build for production
npm run build

# Lint
npm run lint

# Run all tests
npm test

# Run a single test file
npx vitest run src/lib/__tests__/file-system.test.ts

# Reset database
npm run db:reset
```

All `npm run` scripts automatically prepend `NODE_OPTIONS='--require ./node-compat.cjs'` for Node.js compatibility — this is handled in `package.json` and should not be removed.

## Architecture

UIGen is an AI-powered React component generator. Users describe components in a chat; Claude generates JSX files into a virtual file system; a sandboxed iframe renders a live preview.

### Core Data Flow

1. User sends a chat message → `POST /api/chat` (`src/app/api/chat/route.ts`)
2. The API calls Claude (or `MockLanguageModel` if no API key) with two tools: `str_replace_editor` and `file_manager`
3. Tool calls stream back to the client and are handled by `FileSystemContext.handleToolCall`
4. The virtual file system updates trigger a re-render of `PreviewFrame`
5. `PreviewFrame` transforms files with Babel standalone → blob URLs → ES module import map → `<iframe srcdoc>`

### Virtual File System (`src/lib/file-system.ts`)

`VirtualFileSystem` is an in-memory tree — no files are written to disk. It supports create/read/update/delete/rename operations plus `str_replace` and `insert` text-editor commands used by the AI tools. On the server (`/api/chat`), a fresh `VirtualFileSystem` is reconstructed from serialized `FileNode` records sent in the request body.

### Context Providers

Two React contexts wrap the entire UI in `main-content.tsx`:

- **`FileSystemProvider`** (`src/lib/contexts/file-system-context.tsx`) — owns the `VirtualFileSystem` instance and exposes file operations + `handleToolCall` which dispatches incoming AI tool calls to the right VFS methods.
- **`ChatProvider`** (`src/lib/contexts/chat-context.tsx`) — uses Vercel AI SDK's `useChat`, attaches `onToolCall` to forward AI tool calls into `FileSystemProvider.handleToolCall`, and serializes the current VFS state into every request body.

### Preview Pipeline (`src/lib/transform/jsx-transformer.ts`)

`createImportMap` transforms all `.js/.jsx/.ts/.tsx` files via `@babel/standalone`, creates blob URLs, and builds an ES module import map. Third-party npm imports are automatically routed to `https://esm.sh/<package>`. Missing local imports get auto-generated placeholder modules. The resulting HTML is injected as `iframe.srcdoc`.

Entry point resolution order: `/App.jsx` → `/App.tsx` → `/index.jsx` → `/index.tsx` → `/src/App.jsx` → first `.jsx/.tsx` file found.

### AI Tools

Defined in `src/lib/tools/`:
- `str_replace_editor` — supports `create`, `str_replace`, and `insert` commands operating on the VFS
- `file_manager` — supports `rename` and `delete`

### Generated Component Conventions (from system prompt in `src/lib/prompts/generation.tsx`)

- Every project must have `/App.jsx` as the root entry with a default export
- Use `@/` alias for all local imports (e.g., `import Foo from '@/components/Foo'`)
- Style with Tailwind CSS only — no hardcoded styles
- No HTML files; `/App.jsx` is the sole entry point

### Authentication (`src/lib/auth.ts`)

Custom JWT auth using `jose`. Sessions are stored in an httpOnly `auth-token` cookie (7-day expiry). Passwords are hashed with `bcrypt`. The middleware at `src/middleware.ts` is present but route protection is handled server-side in page components. Anonymous users are fully supported — their in-progress work is tracked in `src/lib/anon-work-tracker.ts` and can be migrated upon sign-up.

### Database

Prisma with SQLite (`prisma/dev.db`). Two models: `User` and `Project`. A `Project` stores `messages` (JSON string of chat history) and `data` (JSON string of the serialized VFS). Prisma client is generated to `src/generated/prisma`.

### Provider / Model Selection (`src/lib/provider.ts`)

`getLanguageModel()` returns `anthropic("claude-haiku-4-5")` when `ANTHROPIC_API_KEY` is set, or a `MockLanguageModel` otherwise. The mock produces static counter/form/card components across 4 agentic steps and is useful for development without API costs.

## Code Style

Use comments sparingly. Only comment complex code.

### Testing

Vitest with jsdom environment and `@testing-library/react`. Tests live in `__tests__` subdirectories alongside source. `vite-tsconfig-paths` enables the `@/` alias in tests.
