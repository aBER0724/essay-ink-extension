/**
 * Essay.ink 悬浮按钮模块
 * 提供页面快捷添加功能
 */

class FloatingBtn {
  constructor() {
    this.ball = null;
    this.dragOffset = { x: 0, y: 0 };
    this.isDragging = false;
    this.isVisible = false;
    this.isLoading = false;
    this.currentSelectedText = '';
    this.settings = null;
    
    // 状态
    this.state = {
      lastPosition: { x: 20, y: 20 }
    };
  }

  /**
   * 初始化悬浮按钮
   */
  async init() {
    try {
      // 加载设置
      this.settings = await EssaySelectStorage.getSettings();
      console.log('悬浮按钮设置:', this.settings);
      
      // 如果设置中禁用了悬浮按钮，则不创建
      if (this.settings.showFloatingBtn === false) {
        console.log('悬浮按钮已禁用');
        return;
      }
      
      // 创建悬浮按钮
      this.create();
      
      // 设置选择文本监听器
      this.setupSelectionListener();
      
      // 绑定事件
      this.bindEvents();
      
      // 监听来自popup的消息
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log('收到消息:', request);
        if (request.type === 'updateFloatingBtn') {
          if (request.data.show) {
            this.show();
          } else {
            this.hide();
          }
        }
      });
      
      // 初始显示状态
      this.show();
    } catch (error) {
      console.error('初始化悬浮按钮失败:', error);
    }
  }

  /**
   * 创建悬浮按钮DOM
   */
  create() {
    // 如果已经创建，不重复创建
    if (this.ball) {
      return;
    }
    
    // 创建悬浮按钮元素
    this.ball = document.createElement('div');
    this.ball.className = 'essay-ink-floating-ball';
    this.ball.innerHTML = `添加到 Essay`;
    
    // 设置样式
    const style = document.createElement('style');
    style.textContent = `
      .essay-ink-floating-ball {
        position: fixed;
        padding: 8px 12px;
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
        border-radius: 5px;
        font-size: 13px;
        cursor: pointer;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
        display: none;
        font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
        transition: all 0.3s ease;
      }
      
      .essay-ink-floating-ball:hover {
        background: linear-gradient(135deg, #059669 0%, #047857 100%);
      }
    `;
    
    // 添加到文档
    document.head.appendChild(style);
    document.body.appendChild(this.ball);
    
    this.isVisible = false;
  }

  /**
   * 设置选择文本监听器
   */
  setupSelectionListener() {
    // 监听鼠标抬起事件，检测文本选择
    document.addEventListener('mouseup', (e) => {
      setTimeout(() => {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        
        if (selectedText) {
          // 保存当前选择的文本
          this.currentSelectedText = selectedText;
          
          try {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            
            // 定位浮动按钮
            this.ball.style.left = (rect.left + window.scrollX + rect.width / 2 - this.ball.offsetWidth / 2) + 'px';
            this.ball.style.top = (rect.bottom + window.scrollY + 10) + 'px';
            this.ball.style.display = 'block';
          } catch (e) {
            console.error('Essay.ink: 定位按钮时出错', e);
          }
        }
      }, 10);
    });
    
    // 点击其他地方隐藏按钮
    document.addEventListener('mousedown', (e) => {
      if (e.target !== this.ball) {
        this.ball.style.display = 'none';
      }
    });
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    if (!this.ball) return;
    
    // 点击按钮发送选中文本
    this.ball.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (this.isLoading || !this.currentSelectedText) return;
      
      try {
        // 获取当前页面信息
        const currentUrl = window.location.href;
        const currentTitle = document.title;
        
        // 准备保存的内容
        let contentToSave = this.currentSelectedText;
        
        // 根据设置决定是否添加来源信息
        if (this.settings.includeUrl !== false) {
          contentToSave += `\n> 来源: [${currentTitle}](${currentUrl})`;
        }
        
        // 保存内容到临时存储
        await EssaySelectStorage.setTempContent(contentToSave);
        
        // 打开 popup
        chrome.runtime.sendMessage({
          type: 'openPopup'
        });
        
        // 隐藏悬浮按钮
        this.hide();
      } catch (error) {
        console.error('打开 popup 失败:', error);
      }
    });
  }

  /**
   * 发送内容到 Essay.ink
   * @param {string} text - 选中的文本
   * @param {string} url - 页面URL
   * @param {string} title - 页面标题
   */
  async sendToEssayInk(text, url, title) {
    // 获取 API 设置
    const settings = await EssaySelectStorage.getSettings();
    
    if (!settings.apiKey) {
      throw new Error('Essay.ink API Token 未设置，请在扩展设置中配置');
    }
    
    // 准备内容
    let content = text;
    
    // 根据设置决定是否添加来源信息
    if (settings.includeUrl !== false) {
      content += `\n\n---\n> 来源: [${title}](${url})`;
    }
    
    // 发送请求
    const response = await fetch('https://api.essay.ink/essays', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({ content })
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
  }

  /**
   * 设置加载状态
   * @param {boolean} isLoading - 是否正在加载
   */
  setLoading(isLoading) {
    this.isLoading = isLoading;
    
    if (isLoading) {
      this.ball.innerHTML = '发送中...';
    }
  }

  /**
   * 显示悬浮按钮
   */
  show() {
    if (this.ball) {
      this.ball.style.display = 'block';
      this.isVisible = true;
    }
  }

  /**
   * 隐藏悬浮按钮
   */
  hide() {
    if (this.ball) {
      this.ball.style.display = 'none';
      this.isVisible = false;
    }
  }

  /**
   * 显示状态通知
   * @param {string} message - 消息内容
   * @param {string} type - 消息类型: success | error | info
   */
  showNotification(message, type = 'info') {
    // 如果通知元素不存在，创建它
    let notification = document.getElementById('essay-ink-notification');
    if (!notification) {
      notification = document.createElement('div');
      notification.id = 'essay-ink-notification';
      document.body.appendChild(notification);
      
      // 添加样式
      const style = document.createElement('style');
      style.textContent = `
        #essay-ink-notification {
          position: fixed;
          bottom: 20px;
          right: 20px;
          padding: 10px 15px;
          border-radius: 4px;
          font-size: 14px;
          font-family: Arial, sans-serif;
          z-index: 10000;
          max-width: 300px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
          transition: opacity 0.3s, transform 0.3s;
          opacity: 0;
          transform: translateY(20px);
        }
        #essay-ink-notification.show {
          opacity: 1;
          transform: translateY(0);
        }
        #essay-ink-notification.success {
          background-color: #e8f5e9;
          color: #2e7d32;
          border-left: 4px solid #2e7d32;
        }
        #essay-ink-notification.error {
          background-color: #ffebee;
          color: #c62828;
          border-left: 4px solid #c62828;
        }
        #essay-ink-notification.info {
          background-color: #e3f2fd;
          color: #1565c0;
          border-left: 4px solid #1565c0;
        }
      `;
      document.head.appendChild(style);
    }
    
    // 设置消息内容和类型
    notification.textContent = message;
    notification.className = type;
    notification.classList.add('show');
    
    // 几秒后自动隐藏通知
    setTimeout(() => {
      notification.classList.remove('show');
    }, 3000);
  }
}

// 创建并初始化悬浮按钮
window.FloatingBtn = new FloatingBtn();
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => window.FloatingBtn.init(), 1000);
}); 