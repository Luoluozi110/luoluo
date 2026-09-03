/* 文心棋游戏原始文心（config/talents.json）。作为编辑器默认种子数据。由游戏配置同步生成，请勿手工改动 —— 在编辑器内管理后导出即可覆盖。 */window.GAME_TALENTS = [
  {
    "id": "T001",
    "name": "斗酒诗百篇",
    "kind": "passive",
    "text": "「李白斗酒诗百篇，长安市上酒家眠。」——杜甫《饮中八仙歌》。以诗出战获胜时，诗力额外 +2。",
    "effect": {
      "type": "on_win_bonus",
      "style": "shi",
      "value": 2
    },
    "school": "shixian"
  },
  {
    "id": "T002",
    "name": "倚声填词",
    "kind": "passive",
    "text": "词本倚声而作，先有腔调后有文字。填词日久，声律入骨——以词出战获胜时，词力额外 +2。",
    "effect": {
      "type": "on_win_bonus",
      "style": "ci",
      "value": 2
    },
    "school": "cizong"
  },
  {
    "id": "T003",
    "name": "对对如流",
    "kind": "passive",
    "text": "属对之才，出口成双。相传解缙幼时应对如流，一座皆惊——以联出战获胜时，联力额外 +2。",
    "effect": {
      "type": "on_win_bonus",
      "style": "lian",
      "value": 2
    },
    "school": "liansheng"
  },
  {
    "id": "T004",
    "name": "博览",
    "kind": "passive",
    "text": "「读书破万卷，下笔如有神。」——杜甫《奉赠韦左丞丈二十二韵》。腹笥既广，学力常驻 +3。",
    "effect": {
      "type": "attr_flat",
      "attrs": {
        "xue": 3
      },
      "value": 3
    },
    "school": "tongru"
  },
  {
    "id": "T005",
    "name": "急智",
    "kind": "passive",
    "text": "临场生风，机锋不落。首骰为 1—2 点时，首枚续掷少耗 2 灵感；该枚续骰若为 5—6 点，作品得分 +10%。低开而能翻盘，方见机锋。",
    "effect": {
      "type": "dice_pattern",
      "pattern": "low_then_high",
      "lowMax": 2,
      "nextHighMin": 5,
      "value": 0.1,
      "conditionalFirstCostDiscount": 2
    },
    "school": "qishi"
  },
  {
    "id": "T006",
    "name": "入木三分",
    "kind": "passive",
    "text": "相传王羲之题字于木，工人削之，墨迹入木三分。笔力常驻 +3。",
    "effect": {
      "type": "attr_flat",
      "attrs": {
        "bi": 3
      }
    }
  },
  {
    "id": "T007",
    "name": "梦笔生花",
    "kind": "passive",
    "text": "五代王仁裕《开元天宝遗事》载：李白少时梦所用之笔头上生花，此后天才赡逸，名闻天下。每枚最终为 6 点的灵感骰令作品得分 +8%。",
    "effect": {
      "type": "dice_pattern",
      "pattern": "six",
      "value": 0.08
    }
  },
  {
    "id": "T008",
    "name": "推敲",
    "kind": "passive",
    "text": "贾岛于驴背上吟「僧敲月下门」，「推」「敲」难定，冲撞韩愈仪仗；韩愈曰：作敲字佳。字字斟酌，思力常驻 +3。",
    "effect": {
      "type": "attr_flat",
      "attrs": {
        "si": 3
      }
    }
  },
  {
    "id": "T009",
    "name": "囊萤映雪",
    "kind": "passive",
    "text": "晋人车胤囊萤照读，孙康映雪读书。贫不废学，学力常驻 +3。",
    "effect": {
      "type": "attr_flat",
      "attrs": {
        "xue": 3
      }
    }
  },
  {
    "id": "T010",
    "name": "天马行空",
    "kind": "passive",
    "text": "笔势腾踔，不拘辙迹。首枚续掷少耗 2 灵感；收笔时三枚灵感骰点数各不相同，作品得分 +15%，并得残页 0.5（每场一次）。",
    "effect": {
      "type": "dice_pattern",
      "pattern": "all_distinct",
      "minDice": 3,
      "value": 0.15,
      "firstCostDiscount": 2,
      "reward": {
        "type": "fragment",
        "value": 0.5,
        "perMatch": false
      }
    }
  },
  {
    "id": "T011",
    "name": "知人论世",
    "kind": "passive",
    "text": "「颂其诗，读其书，不知其人可乎？是以论其世也。」——《孟子·万章下》。深谙题材与风格之配，自动获得对手所选风格的相性加成。",
    "effect": {
      "type": "copy_affinity",
      "ratio": 0.8
    }
  },
  {
    "id": "T012",
    "name": "李杜文章",
    "kind": "passive",
    "text": "「李杜文章在，光焰万丈长。」——韩愈《调张籍》。以诗出战获胜时，诗力额外 +3。需先有「浪漫主义」倾向。",
    "effect": {
      "type": "on_win_bonus",
      "style": "shi",
      "value": 3
    }
  },
  {
    "id": "T013",
    "name": "凡有井水处",
    "kind": "passive",
    "text": "南宋叶梦得《避暑录话》载：凡有井水饮处，即能歌柳词。以词出战获胜时，词力额外 +3。需先有「婉约派」倾向 ×2。",
    "effect": {
      "type": "on_win_bonus",
      "style": "ci",
      "value": 3
    }
  },
  {
    "id": "T014",
    "name": "铁板铜琶",
    "kind": "passive",
    "text": "俞文豹《吹剑续录》载幕士评东坡词：须关西大汉，执铁板，唱「大江东去」。以联出战获胜时，联力额外 +3。需先有「豪放派」倾向。",
    "effect": {
      "type": "on_win_bonus",
      "style": "lian",
      "value": 3
    }
  },
  {
    "id": "T015",
    "name": "不平则鸣",
    "kind": "passive",
    "text": "「大凡物不得其平则鸣。」——韩愈《送孟东野序》。灵感不高于 14 时，胸中块垒尽发，本场得分 +16%。需先有「哲思派」倾向。",
    "effect": {
      "type": "comeback",
      "threshold": 14,
      "value": 0.16
    }
  },
  {
    "id": "T016",
    "name": "文思泉涌",
    "kind": "passive",
    "text": "思若泉涌，源源不绝。首枚续掷少耗 1 灵感；每枚续骰严格高于前骰时，每次递升得分 +5%；收笔时三骰连升另 +10%，并得 1 灵感（每场一次）。",
    "effect": {
      "type": "dice_pattern",
      "pattern": "ascending",
      "minDice": 2,
      "perStepValue": 0.05,
      "fullDice": 3,
      "fullValue": 0.1,
      "firstCostDiscount": 1,
      "fullReward": {
        "type": "inspiration",
        "value": 1,
        "perMatch": false
      }
    }
  },
  {
    "id": "T099",
    "name": "三元及第",
    "kind": "passive",
    "text": "解元、会元、状元连中三元，本朝数百年不过数人。图鉴「连中三元」解锁后可装配：殿试三场得分各 +15%，并于入场时恢复 4 灵感。",
    "effect": {
      "type": "palace_pct",
      "value": 0.15,
      "startInspiration": 4
    },
    "source": "album"
  },
  {
    "id": "TA01",
    "name": "七步成诗",
    "kind": "passive",
    "text": "《世说新语·文学》载曹植七步成诗：「本自同根生，相煎何太急。」被动生效；不论骰子枚数，只要本场灵感骰点数总和为 7 的倍数，作品得分 +18%，并得 1 心得（每场一次）。",
    "effect": {
      "type": "dice_pattern",
      "pattern": "total_multiple",
      "multiple": 7,
      "value": 0.18,
      "reward": {
        "type": "insight",
        "value": 1,
        "perMatch": false
      }
    }
  },
  {
    "id": "TA02",
    "name": "夺胎换骨",
    "kind": "active",
    "text": "惠洪《冷斋夜话》记黄庭坚论诗：不易其意而造其语，谓之换骨法；窥入其意而形容之，谓之夺胎法。本场窥敌之技，暂借对手招牌之强为我所用——敌愈强，此招愈利。",
    "effect": {
      "type": "borrow_signature",
      "fraction": 0.3
    },
    "cost": 3
  },
  {
    "id": "TA03",
    "name": "语不惊人",
    "kind": "active",
    "text": "「为人性僻耽佳句，语不惊人死不休。」——杜甫《江上值水如海势聊短述》。本场每枚 5—6 点骰令得分 +14%，每枚 1—2 点骰令得分 −7%。",
    "effect": {
      "type": "dice_pattern",
      "pattern": "extremes",
      "highMin": 5,
      "highValue": 0.14,
      "lowMax": 2,
      "lowValue": -0.07
    },
    "cost": 4
  },
  {
    "id": "TA04",
    "name": "笔落惊风雨",
    "kind": "active",
    "text": "「笔落惊风雨，诗成泣鬼神。」——杜甫《寄李十二白二十韵》。本场每枚最终为 6 点的灵感骰令作品得分 +14%。",
    "effect": {
      "type": "dice_pattern",
      "pattern": "six",
      "value": 0.14
    },
    "cost": 3
  },
  {
    "id": "TA05",
    "name": "一气呵成",
    "kind": "active",
    "text": "行文如一线贯珠，中无断续。支付首枚续掷后，自动续得第二枚骰（不再消耗灵感）；若自动骰不低于首枚续骰，作品得分再 +4%。",
    "effect": {
      "type": "extra_dice_chain",
      "compare": "not_lower",
      "value": 0.14,
      "cost": 2,
      "refund": 1
    },
    "cost": 2
  },
  {
    "id": "TA06",
    "name": "倚马可待",
    "kind": "active",
    "text": "《世说新语·文学》载袁虎倚马前，须臾作露布文七纸，殊可观。以三骰收笔时，总点至少 12 得分 +16% 并返还 3 灵感；达到 16 点则改为 +30%。未达标则徒耗锋芒。",
    "effect": {
      "type": "dice_pattern",
      "pattern": "total_tiers",
      "tiers": [
        {
          "threshold": 16,
          "value": 0.3,
          "reward": {
            "type": "inspiration",
            "value": 3,
            "perMatch": false
          }
        },
        {
          "threshold": 12,
          "value": 0.16,
          "reward": {
            "type": "inspiration",
            "value": 3,
            "perMatch": false
          }
        }
      ]
    },
    "cost": 3
  },
  {
    "id": "TA07",
    "name": "点铁成金",
    "kind": "active",
    "text": "黄庭坚《答洪驹父书》：虽取古人之陈言入于翰墨，如灵丹一粒，点铁成金也。本场将一枚最低且不高于 2 点的灵感骰化为 6 点。",
    "effect": {
      "type": "dice_transform",
      "mode": "lowest_to",
      "maxPip": 2,
      "target": 6
    },
    "cost": 3
  },
  {
    "id": "TA08",
    "name": "布局谋篇",
    "kind": "active",
    "text": "胸中先有丘壑，落笔方能从容。发动后于回合掷移动骰前指定 1—6 格落点；本局每次再用，所耗灵感递增，谋定之后不可反悔。",
    "effect": {
      "type": "planned_dice",
      "baseCost": 4,
      "costStep": 2,
      "maxValue": 6,
      "cost": 4
    },
    "cost": 4
  },
  {
    "id": "T017",
    "name": "春风得意",
    "kind": "passive",
    "text": "孟郊《登科后》：「春风得意马蹄疾，一日看尽长安花。」少年得志，意气风发——每场论战取胜，灵感 +2。",
    "effect": {
      "type": "insp_on_win",
      "value": 2
    }
  },
  {
    "id": "T018",
    "name": "曲水流觞",
    "kind": "passive",
    "text": "王羲之《兰亭集序》载：引以为流觞曲水，列坐其次。雅集唱和，从容不迫——与对手平分秋色时，出战文体额外 +3。",
    "effect": {
      "type": "draw_bonus",
      "value": 3
    }
  },
  {
    "id": "T019",
    "name": "洛阳纸贵",
    "kind": "passive",
    "text": "《晋书·左思传》：洛阳为之纸贵。一篇既出，士林争传，声名回响不断——灵感低于上限 50% 时，每回合恢复 1；每获得一枚新文心再恢复 2。",
    "effect": {
      "type": "insp_turn_regen",
      "value": 1,
      "thresholdRatio": 0.5,
      "onTalent": 2
    }
  },
  {
    "id": "T020",
    "name": "诗骨嶙峋",
    "kind": "passive",
    "text": "「为人性僻耽佳句，语不惊人死不休。」——杜甫《江上值水如海势聊短述》。诗乃风骨所寄，以诗出战，作品得分常驻 +10%。",
    "effect": {
      "type": "style_pct",
      "style": "shi",
      "value": 0.1,
      "singleDieBonus": 0
    }
  },
  {
    "id": "T021",
    "name": "咏物通灵",
    "kind": "passive",
    "text": "「体物之工，穷情写貌。」咏物一题，体察入微，形神兼备——出战「咏物」题材时得分 +15%。",
    "effect": {
      "type": "theme_pct",
      "theme": "yongwu",
      "value": 0.15
    }
  },
  {
    "id": "T022",
    "name": "一鼓作气",
    "kind": "passive",
    "text": "《左传·庄公十年》：夫战，勇气也。一鼓作气，再而衰，三而竭。气势连捷的收益 ×1.4，越连捷越凌厉。",
    "effect": {
      "type": "streak_mult",
      "value": 0.4
    }
  },
  {
    "id": "T023",
    "name": "退笔成冢",
    "kind": "passive",
    "text": "智永居永欣寺三十年，临书不退，笔头委积，埋之为冢——积学既深，虽江郎才尽亦有余勇。每场结算后灵感补足至 16，不致骤然封笔。",
    "effect": {
      "type": "insp_floor",
      "value": 16
    }
  },
  {
    "id": "T024",
    "name": "六六大顺",
    "kind": "passive",
    "text": "「六」者，顺也。灵感骰若掷出六点，灵思沛然，本场得分 ×1.25。",
    "effect": {
      "type": "lucky_six",
      "mult": 1.25
    }
  },
  {
    "id": "T025",
    "name": "破釜沉舟",
    "kind": "passive",
    "text": "《史记·项羽本纪》：皆沉船，破釜甑，烧庐舍，持三日粮，以示士卒必死，无一还心。灵感 ≤12 的绝境中，背水一战，本场得分 +12%。",
    "effect": {
      "type": "comeback",
      "value": 0.12,
      "threshold": 12
    }
  },
  {
    "id": "T026",
    "name": "学富五车",
    "kind": "passive",
    "text": "《庄子·天下》：惠施多方，其书五车。腹笥越厚，下笔越雄——每拥有 3 枚文心，六维算分属性临时 +4%。",
    "effect": {
      "type": "armory_pct",
      "step": 3,
      "value": 0.04,
      "cap": 0.12
    }
  },
  {
    "id": "T027",
    "name": "转益多师",
    "kind": "passive",
    "text": "杜甫《戏为六绝句》：转益多师是汝师。败于名家而有所悟，平局亦能取法——「败中有得」「平分秋色」的补偿属性额外 +2，下一场得分 +4%。",
    "effect": {
      "type": "study_bonus",
      "value": 2,
      "nextBattlePct": 0.04
    }
  },
  {
    "id": "T028",
    "name": "金殿对策",
    "kind": "passive",
    "text": "殿试策问，临轩而试。金殿之上从容奏对——进入殿试先恢复 4 灵感，殿试每场开场再恢复 3。",
    "effect": {
      "type": "palace_insp",
      "value": 3,
      "startValue": 4,
      "scorePct": 0
    }
  },
  {
    "id": "T029",
    "name": "胸有成竹",
    "kind": "passive",
    "text": "苏轼《文与可画筼筜谷偃竹记》：故画竹必先得成竹于胸中。谋定后动，临阵不慌——持有时，每个回合开始恢复 1 点灵感。",
    "effect": {
      "type": "insp_turn_regen",
      "value": 1,
      "thresholdRatio": 0.5
    }
  },
  {
    "id": "T030",
    "name": "活水源头",
    "kind": "passive",
    "text": "朱熹《观书有感》：“问渠那得清如许？为有源头活水来。”每次答对考题或完成创作抉择，灵感额外 +2；每局最多触发 4 次。",
    "effect": {
      "type": "insp_on_quiz",
      "value": 2,
      "maxTriggers": 4
    },
    "acquire": {
      "minTurn": 6
    },
    "acquireText": "第 6 回合后进入随机文心池。"
  },
  {
    "id": "T031",
    "name": "枯木逢春",
    "kind": "passive",
    "text": "枯木经霜，春来更发新枝。每场论战全部结算后，若灵感不高于 16，则恢复 3 点；每局最多触发 3 次。",
    "effect": {
      "type": "insp_battle_recover",
      "value": 3,
      "threshold": 16,
      "maxTriggers": 3
    },
    "acquire": {
      "minTurn": 10,
      "maxInspiration": 18
    },
    "acquireText": "第 10 回合后，且当前灵感不高于 18 时进入随机文心池。"
  },
  {
    "id": "T032",
    "name": "蓄水成渊",
    "kind": "passive",
    "text": "涓流不拒，积而成渊。获得时，本局灵感上限永久 +8，并补充 4 灵感；与「海纳百川」互斥，且扩容只结算一次。",
    "effect": {
      "type": "insp_max",
      "value": 8,
      "group": "inspiration_capacity",
      "fillRatio": 0.5
    },
    "acquire": {
      "minTurn": 12,
      "minTalents": 3,
      "excludeFlag": "inspiration_capacity"
    },
    "acquireText": "第 12 回合后、已持有至少 3 枚文心且本局尚未获得扩容文心时进入随机池。"
  },
  {
    "id": "T033",
    "name": "海纳百川",
    "kind": "passive",
    "text": "《文心雕龙》言“操千曲而后晓声，观千剑而后识器”。获得时，本局灵感上限永久 +14，并补充 7 灵感；与「蓄水成渊」互斥，且扩容只结算一次。",
    "effect": {
      "type": "insp_max",
      "value": 14,
      "group": "inspiration_capacity",
      "fillRatio": 0.5
    },
    "acquire": {
      "phase": "lap2",
      "minWins": 5,
      "excludeFlag": "inspiration_capacity"
    },
    "acquireText": "进入第二圈且累计至少 5 胜，本局尚未获得扩容文心时进入随机池。"
  },
  {
    "id": "T035",
    "name": "删繁就简",
    "kind": "passive",
    "text": "郑板桥题画有言：删繁就简三秋树，领异标新二月花。只以一枚灵感骰收笔时，作品得分 +12%，战后心得额外 +1。",
    "effect": {
      "type": "dice_pattern",
      "pattern": "single",
      "value": 0.12,
      "reward": {
        "type": "insight",
        "value": 1,
        "perMatch": false
      }
    }
  },
  {
    "id": "T036",
    "name": "字字珠玑",
    "kind": "passive",
    "text": "字字圆转，句句有光。若本场全部灵感骰最终均不低于 4 点，作品得分 +10%，并额外沉淀 1 份残页。",
    "effect": {
      "type": "dice_pattern",
      "pattern": "all_high",
      "minPip": 4,
      "value": 0.1,
      "reward": {
        "type": "fragment",
        "value": 1,
        "perMatch": false
      }
    }
  },
  {
    "id": "T037",
    "name": "触类旁通",
    "kind": "passive",
    "text": "《周易·系辞》言：引而伸之，触类而长之。若本场改用不同于上一场的文体，作品得分 +8%，战后心得额外 +1。",
    "effect": {
      "type": "style_switch_pct",
      "value": 0.08,
      "insight": 1
    }
  },
  {
    "id": "T038",
    "name": "落笔成章",
    "kind": "passive",
    "text": "胸中已有篇章，落笔自见经营。每持有 2 页稿本，作品得分 +3%，最多 +15%。",
    "effect": {
      "type": "manuscript_pct",
      "step": 2,
      "value": 0.03,
      "cap": 0.15
    }
  },
  {
    "id": "T039",
    "name": "同声相应",
    "kind": "passive",
    "text": "《周易·乾》言：同声相应，同气相求。若骰组中出现同点灵感骰，作品得分 +8%，战后返还 1 点灵感。",
    "effect": {
      "type": "dice_pattern",
      "pattern": "pair",
      "value": 0.08,
      "reward": {
        "type": "inspiration",
        "value": 1,
        "perMatch": false
      }
    }
  },
  {
    "id": "T040",
    "name": "妙手偶得",
    "kind": "passive",
    "text": "陆游诗云：文章本天成，妙手偶得之。本场首次出现最终为 6 点的灵感骰时，作品得分 +8%，并额外沉淀 1 份残页（每场一次）。",
    "effect": {
      "type": "dice_pattern",
      "pattern": "six",
      "value": 0.08,
      "reward": {
        "type": "fragment",
        "value": 1,
        "perMatch": false
      }
    }
  },
  {
    "id": "T034",
    "name": "照我传灯",
    "kind": "passive",
    "text": "殿试结束后，你竟褪却了官服，到寺庙中过上了青灯古佛的生活，日日抄经读史。有一天，你在打扫牌匾时，发现牌匾后的卷轴，上面写着这样一副对联：\n燕子去无踪，惟余萝月半林，留人古寺；\n龙华会有果，好借蒲团一座，照我传灯。\n随即，白光闪出，你眼前一亮，回到了还是童生的那个时刻……",
    "effect": {
      "type": "reincarnate",
      "inspThreshold": 40,
      "attrRatio": 0.8,
      "startInspiration": 8
    }
  }
];
