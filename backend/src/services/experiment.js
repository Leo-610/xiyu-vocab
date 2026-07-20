import db from '../db.js';

/** 对照实验：A=对照组（无 RAG/LLM），B=实验组（可溯源例句+错题解析） */
export async function setExperimentArmForUser(userId) {
  const arm = Number(userId) % 2 === 0 ? 'A' : 'B';
  await db.prepare('UPDATE users SET experiment_arm = ? WHERE id = ?').run(arm, userId);
  return arm;
}

export async function getExperimentArm(userId) {
  const row = await db.prepare('SELECT experiment_arm FROM users WHERE id = ?').get(userId);
  if (row?.experiment_arm === 'A' || row?.experiment_arm === 'B') {
    return row.experiment_arm;
  }
  return await setExperimentArmForUser(userId);
}

/** 实验组才启用 RAG/LLM 增强 */
export async function ragFeaturesEnabled(userId) {
  return (await getExperimentArm(userId)) === 'B';
}

export async function ensureAllUsersHaveArm() {
  const rows = await db.prepare(`
    SELECT id FROM users
    WHERE experiment_arm IS NULL OR experiment_arm = '' OR experiment_arm NOT IN ('A','B')
  `).all();
  for (const r of rows) await setExperimentArmForUser(r.id);
  return await db.prepare(`
    SELECT experiment_arm AS arm, COUNT(*) AS c FROM users GROUP BY experiment_arm
  `).all();
}