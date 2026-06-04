import json
import re
import time
from html import unescape
from pathlib import Path

import requests

CC = "cn"
LANG = "schinese"

SEARCH_URL = "https://store.steampowered.com/search/results/"
DETAILS_URL = "https://store.steampowered.com/api/appdetails"
REVIEWS_URL = "https://store.steampowered.com/appreviews/{appid}"

OUTPUT_PATH = Path("data/deals.json")

MAX_APPS = 200
PAGE_SIZE = 50
REQUEST_DELAY = 0.10
TOP_REVIEW_LIMIT = 50

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 Steam Deals Tracker"
})


def request_json(url, params, retries=3):
    for attempt in range(retries):
        try:
            response = session.get(url, params=params, timeout=25)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Request failed: {url}, attempt={attempt + 1}, error={e}")
            time.sleep(1.5)

    return None


def extract_appids(results_html):
    appids = []

    # Steam search 页面里常见的 appid 存放方式
    appids += re.findall(r'data-ds-appid="(\d+)"', results_html)
    appids += re.findall(r'/app/(\d+)', results_html)

    unique = []
    seen = set()

    for appid in appids:
        if appid not in seen:
            seen.add(appid)
            unique.append(int(appid))

    return unique


def fetch_discount_appids():
    all_appids = []
    seen = set()
    start = 0
    total_count = None

    while True:
        params = {
            "query": "",
            "start": start,
            "count": PAGE_SIZE,
            "dynamic_data": "",
            "sort_by": "_ASC",
            "specials": 1,
            "category1": 998,
            "infinite": 1,
            "cc": CC,
            "l": LANG
        }

        data = request_json(SEARCH_URL, params)

        if not data:
            break

        if total_count is None:
            try:
                total_count = int(data.get("total_count", 0))
            except ValueError:
                total_count = 0

            print(f"Steam search total_count: {total_count}")

        results_html = data.get("results_html", "")
        page_appids = extract_appids(results_html)

        if not page_appids:
            break

        for appid in page_appids:
            if appid not in seen:
                seen.add(appid)
                all_appids.append(appid)

                if len(all_appids) >= MAX_APPS:
                    print(f"Reached MAX_APPS limit: {MAX_APPS}")
                    return all_appids

        print(f"Fetched appids: {len(all_appids)} / {total_count}")

        start += PAGE_SIZE

        if total_count and start >= total_count:
            break

        time.sleep(REQUEST_DELAY)

    return all_appids


def get_price_text(price_overview, key):
    value = price_overview.get(key)

    if value is None:
        return "未知"

    return f"¥{value / 100:.2f}"


def clean_text(text, max_len=450):
    if not text:
        return "暂无"

    text = unescape(text)
    text = re.sub(r"<[^>]+>", "", text)
    text = text.replace("\r", " ").replace("\n", " ")
    text = re.sub(r"\s+", " ", text).strip()

    if len(text) > max_len:
        text = text[:max_len] + "..."

    return text


def fetch_app_details(appid):
    params = {
        "appids": appid,
        "cc": CC,
        "l": LANG,
        "filters": "basic,price_overview,recommendations"
    }

    data = request_json(DETAILS_URL, params)

    if not data:
        return None

    app_data = data.get(str(appid), {})

    if not app_data.get("success"):
        return None

    details = app_data.get("data", {})
    price = details.get("price_overview")

    if not price:
        return None

    discount = price.get("discount_percent", 0)

    if discount <= 0:
        return None

    recommendations = details.get("recommendations", {})
    popularity = recommendations.get("total", 0)

    return {
        "appid": appid,
        "name": details.get("name", "Unknown Game"),
        "discount": discount,
        "original_price": price.get("initial_formatted") or get_price_text(price, "initial"),
        "final_price": price.get("final_formatted") or get_price_text(price, "final"),
        "final_price_num": price.get("final", 0) / 100,
        "description": clean_text(details.get("short_description", "")),
        "popularity": popularity,
        "url": f"https://store.steampowered.com/app/{appid}"
    }


def fetch_top_review(appid):
    base_params = {
        "json": 1,
        "filter": "all",
        "day_range": 365,
        "cursor": "*",
        "review_type": "all",
        "purchase_type": "all",
        "num_per_page": 1
    }

    for language in [LANG, "all"]:
        params = dict(base_params)
        params["language"] = language

        data = request_json(REVIEWS_URL.format(appid=appid), params)

        if not data:
            continue

        reviews = data.get("reviews", [])

        if not reviews:
            continue

        review = reviews[0]

        return {
            "text": clean_text(review.get("review", ""), max_len=350),
            "voted_up": review.get("voted_up", None),
            "votes_up": review.get("votes_up", 0),
            "weighted_vote_score": review.get("weighted_vote_score", "0")
        }

    return {
        "text": "暂无热门评论",
        "voted_up": None,
        "votes_up": 0,
        "weighted_vote_score": "0"
    }


def main():
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    appids = fetch_discount_appids()
    deals = []

    for index, appid in enumerate(appids, start=1):
        print(f"[{index}/{len(appids)}] Fetching details: {appid}")

        detail = fetch_app_details(appid)

        if not detail:
            continue

        detail["top_review"] = {
            "text": "暂未抓取热门评论",
            "voted_up": None,
            "votes_up": 0,
            "weighted_vote_score": "0"
        }

        deals.append(detail)

        time.sleep(REQUEST_DELAY)

    deals.sort(key=lambda x: x.get("popularity", 0), reverse=True)

    for index, deal in enumerate(deals[:TOP_REVIEW_LIMIT], start=1):
        print(f"[{index}/{TOP_REVIEW_LIMIT}] Fetching top review: {deal['appid']}")

        deal["top_review"] = fetch_top_review(deal["appid"])

        time.sleep(REQUEST_DELAY)

        

    deals.sort(key=lambda x: x.get("popularity", 0), reverse=True)

    result = {
        "updated_at": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
        "count": len(deals),
        "source": "Steam Store specials search",
        "deals": deals
    }

    with OUTPUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"Saved {len(deals)} deals to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()