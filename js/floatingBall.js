/**
 * Essay.ink 悬浮球模块
 * 提供页面快捷添加功能
 */

class FloatingBall {
  constructor() {
    this.ball = null;
    this.dragOffset = { x: 0, y: 0 };
    this.isDragging = false;
    this.isVisible = false;
    this.isLoading = false;
    this.currentSelectedText = '';
    
    // 状态
    this.state = {
      lastPosition: { x: 20, y: 20 }
    };
  }

  /**
   * 初始化悬浮球
   */
  async init() {
    const settings = await ReadCraftStorage.getSettings();
    if (!settings.showFloatingBall) {
      return;
    }
    
    this.create();
    this.bindEvents();
    this.setupSelectionListener();
  }

  /**
   * 创建悬浮球DOM
   */
  create() {
    // 如果已经创建，不重复创建
    if (this.ball) {
      return;
    }
    
    // 创建悬浮球元素
    this.ball = document.createElement('div');
    this.ball.className = 'essay-ink-floating-ball';
    this.ball.innerHTML = `添加到 Essay`;
    
    // 设置样式
    const style = document.createElement('style');
    style.textContent = `
      .essay-ink-floating-ball {
        position: absolute;
        padding: 5px 10px;
        background-color: #4caf50;
        color: white;
        border-radius: 3px;
        font-size: 12px;
        cursor: pointer;
        z-index: 9999;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
        display: none;
        font-family: Arial, sans-serif;
      }
      
      .essay-ink-floating-ball:hover {
        background-color: #3e9142;
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
      
      // 设置加载状态
      this.setLoading(true);
      
      try {
        // 准备数据
        const pageUrl = window.location.href;
        const pageTitle = document.title || '当前页面';
        
        // 发送请求
        const response = await this.sendToEssayInk(this.currentSelectedText, pageUrl, pageTitle);
        
        // 显示成功状态
        this.ball.innerHTML = '添加成功！';
        this.ball.style.backgroundColor = '#4caf50';
      } catch (error) {
        console.error('Essay.ink: 发送请求失败', error);
        this.ball.innerHTML = '添加失败';
        this.ball.style.backgroundColor = '#f44336';
      }
      
      // 延时隐藏
      setTimeout(() => {
        this.ball.style.display = 'none';
        this.ball.innerHTML = '添加到 Essay';
        this.ball.style.backgroundColor = '#4caf50';
        this.setLoading(false);
        this.currentSelectedText = ''; // 清空保存的文本
      }, 3000);
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
    const settings = await ReadCraftStorage.getSettings();
    
    if (!settings.apiKey) {
      throw new Error('Essay.ink API Token 未设置，请在扩展设置中配置');
    }
    
    // 准备内容，添加来源信息
    let content = text;
    
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
}

// 创建并初始化悬浮球
window.FloatingBall = new FloatingBall();
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => window.FloatingBall.init(), 1000);
}); 