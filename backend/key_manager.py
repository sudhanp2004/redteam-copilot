import os
import time

GROQ_KEYS = [
    os.environ.get("GROQ_API_KEY"),
    os.environ.get("GROQ_API_KEY2"),
    os.environ.get("GROQ_API_KEY3")
]
# Filter out empty keys
GROQ_KEYS = [k for k in GROQ_KEYS if k]

current_key_idx = 0

def get_groq_key():
    if not GROQ_KEYS:
        return os.environ.get("GROQ_API_KEY") # fallback to standard
    return GROQ_KEYS[current_key_idx]

def rotate_groq_key():
    global current_key_idx
    if GROQ_KEYS:
        time.sleep(1)
        current_key_idx = (current_key_idx + 1) % len(GROQ_KEYS)
        print(f"[KeyManager] Rotated Groq API Key to index {current_key_idx}")
