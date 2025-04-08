/**
 * EssaySelect 弹出窗口脚本
 * 处理弹出窗口的UI交互
 */

// 弹出窗口控制器
class PopupController {
  constructor() {
    this.elements = {
      // 内容提取相关
      extractBtn: document.getElementById('extractBtn'),
      extractStatus: document.getElementById('extractStatus'),
      resultCard: document.getElementById('resultCard'),
      summaryResult: document.getElementById('summaryResult'),
      summaryTag: document.getElementById('summaryTag'),
      saveBtn: document.getElementById('saveBtn'),
      
      // 快速笔记相关
      quickNote: document.getElementById('quickNote'),
      quickNoteTag: document.getElementById('quickNoteTag'),
      sendQuickNote: document.getElementById('sendQuickNote'),
      quickNoteStatus: document.getElementById('quickNoteStatus')
    };
    
    this.state = {
      isLoading: false,
      activeTab: null,
      extractedContent: null
    };
    
    this.init();
  }

  /**
   * 初始化控制器
   */
  async init() {
    // 获取当前激活的标签页
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    this.state.activeTab = tabs[0];
    
    // 加载设置
    this.settings = await EssaySelectStorage.getSettings();
    
    // 设置默认标签
    if (this.elements.summaryTag) {
      this.elements.summaryTag.value = this.settings.summaryTag || '#web/summary';
    }
    
    if (this.elements.quickNoteTag) {
      this.elements.quickNoteTag.value = this.settings.quickNoteTag || '#quick/note';
    }
    
    // 检查是否有临时存储的内容
    const tempContent = await EssaySelectStorage.getTempContent();
    if (tempContent) {
      this.showExtractedContent(tempContent);
      // 清空临时存储
      await EssaySelectStorage.setTempContent('');
    }
    
    // 绑定事件
    this.bindEvents();
  }

  /**
   * 绑定UI事件
   */
  bindEvents() {
    // 提取按钮
    if (this.elements.extractBtn) {
      this.elements.extractBtn.addEventListener('click', () => this.extractContent());
    }
    
    // 保存按钮
    if (this.elements.saveBtn) {
      this.elements.saveBtn.addEventListener('click', () => this.saveSummary());
    }
    
    // 发送快速笔记按钮
    if (this.elements.sendQuickNote) {
      this.elements.sendQuickNote.addEventListener('click', () => this.sendQuickNote());
    }
    
    // 监听页面关闭事件
    window.addEventListener('unload', () => this.handlePopupClose());
  }

  /**
   * 处理弹出窗口关闭事件
   */
  handlePopupClose() {
    // 清空文本区域
    if (this.elements.quickNote) {
      this.elements.quickNote.value = '';
    }
    
    // 清除选中的文本
    chrome.storage.local.remove('lastSelectedText', () => {
      console.log('清除最近选中的文本');
    });
    
    // 清除草稿
    chrome.storage.local.remove('noteDraft', () => {
      console.log('清除草稿内容');
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
   * 发送快速笔记
   */
  async sendQuickNote() {
    try {
      // 检查quickNote元素是否存在
      if (!this.elements.quickNote) {
        console.log('快速笔记元素不存在，可能在不同的选项卡中');
        this.showStatus('无法访问笔记内容，请切换到"添加笔记"选项卡', 'error');
        return;
      }
      
      const content = this.elements.quickNote.value.trim();
      
      if (!content) {
        this.showStatus('笔记内容不能为空', 'error');
        return;
      }
      
      // 检查API对象是否存在
      if (!window.EssaySelectAPI) {
        console.error('EssaySelectAPI对象未定义');
        this.showStatus('API服务不可用，请刷新页面重试', 'error');
        return;
      }
      
      // 检查API方法是否存在
      if (typeof window.EssaySelectAPI.saveQuickNote !== 'function') {
        console.error('EssaySelectAPI.saveQuickNote方法未定义');
        this.showStatus('API服务不完整，请刷新页面重试', 'error');
        return;
      }
      
      this.setLoading(true);
      this.showStatus('正在发送...', 'info');
      
      // 获取标签，并确保元素存在
      let tag = '';
      if (this.elements.quickNoteTag) {
        tag = this.elements.quickNoteTag.value.trim();
      }
      
      // 发送到服务器
      await window.EssaySelectAPI.saveQuickNote(
        content,
        tag,
        this.settings.includeUrl
      );
      
      // 显示成功状态
      this.showStatus('笔记保存成功', 'success');
      
      // 清空输入框
      this.elements.quickNote.value = '';
    } catch (error) {
      console.error('发送快速笔记出错:', error);
      this.showStatus('发送失败: ' + error.message, 'error');
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * 设置加载状态
   * @param {boolean} isLoading - 是否正在加载
   */
  setLoading(isLoading) {
    this.state.isLoading = isLoading;
    
    // 设置按钮状态
    if (this.elements.extractBtn) {
      this.elements.extractBtn.disabled = isLoading;
    }
    
    if (this.elements.saveBtn) {
      this.elements.saveBtn.disabled = isLoading;
    }
    
    if (this.elements.sendQuickNote) {
      this.elements.sendQuickNote.disabled = isLoading;
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
   * 显示提取的内容
   * @param {string} content - 提取的内容
   */
  showExtractedContent(content) {
    if (this.elements.quickNote) {
      this.elements.quickNote.value = content;
    }
  }
}

// 等待DOM加载完成后初始化弹出窗口控制器
document.addEventListener('DOMContentLoaded', () => {
  window.PopupController = new PopupController();
}); 