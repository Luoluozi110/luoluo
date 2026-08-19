import base64
import json
import os
import re
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


root = api("/contents/?ref=main")
dirs = []
for item in root if isinstance(root, list) else []:
    if item["type"] == "dir":
        dirs.append(item["name"])
print("根目录子目录:", dirs)

# 尝试读取 index.html 看编辑器引用路径
data = api("/contents/index.html?ref=main")
if isinstance(data, dict) and "content" in data:
    index = base64.b64decode(data["content"]).decode("utf-8", "replace")
    print("index.html bytes:", len(index))
    for match in re.findall(r'<script src="([^"]+)"', index):
        print("  script:", match)
    print("index 含 talent.js ref:", "talent.js" in index)
    print("index 含 tal-upgrade-on:", "tal-upgrade-on" in index)
else:
    print("index.html read failed:", data.get("_error") or data)
