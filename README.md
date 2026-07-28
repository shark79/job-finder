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

## Is this actually portable, or just "open source"?

Being honest about this upfront: the MCP server itself (`job-finder`, and `safe-docx` which it depends on) is standard MCP over stdio, an open protocol, so it works in any MCP-compatible client, Cursor, Windsurf, Cline, Continue, Zed, whatever you use.

But the full pipeline as documented here is built specifically around **Claude Code**, and it won't fully work anywhere else:

- **Apollo.io and Gmail** are wired in as claude.ai's own hosted connectors, OAuth through your claude.ai account specifically. A different assistant would need its own separate Apollo/Gmail integration, this repo doesn't provide one.
- **JF-assistant** (the subagent that runs the whole thing end to end) is a Claude Code subagent file. That exact format only works in Claude Code. The instructions inside it are plain English though, so you can read them and adapt the logic to whatever your own tool's equivalent feature is.

So: the underlying tool, yes, portable. The turnkey experience described below, Claude Code only. If you're on something else, you can still use `job-finder`/`safe-docx` directly and just skip the Apollo/Gmail/subagent parts, or wire in your own equivalents.

## Prerequisites

In order, before you start:

1. **Claude Code installed.** If you don't have it yet, get it from Anthropic first, this whole guide assumes you're running it.
2. **Node.js installed.** Needed to run `npx`, which is how the MCP tools get installed and run.
3. **A claude.ai account**, since Apollo.io and Gmail connect through claude.ai's connector settings, not through Claude Code itself.
4. **An Apollo.io account** (free tier works for basic contact search), since that's what finds recruiter contacts.

## Setup, step by step

1. Install LibreOffice, it's what converts your tailored resume from Word to PDF:
   ```
   brew install --cask libreoffice
   ```
   (On Windows/Linux, install LibreOffice however your OS normally installs software, just make sure `soffice` ends up on your PATH.)

2. Add the job-finder MCP tool:
   ```
   claude mcp add job-finder -- npx -y @sharkbuilds/job-finder
   ```

3. Add the safe-docx MCP tool, this is what edits your resume without breaking its formatting:
   ```
   claude mcp add safe-docx -- npx -y @usejunior/safe-docx
   ```

4. Connect Apollo.io and Gmail. This part isn't a terminal command, open claude.ai in your browser, go to connector settings, and connect both. This step has to happen through claude.ai's own settings, not the CLI.

5. Add the subagent that ties it all together, see the next section for exactly how.

6. Restart Claude Code completely. Newly added MCP tools and subagents don't show up in a session that was already running, you need a fresh one.

7. Run `/mcp` inside Claude Code and confirm you see `job-finder`, `safe-docx`, Apollo, and Gmail all listed as connected. If something's missing, go back and redo that step before continuing.

8. Now just talk to it. Tell it what you're looking for, e.g. "find me backend engineer jobs in Austin." First run it'll ask you a few questions (your name, your base resume as a `.docx` file, target role, target region) and save your answers so it only asks once.

## Adding the JF-assistant subagent

A subagent is just a text file with instructions in it, Claude Code reads it and follows those instructions when you invoke it. `JF-assistant.md` in this repo already has the whole pipeline written out, you don't need to write anything yourself.

Baby steps:

1. Find the `.claude` folder in your home directory. On Mac/Linux this is `~/.claude`, if it doesn't have an `agents` folder inside it yet, make one:
   ```
   mkdir -p ~/.claude/agents
   ```

2. Copy `JF-assistant.md` from this repo into that folder. Either clone the whole repo first and copy the file, or just download that one file directly and save it there as `~/.claude/agents/JF-assistant.md`.

3. That's it, no editing needed. Restart Claude Code (step 6 above already covers this if you're doing setup in order).

4. Confirm it's there by asking Claude Code something like "do you have a JF-assistant subagent available?" or just start using it directly, "use JF-assistant to find me jobs."

If you ever want it available in one specific project only instead of everywhere, put the copy in that project's own `.claude/agents/` folder instead of your home directory's.

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
