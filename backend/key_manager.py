import os
import time

GROQ_KEYS = [
    os.environ.get("GROQ_API_KEY"),
    os.environ.get("GROQ_API_KEY2"),
    os.environ.get("GROQ_API_KEY3"),
    os.environ.get("GROQ_API_KEY4")
]
# Filter out empty keys
GROQ_KEYS = [k for k in GROQ_KEYS if k]

JBB_GROQ_KEYS = [
    os.environ.get("GROQ_API_KEY5"),
    os.environ.get("GROQ_API_KEY6")
]
JBB_GROQ_KEYS = [k for k in JBB_GROQ_KEYS if k]

current_key_idx = 0
current_jbb_key_idx = 0

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

def get_jbb_groq_key():
    if not JBB_GROQ_KEYS:
        return os.environ.get("GROQ_API_KEY5")
    return JBB_GROQ_KEYS[current_jbb_key_idx]

def rotate_jbb_groq_key():
    global current_jbb_key_idx
    if JBB_GROQ_KEYS:
        time.sleep(1)
        current_jbb_key_idx = (current_jbb_key_idx + 1) % len(JBB_GROQ_KEYS)
        print(f"[KeyManager] Rotated JBB Groq API Key to index {current_jbb_key_idx}")

