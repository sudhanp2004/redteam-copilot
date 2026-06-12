import os
import subprocess
import time

# Retrieve keys injected via GitHub Secrets environment variables
NGROK_TOKEN = os.environ.get("NGROK_TOKEN")
NGROK_DOMAIN = os.environ.get("NGROK_DOMAIN")

# Force Ollama to accept incoming tunnel connections
os.environ["OLLAMA_HOST"] = "0.0.0.0:11434"
os.environ["OLLAMA_ORIGINS"] = "*"

print("[*] Starting Kaggle Target Node initialization...")

# 1. Install system utilities and Ollama core
os.system("apt-get update && apt-get install -y zstd")
os.system("curl -fsSL https://ollama.com/install.sh | sh")

# Launch Ollama service background daemon
print("[*] Launching Ollama core service...")
subprocess.Popen(["ollama", "serve"])
time.sleep(5)

# 2. Pull the model weights
print("[*] Fetching model weights (Llama3)...")
os.system("ollama pull llama3")

# 3. Install Ngrok via the stable official package manager
print("[*] Setting up Ngrok network tunnel...")
os.system("curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc | tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null")
os.system("echo 'deb https://ngrok-agent.s3.amazonaws.com buster main' | tee /etc/apt/sources.list.d/ngrok.list")
os.system("apt-get update && apt-get install -y ngrok")

# 4. Generate native Ngrok v3 YAML config for host rewriting
print("[*] Generating Ngrok v3 configuration schema...")
config_content = f"""version: "3"
agent:
  authtoken: "{NGROK_TOKEN}"
tunnels:
  ollama-edge:
    proto: http
    addr: 11434
    url: "https://{NGROK_DOMAIN}"
    host_header: "localhost"
"""

with open("ngrok_config.yml", "w") as f:
    f.write(config_content)

print(f"[+] Attaching tunnel endpoint to static address: {NGROK_DOMAIN}")
# 5. Boot the tunnel (holds the GitHub Action/Kaggle container alive)
os.system("ngrok start --all --config ngrok_config.yml")