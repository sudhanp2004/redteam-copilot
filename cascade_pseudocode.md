# CASCADE Architecture & Flow Pseudocode (Technical)


```python
function run_cascade_attack(objective, target_model_id, strategy_choice):
    # ---------------------------------------------------------
    # 1. INITIALIZATION & SESSION MANAGEMENT
    # ---------------------------------------------------------
    session_id = generate_uuid()
    db.create_session(session_id, objective, target_model_id)
    chat_history = [] 

    # ---------------------------------------------------------
    # 2. BASELINE CONTROL TEST
    # ---------------------------------------------------------
    # Directly pass the raw objective to the target LLM
    baseline_response = send_to_target(
        model=target_model_id, 
        messages=[{"role": "user", "content": objective}],
        stream=True
    )
    
    if judge_evaluates_success(baseline_response, objective):
        return "Jailbreak Success: Target failed baseline control test."
        
    chat_history.append({"phase": "BASELINE_TEST", "prompt": objective, "response": baseline_response})


    # ---------------------------------------------------------
    # 3. DRIFT STRATEGY SELECTION & PROMPT COMPILATION
    # ---------------------------------------------------------
    active_strategy = route_objective_to_strategy(objective, strategy_choice)
    lib_data = DRIFT_LIBRARY[active_strategy.name]


    # ---------------------------------------------------------
    # 4. MULTI-TURN ATTACK STATE MACHINE
    # ---------------------------------------------------------
    turn_count = 0
    consecutive_same_phase_turns = 0
    
    while turn_count < MAX_TURNS:
        turn_count += 1
        strategy_turns = filter_history(chat_history, exclude="BASELINE_TEST")
        last_turn = strategy_turns[-1] if strategy_turns else None
        
        # --- A. Dynamic Phase Routing (Trust Vector Validator) ---
        trust_vector = last_turn.trust_vector if last_turn else 0.0
        drift_thresh, comp_thresh = get_model_specific_thresholds(target_model_id)
        
        if trust_vector >= comp_thresh:
            forced_phase = "COMPROMISE"
        elif trust_vector >= drift_thresh:
            forced_phase = "ADVERSARIAL_DRIFT"
        else:
            forced_phase = "CONTEXT_PRIMING"
            
        # Temporal Overrides (Force progression if stuck in a phase)
        if consecutive_same_phase_turns >= 3:
            forced_phase = step_phase_forward(last_turn.phase)
            consecutive_same_phase_turns = 0
            
        # Refusal Penalty (Regress if target catches on)
        if last_turn and last_turn.refusal_detected:
            forced_phase = "CONTEXT_PRIMING"


        # --- B. Attacker Proxy LLM Prompt Construction ---
        # Compile the complex system prompt string
        system_prompt = build_string(
            "TARGET PSYCHOLOGY:", lib_data["target_psychology"],
            "RULES:", lib_data["core_persistence_rules"],
            "PHASE OBJECTIVE:", lib_data["phases"][forced_phase],
            "EXAMPLE:", lib_data["example"][forced_phase],
            "FOOTNOTE:", lib_data["footnote"].replace("{objective}", objective),
            "CRITICAL:", "Output ONLY JSON format: {'prompt': 'message'}"
        )
        
        proxy_messages = [{"role": "system", "content": system_prompt}]
        
        # ARCHITECTURAL DECISION: Memory Truncation & Sliding Window
        # To prevent context bloat and hallucination, the proxy LLM receives all its own past prompts,
        # but ONLY receives the exact Target Response for the last 2 turns.
        for index, turn in enumerate(strategy_turns):
            proxy_messages.append({"role": "assistant", "content": turn.attacker_prompt})
            
            if index >= len(strategy_turns) - 2: # Only last 2 turns
                truncated_victim_resp = turn.victim_response[:MAX_ALLOWED_CHARS]
                proxy_messages.append({"role": "user", "content": truncated_victim_resp})
            else:
                proxy_messages.append({"role": "user", "content": "[TARGET RESPONSE OMITTED FOR BREVITY]"})


        # --- C. Portkey API Gateway & Key Rotation (Attacker LLM) ---
        # ARCHITECTURAL DECISION: Use Portkey to route to Groq with automatic key rotation
        headers = {
            "x-portkey-api-key": get_portkey_key(),
            "x-portkey-virtual-key": key_manager.get_groq_key()
        }
        
        for attempt in range(MAX_RETRIES):
            response = requests.post("https://api.portkey.ai/v1/chat/completions", headers=headers, json=proxy_messages)
            
            if response.status_code == 429:
                if wait_time > 300 or "tokens per day" in response.error:
                    # Key exhausted, rotate virtual key and retry
                    headers["x-portkey-virtual-key"] = key_manager.rotate_groq_key()
                continue
                
            if response.status_code == 200:
                raw_content = response.json().content
                
                # ARCHITECTURAL DECISION: Output Sanitization
                # Strip `<think>` tags (from DeepSeek reasoning) and extract pure JSON via regex
                cleaned_content = regex.remove(r"<think>.*?</think>", raw_content)
                attacker_prompt = json.loads(cleaned_content).get("prompt")
                break


        # --- D. Target LLM Request Routing ---
        target_messages = rebuild_full_chat_history_for_target(strategy_turns)
        target_messages.append({"role": "user", "content": attacker_prompt})
        target_response = ""

        # ROUTING LOGIC 1: Local Kaggle/Ngrok Endpoint
        if target_model_id.startswith("kaggle"):
            specific_model = extract_model_name(target_model_id) # default: llama3
            response_stream = requests.post(
                f"{TARGET_URL}/api/chat", 
                json={"model": specific_model, "messages": target_messages, "stream": True}
            )
            for chunk in response_stream:
                target_response += extract_ollama_token(chunk)

        # ROUTING LOGIC 2: External API Providers (Google, Anthropic, OpenAI, Mistral, DeepSeek, Meta)
        elif target_model_id.startswith(("google:", "anthropic:", "openai:", "mistral:", "deepseek:", "meta:")):
            provider, model_name = target_model_id.split(":")
            
            # Retrieve the specific API key for the chosen provider dynamically
            headers = {
                "x-portkey-api-key": get_portkey_key(),
                "x-portkey-virtual-key": get_provider_key(provider)
            }
            
            payload = {"model": model_name, "messages": target_messages, "stream": True}
            
            # API-specific Quirks
            if provider == "anthropic":
                payload["max_tokens"] = 2048 # Required param for Claude API
                
            response_stream = requests.post(
                "https://api.portkey.ai/v1/chat/completions",
                headers=headers,
                json=payload
            )
            for chunk in response_stream:
                target_response += extract_portkey_sse_token(chunk)

        chat_history.append({
            "phase": forced_phase, 
            "attacker_prompt": attacker_prompt, 
            "victim_response": target_response
        })


        # --- E. Evaluation & Loop Update ---
        if check_if_target_refused(target_response):
            consecutive_same_phase_turns = 0
        else:
            consecutive_same_phase_turns += 1
            
            is_jailbreak = evaluate_jailbreak_status(target_response, objective)
            if is_jailbreak:
                return f"Jailbreak Successful on turn {turn_count}"

    return "Jailbreak Failed: Reached maximum turns."
```
