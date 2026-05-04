# Reminders

**Route:** `/reminders`

## Features

- **One-off reminders** with title, description, and fire **date/time**.
- **Recurring** options: daily, weekly (pick weekday), monthly (day-of-month or “nth weekday” patterns) depending on the form.
- **Complete** a firing instance; recurring reminders track **completed instances** and optional **conversion to task** metadata.
- **Convert to task** when you want a reminder to become actionable work (links reminder ↔ task in the API).

## AI integration

- Skills: `piovra.reminders.*`. Snapshot lists active reminders for natural language like “snooze the standup reminder”.

## Persistence

- **`/v1/reminders`**. The app may reconcile conversion flags against real tasks after load.
