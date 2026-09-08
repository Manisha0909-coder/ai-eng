# python -m regression.main --persona graph


import asyncio
import aiohttp
import pandas as pd
import time
import os
import sys
import argparse
from datetime import datetime

from regression.api_client import safe_send_query
from regression.test_cases import get_test_cases, PERSONA_IDS
from regression.validators import check_keywords, extract_icv_values
from regression.ai_form_judge import judge_form_fields, judge_response, format_field_summary
from regression.create_replica_personas import (
    run_create_replicas,
    delete_replica_personas,
    delete_replica_sessions,
    ORIGINALS,
)


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RESULTS_DIR = os.path.join(BASE_DIR, "results_regression")
os.makedirs(RESULTS_DIR, exist_ok=True)


def parse_args():
    parser = argparse.ArgumentParser(description="Run persona regression tests")
    parser.add_argument(
        "--persona",
        type=str,
        choices=["graph", "asset_manager", "tender", "hr", "sales_dashboard", "qatar_tourism", "all"],
        default="all",
        help="Which persona to test (default: all)"
    )
    parser.add_argument(
        "--include-disabled",
        action="store_true",
        help="Include disabled test cases"
    )
    return parser.parse_args()


async def main():
    args = parse_args()
    
    persona_filter = None if args.persona == "all" else args.persona
    enabled_only = not args.include_disabled
    
    # ── Create replica personas (sync Playwright must run outside asyncio loop) ─
    print("🚀 Creating replica personas...")
    replica_ids, replica_roles, cookie_header, failed_keys = await asyncio.to_thread(
        lambda: run_create_replicas(persona_filter=persona_filter)
    )

    if not replica_ids:
        print("❌ No replica personas created. Aborting.")
        sys.exit(1)

    if failed_keys:
        print(f"\n⚠️  Setup failed for: {failed_keys} — skipping these personas and continuing with the rest.")

    auth_context = {"access_token": None, "cookie_header": cookie_header}

    # ── Inject replica IDs into test cases ───────────────────────────────────
    orig_to_replica = {ORIGINALS[key]: replica_ids[key] for key in replica_ids}
    replica_to_key = {replica_ids[key]: key for key in replica_ids}

    test_cases = get_test_cases(persona=persona_filter, enabled_only=enabled_only)
    test_cases = [
        {**tc, "persona_id": orig_to_replica.get(tc["persona_id"], tc["persona_id"])}
        for tc in test_cases
    ]

    if not test_cases:
        print("❌ No test cases to run. Check your --persona filter or enabled flags.")
        delete_replica_personas(replica_ids, replica_roles, cookie_header)
        sys.exit(1)

    print(f"Running {len(test_cases)} test cases for persona: {args.persona}")
    print("✅ Replica personas ready")

    os.makedirs(RESULTS_DIR, exist_ok=True)

    timeout = aiohttp.ClientTimeout(
        total=180,
        sock_read=120
    )

    connector = aiohttp.TCPConnector(ssl=False)

    try:
        async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:

            results = []
            session_ids: list[str] = []
            failed_session_ids: list[str] = []
            session_to_persona: dict[str, str] = {}

            for test in test_cases:

                query = test["query"]
                persona_id = test["persona_id"]
                expected_tools = test["expected_tools"]
                expect_form = test.get("expect_form", False)
                expected_form_title = test.get("expected_form_title")
                expected_fields = test.get("expected_fields")
                keywords = test.get("keywords", [])
                check_icv = test.get("check_icv", False)
                number_check = test.get("number_check", False)

                start = time.time()

                tools_called, tools_errored, tool_error_messages, response, final_response, form_title, form_fields, session_id = await safe_send_query(
                    session, query, persona_id, auth_context
                )
                if session_id:
                    session_ids.append(session_id)
                    session_to_persona[session_id] = persona_id

                end = time.time()

                print("📝 Query:", query)
                print("🛠 Tools Called:", tools_called)
                if tools_errored:
                    print("❌ Tools Errored:", tools_errored)

                tools_pass = all(tool in tools_called for tool in expected_tools)

                if expect_form:
                    form_pass = form_title == expected_form_title
                else:
                    form_pass = form_title is None

                ai_field_check = {"checked": False, "passed": None, "issues": [], "summary": "N/A"}
                if expect_form and form_pass and form_fields:
                    ai_field_check = await asyncio.to_thread(
                        judge_form_fields, query, form_title, form_fields, expected_fields
                    )
                ai_fields_pass = ai_field_check["passed"] is not False

                ai_response_check = await asyncio.to_thread(judge_response, query, final_response, tools_called)
                ai_response_pass = ai_response_check["passed"] is not False

                found_keywords, missing_keywords = check_keywords(response, keywords)
                keywords_pass = len(missing_keywords) == 0

                icv_values = []
                icv_pass = True
                if check_icv:
                    icv_values = extract_icv_values(response)
                    icv_pass = len(icv_values) > 0

                number_pass = True
                number_values = []
                if number_check:
                    number_values = [token for token in response.split() if any(char.isdigit() for char in token)]
                    number_pass = len(number_values) > 0

                tool_errors_pass = len(tools_errored) == 0

                final_result = "PASS" if (
                    tools_pass and form_pass and ai_fields_pass and ai_response_pass
                    and keywords_pass and icv_pass and number_pass and tool_errors_pass
                ) else "FAIL"

                if not tool_errors_pass and session_id:
                    failed_session_ids.append(session_id)

                result_icon = "✅" if final_result == "PASS" else "❌"
                print(f"{result_icon} Result:", final_result)
                print()

                results.append({
                    "Query": query,
                    "Persona ID": persona_id,
                    "Expected Tools": ", ".join(expected_tools),
                    "Actual Tools": ", ".join(tools_called),
                    "Tools Pass": "✓" if tools_pass else "✗",
                    "Expected Form": expected_form_title or "N/A",
                    "Actual Form": form_title or "N/A",
                    "Form Pass": "✓" if form_pass else "✗",
                    "Form Fields": format_field_summary(form_fields) if form_fields else "N/A",
                    "AI Field Check": ("✓" if ai_field_check["passed"] else "✗") if ai_field_check["checked"] else "N/A",
                    "AI Field Issues": "; ".join(f"{i.get('field')}: {i.get('problem')}" for i in ai_field_check["issues"]) if ai_field_check["issues"] else "None",
                    "AI Field Summary": ai_field_check["summary"] or "N/A",
                    "AI Response Check": ("✓" if ai_response_check["passed"] else "✗") if ai_response_check["checked"] else "N/A",
                    "AI Response Issue": ai_response_check["problem"] or "None",
                    "AI Response Summary": ai_response_check["summary"] or "N/A",
                    "Keywords": ", ".join(keywords) if keywords else "N/A",
                    "Found Keywords": ", ".join(found_keywords) if found_keywords else "None",
                    "Missing Keywords": ", ".join(missing_keywords) if missing_keywords else "None",
                    "Keywords Pass": "✓" if keywords_pass else "✗",
                    "ICV Values": ", ".join(icv_values) if icv_values else "None",
                    "ICV Check": "Yes" if check_icv else "No",
                    "ICV Pass": "✓" if icv_pass else "✗",
                    "Number Check": "Yes" if number_check else "No",
                    "Number Pass": "✓" if number_pass else "✗",
                    "Number Values": ", ".join(number_values[:10]) if number_values else "None",
                    "Tools Errored": ", ".join(tools_errored) if tools_errored else "None",
                    "Tool Error Messages": "; ".join(f"{t}: {m}" for t, m in tool_error_messages.items()) if tool_error_messages else "None",
                    "Tool Errors Pass": "✓" if tool_errors_pass else "✗",
                    "Response": response.replace("\n", " ")[:300],
                    "Final Response (AI-checked)": final_response.replace("\n", " ")[:300],
                    "Execution Time (s)": round(end - start, 2),
                    "Result": final_result
                })

            df = pd.DataFrame(results)

            # Drop columns irrelevant to this run's test cases
            uses_forms    = any(tc.get("expect_form") for tc in test_cases)
            uses_keywords = any(tc.get("keywords") for tc in test_cases)
            uses_icv      = any(tc.get("check_icv") for tc in test_cases)
            uses_numbers  = any(tc.get("number_check") for tc in test_cases)
            has_errors    = any(r["Tools Errored"] != "None" for r in results)

            drop_cols = []
            if not uses_forms:
                drop_cols += ["Expected Form", "Actual Form", "Form Pass", "Form Fields", "AI Field Check", "AI Field Issues", "AI Field Summary"]
            if not uses_keywords:
                drop_cols += ["Keywords", "Found Keywords", "Missing Keywords", "Keywords Pass"]
            if not uses_icv:
                drop_cols += ["ICV Values", "ICV Check", "ICV Pass"]
            if not uses_numbers:
                drop_cols += ["Number Check", "Number Pass", "Number Values"]
            if not has_errors:
                drop_cols += ["Tools Errored", "Tool Errors Pass"]

            df = df.drop(columns=[c for c in drop_cols if c in df.columns])

            persona_suffix = f"_{args.persona}" if args.persona != "all" else ""
            filename = os.path.join(
                RESULTS_DIR,
                f"gotalk_forms_test_results{persona_suffix}_{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.xlsx"
            )

            os.makedirs(os.path.dirname(filename), exist_ok=True)
            df.to_excel(filename, index=False)

            print(f"\n📊 Results saved to {filename}")

            failed = [r for r in results if r["Result"] == "FAIL"]
            if failed:
                print(f"\n❌ {len(failed)} test case(s) failed out of {len(results)}")
            else:
                print(f"\n✅ All {len(results)} test cases passed")

    finally:
        delete_replica_personas(replica_ids, replica_roles, cookie_header)
        passed_session_ids = [s for s in session_ids if s not in failed_session_ids]
        if failed_session_ids:
            by_persona: dict[str, list[str]] = {}
            for sid in failed_session_ids:
                key = replica_to_key.get(session_to_persona.get(sid, ""), "unknown")
                by_persona.setdefault(key, []).append(sid)
            print(f"  ⚠️  Preserving {len(failed_session_ids)} failed session(s) for investigation:")
            for persona_key, sids in by_persona.items():
                print(f"    [{persona_key}]")
                for sid in sids:
                    print(f"      - {sid}")
        delete_replica_sessions(passed_session_ids, cookie_header)

    if failed:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())