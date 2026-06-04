import json
import time
import requests
from pathlib import Path

STEAM_URL = "https://store.steampowered.com/api/featuredcategories"

PARAMS = {
    "cc": "cn",
    "l": "schinese"
}

OUTPUT_PATH = Path("data/deals.json")


def get_price_text(value):
    if value is None:
        return "未知"

    return f"¥{value / 100:.2f}"


def fetch_steam_deals():
    response = requests.get(
        STEAM_URL,
        params=PARAMS,
        timeout=20,
        headers={
            "User-Agent": "Mozilla/5.0 Steam Deals Tracker"
        }
    )

    response.raise_for_status()
    data = response.json()

    specials = data.get("specials", {})
    items = specials.get("items", [])

    deals = []

    for item in items:
        discount = item.get("discount_percent", 0)

        if discount <= 0:
            continue

        appid = item.get("id")
        name = item.get("name", "Unknown Game")

        original_price = item.get("original_price")
        final_price = item.get("final_price")

        deal = {
            "appid": appid,
            "name": name,
            "discount": discount,
            "original_price": get_price_text(original_price),
            "final_price": get_price_text(final_price),
            "url": f"https://store.steampowered.com/app/{appid}"
        }

        deals.append(deal)

    deals.sort(key=lambda x: x["discount"], reverse=True)

    return deals


def main():
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    deals = fetch_steam_deals()

    result = {
        "updated_at": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
        "count": len(deals),
        "deals": deals
    }

    with OUTPUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"Saved {len(deals)} deals to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()