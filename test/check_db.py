import sqlite3
import json

db_path = "papers.db"

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print(f"Connecting to {db_path}...")
    
    # Get columns info
    cursor.execute("PRAGMA table_info(papers)")
    columns = [info[1] for info in cursor.fetchall()]
    print("Columns:", columns)
    
    # Get the row with id=1 (or just first row)
    cursor.execute("SELECT * FROM papers LIMIT 1")
    row = cursor.fetchone()
    
    if row:
        print("\nRow Data:")
        data = dict(zip(columns, row))
        print(json.dumps(data, indent=2, ensure_ascii=False))
        
        print("\n--- Field Analysis ---")
        print(f"DB title:      {data.get('title')}")
        print(f"DB title_cn:   {data.get('title_cn')}")
        print(f"DB abstract:   {data.get('abstract')}")
        print(f"DB abstract_cn:{data.get('abstract_cn')}")
    else:
        print("Table 'papers' is empty.")

    conn.close()

except Exception as e:
    print(f"Error: {e}")
