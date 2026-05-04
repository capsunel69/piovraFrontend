# Timer bar

The **sticky timer** appears at the top of the workspace when a task timer is active (docked with the layout, not a separate route).

## Behaviour

- **Start** on a task from the Tasks page (or flows that start the timer).
- **Pause / resume** and **stop**; stopping can persist a **session** on the task.
- **Break time** may be tracked depending on configuration.
- Timer state is partially restored from **localStorage** after reload.

## AI

- The assistant does not control the UI timer directly; it operates on **tasks** and their persisted timer data via Piovra.
