# Editing this documentation

## Where content lives

- **Markdown articles:** `src/docs/articles/*.md`
- **Registry (titles, sections, search keywords, imports):** `src/docs/registry.ts`

## How to add a new article

1. Create `src/docs/articles/XX-my-topic.md` (use a numeric prefix to keep ordering predictable).
2. Open **`src/docs/registry.ts`** and append one object to **`DOC_ARTICLES`**:
   - `id` — stable slug for URLs (`?article=id`).
   - `title` — shown in the sidebar list.
   - `section` — grouping label (Introduction, Workspace, AI, …).
   - `keywords` — extra search terms not already in the body (comma or space separated string).
   - `body` — `import text from './articles/XX-my-topic.md?raw'` and use `body: text`.

3. Run **`npm run build`** (or `npm run dev`) so Vite picks up the new `?raw` import.

## Search

- The Documentation page searches **title, section, keywords, and full markdown body** (case-insensitive, all words must match somewhere).

## Style tips

- Use `#` / `##` headings, bullet lists, and **tables** (GitHub-flavored markdown is enabled).
- Keep environment variable names in backticks: `` `VITE_PIOVRA_BASE_URL` ``.
