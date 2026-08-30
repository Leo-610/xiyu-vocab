/** 对照实验：A/B 臂仍写入 users，用于大创对照分析；产品侧 RAG/LLM 默认对全体开放 */
import db from '../db.js';

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

/**
 * RAG/LLM 产品开关。
 * - 默认全体可用（三期交付）
 * - 设 RAG_AB_ONLY=true 时恢复「仅实验组 B」
 */
export async function ragFeaturesEnabled(userId) {
  if (process.env.RAG_AB_ONLY === 'true') {
    return (await getExperimentArm(userId)) === 'B';
  }
  return true;
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
