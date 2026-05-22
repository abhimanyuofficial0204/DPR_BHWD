import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'sharp_mint_dpr.db')

def get_connection():
    return sqlite3.connect(DB_PATH)

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    # DPR Master Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS DPR_Master (
            Batch_Number TEXT PRIMARY KEY,
            Process_Type TEXT,
            Start_Date DATETIME,
            End_Date DATETIME,
            Total_Input_Weight REAL,
            Total_Output_Weight REAL,
            Process_Loss_Pct REAL,
            LM_to_MA_Conversion_Pct REAL,
            Heptane_Loss_Pct REAL,
            Initial_LM_Pct REAL,
            Initial_MA_Pct REAL,
            Final_LM_Pct REAL,
            Final_MA_Pct REAL,
            SOP_Compliant BOOLEAN,
            Deviation_Notes TEXT,
            Source_File TEXT,
            Last_Updated DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # GC Log Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS GC_Log (
            Batch_Number TEXT,
            Stage TEXT, -- 'FEED' or 'FINAL'
            L_Menthol_Pct REAL,
            Menthyl_Acetate_Pct REAL,
            Heptane_Pct REAL,
            Neo_Menthol_Pct REAL,
            PRIMARY KEY (Batch_Number, Stage),
            FOREIGN KEY(Batch_Number) REFERENCES DPR_Master(Batch_Number)
        )
    ''')
    
    # Production Log Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS Production_Log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            Batch_Number TEXT,
            Stage TEXT, -- 'INPUT' or 'OUTPUT'
            Material_Desc TEXT,
            Drum_Number TEXT,
            Drum_Weight REAL,
            LM_GC REAL,
            MA_GC REAL,
            Heptane_GC REAL,
            Production_Date DATETIME,
            FOREIGN KEY(Batch_Number) REFERENCES DPR_Master(Batch_Number)
        )
    ''')
    
    conn.commit()
    conn.close()

if __name__ == '__main__':
    init_db()
    print("Database initialized successfully.")
