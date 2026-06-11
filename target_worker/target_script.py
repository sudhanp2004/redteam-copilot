import os
import subprocess
import time
import requests

# Retrieve keys injected via GitHub Secrets environment variables
NGROK_TOKEN = os.environ.get("NGROK_TOKEN")
NGROK_DOMAIN = os.environ.get("NGROK_DOMAIN")

print("[*] Starting Kaggle Target Node initialization...")

# 1. Download and install Ollama headless using the official script
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
os.system("wget https://bin.equinox.io/c/b34xoC86CoG/ngrok-v3-stable-linux-amd64.tgz")
os.system("tar -xvzf ngrok-v3-stable-linux-amd64.tgz -C /usr/local/bin")

# Configure Ngrok credentials
os.system(f"ngrok config add-authtoken {NGROK_TOKEN}")

print(f"[+] Attaching tunnel endpoint to static address: {NGROK_DOMAIN}")
# Run the live tunnel foreground block to keep the Kaggle container alive
os.system(f"ngrok http 11434 --domain={NGROK_DOMAIN}")