/* 支线限定内容种子：路线 NPC 与文心统一由游戏配置同步。 */
// 专属 NPC 不进入普通 NPC 池；这是第三幕/终局的独立配置块。window.GAME_SIDEQUEST_NPCS = {
  "version": 1,
  "routes": {
    "jianghu": {
      "guides": [
        {
          "id": "jh_liu_zhaoying",
          "name": "柳照影",
          "title": "负剑书客",
          "role": "引路人",
          "text": "负剑而来，只问你此诺为何。"
        }
      ],
      "climax": {
        "id": "jh_gu_changfeng",
        "name": "顾长风",
        "title": "群英盟主",
        "style": "bi",
        "attrs": {
          "shi": 25,
          "ci": 25,
          "lian": 51,
          "bi": 25,
          "xue": 25,
          "si": 30
        },
        "mech": {
          "version": 2,
          "complexity": "advanced",
          "signature": {
            "name": "盟约先声",
            "template": "sig_declared_stance",
            "pct": 0.08
          },
          "weakness": {
            "name": "对策破锋",
            "template": "wea_stance_counter",
            "counter": {
              "oath": "change_style"
            },
            "retention": 0.2,
            "playerBonus": 0.04
          },
          "intent": {
            "template": "int_declared_stance",
            "stance": "oath",
            "style": "lian",
            "bias": 1.25,
            "bottom": 0.76,
            "description": "先明盟约，再以联体聚众声"
          }
        }
      },
      "final": {
        "primaryId": "jh_gu_changfeng",
        "secondary": {
          "same_first": {
            "id": "jh_wen_suxin",
            "name": "闻素心",
            "title": "盟誓录事",
            "style": "shi",
            "attrs": {
              "shi": 25,
              "ci": 25,
              "lian": 51,
              "bi": 25,
              "xue": 25,
              "si": 30
            },
            "mech": {
              "version": 2,
              "complexity": "advanced",
              "signature": {
                "name": "盟誓先声",
                "template": "sig_declared_stance",
                "pct": 0.1
              },
              "weakness": {
                "name": "换式辨义",
                "template": "wea_stance_counter",
                "counter": {
                  "oath": "change_style"
                },
                "retention": 0.2,
                "playerBonus": 0.04
              },
              "intent": {
                "template": "int_declared_stance",
                "stance": "oath",
                "style": "shi",
                "bias": 1.25,
                "bottom": 0.76,
                "description": "守义之诺，须以异体辨其真伪"
              }
            }
          },
          "same_second": {
            "id": "jh_wen_suxin",
            "name": "闻素心",
            "title": "盟誓录事",
            "style": "ci",
            "attrs": {
              "shi": 25,
              "ci": 51,
              "lian": 25,
              "bi": 25,
              "xue": 30,
              "si": 25
            },
            "mech": {
              "version": 2,
              "complexity": "advanced",
              "signature": {
                "name": "权衡先声",
                "template": "sig_declared_stance",
                "pct": 0.1
              },
              "weakness": {
                "name": "藏锋守拙",
                "template": "wea_hold_active_talent",
                "retention": 0.2,
                "playerBonus": 0.04
              },
              "intent": {
                "template": "int_declared_stance",
                "stance": "expedience",
                "style": "ci",
                "bias": 1.25,
                "bottom": 0.76,
                "description": "权变之策，留意你是否借文心取巧"
              }
            }
          },
          "mixed": {
            "id": "jh_wen_suxin",
            "name": "闻素心",
            "title": "盟誓录事",
            "style": "lian",
            "attrs": {
              "shi": 25,
              "ci": 25,
              "lian": 51,
              "bi": 25,
              "xue": 25,
              "si": 30
            },
            "mech": {
              "version": 2,
              "complexity": "advanced",
              "signature": {
                "name": "两难先声",
                "template": "sig_declared_stance",
                "pct": 0.08
              },
              "weakness": {
                "name": "一骰破锋",
                "template": "wea_stance_counter",
                "counter": {
                  "balance": "one_extra"
                },
                "retention": 0.2,
                "playerBonus": 0.04
              },
              "intent": {
                "template": "int_declared_stance",
                "stance": "balance",
                "style": "lian",
                "bias": 1.25,
                "bottom": 0.76,
                "description": "两难并陈，恰以一枚追加骰破其势"
              }
            }
          }
        }
      }
    },
    "biansai": {
      "guides": [
        {
          "id": "bs_qi_yanhui",
          "name": "戚雁回",
          "title": "关驿校书",
          "role": "引路人",
          "text": "残报难全，仍有人要替万里关山落字。"
        }
      ],
      "climax": {
        "id": "bs_pei_zhenyue",
        "name": "裴镇岳",
        "title": "安边都护",
        "style": "bi",
        "attrs": {
          "shi": 25,
          "ci": 25,
          "lian": 25,
          "bi": 51,
          "xue": 30,
          "si": 25
        },
        "mech": {
          "version": 2,
          "complexity": "advanced",
          "signature": {
            "name": "军令如山",
            "template": "sig_steady_pressure",
            "floor": 4,
            "ceiling": 4
          },
          "weakness": {
            "name": "压卷破阵",
            "template": "wea_crushing_win",
            "threshold": 0.18,
            "refund": 1
          },
          "intent": {
            "template": "int_preferred_style",
            "style": "bi",
            "bias": 1.3,
            "bottom": 0.75,
            "description": "以笔力稳守军令"
          }
        }
      },
      "final": {
        "primaryId": "bs_pei_zhenyue",
        "secondary": {
          "same_first": {
            "id": "bs_han_zhaoshuang",
            "name": "韩照霜",
            "title": "军司录事",
            "style": "bi",
            "attrs": {
              "shi": 25,
              "ci": 25,
              "lian": 25,
              "bi": 51,
              "xue": 30,
              "si": 25
            },
            "mech": {
              "version": 2,
              "complexity": "advanced",
              "signature": {
                "name": "守土成卷",
                "template": "sig_steady_pressure",
                "floor": 4,
                "ceiling": 4
              },
              "weakness": {
                "name": "一骰破锋",
                "template": "wea_limited_extra_dice",
                "maxExtraDice": 1,
                "retention": 0.2,
                "playerBonus": 0.04
              },
              "intent": {
                "template": "int_steady",
                "style": "bi",
                "bias": 1.25,
                "bottom": 0.76,
                "description": "守土之策，稳守待破"
              }
            }
          },
          "same_second": {
            "id": "bs_han_zhaoshuang",
            "name": "韩照霜",
            "title": "军司录事",
            "style": "lian",
            "attrs": {
              "shi": 25,
              "ci": 25,
              "lian": 51,
              "bi": 25,
              "xue": 25,
              "si": 30
            },
            "mech": {
              "version": 2,
              "complexity": "advanced",
              "signature": {
                "name": "奇兵应势",
                "template": "sig_dice_response",
                "steps": [
                  5,
                  2
                ],
                "cap": 7
              },
              "weakness": {
                "name": "收束成篇",
                "template": "wea_base_dice_only",
                "flat": 7
              },
              "intent": {
                "template": "int_pattern_hunt",
                "pattern": "pair",
                "style": "lian",
                "bias": 1.25,
                "bottom": 0.76,
                "description": "出奇之策，候你追加骰露出破绽"
              }
            }
          },
          "mixed": {
            "id": "bs_han_zhaoshuang",
            "name": "韩照霜",
            "title": "军司录事",
            "style": "shi",
            "attrs": {
              "shi": 51,
              "ci": 25,
              "lian": 25,
              "bi": 25,
              "xue": 30,
              "si": 25
            },
            "mech": {
              "version": 2,
              "complexity": "advanced",
              "signature": {
                "name": "并陈先声",
                "template": "sig_declared_stance",
                "pct": 0.08
              },
              "weakness": {
                "name": "一骰破锋",
                "template": "wea_stance_counter",
                "counter": {
                  "balance": "one_extra"
                },
                "retention": 0.2,
                "playerBonus": 0.04
              },
              "intent": {
                "template": "int_declared_stance",
                "stance": "balance",
                "style": "shi",
                "bias": 1.25,
                "bottom": 0.76,
                "description": "守土与出奇并陈，明示你以一骰破势"
              }
            }
          }
        }
      }
    },
    "qiuxian": {
      "guides": [
        {
          "id": "qx_gu_shouyi",
          "name": "谷守一",
          "title": "采药客",
          "role": "引路人",
          "text": "药篓里有尘世的苦，也有空山的清。"
        }
      ],
      "climax": {
        "id": "qx_xuanweizi",
        "name": "玄微子",
        "title": "天门守问人",
        "style": "si",
        "attrs": {
          "shi": 25,
          "ci": 25,
          "lian": 25,
          "bi": 25,
          "xue": 30,
          "si": 51
        },
        "mech": {
          "version": 2,
          "complexity": "advanced",
          "signature": {
            "name": "天门一问",
            "template": "sig_declared_stance",
            "pct": 0.08
          },
          "weakness": {
            "name": "藏锋守拙",
            "template": "wea_hold_active_talent",
            "retention": 0.2,
            "playerBonus": 0.04
          },
          "intent": {
            "template": "int_declared_stance",
            "stance": "ask",
            "style": "ci",
            "bias": 1.25,
            "bottom": 0.76,
            "description": "天门只问一字，先看你如何藏锋"
          }
        }
      },
      "final": {
        "primaryId": "qx_xuanweizi",
        "secondary": {
          "same_first": {
            "id": "qx_wuxiang",
            "name": "无相",
            "title": "镜中之我",
            "style": "si",
            "attrs": {
              "shi": 25,
              "ci": 25,
              "lian": 25,
              "bi": 25,
              "xue": 30,
              "si": 51
            },
            "mech": {
              "version": 2,
              "complexity": "advanced",
              "signature": {
                "name": "尘念加税",
                "template": "sig_active_talent_tax",
                "pct": 0.1
              },
              "weakness": {
                "name": "藏锋守拙",
                "template": "wea_hold_active_talent",
                "retention": 0.2,
                "playerBonus": 0.04
              },
              "intent": {
                "template": "int_preferred_style",
                "style": "ci",
                "bias": 1.25,
                "bottom": 0.76,
                "description": "留世之念最易借文心起势"
              }
            }
          },
          "same_second": {
            "id": "qx_wuxiang",
            "name": "无相",
            "title": "镜中之我",
            "style": "si",
            "attrs": {
              "shi": 25,
              "ci": 25,
              "lian": 25,
              "bi": 25,
              "xue": 30,
              "si": 51
            },
            "mech": {
              "version": 2,
              "complexity": "advanced",
              "signature": {
                "name": "审律见妄",
                "template": "sig_dice_pattern_hunt",
                "pattern": "pair",
                "pct": 0.1
              },
              "weakness": {
                "name": "异骰忘机",
                "template": "wea_stance_counter",
                "counter": {
                  "forget": "different_dice"
                },
                "retention": 0.2,
                "playerBonus": 0.04
              },
              "intent": {
                "template": "int_declared_stance",
                "stance": "forget",
                "style": "ci",
                "bias": 1.25,
                "bottom": 0.76,
                "description": "忘机之境，以至少两枚不同骰面破其审律"
              }
            }
          },
          "mixed": {
            "id": "qx_wuxiang",
            "name": "无相",
            "title": "镜中之我",
            "style": "shi",
            "attrs": {
              "shi": 51,
              "ci": 25,
              "lian": 25,
              "bi": 25,
              "xue": 30,
              "si": 25
            },
            "mech": {
              "version": 2,
              "complexity": "advanced",
              "signature": {
                "name": "镜中先声",
                "template": "sig_declared_stance",
                "pct": 0.08
              },
              "weakness": {
                "name": "两端照见",
                "template": "wea_stance_counter",
                "counter": {
                  "mirror": "low_and_high"
                },
                "retention": 0.2,
                "playerBonus": 0.04
              },
              "intent": {
                "template": "int_declared_stance",
                "stance": "mirror",
                "style": "shi",
                "bias": 1.25,
                "bottom": 0.76,
                "description": "镜中留与忘并现，以低高两端骰照破其问"
              }
            }
          }
        }
      }
    }
  }
};
window.GAME_SIDEQUESTS = {
  "version": 1,
  "routes": [
    {
      "id": "jianghu",
      "name": "江湖·一诺千金",
      "axis": [
        "守义",
        "权变"
      ],
      "intro": "名胜之外，一封染雨的求援书递到你手中。此去江湖，先要决定自己为何应诺。",
      "battleThemePool": [
        "songbie",
        "huaigu",
        "shanshui"
      ],
      "battleLabel": "江湖较艺·辨义",
      "finalLabel": "群英会盟·问义",
      "steps": [
        "逢客",
        "观招",
        "定式",
        "运意",
        "振笔",
        "辨义定胜"
      ],
      "presentation": {
        "stageNames": {
          "decision": "江湖·旧诺待决",
          "climax": "江湖·辨义应验"
        },
        "transitions": {
          "decision": "雨书已收，旧诺未决。行卷转入「江湖·旧诺待决」。",
          "climax": "取舍既定，下一场「{battleLabel}」将辨明此诺所守何义。",
          "complete": "「{routeName}」行卷已成，重返「{mainStage}」科举路。"
        },
        "battles": {
          "climax": {
            "kind": "江 湖 辨 义",
            "steps": [
              "逢客",
              "观招",
              "定式",
              "运意",
              "振笔",
              "辨义定胜"
            ],
            "selfRole": "赴约",
            "opponentRole": "问义",
            "waiting": "待观来意",
            "scoreLabel": "辨义得分",
            "encounter": "「{npc}」{npcTitle}临席相候，要以一篇文章问你：旧诺与是非，究竟何者为义。",
            "encounterButton": "入席辨义 →",
            "topicPrefix": "义题",
            "themePrefix": "借题",
            "topicLead": "此番所辨为「{topic}」，借题于「{theme}」。",
            "settling": "正在辨义定胜……",
            "verdictWin": "一诺有据，群议为之而定。",
            "verdictLose": "此诺尚有未明之处，且将余问收入行卷。",
            "verdictDraw": "两说各有所守，此义暂留未决。",
            "closeButton": "合卷归途"
          },
          "final": {
            "kind": "群 英 问 义",
            "steps": [
              "入盟",
              "听问",
              "择体",
              "立义",
              "成章",
              "群议定盟"
            ],
            "selfRole": "赴盟",
            "opponentRole": "主问",
            "waiting": "待听群问",
            "scoreLabel": "问义得分",
            "encounter": "「{npc}」{npcTitle}执卷主问，请你以一路所守回应群英。",
            "encounterButton": "携卷赴问 →",
            "topicPrefix": "盟题",
            "themePrefix": "所问",
            "topicLead": "群英所问为「{topic}」，落在「{theme}」。",
            "settling": "群议正在定盟……",
            "verdictWin": "一路所守终成公论。",
            "verdictLose": "群问未尽，此道仍可再行。",
            "verdictDraw": "群议未决，你的回答已留在盟卷。",
            "closeButton": "观盟卷"
          }
        }
      },
      "acts": [
        {
          "id": "origin",
          "title": "第一幕·缘起",
          "text": "雨书只写着一句：‘若你还认得这份旧交，便请来。’",
          "options": [
            {
              "id": "keep",
              "label": "应下此诺",
              "resultText": "你先接过那封雨书：承诺一旦出口，便该有人肯担。",
              "axis": "守义",
              "effect": {
                "attrs": {
                  "bi": 1
                }
              }
            },
            {
              "id": "ask",
              "label": "先问原委",
              "resultText": "你没有急着许诺，先要辨明这份旧交究竟要你承担什么。",
              "axis": "权变",
              "effect": {
                "attrs": {
                  "xue": 1
                }
              }
            }
          ]
        },
        {
          "id": "decision",
          "title": "第二幕·取舍",
          "text": "故友与无辜者被同一桩旧怨牵连。你只能先替一方说话。",
          "options": [
            {
              "id": "shoulder",
              "label": "替故友担名",
              "resultText": "你替故友受下众目，也把这一笔代价留给了自己。",
              "axis": "守义",
              "effect": {
                "inspiration": -2,
                "nextBattlePct": 0.1
              }
            },
            {
              "id": "reveal",
              "label": "公开来龙去脉",
              "resultText": "你让义字之外的是非也见了光。",
              "axis": "权变",
              "effect": {
                "inspiration": 2
              }
            }
          ]
        }
      ],
      "npc": {
        "id": "sidequest_shen_tingbei",
        "name": "沈停杯",
        "title": "江湖名士",
        "style": "shi",
        "attrs": {
          "shi": 26,
          "ci": 22,
          "lian": 20,
          "bi": 22,
          "xue": 24,
          "si": 23
        }
      }
    },
    {
      "id": "biansai",
      "name": "边塞·孤城万里",
      "axis": [
        "守土",
        "出奇"
      ],
      "intro": "玉门烽燧送来一封缺了半角的军报。烽火未近，取舍已先到了眼前。",
      "battleThemePool": [
        "biansai",
        "huaigu"
      ],
      "battleLabel": "军帐筹策·定势",
      "finalLabel": "帅府策试·问国",
      "steps": [
        "对阵",
        "察势",
        "择体",
        "定调",
        "落檄",
        "策议定势"
      ],
      "presentation": {
        "stageNames": {
          "decision": "边塞·粮道待决",
          "climax": "边塞·军帐定势"
        },
        "transitions": {
          "decision": "残报已读，粮道未定。行卷转入「边塞·粮道待决」。",
          "climax": "军令既出，下一场「{battleLabel}」将验此策能否安城定军。",
          "complete": "「{routeName}」行卷已成，重返「{mainStage}」科举路。"
        },
        "battles": {
          "climax": {
            "kind": "军 帐 定 势",
            "steps": [
              "对阵",
              "察势",
              "择体",
              "定调",
              "落檄",
              "策议定势"
            ],
            "selfRole": "献策",
            "opponentRole": "判策",
            "waiting": "待察军情",
            "scoreLabel": "策议得分",
            "encounter": "「{npc}」{npcTitle}展开舆图，请你当帐落笔：城与军，只能先救其一时该如何定势。",
            "encounterButton": "升帐献策 →",
            "topicPrefix": "军议",
            "themePrefix": "所据",
            "topicLead": "军议命题为「{topic}」，所据题材为「{theme}」。",
            "settling": "正在合议军策……",
            "verdictWin": "军令可行，孤城与前线皆有所凭。",
            "verdictLose": "此策尚有缺口，边报仍催人再思。",
            "verdictDraw": "攻守各有代价，军议暂记两可。",
            "closeButton": "收檄归途"
          },
          "final": {
            "kind": "帅 府 问 国",
            "steps": [
              "入府",
              "阅图",
              "择体",
              "立策",
              "成檄",
              "帅府定议"
            ],
            "selfRole": "应策",
            "opponentRole": "主问",
            "waiting": "待阅舆图",
            "scoreLabel": "问策得分",
            "encounter": "「{npc}」{npcTitle}据帅案而问，要你以一路得失回答何以守国。",
            "encounterButton": "整卷应策 →",
            "topicPrefix": "策题",
            "themePrefix": "国问",
            "topicLead": "帅府策题为「{topic}」，国问落在「{theme}」。",
            "settling": "帅府正在定议……",
            "verdictWin": "策可经国，帅府为之定议。",
            "verdictLose": "此策未能尽服众议，仍待后日补完。",
            "verdictDraw": "攻守之议未分高下，你的策卷已入府藏。",
            "closeButton": "观策卷"
          }
        }
      },
      "acts": [
        {
          "id": "origin",
          "title": "第一幕·缘起",
          "text": "军报残缺，只知前线与城中都在等一个先后。",
          "options": [
            {
              "id": "fortify",
              "label": "先固关城",
              "resultText": "你先替城中人守住了可依之处。",
              "axis": "守土",
              "effect": {
                "attrs": {
                  "xue": 1
                }
              }
            },
            {
              "id": "scout",
              "label": "亲赴前哨",
              "resultText": "你先去争那一线看得见也可能回不来的时机。",
              "axis": "出奇",
              "effect": {
                "attrs": {
                  "bi": 1
                }
              }
            }
          ]
        },
        {
          "id": "decision",
          "title": "第二幕·取舍",
          "text": "粮道只能先顾城中或先援孤军。两边都有人在等。",
          "options": [
            {
              "id": "ration",
              "label": "分粮守城",
              "resultText": "你把粮留在城中，也把这个决定的重量留在心里。",
              "axis": "守土",
              "effect": {
                "inspiration": 2
              }
            },
            {
              "id": "riders",
              "label": "轻骑送粮",
              "resultText": "你让轻骑越过夜色，把希望押在速度与胆识上。",
              "axis": "出奇",
              "effect": {
                "inspiration": -2,
                "nextBattlePct": 0.1
              }
            }
          ]
        }
      ],
      "npc": {
        "id": "sidequest_huo_congjian",
        "name": "霍从简",
        "title": "行营判官",
        "style": "lian",
        "attrs": {
          "shi": 23,
          "ci": 20,
          "lian": 27,
          "bi": 24,
          "xue": 25,
          "si": 25
        }
      }
    },
    {
      "id": "qiuxian",
      "name": "求仙·山海问心",
      "axis": [
        "留世",
        "忘机"
      ],
      "intro": "无字碑映出一个仍在尘世等候的人。山门未开，先要问你想带着什么进去。",
      "battleThemePool": [
        "shanshui",
        "jieling",
        "huaigu"
      ],
      "battleLabel": "问道试心·破妄",
      "finalLabel": "天门问心·问真",
      "steps": [
        "入境",
        "观心",
        "立法",
        "守念",
        "叩问",
        "照见破妄"
      ],
      "presentation": {
        "stageNames": {
          "decision": "求仙·去留问心",
          "climax": "求仙·照见破妄"
        },
        "transitions": {
          "decision": "碑中姓名未散，去留之念未明。行卷转入「求仙·去留问心」。",
          "climax": "一念已择，下一场「{battleLabel}」将照见所守是真是妄。",
          "complete": "「{routeName}」行卷已成，重返「{mainStage}」科举路。"
        },
        "battles": {
          "climax": {
            "kind": "照 见 破 妄",
            "steps": [
              "入境",
              "观心",
              "立法",
              "守念",
              "叩问",
              "照见破妄"
            ],
            "selfRole": "问道",
            "opponentRole": "照心",
            "waiting": "待观本心",
            "scoreLabel": "问心得分",
            "encounter": "「{npc}」{npcTitle}立于镜前，要你以文章照见：所留者是情，所忘者是否真能成道。",
            "encounterButton": "入境问心 →",
            "topicPrefix": "心题",
            "themePrefix": "所照",
            "topicLead": "镜中所问为「{topic}」，所照题材为「{theme}」。",
            "settling": "正在照见真妄……",
            "verdictWin": "镜影散去，所守之心清明可见。",
            "verdictLose": "妄影未尽，此问仍随你下山。",
            "verdictDraw": "真妄相生，镜中暂不判高下。",
            "closeButton": "出境归途"
          },
          "final": {
            "kind": "天 门 问 真",
            "steps": [
              "登门",
              "听问",
              "择体",
              "守真",
              "成章",
              "天门照见"
            ],
            "selfRole": "叩门",
            "opponentRole": "主问",
            "waiting": "待听真问",
            "scoreLabel": "问真得分",
            "encounter": "「{npc}」{npcTitle}守在天门之前，只问你一路所见何者为真。",
            "encounterButton": "携卷叩门 →",
            "topicPrefix": "真题",
            "themePrefix": "所见",
            "topicLead": "天门所问为「{topic}」，所见落在「{theme}」。",
            "settling": "天门正在照见……",
            "verdictWin": "所见不欺，天门为此一问而开。",
            "verdictLose": "门未全开，但你已知道下一次该问什么。",
            "verdictDraw": "门影半开半合，真意留待尘世续答。",
            "closeButton": "观真卷"
          }
        }
      },
      "acts": [
        {
          "id": "origin",
          "title": "第一幕·缘起",
          "text": "无字碑中，那个人的名字像一粒未落的尘。",
          "options": [
            {
              "id": "remember",
              "label": "记住此人",
              "resultText": "你把名字留在心里，不肯以忘却换取轻快。",
              "axis": "留世",
              "effect": {
                "attrs": {
                  "bi": 1
                }
              }
            },
            {
              "id": "erase",
              "label": "抹去姓名",
              "resultText": "你暂将名字放下，想先听清空山里真正的声音。",
              "axis": "忘机",
              "effect": {
                "attrs": {
                  "si": 1
                }
              }
            }
          ]
        },
        {
          "id": "decision",
          "title": "第二幕·取舍",
          "text": "仙人许诺替你删去一段最痛的记忆，只问你是否愿意。",
          "options": [
            {
              "id": "carry",
              "label": "带痛而行",
              "resultText": "你没有把痛苦当作污点，而把它带进了下一段路。",
              "axis": "留世",
              "effect": {
                "inspiration": -2,
                "nextBattlePct": 0.1
              }
            },
            {
              "id": "forget",
              "label": "暂借忘忧",
              "resultText": "你借来片刻空明，也承认这不是最后的回答。",
              "axis": "忘机",
              "effect": {
                "inspiration": 2
              }
            }
          ]
        }
      ],
      "npc": {
        "id": "sidequest_wuming_daoren",
        "name": "无名道人",
        "title": "镜中客",
        "style": "ci",
        "attrs": {
          "shi": 21,
          "ci": 27,
          "lian": 21,
          "bi": 24,
          "xue": 23,
          "si": 27
        }
      }
    }
  ],
  "final": {
    "carryCost": 2,
    "scorePctByMerit": {
      "1": 0.06,
      "2": 0.1
    },
    "releaseInspirationByMerit": {
      "1": 2,
      "2": 4
    }
  }
};
window.GAME_SIDEQUEST_TALENTS = [
  {
    "id": "T041",
    "name": "抱柱之信",
    "kind": "passive",
    "source": "sidequest",
    "routeId": "jianghu",
    "axis": "守义",
    "quality": "rare",
    "text": "一诺既出，风雨不改。连续沿用上一场文体时作品得分提高；若上一场已经获胜，守诺之势更盛。",
    "effect": {
      "type": "battle_history_pct",
      "condition": "repeat_style",
      "value": 0.05,
      "previousWinBonus": 0.03,
      "stackGroup": "style_history"
    }
  },
  {
    "id": "T042",
    "name": "相忘江湖",
    "kind": "passive",
    "source": "sidequest",
    "routeId": "jianghu",
    "axis": "权变",
    "quality": "rare",
    "text": "旧招已尽，便还彼此一片江湖。换用不同文体时得分提高；上一场未胜，转身之力更强。",
    "effect": {
      "type": "battle_history_pct",
      "condition": "switch_style",
      "value": 0.05,
      "previousNonWinBonus": 0.03,
      "stackGroup": "style_history"
    }
  },
  {
    "id": "T043",
    "name": "风尘知己",
    "kind": "passive",
    "source": "sidequest",
    "routeId": "jianghu",
    "axis": "common",
    "quality": "epic",
    "text": "风尘满面，仍有人一眼认出你未说出口的招数。每场首次命中对手破绽时，作品得分 +4%，并恢复 1 灵感。",
    "effect": {
      "type": "weakness_reward",
      "value": 0.04,
      "reward": {
        "type": "inspiration",
        "value": 1,
        "perMatch": false
      }
    }
  },
  {
    "id": "TA09",
    "name": "杯酒解剑",
    "kind": "active",
    "source": "sidequest",
    "routeId": "jianghu",
    "axis": "active",
    "quality": "epic",
    "cost": 3,
    "text": "且把兵刃挂在楼外。支付灵感，封住对手本场招牌；你也要放下几分锋芒。",
    "effect": {
      "type": "seal_signature",
      "penalty": -0.08
    }
  },
  {
    "id": "T044",
    "name": "坚壁清野",
    "kind": "passive",
    "source": "sidequest",
    "routeId": "biansai",
    "axis": "守土",
    "quality": "rare",
    "text": "城中每一粒粮，都要留到真正需要的时候。本场不购买追加灵感骰，作品得分提高。",
    "effect": {
      "type": "dice_commitment",
      "condition": "none_paid",
      "value": 0.07
    }
  },
  {
    "id": "T045",
    "name": "轻骑出塞",
    "kind": "passive",
    "source": "sidequest",
    "routeId": "biansai",
    "axis": "出奇",
    "quality": "rare",
    "text": "轻骑只争一线，不与大军纠缠。首枚追加骰少耗灵感；本场恰好购买一枚追加骰，得分提高。",
    "effect": {
      "type": "dice_commitment",
      "condition": "exactly_one_paid",
      "firstCostDiscount": 1,
      "value": 0.07
    }
  },
  {
    "id": "T046",
    "name": "孤烽照夜",
    "kind": "passive",
    "source": "sidequest",
    "routeId": "biansai",
    "axis": "common",
    "quality": "epic",
    "text": "城外没有援军，远处却还有一座烽燧未灭。上一场平或负时，下一场作品得分提高。",
    "effect": {
      "type": "battle_history_pct",
      "condition": "previous_nonwin",
      "value": 0.08,
      "stackGroup": "result_history"
    }
  },
  {
    "id": "TA10",
    "name": "背水列阵",
    "kind": "active",
    "source": "sidequest",
    "routeId": "biansai",
    "axis": "active",
    "quality": "epic",
    "cost": 3,
    "text": "身后只有一水，再无回旋余地。首骰获得保底与得分加成，但本场不能追加灵感骰。",
    "effect": {
      "type": "dice_transform",
      "mode": "first_floor",
      "floor": 4,
      "value": 0.03,
      "noExtraDice": true
    }
  },
  {
    "id": "T047",
    "name": "坐忘",
    "kind": "passive",
    "source": "sidequest",
    "routeId": "qiuxian",
    "axis": "忘机",
    "quality": "rare",
    "text": "堕肢体，黜聪明，离形去知。本场不发动主动文心，作品得分提高。",
    "effect": {
      "type": "restraint_pct",
      "value": 0.07
    }
  },
  {
    "id": "T048",
    "name": "庄周梦蝶",
    "kind": "passive",
    "source": "sidequest",
    "routeId": "qiuxian",
    "axis": "留世",
    "quality": "rare",
    "text": "不知周之梦为蝴蝶，还是蝴蝶之梦为周。骰组首尾同点时，作品得分提高。",
    "effect": {
      "type": "dice_pattern",
      "pattern": "first_last_equal",
      "minDice": 2,
      "firstCostDiscount": 1,
      "value": 0.12
    }
  },
  {
    "id": "T049",
    "name": "知白守黑",
    "kind": "passive",
    "source": "sidequest",
    "routeId": "qiuxian",
    "axis": "common",
    "quality": "epic",
    "text": "知其白，守其黑，为天下式。骰组同时留下低点与高点时，得分提高并恢复灵感。",
    "effect": {
      "type": "dice_pattern",
      "pattern": "low_and_high",
      "lowMax": 2,
      "highMin": 5,
      "value": 0.12,
      "reward": {
        "type": "inspiration",
        "value": 1,
        "perMatch": false
      }
    }
  },
  {
    "id": "TA11",
    "name": "斩妄见真",
    "kind": "active",
    "source": "sidequest",
    "routeId": "qiuxian",
    "axis": "active",
    "quality": "epic",
    "cost": 3,
    "text": "妄念不在幽暗处，恰藏在似是而非之间。将最低骰化为一、最高骰化为六，并令本场作品得分 +6%。",
    "effect": {
      "type": "dice_transform",
      "mode": "polarize",
      "minDice": 2,
      "value": 0.06
    }
  }
];
window.GAME_SIDEQUEST_TALENT_UPGRADE = {
  "T041": {
    "quality": "rare",
    "maxLevel": 4,
    "upCost": [
      7,
      11,
      16
    ],
    "levels": [
      {
        "effect": {
          "type": "battle_history_pct",
          "condition": "repeat_style",
          "value": 0.05,
          "previousWinBonus": 0.03,
          "stackGroup": "style_history"
        }
      },
      {
        "effect": {
          "type": "battle_history_pct",
          "condition": "repeat_style",
          "value": 0.06,
          "previousWinBonus": 0.04,
          "stackGroup": "style_history"
        }
      },
      {
        "effect": {
          "type": "battle_history_pct",
          "condition": "repeat_style",
          "value": 0.07,
          "previousWinBonus": 0.05,
          "stackGroup": "style_history"
        }
      },
      {
        "effect": {
          "type": "battle_history_pct",
          "condition": "repeat_style",
          "value": 0.08,
          "previousWinBonus": 0.06,
          "stackGroup": "style_history"
        }
      }
    ]
  },
  "T042": {
    "quality": "rare",
    "maxLevel": 4,
    "upCost": [
      7,
      11,
      16
    ],
    "levels": [
      {
        "effect": {
          "type": "battle_history_pct",
          "condition": "switch_style",
          "value": 0.05,
          "previousNonWinBonus": 0.03,
          "stackGroup": "style_history"
        }
      },
      {
        "effect": {
          "type": "battle_history_pct",
          "condition": "switch_style",
          "value": 0.06,
          "previousNonWinBonus": 0.04,
          "stackGroup": "style_history"
        }
      },
      {
        "effect": {
          "type": "battle_history_pct",
          "condition": "switch_style",
          "value": 0.07,
          "previousNonWinBonus": 0.05,
          "stackGroup": "style_history"
        }
      },
      {
        "effect": {
          "type": "battle_history_pct",
          "condition": "switch_style",
          "value": 0.08,
          "previousNonWinBonus": 0.06,
          "stackGroup": "style_history"
        }
      }
    ]
  },
  "T043": {
    "quality": "epic",
    "maxLevel": 5,
    "upCost": [
      8,
      12,
      17,
      23
    ],
    "levels": [
      {
        "effect": {
          "type": "weakness_reward",
          "value": 0.04,
          "reward": {
            "type": "inspiration",
            "value": 1,
            "perMatch": false
          }
        }
      },
      {
        "effect": {
          "type": "weakness_reward",
          "value": 0.06,
          "reward": {
            "type": "inspiration",
            "value": 1,
            "perMatch": false
          }
        }
      },
      {
        "effect": {
          "type": "weakness_reward",
          "value": 0.08,
          "reward": {
            "type": "inspiration",
            "value": 1,
            "perMatch": false
          }
        }
      },
      {
        "effect": {
          "type": "weakness_reward",
          "value": 0.1,
          "reward": {
            "type": "inspiration",
            "value": 2,
            "perMatch": false
          }
        }
      },
      {
        "effect": {
          "type": "weakness_reward",
          "value": 0.12,
          "reward": {
            "type": "inspiration",
            "value": 2,
            "perMatch": false
          }
        }
      }
    ]
  },
  "TA09": {
    "quality": "epic",
    "maxLevel": 5,
    "upCost": [
      8,
      12,
      17,
      23
    ],
    "levels": [
      {
        "cost": 3,
        "effect": {
          "type": "seal_signature",
          "penalty": -0.08
        }
      },
      {
        "cost": 3,
        "effect": {
          "type": "seal_signature",
          "penalty": -0.06
        }
      },
      {
        "cost": 3,
        "effect": {
          "type": "seal_signature",
          "penalty": -0.04
        }
      },
      {
        "cost": 3,
        "effect": {
          "type": "seal_signature",
          "penalty": -0.02
        }
      },
      {
        "cost": 2,
        "effect": {
          "type": "seal_signature",
          "penalty": 0
        }
      }
    ]
  },
  "T044": {
    "quality": "rare",
    "maxLevel": 4,
    "upCost": [
      7,
      11,
      16
    ],
    "levels": [
      {
        "effect": {
          "type": "dice_commitment",
          "condition": "none_paid",
          "value": 0.07
        }
      },
      {
        "effect": {
          "type": "dice_commitment",
          "condition": "none_paid",
          "value": 0.09
        }
      },
      {
        "effect": {
          "type": "dice_commitment",
          "condition": "none_paid",
          "value": 0.11
        }
      },
      {
        "effect": {
          "type": "dice_commitment",
          "condition": "none_paid",
          "value": 0.13
        }
      }
    ]
  },
  "T045": {
    "quality": "rare",
    "maxLevel": 4,
    "upCost": [
      7,
      11,
      16
    ],
    "levels": [
      {
        "effect": {
          "type": "dice_commitment",
          "condition": "exactly_one_paid",
          "firstCostDiscount": 1,
          "value": 0.07
        }
      },
      {
        "effect": {
          "type": "dice_commitment",
          "condition": "exactly_one_paid",
          "firstCostDiscount": 1,
          "value": 0.09
        }
      },
      {
        "effect": {
          "type": "dice_commitment",
          "condition": "exactly_one_paid",
          "firstCostDiscount": 2,
          "value": 0.11
        }
      },
      {
        "effect": {
          "type": "dice_commitment",
          "condition": "exactly_one_paid",
          "firstCostDiscount": 2,
          "value": 0.13
        }
      }
    ]
  },
  "T046": {
    "quality": "epic",
    "maxLevel": 5,
    "upCost": [
      8,
      12,
      17,
      23
    ],
    "levels": [
      {
        "effect": {
          "type": "battle_history_pct",
          "condition": "previous_nonwin",
          "value": 0.08,
          "stackGroup": "result_history"
        }
      },
      {
        "effect": {
          "type": "battle_history_pct",
          "condition": "previous_nonwin",
          "value": 0.1,
          "stackGroup": "result_history"
        }
      },
      {
        "effect": {
          "type": "battle_history_pct",
          "condition": "previous_nonwin",
          "value": 0.12,
          "stackGroup": "result_history"
        }
      },
      {
        "effect": {
          "type": "battle_history_pct",
          "condition": "previous_nonwin",
          "value": 0.14,
          "stackGroup": "result_history"
        }
      },
      {
        "effect": {
          "type": "battle_history_pct",
          "condition": "previous_nonwin",
          "value": 0.16,
          "stackGroup": "result_history"
        }
      }
    ]
  },
  "TA10": {
    "quality": "epic",
    "maxLevel": 5,
    "upCost": [
      8,
      12,
      17,
      23
    ],
    "levels": [
      {
        "cost": 3,
        "effect": {
          "type": "dice_transform",
          "mode": "first_floor",
          "floor": 4,
          "value": 0.03,
          "noExtraDice": true
        }
      },
      {
        "cost": 3,
        "effect": {
          "type": "dice_transform",
          "mode": "first_floor",
          "floor": 4,
          "value": 0.05,
          "noExtraDice": true
        }
      },
      {
        "cost": 3,
        "effect": {
          "type": "dice_transform",
          "mode": "first_floor",
          "floor": 4,
          "value": 0.07,
          "noExtraDice": true
        }
      },
      {
        "cost": 3,
        "effect": {
          "type": "dice_transform",
          "mode": "first_floor",
          "floor": 5,
          "value": 0.09,
          "noExtraDice": true
        }
      },
      {
        "cost": 2,
        "effect": {
          "type": "dice_transform",
          "mode": "first_floor",
          "floor": 5,
          "value": 0.11,
          "noExtraDice": true
        }
      }
    ]
  },
  "T047": {
    "quality": "rare",
    "maxLevel": 4,
    "upCost": [
      7,
      11,
      16
    ],
    "levels": [
      {
        "effect": {
          "type": "restraint_pct",
          "value": 0.07
        }
      },
      {
        "effect": {
          "type": "restraint_pct",
          "value": 0.09
        }
      },
      {
        "effect": {
          "type": "restraint_pct",
          "value": 0.11
        }
      },
      {
        "effect": {
          "type": "restraint_pct",
          "value": 0.13
        }
      }
    ]
  },
  "T048": {
    "quality": "rare",
    "maxLevel": 4,
    "upCost": [
      7,
      11,
      16
    ],
    "levels": [
      {
        "effect": {
          "type": "dice_pattern",
          "pattern": "first_last_equal",
          "minDice": 2,
          "firstCostDiscount": 1,
          "value": 0.12
        }
      },
      {
        "effect": {
          "type": "dice_pattern",
          "pattern": "first_last_equal",
          "minDice": 2,
          "firstCostDiscount": 1,
          "value": 0.15
        }
      },
      {
        "effect": {
          "type": "dice_pattern",
          "pattern": "first_last_equal",
          "minDice": 2,
          "firstCostDiscount": 2,
          "value": 0.18
        }
      },
      {
        "effect": {
          "type": "dice_pattern",
          "pattern": "first_last_equal",
          "minDice": 2,
          "firstCostDiscount": 2,
          "value": 0.21
        }
      }
    ]
  },
  "T049": {
    "quality": "epic",
    "maxLevel": 5,
    "upCost": [
      8,
      12,
      17,
      23
    ],
    "levels": [
      {
        "effect": {
          "type": "dice_pattern",
          "pattern": "low_and_high",
          "lowMax": 2,
          "highMin": 5,
          "value": 0.12,
          "reward": {
            "type": "inspiration",
            "value": 1,
            "perMatch": false
          }
        }
      },
      {
        "effect": {
          "type": "dice_pattern",
          "pattern": "low_and_high",
          "lowMax": 2,
          "highMin": 5,
          "value": 0.15,
          "reward": {
            "type": "inspiration",
            "value": 1,
            "perMatch": false
          }
        }
      },
      {
        "effect": {
          "type": "dice_pattern",
          "pattern": "low_and_high",
          "lowMax": 2,
          "highMin": 5,
          "value": 0.18,
          "reward": {
            "type": "inspiration",
            "value": 1,
            "perMatch": false
          }
        }
      },
      {
        "effect": {
          "type": "dice_pattern",
          "pattern": "low_and_high",
          "lowMax": 2,
          "highMin": 5,
          "value": 0.21,
          "reward": {
            "type": "inspiration",
            "value": 2,
            "perMatch": false
          }
        }
      },
      {
        "effect": {
          "type": "dice_pattern",
          "pattern": "low_and_high",
          "lowMax": 2,
          "highMin": 5,
          "value": 0.24,
          "reward": {
            "type": "inspiration",
            "value": 2,
            "perMatch": false
          }
        }
      }
    ]
  },
  "TA11": {
    "quality": "epic",
    "maxLevel": 5,
    "upCost": [
      8,
      12,
      17,
      23
    ],
    "levels": [
      {
        "cost": 3,
        "effect": {
          "type": "dice_transform",
          "mode": "polarize",
          "minDice": 2,
          "value": 0.06
        }
      },
      {
        "cost": 3,
        "effect": {
          "type": "dice_transform",
          "mode": "polarize",
          "minDice": 2,
          "value": 0.08
        }
      },
      {
        "cost": 3,
        "effect": {
          "type": "dice_transform",
          "mode": "polarize",
          "minDice": 2,
          "value": 0.1
        }
      },
      {
        "cost": 3,
        "effect": {
          "type": "dice_transform",
          "mode": "polarize",
          "minDice": 2,
          "value": 0.12
        }
      },
      {
        "cost": 2,
        "effect": {
          "type": "dice_transform",
          "mode": "polarize",
          "minDice": 2,
          "value": 0.15
        }
      }
    ]
  }
};
window.GAME_SIDEQUEST_TALENT_OFFERS = {
  "jianghu": {
    "守义": "T041",
    "权变": "T042",
    "common": "T043",
    "active": "TA09"
  },
  "biansai": {
    "守土": "T044",
    "出奇": "T045",
    "common": "T046",
    "active": "TA10"
  },
  "qiuxian": {
    "留世": "T048",
    "忘机": "T047",
    "common": "T049",
    "active": "TA11"
  }
};
