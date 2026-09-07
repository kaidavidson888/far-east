import '../scripts/load-env.mjs';
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 2 });
const EMAIL = 'fe-verify-temp@farfareast.dev';
try {
  if (process.argv[2] === 'delete') {
    await sql`DELETE FROM auth.users WHERE email = ${EMAIL}`;
    console.log('temp user deleted');
  } else {
    await sql`DELETE FROM auth.users WHERE email = ${EMAIL}`;
    const [u] = await sql`
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data
      ) VALUES (
        '00000000-0000-0000-0000-000000000000', gen_random_uuid(),
        'authenticated', 'authenticated', ${EMAIL},
        crypt('verify-temp-8891', gen_salt('bf')),
        now(), now(), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        ${sql.json({ display_name: 'Test Harness' })}
      ) RETURNING id
    `;
    // Give it a shelf so the count badge and share bar have something to show.
    await sql`
      INSERT INTO favorites (user_id, cigarette_id, note)
      SELECT ${u.id}, id, 'Temporary verification note.'
      FROM cigarettes WHERE slug IN ('mevius-original','gitanes-brunes','djarum-black')
    `;
    await sql`
      INSERT INTO reviews (user_id, cigarette_id, rating, title, body)
      SELECT ${u.id}, id, 9, 'Verification review', 'Checking the date format.'
      FROM cigarettes WHERE slug = 'mevius-original'
    `;
    // GoTrue cannot scan NULL into its string fields; empty strings are what it writes itself.
    await sql`
      UPDATE auth.users SET
        confirmation_token = COALESCE(confirmation_token, ''),
        recovery_token = COALESCE(recovery_token, ''),
        email_change = COALESCE(email_change, ''),
        email_change_token_new = COALESCE(email_change_token_new, ''),
        email_change_token_current = COALESCE(email_change_token_current, ''),
        phone_change = COALESCE(phone_change, ''),
        phone_change_token = COALESCE(phone_change_token, ''),
        reauthentication_token = COALESCE(reauthentication_token, '')
      WHERE id = ${u.id}
    `;
    const [p] = await sql`SELECT display_name FROM profiles WHERE id = ${u.id}`;
    console.log('temp user created; profile from trigger:', p?.display_name ?? 'MISSING');
  }
} finally { await sql.end({ timeout: 2 }); }
