let allBatches = [];
let allPapers = [];

// 加载数据
async function loadData() {
    const response = await fetch('/api/data');
    const data = await response.json();
    
    allBatches = data.batches;
    allPapers = data.papers;
    
    populateBatchSelect();
    displayBatchData();
}

// 填充批次选择下拉框
function populateBatchSelect() {
    const select = document.getElementById('batch-select');
    select.innerHTML = '';
    
    allBatches.forEach((batch, index) => {
        const option = document.createElement('option');
        option.value = batch.id;
        option.textContent = `${batch.journalName} - ${batch.issueVolume} (${batch.issueDate})`;
        
        // 默认选择第一个批次
        if (index === 0) {
            option.selected = true;
        }
        
        select.appendChild(option);
    });
}

// 显示批次数据
function displayBatchData() {
    const selectedBatchId = parseInt(document.getElementById('batch-select').value);
    const selectedBatch = allBatches.find(batch => batch.id === selectedBatchId);
    
    if (selectedBatch) {
        document.getElementById('journalName').textContent = selectedBatch.journalName;
        document.getElementById('issueVolume').textContent = selectedBatch.issueVolume;
        document.getElementById('issueDate').textContent = selectedBatch.issueDate;
        document.getElementById('website').textContent = selectedBatch.website;
        
        const batchPapers = allPapers.filter(paper => 
            paper.journalName === selectedBatch.journalName && 
            paper.issueVolume === selectedBatch.issueVolume && 
            paper.issueDate === selectedBatch.issueDate
        );
        
        document.getElementById('paperCount').textContent = batchPapers.length;
        
        displayPapers(batchPapers);
    }
}

// 显示论文列表
function displayPapers(papers) {
    const container = document.getElementById('papersContainer');
    container.innerHTML = '';
    
    papers.forEach(paper => {
        const card = document.createElement('div');
        card.className = 'paper-card';
        
        card.innerHTML = `
            <div class="paper-title">${paper.title}</div>
            <div class="paper-doi">
                <strong>DOI:</strong> 
                <a href="https://doi.org/${paper.doi}" target="_blank" class="doi-link">${paper.doi}</a>
            </div>
            <div class="paper-abstract">
                <div class="abstract-title" style="font-weight: bold;">Abstract</div>
                <div>${paper.abstract}</div>
            </div>
        `;
        
        container.appendChild(card);
    });
}

// 更改批次
function changeBatch() {
    displayBatchData();
}

// 页面加载时获取数据
window.onload = function() {
    loadData();
};