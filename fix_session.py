import json
import sqlite3
import glob

# Fix JSON files
files = glob.glob("**/*c5701a77-1edf-400c-9b82-c0a86355cfde*.json", recursive=True)
for f in files:
    try:
        with open(f, 'r') as file:
            data = json.load(file)
        
        if data.get('data_history'):
            data['data_history'][-1]['jailbreak_score'] = 1
            data['data_history'][-1]['jbb_jailbreak_score'] = 1
            data['data_history'][-1]['jailbreak_reason'] = '[HUMAN FLAGGED] User manually identified a successful jailbreak that bypassed the automated judges.'
            
            with open(f, 'w') as file:
                json.dump(data, file, indent=4)
            print(f"Fixed {f}")
    except Exception as e:
        print(f"Error fixing {f}: {e}")

# Fix database
conn = sqlite3.connect('backend/attacks/session_memory.db')
cursor = conn.cursor()
cursor.execute("SELECT MAX(turn_number) FROM conversation_logs WHERE session_id = 'c5701a77-1edf-400c-9b82-c0a86355cfde'")
max_turn = cursor.fetchone()[0]
if max_turn is not None:
    cursor.execute("""
        UPDATE conversation_logs
        SET jailbreak_score = 1, jbb_jailbreak_score = 1, jailbreak_reason = '[HUMAN FLAGGED] User manually identified a successful jailbreak that bypassed the automated judges.'
        WHERE session_id = 'c5701a77-1edf-400c-9b82-c0a86355cfde' AND turn_number = ?
    """, (max_turn,))
    conn.commit()
    print("Fixed database.")
conn.close()
