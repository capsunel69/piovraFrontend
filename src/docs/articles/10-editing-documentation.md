## For people updating the help articles

These guides are **plain Markdown files** plus a small registry so search works.

### Files

- **Articles:** folder `src/docs/articles/` — one topic per file, use `##` headings inside (the app shows the title separately).
- **List & search:** `src/docs/registry.ts` — each article needs an entry with **id**, **title**, **section**, **keywords**, and an **import** of the `.md` file as raw text.

### Add a new guide

1. Create `src/docs/articles/XX-short-name.md`.
2. In `registry.ts`, add `import bodyXX from './articles/XX-short-name.md?raw'` and append to the `DOC_ARTICLES` array.
3. Rebuild or run dev; search picks up **title, section, keywords, and full text**.

### Link to a specific guide

Use the URL query **`?article=`** plus the **id** from the registry (example: `?article=tasks`).
