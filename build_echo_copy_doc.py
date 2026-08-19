import json
from pathlib import Path

root = Path(r"C:\Users\77522\WorkBuddy\2026-08-01-00-57-25")
data = json.loads((root / "feihuaqi-playable/config/events.json").read_text(encoding="utf-8"))
lines = [
    "# 《飞花棋》选择回声文案终稿",
    "",
    "> 范围：14 个 choice 奇遇，共 28 条选择回声。  ",
    "> 叙事规则：保持第二人称；先兑现玩家动作，再用场景中的物件、声音、光线或未说完的话留下余韵；不解释象征，不新增设定。",
    "",
    "---",
    "",
    "## 写作原则",
    "",
    "1. 回声必须紧接所选动作，不能换成泛化的“获得感悟”或“选择成功”。",
    "2. 两个选项的回声在动作、代价和情绪上必须可区分。",
    "3. 数值变化由界面浮字承担；回声只写现场后果。",
    "4. 结尾保留一个可感知的落点，如墨痕、灯芯、雨声、榜纸、寺钟。",
    "5. 原始数据仍统一写“你”，由游戏在运行时替换为玩家名。",
    "",
    "---",
    "",
    "## 完整对照",
    "",
]
for event in data:
    if event.get("kind") != "choice":
        continue
    lines.extend([
        f"### {event['id']} · {event['name']}",
        "",
        f"**情境**：{event['text']}",
        "",
    ])
    for index, choice in enumerate(event.get("choices", []), 1):
        lines.extend([
            f"#### 选择 {index}",
            "",
            f"**选项**：{choice['text']}",
            "",
            f"**回声**：{choice.get('resultText', '')}",
            "",
        ])
    lines.extend(["---", ""])
lines.extend([
    "## 配置与验证结果",
    "",
    "- `feihuaqi-playable/config/events.json`：14 个 choice 事件、28 个选项均已写入非空 `resultText`。",
    "- `feihua-content.json`：已从正式配置重新生成并同步上述回声。",
    "- `feihuaqi-playable/tests/choice-echo.test.mjs`：配置完整性、选择/回声/effect 对应、旧数据兜底、普通奇遇与辞宗轻奇遇入口全部通过。",
    "- 本轮只修订回声文字，没有修改事件正文、选项、数值效果或其他叙事内容。",
])
(root / "飞花棋-选择回声文案终稿.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

import html
cards = []
for event in data:
    if event.get("kind") != "choice":
        continue
    choices = []
    for index, choice in enumerate(event.get("choices", []), 1):
        choices.append(f'''<section class="choice"><div class="choice-num">选择 {index}</div>
        <h3>{html.escape(choice['text'])}</h3><p>{html.escape(choice.get('resultText', ''))}</p></section>''')
    cards.append(f'''<article class="event"><div class="event-title"><span>{html.escape(event['id'])}</span><h2>{html.escape(event['name'])}</h2></div>
    <p class="context">{html.escape(event['text'])}</p><div class="choices">{''.join(choices)}</div></article>''')
style = '''
*{box-sizing:border-box}body{margin:0;background:#f7f3ec;color:#2b2723;font-family:"Microsoft YaHei",system-ui,sans-serif;line-height:1.8}.page{max-width:980px;margin:auto;padding:42px 22px 90px}header{padding:30px 34px;background:#fffdf9;border:1px solid #e3d9cb;border-radius:16px;margin-bottom:20px}header h1{font-family:KaiTi,STKaiti,serif;color:#8f3024;font-size:30px;margin:0 0 8px}header p{color:#766b60;margin:0}.principles{background:#fffdf9;border:1px solid #e3d9cb;border-radius:14px;padding:22px 28px;margin-bottom:22px}.principles h2{font-size:18px;margin:0 0 8px;color:#594536}.principles ol{margin:0;padding-left:22px}.event{background:#fffdf9;border:1px solid #e3d9cb;border-radius:16px;padding:26px 28px;margin:18px 0}.event-title{display:flex;gap:12px;align-items:center}.event-title span{font:13px Consolas,monospace;color:#9b3b2e;background:#f5e8e2;border-radius:16px;padding:2px 10px}.event-title h2{font-family:KaiTi,STKaiti,serif;font-size:23px;margin:0;color:#322821}.context{color:#665b51;border-left:3px solid #c9aa7d;padding:6px 0 6px 16px;margin:16px 0 20px}.choices{display:grid;grid-template-columns:1fr 1fr;gap:14px}.choice{border:1px solid #eadfd0;border-radius:12px;padding:17px 18px;background:#fbf7f0}.choice-num{font-size:12px;color:#9b3b2e;letter-spacing:.12em}.choice h3{font-size:15px;margin:5px 0 11px;color:#47382e}.choice p{font-family:KaiTi,STKaiti,"Microsoft YaHei",sans-serif;font-size:17px;margin:0;color:#2d2925}.foot{color:#756a60;font-size:13px;text-align:center;margin-top:30px}@media(max-width:700px){.page{padding:16px 10px 60px}.choices{grid-template-columns:1fr}.event,header{padding:20px 18px}}
'''
page = f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>飞花棋选择回声文案终稿</title><style>{style}</style></head><body><main class="page"><header><h1>《飞花棋》选择回声文案终稿</h1><p>14 个选择奇遇 · 28 条专属回声 · 保持第二人称与原有古典叙事语气</p></header><section class="principles"><h2>写作准则</h2><ol><li>先兑现所选动作，再留下现场余韵。</li><li>数值由浮字说明，回声只写人物与场景的变化。</li><li>不解释象征，不新增设定，不替玩家宣布感悟。</li></ol></section>{''.join(cards)}<div class="foot">正式内容已同步至 events.json 与 feihua-content.json；选择回声专项测试全部通过。</div></main></body></html>'''
(root / "飞花棋-选择回声文案终稿.html").write_text(page, encoding="utf-8")
print("Markdown 与 HTML 文档已生成")
