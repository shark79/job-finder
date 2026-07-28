import writeExcelFile from "write-excel-file/node";
import { readSheet } from "read-excel-file/node";
import fs from "node:fs";

const OUTREACH_SHEET = "Outreach";
const ASSETS_SHEET = "Assets";

const OUTREACH_HEADERS = [
  "Company",
  "Code",
  "Job Board Link",
  "Platform",
  "Primary Contact Name",
  "Contact Email",
  "Contact Phone",
  "Resume File Link",
  "Date Drafted",
  "Status",
];

const ASSETS_HEADERS = [
  "Company",
  "Code",
  "Job Board Link",
  "Platform",
  "Primary Contact Name",
  "Contact Email",
  "Contact Phone",
  "Resume File Link",
  "Status",
];

async function readSheetRows(path, sheetName) {
  return readSheet(path, sheetName);
}

async function writeBothSheets(path, outreachRows, assetsRows) {
  await writeExcelFile([
    { data: outreachRows, sheet: OUTREACH_SHEET },
    { data: assetsRows, sheet: ASSETS_SHEET },
  ]).toFile(path);
}

export async function initTracker(path) {
  if (fs.existsSync(path)) return path;
  await writeBothSheets(path, [OUTREACH_HEADERS], [ASSETS_HEADERS]);
  return path;
}

function companyLetter(company) {
  const match = company.match(/[A-Za-z]/);
  return match ? match[0].toUpperCase() : "X";
}

export async function getOrCreateCompanyCode(company, trackerPath) {
  await initTracker(trackerPath);
  const rows = await readSheetRows(trackerPath, OUTREACH_SHEET);

  const existingCodes = [];
  for (const row of rows.slice(1)) {
    const [rowCompany, rowCode] = row;
    if (!rowCompany) continue;
    if (String(rowCompany).trim().toLowerCase() === company.trim().toLowerCase()) {
      return rowCode;
    }
    if (rowCode) existingCodes.push(rowCode);
  }

  const letter = companyLetter(company);
  let maxN = -1;
  const pattern = new RegExp(`^${letter}(\\d+)$`);
  for (const code of existingCodes) {
    const m = String(code).match(pattern);
    if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
  }

  return `${letter}${maxN + 1}`;
}

export async function appendOutreachRow(
  trackerPath,
  company,
  jobBoardLink,
  platform,
  contactName,
  contactEmail,
  contactPhone,
  resumeFileLink,
  status = "drafted"
) {
  await initTracker(trackerPath);
  const code = await getOrCreateCompanyCode(company, trackerPath);

  const outreachRows = await readSheetRows(trackerPath, OUTREACH_SHEET);
  const assetsRows = await readSheetRows(trackerPath, ASSETS_SHEET);
  const dateDrafted = new Date().toISOString().slice(0, 10);

  outreachRows.push([
    company,
    code,
    jobBoardLink,
    platform,
    contactName,
    contactEmail,
    contactPhone,
    resumeFileLink,
    dateDrafted,
    status,
  ]);
  await writeBothSheets(trackerPath, outreachRows, assetsRows);

  return {
    code,
    row: {
      Company: company,
      Code: code,
      "Job Board Link": jobBoardLink,
      Platform: platform,
      "Primary Contact Name": contactName,
      "Contact Email": contactEmail,
      "Contact Phone": contactPhone,
      "Resume File Link": resumeFileLink,
      "Date Drafted": dateDrafted,
      Status: status,
    },
  };
}

function findOutreachRowIndex(rows, code, jobBoardLink) {
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1] === code && rows[i][2] === jobBoardLink) return i;
  }
  return -1;
}

export async function updateOutreachStatus(trackerPath, code, jobBoardLink, status) {
  const outreachRows = await readSheetRows(trackerPath, OUTREACH_SHEET);
  const assetsRows = await readSheetRows(trackerPath, ASSETS_SHEET);

  const idx = findOutreachRowIndex(outreachRows, code, jobBoardLink);
  if (idx === -1) return false;

  outreachRows[idx][9] = status;
  await writeBothSheets(trackerPath, outreachRows, assetsRows);
  return true;
}

export async function markTurned(trackerPath, code, jobBoardLink) {
  const outreachRows = await readSheetRows(trackerPath, OUTREACH_SHEET);
  const assetsRows = await readSheetRows(trackerPath, ASSETS_SHEET);

  const idx = findOutreachRowIndex(outreachRows, code, jobBoardLink);
  if (idx === -1) {
    throw new Error(`No Outreach row found for code=${code}, job_board_link=${jobBoardLink}`);
  }

  outreachRows[idx][9] = "turned";
  const identity = outreachRows[idx].slice(0, 8);
  const newStatus = "interested to recruit";
  assetsRows.push([...identity, newStatus]);

  await writeBothSheets(trackerPath, outreachRows, assetsRows);

  const result = {};
  ASSETS_HEADERS.forEach((h, i) => {
    result[h] = [...identity, newStatus][i];
  });
  return result;
}
