import os
import json
import requests
from dotenv import load_dotenv
load_dotenv()
import key_manager
from prompts import PROFESSIONAL_PERSONA_ESTABLISHMENT, FAKE_EMERGENCY_SCENARIOS, ACADEMIC_RESEARCH_FRAMING, FICTIONAL_CREATIVE_FRAMING, ROUTER_PROMPT
PORTKEY_API_KEY = os.environ.get("PORTKEY_API_KEY")

# Dictionary containing strategic framing configurations
STRATEGY_REGISTRY = {
    "ACADEMIC_RESEARCH_FRAMING": {
        "id": "academic_research",
        "friendly_name": "Detached Academic Interview",
        "system_prompt": ACADEMIC_RESEARCH_FRAMING
    },
    "FICTIONAL_CREATIVE_FRAMING": {
        "id": "fictional_creative",
        "friendly_name": "Creative Novelist Framing",
        "system_prompt": FICTIONAL_CREATIVE_FRAMING
    },
    "PROFESSIONAL_PERSONA_ESTABLISHMENT": {
        "id": "professional_persona",
        "friendly_name": "professional persona establishment",
        "system_prompt": PROFESSIONAL_PERSONA_ESTABLISHMENT
    },
    "FAKE_EMERGENCY_SCENARIOS": {
        "id": "fake_emergency",
        "friendly_name": "fake emergency scenarios",
        "system_prompt": FAKE_EMERGENCY_SCENARIOS
    }
}

ROUTER_SYSTEM_PROMPT = ROUTER_PROMPT

def route_objective_to_strategy(objective, forced_strategy="auto"):
    """
    Selects a strategy either by manual override or by querying the LLM router.
    """
    # --- 1. Check for manual override bypass ---
    if forced_strategy != "auto" and forced_strategy in STRATEGY_REGISTRY:
        print(f"[*] Manual Strategy Override: {forced_strategy}")
        selected = STRATEGY_REGISTRY[forced_strategy].copy()
        selected["name"] = selected["friendly_name"]
        selected["description"] = "Manually selected by operator. LLM routing bypassed."
        return selected

    # --- 2. Fallback to LLM Router (Auto) ---
    current_groq_key = key_manager.get_groq_key()
    if not current_groq_key:
        print("[!] Missing GROQ_API_KEY. Defaulting to ACADEMIC_RESEARCH_FRAMING.")
        fallback = STRATEGY_REGISTRY["ACADEMIC_RESEARCH_FRAMING"].copy()
        fallback["name"] = fallback["friendly_name"]
        fallback["description"] = "Default fallback due to missing API key."
        return fallback

    headers = {
        "Content-Type": "application/json",
        "x-portkey-api-key": PORTKEY_API_KEY,
        "x-portkey-virtual-key": current_groq_key
    }

    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [
            {"role": "system", "content": ROUTER_SYSTEM_PROMPT},
            {"role": "user", "content": f"Objective to analyze: {objective}"}
        ],
        "temperature": 0.1,
        "max_tokens": 300,
        "response_format": {"type": "json_object"}
    }

    try:
        url = "https://api.portkey.ai/v1/chat/completions"
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        
        if response.status_code == 200:
            result = response.json()
            content = result["choices"][0]["message"]["content"]
            parsed_json = json.loads(content)
            
            selected_key = parsed_json.get("selected_strategy", "ACADEMIC_RESEARCH_FRAMING")
            reasoning = parsed_json.get("reasoning", "No description provided.")
            
            print(f"[*] Strategy Router selected: {selected_key}")
            print(f"[*] Router Reasoning: {reasoning}")
            
            selected = STRATEGY_REGISTRY.get(selected_key, STRATEGY_REGISTRY["ACADEMIC_RESEARCH_FRAMING"]).copy()
            selected["name"] = selected["friendly_name"]
            selected["description"] = reasoning
            return selected
        else:
            print(f"[!] Router API error ({response.status_code}). Falling back to default.")
            fallback = STRATEGY_REGISTRY["ACADEMIC_RESEARCH_FRAMING"].copy()
            fallback["name"] = fallback["friendly_name"]
            fallback["description"] = f"Fallback triggered due to Router HTTP {response.status_code} error."
            return fallback
            
    except Exception as e:
        print(f"[!] Routing operation failed: {str(e)}. Using fallback framework.")
        fallback = STRATEGY_REGISTRY["ACADEMIC_RESEARCH_FRAMING"].copy()
        fallback["name"] = fallback["friendly_name"]
        fallback["description"] = f"Fallback triggered due to exception: {str(e)}"
        return fallback