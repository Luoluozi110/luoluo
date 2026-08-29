#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从《文心升级系统完整数值表_v2.xlsx》的设计（品质/等级上限/逐级数值）生成
config/talent-upgrade.json。

输出结构（每枚文心）：
{
  "T001": {
    "quality": "common",        // common|rare|epic|legend
    "maxLevel": 3,
    "upCost": [6, 10],           // 升至 L2 / L3 的灵感成本（长度 = maxLevel-1）
    "levels": [                  // 长度 = maxLevel，索引 0 = Lv1
      { "effect": { ...talents.json 基线 effect（已按等级缩放）... } },
      ...
      { "effect": {...}, "cost": n }   // 主动文心附 cost（Lv1..Lv_max 逐级）
    ]
  },
  ...
}

逐级数值规则（对齐 Excel「效果字段映射」与「逐级数值」首轮仿真起点）：
- 整数档（value/attrs.*/threshold/step/maxTriggers/cost）：floor 线性插值，保证 Lv1=基线、Lv_max=满级。
- 分数档（chance/mult/pct/ratio）：线性插值保留小数（round 4 位）。
"""
import json, math, copy, os, sys

ROOT = "feihuaqi-playable"
TALENTS_PATH = os.path.join(ROOT, "config", "talents.json")
OUT_PATH = os.path.join(ROOT, "config", "talent-upgrade.json")

with open(TALENTS_PATH, "r", encoding="utf-8") as f:
    talents = json.load(f)
base_by_id = {t["id"]: t for t in talents}

# 品质成本曲线（来自 Excel「品质成本曲线」）
UPCOST = {
    "common": [6, 10],
    "rare": [7, 11, 16],
    "epic": [8, 12, 17, 23],
    "legend": [9, 13, 18, 24, 31],
}

# 每枚文心的设计（品质、等级上限、缩放字段、主动成本端点）
# 字段描述: ("top", key, base, max, isint) 或 ("attrs", key, base, max, isint)
# 数据逐枚转写自 Excel「文心总表」的 Lv1→满级 数值。
SPEC = {
    # —— 普通 max3 ——
    "T001": ("common", 3, [("top","value",1,2,True)]),
    "T002": ("common", 3, [("top","value",1,2,True)]),
    "T003": ("common", 3, [("top","value",1,2,True)]),
    "T004": ("common", 3, [("attrs","xue",2,4,True)]),
    "T005": ("common", 3, [("top","value",1,2,True)]),
    "T009": ("common", 3, [("attrs","xue",2,4,True)]),
    "T010": ("common", 3, [("top","value",1,2,True)]),
    "T017": ("common", 3, [("top","value",1,2,True)]),
    "T018": ("common", 3, [("top","value",1,2,True)]),
    # —— 稀有 max4 ——
    "T006": ("rare", 4, [("attrs","bi",3,6,True)]),
    "T008": ("rare", 4, [("attrs","si",3,6,True)]),
    "T012": ("rare", 4, [("top","value",2,4,True)]),
    "T013": ("rare", 4, [("top","value",2,4,True)]),
    "T014": ("rare", 4, [("top","value",2,4,True)]),
    "T019": ("rare", 4, [("top","value",1,3,True)]),
    "T020": ("rare", 4, [("top","value",0.04,0.08,False)]),
    "T021": ("rare", 4, [("top","value",0.05,0.10,False)]),
    "T022": ("rare", 4, [("top","value",0.20,0.50,False)]),
    "T027": ("rare", 4, [("top","value",1,2,True)]),
    "T029": ("rare", 4, [("top","value",3,6,True)]),
    "T030": ("rare", 4, [("top","value",1,2,True),("top","maxTriggers",2,4,True)]),
    "TA01": ("rare", 4, [("top","value",0.18,0.30,False)]),
    "TA02": ("rare", 4, [("top","ratio",0.70,1.15,False)], (3,3)),
    "TA05": ("rare", 4, [("top","value",3,6,True)], (2,2)),
    "TA07": ("rare", 4, [("top","value",6,7,True)], (3,3)),
    "TA08": ("common", 3, [], (5,5)),
    # —— 史诗 max5 ——
    "T007": ("epic", 5, [("top","chance",0.16,0.28,False),("top","mult",1.45,1.55,False)]),
    "T015": ("epic", 5, [("top","chance",0.12,0.24,False),("top","mult",1.55,1.70,False)]),
    "T016": ("epic", 5, [("top","value",5.4,6.2,False)]),
    "T023": ("epic", 5, [("top","value",6,10,True)]),
    "T024": ("epic", 5, [("top","mult",1.18,1.35,False)]),
    "T025": ("epic", 5, [("top","value",0.08,0.16,False),("top","threshold",10,12,True)]),
    "T026": ("epic", 5, [("top","value",0.02,0.04,False),("top","step",4,3,True)]),
    "T028": ("epic", 5, [("top","value",1,4,True)]),
    "T031": ("epic", 5, [("top","value",1,2,True),("top","threshold",12,16,True),("top","maxTriggers",2,4,True)]),
    "T032": ("epic", 5, [("top","value",4,8,True)]),
    "TA03": ("epic", 5, [("top","value",6.5,8.2,False)], (4,4)),
    "TA04": ("epic", 5, [("top","chance",0.30,0.47,False),("top","mult",1.45,1.55,False)], (3,3)),
    # —— 传说 max6 ——
    "T011": ("legend", 6, [("top","ratio",0.55,1.30,False)]),
    "T099": ("legend", 6, [("top","value",0.03,0.08,False)]),
    "T033": ("legend", 6, [("top","value",5,14,True)]),
    "T034": ("legend", 6, [("top","inspThreshold",40,20,True),("top","attrRatio",0.80,1.00,False)]),
    "TA06": ("legend", 6, [("top","value",16,24,True)], (4,4)),
}


def interp(base, mx, L, ML, isint):
    if ML <= 1:
        return base
    f = (L - 1) / (ML - 1)
    v = base + (mx - base) * f
    if isint:
        return int(math.floor(v + 1e-9))
    return round(v, 4)


def build():
    out = {}
    missing = [t["id"] for t in talents if t["id"] not in SPEC]
    if missing:
        print("WARN 未配置升级数据的文心：", missing, file=sys.stderr)
    for tid, base in base_by_id.items():
        spec = SPEC.get(tid)
        if not spec:
            # 没有设计覆盖则补足最小可升级定义：普通 max3，无数值缩放（仅 Lv1 基线）
            quality, maxLevel, fields = "common", 3, []
            cost_end = None
        else:
            if len(spec) == 3:
                quality, maxLevel, fields = spec
                cost_end = None
            else:
                quality, maxLevel, fields, cost_end = spec
        upcost = UPCOST[quality][: maxLevel - 1]
        levels = []
        for L in range(1, maxLevel + 1):
            # 以 talents.json 基线 effect 为模板，保留未缩放字段（style/attrs键/group/theme…）；
            # 缩放字段一律以「设计 Lv1→满级」端点插值，使设计 Lv1 成为权威生效值（设计本身是对基线的重平衡）。
            eff = copy.deepcopy(base.get("effect", {}))
            for desc in fields:
                ptype, key, bv, mv, isint = desc
                if ptype == "attrs":
                    eff.setdefault("attrs", {})[key] = interp(bv, mv, L, maxLevel, isint)
                else:
                    eff[key] = interp(bv, mv, L, maxLevel, isint)
            entry = {"effect": eff}
            if cost_end is not None:
                bcost, mcost = cost_end
                entry["cost"] = interp(bcost, mcost, L, maxLevel, True)
            levels.append(entry)
        out[tid] = {
            "quality": quality,
            "maxLevel": maxLevel,
            "upCost": upcost,
            "levels": levels,
        }
    return out


def main():
    out = build()
    # 校验
    for tid, base in base_by_id.items():
        u = out[tid]
        assert len(u["levels"]) == u["maxLevel"], f"{tid} levels 长度不符"
        # 未缩放字段须与 talents.json 基线一致（缩放字段以设计 Lv1 为准，允许不同）
        beff = base.get("effect", {})
        leff = u["levels"][0]["effect"]
        for k, v in beff.items():
            if k == "attrs":
                for ak, av in v.items():
                    assert leff.get("attrs", {}).get(ak) == av, f"{tid} 未缩放 attr {ak} 不一致"
            elif k not in {fd[1] for fd in SPEC.get(tid, (None, None, []))[2] if fd[0] == "top"}:
                assert leff.get(k) == v, f"{tid} 未缩放字段 {k} 不一致"
        if "cost" in base:
            assert "cost" in u["levels"][0], f"{tid} 主动成本缺失"
        assert len(u["upCost"]) == u["maxLevel"] - 1, f"{tid} upCost 长度不符"
    # 双向覆盖
    ids_spec = set(SPEC.keys())
    ids_tal = set(base_by_id.keys())
    assert ids_spec == ids_tal, f"ID 集合不一致：spec 独有 {ids_spec-ids_tal}，tal 独有 {ids_tal-ids_spec}"
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"OK 生成 {OUT_PATH}：{len(out)} 枚文心")
    # 抽样打印
    for tid in ("T001", "T004", "T007", "T011", "T016", "T033", "TA04"):
        u = out[tid]
        print(f"  {tid} {u['quality']} max{u['maxLevel']} upCost={u['upCost']}")
        for i, lv in enumerate(u["levels"], 1):
            print(f"    Lv{i}: {lv['effect']}" + (f" cost={lv['cost']}" if 'cost' in lv else ""))


if __name__ == "__main__":
    main()
