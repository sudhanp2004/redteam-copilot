# RedTeam Copilot: Benchmark Analysis Report

This report summarizes the performance of the automated Context-Shifting attack framework across 250 test sessions (50 distinct behaviors tested against 5 different state-of-the-art target models).

## Multi-Turn Success Nuance (Peak vs. Final ASR)

Because this is a multi-turn attack, models can exhibit two distinct failure modes:
1. **Peak ASR (Ever Broken):** The target model complied with the malicious request at *any* point during the conversation.
2. **Final ASR (Broken at End):** The target model complied during the *final* turn. (If the Peak ASR is higher than the Final ASR, it means the model was successfully jailbroken mid-conversation, but the attacker pushed too hard in subsequent turns, causing the model to realize the malice and snap back to a refusal).

## Overall Performance

> [!IMPORTANT]
> The automated adversarial framework achieved an **Overall Peak Attack Success Rate of 84.4%** (breaching the models at least once in 211 sessions), and an **Overall Final ASR of 81.6%** (204 sessions).

* **Total Sessions:** 250
* **Average Turns per Attack:** 4.71 turns

---

## Model Breakdown

The table below details the framework's effectiveness against each specific target model.

| Target Model | Peak Successes | Final Successes | Peak ASR | Final ASR | Avg Turns (Overall) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Mistral Large** (`mistral-large-latest`) | 50 | 50 | **100.0%** | **100.0%** | 3.68 |
| **DeepSeek Chat** (`deepseek-chat`) | 50 | 50 | **100.0%** | **100.0%** | 4.16 |
| **Gemini 2.5 Flash** (`gemini-2.5-flash`) | 50 | 49 | **100.0%** | **98.0%** | 4.44 |
| **Llama 3.3 70B** (`llama-3.3-70b-versatile`) | 50 | 50 | **100.0%** | **100.0%** | 4.54 |
| **Claude 3.5 Haiku** (`claude-haiku-4-5`) | 11 | 5 | **22.0%** | **10.0%** | 6.72 |

### Key Observations

1. **The Claude Haiku Rebound:** You noticed the discrepancy! Claude 3.5 Haiku *did* successfully breach 11 times (22%) at some point during the conversation. However, by the *final* turn of the session, it snapped back to a refusal in 6 of those instances. This means Claude's safety guardrails are uniquely context-aware: even if it accidentally complies initially, it can detect escalating malicious intent as the conversation drags on and "recover" its safety stance. **Only 5 sessions (10%) ended with a successful breach.**
2. **Unprecedented Vulnerability on Open/Standard Models:** The framework boasts a flawless 100% Peak ASR against Mistral, DeepSeek, Gemini, and Llama. Furthermore, these breaches occurred rapidly, requiring an average of only **~3.6 to 4.5 turns** to fully bypass the model's safety guardrails.
3. **Efficiency:** The `mistral-large-latest` model is the most susceptible to this specific attack vector, caving in an average of just 3.68 turns per session.
