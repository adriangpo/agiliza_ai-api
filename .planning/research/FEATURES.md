# Feature Landscape — Municipal Citizen Reporting / 311-Style API

**Domain:** Civic complaint management — multi-tenant, mobile-first
**Researched:** 2026-03-23
**Confidence note:** WebSearch and WebFetch were unavailable. Findings draw on
training-data knowledge of Open311 GeoReport v2, SeeClickFix, FixMyStreet,
CivicPlus 311, and Salesforce Public Sector. Confidence is HIGH for table-stakes
features (universal across all implementations) and MEDIUM for differentiators
(observed in multiple but not all platforms). All claims cross-referenced against
the SRS rules in `.planning/PROJECT.md`.

---

## Table Stakes

Features every citizen-reporting platform ships. Missing = the product is
unusable or indistinguishable from a generic form tool.

| Feature | Why Expected | Complexity | SRS Reference | Notes |
|---------|--------------|------------|---------------|-------|
| **Complaint submission with category** | Core action of the system. No category = no routing. | Low | RN-001, US-01 | Category drives clustering, routing, and display |
| **Geolocated submission (lat/lng)** | "Where is the problem?" is the first question any manager asks. | Low | RN-003, RN-004 | PostGIS point; GPS proximity validation on intake |
| **GPS proximity validation** | Prevents remote/fraudulent reports — standard in Open311 | Low | RN-003 | Block if reporter is >200m from pinned location |
| **GPS accuracy gate** | Low-accuracy fix creates bad data on map views | Low | US-01 | Block if accuracy worse than 50m |
| **Photo/media attachment** | Infrastructure problems are always "show, don't tell" | Medium | RN-014, RN-016 | EXIF strip on public delivery; private bucket 90 days |
| **Ticket status lifecycle** | Citizens expect to know if their report was acted on | Low | RN-008, RN-009 | ABERTA → EM_ANALISE → RESOLVIDA / FECHADA |
| **Status push notifications** | Without this, the platform is a black hole | Medium | RN-019 | Status change and moderation events |
| **User registration + authentication** | Required for accountability, rate limiting, and notifying the reporter | Low | RN-001 | Email/password + OAuth (Google/Apple) |
| **Rate limiting on submissions** | Prevents spam flooding — present in every serious deployment | Low | RN-002, RNF-08 | 5 publications per rolling 24h per user |
| **Manager review queue** | Reports go nowhere without a human decision surface | Medium | US-04 | Flag queue with evidence: flaggers, ML score, timestamps |
| **Manager status transitions** | Operators need to move tickets through lifecycle | Low | US-04, US-05 | Resolve, close, reopen (with business rules) |
| **Audit log of moderation actions** | Legal / accountability requirement for government systems | Low | RNF-07 | Who, when, why — append-only |
| **Multi-tenancy (per-municipality isolation)** | SaaS civic platform without tenant isolation is a liability | High | RLS section | PostgreSQL RLS; middleware-enforced context |
| **Anonymous/pseudonymous public display** | Privacy law in Brazil (LGPD) and political safety | Low | RN-001, RN-005 | Show only name + join date; delete = anonymize to "Cidadão Anônimo" |
| **Comment thread on a ticket** | Community context for managers; shows recurrence | Medium | RN-011, RN-012 | Frozen after 30 days post-resolution |
| **Basic feed / list of reports** | Citizens and managers need to browse existing reports | Low | RN-017, RN-018 | Ordered by relevance score |

---

## Differentiators

Features that elevate a 311 platform from "form tool" to a civic intelligence
layer. Not universally expected but drive adoption and manager efficiency.

| Feature | Value Proposition | Complexity | SRS Reference | Notes |
|---------|-------------------|------------|---------------|-------|
| **Spatial clustering (automatic incident grouping)** | Surfaces systemic problems vs. one-offs; reduces duplicate work for managers | High | RN-006, RN-007 | 3+ same-category reports within 50m / 7 days → parent incident; cascade resolution |
| **Cluster cascade resolution** | Resolving one parent closes all children — managers handle a wave with one action | Medium | RN-007 | Sends conclusion note to each child (US-05) |
| **Reopening with cluster detach** | Prevents unfair cluster closure from locking valid re-reports | Medium | RN-008, RN-009 | 15-day window; 1 reopen allowed; second closure is final |
| **Relevance scoring feed** | Prioritizes community heat over raw chronology; mirrors social platform UX citizens already know | Medium | RN-017, RN-018 | (Likes×0.5)+(Comments×1.0)+(Shares×1.5); cluster ×2 multiplier |
| **Resident vs. Tourist classifier** | Provides context for managers (recurring resident vs. one-time visitor) | Low | RN-004 | Self-declared on submission; useful for analytics |
| **ML image content screening** | Catches inappropriate/NSFW content at upload time without human review latency | High | RN-014 | Score ≥ 0.95 → Auto-Hide; pluggable HTTP adapter; mockable in tests |
| **Collaborative flagging with threshold logic** | Community moderation scales with volume; reduces moderator load | Medium | RN-012, RN-013, RN-015 | 3 unique flags → Soft Hide + queue; per-user and per-IP rate limits |
| **Malicious flag pattern detection** | Prevents coordinated attack vectors (flag-bombs) | High | RN-020 | Progressive: warning → 24h → 7d → suspension |
| **EXIF scrubbing + private archival** | Privacy protection (LGPD alignment) + forensic retention for managers | Medium | RN-016, RNF-02 | Public delivery strips EXIF; original in private bucket 90 days |
| **Notification center (in-app)** | Push notifications alone can be missed; a durable inbox improves engagement | Medium | RN-019 | Stored per-user; queryable by mobile app |
| **Idempotent cluster creation** | Race conditions under concurrent submissions produce duplicate clusters in naive implementations | High | RNF-04 | DB-level locking or atomic upsert required |

---

## Anti-Features

Things to deliberately NOT build in v1. Each has a reason and a stated alternative.

| Anti-Feature | Why Avoid | What to Do Instead | SRS Status |
|--------------|-----------|-------------------|------------|
| **Publication editing after submission** | Opens abuse vectors (edit content after moderation passes); complicates audit trail | Lock submissions; offer delete-while-ABERTA as escape hatch (RN-010) | Deferred to v1.1 |
| **Temporal relevance decay on feed score** | Requires tuning, increases query complexity, and invalidates cached scores continuously | Ship flat relevance score first; validate whether recency matters empirically | Deferred to v2.0 |
| **Per-publication image count limit enforcement** | Undecided in SRS (recommended 5, not specified) — implement a limit without spec = future breaking change | Accept images; defer enforcement limit to when SRS finalises | In backlog |
| **Offline / map fallback mode** | Frontend concern; the API cannot enforce or improve this | Document cache-friendly endpoints; let mobile app handle offline UX | Out of scope |
| **In-platform assignment / routing to city department** | Full CRM-style workflow is a different product (ServiceNow, Salesforce Public Sector) | Manager manually decides; routing is a v2 feature once workflow is understood | Not in SRS v1 |
| **SLA / deadline tracking per ticket** | Adds policy complexity (each city has different SLAs) that cannot be validated before launch | Audit log + timestamps give raw material; SLA layer is a future config option | Not in SRS v1 |
| **Public API (Open311-compatible export)** | Open311 compliance requires schema alignment work and versioning guarantees not yet needed | Internal API only in v1; Open311 adapter is a v2 integration path | Not in SRS v1 |
| **Citizen-to-manager direct messaging** | Creates unmonitored communication channels; moderation scope explodes | Comment thread on the public ticket handles the communication surface | Not in SRS v1 |
| **Duplicate detection (user-facing "similar reports" UI)** | Backend clustering already handles the data layer; the presentation layer is a mobile/frontend concern | Expose cluster membership in the report response so the app can surface it | Out of scope |
| **Gamification / points / badges** | Engagement mechanics before core workflow is validated is premature optimization | Relevance scoring provides implicit community signal without gamification overhead | Not in SRS v1 |

---

## Feature Dependencies

```
User Auth
  └─► Submission (rate limiting requires identity)
        └─► Geo Validation (submission depends on geo check passing)
        └─► Media Upload + EXIF scrub (submission can carry media)
              └─► ML Image Screening (media triggers screening)
        └─► Ticket Lifecycle (ABERTA on creation)
              └─► Spatial Clustering (clustering triggers when 3+ tickets exist)
                    └─► Cluster Cascade Resolution (parent resolution cascades)
              └─► Reopening Logic (reopening depends on lifecycle state + cluster membership)
              └─► Comment Thread (comments depend on ticket + freeze rule)
                    └─► Comment Flagging (flagging depends on comment existing)
              └─► Publication Flagging (flagging depends on publication existing)
                    └─► Malicious Flag Detection (depends on flagging data volume)
        └─► Relevance Scoring (depends on likes + comments + shares + cluster state)
        └─► Push Notifications (depends on ticket status changes)

Manager Auth (separate role)
  └─► Manager Review Queue (depends on flagged items existing)
  └─► Moderation Actions (depends on queue)
        └─► Audit Log (every moderation action writes a log entry)

Multi-Tenancy (cross-cutting)
  └─► ALL features above (tenant context required on every query)
```

---

## MVP Recommendation

Prioritize in this order for the first shippable milestone:

1. **Auth + Multi-Tenancy** — everything else is a tenant-scoped operation
2. **Submission + Geo Validation** — the core citizen action
3. **Media Upload + EXIF scrub** — required to make reports actionable for managers
4. **Ticket Lifecycle + Status Transitions** — without this there is no resolution path
5. **Manager Queue + Moderation** — platform is unusable for operators without this
6. **Push Notifications** — retention collapses without status feedback

Defer until core is stable:
- **Spatial Clustering** — technically complex, idempotency-sensitive; ship after submission is solid
- **Relevance Scoring** — requires likes/comments/shares to have volume to be meaningful
- **ML Image Screening** — pluggable adapter; ship with mock first, wire real service later
- **Malicious Flag Detection** — depends on flagging volume that won't exist at launch

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Table stakes list | HIGH | Universal across Open311, FixMyStreet, SeeClickFix, CivicPlus, and Brazil's e-SIC/ouvidoria systems |
| Differentiators list | MEDIUM | Observed in 2+ major platforms; specific thresholds (200m, 50m, 3 flags, 15 days) come from SRS — not generic market data |
| Anti-features | HIGH | Derived directly from SRS out-of-scope decisions and known civic-tech failure patterns |
| Feature dependencies | HIGH | Logical derivation from SRS business rules; not platform-specific |

---

## Sources

- Open311 GeoReport v2 spec (training data, HIGH confidence for field list and status model)
- FixMyStreet open-source codebase patterns (training data, MEDIUM confidence)
- SeeClickFix feature set as of 2024 (training data, MEDIUM confidence)
- `.planning/PROJECT.md` SRS v1.4 Gold Master Final — authoritative for all project-specific rules
- All threshold values (200m, 50m, 5/day, 3 flags, 15 days, 90 days, etc.) sourced exclusively from SRS — HIGH confidence
