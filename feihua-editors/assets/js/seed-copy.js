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
      "knowledgeInsight": 40,
      "knowledgePityTurn": 3,
      "studySlotsPlus": 1,
      "differentStyleInsight": 20,
      "talentConversion": {
        "label": "穷览求心",
        "resource": "insight",
        "cost": 80,
        "chance": 4500,
        "maxAttempts": 2,
        "perPhase": 1,
        "desc": "消耗心得，融会所学以叩问文心。"
      }
    },
    "motto": "博观约取，厚积薄发",
    "flavor": "你自幼好读，藏书万卷皆在腹中。科场之上，你能引百家之言以佐己论，举一隅而三隅反——胸中学问，便是你挥之不尽的底气。",
    "desc": "开局学力 +30，初始文心「博览」。研修位 +1；可消耗心得发动「穷览求心」，概率获得文心三选一。"
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
      "inspirationBonusRate": 2000,
      "upgradeCostRate": 8000,
      "talentDropRate": 2500,
      "talentDropCap": 3500,
      "talentDropPityWin": 6,
      "strategyChargePlus": 1,
      "strategyMaxPlus": 1,
      "firstPlanFreePerPhase": 1,
      "talentConversion": {
        "label": "推演问心",
        "resource": "strategy",
        "cost": 2,
        "chance": 4000,
        "maxAttempts": 2,
        "perPhase": 1,
        "desc": "消耗构思，推演万象以觅得灵机。"
      }
    },
    "motto": "灵台澄澈，万象皆明",
    "flavor": "你生性爱钻牛角尖，常于无人处反复推敲。奇思往往不循常理，却能于困局中另辟蹊径——想人之所未想，故能成人之所不能成。",
    "desc": "开局思力 +30，初始文心「推敲」。每阶段构思与上限各 +1；可消耗构思发动「推演问心」，概率获得文心三选一。"
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
      "creativeDicePlus": 0,
      "freeDiceCap": 0,
      "basicMinGain": 0,
      "lightEventEvery": 0,
      "manuscriptCapPlus": 1,
      "firstFinishedPagePlus": 1,
      "firstPolishCostReduce": 1,
      "talentConversion": {
        "label": "焚稿悟心",
        "resource": "manuscript",
        "cost": 3,
        "chance": 5000,
        "maxAttempts": 2,
        "perPhase": 1,
        "desc": "消耗稿页，焚稿反思以淬炼文心。"
      }
    },
    "motto": "笔落惊风雨，文成绣山川",
    "flavor": "你惜墨如金，落笔却字字千金。洋洋千言一挥而就，旁人苦吟终日的篇章，于你不过是砚池里一次起兴。文思如潮涌，胸中自有丘壑。",
    "desc": "开局笔力 +30，初始文心「入木三分」。稿匣上限 +1；可消耗稿页发动「焚稿悟心」，概率获得文心三选一。"
  }
];
window.GAME_GRADES = {
  "version": "2.3",
  "note": "Round 6「更大胆」三圈单场殿试语义迁移；Round 5「更大胆」重校准（肉鸽传承视角）：举人以上 NPC 回调至 E3(100/138/174)，0.75 熟练中位降至 3346(sd 427)。传承模拟(3 代 90%)确证六维可叠至~312，但评分各维皆带 soft cap，超额属性仅计半速，导致传承对总分几乎无抬升(3 代后 p50~3250/p95~3900，与裸局持平)——故文宗不因传承放水上调。整条阶梯相对 v2.1 上移一档并对齐新中位，形成「底部托底、顶部稀缺」下降钟形；文宗压至 top~1.6% 精英档(≥4300)，比 v2.1(≥4200)更严。达成率(0.75熟练/0.55新手)：文宗 1.6%/0.9%、童生 20.4%/27.6%。校准见 sim_grade_refit.mjs 与 probe_grade_reincarnate.mjs。v2.3：收紧过易条件——流派三绝均≥14→≥18、三体皆胜各胜≥2→≥3、捷才≤54→≤48回合、从容≤56→≤50回合且灵感≥5→≥6、根基深厚极差≤3→≤2、偏锋任一项≥16→≥20；顶部精英档（诗仙/词宗/联圣）与文宗门槛不动。",
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
        "softRate": 5000
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
        "softRate": 5000
      },
      "bonuses": [
        {
          "id": "genjishenhou",
          "name": "根基深厚",
          "desc": "笔力、学力、思力三项极差 ≤2",
          "cond": {
            "type": "range_max",
            "attrs": [
              "bi",
              "xue",
              "si"
            ],
            "value": 2
          },
          "score": 80
        },
        {
          "id": "pianfeng",
          "name": "偏锋",
          "desc": "笔力/学力/思力任一项 ≥20",
          "cond": {
            "type": "any_min",
            "attrs": [
              "bi",
              "xue",
              "si"
            ],
            "value": 20
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
          "desc": "诗、词、联三种文体各取胜 ≥3 场",
          "cond": {
            "type": "each_style_win_min",
            "styles": [
              "shi",
              "ci",
              "lian"
            ],
            "value": 3
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
          "desc": "诗、词、联三力均 ≥18",
          "cond": {
            "type": "all_min",
            "attrs": [
              "shi",
              "ci",
              "lian"
            ],
            "value": 18
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
          "desc": "≤48 回合抵达终点",
          "cond": {
            "type": "turns_max",
            "value": 48
          },
          "score": 150,
          "exclusiveGroup": "speed"
        },
        {
          "id": "congrong",
          "name": "从容",
          "desc": "≤50 回合抵达终点，且剩余灵感 ≥6",
          "cond": {
            "type": "turns_max_with_inspiration",
            "value": 50,
            "inspirationMin": 6
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
  },
  "numericVersion": 2
};
window.GAME_NARRATIVE = {
  "tutorial": {
    "kickoff": {
      "title": "起步札记",
      "text": "每回合先掷‘移动骰’，决定你在棋盘上前进几格。\n\n落到不同格子会触发奇遇、问答或论战。先看看右侧的灵感与文心，再点击‘掷骰’出发。",
      "button": "明白，开始第一回合"
    },
    "battle": {
      "title": "论战六步",
      "text": "① 遭遇：先看对手是否有招牌与破绽\n② 审题：确认题目题材，并留意当朝风潮\n③ 选文体：看属性底盘与本体专精\n④ 选风格：看题材、文风和连捷加成\n⑤ 掷灵感骰：决定临场发挥，可花灵感追加\n⑥ 算分对决：逐项揭示格律、意象、立意、骰子和修正\n\n记住：先看题，再选体；先算资源，再决定要不要追加。",
      "button": "开始第一场论战"
    }
  },
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
  "chapterTactics": {
    "craft": {
      "守法": {
        "title": "守法·循格成章",
        "text": "先立骨架，再安字句；你把可传的章法带进下一圈。"
      },
      "出新": {
        "title": "出新·换景立意",
        "text": "不肯只沿熟路，你愿在转折处另开一个入口。"
      },
      "neutral": {
        "title": "法意并读",
        "text": "旧法与新意都暂存卷边，下一笔再决定取舍。"
      }
    },
    "cost": {
      "惜身": {
        "title": "惜身·留白养气",
        "text": "收住锋芒不是退却；你为后面的长卷留了余力。"
      },
      "燃笔": {
        "title": "燃笔·趁势成篇",
        "text": "灵感一至便不轻放；你把当下最亮的一笔写到底。"
      },
      "neutral": {
        "title": "张弛相济",
        "text": "你肯全力落笔，也知道给未成之句留下呼吸。"
      }
    }
  },
  "echoChains": [
    {
      "id": "jianglang",
      "eventId": "E006",
      "title": "旧笔回声",
      "text": "行至新圈，包袱里那支旧笔又硌了你一下。你终于明白，能慢慢写稳的一行，也自有光。"
    },
    {
      "id": "dengyou",
      "eventId": "E012",
      "title": "灯下回声",
      "text": "驿灯在风里轻晃。那一夜读到天明或按时熄灯的取舍，仍替你守着卷页的一角。"
    },
    {
      "id": "zhiyin",
      "eventId": "E013",
      "title": "江上回声",
      "text": "过渡口时，远处有人续上你曾写的一句。同行与独行，都没有白走。"
    },
    {
      "id": "laonong",
      "eventId": "E018",
      "title": "田埂回声",
      "text": "一封折得发软的文书追到门前：乡人已把那几句官文问明，也记得曾为他们停步的人。"
    },
    {
      "id": "luodi",
      "eventId": "E025",
      "title": "榜外回声",
      "text": "旧榜早已换纸，舟中却有人低吟你当时写下的一句。被看见的路，并不只在榜上。"
    },
    {
      "id": "gusi",
      "eventId": "E042",
      "title": "松风回声",
      "text": "入夜后松风穿过廊下，像把寺钟带到了此处。那一次受与辞，仍在替你问同一个问题。"
    }
  ],
  "relations": [
    {
      "npcId": "zhou_xiaoman",
      "phase": "middle",
      "title": "周小满来笺",
      "text": "周小满把新临的一页字夹在你行卷里：\"我还在练那一横。你到中圈，也别把初学时的认真丢了。\""
    },
    {
      "npcId": "su_mingzhe",
      "phase": "middle",
      "title": "苏明哲来笺",
      "text": "苏明哲替你把旧卷平码齐整，只留一句：\"路数可以换，须先知道自己为何要换。\""
    },
    {
      "npcId": "tang_ji_qing",
      "phase": "inner",
      "title": "唐季卿来笺",
      "text": "唐季卿在经注空白处批了一行：\"典故不是门槛；若能让人听懂，才算真正用过。\""
    },
    {
      "npcId": "yuwen_yuan",
      "phase": "inner",
      "title": "宇文渊来笺",
      "text": "宇文渊没有评你的字，只问：\"这一卷若无人署名，你还愿意这样写吗？\""
    }
  ],
  "palaceQuestions": [
    {
      "id": "change",
      "examiner": "王侍郎",
      "key": "变",
      "prompt": "你是否被自己的常用路数困住？",
      "varied": "你近来肯换体换法，王侍郎只道：\"知变，方能知守。\"",
      "steady": "王侍郎翻看你的旧卷：\"一路走得很稳，今日可还认得别的门？\""
    },
    {
      "id": "feeling",
      "examiner": "李学士",
      "key": "情",
      "prompt": "形式与声律之外，这篇文章究竟在意谁？",
      "withPeople": "李学士望向你行卷里的故人姓名：\"句中有情，莫把所念之人写丢。\"",
      "alone": "李学士轻扣案角：\"即使独行，也须让读者看见你所守的那一点心。\""
    },
    {
      "id": "use",
      "examiner": "赵大儒",
      "key": "用",
      "prompt": "此卷若出金殿，能否被榜外之人听懂？",
      "open": "赵大儒记起你行卷里的取舍：\"有用之学，不妨落到人间。\"",
      "strict": "赵大儒抚平卷角：\"法度可立卷，也要记得卷外自有人等着。\""
    }
  ],
  "endingFragments": {
    "school": "你的流派功课并未随放榜而停下；它已成了下一卷最稳的底稿。",
    "relationFallback": "四封短笺都收在行囊里。你知道这一路并非只由自己一人评阅。"
  },
  "endScroll": {
    "chapterLines": [
      {
        "id": "outer_yongwu",
        "chapter": "outer",
        "themes": [
          "yongwu"
        ],
        "motif": "观物",
        "tone": "清润",
        "text": "初学看花看砚，也开始看见物外之心。"
      },
      {
        "id": "outer_songbie",
        "chapter": "outer",
        "themes": [
          "songbie"
        ],
        "motif": "同行",
        "tone": "温厚",
        "text": "路从一声珍重起，同行之意先入卷中。"
      },
      {
        "id": "outer_shanshui",
        "chapter": "outer",
        "themes": [
          "shanshui"
        ],
        "motif": "启程",
        "tone": "清旷",
        "text": "山水初开，少年把远处当作下一页。"
      },
      {
        "id": "outer_biansai",
        "chapter": "outer",
        "themes": [
          "biansai"
        ],
        "motif": "试锋",
        "tone": "明快",
        "text": "尚未见长风，笔下已试着立起锋芒。"
      },
      {
        "id": "outer_huaigu",
        "chapter": "outer",
        "themes": [
          "huaigu"
        ],
        "motif": "问古",
        "tone": "沉静",
        "text": "翻过旧人的篇章，也悄悄写下自己的疑问。"
      },
      {
        "id": "outer_jieling",
        "chapter": "outer",
        "themes": [
          "jieling"
        ],
        "motif": "时序",
        "tone": "明净",
        "text": "一番风物催人起步，纸上已有新岁声。"
      },
      {
        "id": "outer_keep",
        "chapter": "outer",
        "inkTags": [
          "守法",
          "惜身"
        ],
        "motif": "扎根",
        "tone": "端正",
        "text": "先把一横一竖写稳，再向长路索问新章。"
      },
      {
        "id": "outer_new",
        "chapter": "outer",
        "inkTags": [
          "出新",
          "燃笔"
        ],
        "motif": "破题",
        "tone": "灵动",
        "text": "旧纸尚白，第一笔已经不肯只循旧路。"
      },
      {
        "id": "middle_yongwu",
        "chapter": "middle",
        "themes": [
          "yongwu"
        ],
        "motif": "照心",
        "tone": "含蓄",
        "text": "借一草一木照心，句子遂有了可守之处。"
      },
      {
        "id": "middle_songbie",
        "chapter": "middle",
        "themes": [
          "songbie"
        ],
        "motif": "留情",
        "tone": "婉转",
        "text": "几番聚散之后，空处也能写出情分。"
      },
      {
        "id": "middle_shanshui",
        "chapter": "middle",
        "themes": [
          "shanshui"
        ],
        "motif": "行旅",
        "tone": "清远",
        "text": "山程水驿渐深，眼界与行囊一同展开。"
      },
      {
        "id": "middle_biansai",
        "chapter": "middle",
        "themes": [
          "biansai"
        ],
        "motif": "立志",
        "tone": "劲健",
        "text": "风急路窄，落笔反而有了不可移的骨力。"
      },
      {
        "id": "middle_huaigu",
        "chapter": "middle",
        "themes": [
          "huaigu"
        ],
        "motif": "辨古",
        "tone": "苍润",
        "text": "不只向古人借句，也开始同古人辩一辩。"
      },
      {
        "id": "middle_jieling",
        "chapter": "middle",
        "themes": [
          "jieling"
        ],
        "motif": "知时",
        "tone": "疏朗",
        "text": "寒暑在卷边换过，取舍也渐渐有了分寸。"
      },
      {
        "id": "middle_truth",
        "chapter": "middle",
        "inkTags": [
          "求真",
          "独行"
        ],
        "motif": "自问",
        "tone": "沉静",
        "text": "众声渐远，仍肯问这一笔是否出自本心。"
      },
      {
        "id": "middle_world",
        "chapter": "middle",
        "inkTags": [
          "入世",
          "逐名"
        ],
        "motif": "应世",
        "tone": "朗健",
        "text": "卷页向人间打开，功名也有了所为之事。"
      },
      {
        "id": "inner_yongwu",
        "chapter": "inner",
        "themes": [
          "yongwu"
        ],
        "motif": "见微",
        "tone": "凝练",
        "text": "一物虽微，已足以托住全卷的心事。"
      },
      {
        "id": "inner_songbie",
        "chapter": "inner",
        "themes": [
          "songbie"
        ],
        "motif": "回望",
        "tone": "深婉",
        "text": "金殿将近，最先回望的仍是同行之人。"
      },
      {
        "id": "inner_shanshui",
        "chapter": "inner",
        "themes": [
          "shanshui"
        ],
        "motif": "开境",
        "tone": "高远",
        "text": "行到云水尽处，笔下天地反而更宽。"
      },
      {
        "id": "inner_biansai",
        "chapter": "inner",
        "themes": [
          "biansai"
        ],
        "motif": "担当",
        "tone": "雄健",
        "text": "长风入卷，锋芒终于知道应当指向何处。"
      },
      {
        "id": "inner_huaigu",
        "chapter": "inner",
        "themes": [
          "huaigu"
        ],
        "motif": "承续",
        "tone": "浑厚",
        "text": "与千载文章相对，仍留下了自己的署名。"
      },
      {
        "id": "inner_jieling",
        "chapter": "inner",
        "themes": [
          "jieling"
        ],
        "motif": "成候",
        "tone": "明澈",
        "text": "一路风候收于笔底，此时落款恰逢其时。"
      },
      {
        "id": "inner_keep",
        "chapter": "inner",
        "inkTags": [
          "守法",
          "求真",
          "惜身"
        ],
        "motif": "持守",
        "tone": "端凝",
        "text": "阅尽繁华章法，仍守得住最初那一点真。"
      },
      {
        "id": "inner_new",
        "chapter": "inner",
        "inkTags": [
          "出新",
          "入世",
          "燃笔"
        ],
        "motif": "开新",
        "tone": "飞扬",
        "text": "旧格已熟，新声遂能从万卷之间生出。"
      }
    ],
    "titles": [
      {
        "id": "title_road",
        "text": "一程入墨",
        "motifs": [
          "启程",
          "行旅",
          "开境"
        ]
      },
      {
        "id": "title_heart",
        "text": "问心成章",
        "motifs": [
          "自问",
          "持守",
          "照心"
        ]
      },
      {
        "id": "title_people",
        "text": "人间行卷",
        "motifs": [
          "同行",
          "留情",
          "应世",
          "担当"
        ]
      },
      {
        "id": "title_wind",
        "text": "长风有信",
        "themes": [
          "biansai",
          "shanshui"
        ]
      },
      {
        "id": "title_old",
        "text": "与古同席",
        "themes": [
          "huaigu"
        ],
        "motifs": [
          "问古",
          "辨古",
          "承续"
        ]
      },
      {
        "id": "title_season",
        "text": "风候入笺",
        "themes": [
          "jieling"
        ]
      },
      {
        "id": "title_object",
        "text": "一物见心",
        "themes": [
          "yongwu"
        ]
      },
      {
        "id": "title_parting",
        "text": "此去有声",
        "themes": [
          "songbie"
        ]
      },
      {
        "id": "title_palace",
        "text": "金殿留墨",
        "endings": [
          "jinbang"
        ]
      },
      {
        "id": "title_unfinished",
        "text": "余墨待春",
        "endings": [
          "turnlimit",
          "fengbi"
        ]
      },
      {
        "id": "title_own",
        "text": "自有来路",
        "endings": [
          "palace",
          "secret_loss"
        ]
      },
      {
        "id": "title_taoyuan",
        "text": "万卷归心",
        "endings": [
          "taoyuan"
        ]
      },
      {
        "id": "title_scroll",
        "text": "此局成卷",
        "weight": 1
      }
    ],
    "endings": {
      "jinbang": {
        "line": "金殿收卷时，来路仍在墨中。",
        "seal": "金榜题名"
      },
      "palace": {
        "line": "未署榜首之名，也已写成自己的来路。",
        "seal": "行卷有痕"
      },
      "turnlimit": {
        "line": "时辰催卷，未尽之意留待来日。",
        "seal": "余墨待续"
      },
      "fengbi": {
        "line": "灵思暂歇，纸上所得仍可珍藏。",
        "seal": "墨意犹存"
      },
      "taoyuan": {
        "line": "万卷归心之后，脚下的路不再由棋盘标明。",
        "seal": "桃源出卷"
      },
      "secret_loss": {
        "line": "金榜已定，桃源一问留待下卷。",
        "seal": "花笺留问"
      },
      "default": {
        "line": "一局既终，沿途取舍都已成章。",
        "seal": "此卷已成"
      }
    },
    "noteFallback": "一路所得没有另立库存，都已收进这几句里。"
  },
  "lap2Intro": {
    "title": "会试圈 · 再入科场",
    "text": "童生圈的试炼渐远，你已不再只是初入科场的稚子。\n\n棋盘上的路重新展开，题目更深，对手也将换作秀才与举人之间的较量。前方的每一步，都在检验十年寒窗积下的根基。\n\n收束心神，继续向前；待绕过会试圈，金殿之门便会在尽头开启。",
    "button": "进入会试圈"
  },
  "hiddenFinal": {
    "invite": {
      "kind": "桃 源 终 卷",
      "title": "金榜之外，尚有一问",
      "text": "主考官搁下朱笔，殿门外忽有桃花逆风而开。花影深处，一条从未见过的小径浮出水面。旧日那句“待到种种妄念破灭，自可殿试见我”又在心头响起。若循花而去，金榜仍归于你；只是终圈尽头，还有桃花仙人陈之微等你交最后一卷。",
      "enterButton": "循花入终圈",
      "declineButton": "止步金榜"
    },
    "victory": {
      "kind": "桃 花 仙 人",
      "title": "此心已过万重山",
      "text": "陈之微看罢你的终卷，将笔轻轻搁在桃枝旁。漫天花影像旧梦一样碎开，又在你身后重合。\n\n“功名不过一纸。能收万卷于胸中，又不为万卷所役，方算真正走出桃源。”\n\n他折下一枝桃花递来。你回首望去，童生铺、三重科场与金殿都已缩成水面上的一点灯火；而脚下的路，第一次不再由棋盘替你标明。",
      "button": "携一枝桃花归去"
    },
    "defeat": {
      "kind": "桃 源 留 问",
      "title": "终卷未竟",
      "text": "陈之微拂去卷角的一点落花，并未收走你的金榜。\n\n“你已能胜人，却还未尽胜旧日之己。此问不必今日作答。”\n\n桃径在身后缓缓隐去，最后一瓣花落入袖中。终圈仍在那里，等下一次更从容的来路。",
      "button": "记下此问"
    }
  }
};
