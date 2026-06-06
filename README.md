# Steam Deals Tracker

Steam Deals Tracker 是一个用于查看 Steam 折扣游戏、搜索 Steam 游戏并管理云端收藏的静态网页项目。项目主体可以部署在 GitHub Pages，实时搜索和云端收藏通过 Cloudflare Worker 提供接口。

## 当前功能

- 折扣列表页：展示当前 Steam 打折游戏。
- Steam 搜索页：通过 Cloudflare Worker 搜索 Steam 游戏。
- 收藏页：使用同步码连接 Cloudflare KV，实现跨设备收藏同步。
- 游戏卡片展示封面、价格、折扣、类型、平台、开发商、发行商、评分、简介、热门评论和 Steam 链接。
- 支持按名称搜索、排序、分类筛选和分页。
- 收藏页支持“更新本页”，只刷新当前页最多 20 个收藏游戏，避免 Cloudflare Worker 免费额度下的 subrequests 超限。
- GitHub Actions 每 2 小时自动更新折扣数据。

## 页面说明

| 页面 | 文件 | 说明 |
| --- | --- | --- |
| 折扣列表 | `index.html` | 读取 `data/deals.json`，展示当前折扣游戏 |
| Steam 搜索 | `search.html` | 调用 Cloudflare Worker `/api/search` 搜索 Steam 游戏，并支持加入收藏 |
| 收藏 | `favorites.html` | 通过同步码读取/保存云端收藏，支持更新当前页游戏信息 |

## 项目结构

```text
steam_deals_tracker/
|-- .github/
|   `-- workflows/
|       `-- update-deals.yml       # GitHub Actions 定时更新折扣数据
|-- data/
|   `-- deals.json                 # 折扣游戏数据
|-- scripts/
|   `-- fetch_deals.py             # Steam 折扣抓取脚本
|-- index.html                     # 折扣列表页
|-- search.html                    # Steam 搜索页
|-- favorites.html                 # 收藏页
|-- worker.js                      # Cloudflare Worker 源码
`-- README.md
```

## 本地预览

不要直接双击打开 HTML 文件。项目页面会通过 `fetch` 读取本地 JSON，建议启动静态服务器。

```bash
python -m http.server 8000
```

然后打开：

```text
http://localhost:8000
```

常用入口：

```text
http://localhost:8000/index.html
http://localhost:8000/search.html
http://localhost:8000/favorites.html
```

## 折扣数据更新

脚本位于：

```text
scripts/fetch_deals.py
```

依赖：

```bash
pip install requests
```

手动更新：

```bash
python scripts/fetch_deals.py
```

脚本会：

- 从 Steam 搜索结果中提取当前特惠游戏 `appid`。
- 请求 Steam `appdetails` 获取游戏详情。
- 请求 Steam `appreviews` 获取热门评论。
- 尝试从 Steam 商店页解析折扣截止日期文本。
- 生成 `data/deals.json`。

脚本当前主要配置：

```python
CC = "cn"
LANG = "schinese"
MAX_APPS = 200
PAGE_SIZE = 50
REQUEST_DELAY = 0.10
TOP_REVIEW_LIMIT = 200
```

## GitHub Actions

工作流文件：

```text
.github/workflows/update-deals.yml
```

当前定时规则：

```text
17 */2 * * *
```

即每 2 小时执行一次，也可以在 GitHub Actions 页面手动触发。

仓库需要允许 Actions 写入：

```text
Settings -> Actions -> General -> Workflow permissions -> Read and write permissions
```

## GitHub Pages 部署

这是纯静态页面，适合部署到 GitHub Pages。

推荐设置：

```text
Settings -> Pages
Source: Deploy from a branch
Branch: main
Folder: /root
```

部署后页面地址通常类似：

```text
https://<username>.github.io/steam_deals_tracker/
```

## Cloudflare Worker

`worker.js` 提供三个接口。

| 接口 | 方法 | 用途 |
| --- | --- | --- |
| `/api/search?q=F1&page=1` | GET | 搜索 Steam 游戏 |
| `/api/apps?ids=730,945360` | GET | 按 appid 刷新一批游戏详情和评论 |
| `/api/favorites?key=sync-code` | GET / POST | 读取或保存云端收藏 |

当前 Worker 默认配置：

```js
const DEFAULT_CC = 'cn';
const DEFAULT_LANG = 'schinese';
const PAGE_SIZE = 20;
const MAX_PAGE = 10;
```

搜索接口一次最多返回 20 个游戏。刷新收藏本页时也最多刷新 20 个游戏。

## Cloudflare KV 设置

收藏同步依赖 Cloudflare KV。

需要创建一个 KV namespace，例如：

```text
steam_favorites
```

然后给 Worker 添加 KV binding：

```text
Variable name: FAVORITES_KV
KV namespace: steam_favorites
```

`Variable name` 必须是 `FAVORITES_KV`，因为 Worker 代码中使用：

```js
env.FAVORITES_KV
```

设置完成后，把 `worker.js` 内容复制到 Cloudflare Worker 编辑器并部署。

## 前端连接 Worker

`search.html` 和 `favorites.html` 中目前使用的 Worker 地址是：

```js
https://steam.nin508404.workers.dev
```

如果你换了 Worker 域名，需要修改：

```js
const SEARCH_ENDPOINT = 'https://你的-worker.workers.dev/api/search';
const CLOUD_FAVORITES_ENDPOINT = 'https://你的-worker.workers.dev/api/favorites';
const REFRESH_ENDPOINT = 'https://你的-worker.workers.dev/api/apps';
```

## 收藏同步码

收藏页使用同步码连接云端收藏。

同步码格式：

```text
8 到 64 位
允许字母、数字、下划线和短横线
```

例如：

```text
savejeff
my-steam-list
steam_favorites_2026
```

使用方式：

1. 在 `favorites.html` 输入同步码。
2. 点击“连接同步码”。
3. 页面会从 Cloudflare KV 读取该同步码对应的收藏。
4. 如果同步码为空，收藏页会重置为空白收藏页。
5. 如果输入新的同步码，页面会切换到新同步码对应的云端收藏；云端没有数据时显示空收藏。
6. 点击“保存到云端”可将当前收藏保存到该同步码下。

注意：同步码相当于收藏夹钥匙。知道同步码的人可以读取和修改这份收藏。

## 本地存储说明

项目仍会使用浏览器 `localStorage` 保存少量状态：

| key | 页面 | 说明 |
| --- | --- | --- |
| `steamFavoritesSyncKey` | `favorites.html`, `search.html` | 当前设备记住的收藏同步码 |
| `steamDealFavorites` | `search.html`, `favorites.html` | 当前同步码对应收藏的本地快照 |

当前收藏页逻辑是：没有同步码时不展示旧本地收藏；连接同步码后才展示该同步码对应的收藏。

## Cloudflare 免费额度注意点

Worker 每次请求 Steam 都会产生 subrequests。

当前设计：

```text
搜索一页：
1 次 Steam 搜索
+ 最多 20 次 appdetails
+ 最多 20 次 appreviews
= 最多约 41 个 subrequests

更新收藏当前页：
最多 20 次 appdetails
+ 最多 20 次 appreviews
= 最多约 40 个 subrequests
```

这样设计是为了留在 Cloudflare Workers Free 单次 50 subrequests 限制以内。

不要把 Worker 的 `PAGE_SIZE` 直接改成 50，否则搜索和更新本页很容易超出单次 subrequests 限制。

## 数据格式

`data/deals.json` 顶层结构：

```json
{
  "updated_at": "2026-06-06 00:00:00 UTC",
  "count": 199,
  "source": "Steam Store specials search",
  "deals": []
}
```

单个游戏对象常用字段：

| 字段 | 说明 |
| --- | --- |
| `appid` | Steam 应用 ID |
| `name` | 游戏名称 |
| `discount` | 折扣百分比 |
| `original_price` | 原价文本 |
| `final_price` | 现价文本 |
| `final_price_num` | 现价数值，用于排序 |
| `discount_expiration` | Steam 返回的折扣截止时间戳，可能为空 |
| `discount_expires_at` | 折扣截止时间 UTC 文本，可能为空 |
| `discount_deadline_text` | 从 Steam 商店页解析出的截止文本 |
| `description` | 简介 |
| `popularity` | 推荐/评论数量，用于估算热度 |
| `image_url` | 游戏头图 |
| `genres` | 游戏类型 |
| `categories` | 游戏特性 |
| `metacritic_score` | Metacritic 评分 |
| `release_date` | 发行日期 |
| `developers` | 开发商 |
| `publishers` | 发行商 |
| `platforms` | 支持平台 |
| `url` | Steam 页面 |
| `top_review` | 热门评论 |

## 常见问题

### 搜索页搜索失败

检查：

- `search.html` 里的 Worker 地址是否正确。
- Cloudflare Worker 是否已经部署新版 `worker.js`。
- Worker 是否能访问 Steam。
- 浏览器控制台是否有 CORS 或 500 错误。

### 收藏页云同步失败

检查：

- Worker 是否绑定了 KV。
- KV binding name 是否是 `FAVORITES_KV`。
- 同步码是否符合 8-64 位规则。
- Worker 是否部署了包含 `/api/favorites` 的新版 `worker.js`。

### 收藏换设备后为空

需要在新设备输入同一个同步码并点击“连接同步码”。如果该同步码在云端没有保存过收藏，页面会显示为空。

### 中文在 PowerShell 里显示乱码

文件本身使用 UTF-8。Windows PowerShell 显示乱码时，可以尝试：

```powershell
chcp 65001
```

或者使用 VS Code 查看文件。

## 数据来源与限制

- 数据来自 Steam 商店公开页面和接口。
- Steam 返回内容可能随时间变化，页面解析逻辑可能需要维护。
- 不同地区、语言和年龄限制会影响可见游戏、价格和评论。
- 项目不隶属于 Valve 或 Steam。

## 许可证

当前仓库尚未包含明确的开源许可证文件。如需公开分发或允许他人复用，建议补充 `LICENSE` 文件。
