#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as tracker from "./lib/tracker.js";
import * as h1b from "./lib/h1b.js";
import { searchCompanyJobBoard } from "./lib/boards.js";
import { convertDocxToPdf } from "./lib/resumePdf.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_COMPANIES_PATH = path.join(__dirname, "seed_companies.example.json");

const server = new McpServer({ name: "job-finder", version: "1.0.0" });

server.registerTool(
  "init_tracker",
  {
    title: "Init Tracker",
    description:
      "Create Tracker.xlsx with Outreach + Assets sheets and headers if it doesn't already exist. Idempotent.",
    inputSchema: { path: z.string() },
  },
  async ({ path }) => {
    const result = await tracker.initTracker(path);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
);

server.registerTool(
  "get_or_create_company_code",
  {
    title: "Get Or Create Company Code",
    description:
      "Return the existing resume code for a company (e.g. 'I0'), or derive, assign, and persist a new one. One code per company, reused across all of that company's postings.",
    inputSchema: { company: z.string(), tracker_path: z.string() },
  },
  async ({ company, tracker_path }) => {
    const code = await tracker.getOrCreateCompanyCode(company, tracker_path);
    return { content: [{ type: "text", text: code }] };
  }
);

server.registerTool(
  "append_outreach_row",
  {
    title: "Append Outreach Row",
    description: "Assign/reuse a company code and append a new row to the Outreach sheet with today's date.",
    inputSchema: {
      tracker_path: z.string(),
      company: z.string(),
      job_board_link: z.string(),
      platform: z.string(),
      contact_name: z.string(),
      contact_email: z.string(),
      contact_phone: z.string(),
      resume_file_link: z.string(),
      status: z.string().default("drafted"),
    },
  },
  async (args) => {
    const result = await tracker.appendOutreachRow(
      args.tracker_path,
      args.company,
      args.job_board_link,
      args.platform,
      args.contact_name,
      args.contact_email,
      args.contact_phone,
      args.resume_file_link,
      args.status
    );
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
);

server.registerTool(
  "update_outreach_status",
  {
    title: "Update Outreach Status",
    description:
      "Update the Status of a specific Outreach row (identified by code + job_board_link). Status: drafted / sent / turned.",
    inputSchema: {
      tracker_path: z.string(),
      code: z.string(),
      job_board_link: z.string(),
      status: z.string(),
    },
  },
  async ({ tracker_path, code, job_board_link, status }) => {
    const ok = await tracker.updateOutreachStatus(tracker_path, code, job_board_link, status);
    return { content: [{ type: "text", text: JSON.stringify(ok) }] };
  }
);

server.registerTool(
  "mark_turned",
  {
    title: "Mark Turned",
    description:
      "Set an Outreach row's Status to 'turned' and append a matching row to the Assets sheet with initial Status 'interested to recruit'.",
    inputSchema: { tracker_path: z.string(), code: z.string(), job_board_link: z.string() },
  },
  async ({ tracker_path, code, job_board_link }) => {
    const result = await tracker.markTurned(tracker_path, code, job_board_link);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
);

server.registerTool(
  "refresh_h1b_data",
  {
    title: "Refresh H1B Data",
    description:
      "Check DOL's OFLC performance page for the latest quarterly LCA disclosure file and re-index it locally if newer than what's cached. Run every few weeks, releases are quarterly.",
    inputSchema: { force: z.boolean().default(false) },
  },
  async ({ force }) => {
    const result = await h1b.refreshH1bData(force);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
);

server.registerTool(
  "search_h1b_sponsors",
  {
    title: "Search H1B Sponsors",
    description:
      "Query the locally cached LCA index for companies with certified H1B sponsorship filings. Filter by employer name substring, job title/SOC title keyword, and/or 2-letter worksite state.",
    inputSchema: {
      employer: z.string().default(""),
      job_title_keyword: z.string().default(""),
      state: z.string().default(""),
      limit: z.number().default(50),
    },
  },
  async ({ employer, job_title_keyword, state, limit }) => {
    const results = await h1b.searchH1bSponsors(employer || null, job_title_keyword || null, state || null, limit);
    return { content: [{ type: "text", text: JSON.stringify(results) }] };
  }
);

server.registerTool(
  "search_company_job_board",
  {
    title: "Search Company Job Board",
    description:
      "Fetch current open postings from a company's Greenhouse, Lever, or Workday board. No cross-company discovery exists, caller must supply the right token/slug.",
    inputSchema: {
      company: z.string(),
      platform: z.string(),
      token: z.string(),
      keyword: z.string().default(""),
      workday_host: z.string().default("wd1"),
      workday_site: z.string().default("External"),
    },
  },
  async (args) => {
    const results = await searchCompanyJobBoard(
      args.company,
      args.platform,
      args.token,
      args.keyword || null,
      args.workday_host,
      args.workday_site
    );
    return { content: [{ type: "text", text: JSON.stringify(results) }] };
  }
);

server.registerTool(
  "get_seed_companies",
  {
    title: "Get Seed Companies",
    description:
      "Return a seed list of target companies with known Greenhouse/Lever/Workday board tokens where verified, or 'manual' otherwise. Defaults to the bundled example; pass your own path for a different role/region.",
    inputSchema: { path: z.string().default(SEED_COMPANIES_PATH) },
  },
  async ({ path: seedPath }) => {
    const data = JSON.parse(fs.readFileSync(seedPath, "utf-8"));
    return { content: [{ type: "text", text: JSON.stringify(data) }] };
  }
);

server.registerTool(
  "convert_docx_to_pdf",
  {
    title: "Convert Docx To Pdf",
    description:
      "Convert a .docx file to PDF via headless LibreOffice, and report the page count. page_count > 1 means content overflowed and must be trimmed.",
    inputSchema: { docx_path: z.string(), outdir: z.string() },
  },
  async ({ docx_path, outdir }) => {
    const result = await convertDocxToPdf(docx_path, outdir);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
