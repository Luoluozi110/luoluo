/* 自动生成：叙事文案编辑器默认种子，镜像游戏 config/schools.json、config/grades.json 与 config/narrative.json 的当前内容。
 * 仅含文案/展示字段的默认来源；编辑后覆盖到 localStorage，导出即对应 json。
 * 若游戏侧这三类配置有结构更新，请用同样方式重新生成本文件以保持一致。 */
window.GAME_SCHOOLS = [
  {
    "id": "bowen",
    "name": "博闻",
    "attr": "xue",
    "homeManner": null,
    "talent": "T004",
    "aliases": [
      "tongru"
    ],
    "schoolMechanics": {
      "type": "bowen",
      "knowledgeThreshold": 2,
      "knowledgeReward": {
        "mode": "allCreative",
        "value": 1
      },
      "knowledgePityTurn": 3
    },
    "motto": "博观约取，厚积薄发",
    "flavor": "你自幼好读，藏书万卷皆在腹中。科场之上，你能引百家之言以佐己论，举一隅而三隅反——胸中学问，便是你挥之不尽的底气。",
    "desc": "开局学力 +3，初始文心「博览」。答对考题或完成抉择积累博闻，知识达到 2 后三体各得其益。"
  },
  {
    "id": "qishi",
    "name": "奇士",
    "attr": "si",
    "homeManner": null,
    "talent": "T008",
    "aliases": [
      "qishi_old"
    ],
    "schoolMechanics": {
      "type": "qishi",
      "inspirationBonusRate": 0.35,
      "upgradeCostRate": 0.65,
      "talentDropRate": 0.35,
      "talentDropCap": 0.45,
      "talentDropPityWin": 5
    },
    "motto": "灵台澄澈，万象皆明",
    "flavor": "你生性爱钻牛角尖，常于无人处反复推敲。奇思往往不循常理，却能于困局中另辟蹊径——想人之所未想，故能成人之所不能成。",
    "desc": "开局思力 +3，初始文心「推敲」。正向灵感来源以 35% 累积转化，文心升级成本按 0.65 折扣。"
  },
  {
    "id": "cizong_bi",
    "name": "辞宗",
    "attr": "bi",
    "homeManner": null,
    "talent": "T006",
    "aliases": [
      "cizong"
    ],
    "schoolMechanics": {
      "type": "cizong_bi",
      "creativeDicePlus": 2,
      "freeDiceCap": 5,
      "basicMinGain": 1,
      "basicMinThreshold": 4,
      "basicMinAccelerate": 1,
      "lightEventEvery": 2
    },
    "motto": "笔落惊风雨，文成绣山川",
    "flavor": "你惜墨如金，落笔却字字千金。洋洋千言一挥而就，旁人苦吟终日的篇章，于你不过是砚池里一次起兴。文思如潮涌，胸中自有丘壑。",
    "desc": "开局笔力 +3，初始文心「入木三分」。创作骰点 +2（固定骰不受影响），结算后补足最低基本功。"
  }
];

window.GAME_GRADES = {
  "version": "2.2",
  "note": "Round 6「更大胆」三圈单场殿试语义迁移；Round 5「更大胆」重校准（肉鸽传承视角）：举人以上 NPC 回调至 E3(100/138/174)，0.75 熟练中位降至 3346(sd 427)。传承模拟(3 代 90%)确证六维可叠至~312，但评分各维皆带 soft cap，超额属性仅计半速，导致传承对总分几乎无抬升(3 代后 p50~3250/p95~3900，与裸局持平)——故文宗不因传承放水上调。整条阶梯相对 v2.1 上移一档并对齐新中位，形成「底部托底、顶部稀缺」下降钟形；文宗压至 top~1.6% 精英档(≥4300)，比 v2.1(≥4200)更严。达成率(0.75熟练/0.55新手)：文宗 1.6%/0.9%、童生 20.4%/27.6%。校准见 sim_grade_refit.mjs 与 probe_grade_reincarnate.mjs。",
  "dimensions": [
    {
      "key": "wencai",
      "name": "文采分",
      "formula": "min(shi+ci+lian, 51) * 12 + max(0, shi+ci+lian-51) * 6",
      "coeff": {
        "shi": 12,
        "ci": 12,
        "lian": 12,
        "soft": 51,
        "softRate": 0.5
      },
      "bonuses": [
        {
          "id": "sanjuejunheng",
          "name": "三绝均衡",
          "desc": "诗力、词力、联力均 ≥24",
          "cond": {
            "type": "all_min",
            "attrs": [
              "shi",
              "ci",
              "lian"
            ],
            "value": 24
          },
          "score": 100
        },
        {
          "id": "yizhiduxiu",
          "name": "一枝独秀",
          "desc": "最高创作力 > 另两项之和",
          "cond": {
            "type": "max_gt_sum_others",
            "attrs": [
              "shi",
              "ci",
              "lian"
            ]
          },
          "score": 50
        },
        {
          "id": "pobi",
          "name": "破壁",
          "desc": "任一创作力 ≥22",
          "cond": {
            "type": "any_min",
            "attrs": [
              "shi",
              "ci",
              "lian"
            ],
            "value": 22
          },
          "score": 120
        }
      ]
    },
    {
      "key": "gongli",
      "name": "功力分",
      "formula": "min(bi+xue+si, 39) * 10 + max(0, bi+xue+si-39) * 5",
      "coeff": {
        "bi": 10,
        "xue": 10,
        "si": 10,
        "soft": 39,
        "softRate": 0.5
      },
      "bonuses": [
        {
          "id": "genjishenhou",
          "name": "根基深厚",
          "desc": "笔力、学力、思力三项极差 ≤3",
          "cond": {
            "type": "range_max",
            "attrs": [
              "bi",
              "xue",
              "si"
            ],
            "value": 3
          },
          "score": 80
        },
        {
          "id": "pianfeng",
          "name": "偏锋",
          "desc": "笔力/学力/思力任一项 ≥16",
          "cond": {
            "type": "any_min",
            "attrs": [
              "bi",
              "xue",
              "si"
            ],
            "value": 16
          },
          "score": 150
        }
      ]
    },
    {
      "key": "zhanji",
      "name": "战绩分",
      "formula": "min(win,3)*40 + max(0,win-3)*20 + draw*20 + lose*(-10) + min(maxStreak,2)*20 + upset*10",
      "coeff": {
        "win": 40,
        "winFull": 3,
        "draw": 20,
        "lose": -10,
        "maxStreak": 20,
        "maxStreakCap": 2,
        "upset": 10
      },
      "bonuses": [
        {
          "id": "santijiesheng",
          "name": "三体皆胜",
          "desc": "诗、词、联三种文体各取胜 ≥2 场",
          "cond": {
            "type": "each_style_win_min",
            "styles": [
              "shi",
              "ci",
              "lian"
            ],
            "value": 2
          },
          "score": 100
        }
      ]
    },
    {
      "key": "qiyu",
      "name": "奇遇分",
      "formula": "eventCount*10 + rareCount*30 + legendCount*80 + talentCount*45 + itemCount*20",
      "coeff": {
        "eventCount": 10,
        "rareCount": 30,
        "legendCount": 80,
        "talentCount": 45,
        "itemCount": 20
      },
      "bonuses": []
    },
    {
      "key": "liupai",
      "name": "流派分",
      "formula": "取最高一档，不叠加",
      "exclusive": true,
      "tiers": [
        {
          "id": "shixian",
          "name": "诗仙",
          "desc": "诗力 > 词力+联力 且 诗力 ≥30 且 用诗取胜 ≥3 场",
          "cond": {
            "type": "school_master",
            "attr": "shi",
            "others": [
              "ci",
              "lian"
            ],
            "attrMin": 30,
            "winMin": 3
          },
          "score": 210
        },
        {
          "id": "cizong",
          "name": "词宗",
          "desc": "词力 > 诗力+联力 且 词力 ≥30 且 用词取胜 ≥3 场",
          "cond": {
            "type": "school_master",
            "attr": "ci",
            "others": [
              "shi",
              "lian"
            ],
            "attrMin": 30,
            "winMin": 3
          },
          "score": 210
        },
        {
          "id": "liansheng",
          "name": "联圣",
          "desc": "联力 > 诗力+词力 且 联力 ≥30 且 用联取胜 ≥3 场",
          "cond": {
            "type": "school_master",
            "attr": "lian",
            "others": [
              "shi",
              "ci"
            ],
            "attrMin": 30,
            "winMin": 3
          },
          "score": 210
        },
        {
          "id": "sanjue",
          "name": "三绝",
          "desc": "诗、词、联三力均 ≥14",
          "cond": {
            "type": "all_min",
            "attrs": [
              "shi",
              "ci",
              "lian"
            ],
            "value": 14
          },
          "score": 180
        }
      ]
    },
    {
      "key": "yuanman",
      "name": "圆满分",
      "formula": "arrive*250 + inspirationLeft*15 + 速度加成 + 殿试单场取胜*75",
      "coeff": {
        "arrive": 250,
        "inspirationLeft": 15
      },
      "bonuses": [
        {
          "id": "jiecai",
          "name": "捷才",
          "desc": "≤54 回合抵达终点",
          "cond": {
            "type": "turns_max",
            "value": 54
          },
          "score": 150,
          "exclusiveGroup": "speed"
        },
        {
          "id": "congrong",
          "name": "从容",
          "desc": "≤56 回合抵达终点，且剩余灵感 ≥5",
          "cond": {
            "type": "turns_max_with_inspiration",
            "value": 56,
            "inspirationMin": 5
          },
          "score": 100,
          "exclusiveGroup": "speed"
        },
        {
          "id": "jinbangtiming",
          "name": "金榜题名",
          "desc": "殿试单场取胜",
          "cond": {
            "type": "final_win",
            "value": 1
          },
          "score": 75
        }
      ],
      "specialRules": [
        {
          "id": "fengbi",
          "desc": "封笔结局：圆满分记 0，其余五维照常结算"
        },
        {
          "id": "turnLimit",
          "desc": "回合上限 84 强制结束且未到达终点：圆满分 = 剩余灵感 × 15，无抵达分"
        }
      ]
    }
  ],
  "grades": [
    {
      "id": "tongsheng",
      "name": "童生",
      "min": 1,
      "max": 2999,
      "reward": ""
    },
    {
      "id": "xiucai",
      "name": "秀才",
      "min": 3000,
      "max": 3199,
      "reward": "「书生」头像框"
    },
    {
      "id": "juren",
      "name": "举人",
      "min": 3200,
      "max": 3399,
      "reward": "名篇残卷系统"
    },
    {
      "id": "jinshi",
      "name": "进士",
      "min": 3400,
      "max": 3599,
      "reward": "困难模式"
    },
    {
      "id": "tanhua",
      "name": "探花",
      "min": 3600,
      "max": 3799,
      "reward": "「探花」主题皮肤"
    },
    {
      "id": "bangyan",
      "name": "榜眼",
      "min": 3800,
      "max": 3999,
      "reward": "自定义开局"
    },
    {
      "id": "zhuangyuan",
      "name": "状元",
      "min": 4000,
      "max": 4149,
      "reward": "「状元」入场动画"
    },
    {
      "id": "hanlin",
      "name": "翰林",
      "min": 4150,
      "max": 4299,
      "reward": "全部天赋预览"
    },
    {
      "id": "wenzong",
      "name": "文宗",
      "min": 4300,
      "max": null,
      "reward": "「文宗」称号与特效"
    }
  ],
  "comments": {
    "wencai": "文采最高：锦心绣口，落笔成章",
    "gongli": "功力最高：根柢盘深，厚积薄发",
    "zhanji": "战绩最高：百战文场，杀伐果断",
    "qiyu": "奇遇最高：踏遍青山，奇缘满袖",
    "liupai": "流派最高：一门深入，卓然成家",
    "yuanman": "圆满最高：从容赴考，功行圆满"
  }
};

window.GAME_NARRATIVE = {
  "prologue": {
    "title": "初入科场",
    "text": "你有这么一段模糊的记忆：你来自于所谓的“现代世界”，你或许曾富甲一方，却感到生活寡淡无味，于是抛尽家财，出海寻访；也或许一贫如洗，为虚无缥缈的救赎凭片板到海上流浪；又或许只过着柴米油盐的生活，却在某日下定决心，去寻找那个世外仙源——总之，共同点是，你最终来到了『桃花岛』。岛上的仙人听你说明来意，默然无言，只往你头上一点，你便感觉周围的景物变成万千碎片，万千尘埃，像被狂风割裂，吹散，又重组成了新的场景。“待到种种妄念破灭，自可殿试见我，可涤尔灵台。”你到了蒙学馆，变成了一个小童生。其后十年潜心，你逐渐分不清那段模糊的记忆是真实存在，还只是一段怪谈般的梦境。总之，眼前科举将启，十载寒窗已到迎来回报的时刻，只待踏上征途，一上科场，便一鸣惊人。",
    "button": "踏上征途"
  },
  "zeitgeist": {
    "kind": "当 朝 文 风",
    "title": "风 潮 既 起",
    "lead": "本局科场，文运所钟于二事。临场择题用体，可顺势而行：",
    "note": "若某场题目恰为热点题材、又用得势文体，二者叠加生效。文运在手，善用之可事半功倍。",
    "button": "谨记于心"
  },
  "stageChange": {
    "kind": "科 场 叙 事",
    "names": {
      "xiucai": "秀才",
      "juren": "举人",
      "jinshi": "进士"
    },
    "titleTpl": "{name}阶段 · 晋阶试",
    "buttonTpl": "进入{name}阶段",
    "default": "基础功名已立。接下来的道路会逐渐收紧，先前积下的文心与选择，将在新的试场中显出分量。",
    "middle": "外圈的试炼已尽。你将踏入中圈，补给不再唾手可得，真正的论战与奇遇正在前方等候。",
    "inner": "中圈的取舍已经定稿。内圈只给成熟的构筑留下位置，每一场论战都将逼你证明为何能走到这里。"
  },
  "lap2Intro": {
    "title": "会试圈 · 再入科场",
    "text": "童生圈的试炼渐远，你已不再只是初入科场的稚子。\n\n棋盘上的路重新展开，题目更深，对手也将换作秀才与举人之间的较量。前方的每一步，都在检验十年寒窗积下的根基。\n\n收束心神，继续向前；待绕过会试圈，金殿之门便会在尽头开启。",
    "button": "进入会试圈"
  }
};
