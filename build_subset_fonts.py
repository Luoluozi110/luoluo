import os, sys

GAME = r"C:/Users/77522/WorkBuddy/2026-08-01-00-57-25/feihuaqi-playable"
CHARFILE = r"C:/Users/77522/WorkBuddy/2026-08-01-00-57-25/nssc_chars.txt"
FONT_DIR = os.path.join(GAME, "fonts", "noto-serif-sc")
os.makedirs(FONT_DIR, exist_ok=True)

exts = {".html", ".css", ".js", ".json", ".mjs"}
chars = set()

# 1) 收集游戏静态文本里出现的所有字符
for root, dirs, files in os.walk(GAME):
    for f in files:
        ext = os.path.splitext(f)[1].lower()
        if ext not in exts:
            continue
        p = os.path.join(root, f)
        try:
            with open(p, "r", encoding="utf-8", errors="ignore") as fh:
                chars.update(fh.read())
        except Exception as e:
            print("skip", p, e)

# 2) GBK 全覆盖（约 2.1 万汉字，玩家名几乎不漏）
for hi in range(0x81, 0xFF):
    for lo in range(0x40, 0xFF):
        if lo == 0x7F:
            continue
        try:
            chars.add(bytes([hi, lo]).decode("gbk"))
        except Exception:
            pass

# 3) 基础 ASCII + CJK 标点 + 全角字符
for i in range(0x20, 0x7F):
    chars.add(chr(i))
for i in range(0x3000, 0x3040):
    chars.add(chr(i))
for i in range(0xFF00, 0xFFF0):
    chars.add(chr(i))

out = "".join(sorted(chars))
with open(CHARFILE, "w", encoding="utf-8") as fh:
    fh.write(out)
print("collected chars:", len(out))
print("->", CHARFILE)
