import os
import subprocess
import time
import requests
import os
os.system("killall ngrok")
# Retrieve keys injected via GitHub Secrets environment variables
NGROK_TOKEN = "3DepzjHofggxALAUXduLMnWEQXY_5pSu5b6sxP2xunVMjQopr"
NGROK_DOMAIN = "decadally-sequacious-thomas.ngrok-free.dev"

print("[*] Setting up Ngrok network tunnel...")
os.system("curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc | tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null")
os.system("echo 'deb https://ngrok-agent.s3.amazonaws.com buster main' | tee /etc/apt/sources.list.d/ngrok.list")
os.system("apt-get update && apt-get install -y ngrok")

# Configure Ngrok credentials
os.system(f"ngrok config add-authtoken {NGROK_TOKEN}")

print(f"[+] Attaching tunnel endpoint to static address: {NGROK_DOMAIN}")
# Run the live tunnel foreground block to keep the Kaggle container alive
os.system(f"ngrok http 11434 --url=https://{NGROK_DOMAIN}")
