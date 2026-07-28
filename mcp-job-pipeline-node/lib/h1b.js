import yauzl from "yauzl";
import sax from "sax";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import readline from "node:readline";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const DOL_PAGE_URL = "https://www.dol.gov/agencies/eta/foreign-labor/performance";
const FILE_PATTERN = /href="([^"]*LCA_Dis[a-z]*closure_Data_FY(\d{4})_Q(\d)\.xlsx)"/gi;

// Fixed user-level location, independent of wherever npx happens to cache the
// package install (that dir isn't guaranteed stable across npx cache clears).
const DATA_DIR = path.join(os.homedir(), ".job-finder", "data", "h1b");
const INDEX_JSONL = path.join(DATA_DIR, "h1b_index.jsonl");
const META_JSON = path.join(DATA_DIR, "meta.json");

const KEEP_STATUSES = new Set(["CERTIFIED", "CERTIFIED-WITHDRAWN"]);

const REQUIRED_COLUMNS = [
  "EMPLOYER_NAME",
  "JOB_TITLE",
  "SOC_TITLE",
  "WORKSITE_CITY",
  "WORKSITE_STATE",
  "VISA_CLASS",
  "CASE_STATUS",
  "FULL_TIME_POSITION",
  "BEGIN_DATE",
];

async function findLatestFileUrl() {
  const resp = await fetch(DOL_PAGE_URL);
  if (!resp.ok) throw new Error(`Failed to fetch DOL performance page: ${resp.status}`);
  const html = await resp.text();

  const candidates = [];
  for (const m of html.matchAll(FILE_PATTERN)) {
    const [, href, year, quarter] = m;
    candidates.push({ year: parseInt(year, 10), quarter: parseInt(quarter, 10), url: new URL(href, DOL_PAGE_URL).toString() });
  }
  if (candidates.length === 0) {
    throw new Error("No LCA_Disclosure_Data file links found on DOL performance page.");
  }

  candidates.sort((a, b) => a.year - b.year || a.quarter - b.quarter);
  const latest = candidates[candidates.length - 1];
  return { url: latest.url, filename: path.basename(latest.url) };
}

function loadMeta() {
  if (!fs.existsSync(META_JSON)) return {};
  return JSON.parse(fs.readFileSync(META_JSON, "utf-8"));
}

function saveMeta(meta) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(META_JSON, JSON.stringify(meta, null, 2));
}

export async function refreshH1bData(force = false) {
  const { url: latestUrl, filename } = await findLatestFileUrl();
  const meta = loadMeta();

  if (!force && meta.source_file === filename && fs.existsSync(INDEX_JSONL)) {
    return { status: "up_to_date", source_file: filename, row_count: meta.row_count };
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmpPath = path.join(os.tmpdir(), `lca_${Date.now()}.xlsx`);

  try {
    const resp = await fetch(latestUrl);
    if (!resp.ok) throw new Error(`Failed to download LCA file: ${resp.status}`);
    await pipeline(Readable.fromWeb(resp.body), fs.createWriteStream(tmpPath));

    const rowCount = await reindex(tmpPath);
    const newMeta = { source_url: latestUrl, source_file: filename, row_count: rowCount };
    saveMeta(newMeta);
    return { status: "refreshed", ...newMeta };
  } finally {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
}

// The DOL file is large enough (130MB+) to break libraries that decode a whole
// sheet into one JS string (V8 caps string length below that). So this reads
// the xlsx's zip entries and XML directly, streaming throughout: yauzl streams
// zip entries without unpacking to disk, sax streams XML without ever holding
// a full document string. Only sharedStrings.xml's *resolved* string list is
// held in memory (an array of many small strings, not one giant string).

function colLettersToIndex(cellRef) {
  const letters = cellRef.match(/^[A-Z]+/)[0];
  let idx = 0;
  for (const ch of letters) idx = idx * 26 + (ch.charCodeAt(0) - 64);
  return idx - 1; // 0-based
}

async function findEntries(zipfile, wantedNames) {
  const found = {};
  for await (const entry of zipfile.eachEntry()) {
    if (wantedNames.includes(entry.fileName)) found[entry.fileName] = entry;
  }
  return found;
}

async function loadSharedStrings(zipfile, entry) {
  const strings = [];
  let inSi = false;
  let buf = "";

  const stream = await zipfile.openReadStreamPromise(entry);
  const parser = sax.createStream(true, { trim: false });

  parser.on("opentag", (node) => {
    if (node.name === "si") {
      inSi = true;
      buf = "";
    }
  });
  parser.on("text", (t) => {
    if (inSi) buf += t;
  });
  parser.on("closetag", (name) => {
    if (name === "si") {
      strings.push(buf);
      inSi = false;
    }
  });

  await new Promise((resolve, reject) => {
    parser.on("end", resolve);
    parser.on("error", reject);
    stream.pipe(parser);
  });

  return strings;
}

async function streamSheetRows(zipfile, entry, sharedStrings, onRow) {
  const stream = await zipfile.openReadStreamPromise(entry);
  const parser = sax.createStream(true, { trim: false });

  let currentRow = null;
  let cellRef = null;
  let cellType = null;
  let capturing = false;
  let inInlineStr = false;
  let valueText = "";

  function flushCell() {
    if (!currentRow || cellRef === null) return;
    const idx = colLettersToIndex(cellRef);
    let value;
    if (cellType === "s") {
      value = sharedStrings[parseInt(valueText, 10)] ?? null;
    } else if (cellType === "inlineStr" || cellType === "str") {
      value = valueText === "" ? null : valueText;
    } else if (cellType === "b") {
      value = valueText === "1";
    } else if (valueText === "") {
      value = null;
    } else {
      // ponytail: numeric-formatted dates stay as raw serial numbers here.
      // Not surfaced anywhere downstream today, add real date decoding if that changes.
      value = Number(valueText);
    }
    currentRow[idx] = value;
  }

  parser.on("opentag", (node) => {
    if (node.name === "row") currentRow = [];
    else if (node.name === "c") {
      cellRef = node.attributes.r;
      cellType = node.attributes.t || null;
    } else if (node.name === "v") {
      capturing = true;
      valueText = "";
    } else if (node.name === "is") {
      inInlineStr = true;
    } else if (node.name === "t" && inInlineStr) {
      capturing = true;
      valueText = "";
    }
  });
  parser.on("text", (t) => {
    if (capturing) valueText += t;
  });
  parser.on("closetag", (name) => {
    if (name === "v") capturing = false;
    else if (name === "t" && inInlineStr) capturing = false;
    else if (name === "is") inInlineStr = false;
    else if (name === "c") {
      flushCell();
      cellRef = null;
      cellType = null;
      valueText = "";
    } else if (name === "row") {
      if (currentRow) onRow(currentRow);
      currentRow = null;
    }
  });

  await new Promise((resolve, reject) => {
    parser.on("end", resolve);
    parser.on("error", reject);
    stream.pipe(parser);
  });
}

async function reindex(xlsxPath) {
  const zipfile = await yauzl.openPromise(xlsxPath, { lazyEntries: true, autoClose: false });
  const entries = await findEntries(zipfile, ["xl/sharedStrings.xml", "xl/worksheets/sheet1.xml"]);
  if (!entries["xl/worksheets/sheet1.xml"]) {
    throw new Error("Could not find xl/worksheets/sheet1.xml in the downloaded xlsx.");
  }

  const sharedStrings = entries["xl/sharedStrings.xml"]
    ? await loadSharedStrings(zipfile, entries["xl/sharedStrings.xml"])
    : [];

  const out = fs.createWriteStream(INDEX_JSONL);
  let colIdx = null;
  let rowCount = 0;

  await streamSheetRows(zipfile, entries["xl/worksheets/sheet1.xml"], sharedStrings, (values) => {
    if (colIdx === null) {
      colIdx = {};
      values.forEach((name, i) => {
        colIdx[name] = i;
      });
      const missing = REQUIRED_COLUMNS.filter((c) => !(c in colIdx));
      if (missing.length) {
        throw new Error(`Unexpected LCA file schema, missing columns: ${missing.join(", ")}`);
      }
      return;
    }

    const status = String(values[colIdx.CASE_STATUS] || "").trim().toUpperCase();
    if (!KEEP_STATUSES.has(status)) return;

    const record = {
      employer_name: values[colIdx.EMPLOYER_NAME] ?? null,
      job_title: values[colIdx.JOB_TITLE] ?? null,
      soc_title: values[colIdx.SOC_TITLE] ?? null,
      worksite_city: values[colIdx.WORKSITE_CITY] ?? null,
      worksite_state: values[colIdx.WORKSITE_STATE] ?? null,
      visa_class: values[colIdx.VISA_CLASS] ?? null,
      case_status: status,
      full_time_position: values[colIdx.FULL_TIME_POSITION] ?? null,
      begin_date: values[colIdx.BEGIN_DATE] ?? null,
    };
    out.write(JSON.stringify(record) + "\n");
    rowCount++;
  });

  zipfile.close();

  await new Promise((resolve, reject) => {
    out.end((err) => (err ? reject(err) : resolve()));
  });

  return rowCount;
}

export async function searchH1bSponsors(employer, jobTitleKeyword, state, limit = 50) {
  if (!fs.existsSync(INDEX_JSONL)) {
    throw new Error("No local H1B index found. Call refresh_h1b_data() first.");
  }

  const employerQ = employer ? employer.trim().toLowerCase() : null;
  const jobQ = jobTitleKeyword ? jobTitleKeyword.trim().toLowerCase() : null;
  const stateQ = state ? state.trim().toUpperCase() : null;

  const aggregated = new Map();

  const rl = readline.createInterface({
    input: fs.createReadStream(INDEX_JSONL),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line) continue;
    const row = JSON.parse(line);
    const name = (row.employer_name || "").trim();
    if (!name) continue;
    if (employerQ && !name.toLowerCase().includes(employerQ)) continue;
    if (
      jobQ &&
      !(row.job_title || "").toLowerCase().includes(jobQ) &&
      !(row.soc_title || "").toLowerCase().includes(jobQ)
    ) {
      continue;
    }
    if (stateQ && (row.worksite_state || "").trim().toUpperCase() !== stateQ) continue;

    const key = name.toUpperCase();
    if (!aggregated.has(key)) {
      aggregated.set(key, { employer: name, count: 0, job_titles: new Set(), worksite_states: new Set() });
    }
    const entry = aggregated.get(key);
    entry.count++;
    if (row.job_title) entry.job_titles.add(row.job_title);
    if (row.worksite_state) entry.worksite_states.add(row.worksite_state);
  }

  const results = [...aggregated.values()].sort((a, b) => b.count - a.count).slice(0, limit);
  for (const r of results) {
    r.job_titles = [...r.job_titles].sort().slice(0, 10);
    r.worksite_states = [...r.worksite_states].sort();
  }
  return results;
}
