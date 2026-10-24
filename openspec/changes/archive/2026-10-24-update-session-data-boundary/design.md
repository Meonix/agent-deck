## Context

SRS-NFR-007 was written when the app only read session files and drove Claude Code in panes. CR-012 makes the
app start short `claude -p` runs that read session text; Claude Code forwards it to Anthropic as it does for any
session. The rule must say where that boundary is so `add-session-progress` can be checked against it.

## Goals / Non-Goals

**Goals:** state the single allowed route (through Claude Code) and the condition (Progress Tracking on).

**Non-Goals:** how summaries are produced, which model, flags or data — all in `add-session-progress`
(SRS-NFR-011, SRS-NFR-012, SRS-NFR-013).

## Decisions

- D1: keep the requirement in `session-history` and modify it in place rather than adding a second rule in a new
  capability, so one place states what may leave the machine.
- D2: keep the existing scenario ("Listing opens no connection") and add two: an untracked session sends nothing,
  a tracked session sends only through Claude Code.

## Risks / Trade-offs

- The tracked-session scenario can only be checked once `add-session-progress` exists → its verification task
  lives there; this change is verified by `openspec validate --strict` and the grep in tasks.
