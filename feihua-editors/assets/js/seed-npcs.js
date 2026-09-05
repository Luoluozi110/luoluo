/* 飞花棋游戏原始 NPC（config/npcs.json）。作为编辑器默认种子数据。由游戏配置同步生成，请勿手工改动 —— 在编辑器内管理后导出即可覆盖。 */
window.GAME_NPCS = [
  {
    "id": "tongsheng",
    "tier": "童生级",
    "range": [
      0,
      2500
    ],
    "desc": "乡试圈前半登场。刚进学的蒙童，字还写不周正，专为送你一点信心。各有所偏，遇到偏科的同窗最好用所长击之。",
    "npcs": [
      {
        "id": "zhou_xiaoman",
        "name": "周小满",
        "title": "蒙学童子",
        "style": "shi",
        "attrs": {
          "shi": 110,
          "ci": 50,
          "lian": 40,
          "bi": 50,
          "xue": 50,
          "si": 50
        },
        "mech": {
          "version": 1,
          "complexity": "tutorial",
          "signature": {
            "name": "诗兴初发",
            "template": "sig_style_mastery",
            "style": "shi",
            "pct": 600,
            "intentBias": 15000,
            "disclosure": "full"
          },
          "weakness": {
            "name": "声律未稳",
            "template": "wea_use_other_style",
            "npcStyle": "shi",
            "fullClose": [
              "ci"
            ],
            "partialReduction": {
              "style": [
                "lian"
              ],
              "retention": 5000
            },
            "playerBonus": 0
          },
          "intent": {
            "template": "int_preferred_style",
            "style": "shi",
            "bias": 15000,
            "bottom": 8500,
            "noAntiRepeat": true,
            "description": "本场准备使用诗体"
          }
        },
        "difficultyRole": "tutorial",
        "beginnerWeight": 100,
        "standardWeight": 100
      },
      {
        "id": "chen_yanqiu",
        "name": "陈砚秋",
        "title": "村塾学子",
        "style": "ci",
        "attrs": {
          "shi": 50,
          "ci": 110,
          "lian": 40,
          "bi": 50,
          "xue": 40,
          "si": 60
        },
        "mech": {
          "version": 1,
          "complexity": "tutorial",
          "signature": {
            "name": "婉约稳进",
            "template": "sig_style_mastery",
            "style": "ci",
            "pct": 600,
            "intentBias": 15000,
            "disclosure": "full"
          },
          "weakness": {
            "name": "辞藻局促",
            "template": "wea_use_other_style",
            "npcStyle": "ci",
            "fullClose": [
              "shi",
              "lian"
            ],
            "partialReduction": {
              "style": [
                "bi"
              ],
              "retention": 5000
            },
            "playerBonus": 0
          },
          "intent": {
            "template": "int_preferred_style",
            "style": "ci",
            "bias": 15000,
            "bottom": 8500,
            "noAntiRepeat": true,
            "description": "本场准备使用词体"
          }
        },
        "difficultyRole": "tutorial",
        "beginnerWeight": 100,
        "standardWeight": 100
      },
      {
        "id": "wu_shuang_er",
        "name": "吴双儿",
        "title": "启蒙幼童",
        "style": "lian",
        "attrs": {
          "shi": 50,
          "ci": 40,
          "lian": 110,
          "bi": 40,
          "xue": 50,
          "si": 60
        },
        "mech": {
          "version": 1,
          "complexity": "tutorial",
          "signature": {
            "name": "对仗追随",
            "template": "sig_style_mastery",
            "style": "lian",
            "pct": 600,
            "intentBias": 14000,
            "disclosure": "full"
          },
          "weakness": {
            "name": "泥于绳墨",
            "template": "wea_harmonious_manner",
            "manners": [
              "wanyue",
              "qingya"
            ],
            "retention": 1000,
            "playerBonus": 0
          },
          "intent": {
            "template": "int_preferred_style",
            "style": "lian",
            "bias": 14000,
            "bottom": 8500,
            "noAntiRepeat": true,
            "description": "本场准备使用联体"
          }
        },
        "difficultyRole": "tutorial",
        "beginnerWeight": 100,
        "standardWeight": 100
      },
      {
        "id": "sun_a_niu",
        "name": "孙阿牛",
        "title": "私塾蒙童",
        "style": "bi",
        "attrs": {
          "shi": 50,
          "ci": 50,
          "lian": 40,
          "bi": 110,
          "xue": 40,
          "si": 60
        },
        "mech": {
          "version": 1,
          "complexity": "tutorial",
          "signature": {
            "name": "字稳卷平",
            "template": "sig_steady_pressure",
            "floor": 4,
            "ceiling": 4,
            "floorPct": 400
          },
          "weakness": {
            "name": "怕大场面",
            "template": "wea_crushing_win",
            "threshold": 1800,
            "refund": 0,
            "playerBonus": 0
          },
          "intent": {
            "template": "int_steady",
            "style": "bi",
            "bias": 12000,
            "bottom": 8500,
            "description": "本场求稳，降低波动"
          }
        },
        "difficultyRole": "tutorial",
        "beginnerWeight": 100,
        "standardWeight": 100
      },
      {
        "id": "qian_xiao_yi",
        "name": "钱小乙",
        "title": "初学蒙生",
        "style": "xue",
        "attrs": {
          "shi": 50,
          "ci": 40,
          "lian": 50,
          "bi": 50,
          "xue": 110,
          "si": 50
        },
        "mech": {
          "version": 1,
          "complexity": "basic",
          "signature": {
            "name": "熟题先机",
            "template": "sig_repeat_read",
            "pct": 600,
            "firstBattle": "disabled"
          },
          "weakness": {
            "name": "死记旧章",
            "template": "wea_switch_style",
            "fullClose": [
              "*"
            ],
            "infoBonus": {
              "intentPrecision": 1
            },
            "playerBonus": 0
          },
          "intent": {
            "template": "int_preferred_style",
            "style": "xue",
            "bias": 13000,
            "bottom": 8500,
            "historyAware": true,
            "description": "本场准备沿用上一场路数"
          }
        },
        "difficultyRole": "basic",
        "beginnerWeight": 100,
        "standardWeight": 100
      },
      {
        "id": "li_mo_tong",
        "name": "李墨童",
        "title": "开蒙学童",
        "style": "si",
        "attrs": {
          "shi": 40,
          "ci": 50,
          "lian": 50,
          "bi": 50,
          "xue": 40,
          "si": 120
        },
        "stageForcedWhen": {
          "primary": "si",
          "minExclusive": 10,
          "strictlyHigherThan": [
            "shi",
            "ci",
            "lian",
            "bi",
            "xue"
          ]
        },
        "mech": {
          "version": 2,
          "complexity": "advanced",
          "signature": {
            "name": "借风早成",
            "template": "sig_zeitgeist_surf",
            "pct": 500
          },
          "weakness": {
            "name": "逆潮见真",
            "template": "wea_go_against_zeitgeist",
            "minAffinity": 0,
            "retention": 3000,
            "playerBonus": 0
          },
          "intent": {
            "template": "int_zeitgeist",
            "style": "si",
            "bias": 11000,
            "bottom": 8200,
            "description": "本场随先生所尚的文风试笔"
          }
        },
        "difficultyRole": "advanced",
        "beginnerWeight": 20,
        "standardWeight": 100
      },
      {
        "id": "shen_sui_feng",
        "name": "沈随风",
        "title": "县学秀才",
        "style": "ci",
        "focusAttr": "xue",
        "attrs": {
          "shi": 100,
          "ci": 150,
          "lian": 80,
          "bi": 100,
          "xue": 150,
          "si": 130
        },
        "mech": {
          "version": 2,
          "complexity": "advanced",
          "signature": {
            "name": "借风成势",
            "template": "sig_zeitgeist_surf",
            "pct": 800
          },
          "weakness": {
            "name": "逆潮立骨",
            "template": "wea_go_against_zeitgeist",
            "minAffinity": 0,
            "retention": 2000,
            "playerBonus": 0
          },
          "intent": {
            "template": "int_zeitgeist",
            "style": "ci",
            "bias": 11500,
            "bottom": 8000,
            "description": "本场顺应当朝风潮，以得势文风行文"
          }
        },
        "difficultyRole": "elite",
        "beginnerWeight": 0,
        "standardWeight": 15
      },
      {
        "id": "npc_tongsheng_1",
        "name": "胡丹阳",
        "title": "枕月观云",
        "style": "si",
        "attrs": {
          "shi": 50,
          "ci": 50,
          "lian": 50,
          "bi": 50,
          "xue": 50,
          "si": 150
        },
        "mech": {
          "signature": {
            "template": "sig_steady_pressure",
            "name": "识破重复",
            "pct": 600,
            "bias": 13000,
            "floor": 5,
            "ceiling": 5
          },
          "weakness": {
            "template": "wea_go_against_zeitgeist",
            "name": "逆潮立骨",
            "minAffinity": 0,
            "retention": 30,
            "playerBonus": 0
          },
          "intent": {
            "template": "int_declared_stance",
            "name": "定策意图"
          }
        },
        "stageForcedWhen": {
          "primary": "si",
          "minExclusive": 10,
          "strictlyHigherThan": [
            "shi",
            "ci",
            "lian",
            "bi",
            "xue"
          ]
        },
        "difficultyRole": "basic",
        "beginnerWeight": 100,
        "standardWeight": 100
      }
    ],
    "balanceVersion": 2,
    "difficultyBoost": {
      "allAttrs": 1,
      "wisdomExtra": 1
    }
  },
  {
    "id": "xiucai",
    "tier": "秀才级",
    "range": [
      2500,
      5000
    ],
    "desc": "乡试圈后半登场。已入庠序的秀才，有来有回，赢下靠的是稳。六人各擅一体，摸清谁偏哪门再出手。",
    "npcs": [
      {
        "id": "zhang_xiucai",
        "name": "张秀才",
        "title": "庠序生员",
        "style": "shi",
        "attrs": {
          "shi": 170,
          "ci": 110,
          "lian": 70,
          "bi": 110,
          "xue": 80,
          "si": 90
        },
        "mech": {
          "version": 1,
          "complexity": "basic",
          "signature": {
            "name": "工稳守卷",
            "template": "sig_steady_pressure",
            "floor": 5,
            "ceiling": 5,
            "floorPct": 450
          },
          "weakness": {
            "name": "怯于变化",
            "template": "wea_crushing_win",
            "threshold": 1800,
            "refund": 0,
            "playerBonus": 0
          },
          "intent": {
            "template": "int_steady",
            "style": "shi",
            "bias": 12000,
            "bottom": 8000,
            "description": "本场求稳，降低波动"
          }
        },
        "difficultyRole": "basic",
        "beginnerWeight": 100,
        "standardWeight": 100
      },
      {
        "id": "huang_ming_yuan",
        "name": "黄明远",
        "title": "县学秀才",
        "style": "ci",
        "attrs": {
          "shi": 80,
          "ci": 170,
          "lian": 70,
          "bi": 80,
          "xue": 110,
          "si": 120
        },
        "mech": {
          "version": 1,
          "complexity": "basic",
          "signature": {
            "name": "声律相持",
            "template": "sig_style_mastery",
            "style": "ci",
            "pct": 800,
            "intentBias": 13000,
            "disclosure": "full"
          },
          "weakness": {
            "name": "词丽辞平",
            "template": "wea_harmonious_manner",
            "manners": [
              "zheli",
              "qingya"
            ],
            "retention": 1000,
            "playerBonus": 0
          },
          "intent": {
            "template": "int_preferred_style",
            "style": "ci",
            "bias": 13000,
            "bottom": 8000,
            "description": "本场准备使用词体"
          }
        },
        "difficultyRole": "basic",
        "beginnerWeight": 100,
        "standardWeight": 100
      },
      {
        "id": "lin_qingzhai",
        "name": "林清斋",
        "title": "儒学生员",
        "style": "lian",
        "attrs": {
          "shi": 80,
          "ci": 110,
          "lian": 170,
          "bi": 80,
          "xue": 80,
          "si": 90
        },
        "mech": {
          "version": 1,
          "complexity": "basic",
          "signature": {
            "name": "熟读成诵",
            "template": "sig_repeat_read",
            "pct": 800,
            "firstBattle": "disabled"
          },
          "weakness": {
            "name": "临题拘泥",
            "template": "wea_switch_style",
            "fullClose": [
              "*"
            ],
            "infoBonus": {
              "intentPrecision": 1
            },
            "playerBonus": 0
          },
          "intent": {
            "template": "int_preferred_style",
            "style": "lian",
            "bias": 13000,
            "bottom": 8000,
            "historyAware": true,
            "description": "本场仍偏好联体"
          }
        },
        "difficultyRole": "basic",
        "beginnerWeight": 100,
        "standardWeight": 100
      },
      {
        "id": "zhao_wen_bin",
        "name": "赵文彬",
        "title": "府学秀才",
        "style": "bi",
        "attrs": {
          "shi": 80,
          "ci": 80,
          "lian": 70,
          "bi": 170,
          "xue": 110,
          "si": 120
        },
        "mech": {
          "version": 1,
          "complexity": "basic",
          "signature": {
            "name": "观你旧辙",
            "template": "sig_repeat_read",
            "pct": 700,
            "firstBattle": "disabled"
          },
          "weakness": {
            "name": "依样画瓢",
            "template": "wea_switch_style",
            "fullClose": [
              "*"
            ],
            "infoBonus": {
              "intentPrecision": 1
            },
            "playerBonus": 0
          },
          "intent": {
            "template": "int_preferred_style",
            "style": "bi",
            "bias": 13000,
            "bottom": 8000,
            "historyAware": true,
            "description": "本场沿用你上一场路数"
          }
        },
        "difficultyRole": "basic",
        "beginnerWeight": 100,
        "standardWeight": 100
      },
      {
        "id": "zheng_shu_yu",
        "name": "郑书玉",
        "title": "廪膳生员",
        "style": "xue",
        "attrs": {
          "shi": 110,
          "ci": 80,
          "lian": 80,
          "bi": 80,
          "xue": 170,
          "si": 90
        },
        "mech": {
          "version": 1,
          "complexity": "advanced",
          "signature": {
            "name": "引经据典",
            "template": "sig_copycat",
            "style": "xue",
            "pct": 800,
            "historyLen": 2,
            "noHistory": "fallback_preferred"
          },
          "weakness": {
            "name": "囿于经注",
            "template": "wea_use_other_style",
            "npcStyle": "xue",
            "fullClose": [
              "shi",
              "ci"
            ],
            "partialReduction": {
              "style": [
                "lian"
              ],
              "retention": 5000
            },
            "playerBonus": 0
          },
          "intent": {
            "template": "int_copycat",
            "style": "xue",
            "bias": 13000,
            "bottom": 8000,
            "description": "准备仿你近日常用路数"
          }
        },
        "difficultyRole": "advanced",
        "beginnerWeight": 20,
        "standardWeight": 100
      },
      {
        "id": "wang_han_sheng",
        "name": "王翰生",
        "title": "邑庠秀才",
        "style": "si",
        "attrs": {
          "shi": 80,
          "ci": 110,
          "lian": 80,
          "bi": 80,
          "xue": 80,
          "si": 180
        },
        "stageForcedWhen": {
          "primary": "si",
          "minExclusive": 18,
          "strictlyHigherThan": [
            "shi",
            "ci",
            "lian",
            "bi",
            "xue"
          ]
        },
        "mech": {
          "version": 2,
          "complexity": "advanced",
          "signature": {
            "name": "扣心问锋",
            "template": "sig_active_talent_tax",
            "pct": 800
          },
          "weakness": {
            "name": "藏锋待机",
            "template": "wea_hold_active_talent",
            "retention": 3000,
            "playerBonus": 0
          },
          "intent": {
            "template": "int_active_watch",
            "style": "si",
            "bias": 11500,
            "bottom": 8000,
            "description": "本场留心你的主动文心，待其发动再作应答"
          }
        },
        "difficultyRole": "advanced",
        "beginnerWeight": 20,
        "standardWeight": 100
      },
      {
        "id": "xie_lian_cheng",
        "name": "谢连城",
        "title": "贡院举人",
        "style": "lian",
        "focusAttr": "bi",
        "attrs": {
          "shi": 170,
          "ci": 170,
          "lian": 300,
          "bi": 220,
          "xue": 180,
          "si": 190
        },
        "mech": {
          "version": 2,
          "complexity": "advanced",
          "signature": {
            "name": "审律摘瑕",
            "template": "sig_dice_pattern_hunt",
            "pattern": "pair",
            "pct": 900
          },
          "weakness": {
            "name": "收束成篇",
            "template": "wea_limited_extra_dice",
            "maxExtraDice": 1,
            "retention": 2500,
            "playerBonus": 0
          },
          "intent": {
            "template": "int_pattern_hunt",
            "pattern": "pair",
            "style": "lian",
            "bias": 12500,
            "bottom": 7800,
            "description": "本场专审重复骰面，待你落笔露瑕"
          }
        },
        "difficultyRole": "elite",
        "beginnerWeight": 0,
        "standardWeight": 15
      },
      {
        "id": "gu_qing_shang",
        "name": "顾清商",
        "title": "会试举人",
        "style": "ci",
        "focusAttr": "si",
        "attrs": {
          "shi": 180,
          "ci": 280,
          "lian": 160,
          "bi": 170,
          "xue": 170,
          "si": 210
        },
        "mech": {
          "version": 2,
          "complexity": "advanced",
          "signature": {
            "name": "先声定策",
            "template": "sig_declared_stance",
            "pct": 900
          },
          "weakness": {
            "name": "对策破锋",
            "template": "wea_stance_counter",
            "counter": {
              "attack": "base_dice",
              "steady": "one_extra",
              "turn": "change_style"
            },
            "retention": 2000,
            "playerBonus": 0
          },
          "intent": {
            "template": "int_declared_stance",
            "stance": "steady",
            "style": "ci",
            "bias": 12500,
            "bottom": 7800,
            "description": "本场稳守成卷，邀你以一枚追加骰破势"
          }
        },
        "difficultyRole": "elite",
        "beginnerWeight": 0,
        "standardWeight": 15
      }
    ],
    "balanceVersion": 2,
    "difficultyBoost": {
      "allAttrs": 2,
      "wisdomExtra": 1
    }
  },
  {
    "id": "juren",
    "tier": "举人级",
    "range": [
      5000,
      7500
    ],
    "desc": "会试中坚。六维总预算提升至 90，偏科优势更明确；开始要求玩家利用相性与破绽，而非只靠属性碾压。",
    "npcs": [
      {
        "id": "fan_jieyuan",
        "name": "范解元",
        "title": "乡试解元",
        "style": "shi",
        "attrs": {
          "shi": 300,
          "ci": 170,
          "lian": 140,
          "bi": 170,
          "xue": 160,
          "si": 160
        },
        "mech": {
          "version": 1,
          "complexity": "advanced",
          "signature": {
            "name": "鹿鸣争先",
            "template": "sig_dice_response",
            "steps": [
              16,
              10,
              4
            ],
            "cap": 26,
            "altAction": {
              "trigger": "playerExtraDice>=1",
              "switchTo": "strong_attack"
            }
          },
          "weakness": {
            "name": "恃才冒进",
            "template": "wea_base_dice_only",
            "flat": 10,
            "playerBonus": 0
          },
          "intent": {
            "template": "int_dice_response",
            "style": "shi",
            "bias": 13500,
            "bottom": 7800,
            "description": "正常应战；若玩家追加骰，则争先强攻"
          }
        },
        "difficultyRole": "advanced",
        "beginnerWeight": 20,
        "standardWeight": 100
      },
      {
        "id": "su_mingzhe",
        "name": "苏明哲",
        "title": "公车举人",
        "style": "ci",
        "attrs": {
          "shi": 160,
          "ci": 300,
          "lian": 140,
          "bi": 160,
          "xue": 170,
          "si": 170
        },
        "mech": {
          "version": 1,
          "complexity": "advanced",
          "signature": {
            "name": "依样裁词",
            "template": "sig_copycat",
            "style": "ci",
            "pct": 800,
            "historyLen": 2,
            "noHistory": "fallback_preferred"
          },
          "weakness": {
            "name": "形似神离",
            "template": "wea_use_other_style",
            "npcStyle": "ci",
            "fullClose": [
              "*"
            ],
            "partialReduction": {
              "changeManner": true,
              "retention": 5000
            },
            "playerBonus": 0
          },
          "intent": {
            "template": "int_copycat",
            "style": "ci",
            "bias": 13000,
            "bottom": 7800,
            "description": "准备模仿你近日常用路数"
          }
        },
        "difficultyRole": "advanced",
        "beginnerWeight": 20,
        "standardWeight": 100
      },
      {
        "id": "lu_yun_ting",
        "name": "陆云亭",
        "title": "鹿鸣宴客",
        "style": "lian",
        "attrs": {
          "shi": 160,
          "ci": 170,
          "lian": 300,
          "bi": 140,
          "xue": 160,
          "si": 170
        },
        "mech": {
          "version": 1,
          "complexity": "advanced",
          "signature": {
            "name": "对答如流",
            "template": "sig_style_mastery",
            "style": "lian",
            "pct": 900,
            "intentBias": 13000,
            "disclosure": "full"
          },
          "weakness": {
            "name": "意止于对",
            "template": "wea_harmonious_manner",
            "manners": [
              "haofang",
              "zheli"
            ],
            "retention": 1000,
            "playerBonus": 0
          },
          "intent": {
            "template": "int_preferred_style",
            "style": "lian",
            "bias": 13000,
            "bottom": 7800,
            "description": "本场准备使用联体，以对仗相迎"
          }
        },
        "difficultyRole": "advanced",
        "beginnerWeight": 20,
        "standardWeight": 100
      },
      {
        "id": "han_shi_chang",
        "name": "韩世昌",
        "title": "乙榜举人",
        "style": "bi",
        "attrs": {
          "shi": 160,
          "ci": 160,
          "lian": 140,
          "bi": 300,
          "xue": 170,
          "si": 170
        },
        "mech": {
          "version": 1,
          "complexity": "advanced",
          "signature": {
            "name": "章法成城",
            "template": "sig_steady_pressure",
            "floor": 7,
            "ceiling": 6,
            "floorPct": 500
          },
          "weakness": {
            "name": "惧高压",
            "template": "wea_crushing_win",
            "threshold": 1800,
            "refund": 0,
            "playerBonus": 0
          },
          "intent": {
            "template": "int_steady",
            "style": "bi",
            "bias": 12000,
            "bottom": 7800,
            "description": "本场求稳，严守章法"
          }
        },
        "difficultyRole": "advanced",
        "beginnerWeight": 20,
        "standardWeight": 100
      },
      {
        "id": "tang_ji_qing",
        "name": "唐季卿",
        "title": "孝廉举人",
        "style": "xue",
        "attrs": {
          "shi": 170,
          "ci": 160,
          "lian": 160,
          "bi": 150,
          "xue": 300,
          "si": 160
        },
        "stageForcedWhen": {
          "primary": "xue",
          "minExclusive": 28,
          "strictlyHigherThan": [
            "shi",
            "ci",
            "lian",
            "bi",
            "si"
          ]
        },
        "mech": {
          "version": 2,
          "complexity": "advanced",
          "signature": {
            "name": "据典审章",
            "template": "sig_dice_pattern_hunt",
            "pattern": "pair",
            "pct": 1000
          },
          "weakness": {
            "name": "收卷定篇",
            "template": "wea_limited_extra_dice",
            "maxExtraDice": 1,
            "retention": 2200,
            "playerBonus": 0
          },
          "intent": {
            "template": "int_pattern_hunt",
            "pattern": "pair",
            "style": "xue",
            "bias": 12800,
            "bottom": 7800,
            "description": "本场专审对偶章法，静候你骰组露出规整痕迹"
          }
        },
        "difficultyRole": "advanced",
        "beginnerWeight": 20,
        "standardWeight": 100
      },
      {
        "id": "bai_wen_yuan",
        "name": "白文渊",
        "title": "秋闱中式",
        "style": "si",
        "attrs": {
          "shi": 160,
          "ci": 170,
          "lian": 160,
          "bi": 150,
          "xue": 140,
          "si": 320
        },
        "mech": {
          "version": 1,
          "complexity": "advanced",
          "signature": {
            "name": "察势转锋",
            "template": "sig_copycat",
            "style": "si",
            "pct": 900,
            "historyLen": 2,
            "noHistory": "fallback_preferred"
          },
          "weakness": {
            "name": "恃察轻守",
            "template": "wea_use_other_style",
            "npcStyle": "si",
            "fullClose": [
              "shi",
              "ci"
            ],
            "partialReduction": {
              "style": [
                "lian"
              ],
              "retention": 5000
            },
            "playerBonus": 0
          },
          "intent": {
            "template": "int_copycat",
            "style": "si",
            "bias": 13000,
            "bottom": 7800,
            "description": "准备仿你近日常用路数，相机转锋"
          }
        },
        "difficultyRole": "advanced",
        "beginnerWeight": 20,
        "standardWeight": 100
      },
      {
        "id": "cui_wu_jiu",
        "name": "崔无咎",
        "title": "监察进士",
        "style": "shi",
        "focusAttr": "si",
        "attrs": {
          "shi": 240,
          "ci": 220,
          "lian": 210,
          "bi": 230,
          "xue": 220,
          "si": 350
        },
        "mech": {
          "version": 2,
          "complexity": "advanced",
          "signature": {
            "name": "截脉问锋",
            "template": "sig_active_talent_tax",
            "pct": 1100
          },
          "weakness": {
            "name": "藏锋守拙",
            "template": "wea_hold_active_talent",
            "retention": 2500,
            "playerBonus": 0
          },
          "intent": {
            "template": "int_active_watch",
            "style": "shi",
            "bias": 12000,
            "bottom": 7500,
            "description": "本场紧盯主动文心的起落，伺机问锋"
          }
        },
        "difficultyRole": "advanced",
        "beginnerWeight": 20,
        "standardWeight": 100
      },
      {
        "id": "npc_juren_1",
        "name": "江嫄",
        "title": "一叶舟主",
        "style": "lian",
        "focusAttr": "lian",
        "attrs": {
          "shi": 210,
          "ci": 210,
          "lian": 330,
          "bi": 200,
          "xue": 210,
          "si": 240
        },
        "mech": {
          "signature": {
            "name": "偏联力专精",
            "template": "sig_dice_response",
            "style": "lian",
            "pct": 600,
            "bias": 13000,
            "steps": [
              14,
              9,
              4
            ],
            "cap": 22
          },
          "weakness": {
            "template": "wea_limited_extra_dice",
            "name": "跨场换策",
            "layerReduce": 1,
            "maxExtraDice": 1,
            "retention": 30,
            "playerBonus": 0
          },
          "intent": {
            "template": "int_pattern_hunt",
            "name": "审律意图"
          }
        },
        "stageForcedWhen": {
          "primary": "lian",
          "minExclusive": 28,
          "strictlyHigherThan": [
            "shi",
            "ci"
          ]
        },
        "difficultyRole": "basic",
        "beginnerWeight": 100,
        "standardWeight": 100
      }
    ],
    "balanceVersion": 2,
    "difficultyBoost": {
      "allAttrs": 3,
      "wisdomExtra": 2
    }
  },
  {
    "id": "jinshi",
    "tier": "进士级",
    "range": [
      7500,
      10000
    ],
    "desc": "高阶名家。六维总预算提升至 117，并强化招牌能力；需要稳定构筑与资源规划，低级档不随之上涨。",
    "npcs": [
      {
        "id": "ouyang_han",
        "name": "欧阳翰",
        "title": "殿前进士",
        "style": "shi",
        "attrs": {
          "shi": 370,
          "ci": 210,
          "lian": 190,
          "bi": 210,
          "xue": 210,
          "si": 240
        },
        "mech": {
          "version": 1,
          "complexity": "advanced",
          "signature": {
            "main": {
              "name": "文债催人",
              "template": "sig_debt_drain",
              "threshold": 1200,
              "cost": 3,
              "maxCost": 2
            },
            "weak": {
              "name": "稳卷",
              "template": "sig_steady_pressure",
              "floor": 4,
              "ceiling": 4
            }
          },
          "weakness": {
            "name": "一气压卷",
            "template": "wea_crushing_win",
            "threshold": 1800,
            "refund": 1,
            "playerBonus": 0
          },
          "intent": {
            "template": "int_steady",
            "style": "shi",
            "bias": 12500,
            "bottom": 7500,
            "description": "准备稳稿压人"
          }
        },
        "difficultyRole": "advanced",
        "beginnerWeight": 20,
        "standardWeight": 100
      },
      {
        "id": "si_ma_wen",
        "name": "司马文",
        "title": "同进士出身",
        "style": "ci",
        "attrs": {
          "shi": 220,
          "ci": 370,
          "lian": 190,
          "bi": 210,
          "xue": 210,
          "si": 230
        },
        "mech": {
          "version": 1,
          "complexity": "advanced",
          "signature": {
            "name": "曲折藏锋",
            "template": "sig_style_mastery",
            "style": "ci",
            "pct": 1100,
            "intentBias": 13000,
            "disclosure": "full"
          },
          "weakness": {
            "name": "文绉其表",
            "template": "wea_style_manner_combo",
            "style": "lian",
            "manners": [
              "qili",
              "zheli"
            ],
            "retention": 1000,
            "playerBonus": 0
          },
          "intent": {
            "template": "int_preferred_style",
            "style": "ci",
            "bias": 13000,
            "bottom": 7500,
            "description": "本场准备使用词体"
          }
        },
        "difficultyRole": "advanced",
        "beginnerWeight": 20,
        "standardWeight": 100
      },
      {
        "id": "shang_guan_ming",
        "name": "上官明",
        "title": "进士及第",
        "style": "lian",
        "attrs": {
          "shi": 210,
          "ci": 210,
          "lian": 370,
          "bi": 190,
          "xue": 210,
          "si": 240
        },
        "mech": {
          "version": 1,
          "complexity": "advanced",
          "signature": {
            "name": "双关设伏",
            "template": "sig_copycat",
            "style": "lian",
            "pct": 1100,
            "historyLen": 2,
            "noHistory": "fallback_preferred"
          },
          "weakness": {
            "name": "机巧易察",
            "template": "wea_use_other_style",
            "npcStyle": "lian",
            "fullClose": [
              "shi",
              "ci"
            ],
            "partialReduction": {
              "style": [
                "bi"
              ],
              "retention": 5000
            },
            "playerBonus": 0
          },
          "intent": {
            "template": "int_copycat",
            "style": "lian",
            "bias": 13000,
            "bottom": 7500,
            "description": "准备仿你近日常用路数"
          }
        },
        "difficultyRole": "advanced",
        "beginnerWeight": 20,
        "standardWeight": 100
      },
      {
        "id": "xia_hou_jin",
        "name": "夏侯瑾",
        "title": "翰林庶吉士",
        "style": "bi",
        "attrs": {
          "shi": 210,
          "ci": 210,
          "lian": 190,
          "bi": 370,
          "xue": 210,
          "si": 240
        },
        "mech": {
          "version": 1,
          "complexity": "advanced",
          "signature": {
            "name": "翰林稳卷",
            "template": "sig_steady_pressure",
            "floor": 8,
            "ceiling": 6,
            "floorPct": 600
          },
          "weakness": {
            "name": "忌被压卷",
            "template": "wea_crushing_win",
            "threshold": 1800,
            "refund": 1,
            "playerBonus": 0
          },
          "intent": {
            "template": "int_steady",
            "style": "bi",
            "bias": 12000,
            "bottom": 7500,
            "description": "本场求稳，严守翰苑章法"
          }
        },
        "difficultyRole": "advanced",
        "beginnerWeight": 20,
        "standardWeight": 100
      },
      {
        "id": "mu_rong_yu",
        "name": "慕容玉",
        "title": "赐进士出身",
        "style": "xue",
        "attrs": {
          "shi": 220,
          "ci": 210,
          "lian": 210,
          "bi": 190,
          "xue": 370,
          "si": 230
        },
        "mech": {
          "version": 1,
          "complexity": "advanced",
          "signature": {
            "name": "科场博洽",
            "template": "sig_repeat_read",
            "pct": 1100,
            "firstBattle": "disabled"
          },
          "weakness": {
            "name": "倦于变通",
            "template": "wea_switch_style",
            "fullClose": [
              "*"
            ],
            "infoBonus": {
              "intentPrecision": 1
            },
            "playerBonus": 0
          },
          "intent": {
            "template": "int_preferred_style",
            "style": "xue",
            "bias": 13000,
            "bottom": 7500,
            "historyAware": true,
            "description": "本场沿用你上一场路数"
          }
        },
        "difficultyRole": "advanced",
        "beginnerWeight": 20,
        "standardWeight": 100
      },
      {
        "id": "yuwen_yuan",
        "name": "宇文渊",
        "title": "甲科进士",
        "style": "si",
        "attrs": {
          "shi": 210,
          "ci": 220,
          "lian": 210,
          "bi": 190,
          "xue": 210,
          "si": 390
        },
        "stageForcedWhen": {
          "primary": "si",
          "minExclusive": 38,
          "strictlyHigherThan": [
            "shi",
            "ci",
            "lian",
            "bi",
            "xue"
          ]
        },
        "mech": {
          "version": 1,
          "complexity": "advanced",
          "signature": {
            "name": "立意先行",
            "template": "sig_manner_theme",
            "manners": [
              "zheli",
              "chenyu"
            ],
            "pct": 1200,
            "cap": 1000,
            "applyTo": "si_contribution"
          },
          "weakness": {
            "name": "意胜辞涩",
            "template": "wea_harmonious_manner",
            "manners": [
              "qingya",
              "qili"
            ],
            "retention": 1000,
            "altCondition": {
              "playerStyle": "ci",
              "extraShutdown": 1000
            },
            "fallback": {
              "useBestManner": "削弱30%"
            }
          },
          "intent": {
            "template": "int_manner_theme",
            "manners": [
              "zheli",
              "chenyu"
            ],
            "bias": 13000,
            "bottom": 7500,
            "description": "重立意，倾向哲理或沉郁"
          }
        },
        "difficultyRole": "advanced",
        "beginnerWeight": 20,
        "standardWeight": 100
      }
    ],
    "balanceVersion": 2,
    "difficultyBoost": {
      "allAttrs": 4,
      "wisdomExtra": 2
    }
  },
  {
    "id": "zhukaoguan",
    "tier": "主考官",
    "range": [
      10000,
      10000
    ],
    "desc": "殿试三场终极大考。六维总预算 148，关键能力进一步强化；三位考官各偏诗、词、笔，仍保留可读破绽与换策空间。",
    "npcs": [
      {
        "id": "wang_shilang",
        "name": "王侍郎",
        "title": "礼部侍郎",
        "style": "shi",
        "attrs": {
          "shi": 510,
          "ci": 250,
          "lian": 250,
          "bi": 250,
          "xue": 250,
          "si": 300
        },
        "mech": {
          "version": 1,
          "complexity": "cross_battle",
          "signature": {
            "name": "衡文察变",
            "template": "sig_palace_adapt",
            "maxLayers": 2,
            "perLayer": 1,
            "weaknessDampen": 2800,
            "minWeaknessRetention": 4500
          },
          "weakness": [
            {
              "name": "跨场换策",
              "template": "wea_cross_battle_shift",
              "layerReduce": 1
            },
            {
              "name": "定势可乘",
              "template": "wea_style_manner_combo",
              "style": "any",
              "manners": [
                "wanyue",
                "haofang"
              ],
              "retention": 3000,
              "playerBonus": 600
            }
          ],
          "intent": {
            "template": "int_palace_adapt",
            "style": "shi",
            "bias": 13000,
            "bottom": 7500,
            "description": "已根据上一场战况调整策略"
          }
        },
        "difficultyRole": "advanced",
        "beginnerWeight": 20,
        "standardWeight": 100
      },
      {
        "id": "li_xue_shi",
        "name": "李学士",
        "title": "翰林学士",
        "style": "ci",
        "attrs": {
          "shi": 270,
          "ci": 510,
          "lian": 250,
          "bi": 250,
          "xue": 250,
          "si": 280
        },
        "mech": {
          "version": 1,
          "complexity": "advanced",
          "signature": {
            "main": {
              "name": "殿试声律",
              "template": "sig_style_mastery",
              "style": "ci",
              "pct": 1200,
              "intentBias": 13000,
              "disclosure": "full"
            },
            "weak": {
              "name": "衡文稳卷",
              "template": "sig_steady_pressure",
              "floor": 4,
              "ceiling": 4
            }
          },
          "weakness": {
            "name": "重典轻境",
            "template": "wea_harmonious_manner",
            "manners": [
              "haofang",
              "zheli"
            ],
            "retention": 1000,
            "playerBonus": 0
          },
          "intent": {
            "template": "int_preferred_style",
            "style": "ci",
            "bias": 13000,
            "bottom": 7500,
            "description": "本场准备使用词体，以声律取胜"
          }
        },
        "difficultyRole": "advanced",
        "beginnerWeight": 20,
        "standardWeight": 100
      },
      {
        "id": "zhao_da_ru",
        "name": "赵大儒",
        "title": "国子监祭酒",
        "style": "bi",
        "attrs": {
          "shi": 250,
          "ci": 250,
          "lian": 250,
          "bi": 510,
          "xue": 250,
          "si": 300
        },
        "mech": {
          "version": 2,
          "complexity": "advanced",
          "signature": {
            "name": "经义定策",
            "template": "sig_declared_stance",
            "pct": 1000
          },
          "weakness": {
            "name": "因策破题",
            "template": "wea_stance_counter",
            "counter": {
              "attack": "base_dice",
              "steady": "one_extra",
              "turn": "change_style"
            },
            "retention": 1800,
            "playerBonus": 0
          },
          "intent": {
            "template": "int_declared_stance",
            "stance": "steady",
            "style": "bi",
            "bias": 12500,
            "bottom": 7600,
            "description": "本场先明守势经义，邀你以追加骰破其成规"
          }
        },
        "difficultyRole": "advanced",
        "beginnerWeight": 20,
        "standardWeight": 100
      },
      {
        "id": "kang_er_yu",
        "name": "康尔玉",
        "title": "联圣有继",
        "style": "lian",
        "weight": 10,
        "palaceForcedWhen": {
          "primary": "lian",
          "minExclusive": 35,
          "strictlyHigherThan": [
            "shi",
            "ci"
          ]
        },
        "stageForcedWhen": {
          "primary": "lian",
          "minExclusive": 35,
          "strictlyHigherThan": [
            "shi",
            "ci"
          ]
        },
        "attrs": {
          "shi": 230,
          "ci": 230,
          "lian": 550,
          "bi": 230,
          "xue": 630,
          "si": 260
        },
        "mech": {
          "signature": {
            "name": "偏联力专精",
            "template": "sig_style_mastery",
            "style": "lian",
            "pct": 600
          },
          "weakness": {
            "name": "改用他体",
            "template": "wea_use_other_style",
            "npcStyle": "lian",
            "fullClose": []
          },
          "intent": {
            "template": "int_preferred_style",
            "style": "lian",
            "bias": 14000,
            "bottom": 8500,
            "description": "本场准备使用联力体"
          }
        },
        "difficultyRole": "basic",
        "beginnerWeight": 10,
        "standardWeight": 10
      }
    ],
    "isFinal": true,
    "battles": 1,
    "themes": [
      "huaigu"
    ],
    "balanceVersion": 2,
    "difficultyBoost": {
      "allAttrs": 5,
      "wisdomExtra": 3
    }
  },
  {
    "id": "taohuaxian",
    "tier": "桃源终卷",
    "desc": "仅在隐藏终圈登场，不进入常规对手池。六维均衡，总和严格为 300。",
    "isHiddenFinal": true,
    "themes": [
      "huaigu"
    ],
    "npcs": [
      {
        "id": "chen_zhiwei",
        "name": "陈之微",
        "title": "桃花仙人",
        "weight": 0,
        "attrs": {
          "shi": 500,
          "ci": 500,
          "lian": 500,
          "bi": 500,
          "xue": 500,
          "si": 500
        },
        "stageForcedWhen": {
          "primary": "bi",
          "minExclusive": 58,
          "strictlyHigherThan": [
            "shi",
            "ci",
            "lian",
            "xue",
            "si"
          ]
        },
        "difficultyRole": "basic",
        "beginnerWeight": 0,
        "standardWeight": 0
      }
    ]
  }
];
