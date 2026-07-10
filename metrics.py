import csv
from collections import defaultdict

with open('wandb_export_2026-07-08T17_08_36.426+05_30.csv', 'r', encoding='utf-8') as f:
    stats = defaultdict(lambda: {'success': 0, 'total': 0})
    for row in csv.DictReader(f):
        model = row['Target Model']
        score = int(row['HarmBench Score (1=Jailbreak)']) if row['HarmBench Score (1=Jailbreak)'].isdigit() else 0
        stats[model]['total'] += 1
        stats[model]['success'] += score
        
    for model, data in stats.items():
        print(f"{model}: {data['success']}/{data['total']} ({(data['success']/data['total'])*100:.1f}%)")