// Synthetic context fixture in the disposable web lab. No primary instance writes.
import { randomBytes } from 'node:crypto';
import { makeFixture } from './fixture.mjs';
export async function webContextFixture(lab, api, password) {
  const accounts = {}, authUsers = {};
  const base = ['super','adminA','adminB','teacher','unassigned','guardian','student','student2','outsider'];
  const extra = ['deputySingle','deputyMultiple','noScope','expired','revoked','inactiveProgram','institutionDeputy','missingProfile','loadError','lostSession','switchRevoked','shellRevoked','boundaryError'];
  for (const name of [...base, ...extra]) {
    const email = 'context-' + name.toLowerCase() + '-' + randomBytes(5).toString('hex') + '@example.invalid';
    if (name === 'missingProfile') await lab.query('alter table auth.users disable trigger on_auth_user_created');
    let response;
    try {
      response = await fetch(api.auth + '/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, data: { full_name: 'Context ' + name, role: 'MUDIR' } }) });
    } finally {
      if (name === 'missingProfile') await lab.query('alter table auth.users enable trigger on_auth_user_created');
    }
    if (!response.ok) throw Error('Context account creation failed');
    const { user } = await response.json();
    authUsers[name] = user.id; accounts[name] = { email, id: user.id };
  }
  const f = await makeFixture(lab, { authUsers });
  for (const name of extra.filter(n => n !== 'missingProfile')) {
    f.users[name] = authUsers[name];
    f.profiles[name] = (await lab.query('select id from public.profiles where auth_user_id=$1', [authUsers[name]])).rows[0].id;
  }
  async function as(who, sql, args = []) {
    const client = await lab.connect();
    try {
      await client.query('set session authorization authenticated');
      await client.query("select set_config('request.jwt.claim.sub',$1,false)", [f.users[who]]);
      return (await client.query(sql, args)).rows[0]?.value;
    } finally { await client.end(); }
  }
  const caseId = await as('adminA', "select public.request_mudir_case($1,$2,'ONBOARDING','Synthetic browser test governance') value", [f.institutions.A, f.profiles.outsider]);
  await as('super', 'select public.verify_mudir_case($1,$2)', [caseId, 'synthetic-browser-evidence']);
  const mudir = await as('adminA', "select public.invite_leadership($1,$2,'MUDIR',null,$3) value", [f.institutions.A, f.profiles.outsider, caseId]);
  await as('outsider', 'select public.accept_provisioning_invitation($1) value', [mudir.token]);
  await f.member('outsider','A','GUARDIAN');
  const inactive = await f.insert('programs', { institution_id: f.institutions.A, name: 'Program Nonaktif', program_type_id: f.programs.a.program_type_id });
  const programs = {
    deputySingle: [f.programs.a.id], deputyMultiple: [f.programs.a.id, f.programs.aOther.id],
    noScope: [f.programs.a.id], expired: [f.programs.a.id], revoked: [f.programs.a.id],
    inactiveProgram: [inactive.id], institutionDeputy: null, guardian: [f.programs.a.id], switchRevoked: [f.programs.a.id], shellRevoked: [f.programs.a.id],
  };
  for (const [name, ids] of Object.entries(programs)) {
    const invitation = await as('outsider', "select public.invite_leadership($1,$2,'WAKIL_MUDIR',$3) value", [f.institutions.A, f.profiles[name], ids]);
    await as(name, 'select public.accept_provisioning_invitation($1) value', [invitation.token]);
    const scope = (await lab.query('select s.id from private.membership_scopes s join public.institution_members m on m.id=s.membership_id where m.profile_id=$1', [f.profiles[name]])).rows[0].id;
    if (['noScope','revoked'].includes(name)) await as('outsider', 'select public.revoke_leadership_scope($1)', [scope]);
    if (name === 'expired') await lab.query("update private.membership_scopes set starts_at=now()-interval '2 days',expires_at=now()-interval '1 day' where id=$1", [scope]);
  }
  await lab.query('update public.programs set is_active=false where id=$1', [inactive.id]);
  for (const name of ['loadError','lostSession','boundaryError']) await f.member(name,'A','TEACHER');
  await f.member('switchRevoked','A','GUARDIAN');
  await f.member('shellRevoked','A','GUARDIAN');
  const memberships = (await lab.query('select m.id,m.institution_id,m.profile_id,r.code from public.institution_members m join public.roles r on r.id=m.role_id')).rows;
  for (const [name, account] of Object.entries(accounts)) {
    account.profileId = f.profiles[name] ?? null;
    account.memberships = memberships.filter(m => m.profile_id === account.profileId);
  }
  const revokeScope = async name => {
    const scope = (await lab.query('select s.id from private.membership_scopes s join public.institution_members m on m.id=s.membership_id where m.profile_id=$1 and s.revoked_at is null', [f.profiles[name]])).rows[0];
    if (!scope) throw Error('Live scope fixture unavailable');
    await as('outsider', 'select public.revoke_leadership_scope($1)', [scope.id]);
  };
  return { accounts, institutions: f.institutions, programs: { a: f.programs.a.id, other: f.programs.aOther.id }, profileIds: Object.values(f.profiles),
    revokeLiveScope: () => revokeScope('switchRevoked'), revokeShellScope: () => revokeScope('shellRevoked') };
}
