/**
 * Essay.ink 存储管理模块
 * 处理 Essay.ink API Token 和临时内容的存储
 */

// 默认设置
const DEFAULT_SETTINGS = {
  apiKey: '',
  includeUrl: true,
  contentType: 'essay', // 默认使用essay类型
  quickNoteTag: '#quick/note'
};

// 获取所有设置
async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get('settings', (result) => {
      resolve(result.settings || DEFAULT_SETTINGS);
    });
  });
}

// 保存设置
async function saveSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ settings }, () => {
      resolve();
    });
  });
}

// 获取临时存储的内容
async function getTempContent() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['tempContent'], (result) => {
      resolve(result.tempContent || '');
    });
  });
}

// 清除临时内容
async function clearTempContent() {
  return new Promise((resolve) => {
    chrome.storage.local.remove('tempContent', () => {
      resolve();
    });
  });
}

// 保存笔记草稿内容
async function saveNoteDraft(content, tag) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ 
      noteDraft: {
        content,
        tag,
        timestamp: Date.now()
      }
    }, () => {
      resolve();
    });
  });
}

// 获取笔记草稿
async function getNoteDraft() {
  return new Promise((resolve) => {
    chrome.storage.local.get('noteDraft', (result) => {
      resolve(result.noteDraft || null);
    });
  });
}

// 清除笔记草稿
async function clearNoteDraft() {
  return new Promise((resolve) => {
    chrome.storage.local.remove('noteDraft', () => {
      resolve();
    });
  });
}

// 临时存储选中的文本
async function setTempContent(content) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ tempContent: content }, () => {
      if (chrome.runtime.lastError) {
        console.error('保存临时内容失败:', chrome.runtime.lastError);
      }
      resolve();
    });
  });
}

// 导出函数
window.EssaySelectStorage = {
  getSettings,
  saveSettings,
  setTempContent,
  getTempContent,
  clearTempContent,
  saveNoteDraft,
  getNoteDraft,
  clearNoteDraft,
  DEFAULT_SETTINGS
}; 