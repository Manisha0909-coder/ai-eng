"""LLM-as-judge checks for the regression suite: given a user's query and
what the assistant actually did (text response and/or a filled-in form),
ask Gemini whether that output is a correct, reasonable answer to the query.

These are semantic checks layered on top of the existing exact-match checks
(expected_tools, expected_form_title, keyword lists) — they catch cases that
look right structurally but are wrong in substance: a form with the right
title but wrong dates, or a response that dodges the actual question.
"""
import json

from regression.config import GEMINI_API_KEY, GEMINI_MODEL

_client = None
_client_init_error = None


def _get_client():
    global _client, _client_init_error
    if _client is not None or _client_init_error is not None:
        return _client
    if not GEMINI_API_KEY:
        _client_init_error = "GEMINI_API_KEY not set"
        return None
    try:
        from google import genai
        _client = genai.Client(api_key=GEMINI_API_KEY)
    except Exception as e:
        _client_init_error = str(e)
    return _client


# Internal codes used across the app's generated-letter forms (Bank, Employee
# certificate, "To Whom It May Concern", Visa, etc.) that a field's own
# `options` list may not always carry — e.g. hidden/system "type" fields.
# Falls back here when a value can't be resolved from the field's own options.
KNOWN_CODES = {
    "BCLOAN": "Car Loan",
    "BCCARD": "Credit Card",
    "BPLOAN": "Personal Loan",
    "BNEMP": "New Employee",
    "BSTRAN": "Salary Transfer",
    "ECERTWOSAL": "Without Salary",
    "ECERTBR": "Breakdown",
    "ECERTSAL": "Salary",
    "WWISAL": "With Salary",
    "WWOSAL": "Without Salary",
    "VPRIV": "Private",
    "OTHER": "Other",
}


def resolve_value_label(value, options=None):
    """Resolve a field's raw value to its human-readable label: check the
    field's own options first, then fall back to the known app-wide code
    table. Returns None if no resolution is found (or value == label)."""
    if options:
        for opt in options:
            if opt.get("value") == value:
                label = opt.get("label")
                return label if label != value else None
    if isinstance(value, (list, dict, set)):
        return None
    return KNOWN_CODES.get(value)


def _ask_gemini_json(prompt):
    """Call Gemini with a prompt that must return a JSON object. Raises on any failure."""
    client = _get_client()
    if client is None:
        raise RuntimeError(_client_init_error)
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config={"response_mime_type": "application/json", "temperature": 0},
    )
    return json.loads((response.text or "").strip())


_PROMPT_TEMPLATE = """You are QA-testing a chat assistant that auto-fills web forms from a user's natural-language request.

User's request:
"{query}"

The assistant opened a form titled "{form_title}" and pre-filled these fields:
{fields_block}
{hints_block}
For each field, judge whether its value is a correct, reasonable interpretation of the user's request:
- Select/dropdown fields show their raw stored value followed by "→ <meaning>" where that value has been resolved to a human-readable label — judge the MEANING, not the raw code. If a value has no "→ <meaning>" shown, judge the raw value as-is (it's already human-readable, or no resolution was available).
- Relative dates/times ("tomorrow", "next monday") resolved to a real date are correct.
- Values not mentioned by the user that keep a sensible default are fine — only flag a field if its value clearly contradicts, ignores, or misrepresents something the user explicitly stated.
- An empty/blank value on a required field the user clearly did specify (e.g. they gave a date but the date field is empty) should be flagged.
- For free-text message/body fields, added polite phrasing, greetings, or offers of further help are fine — only flag the field if it contradicts, omits, or misrepresents the content the user explicitly asked to convey.
- Message/body fields wrapped in HTML markup (e.g. "<html><body><p>...</p></body></html>") are expected — this is how the app formats multi-paragraph messages. Judge the visible text content, not the presence of HTML tags around it.

Respond with ONLY a JSON object, no markdown fences, matching this shape:
{{"passed": true or false, "issues": [{{"field": "<label>", "problem": "<short reason>"}}], "summary": "<one sentence>"}}
"passed" is false if and only if "issues" is non-empty.
"""


def _format_fields(form_fields):
    lines = []
    for f in form_fields:
        value = f.get("value")
        options = f.get("options")
        resolved = resolve_value_label(value, options)
        value_desc = f"{value!r}" + (f' → "{resolved}"' if resolved else "")
        opt_labels = [o.get("label") for o in options] if options else None
        opts_desc = f" (options: {', '.join(opt_labels)})" if opt_labels else ""
        lines.append(f"- {f.get('label')} [{f.get('type')}]: {value_desc}{opts_desc}")
    return "\n".join(lines)


def format_field_summary(form_fields):
    """Human-readable 'Label=value (meaning)' summary for reports."""
    parts = []
    for f in form_fields:
        value = f.get("value")
        resolved = resolve_value_label(value, f.get("options"))
        parts.append(f"{f.get('label')}={value!r}" + (f' ({resolved})' if resolved else ""))
    return "; ".join(parts)


def judge_form_fields(query, form_title, form_fields, expected_fields=None):
    """Ask Gemini whether the filled form fields correctly reflect the query.

    Returns a dict:
      checked: bool   — whether the AI check actually ran
      passed:  bool | None — verdict; None if the check could not run
      issues:  list[dict]  — [{"field": ..., "problem": ...}]
      summary: str
    """
    if not form_fields:
        return {"checked": False, "passed": None, "issues": [], "summary": "No form fields to check"}

    hints_block = ""
    if expected_fields:
        hints_block = (
            "\nThe test author also expects these details to show up somewhere in the "
            f"filled values: {', '.join(expected_fields)}.\n"
        )

    try:
        prompt = _PROMPT_TEMPLATE.format(
            query=query,
            form_title=form_title,
            fields_block=_format_fields(form_fields),
            hints_block=hints_block,
        )
        data = _ask_gemini_json(prompt)
        issues = data.get("issues", [])
        return {
            "checked": True,
            "passed": bool(data.get("passed", not issues)) and not issues,
            "issues": issues,
            "summary": data.get("summary", ""),
        }
    except Exception as e:
        return {
            "checked": False,
            "passed": None,
            "issues": [],
            "summary": f"AI check errored: {e}",
        }


_RESPONSE_PROMPT_TEMPLATE = """You are QA-testing a chat assistant.

User's request:
"{query}"

Tools the assistant invoked to answer: {tools_called}

Assistant's text response:
\"\"\"
{response}
\"\"\"

Judge whether this response correctly and sufficiently answers the user's request. Flag it ONLY if it:
- is off-topic or ignores what was actually asked,
- factually contradicts the request or the tools invoked,
- refuses or fails to answer without a legitimate reason,
- omits something explicitly asked for.
Do NOT flag it for being brief, for formatting/style, or for reasonable follow-up questions the assistant asks back.

Respond with ONLY a JSON object, no markdown fences, matching this shape:
{{"passed": true or false, "problem": "<short reason, empty string if passed>", "summary": "<one sentence>"}}
"""


def judge_response(query, response, tools_called=None):
    """Ask Gemini whether the assistant's text response correctly answers the query.

    Returns a dict:
      checked: bool   — whether the AI check actually ran
      passed:  bool | None — verdict; None if the check could not run
      problem: str
      summary: str
    """
    if not response or not response.strip():
        return {"checked": False, "passed": None, "problem": "", "summary": "No text response to check"}

    prompt = _RESPONSE_PROMPT_TEMPLATE.format(
        query=query,
        tools_called=", ".join(tools_called) if tools_called else "none",
        response=response,
    )

    try:
        data = _ask_gemini_json(prompt)
        passed = bool(data.get("passed", True))
        return {
            "checked": True,
            "passed": passed,
            "problem": "" if passed else data.get("problem", ""),
            "summary": data.get("summary", ""),
        }
    except Exception as e:
        return {
            "checked": False,
            "passed": None,
            "problem": "",
            "summary": f"AI check errored: {e}",
        }
