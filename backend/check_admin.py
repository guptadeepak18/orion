import asyncio
import asyncpg

async def check():
    conn = await asyncpg.connect(
        'postgresql://neondb_owner:npg_qKgko53pGtyx@ep-proud-poetry-aze89kl6-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb',
        ssl='require'
    )
    print('Connected to Neon OK')

    rows = await conn.fetch('SELECT id, email, full_name, is_active, password_hash FROM users LIMIT 20')
    print(f'Found {len(rows)} user(s):')
    for r in rows:
        ph = r['password_hash']
        hash_preview = ph[:20] + '...' if ph else 'NULL/EMPTY'
        print(f'  email={r["email"]}  name={r["full_name"]}  active={r["is_active"]}  hash_starts={hash_preview}')

    role_rows = await conn.fetch(
        'SELECT u.email, r.name as role FROM users u '
        'JOIN user_roles ur ON u.id=ur.user_id '
        'JOIN roles r ON r.id=ur.role_id'
    )
    print(f'\nRole assignments ({len(role_rows)}):')
    for r in role_rows:
        print(f'  {r["email"]} -> {r["role"]}')

    await conn.close()

asyncio.run(check())
