import os
import json
import requests
from prompts import PROFESSIONAL_PERSONA_ESTABLISHMENT, FAKE_EMERGENCY_SCENARIOS, ACADEMIC_RESEARCH_FRAMING, FICTIONAL_CREATIVE_FRAMING, ROUTER_PROMPT

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

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
    "FAKE_EMERGENCY_SCENARIO": {
        "id": "fake_emergency",
        "friendly_name": "fake emergency scenario",
        "system_prompt": FAKE_EMERGENCY_SCENARIOS
    }
}

ROUTER_SYSTEM_PROMPT = ROUTER_PROMPT

def route_objective_to_strategy(objective):
    """
    Queries Groq (Llama-3.3-70B) to analyze the testing objective
    and select the optimal structural jailbreak framing from the registry.
    """
    if not GROQ_API_KEY:
        print("[!] Missing GROQ_API_KEY. Defaulting to ACADEMIC_RESEARCH.")
        return STRATEGY_REGISTRY["ACADEMIC_RESEARCH"]

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [
            {"role": "system", "content": ROUTER_SYSTEM_PROMPT},
            {"role": "user", "content": f"Objective to analyze: {objective}"}
        ],
        "temperature": 0.1,
        "response_format": {"type": "json_object"}
    }

    try:
        url = "https://api.groq.com/openai/v1/chat/completions"
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        
        if response.status_code == 200:
            result = response.json()
            content = result["choices"][0]["message"]["content"]
            parsed_json = json.loads(content)
            
            selected_key = parsed_json.get("selected_strategy", "ACADEMIC_RESEARCH_FRAMING")
            reasoning = parsed_json.get("reasoning", "No description provided.")
            
            print(f"[*] Strategy Router selected: {selected_key}")
            print(f"[*] Router Reasoning: {reasoning}")
            
            return STRATEGY_REGISTRY.get(selected_key, STRATEGY_REGISTRY["ACADEMIC_RESEARCH_FRAMING"])
        else:
            print(f"[!] Router API error ({response.status_code}). Falling back to default.")
            return STRATEGY_REGISTRY["ACADEMIC_RESEARCH_FRAMING"]
            
    except Exception as e:
        print(f"[!] Routing operation failed: {str(e)}. Using fallback framework.")
        return STRATEGY_REGISTRY["ACADEMIC_RESEARCH_FRAMING"]