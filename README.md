# Clean Search - 搜索结果垃圾过滤浏览器扩展

> 自动过滤搜索结果中的垃圾站、SEO农场、AI水文。基于 176K+ 域名黑名单。

## ✨ 功能

- 🔍 **自动过滤** — 百度/Google/Bing/DuckDuckGo 搜索结果自动过滤垃圾站
- 📊 **176K+ 黑名单** — 基于社区维护的域名黑名单，定期更新
- 🤖 **白名单保护** — 正规AI站（ChatGPT、Claude等）不会被误杀
- 🚫 **广告隐藏** — 顺带隐藏搜索引擎的广告/推广结果
- 🔄 **自动更新** — 每周自动从GitHub订阅源更新黑名单
- 💡 **一键开关** — 随时启用/禁用过滤

## 📦 安装

### Chrome
1. 下载本仓库代码
2. 打开 `chrome://extensions`
3. 开启"开发者模式"
4. 点"加载已解压的扩展程序"
5. 选择下载的文件夹

### Firefox
1. 打开 `about:debugging#/runtime/this-firefox`
2. 点"临时载入附加组件"
3. 选择 `manifest.json`

## 📁 文件说明

| 文件 | 说明 |
|------|------|
| `manifest.json` | 扩展配置 |
| `background.js` | 后台服务（黑名单/白名单管理） |
| `content.js` | 内容脚本（过滤搜索结果） |
| `popup.html/js` | 弹窗界面 |
| `blacklist.txt` | 黑名单（176K+域名） |
| `whitelist.txt` | 白名单（正规AI站） |

## 🔧 黑名单来源

- [eallion/uBlacklist-subscription-compilation](https://github.com/eallion/uBlacklist-subscription-compilation)
- [cobaltdisco/Google-Chinese-Results-Blocklist](https://github.com/cobaltdisco/Google-Chinese-Results-Blocklist)
- [StevenBlack/hosts](https://github.com/StevenBlack/hosts)
- 更多订阅源见 `background.js`

## 🛡️ 白名单

正规AI站已加入白名单，不会被过滤：
- ChatGPT (chatgpt.com)
- Claude (claude.ai)
- Copilot (copilot.microsoft.com)
- DeepSeek (deepseek.com)
- 更多见 `whitelist.txt`

## 📝 自定义

### 添加黑名单
编辑 `blacklist.txt`，每行一个域名。

### 添加白名单
编辑 `whitelist.txt`，每行一个域名。

### 更新黑名单
1. 点扩展图标
2. 点"更新黑名单"按钮
3. 等待自动下载完成

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 License

MIT License
