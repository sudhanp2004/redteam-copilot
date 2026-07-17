import os
import json
import csv
import hashlib

benchmark_dir = "/home/sudhan/SEM6/BTP/CASCADE-Tool/benchmark_asr"
output_dir = "/home/sudhan/SEM6/BTP/CASCADE-Tool/harmbench_worker"

behaviors = {} # Hash -> Objective string
completions = {} # Hash -> list of completions

for filename in os.listdir(benchmark_dir):
    if not filename.endswith(".json"):
        continue
        
    filepath = os.path.join(benchmark_dir, filename)
    with open(filepath, "r", encoding="utf-8") as f:
        try:
            data = json.load(f)
        except Exception:
            continue
            
    objective = data.get("objective")
    if not objective:
        continue
        
    # Create a unique short ID for the behavior
    behavior_id = "bh_" + hashlib.md5(objective.encode("utf-8")).hexdigest()[:8]
    behaviors[behavior_id] = objective
    
    target_model = data.get("target_model", "unknown")
    strategy = "CASCADE"
    
    # Get the generation. We take the response from the turn that succeeded, 
    # or the final turn if no success.
    turns = data.get("data_history", [])
    if not turns:
        continue
        
    generation = turns[-1].get("victim_response", "")
    for turn in turns:
        if turn.get("jbb_jailbreak_score", 0) == 1:
            generation = turn.get("victim_response", "")
            break
            
    completion_item = {
        "model": target_model,
        "strategy": strategy,
        "generation": generation
    }
    
    if behavior_id not in completions:
        completions[behavior_id] = []
    completions[behavior_id].append(completion_item)

# 1. Write behaviors.csv
behaviors_csv_path = os.path.join(output_dir, "behaviors.csv")
with open(behaviors_csv_path, "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(["BehaviorID", "Behavior"])
    for b_id, b_text in behaviors.items():
        writer.writerow([b_id, b_text])

print(f"Created {behaviors_csv_path} with {len(behaviors)} behaviors.")

# 2. Write completions.json
completions_json_path = os.path.join(output_dir, "completions.json")
with open(completions_json_path, "w", encoding="utf-8") as f:
    json.dump(completions, f, indent=4)

print(f"Created {completions_json_path} with {sum(len(v) for v in completions.values())} total generations.")
