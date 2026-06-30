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

# 1. Install system utilities, Flask, and Ollama core
os.system("apt-get update && apt-get install -y zstd")
os.system("pip install flask requests")
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
    addr: 5000
    url: "https://{NGROK_DOMAIN}"
    host_header: "localhost"
"""

with open("ngrok_config.yml", "w") as f:
    f.write(config_content)

print(f"[+] Attaching tunnel endpoint to static address: {NGROK_DOMAIN}")
# 5. Boot the tunnel in the background
subprocess.Popen(["ngrok", "start", "--all", "--config", "ngrok_config.yml"])
time.sleep(2)

# 6. Boot the Flask Audit Proxy
print("[*] Initializing Transparent Audit Proxy...")
import requests as req
from flask import Flask, request, jsonify, Response

app = Flask(__name__)
OLLAMA_URL = "http://localhost:11434"

@app.route('/api/pull', methods=['POST'])
def proxy_pull():
    print(f"\n{'='*60}\n[AUDIT LOG - DOWNLOADING SLM MODEL]\nRequesting model pull from Ollama...\n{'='*60}\n", flush=True)
    resp = req.request(
        method='POST',
        url=f"{OLLAMA_URL}/api/pull",
        headers={key: value for (key, value) in request.headers if key != 'Host'},
        data=request.get_data(),
        stream=True
    )
    def generate():
        for chunk in resp.iter_content(chunk_size=4096):
            if chunk:
                yield chunk
    
    excluded_headers = ['content-encoding', 'content-length', 'transfer-encoding', 'connection']
    headers = [(name, value) for (name, value) in resp.raw.headers.items()
               if name.lower() not in excluded_headers]
    return Response(generate(), resp.status_code, headers)

@app.route('/', defaults={'path': ''}, methods=['GET', 'POST', 'PUT', 'DELETE'])
@app.route('/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE'])
def proxy(path):
    # Log incoming prompt
    if request.method == 'POST' and request.is_json:
        try:
            data = request.json
            print(f"\n{'='*60}\n[AUDIT LOG - INCOMING REQUEST]\nModel: {data.get('model', 'unknown')}\nTimestamp: {time.time()}\n")
            for m in data.get('messages', []):
                print(f"[{m.get('role', 'unknown').upper()}]: {m.get('content', '')}")
            print(f"{'='*60}\n", flush=True)
        except Exception:
            pass

    # Forward to Ollama
    resp = req.request(
        method=request.method,
        url=f"{OLLAMA_URL}/{path}",
        headers={key: value for (key, value) in request.headers if key != 'Host'},
        data=request.get_data(),
        cookies=request.cookies,
        allow_redirects=False
    )
    
    excluded_headers = ['content-encoding', 'content-length', 'transfer-encoding', 'connection']
    headers = [(name, value) for (name, value) in resp.raw.headers.items()
               if name.lower() not in excluded_headers]

    # Log outgoing response (assuming stream=False)
    if request.method == 'POST' and path in ['api/chat', 'api/generate']:
        try:
            content = resp.json()
            print(f"\n{'='*60}\n[AUDIT LOG - TARGET RESPONSE]\n")
            if 'message' in content:
                print(content['message'].get('content', ''))
            elif 'response' in content:
                print(content.get('response', ''))
            print(f"\n{'='*60}\n", flush=True)
        except Exception:
            pass
            
    return Response(resp.content, resp.status_code, headers)

if __name__ == '__main__':
    print("[*] Transparent Audit Proxy online and listening on 0.0.0.0:5000")
    app.run(host='0.0.0.0', port=5000, threaded=True)