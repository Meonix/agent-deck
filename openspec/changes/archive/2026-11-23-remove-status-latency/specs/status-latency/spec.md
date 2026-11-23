## REMOVED Requirements

### Requirement: Record Status Highlight timing (SRS-FR-038)
**Reason**: CR-015 removes status latency recording from the app; BO-01 is checked by the PO while using the app, and SRS-FR-034 (Status Highlight within 3 seconds) stays and is still tested.
**Migration**: None in the app. Existing `status-latency.jsonl` stays on disk untouched; the app no longer writes or prunes it.
