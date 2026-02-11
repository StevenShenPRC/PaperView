// ==UserScript==
// @name         PaperView 伴侣
// @namespace    http://tampermonkey.net/
// @version      0.0.2-alpha.0
// @description  PaperView伴侣脚本，批量同步论文信息至桌面APP
// @author       Steven Shen
// @match        *://www.sciencedirect.com/*
// @match        *://*.sciencedirect.com/*
// @match        *://*.springer.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      127.0.0.1
// @connect      localhost
// ==/UserScript==

(function () {
    'use strict';

    // --- 配置区 ---
    // 默认端口
    const DEFAULT_PORT = "8080";

    // 获取保存的端口或使用默认值
    function getPort() {
        return localStorage.getItem('paperview_port') || DEFAULT_PORT;
    }

    function setPort(port) {
        localStorage.setItem('paperview_port', port);
    }

    function getApiUrl(path) {
        const port = getPort();
        return `http://127.0.0.1:${port}${path}`;
    }

    // 延迟函数，用于速率限制
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // 网站解析适配器预留区
    const SITE_ADAPTERS = {
        "ScienceDirect": {
            domain: "sciencedirect.com",
            getJournal: () => {
                const titleText = document.title;
                const match = titleText.match(/^(.+?)\s\|/);
                return match ? match[1].trim() : "Unknown Journal";
            },
            getIssueVolume: () => {
                const issueVolumeElement = document.querySelector('.js-vol-issue');
                return issueVolumeElement?.innerText.trim() || "Unknown Volume";
            },
            getIssueDate: () => {
                const issueDateElement = document.querySelector('.js-issue-status');
                return issueDateElement?.innerText.trim() || "Unknown Date";
            },
            getItemSelector: () => ".js-article-list-item",
            parseArticle: (el) => ({
                title: el.querySelector('.js-article-title')?.innerText.trim() || "",
                doi: (el.querySelector('div[hidden]')?.innerText.trim() || "").replace('https://doi.org/', ''),
                abstract: el.querySelector('.js-abstract-body-text p, .abstract-body p')?.innerText.trim() || ""
            }),
            clickAbstractButtons: () => {
                const buttons = document.querySelectorAll('li.tab.js-abstract-heading button.tab-title');
                buttons.forEach(button => {
                    if (button.innerText.trim() === "Abstract" && button.getAttribute('aria-disabled') === 'false') {
                        button.click();
                    }
                });
            }
        },
        "Springer": {
            domain: "springer.com",
            getJournal: () => {
                const journalElement = document.querySelector('a[data-track-context="journal title in journal masthead on a journal page"]');
                return journalElement?.innerText.trim() || "Unknown Journal";
            },
            getIssueVolume: () => {
                const issueVolumeElement = document.querySelector('.app-journal-latest-issue__heading');
                return issueVolumeElement?.innerText.trim() || "Unknown Volume";
            },
            getIssueDate: () => {
                const issueDateElement = document.querySelector('.app-journal-latest-issue__date');
                return issueDateElement?.innerText.trim() || "Unknown Date";
            },
            getItemSelector: () => 'a[data-track="select_latest_article"]',
            parseArticle: async (el) => {
                const doi = el.getAttribute('data-track-label') || "";

                if (!doi) {
                    return { title: "Unknown Title", doi: "Unknown DOI", abstract: "Unknown Abstract" };
                }

                // 添加 200ms 的速率限制
                await delay(200);

                let retry = false; // 标记是否需要重试

                try {
                    const response = await fetch(`https://citation.doi.org/metadata?doi=${doi}`, {
                        method: "GET",
                        headers: { Accept: "application/json" }
                    });

                    if (response.status === 404) {
                        // 如果返回 404，标记为需要重试
                        retry = true;
                    } else if (!response.ok) {
                        // 如果是其他错误，直接返回错误
                        return { title: "Unknown Title", doi: doi, abstract: "Unknown Abstract" };
                    } else {
                        const metadata = await response.json();

                        // 从 metadata 中提取字段
                        return {
                            title: metadata.title || "Unknown Title",
                            doi: metadata.DOI || doi,
                            abstract: metadata.abstract || "No abstract available"
                        };
                    }
                } catch (error) {
                    // 捕获网络错误或其他异常
                    return { title: "Unknown Title", doi: doi, abstract: "Unknown Abstract" };
                }

                // 如果需要重试
                if (retry) {
                    console.warn(`DOI ${doi} 返回 404，重试中...`);
                    await delay(200); // 再次延迟 200ms

                    try {
                        const response = await fetch(`https://citation.doi.org/metadata?doi=${doi}`, {
                            method: "GET",
                            headers: { Accept: "application/json" }
                        });

                        if (!response.ok) {
                            // 如果重试仍然失败，返回错误
                            return { title: "Unknown Title", doi: doi, abstract: "Unknown Abstract" };
                        }

                        const metadata = await response.json();

                        // 从 metadata 中提取字段
                        return {
                            title: metadata.title || "Unknown Title",
                            doi: metadata.DOI || doi,
                            abstract: metadata.abstract || "No abstract available"
                        };
                    } catch (error) {
                        return { title: "Unknown Title", doi: doi, abstract: "Unknown Abstract" };
                    }
                }
            }
        },
        "ExampleSite": {
            domain: "example.com",
            getJournal: () => "Example Journal",
            getIssueVolume: () => "Vol 1",
            getIssueDate: () => "1 January 2026",
            getItemSelector: () => ".article-entry",
            parseArticle: (el) => ({
                title: el.querySelector('h2')?.innerText || "",
                doi: el.dataset.doi || "",
                abstract: "Pending..."
            })
        }
    };


    // --- UI 构建 ---
    GM_addStyle(`
        #sync-panel { 
            position: fixed; 
            top: 10px; 
            right: 10px; 
            z-index: 9999; 
            background: #fff; 
            border: 1px solid #ccc; 
            padding: 15px; 
            border-radius: 8px; 
            box-shadow: 0 4px 12px rgba(0,0,0,0.15); 
            width: 220px; 
            font-family: sans-serif; 
        }
        #sync-panel h3 { 
            margin: 0 0 10px 0; 
            font-size: 14px; 
            color: #333; 
        }
        #sync-panel .status-bar { 
            font-size: 12px; 
            margin-bottom: 10px; 
            padding: 5px; 
            border-radius: 4px; 
        }
        #sync-panel .status-offline { 
            background: #fee; 
            color: #c33; 
        }
        #sync-panel .status-online { 
            background: #efe; 
            color: #393; 
        }
        #sync-panel select, 
        #sync-panel input,
        #sync-panel button { 
            width: 100%; 
            margin-top: 8px; 
            padding: 6px; 
            cursor: pointer; 
            border-radius: 4px; 
            border: 1px solid #ddd;
            box-sizing: border-box; 
        }
        #sync-panel button { 
            background: #007396; 
            color: white; 
            border: none; 
            font-weight: bold; 
        }
        #sync-panel button:hover { 
            background: #005a75; 
        }
        #sync-panel button:disabled { 
            background: #ccc; 
        }
        #sync-panel label {
            font-size: 12px;
            color: #666;
            display: block;
            margin-top: 8px;
        }
    `);

    const panel = document.createElement('div');
    panel.id = 'sync-panel';
    panel.innerHTML = `
        <h3>PaperView 伴侣</h3>
        <div id="app-status" class="status-bar status-offline">状态: 未检测</div>
        
        <label for="app-port">端口:</label>
        <input type="text" id="app-port" value="${getPort()}" placeholder="8080">
        
        <select id="site-select"></select>
        <button id="btn-check">检测应用</button>
        <button id="btn-sync" disabled>立即同步数据</button>
        <div id="msg-log" style="font-size:11px; margin-top:8px; color:#666;"></div>
    `;
    document.body.appendChild(panel);

    // --- 初始化逻辑 ---
    const siteSelect = document.getElementById('site-select');
    const statusDiv = document.getElementById('app-status');
    const logDiv = document.getElementById('msg-log');
    const btnSync = document.getElementById('btn-sync');
    const portInput = document.getElementById('app-port');

    // 监听端口变化并保存
    portInput.addEventListener('change', (e) => {
        setPort(e.target.value);
    });

    // 填充下拉框并自动匹配
    let currentAdapterKey = "";
    Object.keys(SITE_ADAPTERS).forEach(key => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.text = key;
        if (window.location.host.includes(SITE_ADAPTERS[key].domain)) {
            opt.selected = true;
            currentAdapterKey = key;
        }
        siteSelect.appendChild(opt);
    });

    // --- 核心功能 ---

    // 1. 检测应用是否在线
    document.getElementById('btn-check').onclick = () => {
        logDiv.innerText = "正在检测...";
        // 获取当前配置的端口URL
        const url = getApiUrl('/health');

        GM_xmlhttpRequest({
            method: "GET",
            url: url,
            timeout: 2000,
            onload: function (res) {
                if (res.status === 200) {
                    statusDiv.innerText = "应用状态: 在线";
                    statusDiv.className = "status-bar status-online";
                    btnSync.disabled = false;
                    logDiv.innerText = "检测成功";
                } else {
                    markOffline();
                }
            },
            onerror: markOffline,
            ontimeout: markOffline
        });
    };

    function markOffline() {
        statusDiv.innerText = "应用状态: 离线";
        statusDiv.className = "status-bar status-offline";
        btnSync.disabled = true;
        logDiv.innerText = "无法连接到桌面应用";
    }


    // 2. 同步数据逻辑
    btnSync.onclick = async () => {
        const adapter = SITE_ADAPTERS[siteSelect.value];

        if (adapter.clickAbstractButtons) {
            adapter.clickAbstractButtons();
        }

        // 等待一段时间以确保内容加载完成
        setTimeout(async () => {
            const items = document.querySelectorAll(adapter.getItemSelector());

            const payload = {
                website: siteSelect.value,
                journalName: adapter.getJournal(),
                issueVolume: adapter.getIssueVolume(),
                issueDate: adapter.getIssueDate(),
                articles: []
            };

            // 按顺序解析文章，确保速率限制生效
            for (const el of items) {
                const article = await adapter.parseArticle(el); // 逐个解析文章
                payload.articles.push(article);
            }

            logDiv.innerText = `同步中 (${payload.articles.length} 条)...`;

            const url = getApiUrl('/sync');
            GM_xmlhttpRequest({
                method: "POST",
                url: url,
                headers: { "Content-Type": "application/json" },
                data: JSON.stringify(payload),
                onload: function (res) {
                    if (res.status === 200) {
                        logDiv.style.color = "#393";
                        logDiv.innerText = "✅ 同步成功！";
                        console.log("[Springer] 同步成功！");
                    } else {
                        logDiv.style.color = "#c33";
                        logDiv.innerText = "❌ 同步失败: " + res.status;
                        console.error(`[Springer] 同步失败，状态码: ${res.status}`);
                    }
                },
                onerror: () => {
                    logDiv.innerText = "❌ 推送失败，检查API";
                    console.error("[Springer] 推送失败，检查 API。");
                }
            });

        }, 2000); // 等待 2 秒以确保 Abstract 内容加载完成
    };

})();