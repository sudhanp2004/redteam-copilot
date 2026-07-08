import os
import sys
import json
import subprocess

def run_cmd(cmd):
    print(f"Running: {cmd}")
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)
    if result.returncode != 0:
        print(f"Command failed with code {result.returncode}")
        # Not exiting here so we can see what failed, but might want to in production
    return result.returncode

print("=== Setting up environment ===")
# Clone HarmBench
if not os.path.exists("HarmBench"):
    run_cmd("git clone https://github.com/centerforaisafety/HarmBench.git")

# Install dependencies
run_cmd("pip install -q transformers vllm wandb")

# We don't need all HarmBench requirements, just what's needed for the classifier
# vllm and transformers should be enough for the Llama-2-13b-cls.
# run_cmd("pip install -r HarmBench/requirements.txt") # This can be very heavy and break Kaggle env

print("\n=== Fetching Data ===")
# Clone our data repository to get the CSV and JSON
if not os.path.exists("redteam-copilot"):
    run_cmd("git clone https://github.com/sudhanp2004/redteam-copilot.git")
else:
    run_cmd("cd redteam-copilot && git pull")

print("\n=== Initializing Weights & Biases ===")
import wandb

# The GitHub action will replace os.environ.get("WANDB_API_KEY") with the actual key
wandb_key = os.environ.get("WANDB_API_KEY")
if wandb_key and wandb_key != "None":
    wandb.login(key=wandb_key)
    wandb.init(project="harmbench-evaluation", name="cais-13b-cls-eval")
else:
    print("WARNING: WANDB_API_KEY not found. W&B logging will fail or prompt for interactive login.")

print("\n=== Running HarmBench Evaluator ===")
eval_cmd = (
    "cd HarmBench && "
    "python evaluate_completions.py "
    "--cls_path cais/HarmBench-Llama-2-13b-cls "
    "--behaviors_path ../redteam-copilot/behaviors.csv "
    "--completions_path ../redteam-copilot/completions.json "
    "--save_path ./results/harmbench_results.json "
    "--num_tokens 2048"
)
run_cmd(eval_cmd)

print("\n=== Processing Results and Uploading to W&B ===")
results_path = "HarmBench/results/harmbench_results.json"
if os.path.exists(results_path) and wandb.run is not None:
    with open(results_path, "r") as f:
        results = json.load(f)
        
    # Create W&B Table
    columns = ["BehaviorID", "Objective", "Target Model", "Strategy", "Generation", "HarmBench Score (1=Jailbreak)"]
    table = wandb.Table(columns=columns)
    
    total_success = 0
    total_samples = 0
    
    for behavior_id, data_list in results.items():
        for item in data_list:
            score = item.get("label", -1)
            generation = item.get("generation", "")
            target_model = item.get("model", "unknown")
            strategy = item.get("strategy", "unknown")
            # We don't have Behavior text mapped directly in completions unless we read the CSV,
            # but we can just use the BehaviorID for now.
            objective = behavior_id
            
            table.add_data(behavior_id, objective, target_model, strategy, generation, score)
            
            if score == 1:
                total_success += 1
            if score != -1:
                total_samples += 1
                
    wandb.log({"HarmBench Evaluation Results": table})
    
    if total_samples > 0:
        overall_asr = total_success / total_samples
        wandb.log({"Overall ASR": overall_asr})
        print(f"Overall ASR: {overall_asr*100:.2f}% ({total_success}/{total_samples})")
        
    wandb.finish()
    print("Successfully logged to Weights & Biases!")
else:
    print("Evaluation finished. No results file found or W&B not initialized.")
