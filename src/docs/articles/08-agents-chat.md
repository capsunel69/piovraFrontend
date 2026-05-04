# Agents & AI chat

## Agents hub — `/agents`

Tabs (URL query `?tab=`):

| Tab | Purpose |
|-----|--------|
| **Agents** | **Definitions**: model, system prompt, **skills** list, temperature/token limits. |
| **Instances** | **Instances** of a definition — what actually runs in chat or on a schedule. |
| **Schedules** | **Cron jobs** that POST input to an instance on a timetable (timezone-aware where configured). |
| **Reports** | **Outputs** from scheduled runs (markdown-friendly). |
| **Runs** | **Execution history**: user input, steps (tool calls, results), final assistant text, errors. |
| **Usage** | **Token / cost** aggregates per model and instance. |

Definitions and instances are stored in Piovra; the UI uses **`/v1/definitions`**, **`/v1/instances`**, **`/v1/runs`**, **`/v1/jobs`**, **`/v1/usage`**.

## Floating chat

- Opens from the **chat bubble**; streams **SSE** from **`/v1/orchestrate`**.
- Sends **workspace snapshot** text each turn (tasks, meetings, reminders, journals, contacts).
- Supports **images** on capable models (see orchestrate client limits).
- **Needs consent** events redirect you to Google scope upgrade when a skill lacks OAuth scopes.

## Chat context provider

- **`ChatProvider`** wires instance selection, orchestrate calls, and optional **voice** entry points where implemented.
