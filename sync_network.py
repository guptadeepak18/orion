import os
import subprocess
import socket
import re
from pathlib import Path

# Configuration
PROJECT_ROOT = Path(r"D:\Applications\crc-one")
FRONTEND_ENV = PROJECT_ROOT / "frontend" / ".env"

def get_local_ip():
    """Detects the current local network IP address."""
    try:
        # This creates a dummy socket to find the interface used for external traffic
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception as e:
        print(f"Error detecting IP: {e}")
        return None

def update_env(ip):
    """Updates the frontend .env file with the current IP."""
    print(f"Updating configuration to use IP: {ip}...")
    
    # Content to write to .env
    content = f"VITE_API_BASE_URL=http://{ip}:8000/api/v1\n"
    
    with open(FRONTEND_ENV, "w") as f:
        f.write(content)
    
    print(f"Successfully updated {FRONTEND_ENV}")

def restart_servers():
    """Restarts the frontend server to apply changes."""
    print("Restarting frontend server...")
    # Note: Since the agent usually manages these via 'process', 
    # this script will focus on the config. The agent can then restart 
    # the actual process.
    print("Config updated. Please restart the frontend server.")

def main():
    ip = get_local_ip()
    if not ip:
        print("Could not detect local IP. Please check your network connection.")
        return

    print(f"Current Network IP detected: {ip}")
    update_env(ip)
    restart_servers()
    print("\nSync complete! Your app should now be accessible on your phone via: http://{}:5173".format(ip))

if __name__ == "__main__":
    main()
