import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "lib"))

from mcp.server.mcpserver import MCPServer

import boards
import h1b
import resume_pdf
import tracker

mcp = MCPServer("job-pipeline")

SEED_COMPANIES_PATH = os.path.join(os.path.dirname(__file__), "seed_companies.example.json")


@mcp.tool()
def init_tracker(path: str) -> str:
    """Create Tracker.xlsx with Outreach + Assets sheets and headers if it doesn't already exist.
    Idempotent — a no-op if the file already exists."""
    return tracker.init_tracker(path)


@mcp.tool()
def get_or_create_company_code(company: str, tracker_path: str) -> str:
    """Return the existing resume code for a company (e.g. 'I0'), or derive, assign, and persist
    a new one (first letter of the company name + a per-letter counter) if it's not yet in the
    Outreach sheet. One code per company, reused across all of that company's postings."""
    return tracker.get_or_create_company_code(company, tracker_path)


@mcp.tool()
def append_outreach_row(
    tracker_path: str,
    company: str,
    job_board_link: str,
    platform: str,
    contact_name: str,
    contact_email: str,
    contact_phone: str,
    resume_file_link: str,
    status: str = "drafted",
) -> dict:
    """Assign/reuse a company code and append a new row to the Outreach sheet with today's date."""
    return tracker.append_outreach_row(
        tracker_path,
        company,
        job_board_link,
        platform,
        contact_name,
        contact_email,
        contact_phone,
        resume_file_link,
        status,
    )


@mcp.tool()
def update_outreach_status(tracker_path: str, code: str, job_board_link: str, status: str) -> bool:
    """Update the Status of a specific Outreach row (identified by code + job_board_link, since
    one company/code can have multiple postings/rows). Status: drafted / sent / turned."""
    return tracker.update_outreach_status(tracker_path, code, job_board_link, status)


@mcp.tool()
def mark_turned(tracker_path: str, code: str, job_board_link: str) -> dict:
    """Set an Outreach row's Status to 'turned' and append a matching row to the Assets sheet
    with initial Status 'interested to recruit'. Returns the new Assets row."""
    return tracker.mark_turned(tracker_path, code, job_board_link)


@mcp.tool()
def refresh_h1b_data(force: bool = False) -> dict:
    """Check DOL's OFLC performance page for the latest quarterly LCA disclosure file and
    re-index it locally if it's newer than what's cached (or force=True). Run this every few
    weeks — releases are quarterly, so there's no need for real-time polling."""
    return h1b.refresh_h1b_data(force=force)


@mcp.tool()
def search_h1b_sponsors(
    employer: str = "", job_title_keyword: str = "", state: str = "", limit: int = 50
) -> list[dict]:
    """Query the locally cached LCA index (built by refresh_h1b_data) for companies with
    certified H1B sponsorship filings. Filter by employer name substring, job title/SOC title
    keyword, and/or 2-letter worksite state (e.g. 'CA'). Returns companies sorted by filing
    count, each with sample job titles and worksite states."""
    return h1b.search_h1b_sponsors(
        employer=employer or None,
        job_title_keyword=job_title_keyword or None,
        state=state or None,
        limit=limit,
    )


@mcp.tool()
def search_company_job_board(
    company: str,
    platform: str,
    token: str,
    keyword: str = "",
    workday_host: str = "wd1",
    workday_site: str = "External",
) -> list[dict]:
    """Fetch current open postings from a company's Greenhouse, Lever, or Workday board.
    `platform` in {'greenhouse','lever','workday'}; `token` is the Greenhouse board token,
    Lever company slug, or Workday tenant name — there is no cross-company discovery, so the
    caller must supply the right one (see seed_companies.json, or look it up manually).
    Raises a clear error if the token/slug is invalid so the caller can try a variant."""
    return boards.search_company_job_board(
        company, platform, token, keyword=keyword or None, workday_host=workday_host, workday_site=workday_site
    )


@mcp.tool()
def get_seed_companies(path: str = SEED_COMPANIES_PATH) -> dict:
    """Return a seed list of target companies with known Greenhouse/Lever/Workday board tokens
    where verified, or 'manual' where no public board API token was found (requiring web
    research for current postings). Defaults to the bundled example; pass your own path for a
    different role/region (e.g. mechanical engineering companies in Seattle)."""
    with open(path) as f:
        return json.load(f)


@mcp.tool()
def convert_docx_to_pdf(docx_path: str, outdir: str) -> dict:
    """Convert a .docx file to PDF via headless LibreOffice, and report the resulting page
    count. Use this as the final step after editing a tailored resume with the safe-docx tools —
    page_count > 1 means the content overflowed and must be trimmed, then reconverted."""
    return resume_pdf.convert_docx_to_pdf(docx_path, outdir)


if __name__ == "__main__":
    mcp.run(transport="stdio")
