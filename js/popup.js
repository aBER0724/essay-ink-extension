/**
 * ReadCraft 弹出窗口脚本
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
    this.settings = await ReadCraftStorage.getSettings();
    
    // 设置默认标签
    if (this.elements.summaryTag) {
      this.elements.summaryTag.value = this.settings.summaryTag || '#web/summary';
    }
    
    if (this.elements.quickNoteTag) {
      this.elements.quickNoteTag.value = this.settings.quickNoteTag || '#quick/note';
    }
    
    // 检查是否有临时存储的内容
    const tempContent = await ReadCraftStorage.getTempContent();
    if (tempContent) {
      this.showExtractedContent(tempContent);
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
  }


  /**
   * 发送快速笔记
   */
  async sendQuickNote() {
    try {
      const content = this.elements.quickNote.value.trim();
      
      if (!content) {
        this.showStatus(this.elements.quickNoteStatus, '笔记内容不能为空', 'error');
        return;
      }
      
      this.setLoading(true);
      this.showStatus(this.elements.quickNoteStatus, '正在发送...', 'info');
      
      // 获取标签
      const tag = this.elements.quickNoteTag.value.trim();
      
      // 发送到服务器
      await ReadCraftAPI.saveQuickNote(
        content,
        tag,
        this.settings.includeUrl
      );
      
      // 显示成功状态
      this.showStatus(this.elements.quickNoteStatus, '笔记保存成功', 'success');
      
      // 清空输入框
      this.elements.quickNote.value = '';
    } catch (error) {
      console.error('发送快速笔记出错:', error);
      this.showStatus(this.elements.quickNoteStatus, '发送失败: ' + error.message, 'error');
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
   * @param {Element} element - 状态元素
   * @param {string} message - 消息内容
   * @param {string} type - 消息类型: success | error | info
   */
  showStatus(element, message, type = 'info') {
    if (!element) return;
    
    // 设置状态文本
    element.textContent = message;
    
    // 设置状态类型
    element.className = 'status';
    element.classList.add(type);
    
    // 几秒后隐藏（除非是错误消息）
    if (type !== 'error') {
      setTimeout(() => {
        element.className = 'status';
      }, 3000);
    }
  }
}

// 等待DOM加载完成后初始化弹出窗口控制器
document.addEventListener('DOMContentLoaded', () => {
  window.PopupController = new PopupController();
}); 