import httpx


def _search_greenhouse(token: str, keyword: str | None) -> list[dict]:
    url = f"https://boards-api.greenhouse.io/v1/boards/{token}/jobs"
    resp = httpx.get(url, timeout=20, follow_redirects=True)
    resp.raise_for_status()
    jobs = resp.json().get("jobs", [])

    results = []
    for job in jobs:
        title = job.get("title", "")
        if keyword and keyword.lower() not in title.lower():
            continue
        results.append(
            {
                "title": title,
                "location": (job.get("location") or {}).get("name", ""),
                "url": job.get("absolute_url", ""),
                "id": job.get("id"),
                "updated_at": job.get("updated_at"),
            }
        )
    return results


def _search_lever(slug: str, keyword: str | None) -> list[dict]:
    url = f"https://api.lever.co/v0/postings/{slug}?mode=json"
    resp = httpx.get(url, timeout=20, follow_redirects=True)
    resp.raise_for_status()
    data = resp.json()
    if isinstance(data, dict):
        raise RuntimeError(f"Lever slug {slug!r} invalid: {data.get('error', data)}")

    results = []
    for job in data:
        title = job.get("text", "")
        if keyword and keyword.lower() not in title.lower():
            continue
        categories = job.get("categories", {}) or {}
        results.append(
            {
                "title": title,
                "location": categories.get("location", ""),
                "url": job.get("hostedUrl", ""),
                "id": job.get("id"),
                "updated_at": job.get("createdAt"),
            }
        )
    return results


def _search_workday(tenant: str, host: str, site: str, keyword: str | None) -> list[dict]:
    url = f"https://{tenant}.{host}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs"
    payload = {"limit": 20, "offset": 0, "searchText": keyword or ""}
    resp = httpx.post(url, json=payload, timeout=20)
    resp.raise_for_status()
    data = resp.json()

    results = []
    for job in data.get("jobPostings", []):
        results.append(
            {
                "title": job.get("title", ""),
                "location": job.get("locationsText", ""),
                "url": f"https://{tenant}.{host}.myworkdayjobs.com/{site}{job.get('externalPath', '')}",
                "id": job.get("bulletFields", [None])[-1],
                "updated_at": job.get("postedOn"),
            }
        )
    return results


def search_company_job_board(
    company: str,
    platform: str,
    token: str,
    keyword: str | None = None,
    workday_host: str = "wd1",
    workday_site: str = "External",
) -> list[dict]:
    """platform in {'greenhouse','lever','workday'}. `token` is the Greenhouse board token,
    Lever company slug, or Workday tenant name (caller supplies it — no cross-company discovery
    exists for any of these). Raises a clear error if the token/slug is invalid so the caller
    can try a variant."""
    platform = platform.lower()
    if platform == "greenhouse":
        return _search_greenhouse(token, keyword)
    if platform == "lever":
        return _search_lever(token, keyword)
    if platform == "workday":
        return _search_workday(token, workday_host, workday_site, keyword)
    raise ValueError(f"Unknown platform: {platform!r}. Must be greenhouse, lever, or workday.")
