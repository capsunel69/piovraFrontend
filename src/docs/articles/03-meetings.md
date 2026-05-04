# Meetings

**Route:** `/meetings`

## Features

- **Schedule** meetings with title, description, **start date/time**, **duration** (minutes), optional **participants** (list), and **notes** (agenda).
- **Mark complete** or reopen.
- **Edit** or **delete** meetings.
- List is ordered for upcoming work; the dashboard highlights meetings **within a few days** when applicable.

## AI integration

- Skills: `piovra.meetings.*` for create/list/update/complete/delete. Snapshot includes meetings near the current date window for referent resolution.

## API

- Piovra stores `durationMinutes`; the UI maps to `duration` in minutes.
