/* 游戏原始羁绊数据（作为编辑器默认种子；与 config/synergies.json 保持一致）。 */window.GAME_SYNERGIES = [
  {
    "id": "S01",
    "name": "诗酒剑气",
    "members": [
      "T001",
      "T007"
    ],
    "desc": "诗势与梦笔交映：诗体得分 +10%；出现六点再 +6%。",
    "effects": [
      {
        "effectId": "S01-E1",
        "stackGroup": "synergy-score",
        "stackMode": "add",
        "type": "style_pct",
        "style": "shi",
        "value": 1000
      },
      {
        "effectId": "S01-E2",
        "stackGroup": "synergy-score",
        "stackMode": "add",
        "type": "dice_pattern",
        "pattern": "six",
        "value": 600
      }
    ]
  },
  {
    "id": "S02",
    "name": "倚声双绝",
    "members": [
      "T002",
      "T006"
    ],
    "desc": "倚声入骨：词体得分 +8%；以词获胜时词力额外 +3。",
    "effects": [
      {
        "effectId": "S02-E1",
        "stackGroup": "synergy-score",
        "stackMode": "add",
        "type": "style_pct",
        "style": "ci",
        "value": 800
      },
      {
        "effectId": "S02-E2",
        "stackGroup": "synergy-score",
        "stackMode": "add",
        "type": "on_win_bonus",
        "style": "ci",
        "value": 30
      }
    ]
  },
  {
    "id": "S03",
    "name": "联坛霸才",
    "members": [
      "T003",
      "T010"
    ],
    "desc": "机锋不拘：联体得分 +10%；三枚及以上点数各异再 +8%。",
    "effects": [
      {
        "effectId": "S03-E1",
        "stackGroup": "synergy-score",
        "stackMode": "add",
        "type": "style_pct",
        "style": "lian",
        "value": 1000
      },
      {
        "effectId": "S03-E2",
        "stackGroup": "synergy-score",
        "stackMode": "add",
        "type": "dice_pattern",
        "pattern": "all_distinct",
        "minDice": 3,
        "value": 800
      }
    ]
  },
  {
    "id": "S04",
    "name": "思涌笔健",
    "members": [
      "T016",
      "T005"
    ],
    "desc": "多骰得分 +3%；骰面先低后高时再 +16%，首枚额外骰费用 -1。",
    "effects": [
      {
        "effectId": "S04-E1",
        "stackGroup": "synergy-score",
        "stackMode": "add",
        "type": "extra_dice_pct",
        "value": 300,
        "firstCostDiscount": 10
      },
      {
        "effectId": "S04-E2",
        "stackGroup": "synergy-score",
        "stackMode": "add",
        "type": "dice_pattern",
        "pattern": "low_then_high",
        "value": 1600
      }
    ]
  },
  {
    "id": "S05",
    "name": "通儒蕴藉",
    "members": [
      "T004",
      "T009"
    ],
    "desc": "学养深厚：论战得分 +8%；有效答题回复 1 灵感（每局 3 次）。",
    "effects": [
      {
        "effectId": "S05-E1",
        "stackGroup": "synergy-score",
        "stackMode": "add",
        "type": "syn_pct",
        "value": 800
      },
      {
        "effectId": "S05-E2",
        "stackGroup": "synergy-score",
        "stackMode": "add",
        "type": "insp_on_quiz",
        "value": 10,
        "maxTriggers": 3
      }
    ]
  },
  {
    "id": "S06",
    "name": "文运亨通",
    "members": [
      "T017",
      "T018"
    ],
    "desc": "获胜回复 2 灵感；上一场未胜时，本场得分 +8%。",
    "effects": [
      {
        "effectId": "S06-E1",
        "stackGroup": "synergy-score",
        "stackMode": "add",
        "type": "insp_on_win",
        "value": 20
      },
      {
        "effectId": "S06-E2",
        "stackGroup": "synergy-score",
        "stackMode": "add",
        "type": "battle_history_pct",
        "result": "nonwin",
        "value": 800
      }
    ]
  },
  {
    "id": "S07",
    "name": "梦笔泉涌",
    "members": [
      "T007",
      "T016"
    ],
    "desc": "出现六点得分 +6%；骰面严格递增时再 +16%。",
    "effects": [
      {
        "effectId": "S07-E1",
        "stackGroup": "synergy-score",
        "stackMode": "add",
        "type": "dice_pattern",
        "pattern": "six",
        "value": 600
      },
      {
        "effectId": "S07-E2",
        "stackGroup": "synergy-score",
        "stackMode": "add",
        "type": "dice_pattern",
        "pattern": "ascending",
        "value": 1600
      }
    ]
  },
  {
    "id": "S08",
    "name": "笔墨相宣",
    "members": [
      "T006",
      "T008"
    ],
    "desc": "笔力与思力交润，论战得分 +10%。",
    "effects": [
      {
        "effectId": "S08-E1",
        "stackGroup": "synergy-score",
        "stackMode": "add",
        "type": "syn_pct",
        "value": 1000
      }
    ]
  },
  {
    "id": "S09",
    "name": "洛阳才调",
    "members": [
      "T017",
      "T019"
    ],
    "desc": "灵感不低于上限 60% 时，论战得分 +10%。",
    "effects": [
      {
        "effectId": "S09-E1",
        "stackGroup": "synergy-score",
        "stackMode": "add",
        "type": "syn_pct",
        "value": 1000,
        "when": {
          "inspirationRatioMin": 6000
        }
      }
    ]
  },
  {
    "id": "S10",
    "name": "梦花偶得",
    "members": [
      "T007",
      "T040"
    ],
    "desc": "出现六点时得分 +10%，并获得 1 页稿本。",
    "effects": [
      {
        "effectId": "S10-E1",
        "stackGroup": "synergy-score",
        "stackMode": "add",
        "type": "dice_pattern",
        "pattern": "six",
        "value": 1000,
        "reward": {
          "type": "fragment",
          "value": 1000,
          "perMatch": false
        }
      }
    ]
  },
  {
    "id": "S11",
    "name": "七步珠玑",
    "members": [
      "TA01",
      "T036"
    ],
    "desc": "骰点总和为 7 的倍数时，得分 +16%，并获得 2 点心得。",
    "effects": [
      {
        "effectId": "S11-E1",
        "stackGroup": "synergy-score",
        "stackMode": "add",
        "type": "dice_pattern",
        "pattern": "total_multiple",
        "divisor": 7,
        "value": 1600,
        "reward": {
          "type": "insight",
          "value": 20,
          "perMatch": false
        }
      }
    ]
  },
  {
    "id": "S12",
    "name": "绝处逢春",
    "members": [
      "T025",
      "T031"
    ],
    "desc": "灵感不高于 16 时得分 +14%；战后回复 3 灵感（每局 3 次）。",
    "effects": [
      {
        "effectId": "S12-E1",
        "stackGroup": "synergy-score",
        "stackMode": "add",
        "type": "comeback",
        "threshold": 160,
        "value": 1400
      },
      {
        "effectId": "S12-E2",
        "stackGroup": "synergy-score",
        "stackMode": "add",
        "type": "insp_battle_recover",
        "threshold": 160,
        "value": 30,
        "maxTriggers": 3
      }
    ]
  },
  {
    "id": "S13",
    "name": "换笔成章",
    "members": [
      "T037",
      "TA02"
    ],
    "desc": "换用文体时得分 +14%，并获得 2 点心得。",
    "effects": [
      {
        "effectId": "S13-E1",
        "stackGroup": "synergy-score",
        "stackMode": "add",
        "type": "style_switch_pct",
        "value": 1400,
        "insight": 2
      }
    ]
  },
  {
    "id": "S14",
    "name": "稿本生辉",
    "members": [
      "T038",
      "T040"
    ],
    "desc": "每 2 页稿本得分 +3%，最多 +18%。",
    "effects": [
      {
        "effectId": "S14-E1",
        "stackGroup": "synergy-score",
        "stackMode": "add",
        "type": "manuscript_pct",
        "step": 2,
        "value": 300,
        "cap": 1800
      }
    ]
  },
  {
    "id": "S15",
    "name": "连捷成章",
    "members": [
      "T039",
      "T022"
    ],
    "desc": "同文体连捷 2 场后得分 +14%；出现对子回复 2 灵感。",
    "effects": [
      {
        "effectId": "S15-E1",
        "stackGroup": "synergy-score",
        "stackMode": "add",
        "type": "streak_pct",
        "minStreak": 2,
        "value": 1400
      },
      {
        "effectId": "S15-E2",
        "stackGroup": "synergy-score",
        "stackMode": "add",
        "type": "dice_pattern",
        "pattern": "pair",
        "value": 0,
        "reward": {
          "type": "inspiration",
          "value": 20,
          "perMatch": false
        }
      }
    ]
  },
  {
    "id": "S16",
    "name": "殿前蓄势",
    "members": [
      "T028",
      "T099"
    ],
    "desc": "殿试每场回复 4 灵感，入场时先回复 5 灵感；殿试得分 +8%。",
    "effects": [
      {
        "effectId": "S16-E1",
        "stackGroup": "synergy-score",
        "stackMode": "add",
        "type": "palace_insp",
        "value": 40,
        "startValue": 50
      },
      {
        "effectId": "S16-E2",
        "stackGroup": "synergy-score",
        "stackMode": "add",
        "type": "palace_pct",
        "value": 800
      }
    ]
  },
  {
    "id": "S17",
    "name": "问学相长",
    "members": [
      "T030",
      "T009"
    ],
    "desc": "有效答题回复 2 灵感（每局 5 次）。",
    "effects": [
      {
        "effectId": "S17-E1",
        "stackGroup": "synergy-score",
        "stackMode": "add",
        "type": "insp_on_quiz",
        "value": 20,
        "maxTriggers": 5
      }
    ]
  },
  {
    "id": "S18",
    "name": "诗胆雄心",
    "members": [
      "T020",
      "T021"
    ],
    "desc": "以诗出战且选择勇武时得分 +18%，触发后获得 1 页稿本。",
    "effects": [
      {
        "effectId": "S18-E1",
        "stackGroup": "synergy-score",
        "stackMode": "add",
        "type": "style_pct",
        "style": "shi",
        "value": 1800,
        "when": {
          "themes": [
            "yongwu"
          ]
        },
        "reward": {
          "type": "fragment",
          "value": 1000,
          "perMatch": false
        }
      }
    ]
  },
  {
    "id": "S19",
    "name": "六曜回响",
    "members": [
      "T024",
      "TA07"
    ],
    "desc": "使用指定文心后，出现六点得分 +16%，并回复 1 灵感。",
    "effects": [
      {
        "effectId": "S19-E1",
        "stackGroup": "synergy-score",
        "stackMode": "add",
        "type": "dice_pattern",
        "pattern": "six",
        "value": 1600,
        "when": {
          "usedTalents": [
            "TA07"
          ]
        },
        "reward": {
          "type": "inspiration",
          "value": 10,
          "perMatch": false
        }
      }
    ]
  },
  {
    "id": "S20",
    "name": "连掷成势",
    "members": [
      "TA05",
      "TA06"
    ],
    "desc": "使用任一连骰文心后，总点≥12 得分 +12%，≥16 得分 +22%，并回复 2 灵感。",
    "effects": [
      {
        "effectId": "S20-E1",
        "stackGroup": "synergy-score",
        "stackMode": "add",
        "type": "dice_pattern",
        "pattern": "total_tiers",
        "tiers": [
          {
            "min": 12,
            "value": 1200
          },
          {
            "min": 16,
            "value": 2200
          }
        ],
        "when": {
          "usedAnyTalents": [
            "TA05",
            "TA06"
          ]
        },
        "reward": {
          "type": "inspiration",
          "value": 20,
          "perMatch": false
        }
      }
    ]
  },
  {
    "id": "S21",
    "name": "鉴古知今",
    "members": [
      "T011",
      "T027"
    ],
    "desc": "游学心得 +2；上一场未胜时本场得分 +12%。",
    "effects": [
      {
        "effectId": "S21-E1",
        "stackGroup": "synergy-score",
        "stackMode": "add",
        "type": "study_bonus",
        "value": 20,
        "nextBattlePct": 800
      },
      {
        "effectId": "S21-E2",
        "stackGroup": "synergy-score",
        "stackMode": "add",
        "type": "battle_history_pct",
        "result": "nonwin",
        "value": 1200
      }
    ]
  },
  {
    "id": "S22",
    "name": "百炼归真",
    "members": [
      "T026",
      "T034"
    ],
    "desc": "每 4 点兵器属性令得分 +3%，最多 +15%。",
    "effects": [
      {
        "effectId": "S22-E1",
        "stackGroup": "synergy-score",
        "stackMode": "add",
        "type": "armory_pct",
        "target": "score",
        "step": 4,
        "value": 300,
        "cap": 1500
      }
    ]
  },
  {
    "id": "S23",
    "name": "源流不息",
    "members": [
      "T032",
      "T029"
    ],
    "desc": "回合开始时若灵感低于 60%，回复 2 灵感。",
    "effects": [
      {
        "effectId": "S23-E1",
        "stackGroup": "synergy-score",
        "stackMode": "add",
        "type": "insp_turn_regen",
        "value": 20,
        "thresholdRatio": 6000
      }
    ]
  },
  {
    "id": "S24",
    "name": "诗魁殿声",
    "members": [
      "T099",
      "T012"
    ],
    "desc": "殿试以诗出战时得分 +18%；以诗获胜时诗力 +3。",
    "effects": [
      {
        "effectId": "S24-E1",
        "stackGroup": "synergy-score",
        "stackMode": "add",
        "type": "palace_pct",
        "value": 1800,
        "when": {
          "styles": [
            "shi"
          ]
        }
      },
      {
        "effectId": "S24-E2",
        "stackGroup": "synergy-score",
        "stackMode": "add",
        "type": "on_win_bonus",
        "style": "shi",
        "value": 30
      }
    ]
  },
  {
    "id": "S25",
    "name": "词联双璧",
    "members": [
      "T013",
      "T014"
    ],
    "desc": "在词、联之间换体时得分 +16%，并获得 2 点心得。",
    "effects": [
      {
        "effectId": "S25-E1",
        "stackGroup": "synergy-score",
        "stackMode": "add",
        "type": "style_switch_pct",
        "value": 1600,
        "insight": 2,
        "when": {
          "stylePair": [
            "ci",
            "lian"
          ]
        }
      }
    ]
  },
  {
    "id": "S26",
    "name": "守诺成势",
    "members": [
      "T041",
      "T022",
      "T039"
    ],
    "desc": "守诺与连捷彼此应和：同文风连捷达到 2 场后，作品得分 +10%。",
    "effects": [
      {
        "effectId": "S26-E1",
        "stackGroup": "synergy-resonance-v2",
        "stackMode": "max",
        "type": "streak_pct",
        "value": 1000,
        "minStreak": 2
      }
    ]
  },
  {
    "id": "S27",
    "name": "江湖换境",
    "members": [
      "T042",
      "T037",
      "TA02"
    ],
    "desc": "转身换境，旧意新辞：换用不同文体时得分 +12%，心得 +2。",
    "effects": [
      {
        "effectId": "S27-E1",
        "stackGroup": "synergy-resonance-v2",
        "stackMode": "max",
        "type": "style_switch_pct",
        "value": 1200,
        "insight": 2
      }
    ]
  },
  {
    "id": "S28",
    "name": "知己知彼",
    "members": [
      "T043",
      "T011",
      "T027"
    ],
    "desc": "识人亦能自省：上一场未胜时本场得分 +10%；败或平的研习额外 +1，下一场再 +6%。",
    "effects": [
      {
        "effectId": "S28-E1",
        "stackGroup": "synergy-resonance-v2",
        "stackMode": "max",
        "type": "battle_history_pct",
        "value": 1000,
        "condition": "previous_nonwin"
      },
      {
        "effectId": "S28-E2",
        "stackGroup": "synergy-growth",
        "stackMode": "max",
        "type": "study_bonus",
        "value": 10,
        "nextBattlePct": 600
      }
    ]
  },
  {
    "id": "S29",
    "name": "临渊止戈",
    "members": [
      "TA09",
      "T015",
      "T025"
    ],
    "desc": "绝境中解剑止戈：发动「杯酒解剑」且灵感不高于 16 时，本场得分 +14%。",
    "effects": [
      {
        "effectId": "S29-E1",
        "stackGroup": "synergy-resonance-v2",
        "stackMode": "max",
        "type": "comeback",
        "value": 1400,
        "threshold": 160,
        "when": {
          "usedTalents": [
            "TA09"
          ]
        }
      }
    ]
  },
  {
    "id": "S30",
    "name": "藏锋守简",
    "members": [
      "T044",
      "T035",
      "T023"
    ],
    "desc": "一骰收笔，守简蓄锋：仅用一枚骰时得分 +12%，并恢复 1 灵感。",
    "effects": [
      {
        "effectId": "S30-E1",
        "stackGroup": "synergy-resonance-v2",
        "stackMode": "max",
        "type": "dice_pattern",
        "value": 1200,
        "pattern": "single",
        "reward": {
          "type": "inspiration",
          "value": 10,
          "perMatch": false
        }
      }
    ]
  },
  {
    "id": "S31",
    "name": "轻骑生变",
    "members": [
      "T045",
      "T005",
      "T010"
    ],
    "desc": "轻骑追笔，低开高走：首骰低、续骰高时得分 +14%。",
    "effects": [
      {
        "effectId": "S31-E1",
        "stackGroup": "synergy-resonance-v2",
        "stackMode": "max",
        "type": "dice_pattern",
        "value": 1400,
        "pattern": "low_then_high",
        "lowMax": 2,
        "nextHighMin": 5
      }
    ]
  },
  {
    "id": "S32",
    "name": "残烽回春",
    "members": [
      "T046",
      "T018",
      "T031"
    ],
    "desc": "失意之后仍有烽火：上一场未胜时本场得分 +8%；战后灵感不高于 18 时恢复 3（每局 3 次）。",
    "effects": [
      {
        "effectId": "S32-E1",
        "stackGroup": "synergy-resonance-v2",
        "stackMode": "max",
        "type": "battle_history_pct",
        "value": 800,
        "condition": "previous_nonwin"
      },
      {
        "effectId": "S32-E2",
        "stackGroup": "synergy-recovery",
        "stackMode": "max",
        "type": "insp_battle_recover",
        "threshold": 180,
        "value": 30,
        "maxTriggers": 3
      }
    ]
  },
  {
    "id": "S33",
    "name": "成竹列阵",
    "members": [
      "TA10",
      "T032",
      "T029"
    ],
    "desc": "胸有成竹，临阵不乱：发动「背水列阵」时本场得分 +10%。",
    "effects": [
      {
        "effectId": "S33-E1",
        "stackGroup": "synergy-resonance-v2",
        "stackMode": "max",
        "type": "syn_pct",
        "value": 1000,
        "when": {
          "usedTalents": [
            "TA10"
          ]
        }
      }
    ]
  },
  {
    "id": "S34",
    "name": "坐忘定局",
    "members": [
      "T047",
      "T008",
      "TA08"
    ],
    "desc": "谋篇而不妄动：本场不发动论战主动文心时，作品得分 +10%。",
    "effects": [
      {
        "effectId": "S34-E1",
        "stackGroup": "synergy-resonance-v2",
        "stackMode": "max",
        "type": "restraint_pct",
        "value": 1000
      }
    ]
  },
  {
    "id": "S35",
    "name": "梦蝶偶得",
    "members": [
      "T048",
      "T007",
      "T040"
    ],
    "desc": "梦中首尾相照：骰组首尾同点时得分 +12%，并得 1 份残页。",
    "effects": [
      {
        "effectId": "S35-E1",
        "stackGroup": "synergy-resonance-v2",
        "stackMode": "max",
        "type": "dice_pattern",
        "value": 1200,
        "pattern": "first_last_equal",
        "minDice": 2,
        "reward": {
          "type": "fragment",
          "value": 1000,
          "perMatch": false
        }
      }
    ]
  },
  {
    "id": "S36",
    "name": "黑白惊锋",
    "members": [
      "T049",
      "TA03",
      "TA07"
    ],
    "desc": "黑白两极相激：骰组同时有低点与高点时得分 +14%，并恢复 1 灵感。",
    "effects": [
      {
        "effectId": "S36-E1",
        "stackGroup": "synergy-resonance-v2",
        "stackMode": "max",
        "type": "dice_pattern",
        "value": 1400,
        "pattern": "low_and_high",
        "lowMax": 2,
        "highMin": 5,
        "reward": {
          "type": "inspiration",
          "value": 10,
          "perMatch": false
        }
      }
    ]
  },
  {
    "id": "S37",
    "name": "斩妄惊雷",
    "members": [
      "TA11",
      "TA04",
      "T024"
    ],
    "desc": "斩妄见真后六曜惊雷：发动「斩妄见真」且骰组出现六点时，得分 +12%。",
    "effects": [
      {
        "effectId": "S37-E1",
        "stackGroup": "synergy-resonance-v2",
        "stackMode": "max",
        "type": "dice_pattern",
        "value": 1200,
        "pattern": "six",
        "when": {
          "usedTalents": [
            "TA11"
          ]
        }
      }
    ]
  },
  {
    "id": "S38",
    "name": "酒酣文章",
    "members": [
      "T001",
      "T012"
    ],
    "desc": "酒酣诗胆壮，李杜文章长：以诗出战得分 +8%。",
    "effects": [
      {
        "effectId": "S38-E1",
        "stackGroup": "synergy-resonance-v2",
        "stackMode": "max",
        "type": "style_pct",
        "value": 800,
        "style": "shi"
      }
    ]
  },
  {
    "id": "S39",
    "name": "声传井巷",
    "members": [
      "T002",
      "T013"
    ],
    "desc": "倚声入巷，清唱相传：以词获胜时词力额外 +2。",
    "effects": [
      {
        "effectId": "S39-E1",
        "stackGroup": "synergy-growth",
        "stackMode": "max",
        "type": "on_win_bonus",
        "style": "ci",
        "value": 20
      }
    ]
  },
  {
    "id": "S40",
    "name": "联珠铿锵",
    "members": [
      "T003",
      "T014"
    ],
    "desc": "出口成对，铁板铿锵：以联出战得分 +8%。",
    "effects": [
      {
        "effectId": "S40-E1",
        "stackGroup": "synergy-resonance-v2",
        "stackMode": "max",
        "type": "style_pct",
        "value": 800,
        "style": "lian"
      }
    ]
  },
  {
    "id": "S41",
    "name": "腹笥五车",
    "members": [
      "T004",
      "T026"
    ],
    "desc": "博览积为五车：每持有 3 枚文心，六维算分属性 +2%，最多 +6%。",
    "effects": [
      {
        "effectId": "S41-E1",
        "stackGroup": "synergy-resonance-v2",
        "stackMode": "max",
        "type": "armory_pct",
        "target": "attrs",
        "value": 200,
        "step": 3,
        "cap": 600
      }
    ]
  },
  {
    "id": "S42",
    "name": "七步一气",
    "members": [
      "TA01",
      "TA05"
    ],
    "desc": "七步之间一气成篇：发动「一气呵成」且总点为 7 的倍数时，得分 +10%。",
    "effects": [
      {
        "effectId": "S42-E1",
        "stackGroup": "synergy-resonance-v2",
        "stackMode": "max",
        "type": "dice_pattern",
        "value": 1000,
        "pattern": "total_multiple",
        "multiple": 7,
        "when": {
          "usedTalents": [
            "TA05"
          ]
        }
      }
    ]
  },
  {
    "id": "S43",
    "name": "高吟珠落",
    "members": [
      "TA06",
      "T036"
    ],
    "desc": "字字珠玑，倚马高吟：发动「倚马可待」时，总点 12 得分 +8%，总点 16 得分 +14%。",
    "effects": [
      {
        "effectId": "S43-E1",
        "stackGroup": "synergy-resonance-v2",
        "stackMode": "max",
        "type": "dice_pattern",
        "value": 0,
        "pattern": "total_tiers",
        "tiers": [
          {
            "threshold": 16,
            "value": 1400
          },
          {
            "threshold": 12,
            "value": 800
          }
        ],
        "when": {
          "usedTalents": [
            "TA06"
          ]
        }
      }
    ]
  },
  {
    "id": "S44",
    "name": "洛水活源",
    "members": [
      "T019",
      "T030"
    ],
    "desc": "活水流入洛阳纸：有效答题额外恢复 1 灵感，每局最多 4 次。",
    "effects": [
      {
        "effectId": "S44-E1",
        "stackGroup": "synergy-recovery",
        "stackMode": "max",
        "type": "insp_on_quiz",
        "value": 10,
        "maxTriggers": 4
      }
    ]
  },
  {
    "id": "S45",
    "name": "诗骨成章",
    "members": [
      "T020",
      "T038"
    ],
    "desc": "诗骨落为成章稿本：以诗出战时，每 2 页稿本得分 +2%，最多 +12%。",
    "effects": [
      {
        "effectId": "S45-E1",
        "stackGroup": "synergy-resonance-v2",
        "stackMode": "max",
        "type": "manuscript_pct",
        "value": 200,
        "step": 2,
        "cap": 1200,
        "when": {
          "styles": [
            "shi"
          ]
        }
      }
    ]
  },
  {
    "id": "S46",
    "name": "咏物珠玑",
    "members": [
      "T021",
      "T036"
    ],
    "desc": "体物入微，字字有光：出战咏物题材时得分 +12%。",
    "effects": [
      {
        "effectId": "S46-E1",
        "stackGroup": "synergy-resonance-v2",
        "stackMode": "max",
        "type": "theme_pct",
        "value": 1200,
        "theme": "yongwu"
      }
    ]
  },
  {
    "id": "S47",
    "name": "殿纳百川",
    "members": [
      "T028",
      "T033"
    ],
    "desc": "百川入殿，策问从容：进入殿试先恢复 3 灵感，每场开场再恢复 2。",
    "effects": [
      {
        "effectId": "S47-E1",
        "stackGroup": "synergy-palace",
        "stackMode": "max",
        "type": "palace_insp",
        "value": 20,
        "startValue": 30
      }
    ]
  },
  {
    "id": "S48",
    "name": "传灯成卷",
    "members": [
      "T034",
      "T033"
    ],
    "desc": "海纳旧学，传灯成卷：殿试每场得分 +12%。",
    "effects": [
      {
        "effectId": "S48-E1",
        "stackGroup": "synergy-resonance-v2",
        "stackMode": "max",
        "type": "palace_pct",
        "value": 1200
      }
    ]
  },
  {
    "id": "S49",
    "name": "抱柱长歌",
    "members": [
      "T041",
      "T022"
    ],
    "desc": "信守旧调，长歌不辍：同文风连捷达到 2 场后，得分 +6%。",
    "effects": [
      {
        "effectId": "S49-E1",
        "stackGroup": "synergy-resonance-v2",
        "stackMode": "max",
        "type": "streak_pct",
        "minStreak": 2,
        "value": 600
      }
    ]
  },
  {
    "id": "S50",
    "name": "梦回旧章",
    "members": [
      "T041",
      "T048"
    ],
    "desc": "首尾相照，如赴旧约：至少两枚骰且首尾同点时，得分 +6%。",
    "effects": [
      {
        "effectId": "S50-E1",
        "stackGroup": "synergy-resonance-v2",
        "stackMode": "max",
        "type": "dice_pattern",
        "pattern": "first_last_equal",
        "minDice": 2,
        "value": 600
      }
    ]
  },
  {
    "id": "S51",
    "name": "双蝶和鸣",
    "members": [
      "T048",
      "T039"
    ],
    "desc": "双蝶和鸣：骰组出现同点时，得分 +6%，并回复 1 灵感。",
    "effects": [
      {
        "effectId": "S51-E1",
        "stackGroup": "synergy-resonance-v2",
        "stackMode": "max",
        "type": "dice_pattern",
        "pattern": "pair",
        "value": 600,
        "reward": {
          "type": "inspiration",
          "value": 10,
          "perMatch": false
        }
      }
    ]
  },
  {
    "id": "S52",
    "name": "江湖转益",
    "members": [
      "T042",
      "T037"
    ],
    "desc": "换境亦换笔：换用不同文体时，得分 +8%，心得 +1。",
    "effects": [
      {
        "effectId": "S52-E1",
        "stackGroup": "synergy-resonance-v2",
        "stackMode": "max",
        "type": "style_switch_pct",
        "value": 800,
        "insight": 1
      }
    ]
  },
  {
    "id": "S53",
    "name": "换骨忘形",
    "members": [
      "T042",
      "TA02"
    ],
    "desc": "不拘旧形：发动「夺胎换骨」且换用不同文体时，得分 +10%。",
    "effects": [
      {
        "effectId": "S53-E1",
        "stackGroup": "synergy-resonance-v2",
        "stackMode": "max",
        "type": "style_switch_pct",
        "value": 1000,
        "insight": 0,
        "when": {
          "usedTalents": [
            "TA02"
          ]
        }
      }
    ]
  },
  {
    "id": "S54",
    "name": "识人观微",
    "members": [
      "T043",
      "T011"
    ],
    "desc": "知己知人，见微知著：出战怀古题材时，得分 +8%。",
    "effects": [
      {
        "effectId": "S54-E1",
        "stackGroup": "synergy-resonance-v2",
        "stackMode": "max",
        "type": "theme_pct",
        "theme": "huaigu",
        "value": 800
      }
    ]
  },
  {
    "id": "S55",
    "name": "知己问学",
    "members": [
      "T043",
      "T027"
    ],
    "desc": "知己相勉，失意亦有所得：败或平后的研习额外 +1，下一场得分 +4%。",
    "effects": [
      {
        "effectId": "S55-E1",
        "stackGroup": "synergy-growth",
        "stackMode": "max",
        "type": "study_bonus",
        "value": 10,
        "nextBattlePct": 400
      }
    ]
  },
  {
    "id": "S56",
    "name": "解剑长鸣",
    "members": [
      "TA09",
      "T015"
    ],
    "desc": "解剑仍有不平声：发动「杯酒解剑」且灵感不高于 16 时，得分 +10%。",
    "effects": [
      {
        "effectId": "S56-E1",
        "stackGroup": "synergy-resonance-v2",
        "stackMode": "max",
        "type": "comeback",
        "threshold": 160,
        "value": 1000,
        "when": {
          "usedTalents": [
            "TA09"
          ]
        }
      }
    ]
  },
  {
    "id": "S57",
    "name": "破釜止戈",
    "members": [
      "TA09",
      "T025"
    ],
    "desc": "破釜不必争刃：发动「杯酒解剑」时，得分 +6%。",
    "effects": [
      {
        "effectId": "S57-E1",
        "stackGroup": "synergy-resonance-v2",
        "stackMode": "max",
        "type": "syn_pct",
        "value": 600,
        "when": {
          "usedTalents": [
            "TA09"
          ]
        }
      }
    ]
  },
  {
    "id": "S58",
    "name": "清野收笔",
    "members": [
      "T044",
      "T035"
    ],
    "desc": "一笔收束，清野守简：仅用一枚骰时，得分 +8%。",
    "effects": [
      {
        "effectId": "S58-E1",
        "stackGroup": "synergy-resonance-v2",
        "stackMode": "max",
        "type": "dice_pattern",
        "pattern": "single",
        "value": 800
      }
    ]
  },
  {
    "id": "S59",
    "name": "坚壁藏墨",
    "members": [
      "T044",
      "T023"
    ],
    "desc": "惜墨固守，留力后篇：仅用一枚骰时，结算回复 1 灵感。",
    "effects": [
      {
        "effectId": "S59-E1",
        "stackGroup": "synergy-resonance-v2",
        "stackMode": "max",
        "type": "dice_pattern",
        "pattern": "single",
        "value": 0,
        "reward": {
          "type": "inspiration",
          "value": 10,
          "perMatch": false
        }
      }
    ]
  },
  {
    "id": "S60",
    "name": "轻骑急就",
    "members": [
      "T045",
      "T005"
    ],
    "desc": "轻骑破局，急智翻盘：首骰不高于 2、第二枚骰不低于 5 时，得分 +8%。",
    "effects": [
      {
        "effectId": "S60-E1",
        "stackGroup": "synergy-resonance-v2",
        "stackMode": "max",
        "type": "dice_pattern",
        "pattern": "low_then_high",
        "lowMax": 2,
        "nextHighMin": 5,
        "value": 800
      }
    ]
  },
  {
    "id": "S61",
    "name": "天马行军",
    "members": [
      "T045",
      "T010"
    ],
    "desc": "轻骑不循旧辙：至少两枚骰且点数各异时，得分 +6%。",
    "effects": [
      {
        "effectId": "S61-E1",
        "stackGroup": "synergy-resonance-v2",
        "stackMode": "max",
        "type": "dice_pattern",
        "pattern": "all_distinct",
        "minDice": 2,
        "value": 600
      }
    ]
  },
  {
    "id": "S62",
    "name": "曲水续灯",
    "members": [
      "T046",
      "T018"
    ],
    "desc": "曲水再举杯，孤灯不熄：上一场未胜时，本场得分 +6%。",
    "effects": [
      {
        "effectId": "S62-E1",
        "stackGroup": "synergy-resonance-v2",
        "stackMode": "max",
        "type": "battle_history_pct",
        "result": "nonwin",
        "value": 600
      }
    ]
  },
  {
    "id": "S63",
    "name": "孤烽新绿",
    "members": [
      "T046",
      "T031"
    ],
    "desc": "烽火照新绿：战后灵感不高于 18 时，回复 2 灵感，每局最多 3 次。",
    "effects": [
      {
        "effectId": "S63-E1",
        "stackGroup": "synergy-recovery",
        "stackMode": "max",
        "type": "insp_battle_recover",
        "threshold": 180,
        "value": 20,
        "maxTriggers": 3
      }
    ]
  },
  {
    "id": "S64",
    "name": "渊深列阵",
    "members": [
      "TA10",
      "T032"
    ],
    "desc": "蓄深而后列阵：发动「背水列阵」且灵感不低于上限 50% 时，得分 +8%。",
    "effects": [
      {
        "effectId": "S64-E1",
        "stackGroup": "synergy-resonance-v2",
        "stackMode": "max",
        "type": "syn_pct",
        "value": 800,
        "when": {
          "usedTalents": [
            "TA10"
          ],
          "inspirationRatioMin": 5000
        }
      }
    ]
  },
  {
    "id": "S65",
    "name": "成竹稳锋",
    "members": [
      "TA10",
      "T029"
    ],
    "desc": "胸中有成竹，临阵锋不乱：发动「背水列阵」且每枚骰均不低于 4 时，得分 +6%。",
    "effects": [
      {
        "effectId": "S65-E1",
        "stackGroup": "synergy-resonance-v2",
        "stackMode": "max",
        "type": "dice_pattern",
        "pattern": "all_high",
        "minPip": 4,
        "value": 600,
        "when": {
          "usedTalents": [
            "TA10"
          ]
        }
      }
    ]
  },
  {
    "id": "S66",
    "name": "静中推敲",
    "members": [
      "T047",
      "T008"
    ],
    "desc": "静中推敲，不妄动笔：本场未发动论战主动文心时，得分 +6%。",
    "effects": [
      {
        "effectId": "S66-E1",
        "stackGroup": "synergy-resonance-v2",
        "stackMode": "max",
        "type": "restraint_pct",
        "value": 600
      }
    ]
  },
  {
    "id": "S67",
    "name": "坐忘留白",
    "members": [
      "T047",
      "TA08"
    ],
    "desc": "谋篇留白，心有余裕：灵感不低于上限 60% 时，得分 +6%。",
    "effects": [
      {
        "effectId": "S67-E1",
        "stackGroup": "synergy-resonance-v2",
        "stackMode": "max",
        "type": "syn_pct",
        "value": 600,
        "when": {
          "inspirationRatioMin": 6000
        }
      }
    ]
  },
  {
    "id": "S68",
    "name": "白黑有声",
    "members": [
      "T049",
      "TA03"
    ],
    "desc": "白黑相激，奇声自起：骰组同时出现不高于 2 的低点与不低于 5 的高点时，得分 +8%。",
    "effects": [
      {
        "effectId": "S68-E1",
        "stackGroup": "synergy-resonance-v2",
        "stackMode": "max",
        "type": "dice_pattern",
        "pattern": "low_and_high",
        "lowMax": 2,
        "highMin": 5,
        "value": 800
      }
    ]
  },
  {
    "id": "S69",
    "name": "点墨分明",
    "members": [
      "T049",
      "TA07"
    ],
    "desc": "点铁成金，黑白分明：发动「点铁成金」且出现六点时，得分 +8%。",
    "effects": [
      {
        "effectId": "S69-E1",
        "stackGroup": "synergy-resonance-v2",
        "stackMode": "max",
        "type": "dice_pattern",
        "pattern": "six",
        "value": 800,
        "when": {
          "usedTalents": [
            "TA07"
          ]
        }
      }
    ]
  },
  {
    "id": "S70",
    "name": "见真惊雨",
    "members": [
      "TA11",
      "TA04"
    ],
    "desc": "斩妄见真，落笔惊雨：发动「斩妄见真」且出现六点时，得分 +8%。",
    "effects": [
      {
        "effectId": "S70-E1",
        "stackGroup": "synergy-resonance-v2",
        "stackMode": "max",
        "type": "dice_pattern",
        "pattern": "six",
        "value": 800,
        "when": {
          "usedTalents": [
            "TA11"
          ]
        }
      }
    ]
  },
  {
    "id": "S71",
    "name": "斩妄六顺",
    "members": [
      "TA11",
      "T024"
    ],
    "desc": "去妄存真，六曜回息：发动「斩妄见真」且出现六点时，结算回复 1 灵感。",
    "effects": [
      {
        "effectId": "S71-E1",
        "stackGroup": "synergy-resonance-v2",
        "stackMode": "max",
        "type": "dice_pattern",
        "pattern": "six",
        "value": 0,
        "when": {
          "usedTalents": [
            "TA11"
          ]
        },
        "reward": {
          "type": "inspiration",
          "value": 10,
          "perMatch": false
        }
      }
    ]
  },
  {
    "id": "S72",
    "name": "孤愤惊辞",
    "members": [
      "T015",
      "TA03"
    ],
    "desc": "孤愤化作惊人辞：灵感不高于 14 时，得分 +8%。",
    "effects": [
      {
        "effectId": "S72-E1",
        "stackGroup": "synergy-resonance-v2",
        "stackMode": "max",
        "type": "comeback",
        "threshold": 140,
        "value": 800
      }
    ]
  },
  {
    "id": "S73",
    "name": "退笔留白",
    "members": [
      "T023",
      "T035"
    ],
    "desc": "退笔留白，简中得悟：仅用一枚骰时，得分 +6%，心得 +1。",
    "effects": [
      {
        "effectId": "S73-E1",
        "stackGroup": "synergy-resonance-v2",
        "stackMode": "max",
        "type": "dice_pattern",
        "pattern": "single",
        "value": 600,
        "reward": {
          "type": "insight",
          "value": 10,
          "perMatch": false
        }
      }
    ]
  },
  {
    "id": "S74",
    "name": "谋篇惊风",
    "members": [
      "TA08",
      "TA04"
    ],
    "desc": "谋定而后落笔：发动「笔落惊风雨」且出现六点时，得分 +8%。",
    "effects": [
      {
        "effectId": "S74-E1",
        "stackGroup": "synergy-resonance-v2",
        "stackMode": "max",
        "type": "dice_pattern",
        "pattern": "six",
        "value": 800,
        "when": {
          "usedTalents": [
            "TA04"
          ]
        }
      }
    ]
  }
];
