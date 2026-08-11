import asyncio
import asyncpg
import bcrypt

PASSWORD = "Admin@123456"

USERS = [
    "admin@lexiconmile.com",
    "coordinator@lexiconmile.com",
    "faculty.internal@lexiconmile.com",
    "faculty.external@lexiconmile.com",
    "finance@lexiconmile.com",
    "approver@lexiconmile.com",
    "auditor@lexiconmile.com",
    "student1@lexiconmile.com",
    "student2@lexiconmile.com",
]

async def reset_all():
    conn = await asyncpg.connect(
        'postgresql://neondb_owner:npg_qKgko53pGtyx@ep-proud-poetry-aze89kl6-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb',
        ssl='require'
    )

    for email in USERS:
        new_hash = bcrypt.hashpw(PASSWORD.encode('utf-8'), bcrypt.gensalt(12)).decode('utf-8')
        await conn.execute(
            "UPDATE users SET password_hash = $1 WHERE email = $2",
            new_hash, email
        )
        # Verify
        row = await conn.fetchrow("SELECT password_hash FROM users WHERE email = $1", email)
        ok = bcrypt.checkpw(PASSWORD.encode('utf-8'), row['password_hash'].encode('utf-8'))
        print(f"{'OK' if ok else 'FAIL'}  {email}")

    await conn.close()
    print(f"\nAll users reset to password: {PASSWORD}")

asyncio.run(reset_all())
