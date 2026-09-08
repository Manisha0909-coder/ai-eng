# Provider Admin — Create & Edit Redesign

> Backend verified against `/mnt/disk/live/newton-infra` (`src/middleware/routers/connections_router.py`,
> `src/middleware/services/provider_service.py`, `src/middleware/connections/catalog/rules.py`).
> Most of what this redesign needs **already exists server-side and is simply not called.**

---

## 0. Live bug — OAuth provider creation cannot succeed

`POST /connections/providers` applies a deliberate speed bump (plan.md §6.2): setting or
changing `oauth2.authorization_url` / `oauth2.token_url` requires
`"confirm_oauth_endpoints": true` in the request body, otherwise it returns **422** and
writes nothing.

```python
# provider_service.py:136-142
if not confirm:
    raise ProviderValidationError(
        "confirm_oauth_endpoints",
        f"{fields} would send users to {', '.join(hosts)}; "
        "set 'confirm_oauth_endpoints': true to proceed",
    )
```

On create, `previous` is `None`, so **any** non-empty auth URL counts as a change
(`rules.py:182-198`). The wizard requires those URLs (`AddProviderWizard.tsx:198-202`) and
`buildDocument` never emits the flag (`:82-132`) — `grep` across `newton-ui/src` finds no
occurrence of `confirm_oauth_endpoints` anywhere.

**Therefore every `oauth2` and `oauth2_cc` creation through the wizard fails with a 422.**
Non-OAuth modes (`api_key`, `basic`, `none`) are unaffected. The backend test suite asserts
exactly this behaviour (`test_oauth_create_without_confirmation_is_422_and_writes_nothing`).

The only path that works today is hand-adding the flag in the step-4 Review textarea — it
survives because `jsonOverride` is POSTed raw, and `_split_confirmation` strips the key
before schema validation. That is almost certainly how this was exercised.

**Fix:** the confirmation gate deserves a real affordance, not a hidden boolean — see §3.

---

## 1. Context

The provider admin surface was built in four commits (`0e97b8fd` → `5035bfa7`). Creating one
working OAuth provider takes **two modal flows and two API writes**:

```
[Add provider]
   ↓
AddProviderWizard — step 1 Basics ── step 2 Auth ── step 3 API ── step 4 Review (raw JSON)
   ↓ POST /connections/providers          (spec document only — no credentials)
   ↓                                       ← 422 today, see §0
same dialog mutates into "Register {provider}" handoff screen
   ↓ "I have my credentials — configure now"  → closes itself
   ↓
ProvidersSection Configure dialog  (a different component)
   ↓ PATCH /connections/providers/{key}   (credentials, config, enabled, scopes_override)
```

And "editing" is not editing. The Configure dialog reaches only `is_enabled`, credentials,
`scopes_override`, and `config`. Key, display name, auth mode, auth URLs, base URL, and
default scopes are unreachable after creation — a typo in the token URL currently means
delete and recreate.

**Goal:** one form, every field editable, credentials collected inline, no handoff screen.

---

## 2. What the backend already provides

| Need | Status |
|---|---|
| Full-document **spec edit** | ✅ `PUT /connections/providers/{key}` (`replace_provider`, D13) — **exists, frontend never calls it** |
| Spec **validation** with a named cause | ✅ 422 `{ message, data: { rule } }` from `ProviderValidationError`; nothing is written on failure |
| `redirect_uri` **before** create | ✅ It is a per-environment constant, not per-provider — see below |
| OAuth endpoint **confirmation + destination hosts** | ✅ `confirm_oauth_endpoints` + `destination_hosts` in the response |
| Credentials at create | ❌ POST takes spec columns only; credentials go through PATCH → `SecretStore` |

### The redirect URI is a constant

```python
# src/middleware/env.py:53
OAUTH_REDIRECT_URI = f"{MIDDLEWARE_BASE_URL}/connections/oauth/callback"

# provider_service.py:68-71 — "one per environment, never per provider (plan.md §6.4)"
return OAUTH_REDIRECT_URI if auth_mode in _OAUTH_MODES else None
```

It contains **no provider key** and is identical for every provider. So the chicken-and-egg
premise the wizard is built around — *"the redirect_uri only exists from this point on"*
(`AddProviderWizard.tsx:156-158`) — is simply false. The value is knowable before any
provider exists, which means credentials can be collected in the same form.

### PATCH deliberately excludes spec columns

```python
# connections_router.py:210 — "Never touches a spec column — those belong to POST/PUT/DELETE."
```

Spec writes carry audit entries, `spec_hash` recomputation, and the OAuth confirmation gate;
environment columns (credentials, `config`, `scopes_override`, `is_enabled`) do not. **I
withdraw my earlier suggestion of one symmetric create/update envelope** — it would dissolve
a boundary the backend maintains on purpose. The frontend should adopt the split instead:
one form that fans out to `PUT` (spec) and `PATCH` (environment).

---

## 3. Frontend work — no backend changes required

### 3.1 Send `confirm_oauth_endpoints`, and make it mean something

Do not silently hard-code `true`; that discards a security control. Surface it: when the
auth section has URLs, show a checkbox naming the hosts the admin is about to send users to
— *"Sign-in traffic will be sent to `provider.example.com`"*. Echo `destination_hosts` from
the response (already typed at `types.ts:56`, currently unused) into the success toast.

Also handle the 422: `data.rule` names the failing rule, so the error can be attached to the
right field rather than dumped into a toast.

### 3.2 One `ProviderForm`, mode `"create" | "edit"`

Replaces `AddProviderWizard.tsx` (603 lines) and the Configure dialog inside
`ProvidersSection.tsx` (`:551-703`). Sections, not steps:
Identity → Authentication (mode select, fieldset swaps inline, redirect URI + confirmation
shown from the start) → API → collapsed **Advanced: raw spec**.

On submit:

| mode | calls |
|---|---|
| create | `POST` (spec + confirm) → if credentials/config/scopes were filled, `PATCH` |
| edit | `PUT` (spec + confirm, only if spec fields changed) and/or `PATCH` (env columns) |

Wiring `PUT` is what finally makes every field editable — no backend work needed.

Deleted along the way: the step machinery (`stepsFor`, `stepIndex`, the clamp effect, the
step rail — four steps for seven fields, one of which holds a single input at `:548`) and
the `successProvider` mode switch (`:159`, `:276-331`).

### 3.3 Merge the three provider surfaces

Table row, `ProviderSidebar` (read-only, own Configure button), and the Configure dialog all
show one provider; the latter two share `selectedProvider` and `editLoading`, which is why
`openEdit` must defensively `setDetailsOpen(false)` (`:152`). Fold editing into the sidebar,
or drop the sidebar's Configure button so the row pencil is the only entry point.

### 3.4 Bugs to fix in passing

- **Stale JSON override.** `previewJson = jsonOverride ?? …` (`:230`) — edit the JSON, go
  Back, change the base URL, Create, and the base URL change is silently discarded.
- **Two-pass validation.** A bad key returns before display-name is checked (`:187`).
- **Unreachable filter UI.** `:437-476` commented out the search box and filter popover, but
  `hasActiveFilters`, the chips bar (`:495`), `clearAllFilters`, and `AUTH_MODE_OPTIONS`
  remain. `searchTerm` has no setter but the clears, so the whole bar is dead code.
- **Row selection with no bulk actions** — `enableRowSelection` (`:531`) only suppresses row
  clicks.
- **Disabled inputs used as labels** (`:592-602`) — reads as "broken", not "immutable".
- **Credential fields can't express their own state.** Blank means "leave unchanged"
  (`:219-224`) but the placeholder says "Enter client ID" either way, and there is no way to
  clear a credential (backend `ProviderPatchRequest` treats `None` as absent).
- **`default_scopes` vs `scopes_override`** — set in the wizard (`:114`), then a
  similarly-named different field in the edit dialog (`:664`) that never shows the defaults.
- **`AUTH_MODE_LABEL` duplicated in three files** with inconsistent values. Move to
  `services/connections/types.ts`.

### 3.5 Do not build

A visual editor for the whole `ProviderSpec` — retry policy, `token_response` JSONPath
mappings, `capture_metadata`. That is config-as-code; keep it in the Advanced raw-JSON
section, validated server-side. Note the wizard currently hardcodes those values invisibly
(`:88-95`, `:116-120`), which is worse than showing them: the admin gets defaults they never
chose and cannot see.

---

## 4. Optional backend additions

Only these remain genuinely new. None block the frontend rewrite.

**(a) Expose the redirect URI without a provider.** Today the constant is only readable off a
`GET /providers/{key}` response. A one-line `GET /connections/providers/meta` →
`{ "redirect_uri": OAUTH_REDIRECT_URI }` lets the create form show it before the first
provider exists. *Interim: the create form can show it after the fact, or the value can be
supplied as a build-time env var.*

**(b) Provider templates.** The common admin action is not authoring a novel spec — it is
"add Slack". `src/middleware/connections/providers/*.yaml` already holds four seeded specs
and `catalog/export.py` already renders DB → YAML round-trippably. Serving that directory as
templates would make the 90% case *pick a provider → paste two credentials → done*.

**(c) Verify / dry-run.** `POST /connections/providers/{key}:verify`, mirroring the existing
connection-level `TestConnectionResponse` (`types.ts:100`). For `oauth2_cc` this can attempt
a real token fetch. Today the only signal that a spec is correct is an end user hitting a
400 later.

**(d) Derived `setup_status`.** `"ready" | "needs_credentials" | "disabled" | "orphaned"`,
replacing the frontend recomputing `has_credentials && isOAuthMode(...)` across three files.

---

## 5. Sequencing

| Phase | Work | Unblocks | Status |
|---|---|---|---|
| **0** | Send `confirm_oauth_endpoints` + surface destination hosts | **OAuth creation works at all** | ✅ done |
| 1 | Show the redirect URI upfront; inline credentials; delete the handoff screen | one-pass create | ✅ done |
| 2 | Unified `ProviderForm`; wire `PUT`; delete wizard + Configure dialog | editing actually works | ✅ done |
| 3 | Merge sidebar/dialog; map 422 `rule` → field; §3.4 cleanups | ~750 fewer lines | ✅ done |
| 4 | Backend (b) templates, (c) verify, (d) `setup_status` | templates, verification, one status badge | ⬜ open |

Backend (a) shipped as `GET /connections/providers/meta` — the one server change the
redesign needed. Everything else in phases 0–3 was frontend-only.
