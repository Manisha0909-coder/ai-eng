ACCOUNT_NOT_CONNECTED_PHRASES = [
    "account is not connected",
    "account isn't connected",
    "not connected to your microsoft",
    "connect your microsoft account",
    "microsoft account is not connected",
    "microsoft account isn't connected",
    "please connect your account",
    "account has not been connected",
    "hasn't been connected",
]


def check_account_not_connected(response):
    """True if the assistant's response indicates the Microsoft account is not connected."""
    if not response:
        return False
    response_lower = response.lower()
    return any(phrase in response_lower for phrase in ACCOUNT_NOT_CONNECTED_PHRASES)


def check_keywords(response, keywords):
    """Check if all keywords are present in response."""
    response_lower = response.lower()
    found_keywords = []
    missing_keywords = []
    
    for keyword in keywords:
        if keyword.lower() in response_lower:
            found_keywords.append(keyword)
        else:
            missing_keywords.append(keyword)
    
    return found_keywords, missing_keywords


def extract_icv_values(response):
    """Extract ICV percentages/scores from response."""
    import re
    
    # Look for patterns like "22.98%", "ICV Score: 15.07%", etc.
    icv_pattern = r'(\d+\.?\d*)\s*%'
    icv_values = re.findall(icv_pattern, response)
    
    return icv_values
