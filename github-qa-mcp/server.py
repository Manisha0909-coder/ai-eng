"""GitHub QA MCP Server.

Exposes read-only tools for asking questions about a GitHub repository:
repo metadata, issues, pull requests, commits, file contents and search.
Requires no auth for public repos, but a GITHUB_TOKEN in .env raises the
GitHub API rate limit and is required for private repos.
"""

import base64

from mcp.server.mcpserver import MCPServer

from github_api import GitHubAPI, GitHubAPIError

mcp = MCPServer("GitHub QA Server")
github = GitHubAPI()


@mcp.tool()
async def get_repo_info(owner: str, repo: str) -> str:
    """Get metadata about a GitHub repository: description, stars, forks, language, license, etc."""

    try:
        data = await github.get_repo(owner, repo)
    except GitHubAPIError as e:
        return f"Error: {e}"

    return (
        f"Repository: {data['full_name']}\n"
        f"Description: {data.get('description') or 'N/A'}\n"
        f"Default branch: {data['default_branch']}\n"
        f"Language: {data.get('language') or 'N/A'}\n"
        f"Stars: {data['stargazers_count']}\n"
        f"Forks: {data['forks_count']}\n"
        f"Open issues: {data['open_issues_count']}\n"
        f"License: {(data.get('license') or {}).get('name', 'N/A')}\n"
        f"URL: {data['html_url']}"
    )


@mcp.tool()
async def list_issues(owner: str, repo: str, state: str = "open", limit: int = 10) -> str:
    """List issues in a repository. state can be 'open', 'closed', or 'all'."""

    try:
        issues = await github.list_issues(owner, repo, state=state, limit=limit)
    except GitHubAPIError as e:
        return f"Error: {e}"

    if not issues:
        return f"No {state} issues found."

    lines = [f"#{i['number']} [{i['state']}] {i['title']}" for i in issues]
    return "\n".join(lines)


@mcp.tool()
async def get_issue(owner: str, repo: str, issue_number: int) -> str:
    """Get the full details of a single issue, including its body."""

    try:
        issue = await github.get_issue(owner, repo, issue_number)
    except GitHubAPIError as e:
        return f"Error: {e}"

    return (
        f"#{issue['number']} {issue['title']}\n"
        f"State: {issue['state']}\n"
        f"Author: {issue['user']['login']}\n"
        f"Labels: {', '.join(l['name'] for l in issue['labels']) or 'none'}\n"
        f"Comments: {issue['comments']}\n"
        f"URL: {issue['html_url']}\n\n"
        f"{issue.get('body') or '(no description)'}"
    )


@mcp.tool()
async def list_issue_comments(owner: str, repo: str, issue_number: int, limit: int = 10) -> str:
    """List the most recent comments on an issue or pull request."""

    try:
        comments = await github.list_issue_comments(owner, repo, issue_number, limit=limit)
    except GitHubAPIError as e:
        return f"Error: {e}"

    if not comments:
        return "No comments found."

    lines = [f"{c['user']['login']}: {c['body']}" for c in comments]
    return "\n\n".join(lines)


@mcp.tool()
async def list_pull_requests(owner: str, repo: str, state: str = "open", limit: int = 10) -> str:
    """List pull requests in a repository. state can be 'open', 'closed', or 'all'."""

    try:
        prs = await github.list_pull_requests(owner, repo, state=state, limit=limit)
    except GitHubAPIError as e:
        return f"Error: {e}"

    if not prs:
        return f"No {state} pull requests found."

    lines = [f"#{pr['number']} [{pr['state']}] {pr['title']} ({pr['head']['ref']} -> {pr['base']['ref']})" for pr in prs]
    return "\n".join(lines)


@mcp.tool()
async def get_pull_request(owner: str, repo: str, pr_number: int) -> str:
    """Get the full details of a single pull request, including its body and merge status."""

    try:
        pr = await github.get_pull_request(owner, repo, pr_number)
    except GitHubAPIError as e:
        return f"Error: {e}"

    return (
        f"#{pr['number']} {pr['title']}\n"
        f"State: {pr['state']}\n"
        f"Author: {pr['user']['login']}\n"
        f"Branch: {pr['head']['ref']} -> {pr['base']['ref']}\n"
        f"Mergeable: {pr.get('mergeable')}\n"
        f"Merged: {pr['merged']}\n"
        f"Additions/Deletions: +{pr['additions']}/-{pr['deletions']}\n"
        f"Changed files: {pr['changed_files']}\n"
        f"URL: {pr['html_url']}\n\n"
        f"{pr.get('body') or '(no description)'}"
    )


@mcp.tool()
async def list_commits(owner: str, repo: str, branch: str = "", limit: int = 10) -> str:
    """List recent commits on a repository, optionally for a specific branch."""

    try:
        commits = await github.list_commits(owner, repo, branch=branch or None, limit=limit)
    except GitHubAPIError as e:
        return f"Error: {e}"

    if not commits:
        return "No commits found."

    lines = []
    for c in commits:
        message = c["commit"]["message"].splitlines()[0]
        author = c["commit"]["author"]["name"]
        sha = c["sha"][:7]
        lines.append(f"{sha} {message} ({author})")

    return "\n".join(lines)


@mcp.tool()
async def get_readme(owner: str, repo: str) -> str:
    """Get the decoded contents of a repository's README file."""

    try:
        data = await github.get_readme(owner, repo)
    except GitHubAPIError as e:
        return f"Error: {e}"

    content = base64.b64decode(data["content"]).decode("utf-8", errors="replace")
    return content


@mcp.tool()
async def get_file_content(owner: str, repo: str, path: str, ref: str = "") -> str:
    """Get the decoded contents of a specific file in a repository. path is relative to the repo root."""

    try:
        data = await github.get_file_content(owner, repo, path, ref=ref or None)
    except GitHubAPIError as e:
        return f"Error: {e}"

    if isinstance(data, list):
        return f"'{path}' is a directory, not a file."

    if data.get("encoding") != "base64":
        return f"Cannot decode file with encoding '{data.get('encoding')}'."

    content = base64.b64decode(data["content"]).decode("utf-8", errors="replace")
    return content


@mcp.tool()
async def search_issues(query: str, limit: int = 10) -> str:
    """Search issues and pull requests across GitHub using GitHub's search syntax,
    e.g. 'repo:owner/repo is:issue is:open label:bug'."""

    try:
        results = await github.search_issues(query, limit=limit)
    except GitHubAPIError as e:
        return f"Error: {e}"

    items = results.get("items", [])

    if not items:
        return "No results found."

    lines = [f"#{item['number']} [{item['state']}] {item['title']} ({item['html_url']})" for item in items]
    return f"Total matches: {results['total_count']}\n\n" + "\n".join(lines)


@mcp.prompt(
    name="repo_qa",
    description="Answer a question about a GitHub repository using the available tools."
)
def repo_qa(owner: str, repo: str, question: str) -> str:
    return f"""
Answer this question about the GitHub repository {owner}/{repo}:

{question}

Use the available tools (get_repo_info, list_issues, get_issue, list_issue_comments,
list_pull_requests, get_pull_request, list_commits, get_readme, get_file_content,
search_issues) to gather the information you need before answering.

Do not make up information. If the tools don't return enough detail to answer
confidently, say so.
"""


if __name__ == "__main__":
    mcp.run()
