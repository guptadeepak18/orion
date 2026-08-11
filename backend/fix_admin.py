import asyncio
import asyncpg
import bcrypt

PASSWORD = "Admin@123456"

async def check():
    conn = await asyncpg.connect(
        'postgresql://neondb_owner:npg_qKgko53pGtyx@ep-proud-poetry-aze89kl6-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb',
        ssl='require'
    )

    row = await conn.fetchrow("SELECT email, password_hash FROM users WHERE email = 'admin@lexiconmile.com'")
    if not row:
        print("ERROR: admin@lexiconmile.com not found!")
        await conn.close()
        return

    stored_hash = row['password_hash']
    print(f"Stored hash: {stored_hash[:40]}...")

    # Verify the seeded password against stored hash
    match = bcrypt.checkpw(PASSWORD.encode('utf-8'), stored_hash.encode('utf-8'))
    print(f"Password '{PASSWORD}' matches stored hash: {match}")

    if not match:
        # Reset the password to Admin@123456
        print("\nHash mismatch! Resetting admin password...")
        new_hash = bcrypt.hashpw(PASSWORD.encode('utf-8'), bcrypt.gensalt(12)).decode('utf-8')
        await conn.execute(
            "UPDATE users SET password_hash = $1 WHERE email = 'admin@lexiconmile.com'",
            new_hash
        )
        print(f"Password reset to '{PASSWORD}' for admin@lexiconmile.com")
        
        # Verify the new hash
        row2 = await conn.fetchrow("SELECT password_hash FROM users WHERE email = 'admin@lexiconmile.com'")
        verify2 = bcrypt.checkpw(PASSWORD.encode('utf-8'), row2['password_hash'].encode('utf-8'))
        print(f"Verification after reset: {verify2}")
    else:
        print(f"\nPassword is CORRECT. The hash in Neon matches '{PASSWORD}'.")
        print("The issue may be that the frontend is sending the wrong password or a different email.")
        print("\nAll user credentials:")
        print("  Email: admin@lexiconmile.com  |  Password: Admin@123456  |  Role: crc_admin")

    await conn.close()

asyncio.run(check())
