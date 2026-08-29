/* 飞花棋游戏原始 NPC（config/npcs.json）。作为编辑器默认种子数据。由游戏配置同步生成，请勿手工改动 —— 在编辑器内管理后导出即可覆盖。 */
window.GAME_NPCS = [
  {
    "id": "tongsheng",
    "tier": "童生级",
    "range": [
      0,
      0.25
    ],
    "desc": "乡试圈前半登场。刚进学的蒙童，字还写不周正，专为送你一点信心。各有所偏，遇到偏科的同窗最好用所长击之。",
    "npcs": [
      {
        "id": "zhou_xiaoman",
        "name": "周小满",
        "title": "蒙学童子",
        "style": "shi",
        "attrs": {
          "shi": 11,
          "ci": 5,
          "lian": 4,
          "bi": 5,
          "xue": 5,
          "si": 5
        },
        "mech": {
          "version": 1,
          "complexity": "tutorial",
          "signature": {
            "name": "诗兴初发",
            "template": "sig_style_mastery",
            "style": "shi",
            "pct": 0.06,
            "intentBias": 1.5,
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
              "retention": 0.5
            },
            "playerBonus": 0
          },
          "intent": {
            "template": "int_preferred_style",
            "style": "shi",
            "bias": 1.5,
            "bottom": 0.85,
            "noAntiRepeat": true,
            "description": "本场准备使用诗体"
          }
        }
      },
      {
        "id": "chen_yanqiu",
        "name": "陈砚秋",
        "title": "村塾学子",
        "style": "ci",
        "attrs": {
          "shi": 5,
          "ci": 11,
          "lian": 4,
          "bi": 5,
          "xue": 4,
          "si": 6
        },
        "mech": {
          "version": 1,
          "complexity": "tutorial",
          "signature": {
            "name": "婉约稳进",
            "template": "sig_style_mastery",
            "style": "ci",
            "pct": 0.06,
            "intentBias": 1.5,
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
              "retention": 0.5
            },
            "playerBonus": 0.08
          },
          "intent": {
            "template": "int_preferred_style",
            "style": "ci",
            "bias": 1.5,
            "bottom": 0.85,
            "noAntiRepeat": true,
            "description": "本场准备使用词体"
          }
        }
      },
      {
        "id": "wu_shuang_er",
        "name": "吴双儿",
        "title": "启蒙幼童",
        "style": "lian",
        "attrs": {
          "shi": 5,
          "ci": 4,
          "lian": 11,
          "bi": 4,
          "xue": 5,
          "si": 6
        },
        "mech": {
          "version": 1,
          "complexity": "tutorial",
          "signature": {
            "name": "对仗追随",
            "template": "sig_style_mastery",
            "style": "lian",
            "pct": 0.06,
            "intentBias": 1.4,
            "disclosure": "full"
          },
          "weakness": {
            "name": "泥于绳墨",
            "template": "wea_harmonious_manner",
            "manners": [
              "wanyue",
              "qingya"
            ],
            "retention": 0.1,
            "playerBonus": 0.08
          },
          "intent": {
            "template": "int_preferred_style",
            "style": "lian",
            "bias": 1.4,
            "bottom": 0.85,
            "noAntiRepeat": true,
            "description": "本场准备使用联体"
          }
        }
      },
      {
        "id": "sun_a_niu",
        "name": "孙阿牛",
        "title": "私塾蒙童",
        "style": "bi",
        "attrs": {
          "shi": 5,
          "ci": 5,
          "lian": 4,
          "bi": 11,
          "xue": 4,
          "si": 6
        },
        "mech": {
          "version": 1,
          "complexity": "tutorial",
          "signature": {
            "name": "字稳卷平",
            "template": "sig_steady_pressure",
            "floor": 4,
            "ceiling": 4,
            "floorPct": 0.04
          },
          "weakness": {
            "name": "怕大场面",
            "template": "wea_crushing_win",
            "threshold": 0.18,
            "refund": 0,
            "playerBonus": 0
          },
          "intent": {
            "template": "int_steady",
            "style": "bi",
            "bias": 1.2,
            "bottom": 0.85,
            "description": "本场求稳，降低波动"
          }
        }
      },
      {
        "id": "qian_xiao_yi",
        "name": "钱小乙",
        "title": "初学蒙生",
        "style": "xue",
        "attrs": {
          "shi": 5,
          "ci": 4,
          "lian": 5,
          "bi": 5,
          "xue": 11,
          "si": 5
        },
        "mech": {
          "version": 1,
          "complexity": "basic",
          "signature": {
            "name": "熟题先机",
            "template": "sig_repeat_read",
            "pct": 0.06,
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
            "bias": 1.3,
            "bottom": 0.85,
            "historyAware": true,
            "description": "本场准备沿用上一场路数"
          }
        }
      },
      {
        "id": "li_mo_tong",
        "name": "李墨童",
        "title": "开蒙学童",
        "style": "si",
        "attrs": {
          "shi": 4,
          "ci": 5,
          "lian": 5,
          "bi": 5,
          "xue": 4,
          "si": 12
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
            "pct": 0.05
          },
          "weakness": {
            "name": "逆潮见真",
            "template": "wea_go_against_zeitgeist",
            "minAffinity": 0,
            "retention": 0.3,
            "playerBonus": 0.02
          },
          "intent": {
            "template": "int_zeitgeist",
            "style": "si",
            "bias": 1.1,
            "bottom": 0.82,
            "description": "本场随先生所尚的文风试笔"
          }
        }
      },
      {
        "id": "shen_sui_feng",
        "name": "沈随风",
        "title": "县学秀才",
        "style": "ci",
        "focusAttr": "xue",
        "attrs": {
          "shi": 10,
          "ci": 15,
          "lian": 8,
          "bi": 10,
          "xue": 15,
          "si": 13
        },
        "mech": {
          "version": 2,
          "complexity": "advanced",
          "signature": {
            "name": "借风成势",
            "template": "sig_zeitgeist_surf",
            "pct": 0.08
          },
          "weakness": {
            "name": "逆潮立骨",
            "template": "wea_go_against_zeitgeist",
            "minAffinity": 0,
            "retention": 0.2,
            "playerBonus": 0.03
          },
          "intent": {
            "template": "int_zeitgeist",
            "style": "ci",
            "bias": 1.15,
            "bottom": 0.8,
            "description": "本场顺应当朝风潮，以得势文风行文"
          }
        }
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
      0.25,
      0.5
    ],
    "desc": "乡试圈后半登场。已入庠序的秀才，有来有回，赢下靠的是稳。六人各擅一体，摸清谁偏哪门再出手。",
    "npcs": [
      {
        "id": "zhang_xiucai",
        "name": "张秀才",
        "title": "庠序生员",
        "style": "shi",
        "attrs": {
          "shi": 17,
          "ci": 11,
          "lian": 7,
          "bi": 11,
          "xue": 8,
          "si": 9
        },
        "mech": {
          "version": 1,
          "complexity": "basic",
          "signature": {
            "name": "工稳守卷",
            "template": "sig_steady_pressure",
            "floor": 5,
            "ceiling": 5,
            "floorPct": 0.045
          },
          "weakness": {
            "name": "怯于变化",
            "template": "wea_crushing_win",
            "threshold": 0.18,
            "refund": 0,
            "playerBonus": 0
          },
          "intent": {
            "template": "int_steady",
            "style": "shi",
            "bias": 1.2,
            "bottom": 0.8,
            "description": "本场求稳，降低波动"
          }
        }
      },
      {
        "id": "huang_ming_yuan",
        "name": "黄明远",
        "title": "县学秀才",
        "style": "ci",
        "attrs": {
          "shi": 8,
          "ci": 17,
          "lian": 7,
          "bi": 8,
          "xue": 11,
          "si": 12
        },
        "mech": {
          "version": 1,
          "complexity": "basic",
          "signature": {
            "name": "声律相持",
            "template": "sig_style_mastery",
            "style": "ci",
            "pct": 0.08,
            "intentBias": 1.3,
            "disclosure": "full"
          },
          "weakness": {
            "name": "词丽辞平",
            "template": "wea_harmonious_manner",
            "manners": [
              "zheli",
              "qingya"
            ],
            "retention": 0.1,
            "playerBonus": 0.08
          },
          "intent": {
            "template": "int_preferred_style",
            "style": "ci",
            "bias": 1.3,
            "bottom": 0.8,
            "description": "本场准备使用词体"
          }
        }
      },
      {
        "id": "lin_qingzhai",
        "name": "林清斋",
        "title": "儒学生员",
        "style": "lian",
        "attrs": {
          "shi": 8,
          "ci": 11,
          "lian": 17,
          "bi": 8,
          "xue": 8,
          "si": 9
        },
        "mech": {
          "version": 1,
          "complexity": "basic",
          "signature": {
            "name": "熟读成诵",
            "template": "sig_repeat_read",
            "pct": 0.08,
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
            "bias": 1.3,
            "bottom": 0.8,
            "historyAware": true,
            "description": "本场仍偏好联体"
          }
        }
      },
      {
        "id": "zhao_wen_bin",
        "name": "赵文彬",
        "title": "府学秀才",
        "style": "bi",
        "attrs": {
          "shi": 8,
          "ci": 8,
          "lian": 7,
          "bi": 17,
          "xue": 11,
          "si": 12
        },
        "mech": {
          "version": 1,
          "complexity": "basic",
          "signature": {
            "name": "观你旧辙",
            "template": "sig_repeat_read",
            "pct": 0.07,
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
            "bias": 1.3,
            "bottom": 0.8,
            "historyAware": true,
            "description": "本场沿用你上一场路数"
          }
        }
      },
      {
        "id": "zheng_shu_yu",
        "name": "郑书玉",
        "title": "廪膳生员",
        "style": "xue",
        "attrs": {
          "shi": 11,
          "ci": 8,
          "lian": 8,
          "bi": 8,
          "xue": 17,
          "si": 9
        },
        "mech": {
          "version": 1,
          "complexity": "advanced",
          "signature": {
            "name": "引经据典",
            "template": "sig_copycat",
            "style": "xue",
            "pct": 0.08,
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
              "retention": 0.5
            },
            "playerBonus": 0.08
          },
          "intent": {
            "template": "int_copycat",
            "style": "xue",
            "bias": 1.3,
            "bottom": 0.8,
            "description": "准备仿你近日常用路数"
          }
        }
      },
      {
        "id": "wang_han_sheng",
        "name": "王翰生",
        "title": "邑庠秀才",
        "style": "si",
        "attrs": {
          "shi": 8,
          "ci": 11,
          "lian": 8,
          "bi": 8,
          "xue": 8,
          "si": 18
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
            "pct": 0.08
          },
          "weakness": {
            "name": "藏锋待机",
            "template": "wea_hold_active_talent",
            "retention": 0.3,
            "playerBonus": 0
          },
          "intent": {
            "template": "int_active_watch",
            "style": "si",
            "bias": 1.15,
            "bottom": 0.8,
            "description": "本场留心你的主动文心，待其发动再作应答"
          }
        }
      },
      {
        "id": "xie_lian_cheng",
        "name": "谢连城",
        "title": "贡院举人",
        "style": "lian",
        "focusAttr": "bi",
        "attrs": {
          "shi": 17,
          "ci": 17,
          "lian": 30,
          "bi": 22,
          "xue": 18,
          "si": 19
        },
        "mech": {
          "version": 2,
          "complexity": "advanced",
          "signature": {
            "name": "审律摘瑕",
            "template": "sig_dice_pattern_hunt",
            "pattern": "pair",
            "pct": 0.09
          },
          "weakness": {
            "name": "收束成篇",
            "template": "wea_limited_extra_dice",
            "maxExtraDice": 1,
            "retention": 0.25,
            "playerBonus": 0
          },
          "intent": {
            "template": "int_pattern_hunt",
            "pattern": "pair",
            "style": "lian",
            "bias": 1.25,
            "bottom": 0.78,
            "description": "本场专审重复骰面，待你落笔露瑕"
          }
        }
      },
      {
        "id": "gu_qing_shang",
        "name": "顾清商",
        "title": "会试举人",
        "style": "ci",
        "focusAttr": "si",
        "attrs": {
          "shi": 18,
          "ci": 28,
          "lian": 16,
          "bi": 17,
          "xue": 17,
          "si": 21
        },
        "mech": {
          "version": 2,
          "complexity": "advanced",
          "signature": {
            "name": "先声定策",
            "template": "sig_declared_stance",
            "pct": 0.09
          },
          "weakness": {
            "name": "对策破锋",
            "template": "wea_stance_counter",
            "counter": {
              "attack": "base_dice",
              "steady": "one_extra",
              "turn": "change_style"
            },
            "retention": 0.2,
            "playerBonus": 0.04
          },
          "intent": {
            "template": "int_declared_stance",
            "stance": "steady",
            "style": "ci",
            "bias": 1.25,
            "bottom": 0.78,
            "description": "本场稳守成卷，邀你以一枚追加骰破势"
          }
        }
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
      0.5,
      0.75
    ],
    "desc": "会试中坚。六维总预算提升至 90，偏科优势更明确；开始要求玩家利用相性与破绽，而非只靠属性碾压。",
    "npcs": [
      {
        "id": "fan_jieyuan",
        "name": "范解元",
        "title": "乡试解元",
        "style": "shi",
        "attrs": {
          "shi": 30,
          "ci": 17,
          "lian": 14,
          "bi": 17,
          "xue": 16,
          "si": 16
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
            "bias": 1.35,
            "bottom": 0.78,
            "description": "正常应战；若玩家追加骰，则争先强攻"
          }
        }
      },
      {
        "id": "su_mingzhe",
        "name": "苏明哲",
        "title": "公车举人",
        "style": "ci",
        "attrs": {
          "shi": 16,
          "ci": 30,
          "lian": 14,
          "bi": 16,
          "xue": 17,
          "si": 17
        },
        "mech": {
          "version": 1,
          "complexity": "advanced",
          "signature": {
            "name": "依样裁词",
            "template": "sig_copycat",
            "style": "ci",
            "pct": 0.08,
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
              "retention": 0.5
            },
            "playerBonus": 0
          },
          "intent": {
            "template": "int_copycat",
            "style": "ci",
            "bias": 1.3,
            "bottom": 0.78,
            "description": "准备模仿你近日常用路数"
          }
        }
      },
      {
        "id": "lu_yun_ting",
        "name": "陆云亭",
        "title": "鹿鸣宴客",
        "style": "lian",
        "attrs": {
          "shi": 16,
          "ci": 17,
          "lian": 30,
          "bi": 14,
          "xue": 16,
          "si": 17
        },
        "mech": {
          "version": 1,
          "complexity": "advanced",
          "signature": {
            "name": "对答如流",
            "template": "sig_style_mastery",
            "style": "lian",
            "pct": 0.09,
            "intentBias": 1.3,
            "disclosure": "full"
          },
          "weakness": {
            "name": "意止于对",
            "template": "wea_harmonious_manner",
            "manners": [
              "haofang",
              "zheli"
            ],
            "retention": 0.1,
            "playerBonus": 0.08
          },
          "intent": {
            "template": "int_preferred_style",
            "style": "lian",
            "bias": 1.3,
            "bottom": 0.78,
            "description": "本场准备使用联体，以对仗相迎"
          }
        }
      },
      {
        "id": "han_shi_chang",
        "name": "韩世昌",
        "title": "乙榜举人",
        "style": "bi",
        "attrs": {
          "shi": 16,
          "ci": 16,
          "lian": 14,
          "bi": 30,
          "xue": 17,
          "si": 17
        },
        "mech": {
          "version": 1,
          "complexity": "advanced",
          "signature": {
            "name": "章法成城",
            "template": "sig_steady_pressure",
            "floor": 7,
            "ceiling": 6,
            "floorPct": 0.05
          },
          "weakness": {
            "name": "惧高压",
            "template": "wea_crushing_win",
            "threshold": 0.18,
            "refund": 0,
            "playerBonus": 0
          },
          "intent": {
            "template": "int_steady",
            "style": "bi",
            "bias": 1.2,
            "bottom": 0.78,
            "description": "本场求稳，严守章法"
          }
        }
      },
      {
        "id": "tang_ji_qing",
        "name": "唐季卿",
        "title": "孝廉举人",
        "style": "xue",
        "attrs": {
          "shi": 17,
          "ci": 16,
          "lian": 16,
          "bi": 15,
          "xue": 30,
          "si": 16
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
            "pct": 0.1
          },
          "weakness": {
            "name": "收卷定篇",
            "template": "wea_limited_extra_dice",
            "maxExtraDice": 1,
            "retention": 0.22,
            "playerBonus": 0
          },
          "intent": {
            "template": "int_pattern_hunt",
            "pattern": "pair",
            "style": "xue",
            "bias": 1.28,
            "bottom": 0.78,
            "description": "本场专审对偶章法，静候你骰组露出规整痕迹"
          }
        }
      },
      {
        "id": "bai_wen_yuan",
        "name": "白文渊",
        "title": "秋闱中式",
        "style": "si",
        "attrs": {
          "shi": 16,
          "ci": 17,
          "lian": 16,
          "bi": 15,
          "xue": 14,
          "si": 32
        },
        "mech": {
          "version": 1,
          "complexity": "advanced",
          "signature": {
            "name": "察势转锋",
            "template": "sig_copycat",
            "style": "si",
            "pct": 0.09,
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
              "retention": 0.5
            },
            "playerBonus": 0.08
          },
          "intent": {
            "template": "int_copycat",
            "style": "si",
            "bias": 1.3,
            "bottom": 0.78,
            "description": "准备仿你近日常用路数，相机转锋"
          }
        }
      },
      {
        "id": "cui_wu_jiu",
        "name": "崔无咎",
        "title": "监察进士",
        "style": "shi",
        "focusAttr": "si",
        "attrs": {
          "shi": 24,
          "ci": 22,
          "lian": 21,
          "bi": 23,
          "xue": 22,
          "si": 35
        },
        "mech": {
          "version": 2,
          "complexity": "advanced",
          "signature": {
            "name": "截脉问锋",
            "template": "sig_active_talent_tax",
            "pct": 0.11
          },
          "weakness": {
            "name": "藏锋守拙",
            "template": "wea_hold_active_talent",
            "retention": 0.25,
            "playerBonus": 0
          },
          "intent": {
            "template": "int_active_watch",
            "style": "shi",
            "bias": 1.2,
            "bottom": 0.75,
            "description": "本场紧盯主动文心的起落，伺机问锋"
          }
        }
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
      0.75,
      1
    ],
    "desc": "高阶名家。六维总预算提升至 117，并强化招牌能力；需要稳定构筑与资源规划，低级档不随之上涨。",
    "npcs": [
      {
        "id": "ouyang_han",
        "name": "欧阳翰",
        "title": "殿前进士",
        "style": "shi",
        "attrs": {
          "shi": 37,
          "ci": 21,
          "lian": 19,
          "bi": 21,
          "xue": 21,
          "si": 24
        },
        "mech": {
          "version": 1,
          "complexity": "advanced",
          "signature": {
            "main": {
              "name": "文债催人",
              "template": "sig_debt_drain",
              "threshold": 0.12,
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
            "threshold": 0.18,
            "refund": 1,
            "playerBonus": 0
          },
          "intent": {
            "template": "int_steady",
            "style": "shi",
            "bias": 1.25,
            "bottom": 0.75,
            "description": "准备稳稿压人"
          }
        }
      },
      {
        "id": "si_ma_wen",
        "name": "司马文",
        "title": "同进士出身",
        "style": "ci",
        "attrs": {
          "shi": 22,
          "ci": 37,
          "lian": 19,
          "bi": 21,
          "xue": 21,
          "si": 23
        },
        "mech": {
          "version": 1,
          "complexity": "advanced",
          "signature": {
            "name": "曲折藏锋",
            "template": "sig_style_mastery",
            "style": "ci",
            "pct": 0.11,
            "intentBias": 1.3,
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
            "retention": 0.1,
            "playerBonus": 0.08
          },
          "intent": {
            "template": "int_preferred_style",
            "style": "ci",
            "bias": 1.3,
            "bottom": 0.75,
            "description": "本场准备使用词体"
          }
        }
      },
      {
        "id": "shang_guan_ming",
        "name": "上官明",
        "title": "进士及第",
        "style": "lian",
        "attrs": {
          "shi": 21,
          "ci": 21,
          "lian": 37,
          "bi": 19,
          "xue": 21,
          "si": 24
        },
        "mech": {
          "version": 1,
          "complexity": "advanced",
          "signature": {
            "name": "双关设伏",
            "template": "sig_copycat",
            "style": "lian",
            "pct": 0.11,
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
              "retention": 0.5
            },
            "playerBonus": 0.08
          },
          "intent": {
            "template": "int_copycat",
            "style": "lian",
            "bias": 1.3,
            "bottom": 0.75,
            "description": "准备仿你近日常用路数"
          }
        }
      },
      {
        "id": "xia_hou_jin",
        "name": "夏侯瑾",
        "title": "翰林庶吉士",
        "style": "bi",
        "attrs": {
          "shi": 21,
          "ci": 21,
          "lian": 19,
          "bi": 37,
          "xue": 21,
          "si": 24
        },
        "mech": {
          "version": 1,
          "complexity": "advanced",
          "signature": {
            "name": "翰林稳卷",
            "template": "sig_steady_pressure",
            "floor": 8,
            "ceiling": 6,
            "floorPct": 0.06
          },
          "weakness": {
            "name": "忌被压卷",
            "template": "wea_crushing_win",
            "threshold": 0.18,
            "refund": 1,
            "playerBonus": 0
          },
          "intent": {
            "template": "int_steady",
            "style": "bi",
            "bias": 1.2,
            "bottom": 0.75,
            "description": "本场求稳，严守翰苑章法"
          }
        }
      },
      {
        "id": "mu_rong_yu",
        "name": "慕容玉",
        "title": "赐进士出身",
        "style": "xue",
        "attrs": {
          "shi": 22,
          "ci": 21,
          "lian": 21,
          "bi": 19,
          "xue": 37,
          "si": 23
        },
        "mech": {
          "version": 1,
          "complexity": "advanced",
          "signature": {
            "name": "科场博洽",
            "template": "sig_repeat_read",
            "pct": 0.11,
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
            "bias": 1.3,
            "bottom": 0.75,
            "historyAware": true,
            "description": "本场沿用你上一场路数"
          }
        }
      },
      {
        "id": "yuwen_yuan",
        "name": "宇文渊",
        "title": "甲科进士",
        "style": "si",
        "attrs": {
          "shi": 21,
          "ci": 22,
          "lian": 21,
          "bi": 19,
          "xue": 21,
          "si": 39
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
            "pct": 0.12,
            "cap": 0.1,
            "applyTo": "si_contribution"
          },
          "weakness": {
            "name": "意胜辞涩",
            "template": "wea_harmonious_manner",
            "manners": [
              "qingya",
              "qili"
            ],
            "retention": 0.1,
            "altCondition": {
              "playerStyle": "ci",
              "extraShutdown": 0.1
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
            "bias": 1.3,
            "bottom": 0.75,
            "description": "重立意，倾向哲理或沉郁"
          }
        }
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
      1,
      1
    ],
    "desc": "殿试三场终极大考。六维总预算 148，关键能力进一步强化；三位考官各偏诗、词、笔，仍保留可读破绽与换策空间。",
    "npcs": [
      {
        "id": "wang_shilang",
        "name": "王侍郎",
        "title": "礼部侍郎",
        "style": "shi",
        "attrs": {
          "shi": 51,
          "ci": 25,
          "lian": 25,
          "bi": 25,
          "xue": 25,
          "si": 30
        },
        "mech": {
          "version": 1,
          "complexity": "cross_battle",
          "signature": {
            "name": "衡文察变",
            "template": "sig_palace_adapt",
            "maxLayers": 2,
            "perLayer": 1,
            "weaknessDampen": 0.28,
            "minWeaknessRetention": 0.45
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
              "retention": 0.3,
              "playerBonus": 0.06
            }
          ],
          "intent": {
            "template": "int_palace_adapt",
            "style": "shi",
            "bias": 1.3,
            "bottom": 0.75,
            "description": "已根据上一场战况调整策略"
          }
        }
      },
      {
        "id": "li_xue_shi",
        "name": "李学士",
        "title": "翰林学士",
        "style": "ci",
        "attrs": {
          "shi": 27,
          "ci": 51,
          "lian": 25,
          "bi": 25,
          "xue": 25,
          "si": 28
        },
        "mech": {
          "version": 1,
          "complexity": "advanced",
          "signature": {
            "main": {
              "name": "殿试声律",
              "template": "sig_style_mastery",
              "style": "ci",
              "pct": 0.12,
              "intentBias": 1.3,
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
            "retention": 0.1,
            "playerBonus": 0.08
          },
          "intent": {
            "template": "int_preferred_style",
            "style": "ci",
            "bias": 1.3,
            "bottom": 0.75,
            "description": "本场准备使用词体，以声律取胜"
          }
        }
      },
      {
        "id": "zhao_da_ru",
        "name": "赵大儒",
        "title": "国子监祭酒",
        "style": "bi",
        "attrs": {
          "shi": 25,
          "ci": 25,
          "lian": 25,
          "bi": 51,
          "xue": 25,
          "si": 30
        },
        "mech": {
          "version": 2,
          "complexity": "advanced",
          "signature": {
            "name": "经义定策",
            "template": "sig_declared_stance",
            "pct": 0.1
          },
          "weakness": {
            "name": "因策破题",
            "template": "wea_stance_counter",
            "counter": {
              "attack": "base_dice",
              "steady": "one_extra",
              "turn": "change_style"
            },
            "retention": 0.18,
            "playerBonus": 0.05
          },
          "intent": {
            "template": "int_declared_stance",
            "stance": "steady",
            "style": "bi",
            "bias": 1.25,
            "bottom": 0.76,
            "description": "本场先明守势经义，邀你以追加骰破其成规"
          }
        }
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
          "shi": 23,
          "ci": 23,
          "lian": 55,
          "bi": 23,
          "xue": 63,
          "si": 26
        },
        "mech": {
          "signature": {
            "name": "偏联力专精",
            "template": "sig_style_mastery",
            "style": "lian",
            "pct": 0.06
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
            "bias": 1.4,
            "bottom": 0.85,
            "description": "本场准备使用联力体"
          }
        }
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
          "shi": 50,
          "ci": 50,
          "lian": 50,
          "bi": 50,
          "xue": 50,
          "si": 50
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
        }
      }
    ]
  }
];
