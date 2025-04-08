/**
 * EssaySelect API 模块
 * 处理与 Essay.ink 服务的所有通信
 */

class EssaySelectAPI {
  constructor() {
    this.settings = null;
    this.folderCache = null;
    this.folderCacheTime = 0;
    this.init();
  }

  async init() {
    this.settings = await EssaySelectStorage.getSettings();
  }

  /**
   * 发送内容到 Essay.ink 服务器
   * @param {Object} data - 要发送的数据
   * @param {string} contentType - 内容类型: 'essay' 或 'note'
   * @returns {Promise<Object>} - 服务器响应
   */
  async sendToServer(data, contentType = 'essay') {
    // 先确保设置已加载
    if (!this.settings) {
      await this.init();
    }

    if (!this.settings.apiKey) {
      throw new Error('Essay.ink API Token 未设置，请在设置中配置');
    }

    // 根据内容类型选择API端点
    const endpoint = contentType === 'note' 
      ? 'https://api.essay.ink/notes'
      : 'https://api.essay.ink/essays';

    // 构建请求体
    const requestBody = {
      content: data.content
    };

    // 对于笔记类型，如果指定了文件夹，添加到请求中
    if (contentType === 'note' && data.folderId) {
      requestBody.folderId = data.folderId;
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.settings.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = '服务器错误';
        
        try {
          const errorObj = JSON.parse(errorText);
          errorMessage = errorObj.message || errorMessage;
        } catch (e) {
          // 解析失败，使用默认错误消息
        }
        
        throw new Error(`Essay.ink 错误: ${response.status} - ${errorMessage}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API请求失败:', error);
      throw error;
    }
  }

  /**
   * 使用AI生成文本摘要 (使用客户端处理，不调用 Essay.ink API)
   * @param {string} content - 要总结的内容
   * @returns {Promise<string>} - 生成的摘要
   */
  async generateSummary(content) {
    if (!this.settings) {
      await this.init();
    }

    // 简单实现：返回原内容的前1000个字符作为摘要
    // 注意：Essay.ink 不提供摘要生成 API，需要使用其他服务或在本地处理
    return content.substring(0, 1000) + (content.length > 1000 ? '...' : '');
  }

  /**
   * 保存快速笔记到 Essay.ink
   * @param {string} content - 笔记内容
   * @param {string} folderId - 文件夹ID（仅用于笔记类型）
   * @param {boolean} includeUrl - 是否包含当前URL
   * @param {string} contentType - 内容类型: 'essay' 或 'note'
   * @returns {Promise<Object>} - 服务器响应
   */
  async saveQuickNote(content, folderId, includeUrl = true, contentType = 'essay') {
    let finalContent = content;
    
    // 获取设置
    const settings = await EssaySelectStorage.getSettings();
    
    // 如果需要包含URL，添加来源链接
    if (includeUrl && settings.includeUrl !== false) {
      const tabs = await new Promise(resolve => {
        chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
          resolve(tabs);
        });
      });
      
      if (tabs && tabs.length > 0) {
        const url = tabs[0].url;
        const title = tabs[0].title;
        finalContent += `\n> 来源: [${title}](${url})`;
      }
    }
    
    return this.sendToServer({
      content: finalContent,
      folderId: folderId
    }, contentType);
  }

  /**
   * 保存网页摘要到 Essay.ink
   * @param {string} summary - 摘要内容
   * @param {string} tag - 标签 (Essay.ink 目前不支持标签，仅保存内容)
   * @param {boolean} includeUrl - 是否包含当前URL
   * @param {string} contentType - 内容类型: 'essay' 或 'note'
   * @returns {Promise<Object>} - 服务器响应
   */
  async saveSummary(summary, tag, includeUrl = true, contentType = 'essay') {
    let finalSummary = summary;
    
    // 如果需要包含URL，添加来源链接
    if (includeUrl) {
      const tabs = await new Promise(resolve => {
        chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
          resolve(tabs);
        });
      });
      
      if (tabs && tabs.length > 0) {
        const url = tabs[0].url;
        const title = tabs[0].title;
        finalSummary += `\n\n---\n> 原文: [${title}](${url})`;
      }
    }
    
    return this.sendToServer({
      content: finalSummary
    }, contentType);
  }

  /**
   * 保存选中文本到 Essay.ink
   * @param {string} selectedText - 选中的文本
   * @param {string} tag - 标签 (Essay.ink 目前不支持标签，仅保存内容)
   * @param {string} url - 页面URL
   * @param {string} title - 页面标题
   * @param {string} contentType - 内容类型: 'essay' 或 'note'
   * @returns {Promise<Object>} - 服务器响应
   */
  async saveSelection(selectedText, tag, url, title, contentType = 'essay') {
    let content = selectedText;
    
    // 添加来源信息
    if (url) {
      content += `\n\n> 摘自: [${title || url}](${url})`;
    }
    
    return this.sendToServer({
      content: content
    }, contentType);
  }

  /**
   * 获取笔记文件夹列表
   * @param {Object} options - 选项
   * @param {number} options.maxAge - 缓存最大有效期（毫秒）
   * @returns {Promise<Array>} - 文件夹列表
   */
  async fetchFolders(options = { maxAge: 10 * 60 * 1000 }) {
    // 先确保设置已加载
    if (!this.settings) {
      await this.init();
    }

    if (!this.settings.apiKey) {
      throw new Error('Essay.ink API Token 未设置，请在设置中配置');
    }

    // 如果缓存有效，直接返回缓存的文件夹
    const now = Date.now();
    if (this.folderCache && (now - this.folderCacheTime < options.maxAge)) {
      return this.folderCache;
    }

    // 从API获取文件夹列表
    try {
      const response = await fetch('https://api.essay.ink/note-folders', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.settings.apiKey}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = '服务器错误';
        
        try {
          const errorObj = JSON.parse(errorText);
          errorMessage = errorObj.message || errorMessage;
        } catch (e) {
          // 解析失败，使用默认错误消息
        }
        
        throw new Error(`获取文件夹失败: ${response.status} - ${errorMessage}`);
      }

      const folders = await response.json();
      
      // 更新缓存
      this.folderCache = folders;
      this.folderCacheTime = now;
      
      return folders;
    } catch (error) {
      console.error('获取文件夹失败:', error);
      throw error;
    }
  }
}

// 导出API实例
window.EssaySelectAPI = new EssaySelectAPI(); 