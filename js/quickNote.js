/**
 * Essay.ink 笔记模块
 * 处理笔记添加功能
 */

class QuickNoteManager {
  constructor() {
    this.elements = {
      quickNote: document.getElementById('quickNote'),
      sendQuickNote: document.getElementById('sendQuickNote'),
      quickNoteStatus: document.getElementById('quickNoteStatus'),
      typeEssay: document.getElementById('typeEssay'),
      typeNote: document.getElementById('typeNote'),
      folderSelectGroup: document.getElementById('folderSelectGroup'),
      noteFolder: document.getElementById('noteFolder')
    };

    this.currentSelectedText = '';
    this.currentUrl = '';
    this.currentTitle = '';
    this.settings = null;
    this.folders = [];
    
    this.init();
  }

  /**
   * 初始化笔记管理器
   */
  async init() {
    try {
      // 加载设置
      this.settings = await EssaySelectStorage.getSettings();
      
      // 初始化UI
      await this.initUI();
      
      // 获取当前标签页信息
      await this.getCurrentTab();
      
      // 尝试从后台脚本获取最近选中的文本
      await this.getLastSelectedText();
      
      // 不再自动加载草稿，确保启动时不会加载上次未发送的内容
      // await this.loadDraft();
      
      // 清除之前可能存在的草稿
      await this.clearDraft();
      
      // 如果选择了note类型，尝试加载文件夹
      if (this.elements.typeNote && this.elements.typeNote.checked) {
        await this.loadFolders();
      }
      
      // 绑定事件
      this.bindEvents();
    } catch (error) {
      console.error('初始化笔记管理器时出错:', error);
      // 即使出错，也尝试绑定事件和清除草稿
      this.bindEvents();
      this.clearDraft().catch(e => console.error('清除草稿失败:', e));
    }
  }

  /**
   * 获取当前标签页信息
   */
  async getCurrentTab() {
    return new Promise((resolve) => {
      try {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
          if (chrome.runtime.lastError) {
            console.error('获取标签页时出错:', chrome.runtime.lastError);
            resolve();
            return;
          }
          
          if (tabs && tabs.length > 0) {
            this.currentUrl = tabs[0].url;
            this.currentTitle = tabs[0].title;
            
            try {
              // 获取当前选中的文本
              chrome.tabs.sendMessage(tabs[0].id, { type: 'getSelectedText' }, (response) => {
                // 处理不存在响应的情况
                if (chrome.runtime.lastError) {
                  console.log('获取选中文本错误:', chrome.runtime.lastError);
                  // 尝试从后台脚本获取最近选中的文本
                  this.getLastSelectedText().then(resolve);
                  return;
                }
                
                if (response && response.success && response.data) {
                  this.currentSelectedText = response.data;
                  this.updateEditorWithSelectedText();
                }
                resolve();
              });
            } catch (error) {
              console.error('发送选中文本消息时出错:', error);
              // 尝试从后台脚本获取最近选中的文本
              await this.getLastSelectedText();
              resolve();
            }
          } else {
            resolve();
          }
        });
      } catch (error) {
        console.error('查询标签页时出错:', error);
        resolve();
      }
    });
  }
  
  /**
   * 从后台脚本获取最近选中的文本
   */
  async getLastSelectedText() {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: 'getLastSelectedText' }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('获取最近选中文本时出错:', chrome.runtime.lastError);
            resolve();
            return;
          }
          
          if (response && response.success && response.data && !this.currentSelectedText) {
            this.currentSelectedText = response.data;
            this.updateEditorWithSelectedText();
          }
          resolve();
        });
      } catch (error) {
        console.error('发送获取最近选中文本消息时出错:', error);
        resolve();
      }
    });
  }
  
  /**
   * 用选中的文本更新编辑器
   */
  updateEditorWithSelectedText() {
    // 如果有选中文本，且输入框为空或只有草稿，自动添加到编辑框
    if (this.currentSelectedText && this.elements.quickNote) {
      const currentValue = this.elements.quickNote.value.trim();
      const placeholder = this.elements.quickNote.placeholder;
      
      // 如果编辑框为空或只包含默认文本，则替换内容
      if (!currentValue || currentValue === placeholder) {
        // 添加选中的文本
        let content = this.currentSelectedText;
        
        // 根据设置决定是否添加来源信息
        if (this.settings && this.settings.includeUrl !== false) {
          content += `\n> 来源: [${this.currentTitle}](${this.currentUrl})`;
        }
        
        this.elements.quickNote.value = content;
        
        // 显示内容后不自动保存为草稿，这样关闭时会真正清空
        // this.saveDraft();
      }
    }
  }

  /**
   * 绑定UI事件
   */
  bindEvents() {
    // 发送笔记按钮
    if (this.elements.sendQuickNote) {
      this.elements.sendQuickNote.addEventListener('click', () => this.sendNote());
    }
    
    // 移除自动保存草稿功能，确保textarea内容不会被持久化
    /*
    // 自动保存草稿
    if (this.elements.quickNote) {
      this.elements.quickNote.addEventListener('input', () => {
        this.saveDraft();
      });
    }
    */
    
    // 保存内容类型偏好到设置
    if (this.elements.typeEssay && this.elements.typeNote) {
      this.elements.typeEssay.addEventListener('change', () => {
        this.updateContentTypeSetting('essay');
        this.toggleFolderSelect();
      });
      this.elements.typeNote.addEventListener('change', () => {
        this.updateContentTypeSetting('note');
        this.toggleFolderSelect();
        // 当切换到note类型时，加载文件夹
        if (this.elements.typeNote.checked && this.folders.length === 0) {
          this.loadFolders();
        }
      });
    }
    
    // 监听页面关闭事件
    window.addEventListener('unload', () => this.handlePopupClose());
  }

  /**
   * 处理弹出窗口关闭事件
   */
  async handlePopupClose() {
    // 清空文本区域
    if (this.elements.quickNote) {
      this.elements.quickNote.value = '';
    }
    
    // 清除草稿
    await this.clearDraft();
    
    // 清除选中的文本
    chrome.storage.local.remove('lastSelectedText', () => {
      console.log('清除最近选中的文本');
    });
    
    // 通知后台脚本清空最近选中的文本
    try {
      chrome.runtime.sendMessage({
        type: 'clearLastSelectedText'
      });
    } catch (error) {
      console.error('通知后台脚本清除选中文本时出错:', error);
    }
  }

  /**
   * 切换文件夹选择框的显示状态
   */
  toggleFolderSelect() {
    if (this.elements.folderSelectGroup) {
      if (this.elements.typeNote && this.elements.typeNote.checked) {
        this.elements.folderSelectGroup.style.display = 'block';
      } else {
        this.elements.folderSelectGroup.style.display = 'none';
      }
    }
  }

  /**
   * 发送笔记到 Essay.ink
   */
  async sendNote() {
    if (!this.elements.quickNote) return;
    
    const content = this.elements.quickNote.value.trim();
    
    if (!content) {
      this.showStatus('请输入笔记内容', 'error');
      return;
    }
    
    // 确保设置已加载
    if (!this.settings) {
      this.settings = await EssaySelectStorage.getSettings();
    }
    
    // 直接从UI获取内容类型
    const contentType = this.elements.typeNote.checked ? 'note' : 'essay';
    
    // 获取文件夹ID（仅当选择了Note类型时）
    let folderId = null;
    if (contentType === 'note' && this.elements.noteFolder) {
      folderId = this.elements.noteFolder.value;
    }
    
    // 设置按钮为加载状态
    this.setLoading(true);
    
    try {
      // 发送到 Essay.ink
      const result = await window.EssaySelectAPI.saveQuickNote(
        content, 
        folderId, 
        false, 
        contentType
      );
      
      // 显示成功消息
      let successMsg = `笔记已发送到 Essay.ink (${contentType})`;
      if (folderId) {
        const folderName = this.getFolderName(folderId);
        successMsg += ` 文件夹: ${folderName || folderId}`;
      }
      this.showStatus(successMsg, 'success');
      
      // 清空内容和草稿
      this.elements.quickNote.value = '';
      await this.clearDraft();
    } catch (error) {
      console.error('发送笔记失败:', error);
      this.showStatus(`发送失败: ${error.message}`, 'error');
    } finally {
      // 恢复按钮状态
      this.setLoading(false);
    }
  }

  /**
   * 根据文件夹ID获取文件夹名称
   * @param {string} folderId - 文件夹ID
   * @returns {string|null} - 文件夹名称，如果未找到则返回null
   */
  getFolderName(folderId) {
    if (!folderId) return '未分类';
    
    const folder = this.folders.find(f => f.id === folderId);
    return folder ? folder.name : null;
  }

  /**
   * 保存草稿
   */
  async saveDraft() {
    if (!this.elements.quickNote) return;
    
    const content = this.elements.quickNote.value;
    const folderId = this.elements.noteFolder ? this.elements.noteFolder.value : null;
    
    try {
      await EssaySelectStorage.saveNoteDraft(content);
      
      // 保存当前选择的文件夹
      if (folderId) {
        if (!this.settings) {
          this.settings = await EssaySelectStorage.getSettings();
        }
        this.settings.lastFolder = folderId;
        await EssaySelectStorage.saveSettings(this.settings);
      }
    } catch (error) {
      console.error('保存草稿失败:', error);
    }
  }

  /**
   * 加载草稿
   */
  async loadDraft() {
    if (!this.elements.quickNote) return;
    
    try {
      const draft = await EssaySelectStorage.getNoteDraft();
      
      if (draft && draft.content) {
        this.elements.quickNote.value = draft.content;
      }
    } catch (error) {
      console.error('加载草稿失败:', error);
    }
  }

  /**
   * 清除草稿
   */
  async clearDraft() {
    try {
      await EssaySelectStorage.clearNoteDraft();
    } catch (error) {
      console.error('清除草稿失败:', error);
    }
  }

  /**
   * 设置加载状态
   * @param {boolean} isLoading - 是否正在加载
   */
  setLoading(isLoading) {
    if (this.elements.sendQuickNote) {
      this.elements.sendQuickNote.disabled = isLoading;
      this.elements.sendQuickNote.textContent = isLoading ? '发送中...' : '发送到 Essay.ink';
    }
  }

  /**
   * 显示状态消息
   * @param {string} message - 消息内容
   * @param {string} type - 消息类型: success | error | info
   */
  showStatus(message, type = 'info') {
    const statusElement = document.getElementById('globalStatus');
    if (!statusElement) return;
    
    // 设置状态文本
    statusElement.textContent = message;
    
    // 设置状态类型
    statusElement.className = 'status';
    statusElement.classList.add(type);
    
    // 几秒后隐藏（除非是错误消息）
    if (type !== 'error') {
      setTimeout(() => {
        statusElement.classList.remove(type);
      }, 3000);
    }
  }

  /**
   * 初始化UI
   */
  async initUI() {
    if (!this.settings) return;
    
    // 设置内容类型单选按钮
    if (this.elements.typeEssay && this.elements.typeNote) {
      if (this.settings.contentType === 'note') {
        this.elements.typeNote.checked = true;
      } else {
        this.elements.typeEssay.checked = true; // 默认选中essay
      }
      
      // 初始化文件夹选择框的显示状态
      this.toggleFolderSelect();
    }
    
    // 设置文件夹选择框的值
    if (this.elements.noteFolder && this.settings.lastFolder) {
      this.elements.noteFolder.value = this.settings.lastFolder;
    }
  }
  
  /**
   * 更新内容类型设置
   * @param {string} contentType - 内容类型: 'essay' 或 'note'
   */
  async updateContentTypeSetting(contentType) {
    if (!this.settings) {
      this.settings = await EssaySelectStorage.getSettings();
    }
    
    this.settings.contentType = contentType;
    await EssaySelectStorage.saveSettings(this.settings);
  }

  /**
   * 从API加载文件夹
   */
  async loadFolders() {
    if (!this.elements.noteFolder) return;
    
    try {
      // 记住当前选择的文件夹
      const currentFolder = this.elements.noteFolder.value;
      
      // 尝试从缓存获取文件夹
      const cachedFolders = await this.getCachedFolders();
      if (cachedFolders) {
        this.folders = cachedFolders;
      } else {
        // 从API获取文件夹
        this.folders = await window.EssaySelectAPI.fetchFolders();
        // 缓存文件夹列表
        await this.cacheFolders(this.folders);
      }
      
      // 清空下拉菜单
      this.elements.noteFolder.innerHTML = '';
      
      // 添加默认选项
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = '未分类';
      this.elements.noteFolder.appendChild(defaultOption);
      
      // 添加API返回的文件夹
      if (this.folders && this.folders.length > 0) {
        this.folders.forEach(folder => {
          const option = document.createElement('option');
          option.value = folder.id;
          option.textContent = folder.name;
          this.elements.noteFolder.appendChild(option);
        });
        
        // 恢复之前选择的文件夹（如果存在）
        if (currentFolder && this.folderExists(currentFolder)) {
          this.elements.noteFolder.value = currentFolder;
        } else if (this.settings.lastFolder && this.folderExists(this.settings.lastFolder)) {
          this.elements.noteFolder.value = this.settings.lastFolder;
        } else {
          // 默认选择未分类
          this.elements.noteFolder.value = '';
        }
      }
      
      // 在后台异步刷新文件夹列表
      this.refreshFoldersInBackground();
    } catch (error) {
      console.error('加载文件夹失败:', error);
      // 静默失败，不显示错误提示
    }
  }
  
  /**
   * 检查文件夹是否存在于当前列表中
   * @param {string} folderId - 文件夹ID
   * @returns {boolean} - 是否存在
   */
  folderExists(folderId) {
    // 检查空值
    if (!folderId) return true;
    
    // 检查"未分类"选项
    if (folderId === '') return true;
    
    // 检查API返回的文件夹
    return this.folders.some(folder => folder.id === folderId);
  }

  /**
   * 从缓存获取文件夹列表
   * @returns {Promise<Array|null>} - 缓存的文件夹列表，如果不存在或已过期则返回null
   */
  async getCachedFolders() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['folders', 'foldersTimestamp'], (result) => {
        if (!result.folders || !result.foldersTimestamp) {
          resolve(null);
          return;
        }
        
        // 检查缓存是否过期（1小时）
        const now = Date.now();
        const cacheAge = now - result.foldersTimestamp;
        if (cacheAge > 3600000) { // 1小时 = 3600000毫秒
          resolve(null);
          return;
        }
        
        resolve(result.folders);
      });
    });
  }

  /**
   * 缓存文件夹列表
   * @param {Array} folders - 文件夹列表
   */
  async cacheFolders(folders) {
    return new Promise((resolve) => {
      chrome.storage.local.set({
        folders: folders,
        foldersTimestamp: Date.now()
      }, () => resolve());
    });
  }

  /**
   * 在后台异步刷新文件夹列表
   */
  async refreshFoldersInBackground() {
    try {
      const newFolders = await window.EssaySelectAPI.fetchFolders();
      if (newFolders && newFolders.length > 0) {
        this.folders = newFolders;
        await this.cacheFolders(newFolders);
      }
    } catch (error) {
      console.error('后台刷新文件夹失败:', error);
    }
  }
}

// 等待DOM加载完成后初始化笔记管理器
document.addEventListener('DOMContentLoaded', () => {
  window.QuickNoteManager = new QuickNoteManager();
}); 