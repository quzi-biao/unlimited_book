/**
 * seed.js — 数据库初始化种子脚本
 *
 * 执行：node server/scripts/seed.js
 *
 * 功能：
 *   1. 创建超级管理员账号（通过环境变量配置）
 *   2. 写入默认全局配置（点数单价、初始点数等）
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 开始初始化种子数据...\n');

  // ── 1. 创建超级管理员 ─────────────────────────────────
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminEmail    = process.env.ADMIN_EMAIL || 'admin@flipbook.local';

  const existingAdmin = await prisma.user.findUnique({
    where: { username: adminUsername },
  });

  if (!existingAdmin) {
    if (!adminPassword) {
      throw new Error('首次初始化需要设置 ADMIN_PASSWORD');
    }
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await prisma.user.create({
      data: {
        username: adminUsername,
        email: adminEmail,
        passwordHash,
        role: 'superadmin',
      },
    });
    console.log(`✅ 管理员账号已创建：${adminUsername}`);
  } else {
    // 确保 role 是 superadmin
    await prisma.user.update({
      where: { username: adminUsername },
      data: { role: 'superadmin' },
    });
    console.log(`⏭  管理员账号已存在，已确保 role=superadmin`);
  }

  // ── 2. 写入默认全局配置 ───────────────────────────────
  const defaults = [
    { key: 'price_image',         value: '0.16',  desc: '每张图片生成费用（元）' },
    { key: 'price_tts_per_min',   value: '0.1',   desc: '每分钟 TTS 合成费用（元）' },
    { key: 'price_text_per_wan',  value: '0.01',  desc: '每万字内容生成费用（元）' },
    { key: 'points_per_image',    value: '10',    desc: '每张图片消耗点数' },
    { key: 'points_per_tts_min',  value: '5',     desc: '每分钟 TTS 消耗点数' },
    { key: 'points_per_wan_text', value: '1',     desc: '每万字消耗点数' },
    { key: 'init_points',         value: '100',   desc: '新设备注册赠送初始点数' },
    { key: 'overdraft_limit',     value: '-50',   desc: '允许点数透支下限（负数）' },
  ];

  for (const item of defaults) {
    await prisma.globalConfig.upsert({
      where: { key: item.key },
      update: {},          // 已存在的不覆盖（保留用户自定义值）
      create: { key: item.key, value: item.value },
    });
    console.log(`✅ 全局配置 [${item.key}] = ${item.value}  (${item.desc})`);
  }

  // ── 3. 创建默认套餐示例 ───────────────────────────────
  const plans = [
    {
      name: '月度基础版',
      price: 6000,    // 60 元
      points: 600,
      descriptionJson: JSON.stringify({ text: '每月 60 元，获得 600 学习点数，畅享 AI 百科图册探索体验。' }),
      sortOrder: 1,
    },
    {
      name: '月度进阶版',
      price: 16600,   // 166 元
      points: 2000,
      descriptionJson: JSON.stringify({ text: '每月 166 元，获得 2000 学习点数，超值体验全功能 AI 探索。' }),
      sortOrder: 2,
    },
  ];

  for (const plan of plans) {
    const existing = await prisma.plan.findFirst({ where: { name: plan.name } });
    if (!existing) {
      await prisma.plan.create({ data: plan });
      console.log(`✅ 套餐已创建：${plan.name} (${plan.price / 100} 元 / ${plan.points} 点)`);
    } else {
      console.log(`⏭  套餐已存在：${plan.name}`);
    }
  }

  console.log('\n🎉 种子数据初始化完成！');
}

main()
  .catch((e) => {
    console.error('❌ 种子脚本出错：', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
