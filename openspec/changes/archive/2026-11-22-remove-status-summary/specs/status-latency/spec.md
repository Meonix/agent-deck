## REMOVED Requirements

### Requirement: Status latency report (SRS-FR-039)
**Reason**: CR-014 removes the Status Latency button and report from the app.
**Migration**: The PO computes the share of state changes shown within 3 seconds over the last 14 days directly from `status-latency.jsonl`, which SRS-FR-038 keeps writing in the same format.
