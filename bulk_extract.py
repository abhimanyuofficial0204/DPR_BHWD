import os
import glob
from extractor import extract_and_upsert_dpr

WATCH_DIR = os.path.expanduser("~/WorkBench/Sharp_Mint/DPR/New whatsapp download")

def bulk_extract():
    print(f"Scanning {WATCH_DIR} for Excel files...")
    excel_files = glob.glob(os.path.join(WATCH_DIR, "*.xlsx"))
    
    for filepath in excel_files:
        filename = os.path.basename(filepath)
        if filename.startswith('~'):
            continue
        print(f"Processing {filename}...")
        try:
            extract_and_upsert_dpr(filepath)
        except Exception as e:
            print(f"Failed to process {filename}: {e}")
            
if __name__ == '__main__':
    bulk_extract()
