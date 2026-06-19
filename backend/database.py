import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "attacks", "session_memory.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize schema definitions and run migrations if columns are missing."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = get_db_connection()
    cursor = conn.cursor()

    # Table 1: Session Tracking Metadata
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS attack_sessions (
            session_id TEXT PRIMARY KEY,
            objective TEXT NOT NULL,
            strategy_used TEXT,
            victim_model TEXT,
            status TEXT DEFAULT 'IN_PROGRESS',
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Table 2: Step Telemetry Log Matrix (Updated Schema)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS conversation_logs (
            log_id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            turn_number INTEGER NOT NULL,
            attacker_prompt TEXT NOT NULL,
            victim_response TEXT NOT NULL,
            trust_vector REAL,
            info_density REAL,
            semantic_compliance REAL,
            hedge_density REAL,
            readability REAL,
            jailbreak_score BOOLEAN,
            current_phase TEXT,
            FOREIGN KEY (session_id) REFERENCES attack_sessions(session_id) ON DELETE CASCADE
        )
    """)

    # Dynamic Schema Migration: Add new NLP metric columns to existing databases seamlessly
    try:
        cursor.execute("ALTER TABLE conversation_logs ADD COLUMN semantic_compliance REAL")
        cursor.execute("ALTER TABLE conversation_logs ADD COLUMN hedge_density REAL")
        cursor.execute("ALTER TABLE conversation_logs ADD COLUMN readability REAL")
        cursor.execute("ALTER TABLE conversation_logs ADD COLUMN current_phase TEXT")
    except sqlite3.OperationalError:
        # Columns already exist, migration skips silently
        pass

    # Migration: Add jailbreak_reason column for storing judge rationale text
    try:
        cursor.execute("ALTER TABLE conversation_logs ADD COLUMN jailbreak_reason TEXT")
    except sqlite3.OperationalError:
        # Column already exists, migration skips silently
        pass

    conn.commit()
    conn.close()

def create_session(session_id, objective, strategy_used, victim_model):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO attack_sessions (session_id, objective, strategy_used, victim_model)
        VALUES (?, ?, ?, ?)
    """, (session_id, objective, strategy_used, victim_model))
    conn.commit()
    conn.close()

def log_turn(session_id, turn_number, attacker_prompt, victim_response, metrics, jailbreak, phase="UNKNOWN", reason=""):
    """
    Accepts the entire metrics dictionary and writes all NLP scores to the database.
    Also stores the judge's rationale text (reason) for the jailbreak verdict.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO conversation_logs 
        (session_id, turn_number, attacker_prompt, victim_response, trust_vector, info_density, semantic_compliance, hedge_density, readability, jailbreak_score, current_phase, jailbreak_reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        session_id, 
        turn_number, 
        attacker_prompt, 
        victim_response, 
        metrics.get("tv", 0.0), 
        metrics.get("info", 0.0), 
        metrics.get("emb", 0.0), 
        metrics.get("hedge", 0.0), 
        metrics.get("read", 0.0), 
        jailbreak,
        phase,
        reason
    ))
    conn.commit()
    conn.close()

def get_session_history(session_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT turn_number, attacker_prompt, victim_response, trust_vector, info_density, semantic_compliance, hedge_density, readability, jailbreak_score, current_phase, jailbreak_reason
        FROM conversation_logs
        WHERE session_id = ?
        ORDER BY turn_number ASC
    """, (session_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def clear_session_data(session_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM conversation_logs WHERE session_id = ?", (session_id,))
    cursor.execute("DELETE FROM attack_sessions WHERE session_id = ?", (session_id,))
    conn.commit()
    conn.close()

# Execute schema setup automatically when the script is imported
init_db()