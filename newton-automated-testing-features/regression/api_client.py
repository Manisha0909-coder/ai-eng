import asyncio
import json
import aiohttp
from regression.config import *

async def send_query(session, question, persona_id, auth_context, verbose=False):
    cookie_header = (auth_context or {}).get("cookie_header", "")
    access_token = (auth_context or {}).get("access_token", "")
    if not cookie_header and access_token:
        cookie_header = f"access_token={access_token}"

    if not cookie_header:
        raise RuntimeError("Missing authentication cookie header for API request.")

    headers = {
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
        "Cookie": cookie_header,
        "Origin": "https://gotalk.dev",
        "Referer": "https://gotalk.dev/",
        "User-Agent": "Mozilla/5.0",
        "x-title": "Newton Chat"
    }

    payload = {
        "timezone": "Asia/Kolkata",
        "session_id": None,
        "query": question,
        "persona_id": persona_id,
        "language": "EN",
        "metaData": {}
    }

    tools_called = []
    tools_errored = []
    tool_error_messages: dict[str, str] = {}  # tool_name → error message
    assistant_response = ""
    final_response = ""  # text emitted after the last tool call — retry/error narration stripped out
    form_title = None
    form_fields = []
    session_id = None
    call_id_to_tool_name: dict[str, str] = {}  # tracks every tool_call_id → tool_name seen so far

    try:
        async with session.post(BASE_URL, json=payload, headers=headers) as response:

            if verbose:
                print("\n============================")
                print(f"🔎 Query: {question} | Persona: {persona_id}")
                print(f"📡 Status: {response.status}")

            # 🚨 Detect HTML (auth/cloudflare issue)
            content_type = response.headers.get("Content-Type", "")
            if verbose:
                print("📦 Content-Type:", content_type)

            if "text/html" in content_type:
                text = await response.text()
                print("❌ HTML RESPONSE DETECTED (Auth issue)")
                print(text[:300])
                return [], [], {}, "", "", None, [], None

            # ✅ Streaming read
            buffer = ""
            pending_sse_json = ""

            async for chunk in response.content.iter_chunked(1024):

                decoded = chunk.decode("utf-8", errors="ignore")

                if verbose:
                    print("📥 Chunk received:", decoded[:200].replace("\n", "\\n"))

                buffer += decoded

                while "\n" in buffer:
                    line, buffer = buffer.split("\n", 1)
                    line = line.strip()

                    if not line.startswith("data:"):
                        continue

                    fragment = line[5:].strip()
                    if not fragment:
                        continue

                    pending_sse_json += fragment

                    try:
                        data = json.loads(pending_sse_json)
                        pending_sse_json = ""
                    except json.JSONDecodeError as e:
                        if verbose:
                            print(f"⚠️ JSON parse error (incomplete chunk) {e}; awaiting more data")
                        continue

                    if "session_id" in data and session_id is None:
                        session_id = data["session_id"]

                    if "tool_name" in data:
                        tools_called.append(data["tool_name"])
                        call_id = data.get("tool_call_id")
                        if call_id:
                            call_id_to_tool_name[call_id] = data["tool_name"]
                        # A new tool call is starting — anything said before it (including
                        # retry/error narration) is not part of the final answer.
                        final_response = ""

                    if "tool_call_status" in data and data["tool_call_status"] == "error":
                        tool_call_id = data.get("tool_call_id")
                        errored_name = (
                            data.get("tool_name")
                            or call_id_to_tool_name.get(tool_call_id)
                            or tool_call_id
                        )
                        error_msg = (
                            data.get("message")
                            or data.get("error")
                            or data.get("error_message")
                            or data.get("stderr")
                            or "unknown error"
                        )
                        tools_errored.append(errored_name)
                        tool_error_messages[errored_name] = error_msg
                        if verbose:
                            print(f"⚠️ Tool error: {errored_name} — {error_msg}")

                    if "assistant_message_chunk" in data:
                        assistant_response += data["assistant_message_chunk"]
                        final_response += data["assistant_message_chunk"]

                    if "forms" in data and len(data["forms"]) > 0:
                        form = data["forms"][0]
                        form_title = form["formTitle"]
                        form_fields = [
                            {
                                "name": field.get("name"),
                                "label": field.get("label"),
                                "type": field.get("type"),
                                "value": field.get("defaultValue"),
                                "required": field.get("required", False),
                                "options": [
                                    {"label": opt.get("label"), "value": opt.get("value")}
                                    for opt in field.get("options", [])
                                ] or None,
                            }
                            for field in form.get("formFields", [])
                            # "submit" entries are action buttons, not data fields
                            if field.get("type") != "submit" and field.get("label")
                        ]

    except Exception as e:
        print(f"❌ Request failed: {e}")

    return tools_called, tools_errored, tool_error_messages, assistant_response.strip(), final_response.strip(), form_title, form_fields, session_id



async def safe_send_query(session, query, persona_id, auth_context, retries=2, verbose=False):
    for attempt in range(retries):
        try:
            return await send_query(session, query, persona_id, auth_context, verbose=verbose)
        except Exception as e:
            print(f"⚠️ Retry {attempt+1} failed:", e)
            await asyncio.sleep(2)

    return [], [], {}, "", "", None, [], None
