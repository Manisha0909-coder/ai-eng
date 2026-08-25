from mcp.server.mcpserver import MCPServer


mcp = MCPServer("Employee Server")


@mcp.tool()
def get_employee(name: str) -> str:
    """Get employee information by name."""

    employees = {
        "Manisha": {
            "role": "QA Automation Engineer",
            "experience": "3+ years"
        },
        "Rahul": {
            "role": "Software Engineer",
            "experience": "4 years"
        }
    }

    employee = employees.get(name)

    if not employee:
        return f"Employee '{name}' not found."

    return (
        f"Name: {name}\n"
        f"Role: {employee['role']}\n"
        f"Experience: {employee['experience']}"
    )

@mcp.tool()
def calculate_leave_balance(
    total_leave: int,
    used_leave: int
) -> str:
    """Calculate remaining annual leave balance."""

    remaining_leave = total_leave - used_leave

    if remaining_leave < 0:
        return "Error: Used leave cannot be greater than total leave."

    return f"Remaining annual leave: {remaining_leave} days"

@mcp.tool()
def check_leave_eligibility(months_employed: int) -> str:
    """Check whether an employee is eligible for annual leave."""

    if months_employed < 0:
        return "Error: Months employed cannot be negative."

    if months_employed >= 6:
        return "Eligible for annual leave."

    remaining_months = 6 - months_employed

    return (
        f"Not eligible yet. "
        f"Employee needs {remaining_months} more month(s) "
        f"to become eligible."
    )

@mcp.resource("employee-policy://leave")
def employee_leave_policy() -> str:
    """Employee leave policy."""

    return """
Employee Leave Policy

Annual Leave:
Employees receive 20 days of annual leave per year.
Employees become eligible for annual leave after completing 6 months of employment.

Maternity Leave:
Employees receive 12 weeks of maternity leave.

Sick Leave:
Employees receive 10 days of sick leave per year.

Work From Home:
Employees can work from home twice per week.
"""

@mcp.prompt(
    name="employee_policy_review",
    description="Review an employee against the company leave policy."
)
def employee_policy_review(employee_name: str) -> str:
    return f"""
Review employee: {employee_name}

Use the employee data and employee leave policy.

Check:
1. Annual leave eligibility
2. Annual leave balance
3. Any policy violations

Do not make up information.
"""

if __name__ == "__main__":
    mcp.run()