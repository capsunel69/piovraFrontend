# Notes (Journals)

**Route:** `/notes`

## Features

- **Rich text** editor (TipTap): headings, lists, links, formatting.
- **Title**, **date**, optional **tags**.
- **PIN / gate** flow for sensitive journals (when enabled in context): verify before showing content.
- **Search** across title, body, and tags (server search with local fallback).

## AI integration

- Skills use the `piovra.notes.*` / journal naming in Piovra; snapshot includes **recent notes** with short content previews for context.

## API

- **`/v1/journals`** (legacy name “journals” in the API). Create/update/delete map to the same entities you see in the UI.
