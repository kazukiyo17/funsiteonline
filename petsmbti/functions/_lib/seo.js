/**
 * Build per-type SEO metadata and apply it to static HTML via HTMLRewriter.
 * 数据源：同源 /data/pets-mbti.json（EdgeOne 边缘 HTTP 缓存 1h）。
 */

const ORIGIN = "https://petsmbti.funsite.online";
let _dataCache = null;

async function loadData(request) {
  if (_dataCache) return _dataCache;
  const u = new URL("/data/pets-mbti.json", request.url);
  const r = await fetch(u.toString(), { cf: { cacheTtl: 3600 } });
  if (!r.ok) return null;
  _dataCache = await r.json();
  return _dataCache;
}

function truncate(s, n) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export async function buildMeta({ request, pet, type, page }) {
  const data = await loadData(request);
  if (!data) return null;

  const petEntry = data.questions?.[pet];
  const title = data.results?.titles?.[pet]?.[type];
  const blurb = data.results?.blurbs?.[pet]?.[type];
  if (!petEntry || !title || !blurb) return null;

  const petLabel = petEntry.petLabel;
  const emoji = petEntry.emoji || "";
  const canonical = `${ORIGIN}/${page}.html?pet=${pet}&type=${type}`;
  const ogImage = `${ORIGIN}/og/${pet}/${type}.svg`;

  const pageLabel = page === "share" ? "分享卡片" : "测试结果";
  const pageTitle = `${type} ${petLabel} · ${title} — 萌宠 MBTI ${pageLabel}`;
  const description = truncate(blurb, 150);

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: `${type} ${petLabel} · ${title}`,
        description,
        inLanguage: "zh-CN",
        url: canonical,
        image: ogImage,
        author: { "@type": "Organization", name: "funsite.online" },
        publisher: { "@type": "Organization", name: "funsite.online" },
        isPartOf: { "@id": `${ORIGIN}/#website` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "首页", item: `${ORIGIN}/` },
          {
            "@type": "ListItem",
            position: 2,
            name: `${petLabel} MBTI`,
            item: `${ORIGIN}/quiz.html?pet=${pet}`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: `${type} · ${title}`,
            item: canonical,
          },
        ],
      },
    ],
  });

  return {
    pageTitle,
    description,
    canonical,
    ogImage,
    ogTitle: `${emoji} ${type} ${petLabel} · ${title}`,
    jsonLd,
  };
}

export function rewriteHead(res, meta) {
  // HTMLRewriter 是 EdgeOne Pages Functions 的全局 API（兼容 Cloudflare）。
  return new HTMLRewriter()
    .on("title", {
      element(e) {
        e.setInnerContent(meta.pageTitle);
      },
    })
    .on('meta[name="description"]', {
      element(e) {
        e.setAttribute("content", meta.description);
      },
    })
    .on('meta[name="twitter:title"]', {
      element(e) {
        e.setAttribute("content", meta.ogTitle);
      },
    })
    .on('meta[name="twitter:description"]', {
      element(e) {
        e.setAttribute("content", meta.description);
      },
    })
    .on('meta[name="twitter:image"]', {
      element(e) {
        e.setAttribute("content", meta.ogImage);
      },
    })
    .on('meta[property="og:title"]', {
      element(e) {
        e.setAttribute("content", meta.ogTitle);
      },
    })
    .on('meta[property="og:description"]', {
      element(e) {
        e.setAttribute("content", meta.description);
      },
    })
    .on('meta[property="og:url"]', {
      element(e) {
        e.setAttribute("content", meta.canonical);
      },
    })
    .on('meta[property="og:image"]', {
      element(e) {
        e.setAttribute("content", meta.ogImage);
      },
    })
    .on('link[rel="canonical"]', {
      element(e) {
        e.setAttribute("href", meta.canonical);
      },
    })
    .on("#ld-article", {
      element(e) {
        e.setInnerContent(meta.jsonLd, { html: false });
      },
    })
    .transform(res);
}
