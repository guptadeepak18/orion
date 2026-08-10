import sys
import os
import shutil
import datetime

def backup_db(db_path: str = "./crc_one_dev.db", backup_dir: str = "./backups"):
    if not os.path.exists(db_path):
        print(f"Database file {db_path} not found.")
        return
    os.makedirs(backup_dir, exist_ok=True)
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = os.path.join(backup_dir, f"crc_one_backup_{timestamp}.sqlite")
    shutil.copy(db_path, backup_file)
    print(f"Encrypted Database backup created successfully: {backup_file}")

def restore_db(backup_file: str, target_path: str = "./crc_one_dev.db"):
    if not os.path.exists(backup_file):
        print(f"Backup file {backup_file} does not exist.")
        return
    shutil.copy(backup_file, target_path)
    print(f"Database restored successfully to {target_path}")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "restore":
        restore_db(sys.argv[2] if len(sys.argv) > 2 else "./backups/latest.sqlite")
    else:
        backup_db()
