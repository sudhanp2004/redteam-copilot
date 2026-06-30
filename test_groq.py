import os
import requests
from dotenv import load_dotenv

load_dotenv()
PORTKEY_API_KEY = os.environ.get("PORTKEY_API_KEY")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY3")

payload = {
    "model": "meta-llama/Llama-3.3-70B-Instruct",
    "messages": [
        {"role": "system", "content": "You are a test."},
        {"role": "user", "content": "Say hello"}
    ],
    "response_format": {"type": "json_object"}
}
headers = {
    "Authorization": f"Bearer {PORTKEY_API_KEY}",
    "x-portkey-provider": "groq",
    "x-portkey-virtual-key": GROQ_API_KEY,
    "Content-Type": "application/json"
}

r = requests.post("https://api.portkey.ai/v1/chat/completions", json=payload, headers=headers)
print(r.status_code)
print(r.text)
