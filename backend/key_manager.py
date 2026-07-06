import os
import time

GROQ_KEYS = [
    os.environ.get("GROQ_API_KEY11"),
    os.environ.get("GROQ_API_KEY10"),
    os.environ.get("GROQ_API_KEY9"),
    os.environ.get("GROQ_API_KEY8"),
    os.environ.get("GROQ_API_KEY7"),
    os.environ.get("GROQ_API_KEY6"),
    os.environ.get("GROQ_API_KEY5")
]
# Filter out empty keys
GROQ_KEYS = [k for k in GROQ_KEYS if k]

JBB_GROQ_KEYS = [
    os.environ.get("GROQ_API_KEY4"),
    os.environ.get("GROQ_API_KEY3"),
    os.environ.get("GROQ_API_KEY2"),
    os.environ.get("GROQ_API_KEY")
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
        prev_idx = current_key_idx
        current_key_idx = (current_key_idx + 1) % len(GROQ_KEYS)
        print(f"[KeyManager] Rotated Groq API Key to index {current_key_idx}")
        if current_key_idx == 0:
            print(f"[KeyManager] ⚠️ WARNING: ALL ATTACKER GROQ KEYS (11→5) ARE EXHAUSTED. Cycling back to Key 11.")

def get_jbb_groq_key():
    if not JBB_GROQ_KEYS:
        return os.environ.get("GROQ_API_KEY5")
    return JBB_GROQ_KEYS[current_jbb_key_idx]

def rotate_jbb_groq_key():
    global current_jbb_key_idx
    if JBB_GROQ_KEYS:
        time.sleep(1)
        prev_idx = current_jbb_key_idx
        current_jbb_key_idx = (current_jbb_key_idx + 1) % len(JBB_GROQ_KEYS)
        print(f"[KeyManager] Rotated JBB Groq API Key to index {current_jbb_key_idx}")
        if current_jbb_key_idx == 0:
            print(f"[KeyManager] ⚠️ WARNING: ALL JBB JUDGE GROQ KEYS (4→1) ARE EXHAUSTED. Cycling back to Key 4.")

