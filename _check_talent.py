import base64
import hashlib
import json
import os
from pathlib import Path
import urllib.request

TOKEN = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
BASE = "https://api.github.com/repos/Luoluozi110/luoluo"


def api(path):
    headers = {
        "X-GitHub-Api-Version": "2022-11-28",
        "Accept": "application/vnd.github+json",
    }
    if TOKEN:
        headers["Authorization"] = "Bearer " + TOKEN
    req = urllib.request.Request(BASE + path, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            return json.load(response)
    except Exception as exc:
        return {"_error": str(exc)}


def content(path):
    data = api("/contents/" + path + "?ref=main")
    if isinstance(data, dict) and "content" in data:
        return data["content"]
    return None


def fetch_b64(path):
    encoded = content(path)
    return base64.b64decode(encoded).decode("utf-8", "replace") if encoded else None


local_path = Path(__file__).resolve().parent / "feihua-editors" / "assets" / "js" / "talent.js"
local_talent = local_path.read_bytes()
print("local talent.js bytes:", len(local_talent))
print("local talent.js sha256:", hashlib.sha256(local_talent).hexdigest()[:16])

live = fetch_b64("assets/js/talent.js")
if live:
    live_bytes = live.encode("utf-8")
    print("live talent.js bytes:", len(live_bytes))
    print("live sha256:", hashlib.sha256(live_bytes).hexdigest()[:16])
    print("live == local:", live_bytes == local_talent)
    for marker in ["renderUpgradePanel", "tal-upgrade-on", "renderLevelEffects", "renderStylePanel", "normalizeUpgrade"]:
        print(f"  live has {marker}:", live.count(marker))
else:
    print("live fetch failed or not under assets/js (可能是根目录旧编辑器)")
