/**
 * Essay.ink 设置管理
 * 负责处理用户设置和偏好
 */

// 设置管理类
class SettingsManager {
  constructor() {
    this.settings = null;
    this.elements = {
      // API设置元素
      apiKey: document.getElementById('apiKey'),
      saveSettingsBtn: document.getElementById('saveSettings'),
      settingsStatus: document.getElementById('settingsStatus'),
      
      // 偏好设置元素
      includeUrl: document.getElementById('includeUrl'),
      showFloatingBall: document.getElementById('showFloatingBall'),
      savePreferencesBtn: document.getElementById('savePreferences'),
      
      // 标签页导航
      tabs: document.querySelectorAll('.tab'),
      tabContents: document.querySelectorAll('.tab-content')
    };
    
    this.init();
  }

  /**
   * 初始化设置管理器
   */
  async init() {
    // 加载设置
    await this.loadSettings();
    
    // 初始化UI
    this.initUI();
    
    // 绑定事件
    this.bindEvents();
  }

  /**
   * 加载用户设置
   */
  async loadSettings() {
    this.settings = await ReadCraftStorage.getSettings();
    console.log('加载设置:', this.settings);
  }

  /**
   * 初始化UI
   */
  initUI() {
    if (!this.settings) return;
    
    // 设置表单值
    if (this.elements.apiKey) {
      this.elements.apiKey.value = this.settings.apiKey || '';
    }
    
    if (this.elements.includeUrl) {
      this.elements.includeUrl.checked = this.settings.includeUrl !== false;
    }
    
    if (this.elements.showFloatingBall) {
      this.elements.showFloatingBall.checked = this.settings.showFloatingBall !== false;
    }
  }

  /**
   * 绑定UI事件
   */
  bindEvents() {
    // 保存API设置
    if (this.elements.saveSettingsBtn) {
      this.elements.saveSettingsBtn.addEventListener('click', () => this.saveAPISettings());
    }
    
    // 保存偏好设置
    if (this.elements.savePreferencesBtn) {
      this.elements.savePreferencesBtn.addEventListener('click', () => this.savePreferences());
    }
    
    // 标签页切换
    this.elements.tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.getAttribute('data-tab');
        this.switchTab(targetTab);
      });
    });
  }

  /**
   * 切换标签页
   * @param {string} tabId - 目标标签ID
   */
  switchTab(tabId) {
    // 更新标签按钮状态
    this.elements.tabs.forEach(tab => {
      if (tab.getAttribute('data-tab') === tabId) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
    
    // 更新标签内容显示
    this.elements.tabContents.forEach(content => {
      if (content.id === `${tabId}Tab`) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });
  }

  /**
   * 显示状态消息
   * @param {string} message - 消息内容
   * @param {string} type - 消息类型: success | error | info
   */
  showStatus(message, type = 'info') {
    const statusElement = document.getElementById('globalStatus');
    if (!statusElement) return;
    
    // 先移除可能的状态类
    statusElement.classList.remove('success', 'error', 'info');
    
    // 设置状态文本
    statusElement.textContent = message;
    
    // 添加状态类型
    statusElement.classList.add(type);
    
    // 几秒后隐藏（除非是错误消息）
    if (type !== 'error') {
      setTimeout(() => {
        statusElement.classList.remove(type);
      }, 3000);
    }
  }

  setLoading(isLoading) {
    // Implementation of setLoading method
  }

  /**
   * 保存API设置
   */
  async saveAPISettings() {
    try {
      // 获取表单值
      const apiKey = this.elements.apiKey.value.trim();
      
      // 验证输入
      if (!apiKey) {
        this.showStatus('请输入 Essay.ink API Token', 'error');
        return;
      }
      
      // 更新设置
      this.settings.apiKey = apiKey;
      
      // 保存设置
      await ReadCraftStorage.saveSettings(this.settings);
      
      // 显示成功消息
      this.showStatus('API Token 已保存', 'success');
    } catch (error) {
      console.error('保存API设置出错:', error);
      this.showStatus('保存设置出错: ' + error.message, 'error');
    }
  }

  /**
   * 保存偏好设置
   */
  async savePreferences() {
    try {
      this.setLoading(true);
      this.showStatus('正在保存设置...', 'info');
      
      // 获取当前设置
      const settings = await ReadCraftStorage.getSettings();
      console.log('当前设置:', settings);
      
      // 更新设置
      settings.includeUrl = this.elements.includeUrl.checked;
      settings.showFloatingBall = this.elements.showFloatingBall.checked;
      console.log('更新后的设置:', settings);
      
      // 保存设置
      await ReadCraftStorage.saveSettings(settings);
      
      // 通知内容脚本更新悬浮球状态
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'updateFloatingBall',
          data: {
            show: settings.showFloatingBall
          }
        });
      }
      
      this.showStatus('设置已保存', 'success');
    } catch (error) {
      console.error('保存偏好设置失败:', error);
      this.showStatus('保存失败: ' + error.message, 'error');
    } finally {
      this.setLoading(false);
    }
  }
}

// 等待DOM加载完成后初始化设置管理器
document.addEventListener('DOMContentLoaded', () => {
  window.SettingsManager = new SettingsManager();
}); 