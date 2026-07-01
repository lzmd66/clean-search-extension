const $ = (id) => document.getElementById(id);

function showStatus(text, type = "info") {
  const el = $("status");
  el.textContent = text;
  el.className = `status show ${type}`;
  setTimeout(() => el.className = "status", 4000);
}

function formatTime(ts) {
  if (!ts) return "从未更新";
  const d = new Date(ts);
  return `上次更新: ${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
}

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

async function loadStats() {
  try {
    const data = await chrome.runtime.sendMessage({ action: "getBlacklist" });
    if (!data) throw new Error("background 无响应");

    setText("blacklistCount", data.count?.toLocaleString() || "0");
    setText("whitelistCount", data.whitelistCount?.toLocaleString() || "0");
    setText("filterCount", data.filterCount?.toLocaleString() || "0");
    setText("updateTime", formatTime(data.lastUpdate));

    const toggle = $("toggleSwitch");
    if (toggle) toggle.classList.toggle("active", !!data.enabled);
  } catch (e) {
    setText("blacklistCount", "错误");
    showStatus(`读取状态失败: ${e.message}`, "error");
  }
}

// 切换开关
$("toggleSwitch").addEventListener("click", async () => {
  const data = await chrome.runtime.sendMessage({ action: "toggleEnabled" });
  const toggle = $("toggleSwitch");
  if (data.enabled) {
    toggle.classList.add("active");
    showStatus("已启用过滤", "success");
  } else {
    toggle.classList.remove("active");
    showStatus("已禁用过滤", "info");
  }
});

// 更新黑名单
$("btnUpdate").addEventListener("click", async () => {
  $("btnUpdate").disabled = true;
  $("btnUpdate").textContent = "更新中...";
  showStatus("正在从订阅源下载黑名单...", "info");

  try {
    const result = await chrome.runtime.sendMessage({ action: "updateBlacklist" });
    if (result.success) {
      showStatus(`更新完成！共 ${result.count?.toLocaleString()} 个域名`, "success");
    } else {
      showStatus(`更新失败: ${result.error}`, "error");
    }
  } catch (e) {
    showStatus(`更新失败: ${e.message}`, "error");
  } finally {
    $("btnUpdate").disabled = false;
    $("btnUpdate").textContent = "更新黑名单";
  }
});

// 重置计数
$("btnReset").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ action: "resetFilterCount" });
  $("filterCount").textContent = "0";
  showStatus("计数已重置", "info");
});

// 初始化
loadStats();
