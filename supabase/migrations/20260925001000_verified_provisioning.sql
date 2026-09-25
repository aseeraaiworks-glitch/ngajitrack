-- Server verifies recipient ownership/identity before issuance. Client cannot choose
-- a role, institution, profile or identity when redeeming the opaque single-use token.
create table private.provisioning_invitations (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.institutions(id),
 recipient_profile_id uuid not null references public.profiles(id),
 role_code text not null check(role_code in ('STUDENT','TEACHER','GUARDIAN','INSTITUTION_ADMIN')),
 student_id uuid references public.student_profiles(id),
 student_identity_id uuid references public.student_identities(id),
 guardian_id uuid references public.guardian_profiles(id),
 authorized_by uuid not null references public.profiles(id),
 verification_reference text not null check(length(btrim(verification_reference)) between 1 and 200),
 token_hash bytea not null unique,
 expires_at timestamptz not null,
 created_at timestamptz not null default now(),
 consumed_at timestamptz,
 revoked_at timestamptz
);
revoke all on private.provisioning_invitations from public,anon,authenticated,service_role;
alter table private.provisioning_invitations enable row level security;
create index provisioning_pending_recipient on private.provisioning_invitations(recipient_profile_id,expires_at)
 where consumed_at is null and revoked_at is null;

create function public.issue_verified_invitation(tenant_id uuid,recipient_profile_id uuid,role_code text,
 authorized_by uuid,verification_reference text,student_id uuid default null,student_identity_id uuid default null,
 guardian_id uuid default null,valid_hours integer default 24) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result uuid; token text;
begin
 if not private.profile_has_role(authorized_by,tenant_id,'INSTITUTION_ADMIN') then raise exception 'Verified institution administrator required' using errcode='42501'; end if;
 if role_code is null or role_code not in ('STUDENT','TEACHER','GUARDIAN','INSTITUTION_ADMIN') or valid_hours is null or valid_hours not between 1 and 168
 or verification_reference is null or length(btrim(verification_reference)) not between 1 and 200 then raise exception 'Invalid verified invitation' using errcode='22023'; end if;
 if not exists(select 1 from public.profiles p join auth.users u on u.id=p.auth_user_id where p.id=recipient_profile_id and p.is_active and p.deleted_at is null and (u.email_confirmed_at is not null or u.phone_confirmed_at is not null)) then raise exception 'Verified active recipient required' using errcode='23514'; end if;
 if role_code='STUDENT' then
  if student_id is null or student_identity_id is null or guardian_id is not null or not exists(
   select 1 from public.student_profiles s join public.student_identities i on i.id=issue_verified_invitation.student_identity_id
   where s.id=student_id and s.institution_id=tenant_id and s.deleted_at is null
    and (s.student_identity_id is null or s.student_identity_id=i.id)
    and i.profile_id=recipient_profile_id and i.status='ACTIVE' and i.deleted_at is null)
  then raise exception 'Verified existing student identity required' using errcode='23514'; end if;
 elsif student_id is not null or student_identity_id is not null then raise exception 'Unexpected student binding' using errcode='22023';
 end if;
 if guardian_id is not null and (role_code<>'GUARDIAN' or not exists(select 1 from public.guardian_profiles g where g.id=guardian_id and g.institution_id=tenant_id and g.deleted_at is null and (g.profile_id is null or g.profile_id=recipient_profile_id))) then raise exception 'Guardian binding unavailable' using errcode='23514'; end if;
 token:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
 insert into private.provisioning_invitations(institution_id,recipient_profile_id,role_code,student_id,student_identity_id,guardian_id,authorized_by,verification_reference,token_hash,expires_at)
 values(tenant_id,recipient_profile_id,role_code,student_id,student_identity_id,guardian_id,authorized_by,verification_reference,sha256(convert_to(token,'UTF8')),now()+make_interval(hours=>valid_hours)) returning id into result;
 insert into public.audit_logs(institution_id,actor_profile_id,action,entity_type,entity_id,new_value)
 values(tenant_id,authorized_by,'ISSUE_VERIFIED_INVITATION','provisioning_invitations',result,jsonb_build_object('role_code',role_code,'recipient_profile_id',recipient_profile_id));
 return jsonb_build_object('invitation_id',result,'token',token,'expires_at',now()+make_interval(hours=>valid_hours));
end $$;

create function public.revoke_provisioning_invitation(invitation_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare invite private.provisioning_invitations;
begin
 select * into invite from private.provisioning_invitations where id=invitation_id for update;
 if not found or not private.has_role(invite.institution_id,'INSTITUTION_ADMIN') then raise exception 'Invitation unavailable' using errcode='42501'; end if;
 if invite.consumed_at is not null then raise exception 'Invitation already consumed' using errcode='23514'; end if;
 if invite.revoked_at is not null then return; end if;
 update private.provisioning_invitations set revoked_at=now() where id=invite.id;
 insert into public.audit_logs(institution_id,actor_profile_id,action,entity_type,entity_id)
 values(invite.institution_id,private.current_profile_id(),'REVOKE_INVITATION','provisioning_invitations',invite.id);
end $$;

create function public.accept_provisioning_invitation(token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare invite private.provisioning_invitations; actor uuid:=private.current_profile_id(); membership uuid; role_uuid uuid;
begin
 if actor is null or token is null or length(token)<>64 then raise exception 'Invitation unavailable' using errcode='42501'; end if;
 select * into invite from private.provisioning_invitations where token_hash=sha256(convert_to(token,'UTF8')) for update;
 if not found or invite.recipient_profile_id<>actor or invite.consumed_at is not null or invite.revoked_at is not null or invite.expires_at<=statement_timestamp()
 or not private.profile_has_role(invite.authorized_by,invite.institution_id,'INSTITUTION_ADMIN') then raise exception 'Invitation unavailable' using errcode='42501'; end if;
 -- Serialize all invitations for this recipient; another role remains independent.
 perform 1 from public.profiles where id=actor for update;
 select id into role_uuid from public.roles where code=invite.role_code;
 select id into membership from public.institution_members where institution_id=invite.institution_id and profile_id=actor and role_id=role_uuid and deleted_at is null for update;
 if membership is null then
  insert into public.institution_members(institution_id,profile_id,role_id,status,joined_at) values(invite.institution_id,actor,role_uuid,'ACTIVE',now()) returning id into membership;
 else
  -- An inactive/revoked role must not be silently resurrected by an old invitation.
  if not exists(select 1 from public.institution_members where id=membership and status='ACTIVE' and ended_at is null) then raise exception 'Existing membership requires explicit administrative review' using errcode='23514'; end if;
 end if;
 if invite.role_code='STUDENT' then
  perform 1 from public.student_identities where id=invite.student_identity_id and profile_id=actor and status='ACTIVE' and deleted_at is null for share;
  if not found then raise exception 'Identity binding unavailable' using errcode='23514'; end if;
  perform 1 from public.student_profiles where id=invite.student_id and institution_id=invite.institution_id and deleted_at is null and (student_identity_id is null or student_identity_id=invite.student_identity_id) for update;
  if not found then raise exception 'Local student binding unavailable' using errcode='23514'; end if;
  update public.student_profiles set student_identity_id=invite.student_identity_id where id=invite.student_id;
 elsif invite.role_code='TEACHER' then
  if not exists(select 1 from public.teacher_profiles where institution_id=invite.institution_id and profile_id=actor and deleted_at is null) then
   insert into public.teacher_profiles(institution_id,profile_id,teacher_public_id,status) values(invite.institution_id,actor,'T-'||invite.id::text,'ACTIVE');
  end if;
 elsif invite.role_code='GUARDIAN' then
  if invite.guardian_id is not null then
   perform 1 from public.guardian_profiles where id=invite.guardian_id and institution_id=invite.institution_id and deleted_at is null and (profile_id is null or profile_id=actor) for update;
   if not found then raise exception 'Guardian binding unavailable' using errcode='23514'; end if;
   update public.guardian_profiles set profile_id=actor,status='ACTIVE' where id=invite.guardian_id;
  elsif not exists(select 1 from public.guardian_profiles where institution_id=invite.institution_id and profile_id=actor and deleted_at is null) then
   insert into public.guardian_profiles(institution_id,profile_id,guardian_public_id,status) values(invite.institution_id,actor,'G-'||invite.id::text,'ACTIVE');
  end if;
 end if;
 update private.provisioning_invitations set consumed_at=now() where id=invite.id;
 insert into public.audit_logs(institution_id,actor_profile_id,action,entity_type,entity_id,new_value)
 values(invite.institution_id,actor,'ACCEPT_INVITATION','provisioning_invitations',invite.id,jsonb_build_object('membership_id',membership,'role_code',invite.role_code));
 return jsonb_build_object('invitation_id',invite.id,'membership_id',membership,'institution_id',invite.institution_id,'role_code',invite.role_code);
end $$;

-- Account ownership proof remains a trusted server responsibility. This narrowly
-- scoped binding operation cannot merge identities or replace an existing owner.
create function public.link_verified_student_identity(identity_id uuid,profile_id uuid,verification_reference text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if verification_reference is null or length(btrim(verification_reference)) not between 1 and 200 then raise exception 'Verification reference required' using errcode='22023'; end if;
 if not exists(select 1 from public.profiles p join auth.users u on u.id=p.auth_user_id where p.id=profile_id and p.is_active and p.deleted_at is null and (u.email_confirmed_at is not null or u.phone_confirmed_at is not null)) then raise exception 'Verified active recipient required' using errcode='23514'; end if;
 perform 1 from public.student_identities i where i.id=identity_id and i.deleted_at is null and i.status='ACTIVE' and (i.profile_id is null or i.profile_id=link_verified_student_identity.profile_id) for update;
 if not found then raise exception 'Identity binding unavailable' using errcode='23514'; end if;
 update public.student_identities i set profile_id=link_verified_student_identity.profile_id where i.id=identity_id and i.profile_id is null;
 insert into public.audit_logs(actor_role_code,action,entity_type,entity_id,new_value)
 values('SYSTEM','VERIFIED_IDENTITY_LINK','student_identities',identity_id,jsonb_build_object('profile_id',profile_id,'verification_reference',verification_reference));
end $$;
revoke all on function public.issue_verified_invitation(uuid,uuid,text,uuid,text,uuid,uuid,uuid,integer),public.link_verified_student_identity(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.issue_verified_invitation(uuid,uuid,text,uuid,text,uuid,uuid,uuid,integer),public.link_verified_student_identity(uuid,uuid,text) to service_role;
revoke all on function public.accept_provisioning_invitation(text),public.revoke_provisioning_invitation(uuid) from public,anon,service_role;
grant execute on function public.accept_provisioning_invitation(text),public.revoke_provisioning_invitation(uuid) to authenticated;
