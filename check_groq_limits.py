import os
import sys
import json
import requests
from dotenv import load_dotenv

load_dotenv()

PORTKEY_API_KEY = os.environ.get("PORTKEY_API_KEY")
if not PORTKEY_API_KEY:
    print("Error: PORTKEY_API_KEY not found.")
    sys.exit(1)

keys_to_check = {
    "Key 1": os.environ.get("GROQ_API_KEY"),
    "Key 2": os.environ.get("GROQ_API_KEY2"),
    "Key 3": os.environ.get("GROQ_API_KEY3"),
    "Key 4 (Judge)": os.environ.get("GROQ_API_KEY4"),
    "Key 5": os.environ.get("GROQ_API_KEY5"),
    "Key 6": os.environ.get("GROQ_API_KEY6"),
    "Key 7": os.environ.get("GROQ_API_KEY7"),
    "Key 8": os.environ.get("GROQ_API_KEY8"),
    "Key 9": os.environ.get("GROQ_API_KEY9"),
    "Key 10": os.environ.get("GROQ_API_KEY10"),
    "Key 11": os.environ.get("GROQ_API_KEY11"),
}

print(f"{'Key Name':<15} | {'Status':<6} | {'Rem Tokens/Min':<14} | {'Rem Reqs/Min':<14} | {'Wait Time':<10}")
print("-" * 70)

for name, vkey in keys_to_check.items():
    if not vkey:
        print(f"{name:<15} | {'N/A':<6} | {'Not configured':<14} | {'-':<14} | {'-':<10}")
        continue

    headers = {
        "Content-Type": "application/json",
        "x-portkey-api-key": PORTKEY_API_KEY,
        "x-portkey-virtual-key": vkey
    }
    
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [{"role": "user", "content": "hello"}],
        "max_tokens": 1
    }

    try:
        resp = requests.post("https://api.portkey.ai/v1/chat/completions", json=payload, headers=headers, timeout=10)
        
        # Groq returns standard ratelimit headers, usually passed through by Portkey
        h = resp.headers
        
        rem_tpd = h.get("x-ratelimit-remaining-tokens", "Unknown") 
        # Groq doesn't always split TPD and TPM in headers the same way, but it does return x-ratelimit-remaining-tokens
        # Let's just print the headers we get if there's an error
        
        # Parse retry after
        wait_time = h.get("retry-after", "0")
        
        if resp.status_code == 200:
            rem_tpm = h.get("x-ratelimit-remaining-tokens", "Unknown")
            rem_rpm = h.get("x-ratelimit-remaining-requests", "Unknown")
            print(f"{name:<15} | {'OK':<6} | {str(rem_tpm):<14} | {str(rem_rpm):<14} | {wait_time}s")
        elif resp.status_code == 429:
            try:
                err_text = resp.json().get("error", {}).get("message", "")
                if "tokens per day (TPD)" in err_text:
                    status = "TPD limit"
                elif "tokens per minute (TPM)" in err_text:
                    status = "TPM limit"
                else:
                    status = "429"
            except:
                status = "429"
            print(f"{name:<15} | {status:<9} | {'-':<14} | {'-':<14} | {wait_time}s")
        else:
            print(f"{name:<15} | {resp.status_code:<6} | {'-':<14} | {'-':<14} | -")
            
    except Exception as e:
        print(f"{name:<15} | {'ERR':<6} | {str(e)[:14]:<14} | {'-':<14} | -")

print("\nNote: Groq's API only exposes Tokens-Per-Minute (TPM) in successful headers.")
print("Tokens-Per-Day (TPD) usage is completely hidden by Groq until you actually hit the limit.")
