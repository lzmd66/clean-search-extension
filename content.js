/**
 * Clean Search - Content Script
 * 在搜索结果页面过滤垃圾站（白名单优先）
 */

(function () {
  "use strict";

  // ---- 搜索引擎配置 ----
  const ENGINES = {
    google: {
      host: ["www.google.com", "www.google.com.hk", "www.google.co.jp", "www.google.co.uk"],
      resultSelector: "div.g, div.tF2Cxc, div[data-sokoban-container], div[data-hveid]",
      linkSelector: "a[href]",
      isResult: (el) => {
        const link = el.querySelector("a[href]");
        return link && link.href && !link.href.startsWith("javascript:");
      },
    },
    bing: {
      host: ["www.bing.com", "cn.bing.com"],
      resultSelector: "li.b_algo",
      linkSelector: "h2 a[href]",
      isResult: () => true,
    },
    baidu: {
      host: ["www.baidu.com"],
      resultSelector: "div.result, div.c-container, div[class*='result']",
      linkSelector: "h3 a[href], a[href]",
      isResult: (el) => el.querySelector("h3 a") || el.querySelector("a[href*='baidu.com']"),
    },
    duckduckgo: {
      host: ["duckduckgo.com", "html.duckduckgo.com"],
      resultSelector: "article[data-testid='result'], li[data-layout='organic'], div.result",
      linkSelector: "a[href][data-testid='result-title-a'], h2 a[href], a.result__a",
      isResult: () => true,
    },
  };

  // ---- 广告选择器 ----
  const AD_SELECTORS = [
    "div[data-text-ad]",
    "div.commercial-unit-desktop-top",
    "div[aria-label='Ads']",
    ".b_ad",
    "li.b_adBottom",
    "div.ec_tuiguang",
    "div[cmatchid]",
    "div[class*='ec-tuiguang']",
    "div[class*='adv']",
    "[data-testid='ad']",
    ".result--ad",
  ];

  let blacklistSet = null;
  let whitelistSet = null;
  let enabled = true;
  let filterCount = 0;

  // ---- 初始化 ----
  async function init() {
    try {
      // 直接读 storage，避免每次向 background 传输 17 万条域名（一次跨进程往返 + 两次数组/Set 转换）
      const data = await chrome.storage.local.get(["domains", "whitelist", "enabled"]);

      enabled = data.enabled !== false;
      if (!enabled) {
        return;
      }

      blacklistSet = new Set(data.domains || []);
      whitelistSet = new Set(data.whitelist || []);
      if (blacklistSet.size === 0) {
        return;
      }

      hideAds();
      filterResults();
      observeNewResults();
    } catch (e) {
      // 静默失败
    }
  }

  // ---- 域名提取 ----
  function extractDomain(url) {
    try {
      const u = new URL(url);
      let host = u.hostname.toLowerCase();
      if (host.startsWith("www.")) host = host.slice(4);
      return host;
    } catch {
      return "";
    }
  }

  // ---- 检查域名是否在白名单 ----
  function isWhitelisted(domain) {
    if (!domain || !whitelistSet) return false;
    const parts = domain.split(".");
    for (let i = 0; i < parts.length - 1; i++) {
      if (whitelistSet.has(parts.slice(i).join("."))) return true;
    }
    return false;
  }

  // ---- 检查域名是否在黑名单（白名单优先）----
  function isBlocked(domain) {
    if (!domain || !blacklistSet) return false;
    if (isWhitelisted(domain)) return false;
    const parts = domain.split(".");
    for (let i = 0; i < parts.length - 1; i++) {
      if (blacklistSet.has(parts.slice(i).join("."))) return true;
    }
    return false;
  }

  // ---- 隐藏广告 ----
  function hideAds() {
    let adCount = 0;
    for (const selector of AD_SELECTORS) {
      try {
        document.querySelectorAll(selector).forEach((el) => {
          if (el.style.display !== "none") {
            el.style.display = "none";
            adCount++;
          }
        });
      } catch (e) {}
    }
  }

  // ---- 过滤搜索结果 ----
  function filterResults() {
    const engine = detectEngine();
    if (!engine) return;

    const results = document.querySelectorAll(engine.resultSelector);
    let blocked = 0;

    results.forEach((el) => {
      if (el.dataset.csChecked) return; // 跳过已处理，避免 MutationObserver 抖动时重复判定
      if (!engine.isResult(el)) return;
      el.dataset.csChecked = "1";

      const link = el.querySelector(engine.linkSelector);
      if (!link || !link.href) return;

      const href = link.href;
      if (href.includes("/search?") || href.includes("google.com/") || href.includes("baidu.com/s")) return;

      const domain = extractDomain(href);
      if (isBlocked(domain)) {
        el.classList.add("clean-search-hidden");
        el.style.display = "none";
        blocked++;
      }
    });

    if (blocked > 0) {
      filterCount += blocked;
      injectStatsBar(blocked);
      try {
        chrome.runtime.sendMessage({ action: "addFilterCount", count: blocked });
      } catch (e) {}
    }
  }

  // ---- 注入统计栏 ----
  function injectStatsBar(count) {
    const existing = document.getElementById("clean-search-stats");
    if (existing) {
      const num = existing.querySelector(".cs-count");
      if (num) num.textContent = parseInt(num.textContent) + count;
      return;
    }

    const bar = document.createElement("div");
    bar.id = "clean-search-stats";
    bar.innerHTML = `
      <div style="
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 10px 16px;
        border-radius: 8px;
        margin: 8px auto;
        max-width: 600px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 13px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        box-shadow: 0 2px 8px rgba(102,126,234,0.3);
      ">
        <span>Clean Search: 已过滤 <strong class="cs-count">${count}</strong> 条垃圾结果</span>
        <button id="cs-show-filtered" style="
          background: rgba(255,255,255,0.2);
          border: 1px solid rgba(255,255,255,0.4);
          color: white;
          padding: 4px 10px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        ">显示被过滤的结果</button>
      </div>
    `;

    // 插入到搜索框下方
    const insertPoint =
      document.getElementById("search") ||
      document.getElementById("rso") ||
      document.getElementById("content_left") ||
      document.querySelector("main");

    if (insertPoint && insertPoint.parentNode) {
      insertPoint.parentNode.insertBefore(bar, insertPoint);
    }

    document.getElementById("cs-show-filtered").addEventListener("click", () => {
      const hidden = document.querySelectorAll(".clean-search-hidden");
      const btn = document.getElementById("cs-show-filtered");
      const isShowing = btn.textContent.includes("隐藏");

      hidden.forEach((el) => {
        el.style.display = isShowing ? "none" : "";
        if (!isShowing) {
          el.style.border = "2px dashed #e74c3c";
          el.style.borderRadius = "8px";
          el.style.padding = "8px";
          el.style.opacity = "0.7";
        } else {
          el.style.border = "";
          el.style.borderRadius = "";
          el.style.padding = "";
          el.style.opacity = "";
        }
      });

      btn.textContent = isShowing ? "显示被过滤的结果" : "隐藏被过滤的结果";
    });
  }

  // ---- 检测当前搜索引擎 ----
  function detectEngine() {
    const host = location.hostname;
    for (const [name, config] of Object.entries(ENGINES)) {
      if (config.host.includes(host)) return { name, ...config };
    }
    return null;
  }

  // ---- 监听动态加载的结果 ----
  function observeNewResults() {
    const engine = detectEngine();
    if (!engine) return;

    // 只监听结果容器，不是整个body
    const container = document.querySelector("#search, #rso, #b_content, #content_left, main") || document.body;

    let debounce = null;
    const observer = new MutationObserver(() => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        hideAds();
        filterResults();
      }, 500);
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
    });
  }

  // ---- 启动 ----
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
