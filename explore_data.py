import pandas as pd
import warnings
warnings.filterwarnings('ignore')

print("--- DPR ---")
dpr = "/Users/abhi/WorkBench/Sharp_Mint/DPR/GLR_FY'26-27.xlsx"
df = pd.read_excel(dpr, sheet_name=0, header=None)
print(df.iloc[0:15, 0:10])

print("\n--- FEED GC ---")
feed = "/Users/abhi/WorkBench/Sharp_Mint/DPR/Feed GC Data/GLR-26-27.xlsx"
df_feed = pd.read_excel(feed, sheet_name=0, header=None)
print(df_feed.iloc[0:10, 0:10])

print("\n--- PROD ---")
prod = "/Users/abhi/WorkBench/Sharp_Mint/DPR/Production Data/New Pro 26-27.xlsx"
df_prod = pd.read_excel(prod, sheet_name=0, header=None)
print(df_prod.iloc[0:10, 0:10])
