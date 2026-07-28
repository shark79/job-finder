async function searchGreenhouse(token, keyword) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${token}/jobs`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Greenhouse request failed: ${resp.status}`);
  const data = await resp.json();
  const jobs = data.jobs || [];

  return jobs
    .filter((job) => !keyword || (job.title || "").toLowerCase().includes(keyword.toLowerCase()))
    .map((job) => ({
      title: job.title || "",
      location: (job.location || {}).name || "",
      url: job.absolute_url || "",
      id: job.id,
      updated_at: job.updated_at,
    }));
}

async function searchLever(slug, keyword) {
  const url = `https://api.lever.co/v0/postings/${slug}?mode=json`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Lever request failed: ${resp.status}`);
  const data = await resp.json();
  if (!Array.isArray(data)) {
    throw new Error(`Lever slug '${slug}' invalid: ${data.error || JSON.stringify(data)}`);
  }

  return data
    .filter((job) => !keyword || (job.text || "").toLowerCase().includes(keyword.toLowerCase()))
    .map((job) => ({
      title: job.text || "",
      location: (job.categories || {}).location || "",
      url: job.hostedUrl || "",
      id: job.id,
      updated_at: job.createdAt,
    }));
}

async function searchWorkday(tenant, host, site, keyword) {
  const url = `https://${tenant}.${host}.myworkdayjobs.com/wday/cxs/${tenant}/${site}/jobs`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ limit: 20, offset: 0, searchText: keyword || "" }),
  });
  if (!resp.ok) throw new Error(`Workday request failed: ${resp.status}`);
  const data = await resp.json();

  return (data.jobPostings || []).map((job) => {
    const bulletFields = job.bulletFields || [];
    return {
      title: job.title || "",
      location: job.locationsText || "",
      url: `https://${tenant}.${host}.myworkdayjobs.com/${site}${job.externalPath || ""}`,
      id: bulletFields.length ? bulletFields[bulletFields.length - 1] : null,
      updated_at: job.postedOn,
    };
  });
}

export async function searchCompanyJobBoard(
  company,
  platform,
  token,
  keyword,
  workdayHost = "wd1",
  workdaySite = "External"
) {
  const p = platform.toLowerCase();
  if (p === "greenhouse") return searchGreenhouse(token, keyword);
  if (p === "lever") return searchLever(token, keyword);
  if (p === "workday") return searchWorkday(token, workdayHost, workdaySite, keyword);
  throw new Error(`Unknown platform: ${platform}. Must be greenhouse, lever, or workday.`);
}
