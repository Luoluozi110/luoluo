#!/usr/bin/env node
/** 从游戏正式 questions.json 生成题库编辑器默认种子。 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'feihuaqi-playable', 'config', 'questions.json');
const target = path.join(root, 'feihua-editors', 'assets', 'js', 'seed-questions.js');
const questions = JSON.parse(fs.readFileSync(source, 'utf8'));

if (!Array.isArray(questions)) throw new Error('questions.json 根必须是数组');

const header = '/* 飞花棋游戏原始题库（config/questions.json）。作为编辑器默认种子数据。由游戏配置同步生成，请勿手工改动。 */\n';
fs.writeFileSync(target, `${header}window.GAME_QUESTIONS = ${JSON.stringify(questions, null, 2)};\n`, 'utf8');
console.log(`已同步 ${questions.length} 道题到 ${path.relative(root, target)}`);
