from flask import Flask, request, jsonify, render_template
import sqlite3
from datetime import datetime
import json
import os

app = Flask(__name__, template_folder='templates', static_folder='static')

# 数据库初始化
def init_db():
    conn = sqlite3.connect('papers.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS papers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    received_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    website TEXT,
                    journalName TEXT,
                    issueVolume TEXT,
                    issueDate TEXT,
                    title TEXT,
                    doi TEXT,
                    abstract TEXT,
                    title_cn TEXT,
                    abstract_cn TEXT
                )''')
    conn.commit()
    conn.close()

# 存储数据到数据库
def store_data_to_db(data):
    conn = sqlite3.connect('papers.db')
    c = conn.cursor()
    
    # 提取期刊信息
    website = data.get('website', '')
    journalName = data.get('journalName', '')
    issueVolume = data.get('issueVolume', '')
    issueDate = data.get('issueDate', '')
    
    # 存储每篇文章
    articles = data.get('articles', [])
    for article in articles:
        title = article.get('title', '')
        doi = article.get('doi', '')
        abstract = article.get('abstract', '')
        title_cn = article.get('title_cn', '')  # 中文标题
        abstract_cn = article.get('abstract_cn', '')  # 中文摘要
        
        c.execute("INSERT INTO papers (website, journalName, issueVolume, issueDate, title, doi, abstract, title_cn, abstract_cn) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                  (website, journalName, issueVolume, issueDate, title, doi, abstract, title_cn, abstract_cn))
    
    conn.commit()
    conn.close()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/data')
def get_all_data():
    conn = sqlite3.connect('papers.db')
    c = conn.cursor()
    
    # 获取所有不同的批次（去重），按最新接收时间排序
    c.execute("""
        SELECT website, journalName, issueVolume, issueDate, MAX(received_time) as latest_time
        FROM papers 
        GROUP BY journalName, issueVolume, issueDate 
        ORDER BY latest_time DESC
    """)
    distinct_batches = c.fetchall()
    
    # 为每个去重的批次分配ID
    all_batches = []
    for i, batch_data in enumerate(distinct_batches):
        batch = {
            'id': i + 1,
            'website': batch_data[0],
            'journalName': batch_data[1],
            'issueVolume': batch_data[2],
            'issueDate': batch_data[3],
            'latest_time': batch_data[4]
        }
        all_batches.append(batch)
    
    # 获取所有论文数据
    c.execute("SELECT website, journalName, issueVolume, issueDate, title, doi, abstract FROM papers ORDER BY id ASC")
    paper_rows = c.fetchall()
    
    # 准备论文数据
    all_papers = []
    for row in paper_rows:
        all_papers.append({
            'website': row[0],
            'journalName': row[1],
            'issueVolume': row[2],
            'issueDate': row[3],
            'title': row[4],
            'doi': row[5],
            'abstract': row[6]
        })
    
    conn.close()
    
    return jsonify({
        'batches': all_batches,
        'papers': all_papers
    })

@app.route('/health', methods=['GET'])
def health_check():
    return '', 200

@app.route('/sync', methods=['POST'])
def sync_data():
    try:
        # 获取原始请求数据（支持 JSON、表单、纯文本等）
        raw_data = request.get_data(as_text=True)
        
        # 尝试解析 JSON 数据
        try:
            data = json.loads(raw_data)
        except json.JSONDecodeError:
            # 如果不是有效的 JSON，返回错误
            return 'Invalid JSON data', 400
        
        # 存储数据到数据库
        store_data_to_db(data)
        
        print(f"Received POST data at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}:")
        print(json.dumps(data, indent=2, ensure_ascii=False))
        print("-" * 50)
        
        return 'Data stored successfully', 200
    except Exception as e:
        print(f"Error processing data: {str(e)}")
        return f'Error processing data: {str(e)}', 500

@app.route('/sync', methods=['GET', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'])
def sync_method_not_allowed():
    return 'Method Not Allowed', 405

if __name__ == '__main__':
    # 初始化数据库
    init_db()
    # 默认监听 127.0.0.1:8080
    app.run(host='127.0.0.1', port=8080, debug=True)