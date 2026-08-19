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
          "shi": 10,
          "ci": 4,
          "lian": 3,
          "bi": 4,
          "xue": 4,
          "si": 3
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
          "shi": 4,
          "ci": 10,
          "lian": 3,
          "bi": 4,
          "xue": 3,
          "si": 4
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
          "shi": 4,
          "ci": 3,
          "lian": 10,
          "bi": 3,
          "xue": 4,
          "si": 4
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
          "shi": 4,
          "ci": 4,
          "lian": 3,
          "bi": 10,
          "xue": 3,
          "si": 4
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
          "shi": 4,
          "ci": 3,
          "lian": 4,
          "bi": 4,
          "xue": 10,
          "si": 3
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
          "shi": 3,
          "ci": 4,
          "lian": 4,
          "bi": 4,
          "xue": 3,
          "si": 10
        },
        "mech": {
          "version": 1,
          "complexity": "basic",
          "signature": {
            "name": "临题学样",
            "template": "sig_copycat",
            "style": "si",
            "pct": 0.06,
            "historyLen": 2,
            "noHistory": "fallback_preferred"
          },
          "weakness": {
            "name": "不善变化",
            "template": "wea_base_dice_only",
            "flat": 6,
            "playerBonus": 0
          },
          "intent": {
            "template": "int_copycat",
            "style": "si",
            "bias": 1.3,
            "bottom": 0.85,
            "description": "准备仿你近日常用路数"
          }
        }
      }
    ]
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
          "shi": 15,
          "ci": 9,
          "lian": 5,
          "bi": 9,
          "xue": 6,
          "si": 6
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
          "shi": 6,
          "ci": 15,
          "lian": 5,
          "bi": 6,
          "xue": 9,
          "si": 9
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
          "shi": 6,
          "ci": 9,
          "lian": 15,
          "bi": 6,
          "xue": 6,
          "si": 6
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
          "shi": 6,
          "ci": 6,
          "lian": 5,
          "bi": 15,
          "xue": 9,
          "si": 9
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
          "shi": 9,
          "ci": 6,
          "lian": 6,
          "bi": 6,
          "xue": 15,
          "si": 6
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
          "shi": 6,
          "ci": 9,
          "lian": 6,
          "bi": 6,
          "xue": 6,
          "si": 15
        },
        "mech": {
          "version": 1,
          "complexity": "advanced",
          "signature": {
            "name": "观风择势",
            "template": "sig_dice_response",
            "steps": [
              14,
              9,
              4
            ],
            "cap": 22,
            "altAction": {
              "trigger": "playerExtraDice>=1",
              "switchTo": "strong_attack"
            }
          },
          "weakness": {
            "name": "心浮气躁",
            "template": "wea_base_dice_only",
            "flat": 12,
            "playerBonus": 0
          },
          "intent": {
            "template": "int_dice_response",
            "style": "si",
            "bias": 1.25,
            "bottom": 0.8,
            "description": "正常应战；若你追加骰，则顺势强攻"
          }
        }
      }
    ]
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
          "shi": 27,
          "ci": 14,
          "lian": 11,
          "bi": 14,
          "xue": 13,
          "si": 11
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
          "shi": 13,
          "ci": 27,
          "lian": 11,
          "bi": 13,
          "xue": 14,
          "si": 12
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
          "shi": 13,
          "ci": 14,
          "lian": 27,
          "bi": 11,
          "xue": 13,
          "si": 12
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
          "shi": 13,
          "ci": 13,
          "lian": 11,
          "bi": 27,
          "xue": 14,
          "si": 12
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
          "shi": 14,
          "ci": 13,
          "lian": 13,
          "bi": 12,
          "xue": 27,
          "si": 11
        },
        "mech": {
          "version": 1,
          "complexity": "advanced",
          "signature": {
            "name": "博闻压题",
            "template": "sig_repeat_read",
            "pct": 0.09,
            "firstBattle": "disabled"
          },
          "weakness": {
            "name": "泥于所闻",
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
            "bottom": 0.78,
            "historyAware": true,
            "description": "本场沿用你上一场路数"
          }
        }
      },
      {
        "id": "bai_wen_yuan",
        "name": "白文渊",
        "title": "秋闱中式",
        "style": "si",
        "attrs": {
          "shi": 13,
          "ci": 14,
          "lian": 13,
          "bi": 12,
          "xue": 11,
          "si": 27
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
      }
    ]
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
          "shi": 33,
          "ci": 17,
          "lian": 15,
          "bi": 17,
          "xue": 17,
          "si": 18
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
          "shi": 18,
          "ci": 33,
          "lian": 15,
          "bi": 17,
          "xue": 17,
          "si": 17
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
          "shi": 17,
          "ci": 17,
          "lian": 33,
          "bi": 15,
          "xue": 17,
          "si": 18
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
          "shi": 17,
          "ci": 17,
          "lian": 15,
          "bi": 33,
          "xue": 17,
          "si": 18
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
          "shi": 18,
          "ci": 17,
          "lian": 17,
          "bi": 15,
          "xue": 33,
          "si": 17
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
          "shi": 17,
          "ci": 18,
          "lian": 17,
          "bi": 15,
          "xue": 17,
          "si": 33
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
    ]
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
          "shi": 46,
          "ci": 20,
          "lian": 20,
          "bi": 20,
          "xue": 20,
          "si": 22
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
          "shi": 22,
          "ci": 46,
          "lian": 20,
          "bi": 20,
          "xue": 20,
          "si": 20
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
          "shi": 20,
          "ci": 20,
          "lian": 20,
          "bi": 46,
          "xue": 20,
          "si": 22
        },
        "mech": {
          "version": 1,
          "complexity": "advanced",
          "signature": {
            "name": "经义稳卷",
            "template": "sig_steady_pressure",
            "floor": 9,
            "ceiling": 5,
            "floorPct": 0.07
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
            "description": "本场求稳，严守经义法度"
          }
        }
      },
      {
        "id": "",
        "name": "康尔玉",
        "title": "联圣有继",
        "style": "lian",
        "weight": 10,
        "attrs": {
          "shi": 18,
          "ci": 18,
          "lian": 50,
          "bi": 18,
          "xue": 58,
          "si": 18
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
    ]
  }
];
