import sqlite3

db_path = "papers.db"

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print(f"Connecting to {db_path}...")
    
    # Update title_cn and abstract_cn to NULL where they start with "翻译: "
    cursor.execute("UPDATE papers SET title_cn = NULL, abstract_cn = NULL WHERE title_cn LIKE '翻译:%'")
    
    print(f"Rows updated: {cursor.rowcount}")
    
    conn.commit()
    conn.close()
    print("Database cleaned successfully.")

except Exception as e:
    print(f"Error: {e}")
