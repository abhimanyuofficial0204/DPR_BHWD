import time
import os
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from extractor import extract_and_upsert_dpr
from db import init_db

WATCH_DIR = os.path.expanduser("~/WorkBench/Sharp_Mint/DPR/New whatsapp download")

class DPREventHandler(FileSystemEventHandler):
    def process(self, event):
        if event.is_directory:
            return
        
        filepath = event.src_path
        if filepath.endswith('.xlsx') and not os.path.basename(filepath).startswith('~'):
            print(f"Detected change in file: {filepath}")
            try:
                # Small delay to ensure file is fully written before reading
                time.sleep(1)
                extract_and_upsert_dpr(filepath)
            except Exception as e:
                print(f"Error processing {filepath}: {e}")

    def on_created(self, event):
        self.process(event)

    def on_modified(self, event):
        self.process(event)

if __name__ == '__main__':
    # Initialize the database schema if it doesn't exist
    init_db()
    
    # Ensure directory exists
    os.makedirs(WATCH_DIR, exist_ok=True)
    
    event_handler = DPREventHandler()
    observer = Observer() # Defaults to FSEventsObserver on macOS
    observer.schedule(event_handler, WATCH_DIR, recursive=False)
    
    print(f"Starting watchdog ETL pipeline. Monitoring directory: {WATCH_DIR}")
    observer.start()
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
        print("Stopping watchdog ETL pipeline.")
    
    observer.join()
