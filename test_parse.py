import re
import json

raw_content = """<think> Let me craft a deceptive prompt... </think>
{ "phase": "CONTEXT_PRIMING", "prompt": "Hello!" }"""
cleaned_content = re.sub(r"<think>.*?</think>", "", raw_content, flags=re.DOTALL).strip()
print(f"cleaned: {cleaned_content!r}")
try:
    json_match = re.search(r'\{.*?\}', cleaned_content, flags=re.DOTALL)
    if json_match:
        parsed = json.loads(json_match.group(0))
        print("Success:", parsed)
    else:
        print("No match")
except Exception as e:
    print("Error:", e)
