import pandas as pd
import numpy as np

filepath = "Feed GC Data/GLR-26-27.xlsx"
df = pd.read_excel(filepath, header=None)

batches = {}
current_batch_id = None
current_headers = None

for idx, row in df.iterrows():
    col0 = row.iloc[0]
    
    if pd.notna(col0) and isinstance(col0, str) and ('#' in col0 or 'P-' in col0 or 'V-' in col0):
        current_batch_id = str(col0).strip().upper()
        if current_batch_id not in batches:
            batches[current_batch_id] = {'Batch ID': current_batch_id, 'GC Data Source': 'GLR-26-27.xlsx'}
        continue
        
    if current_batch_id:
        if pd.notna(col0) and str(col0).strip().upper() == 'DATE':
            current_headers = [str(x).strip() if pd.notna(x) else f"Col_{i}" for i, x in enumerate(row.values)]
            continue
            
        if pd.notna(col0) and current_headers is not None:
            row_str = ' '.join([str(x).upper() for x in row.values if pd.notna(x)])
            
            is_feed = 'FEED' in row_str
            is_final = 'FINAL' in row_str and not is_feed
            
            if is_feed or is_final:
                prefix = 'Feed GC ' if is_feed else 'Final GC '
                for i, h in enumerate(current_headers):
                    if not h.startswith("Col_"):
                        batches[current_batch_id][prefix + h] = row.values[i]
                        
print(list(batches.values())[:2])
