# Tasks

**Route:** `/tasks`

## Features

- **Create** tasks with title, description, priority (`low` / `medium` / `high`), optional **due date**, and optional **order** for manual sorting.
- **Subtasks** (checklist) on each task: add, rename, complete, delete.
- **Timer sessions** per task: start/pause/resume/stop; time accrues on the task and is persisted via Piovra.
- **Complete / reopen** tasks without deleting them.
- **Delete** tasks permanently (and associated subtasks/timers per API rules).
- **Convert from reminder** metadata when a task was created from a reminder.

## AI integration

- The assistant can create/update/complete/delete tasks via **Piovra skills** (`piovra.tasks.*`). The chat snapshot lists task **ids** so the model can act without listing first when the item is visible there.

## Persistence

- Changes go to **`/v1/tasks`** (GET list, POST create, PATCH update, DELETE). Failed writes surface toasts; local cache may still show optimistic state until refresh.
