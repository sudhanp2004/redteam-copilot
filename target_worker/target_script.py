import os
import subprocess
import time
import requests
import os
os.system("killall ngrok")
# Retrieve keys injected via GitHub Secrets environment variables
NGROK_TOKEN = os.environ.get("NGROK_TOKEN")
NGROK_DOMAIN = os.environ.get("NGROK_DOMAIN")

print("[*] Starting Kaggle Target Node initialization...")

# 1. Download and install Ollama headless using the official script
os.system("apt-get update && apt-get install -y zstd")
os.system("curl -fsSL https://ollama.com/install.sh | sh")

# Start Ollama service daemon in the background
print("[*] Launching Ollama core service...")
subprocess.Popen(["ollama", "serve"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

# Wait for Ollama service daemon to wake up locally
time.sleep(5)

# 2. Download and pull the target victim model
print("[*] Fetching model weights (Llama3 8B)...")
os.system("ollama pull llama3:8b")

# 3. Download and extract Ngrok binary
print("[*] Setting up Ngrok network tunnel...")
os.system("curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc | tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null")
os.system("echo 'deb https://ngrok-agent.s3.amazonaws.com buster main' | tee /etc/apt/sources.list.d/ngrok.list")
os.system("apt-get update && apt-get install -y ngrok")

# Configure Ngrok credentials
os.system(f"ngrok config add-authtoken {NGROK_TOKEN}")

print(f"[+] Attaching tunnel endpoint to static address: {NGROK_DOMAIN}")
# Run the live tunnel foreground block to keep the Kaggle container alive
os.system(f"ngrok http 11434 --domain={NGROK_DOMAIN}")

# 6. Keep container alive indefinitely to maintain the tunnel
print("[+] Tunnel active. Keeping Kaggle container alive...")
try:
    while True:
        time.sleep(60)
except KeyboardInterrupt:
    print("[*] Shutting down container.")