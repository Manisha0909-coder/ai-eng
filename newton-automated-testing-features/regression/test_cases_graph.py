GRAPH_PERSONA_ID = 220

GRAPH_TEST_CASES = [
    {
        "query": "reply to the recent email i received that this is a test reply please ignore",
        "persona_id": GRAPH_PERSONA_ID,
        "expected_tools": ["Get Emails"],
        "expect_form": True,
        "expected_form_title": "Reply to Email",
        "enabled": True,
    },
    {
        "query": "send message on teams to testercs1 that meeting is sheduled tomorrow",
        "persona_id": GRAPH_PERSONA_ID,
        "expected_tools": ["Find Directory Users", "Compose Teams Message"],
        "expect_form": True,
        "expected_form_title": "Send Teams Message",
        "enabled": True,
    },
    {
        "query": "show me my recent messages",
        "persona_id": GRAPH_PERSONA_ID,
        "expected_tools": ["Get Emails", "Get Teams Chats"],
        "expect_form": False,
        "enabled": True,
    },
    {
        "query": "Show me my 5 most recent emails.",
        "persona_id": GRAPH_PERSONA_ID,
        "expected_tools": ["Get Emails"],
        "expect_form": False,
        "enabled": True,
    },
    {
        "query": "What meetings do I have scheduled for tomorrow?",
        "persona_id": GRAPH_PERSONA_ID,
        "expected_tools": ["Get Calendar Events"],
        "expect_form": False,
        "enabled": True,
    },
    {
        "query": "Schedule a 30-minute sync meeting with testercs1 for next Tuesday at 10:00 AM.",
        "persona_id": GRAPH_PERSONA_ID,
        "expected_tools": ["Find Directory Users", "Schedule Calendar Event"],
        "expect_form": True,
        "expected_form_title": "Create Calendar Event",
        "enabled": True,
    },
    {
        "query": "Send a Teams message to testercs1 saying 'Are we still on for the afternoon sync?",
        "persona_id": GRAPH_PERSONA_ID,
        "expected_tools": ["Find Directory Users", "Compose Teams Message"],
        "expect_form": True,
        "expected_form_title": "Send Teams Message",
        "enabled": True,
    },
    {
        "query": "Look up the contact details for yashwin in the company directory.",
        "persona_id": GRAPH_PERSONA_ID,
        "expected_tools": ["Find Directory Users"],
        "expect_form": False,
        "enabled": True,
    },
]