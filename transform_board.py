import json

p = r"C:\Users\77522\WorkBuddy\2026-08-01-00-57-25\extracted\flyhua\feihuaqi\config\board.json"
d = json.load(open(p, encoding='utf-8'))

# 每条支线扩充到 10 格：保留原 5 个 id，再追加 5 个新 id（避开已有区间，集中用 80-99）
new_ids = {
    'shanshui': [60, 61, 62, 63, 64, 80, 81, 82, 83, 84],
    'shuyuan':  [65, 66, 67, 68, 69, 85, 86, 87, 88, 89],
    'yuyuan':   [70, 71, 72, 73, 74, 90, 91, 92, 93, 94],
    'biansai':  [75, 76, 77, 78, 79, 95, 96, 97, 98, 99],
}

# id -> (type, name)。第 10 格（landmark）即名胜终点，奖励由引擎发放
branch_cells = {
    60: ('ping', '溪云初起'), 61: ('quiz', '问津处'), 62: ('event', '落英缤纷'),
    63: ('battle', '武陵渔郎'), 64: ('ping', '渔樵闲话'),
    80: ('quiz', '桃源问字'), 81: ('event', '桑竹垂荫'), 82: ('battle', '避秦鼓枻'),
    83: ('ping', '鸡犬相闻'), 84: ('landmark', '桃花源'),

    65: ('ping', '讲经坪'), 66: ('quiz', '白鹿问难'), 67: ('event', '古碑残拓'),
    68: ('battle', '鹅湖之会'), 69: ('ping', '弦歌不辍'),
    85: ('quiz', '鹿洞书声'), 86: ('event', '石室藏经'), 87: ('battle', '朱陆之辩'),
    88: ('ping', '泮水清风'), 89: ('landmark', '白鹿洞'),

    70: ('ping', '曲径回廊'), 71: ('quiz', '沉香亭北'), 72: ('event', '太液芙蓉'),
    73: ('battle', '清平调'), 74: ('ping', '小殿风微'),
    90: ('quiz', '霓裳一曲'), 91: ('event', '海棠春睡'), 92: ('battle', '谪仙斗酒'),
    93: ('ping', '玉砌雕栏'), 94: ('landmark', '御花园'),

    75: ('ping', '黄沙道'), 76: ('quiz', '阳关三叠'), 77: ('event', '胡笳夜'),
    78: ('battle', '燕然勒石'), 79: ('ping', '孤烟落日'),
    95: ('quiz', '羌笛杨柳'), 96: ('event', '烽燧传书'), 97: ('battle', '龙城飞将'),
    98: ('ping', '春风不度'), 99: ('landmark', '玉门关'),
}

assert len(branch_cells) == 40, len(branch_cells)
branch_cells_list = [{'id': k, 'type': v[0], 'name': v[1]} for k, v in branch_cells.items()]

for bid, ids in new_ids.items():
    br = d['branches'][bid]
    br['cells'] = ids
    br.pop('cellDetails', None)  # 引擎不再读取 cellDetails，改为 branchCells 显式定义

d['branchCells'] = branch_cells_list

json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

# 校验
chk = json.load(open(p, encoding='utf-8'))
for bid, ids in new_ids.items():
    assert len(chk['branches'][bid]['cells']) == 10, bid
    assert 'cellDetails' not in chk['branches'][bid], bid
    assert chk['branchCells'][ids[9]]['type'] == 'landmark', bid  # 第 10 格为名胜
assert len(chk['branchCells']) == 40
by_id = {c['id']: c for c in chk['branchCells']}
for bid, ids in new_ids.items():
    assert by_id[ids[9]]['type'] == 'landmark', bid  # 第 10 格为名胜
print("board.json OK: 4 branches x 10 cells, 40 branchCells, landmark at end")
