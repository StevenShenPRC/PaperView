from flask import Flask, request, jsonify, render_template_string
import sqlite3
from datetime import datetime
import json
import os

app = Flask(__name__)

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

# HTML 模板
HTML_TEMPLATE = '''
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PaperView - 论文管理系统</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; text-align: center; }
        .controls { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .journal-info { background-color: #e8f4fd; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; table-layout: fixed; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; word-wrap: break-word; vertical-align: top; }
        th { background-color: #4CAF50; color: white; position: sticky; top: 0; }
        tr:hover { background-color: #f5f5f5; }
        .doi-link { color: #007bff; text-decoration: none; }
        .doi-link:hover { text-decoration: underline; }
        .abstract { white-space: pre-wrap; }
        .refresh-btn { background-color: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
        .refresh-btn:hover { background-color: #0056b3; }
        select { padding: 8px 12px; border-radius: 4px; border: 1px solid #ccc; min-width: 300px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>PaperView - 论文管理系统</h1>
        
        <div class="controls">
            <label for="batch-select">选择数据批次: </label>
            <select id="batch-select" onchange="changeBatch()">
                {% for batch in batches %}
                    <option value="{{ batch.id }}" {% if batch.id == selected_batch_id %}selected{% endif %}>
                        {{ batch.journalName }} - {{ batch.issueVolume }} ({{ batch.issueDate }})
                    </option>
                {% endfor %}
            </select>
            <button class="refresh-btn" onclick="location.reload()">刷新数据</button>
        </div>
        
        {% if journal_info %}
        <div class="journal-info">
            <h2>{{ journal_info.journalName }}</h2>
            <p><strong>期刊卷期:</strong> {{ journal_info.issueVolume }}</p>
            <p><strong>出版日期:</strong> {{ journal_info.issueDate }}</p>
            <p><strong>网站来源:</strong> {{ journal_info.website }}</p>
            <p><strong>共 {{ paper_count }} 篇论文</strong></p>
        </div>
        {% endif %}
        
        <table id="papers-table">
            <thead>
                <tr>
                    <th style="width: 10%;">标题</th>
                    <th style="width: 10%;">DOI</th>
                    <th style="width: 80%;">摘要</th>
                </tr>
            </thead>
            <tbody>
                {% for paper in papers %}
                <tr>
                    <td>{{ paper.title }}</td>
                    <td><a href="https://doi.org/{{ paper.doi }}" target="_blank" class="doi-link">{{ paper.doi }}</a></td>
                    <td class="abstract">{{ paper.abstract }}</td>
                </tr>
                {% endfor %}
            </tbody>
        </table>
    </div>

    <script>
        function changeBatch() {
            const select = document.getElementById('batch-select');
            const selectedValue = select.value;
            window.location.href = '/?batch=' + encodeURIComponent(selectedValue);
        }
    </script>
</body>
</html>
'''

@app.route('/')
def index():
    # 获取查询参数中的批次ID
    batch_id = request.args.get('batch', default=None, type=int)
    
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
    
    # 如果没有指定批次ID，默认选择最新批次
    if not batch_id and all_batches:
        selected_batch = all_batches[0]
    elif batch_id and batch_id <= len(all_batches):
        selected_batch = all_batches[batch_id - 1]
    else:
        selected_batch = None
    
    # 获取选定批次的期刊信息
    if selected_batch:
        journal_info = {
            'website': selected_batch['website'],
            'journalName': selected_batch['journalName'],
            'issueVolume': selected_batch['issueVolume'],
            'issueDate': selected_batch['issueDate']
        }
        
        # 获取选定批次的论文数据
        c.execute("""SELECT title, doi, abstract FROM papers 
                     WHERE journalName=? AND issueVolume=? AND issueDate=?
                     ORDER BY id ASC""", 
                  (selected_batch['journalName'], selected_batch['issueVolume'], selected_batch['issueDate']))
        paper_rows = c.fetchall()
        
        # 统计选定批次的论文数量
        c.execute("""SELECT COUNT(*) FROM papers 
                     WHERE journalName=? AND issueVolume=? AND issueDate=?""",
                  (selected_batch['journalName'], selected_batch['issueVolume'], selected_batch['issueDate']))
        paper_count = c.fetchone()[0]
    else:
        journal_info = None
        paper_rows = []
        paper_count = 0
    
    # 准备论文数据
    papers = []
    for row in paper_rows:
        papers.append({
            'title': row[0],
            'doi': row[1],
            'abstract': row[2]
        })
    
    conn.close()
    
    return render_template_string(HTML_TEMPLATE, 
                                 papers=papers, 
                                 journal_info=journal_info,
                                 batches=all_batches,
                                 selected_batch_id=batch_id if batch_id else (all_batches[0]['id'] if all_batches else None),
                                 paper_count=paper_count)

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