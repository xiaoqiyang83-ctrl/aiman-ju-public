const { pool } = require('../config/database');

async function getTeamRole({ teamId, userId }) {
  const res = await pool.query('SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2', [teamId, userId]);
  return res.rows[0]?.role || null;
}

async function createTeam({ name, userId }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const teamRes = await client.query('INSERT INTO teams (name, owner_id) VALUES ($1, $2) RETURNING *', [
      String(name).trim(),
      userId,
    ]);
    const team = teamRes.rows[0];

    await client.query(
      'INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT (team_id, user_id) DO NOTHING',
      [team.id, userId, 'owner']
    );

    await client.query('COMMIT');
    return team;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    throw err;
  } finally {
    client.release();
  }
}

async function listTeamsWithMembers({ userId }) {
  const teamsRes = await pool.query(
    `SELECT t.*, tm.role AS my_role
     FROM teams t
     JOIN team_members tm ON tm.team_id = t.id
     WHERE tm.user_id = $1
     ORDER BY t.created_at DESC`,
    [userId]
  );

  const teams = teamsRes.rows;
  const teamIds = teams.map(t => t.id);
  let membersByTeam = {};

  if (teamIds.length) {
    const membersRes = await pool.query(
      `SELECT tm.team_id, tm.user_id, tm.role, tm.joined_at, u.username
       FROM team_members tm
       JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = ANY($1::int[])
       ORDER BY tm.role ASC, tm.joined_at ASC`,
      [teamIds]
    );

    membersByTeam = membersRes.rows.reduce((acc, row) => {
      if (!acc[row.team_id]) acc[row.team_id] = [];
      acc[row.team_id].push(row);
      return acc;
    }, {});
  }

  return teams.map(t => ({
    ...t,
    members: membersByTeam[t.id] || [],
  }));
}

async function getUserIdByUsername(username) {
  const uRes = await pool.query('SELECT id FROM users WHERE username = $1', [String(username)]);
  return uRes.rows[0]?.id || null;
}

async function userExists(userId) {
  const res = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
  return Boolean(res.rows.length);
}

async function upsertTeamMember({ teamId, userId, role }) {
  await pool.query(
    `INSERT INTO team_members (team_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (team_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [teamId, userId, role]
  );
}

async function updateTeamMemberRole({ teamId, userId, role }) {
  await pool.query('UPDATE team_members SET role = $1 WHERE team_id = $2 AND user_id = $3', [role, teamId, userId]);
}

module.exports = {
  getTeamRole,
  createTeam,
  listTeamsWithMembers,
  getUserIdByUsername,
  userExists,
  upsertTeamMember,
  updateTeamMemberRole,
};
