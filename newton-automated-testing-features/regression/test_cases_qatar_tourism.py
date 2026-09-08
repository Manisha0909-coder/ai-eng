QATAR_TOURISM_PERSONA_ID = 106

QATAR_TOURISM_TEST_CASES = [
    {
        "query": "Find me round-trip flights from New York (JFK) to Doha on Qatar Airways, departing December 15, 2026 and returning December 22, 2026, for 2 adults in business class. I'd like to book the best option.",
        "persona_id": QATAR_TOURISM_PERSONA_ID,
        "expected_tools": ["Flight Search", "Flight Booking"],
        "expect_form": False,
        "enabled": True,
    },
    {
        "query": "Search for a 5-star luxury beachfront hotel in Doha, check-in December 15, check-out December 22, 2026, for 2 adults. Show me the best options and I'd like to book one.",
        "persona_id": QATAR_TOURISM_PERSONA_ID,
        "expected_tools": ["Hotel Search", "Hotel Booking"],
        "expect_form": False,
        "enabled": True,
    },
    {
        "query": "I'm visiting Qatar for 3 days in December. Show me available itineraries (especially art & culture and adventure), the best things to do, and what festivals or events are happening that month.",
        "persona_id": QATAR_TOURISM_PERSONA_ID,
        "expected_tools": ["Qatar Itineraries", "Qatar Things To Do", "Qatar Calendar"],
        "expect_form": False,
        "enabled": True,
    },
    {
        "query": "Find me the best fine-dining Middle Eastern and seafood restaurants in The Pearl, Doha for a romantic dinner for 2 on December 16, 2026.",
        "persona_id": QATAR_TOURISM_PERSONA_ID,
        "expected_tools": ["Restaurant Search"],
        "expect_form": False,
        "enabled": True,
    },
    {
        "query": "How long does it take to drive from Hamad International Airport to The Pearl? Also, what's the travel time from The Pearl to Souq Waqif and then from Souq Waqif back to the airport? I need to plan a layover trip.",
        "persona_id": QATAR_TOURISM_PERSONA_ID,
        "expected_tools": ["Travel Time"],
        "expect_form": False,
        "enabled": True,
    },
    {
        "query": "Tell me everything about the Hayya A1 tourist visa — costs, requirements, photo specs. Then help me apply for one from December 15 to December 22, 2026. Also show me any existing visa applications I have.",
        "persona_id": QATAR_TOURISM_PERSONA_ID,
        "expected_tools": ["Get Hayya Info", "Hayya Visa", "List My Visa Applications"],
        "expect_form": False,
        "enabled": True,
    },
    {
        "query": "Create a full 7-day Qatar luxury getaway package for 2 adults: Qatar Airways flights from London to Doha (Dec 15–22), a 5-star hotel, a curated daily itinerary with desert safari, dhow cruise, museum visits, and spa days. Include the Hayya visa too. Book it all together.",
        "persona_id": QATAR_TOURISM_PERSONA_ID,
        "expected_tools": ["Flight Search", "Hotel Search", "Qatar Itineraries", "Qatar Things To Do", "Hayya Visa", "Create Package"],
        "expect_form": False,
        "enabled": True,
    },
    {
        "query": "Show me all my previously booked Qatar travel packages — I want to review my bookings.",
        "persona_id": QATAR_TOURISM_PERSONA_ID,
        "expected_tools": ["List My Booked Packages"],
        "expect_form": False,
        "enabled": True,
    },
    {
        "query": "Generate an image of the Doha skyline at golden hour with a traditional dhow boat in the foreground and the Museum of Islamic Art visible.",
        "persona_id": QATAR_TOURISM_PERSONA_ID,
        "expected_tools": ["Generate Image"],
        "expect_form": False,
        "enabled": True,
    },
    {
        "query": "Search for the latest Qatar entry requirements for 2026, any new attractions opening soon, and also pull up my account details so we can personalize my trip.",
        "persona_id": QATAR_TOURISM_PERSONA_ID,
        "expected_tools": ["Firecrawl Web Search", "Qatar User Details"],
        "expect_form": False,
        "enabled": True,
    },
]
