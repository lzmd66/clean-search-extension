/**
 * Clean Search - Background Service Worker
 * 负责：黑名单/白名单加载、更新、存储
 */

// ---- 黑名单订阅源 ----
const SUBSCRIPTIONS = [
  "https://raw.githubusercontent.com/eallion/uBlacklist-subscription-compilation/main/uBlacklist.txt",
  "https://raw.githubusercontent.com/cobaltdisco/Google-Chinese-Results-Blocklist/master/uBlacklist_subscription.txt",
  "https://raw.githubusercontent.com/popcar2/BadWebsiteBlocklist/main/uBlacklist.txt",
  "https://raw.githubusercontent.com/laylavish/uBlockOrigin-HUGE-AI-Blocklist/main/list_uBlacklist.txt",
  "https://raw.githubusercontent.com/fmhy/FMHYFilterlist/main/filterlist-wildcard-urls.txt",
  "https://raw.githubusercontent.com/PRiMENON/uBlacklist/main/uBlacklist.txt",
  "https://raw.githubusercontent.com/nicoleahmed/nicoles-ublacklist/main/combined_list.txt",
  "https://raw.githubusercontent.com/arosh/ublacklist-stackoverflow-translation/master/uBlacklist.txt",
  "https://raw.githubusercontent.com/ngoomie/uBlacklist-suspicious-downloads/main/list.txt",
  "https://raw.githubusercontent.com/agsimmons/ai-content-blocklist/refs/heads/main/uBlacklist.txt",
  "https://raw.githubusercontent.com/iorate/ublacklist-example-subscription/master/uBlacklist.txt",
  "https://raw.githubusercontent.com/rjaus/ublacklist-pinterest/main/ublacklist-pinterest.txt",
  "https://raw.githubusercontent.com/rjaus/ublacklist-yelp/main/ublacklist-yelp.txt",
  "https://pgl.yoyo.org/as/serverlist.php?hostformat=plain&mimetype=plaintext&prepend=*://*.&append=/*&showintro=0",
  "https://raw.githubusercontent.com/quenhus/uBlock-Origin-dev-filter/main/dist/other_format/uBlacklist/all.txt",
  "https://raw.githubusercontent.com/wdmpa/content-farm-list/main/uBlacklist.txt",
  "https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/fakenews-gambling-porn/hosts",
  "https://raw.githubusercontent.com/DandelionSprout/adfilt/master/Alternate%20versions%20Anti-Malware%20List/AntiMalwareHosts.txt",
  "https://raw.githubusercontent.com/jdlingyu/ad-wars/master/hosts",
  "https://raw.githubusercontent.com/vokins/yhosts/master/hosts",
];

// 内置静态黑名单
const STATIC_BLACKLIST = [
  "csdn.net", "blog.csdn.net",
  "baijiahao.baidu.com", "zhidao.baidu.com",
  "360doc.com", "sohu.com", "toutiao.com",
  "jianshu.com", "ithome.com", "163.com", "qq.com",
  "51cto.com", "oschina.net", "cnblogs.com",
  "segmentfault.com", "tuicool.com", "aibase.com",
  "answers.microsoft.com", "quora.com", "medium.com",
  "dev.to", "geeksforgeeks.org", "tutorialspoint.com",
  "w3schools.com", "javatpoint.com", "programiz.com",
  "stackshare.io",
];

// ---- 域名解析 ----
const RULE_RE = /^\*:\/\/(?:\*\.)?([a-z0-9.-]+)\//i;
const UBLOCK_RE = /^\|\|([a-z0-9.-]+)\^/i;
const HOSTS_RE = /^(?:0\.0\.0\.0|127\.0\.0\.1)\s+([a-z0-9.-]+)/i;
const DOMAIN_RE = /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i;

function cleanDomain(d) {
  d = d.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "").replace(/^www\./, "");
  d = d.split("/")[0].split(":")[0];
  return d.replace(/^\.+|\.+$/g, "");
}

function parseSubscription(text) {
  const domains = new Set();
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("!") || line.startsWith("@")) continue;
    let m = RULE_RE.exec(line) || UBLOCK_RE.exec(line) || HOSTS_RE.exec(line);
    if (m) {
      const d = cleanDomain(m[1]);
      if (DOMAIN_RE.test(d)) domains.add(d);
    } else {
      const d = cleanDomain(line);
      if (DOMAIN_RE.test(d)) domains.add(d);
    }
  }
  return domains;
}

// ---- 存储操作 ----
async function getBlacklist() {
  const data = await chrome.storage.local.get(["domains", "lastUpdate", "enabled", "filterCount"]);
  return {
    domains: new Set(data.domains || []),
    lastUpdate: data.lastUpdate || 0,
    enabled: data.enabled !== false,
    filterCount: data.filterCount || 0,
  };
}

async function getWhitelist() {
  const data = await chrome.storage.local.get(["whitelist"]);
  return new Set(data.whitelist || []);
}

async function saveBlacklist(domains) {
  const arr = Array.from(domains);
  await chrome.storage.local.set({
    domains: arr,
    lastUpdate: Date.now(),
    count: arr.length,
  });
}

async function saveWhitelist(domains) {
  const arr = Array.from(domains);
  await chrome.storage.local.set({ whitelist: arr });
}

// ---- 加载本地文件 ----
async function loadLocalBlacklist() {
  try {
    const url = chrome.runtime.getURL("blacklist.txt");
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const text = await resp.text();
    return text.split("\n")
      .map(line => line.trim().toLowerCase())
      .filter(line => line && !line.startsWith("#"));
  } catch (e) {
    return [];
  }
}

async function loadLocalWhitelist() {
  try {
    const url = chrome.runtime.getURL("whitelist.txt");
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const text = await resp.text();
    return text.split("\n")
      .map(line => line.trim())
      .filter(line => line && !line.startsWith("#"))
      // 剥掉路径/协议/www，只保留裸域名；否则带路径条目（如 huggingface.co/models）永远匹配不上
      .map(line => cleanDomain(line))
      .filter(d => DOMAIN_RE.test(d));
  } catch (e) {
    return [];
  }
}

// ---- 初始化 ----
async function initBlacklist() {
  const localDomains = await loadLocalBlacklist();
  const localWhitelist = await loadLocalWhitelist();

  if (localDomains.length > 0) {
    const merged = new Set([...localDomains, ...STATIC_BLACKLIST]);
    await saveBlacklist(merged);
  } else {
    await saveBlacklist(new Set(STATIC_BLACKLIST));
  }

  if (localWhitelist.length > 0) {
    await saveWhitelist(new Set(localWhitelist));
  }
}

// ---- 更新黑名单（从订阅源拉取）----
async function updateFromSubscriptions() {
  const domains = new Set(STATIC_BLACKLIST);
  let success = 0;

  const timeout = 15000;
  for (const url of SUBSCRIPTIONS) {
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(timeout) });
      if (!resp.ok) continue;
      const text = await resp.text();
      const parsed = parseSubscription(text);
      for (const d of parsed) domains.add(d);
      success++;
    } catch (e) {
      // 忽略失败的源
    }
  }

  if (domains.size > STATIC_BLACKLIST.length) {
    await saveBlacklist(domains);
  }

  // 同时更新白名单
  const localWhitelist = await loadLocalWhitelist();
  if (localWhitelist.length > 0) {
    const existing = await getWhitelist();
    const merged = new Set([...existing, ...localWhitelist]);
    await saveWhitelist(merged);
  }

  return domains.size;
}

// ---- 安装/启动时 ----
chrome.runtime.onInstalled.addListener(async (details) => {
  await initBlacklist();
});

chrome.runtime.onStartup.addListener(async () => {
  await initBlacklist();
});

// 每周自动更新一次
chrome.alarms.create("autoUpdate", { periodInMinutes: 7 * 24 * 60 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "autoUpdate") {
    await updateFromSubscriptions();
  }
});

// ---- 消息处理 ----
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "getBlacklist") {
    (async () => {
      const data = await getBlacklist();
      const whitelist = await getWhitelist();
      sendResponse({
        domains: Array.from(data.domains),
        whitelist: Array.from(whitelist),
        count: data.domains.size,
        whitelistCount: whitelist.size,
        lastUpdate: data.lastUpdate,
        enabled: data.enabled,
        filterCount: data.filterCount,
      });
    })();
    return true;
  }

  if (msg.action === "updateBlacklist") {
    updateFromSubscriptions().then(count => {
      sendResponse({ success: true, count });
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }

  if (msg.action === "addFilterCount") {
    chrome.storage.local.get(["filterCount"], (data) => {
      const newCount = (data.filterCount || 0) + msg.count;
      chrome.storage.local.set({ filterCount: newCount });
      chrome.action.setBadgeText({ text: newCount > 0 ? String(newCount) : "" });
      chrome.action.setBadgeBackgroundColor({ color: "#e74c3c" });
    });
    sendResponse({ ok: true });
    return true;
  }

  if (msg.action === "toggleEnabled") {
    getBlacklist().then(data => {
      const newState = !data.enabled;
      chrome.storage.local.set({ enabled: newState });
      sendResponse({ enabled: newState });
    });
    return true;
  }

  if (msg.action === "resetFilterCount") {
    chrome.storage.local.set({ filterCount: 0 });
    chrome.action.setBadgeText({ text: "" });
    sendResponse({ ok: true });
    return true;
  }
});
