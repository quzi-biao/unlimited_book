import { PrismaClient } from '@prisma/client';
import { originalPromptStyle } from '../src/services/ai/originalPromptStyle.js';

const prisma = new PrismaClient();

async function main() {
  const style = await prisma.promptStyle.upsert({
    where: { name: originalPromptStyle.name }, update: {}, create: originalPromptStyle,
  });

  console.log('Seed PromptStyle completed:', style.id);

  // Bind all devices to this style if not already
  const updatedDevices = await prisma.device.updateMany({
    where: { promptStyleId: null },
    data: { promptStyleId: style.id }
  });

  console.log(`Updated ${updatedDevices.count} devices to use 酷炫科普风.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
