### **US001 – Login with Zitadel (PKCE OAuth2 flow)**

**User Story**
As a user, I want to log in using Zitadel via a secure OAuth2 PKCE flow so that my authentication is secure and reliable.

**Acceptance Criteria**

- Redirects user to Zitadel login page
- Uses PKCE OAuth2 flow for secure authentication
- Successfully logs in user upon valid credentials
- Redirects back to application after login
- Displays error on failed login

---

### **US002 – JWT access token validation on every API call**

**User Story**
As a user, I want my session to be validated on every API call so that unauthorized access is prevented.

**Acceptance Criteria**

- Validates JWT token on each API request
- Rejects invalid or expired tokens
- Returns 401 Unauthorized for invalid requests
- Allows access only with valid tokens

---

### **US003 – Token refresh without forcing re-login**

**User Story**
As a user, I want my session to refresh automatically so that I don’t have to log in repeatedly.

**Acceptance Criteria**

- Automatically refreshes token before expiration
- Does not interrupt active session
- Prompts login only if refresh fails
- Maintains seamless user experience

---

### **US004 – HTTP-only secure cookies for session**

**User Story**
As a user, I want my session data to be stored securely so that it is protected from client-side attacks.

**Acceptance Criteria**

- Stores session tokens in HTTP-only cookies
- Cookies are marked as secure
- Prevents access via client-side scripts
- Follows security best practices

---

### **US005 – System admin endpoints reject non-admin users (403)**

**User Story**
As a user, I want proper access control so that only authorized users can access admin endpoints.

**Acceptance Criteria**

- Validates user role before granting access
- Rejects non-admin users with 403 Forbidden
- Allows access only to admin users
- Logs unauthorized access attempts

---

### **US006 – Tokens stored encrypted in vault DB**

**User Story**
As a user, I want my tokens to be stored securely so that sensitive data is protected.

**Acceptance Criteria**

- Stores tokens in encrypted format
- Uses secure vault or encrypted database storage
- Prevents plain-text storage of tokens
- Restricts access to authorized systems only

---

### **US007 – Logout clears session and redirects to Zitadel end_session**

**User Story**
As a user, I want to log out securely so that my session is fully terminated.

**Acceptance Criteria**

- Clears session and authentication cookies
- Invalidates tokens if applicable
- Redirects to Zitadel end_session endpoint
- Confirms successful logout

---
