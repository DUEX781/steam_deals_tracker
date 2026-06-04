# Steam Deals Tracker

一个用于追踪 Steam 当前折扣游戏的静态网页项目。项目通过 Python 脚本抓取 Steam 商店特惠数据，生成 `data/deals.json`，前端页面读取这份 JSON 并展示游戏折扣、价格、热度、简介、平台、类型、评分和热门评论等信息。

项目适合部署到 GitHub Pages，也可以直接在本地用一个简单的静态文件服务器预览。

## 功能特性

- 展示 Steam 当前折扣游戏列表。
- 支持按游戏名称搜索。
- 支持按热度、名称、价格、折扣力度排序。
- 展示游戏封面、折扣、现价、原价、推荐评论数、简介、类型、特性、平台、发行日期、开发商、发行商和 Metacritic 评分。
- 抓取每个游戏的热门评论，并展示评论类型和有用票数。
- 内置一个简单的浏览器本地流量估算弹窗，用于观察本次页面加载的资源请求数量和估算传输量。
- 使用 GitHub Actions 每小时自动更新一次折扣数据。
- 纯静态前端，无需后端服务即可部署。

## 项目结构

```text
steam_deals_tracker/
|-- .github/
|   `-- workflows/
|       `-- update-deals.yml    # GitHub Actions 定时更新折扣数据
|-- data/
|   `-- deals.json              # 抓取生成的 Steam 折扣数据
|-- scripts/
|   `-- fetch_deals.py          # Steam 数据抓取脚本
|-- index.html                  # 前端页面
`-- README.md
```

## 运行环境

前端本身只需要浏览器。数据抓取脚本需要：

- Python 3.11 或更新版本
- `requests`

安装 Python 依赖：

```bash
pip install requests
```

如果你希望隔离环境，可以先创建虚拟环境：

```bash
python -m venv .venv
```

Windows PowerShell：

```powershell
.\.venv\Scripts\Activate.ps1
pip install requests
```

macOS / Linux：

```bash
source .venv/bin/activate
pip install requests
```

## 本地预览

由于前端使用 `fetch('./data/deals.json')` 加载数据，不建议直接双击打开 `index.html`。部分浏览器会因为本地文件访问限制导致 JSON 加载失败。

推荐在项目根目录启动一个本地静态服务器：

```bash
python -m http.server 8000
```

然后在浏览器打开：

```text
http://localhost:8000
```

## 手动更新折扣数据

在项目根目录运行：

```bash
python scripts/fetch_deals.py
```

脚本会：

1. 从 Steam 商店搜索接口获取当前特惠游戏的 `appid`。
2. 调用 Steam app details 接口获取价格、简介、类型、平台、发行日期、开发商、发行商等详情。
3. 调用 Steam app reviews 接口获取热门评论。
4. 按推荐评论数 `popularity` 从高到低排序。
5. 将结果写入 `data/deals.json`。

生成成功后，刷新本地页面即可看到最新数据。

## 自动更新

项目已经包含 GitHub Actions 工作流：

```text
.github/workflows/update-deals.yml
```

触发方式：

- 每小时自动执行一次：`0 * * * *`
- 支持在 GitHub Actions 页面手动触发：`workflow_dispatch`

工作流会执行以下步骤：

1. 检出仓库。
2. 设置 Python 3.11。
3. 安装 `requests`。
4. 运行 `python scripts/fetch_deals.py`。
5. 如果 `data/deals.json` 有变化，则提交并推送更新。

如果要让自动提交正常工作，仓库需要允许 GitHub Actions 写入内容。可以在 GitHub 仓库中检查：

```text
Settings -> Actions -> General -> Workflow permissions -> Read and write permissions
```

## 部署到 GitHub Pages

这是一个纯静态项目，适合直接部署到 GitHub Pages。

推荐设置：

```text
Settings -> Pages
Build and deployment -> Source: Deploy from a branch
Branch: main
Folder: /root
```

启用后，页面通常会发布到：

```text
https://<你的用户名>.github.io/steam_deals_tracker/
```

如果当前仓库名保持为 `steam_deals_tracker`，并且 GitHub 用户名为 `DUEX781`，地址通常是：

```text
https://duex781.github.io/steam_deals_tracker/
```

实际地址以 GitHub Pages 设置页面显示为准。

## 数据格式

`data/deals.json` 的顶层结构如下：

```json
{
  "updated_at": "2026-06-04 06:31:39 UTC",
  "count": 199,
  "source": "Steam Store specials search",
  "deals": []
}
```

字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `updated_at` | string | 数据更新时间，使用 UTC 时间 |
| `count` | number | 折扣游戏数量 |
| `source` | string | 数据来源说明 |
| `deals` | array | 折扣游戏列表 |

单个游戏对象示例：

```json
{
  "appid": 945360,
  "name": "Among Us",
  "discount": 40,
  "original_price": "¥ 25.00",
  "final_price": "¥ 15.00",
  "final_price_num": 15.0,
  "description": "游戏简介",
  "popularity": 643711,
  "image_url": "https://shared.akamai.steamstatic.com/...",
  "genres": ["休闲"],
  "categories": ["多人", "在线玩家对战"],
  "metacritic_score": 85,
  "release_date": "2018 年 11 月 16 日",
  "developers": [],
  "publishers": [],
  "platforms": {
    "windows": true,
    "mac": false,
    "linux": false
  },
  "url": "https://store.steampowered.com/app/945360",
  "top_review": {
    "text": "热门评论内容",
    "voted_up": true,
    "votes_up": 29,
    "weighted_vote_score": "0.777974486351013184"
  }
}
```

游戏字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `appid` | number | Steam 应用 ID |
| `name` | string | 游戏名称 |
| `discount` | number | 折扣百分比 |
| `original_price` | string | 原价文本 |
| `final_price` | string | 现价文本 |
| `final_price_num` | number | 现价数值，便于前端排序 |
| `description` | string | 游戏简介 |
| `popularity` | number | Steam 推荐评论总数，用于估算热度 |
| `image_url` | string | 游戏头图地址 |
| `genres` | array | 游戏类型 |
| `categories` | array | 游戏功能或特性分类 |
| `metacritic_score` | number/null | Metacritic 评分 |
| `release_date` | string | 发行日期 |
| `developers` | array | 开发商 |
| `publishers` | array | 发行商 |
| `platforms` | object | 支持平台 |
| `url` | string | Steam 商店页面 |
| `top_review` | object | 热门评论信息 |

## 抓取脚本配置

抓取脚本位于 `scripts/fetch_deals.py`。常用配置集中在文件顶部：

```python
CC = "cn"
LANG = "schinese"
MAX_APPS = 200
PAGE_SIZE = 50
REQUEST_DELAY = 0.10
TOP_REVIEW_LIMIT = 200
```

说明：

| 配置 | 说明 |
| --- | --- |
| `CC` | Steam 地区代码，当前为中国区 `cn` |
| `LANG` | Steam 语言，当前为简体中文 `schinese` |
| `MAX_APPS` | 最多抓取多少个折扣游戏 |
| `PAGE_SIZE` | Steam 搜索分页大小 |
| `REQUEST_DELAY` | 请求之间的等待时间，避免过于频繁访问 |
| `TOP_REVIEW_LIMIT` | 最多为多少个游戏抓取热门评论 |

如果需要切换地区或语言，可以修改 `CC` 和 `LANG`。例如美国区英文数据可以使用：

```python
CC = "us"
LANG = "english"
```

修改后重新运行：

```bash
python scripts/fetch_deals.py
```

## 前端说明

`index.html` 内部完成以下事情：

- 请求 `data/deals.json`。
- 将折扣游戏缓存到 `allDeals`。
- 根据搜索关键字和排序选项重新渲染列表。
- 使用 `escapeHTML` 对动态文本做 HTML 转义，降低注入风险。
- 使用 `performance.getEntriesByType('resource')` 估算当前页面资源请求量。
- 使用 `localStorage` 保存最近 20 次本地访问记录，并用 `canvas` 绘制简单折线图。

页面不依赖任何前端框架，也不需要构建步骤。

## 常见问题

### 页面提示读取 `data/deals.json` 失败

优先确认是否通过本地服务器访问页面，而不是直接打开本地 HTML 文件：

```bash
python -m http.server 8000
```

然后访问：

```text
http://localhost:8000
```

如果部署在 GitHub Pages，也要确认 `data/deals.json` 已经提交到仓库，并且访问路径没有被改动。

### GitHub Actions 没有自动提交

检查以下几点：

- 工作流是否有 `contents: write` 权限。
- 仓库 Actions 权限是否允许写入。
- `data/deals.json` 是否真的发生变化。如果没有变化，工作流会输出 `No changes to commit`。
- Steam 接口是否临时不可用或请求失败。

### 终端里看到中文乱码

如果在 Windows PowerShell 中查看文件时出现乱码，可以尝试切换终端编码：

```powershell
chcp 65001
```

也可以使用支持 UTF-8 的编辑器查看文件，例如 VS Code。

### 价格或游戏文本显示异常

价格、语言和地区来自 Steam 接口返回值。可以检查脚本中的：

```python
CC = "cn"
LANG = "schinese"
```

如果切换地区，价格币种和可见折扣内容都会跟着变化。

## 数据来源与限制

本项目的数据来自 Steam 商店公开接口和公开页面结果。需要注意：

- Steam 接口返回内容可能随时间变化。
- 不同地区、语言和年龄限制可能影响可见游戏和价格。
- 折扣数据以脚本运行时的结果为准，不保证实时。
- 热度字段使用 Steam 推荐评论总数估算，不等同于销量或在线人数。
- 本项目只做展示和追踪用途，不隶属于 Valve 或 Steam。

## 开发建议

如果继续扩展项目，可以考虑：

- 增加最低折扣、最高价格、平台、类型等筛选条件。
- 将脚本配置改为命令行参数。
- 增加缓存和失败重试策略，减少重复请求。
- 增加分页或虚拟列表，优化大量游戏时的页面性能。
- 将 CSS 和 JavaScript 从 `index.html` 中拆分到独立文件，便于维护。
- 修复或统一文件编码，确保中文在终端、浏览器和 JSON 中都稳定显示。

## 许可证

当前仓库尚未包含明确的开源许可证文件。若计划公开分发或允许他人复用，建议补充 `LICENSE` 文件，并在 README 中同步说明许可证类型。
