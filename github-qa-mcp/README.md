# github-qa-mcp

An MCP (Model Context Protocol) server for asking questions about GitHub
repositories — repo metadata, issues, pull requests, commits, file
contents, and search — directly from an MCP-compatible client (Claude,
etc.).

## Structure

- `server.py` — the MCP server: defines the tools and the `repo_qa` prompt.
- `github_api.py` — thin async wrapper around the GitHub REST API.
- `client.py` — standalone test client that starts the server over stdio
  and exercises a few tools.
- `requirements.txt` — Python dependencies.
- `.env` — local config (GitHub token). Not committed.

## Setup

```bash
cd github-qa-mcp
source .venv/bin/activate
pip install -r requirements.txt
```

Optionally add a GitHub personal access token to `.env`:

```
GITHUB_TOKEN=ghp_xxxxxxxxxxxx
```

This isn't required for reading public repositories, but raises the
GitHub API rate limit from 60 to 5,000 requests/hour, and is required
to access private repos. Create a token at
https://github.com/settings/tokens.

## Running

Test it directly with the bundled client:

```bash
python client.py
```

Or point an MCP client (e.g. Claude Desktop / Claude Code) at it by
running:

```bash
python server.py
```

## Tools

| Tool | Description |
|---|---|
| `get_repo_info` | Repo metadata: description, stars, forks, language, license |
| `list_issues` | List issues by state (`open`/`closed`/`all`) |
| `get_issue` | Full details of one issue |
| `list_issue_comments` | Comments on an issue or PR |
| `list_pull_requests` | List pull requests by state |
| `get_pull_request` | Full details of one pull request |
| `list_commits` | Recent commits, optionally by branch |
| `get_readme` | Decoded README contents |
| `get_file_content` | Decoded contents of a file at a given path/ref |
| `search_issues` | Search issues/PRs with GitHub search syntax |

## Prompt

`repo_qa(owner, repo, question)` — guides the model to use the tools
above to answer a free-form question about a repository.
