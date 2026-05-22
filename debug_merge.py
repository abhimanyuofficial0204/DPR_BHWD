import pandas as pd
import json

with open("unified_production_data.json") as f:
    merged = json.load(f)

df = pd.DataFrame(merged)
print("Columns in merged data:")
print(df.columns.tolist())

print("\nSample DPR Batch IDs:")
print(df['Batch ID'].dropna().unique()[:10])

# Now check Feed GC file raw directly
feed = "Feed GC Data/GLR-26-27.xlsx"
df_feed = pd.read_excel(feed, header=None)
print("\nRaw Feed GC top rows:")
print(df_feed.head(15))

# And Prod
prod = "Production Data/New Pro 26-27.xlsx"
df_prod = pd.read_excel(prod)
print("\nProd Data Batch IDs:")
print(df_prod['Batch No.'].dropna().unique()[:10])
