"""Thin async wrapper around the GitHub REST API (v3).

Every method returns plain Python data (dict/list) already trimmed down
to the fields the MCP tools in server.py actually need, or raises
GitHubAPIError with a human-readable message on failure.
"""

import os

import httpx
from dotenv import load_dotenv

load_dotenv()

GITHUB_API_URL = "https://api.github.com"
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")


class GitHubAPIError(Exception):
    """Raised when the GitHub API returns an error response."""


class GitHubAPI:
    """Async client for the subset of the GitHub REST API used by this server."""

    def __init__(self, token: str | None = GITHUB_TOKEN):
        self.token = token

    def _headers(self) -> dict:
        headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    async def _request(self, method: str, path: str, params: dict | None = None) -> dict | list:
        url = f"{GITHUB_API_URL}{path}"

        async with httpx.AsyncClient() as client:
            response = await client.request(
                method,
                url,
                headers=self._headers(),
                params=params,
                timeout=15,
            )

        if response.status_code == 404:
            raise GitHubAPIError(f"Not found: {path}")

        if response.status_code == 403 and "rate limit" in response.text.lower():
            raise GitHubAPIError("GitHub API rate limit exceeded. Add a GITHUB_TOKEN to .env to raise the limit.")

        if response.status_code >= 400:
            raise GitHubAPIError(f"GitHub API error ({response.status_code}): {response.text[:300]}")

        return response.json()

    async def get_repo(self, owner: str, repo: str) -> dict:
        return await self._request("GET", f"/repos/{owner}/{repo}")

    async def list_issues(self, owner: str, repo: str, state: str = "open", limit: int = 10) -> list:
        issues = await self._request(
            "GET",
            f"/repos/{owner}/{repo}/issues",
            params={"state": state, "per_page": limit},
        )
        # The issues endpoint also returns pull requests; filter those out.
        return [issue for issue in issues if "pull_request" not in issue]

    async def get_issue(self, owner: str, repo: str, issue_number: int) -> dict:
        return await self._request("GET", f"/repos/{owner}/{repo}/issues/{issue_number}")

    async def list_issue_comments(self, owner: str, repo: str, issue_number: int, limit: int = 10) -> list:
        return await self._request(
            "GET",
            f"/repos/{owner}/{repo}/issues/{issue_number}/comments",
            params={"per_page": limit},
        )

    async def list_pull_requests(self, owner: str, repo: str, state: str = "open", limit: int = 10) -> list:
        return await self._request(
            "GET",
            f"/repos/{owner}/{repo}/pulls",
            params={"state": state, "per_page": limit},
        )

    async def get_pull_request(self, owner: str, repo: str, pr_number: int) -> dict:
        return await self._request("GET", f"/repos/{owner}/{repo}/pulls/{pr_number}")

    async def list_commits(self, owner: str, repo: str, branch: str | None = None, limit: int = 10) -> list:
        params = {"per_page": limit}
        if branch:
            params["sha"] = branch
        return await self._request("GET", f"/repos/{owner}/{repo}/commits", params=params)

    async def get_readme(self, owner: str, repo: str) -> dict:
        return await self._request("GET", f"/repos/{owner}/{repo}/readme")

    async def get_file_content(self, owner: str, repo: str, path: str, ref: str | None = None) -> dict:
        params = {"ref": ref} if ref else None
        return await self._request("GET", f"/repos/{owner}/{repo}/contents/{path}", params=params)

    async def search_issues(self, query: str, limit: int = 10) -> dict:
        return await self._request(
            "GET",
            "/search/issues",
            params={"q": query, "per_page": limit},
        )
