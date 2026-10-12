"""One-time (re-run only when the dataset itself changes) generator for
eval/golden_dataset.json.

Why a script instead of hand-edited JSON: the dev/test split must be
reproducible from a documented, fixed seed (SEED below) rather than
hand-assigned, per the project's "honest metrics" rule -- tune on dev,
report on test, and the split itself has to be auditable, not ad hoc.

Augments the original 52 v1 examples (loaded from the current
golden_dataset.json, which must already contain them) with the new
chunk-level/variant/forbidden-term fields, adds ~68 new v2 examples
covering the Stage-1 extended corpus's deliberate hard cases (multi-hop,
numeric near-misses, cross-document old-vs-current conflicts, paraphrases
with no keyword overlap, out-of-scope near-misses, and multi-turn
follow-ups), then assigns a stratified (per-category) ~50/50 dev/test
split with a fixed, documented random seed.

Usage:
    python -m eval.build_golden_dataset
"""

import json
import random
from pathlib import Path
from typing import Any, Dict, List

DATASET_PATH = Path(__file__).resolve().parent / "golden_dataset.json"

# Documented, fixed seed for the dev/test split -- change this only with a
# comment explaining why; changing it silently would make "tune on dev,
# report on test" unauditable.
SPLIT_SEED = 42

# expected_chunk_substring (and, for near-miss v1 ids, forbidden_substrings)
# for the original 52 examples, hand-mapped against the real chunks in
# documents/*.txt (see rag/ingest.py's heading-aware chunking -- each of
# these is verified to sit inside exactly one chunk).
_V1_CHUNK_SUBSTRINGS: Dict[str, str] = {
    "leave-01": "20 days of annual leave",
    "leave-02": "completing 6 months of employment",
    "leave-07": "20 days of annual leave",
    "leave-08": "20 days of annual leave",
    "leave-09": "completing 6 months of employment",
    "leave-03": "12 weeks of maternity leave",
    "leave-04": "12 weeks of maternity leave",
    "leave-10": "12 weeks of maternity leave",
    "leave-11": "12 weeks of maternity leave",
    "leave-05": "10 days of sick leave",
    "leave-12": "10 days of sick leave",
    "leave-13": "10 days of sick leave",
    "leave-14": "10 days of sick leave",
    "leave-06": "twice per week",
    "leave-15": "twice per week",
    "leave-16": "twice per week",
    "it-01": "rotated every 180 days",
    "it-02": "lost device must be reported",
    "it-03": "connect through the company VPN",
    "it-04": "full-disk encryption enabled",
    "it-05": "approved by the IT team",
    "it-06": "enrolled in mobile device management",
    "it-07": "phishing email",
    "it-08": "at least 12 characters",
    "expense-01": "1500 rupees for meals",
    "expense-02": "expense over 500 rupees",
    "expense-03": "within 30 days",
    "expense-04": "company travel portal",
    "expense-05": "business class requires VP approval for flights over 6 hours",
    "expense-06": "Late submissions require manager approval",
    "expense-07": "alcohol are not reimbursable",
    "expense-08": "1500 rupees",
    "conduct-01": "reported to HR or through the anonymous ethics hotline",
    "conduct-02": "core hours (10 AM - 4 PM",
    "conduct-03": "disclose any outside employment",
    "conduct-04": "confidential company information, including source code",
    "conduct-05": "Retaliation against anyone who reports a concern in good faith",
    "conduct-06": "attend scheduled meetings on camera",
}

# The wrong number explicitly offered in a v1 near-miss question's own
# phrasing (e.g. "20 or 25 days?") -- the answer stating this instead of
# the correct number is a clear miss, not a judgment call.
_V1_FORBIDDEN: Dict[str, List[str]] = {
    "leave-08": ["25"],
    "leave-11": ["10 weeks"],
    "leave-13": ["12 days"],
    "expense-08": ["2000"],
}


def _augment_v1(entries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    augmented = []
    for entry in entries:
        entry = dict(entry)
        entry["origin"] = "v1"
        entry["expected_chunk_substring"] = _V1_CHUNK_SUBSTRINGS.get(entry["id"])
        entry["forbidden_substrings"] = _V1_FORBIDDEN.get(entry["id"], [])
        augmented.append(entry)
    return augmented


def _entry(
    id_,
    question,
    category,
    expected_source,
    answer_must_contain,
    expected_chunk_substring,
    forbidden_substrings=None,
    answerable=True,
    history=None,
):
    entry = {
        "id": id_,
        "question": question,
        "category": category,
        "answerable": answerable,
        "expected_source": expected_source,
        "answer_must_contain": answer_must_contain,
        "expected_chunk_substring": expected_chunk_substring,
        "forbidden_substrings": forbidden_substrings or [],
        "origin": "v2",
    }
    if history is not None:
        entry["history"] = history
    return entry


def _build_v2() -> List[Dict[str, Any]]:
    entries: List[Dict[str, Any]] = []

    # --- extended_docs: one straightforward fact per new document (16) ---
    extended_docs = [
        _entry(
            "ext-01",
            "How long is the probation period for new hires?",
            "extended_docs",
            "extended/hr/onboarding_policy.md",
            ["6 months"],
            "probation period of",
        ),
        _entry(
            "ext-02",
            "How often are performance reviews conducted?",
            "extended_docs",
            "extended/hr/performance_review_policy.md",
            ["twice a year"],
            "happen",
        ),
        _entry(
            "ext-03",
            "How long does a Performance Improvement Plan run?",
            "extended_docs",
            "extended/hr/performance_review_policy.md",
            ["60 days"],
            "PIP) runs for",
        ),
        _entry(
            "ext-04",
            "Within how many days must I file a grievance after an incident?",
            "extended_docs",
            "extended/hr/grievance_policy.md",
            ["30 days"],
            "within",
        ),
        _entry(
            "ext-05",
            "What is the employer's PF contribution percentage in India?",
            "extended_docs",
            "extended/hr/benefits_overview_india.pdf",
            ["12%"],
            "12%",
        ),
        _entry(
            "ext-06",
            "How much does the company match in my 401(k)?",
            "extended_docs",
            "extended/hr/benefits_overview_us.md",
            ["50%"],
            "matches",
        ),
        _entry(
            "ext-07",
            "How many days in advance must I request leave without pay?",
            "extended_docs",
            "extended/hr/leave_without_pay_policy.md",
            [["4 weeks", "4-week"]],
            "advance",
        ),
        _entry(
            "ext-08",
            "How often is IT access reviewed?",
            "extended_docs",
            "extended/it/access_management_policy.md",
            ["quarterly"],
            "reviews all system access",
        ),
        _entry(
            "ext-09",
            "Who approves access beyond my role's default template?",
            "extended_docs",
            "extended/it/access_management_policy.md",
            ["manager"],
            "requires a ticket approved by",
        ),
        _entry(
            "ext-10",
            "How long does the DPO have to respond to a data subject request?",
            "extended_docs",
            "extended/it/data_privacy_policy.md",
            ["30 days"],
            "responds within",
        ),
        _entry(
            "ext-11",
            "What is the current home-office equipment stipend amount?",
            "extended_docs",
            "extended/it/remote_work_equipment_policy.md",
            [["15,000", "15000"]],
            "15,000",
        ),
        _entry(
            "ext-12",
            "How quickly must I report a data breach to the DPO?",
            "extended_docs",
            "extended/security/incident_response_policy.pdf",
            ["2 hours"],
            "notified within",
        ),
        _entry(
            "ext-13",
            "How often are fire drills conducted?",
            "extended_docs",
            "extended/security/physical_safety_policy.md",
            ["twice a year"],
            "conducted",
        ),
        _entry(
            "ext-14",
            "How far in advance must a visitor be pre-registered?",
            "extended_docs",
            "extended/security/visitor_access_policy.md",
            ["4 hours"],
            "before arrival",
        ),
        _entry(
            "ext-15",
            "What is the daily meal allowance for US business travel?",
            "extended_docs",
            "extended/finance/travel_policy_us.pdf",
            [["$75"]],
            "75",
        ),
        _entry(
            "ext-16",
            "Above what purchase amount does procurement require a receipt?",
            "extended_docs",
            "extended/finance/procurement_policy.md",
            [["10,000", "10000"]],
            "over",
        ),
    ]

    # --- numeric_near_miss: close numbers across documents (10) ---
    numeric_near_miss = [
        _entry(
            "nm-01",
            "Is the probation period 6 months or 3 months?",
            "numeric_near_miss",
            "extended/hr/onboarding_policy.md",
            ["6 months"],
            "probation period",
            ["3 months"],
        ),
        _entry(
            "nm-02",
            "Does the 401(k) match 50% or 100% of contributions?",
            "numeric_near_miss",
            "extended/hr/benefits_overview_us.md",
            ["50%"],
            "matches",
            ["100%"],
        ),
        _entry(
            "nm-03",
            "Is the PF contribution 12% or 10%?",
            "numeric_near_miss",
            "extended/hr/benefits_overview_india.pdf",
            ["12%"],
            "12%",
            ["10%"],
        ),
        _entry(
            "nm-04",
            "Under the current policy, is the home-office stipend 15,000 or 8,000?",
            "numeric_near_miss",
            "extended/it/remote_work_equipment_policy.md",
            [["15,000", "15000"]],
            "15,000",
            ["8,000"],
        ),
        _entry(
            "nm-05",
            "Is the data breach notification window 2 hours or 24 hours?",
            "numeric_near_miss",
            "extended/security/incident_response_policy.pdf",
            ["2 hours"],
            "within 2 hours",
            ["24 hours"],
        ),
        _entry(
            "nm-06",
            "Is the procurement receipt threshold 10,000 rupees or 500 rupees?",
            "numeric_near_miss",
            "extended/finance/procurement_policy.md",
            [["10,000", "10000"]],
            "over",
            ["500"],
        ),
        _entry(
            "nm-07",
            "Is the corporate card monthly limit 50,000 rupees or 75,000 rupees?",
            "numeric_near_miss",
            "extended/finance/corporate_card_policy.md",
            [["50,000", "50000"]],
            "monthly limit",
            ["75,000"],
        ),
        _entry(
            "nm-08",
            "Does the Grievance Policy's Level 1 (direct manager) response window "
            "give 7 business days or 15 business days?",
            "numeric_near_miss",
            "extended/hr/grievance_policy.md",
            ["7 business days"],
            "Level 1",
            ["15"],
        ),
        _entry(
            "nm-09",
            "Is the visitor pre-registration window 4 hours or 24 hours?",
            "numeric_near_miss",
            "extended/security/visitor_access_policy.md",
            ["4 hours"],
            "before arrival",
            ["24 hours"],
        ),
        _entry(
            "nm-10",
            "Is the US business-travel per diem $75 or $150?",
            "numeric_near_miss",
            "extended/finance/travel_policy_us.pdf",
            [["$75"]],
            "75",
            ["150"],
        ),
    ]

    # --- cross_document_conflict: superseded vs current policy (6) ---
    cross_document_conflict = [
        _entry(
            "cc-01",
            "What is the home-office equipment stipend under the CURRENT policy, "
            "not the old one?",
            "cross_document_conflict",
            "extended/it/remote_work_equipment_policy.md",
            [["15,000", "15000"]],
            "15,000",
            ["8,000"],
        ),
        _entry(
            "cc-02",
            "Under the 2023 (now superseded) remote work equipment policy, what was "
            "the equipment stipend?",
            "cross_document_conflict",
            "extended/archive/remote_work_equipment_policy_2023_superseded.md",
            [["8,000", "8000"]],
            "8,000",
            ["15,000"],
        ),
        _entry(
            "cc-03",
            "Is the current monthly connectivity allowance 1,500 rupees or the old "
            "1,000 rupees?",
            "cross_document_conflict",
            "extended/it/remote_work_equipment_policy.md",
            [["1,500", "1500"]],
            "1,500",
            ["1,000"],
        ),
        _entry(
            "cc-04",
            "What was the monthly connectivity allowance under the superseded 2023 "
            "policy?",
            "cross_document_conflict",
            "extended/archive/remote_work_equipment_policy_2023_superseded.md",
            [["1,000", "1000"]],
            "1,000",
            ["1,500"],
        ),
        _entry(
            "cc-05",
            "Which version of the Remote Work Equipment Policy is currently in effect?",
            "cross_document_conflict",
            "extended/it/remote_work_equipment_policy.md",
            ["2.0"],
            "Version",
        ),
        _entry(
            "cc-06",
            "When did the current (v2.0) Remote Work Equipment Policy take effect?",
            "cross_document_conflict",
            "extended/it/remote_work_equipment_policy.md",
            [["2026-03-01", "March 1, 2026", "March 2026"]],
            "Effective Date",
        ),
    ]

    # --- paraphrase_no_overlap: no literal keyword overlap with the answer (10) ---
    paraphrase_no_overlap = [
        _entry(
            "po-01",
            "Who do I talk to if a colleague keeps making uncomfortable comments "
            "toward me?",
            "paraphrase_no_overlap",
            "code_of_conduct.txt",
            [["HR", "ethics hotline"]],
            "reported to HR",
        ),
        _entry(
            "po-02",
            "What should I do before accepting a side gig at a company we do "
            "business with?",
            "paraphrase_no_overlap",
            "code_of_conduct.txt",
            ["disclose"],
            "disclose",
        ),
        _entry(
            "po-03",
            "Is it fine to show a friend at a rival firm how our product actually "
            "works under the hood?",
            "paraphrase_no_overlap",
            "code_of_conduct.txt",
            ["confidential"],
            "confidential",
        ),
        _entry(
            "po-04",
            "I'm expecting a child soon -- what time off can I plan for?",
            "paraphrase_no_overlap",
            "employee_policy.txt",
            [["12", "week"]],
            "12 weeks",
        ),
        _entry(
            "po-05",
            "I can't find the card that gets me into the building anymore -- what "
            "happens now?",
            "paraphrase_no_overlap",
            "extended/security/physical_safety_policy.md",
            [["replace", "replacement"]],
            "replacement",
        ),
        _entry(
            "po-06",
            "If my household internet bill is high because I work from home, does "
            "the company help with that?",
            "paraphrase_no_overlap",
            "extended/it/remote_work_equipment_policy.md",
            [["connectivity", "internet"]],
            "connectivity",
        ),
        _entry(
            "po-07",
            "Someone I don't recognize is wandering the office without anyone "
            "escorting them -- is that a problem?",
            "paraphrase_no_overlap",
            "extended/security/visitor_access_policy.md",
            [["Security", "reported"]],
            "reported to Security",
        ),
        _entry(
            "po-08",
            "I want to buy something for my team that costs a bit over ten thousand "
            "rupees -- who signs off?",
            "paraphrase_no_overlap",
            "extended/finance/procurement_policy.md",
            ["department head"],
            "Department head",
        ),
        _entry(
            "po-09",
            "When can I sign up for health coverage if I'm based in the US?",
            "paraphrase_no_overlap",
            "extended/hr/benefits_overview_us.md",
            ["November"],
            "November",
        ),
        _entry(
            "po-10",
            "What happens if I don't bring back my equipment after my last day?",
            "paraphrase_no_overlap",
            "extended/it/access_management_policy.md",
            [["billed", "replacement cost"]],
            "billed",
        ),
    ]

    # --- out_of_scope_near_miss: sounds like policy, isn't covered (8) ---
    out_of_scope_near_miss = [
        _entry(
            "oos-01",
            "What's the referral bonus for referring a friend as a new employee?",
            "out_of_scope_near_miss",
            None,
            [],
            None,
            answerable=False,
        ),
        _entry(
            "oos-02",
            "Can I expense a gym membership if I'm based in India?",
            "out_of_scope_near_miss",
            None,
            [],
            None,
            answerable=False,
            forbidden_substrings=["$50"],
        ),
        _entry(
            "oos-03",
            "What's the referral bonus for bringing in a new client?",
            "out_of_scope_near_miss",
            None,
            [],
            None,
            answerable=False,
        ),
        _entry(
            "oos-04",
            "Does my performance review affect my visa sponsorship status?",
            "out_of_scope_near_miss",
            None,
            [],
            None,
            answerable=False,
        ),
        _entry(
            "oos-05",
            "What's the espresso machine budget for the office pantry?",
            "out_of_scope_near_miss",
            None,
            [],
            None,
            answerable=False,
        ),
        _entry(
            "oos-06",
            "Is there a different probation period for interns specifically?",
            "out_of_scope_near_miss",
            None,
            [],
            None,
            answerable=False,
        ),
        _entry(
            "oos-07",
            "What's the procedure for sabbatical leave after 5 years of service?",
            "out_of_scope_near_miss",
            None,
            [],
            None,
            answerable=False,
        ),
        _entry(
            "oos-08",
            "Which conference room booking system do we use?",
            "out_of_scope_near_miss",
            None,
            [],
            None,
            answerable=False,
        ),
    ]

    # --- multi_hop: requires combining 2+ documents (8) ---
    multi_hop = [
        _entry(
            "mh-01",
            "If I lose both my building badge and my work laptop on the same day, "
            "what's the response time for each?",
            "multi_hop",
            ["extended/security/physical_safety_policy.md", "it_security_policy.txt"],
            ["1 business day", "24 hours"],
            ["replacement is issued within", "lost device must be reported"],
        ),
        _entry(
            "mh-02",
            "As a new hire in my first week, what equipment do I get for my desk, "
            "and do I also get a remote-work stipend immediately?",
            "multi_hop",
            [
                "extended/hr/onboarding_policy.md",
                "extended/it/remote_work_equipment_policy.md",
            ],
            [["Day 1", "day one"], ["separately", "not part of"]],
            ["provisions a laptop", "requested separately"],
        ),
        _entry(
            "mh-03",
            "If I'm on a Performance Improvement Plan, can I also request leave "
            "without pay?",
            "multi_hop",
            [
                "extended/hr/performance_review_policy.md",
                "extended/hr/leave_without_pay_policy.md",
            ],
            [["not available", "not eligible"]],
            ["active Performance Improvement Plan"],
        ),
        _entry(
            "mh-04",
            "For India business travel, what's my daily meal allowance and my "
            "hotel budget in a Tier 1 city?",
            "multi_hop",
            ["expense_policy.txt", "extended/finance/travel_policy_india.md"],
            ["1,500", "8,000"],
            ["daily allowance", "Tier 1"],
        ),
        _entry(
            "mh-05",
            "If my expense report is both late and for 30,000 rupees, whose "
            "approval do I need?",
            "multi_hop",
            ["expense_policy.txt", "extended/finance/expense_approval_matrix.md"],
            [["manager"], ["Finance"]],
            ["requires manager approval", "Department head + Finance"],
        ),
        _entry(
            "mh-06",
            "Does my probation period length match how long I have to wait before "
            "I'm eligible for annual leave?",
            "multi_hop",
            ["extended/hr/onboarding_policy.md", "employee_policy.txt"],
            ["6 months"],
            ["probation period of", "completing 6 months of employment"],
        ),
        _entry(
            "mh-07",
            "I need to buy something for my team that costs 60,000 rupees -- does "
            "the corporate card policy or the procurement policy's approval apply?",
            "multi_hop",
            [
                "extended/finance/corporate_card_policy.md",
                "extended/finance/procurement_policy.md",
            ],
            ["department head"],
            ["Department head"],
        ),
        _entry(
            "mh-08",
            "I want to install a $40/user/year SaaS tool that also connects to our "
            "email -- what approvals do I need?",
            "multi_hop",
            ["extended/it/software_asset_management_policy.md"],
            [["manager"], ["IT security", "security review"]],
            ["approved by the requester's manager alone", "security review before use"],
        ),
    ]

    # --- multi_turn: a follow-up that only makes sense with history (10) ---
    multi_turn = [
        _entry(
            "mt-01",
            "And how many sick days do I get on top of that?",
            "multi_turn",
            "employee_policy.txt",
            ["10"],
            "10 days of sick leave",
            history=[
                {"role": "user", "content": "How long is maternity leave?"},
                {
                    "role": "assistant",
                    "content": "Employees receive 12 weeks of maternity leave.",
                },
            ],
        ),
        _entry(
            "mt-02",
            "What was it before this update?",
            "multi_turn",
            "extended/archive/remote_work_equipment_policy_2023_superseded.md",
            [["8,000", "8000"]],
            "8,000",
            history=[
                {
                    "role": "user",
                    "content": "What's the current home-office equipment stipend?",
                },
                {
                    "role": "assistant",
                    "content": "15,000 rupees (or $200 for US-based employees).",
                },
            ],
        ),
        _entry(
            "mt-03",
            "Which of those two actually affects my pay?",
            "multi_turn",
            "extended/hr/performance_review_policy.md",
            ["annual"],
            "annual review",
            history=[
                {"role": "user", "content": "How often are performance reviews?"},
                {
                    "role": "assistant",
                    "content": "Twice a year: a mid-year check-in and an annual review.",
                },
            ],
        ),
        _entry(
            "mt-04",
            "And what hours do I need to be reachable on those days?",
            "multi_turn",
            "code_of_conduct.txt",
            [["10 AM", "4 PM"]],
            "core hours",
            history=[
                {"role": "user", "content": "Can I work from home?"},
                {"role": "assistant", "content": "Yes, up to twice per week."},
            ],
        ),
        _entry(
            "mt-05",
            "How does that compare to the threshold for my own expense reimbursements?",
            "multi_turn",
            ["extended/finance/procurement_policy.md", "expense_policy.txt"],
            ["500"],
            "expense over 500 rupees",
            history=[
                {
                    "role": "user",
                    "content": "What's the receipt threshold for procurement purchases?",
                },
                {"role": "assistant", "content": "10,000 rupees."},
            ],
        ),
        _entry(
            "mt-06",
            "Can it be extended if needed?",
            "multi_turn",
            "extended/hr/onboarding_policy.md",
            [["3", "month"]],
            "extension",
            history=[
                {"role": "user", "content": "How long is my probation period?"},
                {"role": "assistant", "content": "6 months."},
            ],
        ),
        _entry(
            "mt-07",
            "What if they don't respond in time?",
            "multi_turn",
            "extended/hr/grievance_policy.md",
            [["escalat"]],
            "escalates",
            history=[
                {
                    "role": "user",
                    "content": "What's the grievance Level 1 response time?",
                },
                {
                    "role": "assistant",
                    "content": "7 business days, reviewed by your direct manager.",
                },
            ],
        ),
        _entry(
            "mt-08",
            "What's the monthly limit on it?",
            "multi_turn",
            "extended/finance/corporate_card_policy.md",
            [["50,000", "50000"]],
            "monthly limit",
            history=[
                {"role": "user", "content": "Do I get a corporate card?"},
                {
                    "role": "assistant",
                    "content": "If you travel quarterly or manage a team budget, yes.",
                },
            ],
        ),
        _entry(
            "mt-09",
            "Is there a cap on how long I can take?",
            "multi_turn",
            "extended/hr/leave_without_pay_policy.md",
            ["180"],
            "cannot exceed",
            history=[
                {
                    "role": "user",
                    "content": "How much notice do I need to give for leave without pay?",
                },
                {
                    "role": "assistant",
                    "content": "At least 4 weeks in advance, except emergencies.",
                },
            ],
        ),
        _entry(
            "mt-10",
            "How does that compare to the general phishing-email reporting window?",
            "multi_turn",
            ["extended/it/data_privacy_policy.md", "it_security_policy.txt"],
            ["24 hours"],
            "phishing email",
            history=[
                {
                    "role": "user",
                    "content": "What's the data breach notification window?",
                },
                {"role": "assistant", "content": "2 hours, to the DPO."},
            ],
        ),
    ]

    entries.extend(extended_docs)
    entries.extend(numeric_near_miss)
    entries.extend(cross_document_conflict)
    entries.extend(paraphrase_no_overlap)
    entries.extend(out_of_scope_near_miss)
    entries.extend(multi_hop)
    entries.extend(multi_turn)
    return entries


def _assign_splits(entries: List[Dict[str, Any]]) -> None:
    """Stratified ~50/50 dev/test split, per category, with a fixed seed.
    Mutates each entry in place, adding a "split" key."""

    by_category: Dict[str, List[Dict[str, Any]]] = {}
    for entry in entries:
        by_category.setdefault(entry["category"], []).append(entry)

    rng = random.Random(SPLIT_SEED)

    for category_entries in by_category.values():
        rng.shuffle(category_entries)
        midpoint = (
            len(category_entries) + 1
        ) // 2  # odd counts: extra item goes to dev
        for i, entry in enumerate(category_entries):
            entry["split"] = "dev" if i < midpoint else "test"


def main() -> None:
    current = json.loads(DATASET_PATH.read_text())

    if any(e.get("origin") == "v2" for e in current):
        raise SystemExit(
            "golden_dataset.json already contains v2 entries -- this script "
            "expects to run exactly once, against the original 52-example "
            "file. Restore that version from git history before re-running."
        )

    v1 = _augment_v1(current)
    v2 = _build_v2()

    all_entries = v1 + v2
    _assign_splits(all_entries)

    DATASET_PATH.write_text(json.dumps(all_entries, indent=2) + "\n")

    n_dev = sum(1 for e in all_entries if e["split"] == "dev")
    n_test = sum(1 for e in all_entries if e["split"] == "test")
    print(
        f"Wrote {len(all_entries)} examples ({len(v1)} v1 + {len(v2)} v2) "
        f"to {DATASET_PATH}: {n_dev} dev / {n_test} test (seed={SPLIT_SEED})"
    )


if __name__ == "__main__":
    main()
