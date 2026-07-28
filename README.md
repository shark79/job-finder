# Job Finder

A job-search outreach pipeline built as an MCP tool for Claude Code. It checks which companies have a real H1B sponsorship history, checks which of those have real open postings right now, tailors a resume for a specific posting, finds a contact, drafts an outreach email, and logs everything in a tracker. It never sends an email on its own, drafts only, you review and send.

The published MCP server (`mcp-job-pipeline-node/`) is the one to actually use. The Python version (`mcp-job-pipeline/`) is the original implementation, kept for reference.

## How it works, in order

1. Check which companies have a real H1B sponsorship history, using the Department of Labor's own quarterly disclosure data, not a scraped third-party site.
2. Check which of those companies have real open postings right now (Greenhouse, Lever, Workday).
3. Tailor a resume's wording for that specific job, without touching formatting.
4. Convert it to PDF and confirm it's still one page.
5. Find a contact at the company.
6. Draft a personalized email, draft only, never sent automatically.
7. Log everything in a tracker spreadsheet.

## Quick start

You need Node, LibreOffice, and Claude Code.

```
brew install --cask libreoffice
claude mcp add job-finder -- npx -y @sharkbuilds/job-finder
claude mcp add safe-docx -- npx -y @usejunior/safe-docx
```

Connect Apollo.io and Gmail via your claude.ai connector settings (account-level, not a CLI step).

Drop `JF-assistant.md` into your own `.claude/agents/` folder, then restart Claude Code and run `/mcp` to confirm everything shows connected.

That's the setup. From there just tell JF-assistant what you're looking for, e.g. "find me backend engineer jobs in Austin." First run it'll ask a few questions (your name, your base resume as a `.docx`, target role, target region) and save the answers so it only asks once.

## Folder structure

```
job-finder/
  README.md
  JF-assistant.md              subagent that runs the whole pipeline end to end

  mcp-job-pipeline-node/        the MCP server to actually use, published to npm
    index.js                    registers all the tools with Claude Code
    package.json
    seed_companies.example.json example target-company list, replace with your own
    lib/
      tracker.js                reads/writes a tracker workbook (Outreach + Assets sheets)
      h1b.js                    downloads and indexes DOL's H1B sponsorship data
      boards.js                 fetches live job postings from Greenhouse/Lever/Workday
      resumePdf.js               converts a tailored resume docx to PDF, checks page count

  mcp-job-pipeline/              original Python implementation, kept for reference
    server.py
    requirements.txt
    seed_companies.example.json
    lib/
```

## The H1B data cache

There's no bundled H1B dataset, the source file is 130MB+ and updates every quarter from the Department of Labor. You build your own local copy.

Just ask Claude/JF-assistant to refresh it. If you want to trigger it manually without going through Claude, clone this repo and run:

```
cd mcp-job-pipeline-node
npm install
node -e "import('./lib/h1b.js').then(m => m.refreshH1bData()).then(console.log)"
```

This downloads the latest quarterly LCA disclosure file, filters it down to certified filings, and saves an index to `~/.job-finder/data/h1b/`. Takes a couple minutes the first time. Only re-run every few weeks, the government only publishes new data quarterly, and the refresh call itself is cheap to call often since it no-ops when nothing changed.

## Building your own target company list

`seed_companies.example.json` has a starter list. If you're targeting a different role or region, this is the file to rebuild, either by hand or let JF-assistant build one for you on first run via web research. Everything else, H1B search, job board search, tracker, resume tailoring, works the same regardless of role or location.

## What stays local, not in this repo

Your actual resume files, your actual tracker with real contacts, and the H1B data cache are all yours to keep local. Nothing personal ships with this repo, and the pipeline never uploads or commits anything on your behalf.
