/**
 * Essay.ink 内容脚本
 * 处理页面上的选中文本
 */

// 保存当前选中的文本
let currentSelectedText = '';

// 初始化
function initialize() {
  // 监听文本选择
  document.addEventListener('mouseup', () => {
    setTimeout(() => {
      const selection = window.getSelection();
      currentSelectedText = selection.toString().trim();
      // 把最新选中的文本发送到后台脚本保存
      if (currentSelectedText) {
        try {
          // 检查扩展是否可用
          if (!chrome.runtime?.id) {
            console.log('扩展上下文已失效');
            return;
          }
          
          chrome.runtime.sendMessage({
            type: 'saveSelectedText',
            data: currentSelectedText
          }, response => {
            // 检查是否有错误
            if (chrome.runtime.lastError) {
              console.log('发送文本消息时出错:', chrome.runtime.lastError);
              return;
            }
          });
        } catch (error) {
          console.log('捕获到错误:', error);
          // 扩展上下文已失效，不做任何操作
        }
      }
    }, 10);
  });

  // 监听来自popup的消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    try {
      // 检查扩展是否可用
      if (!chrome.runtime?.id) {
        console.log('扩展上下文已失效');
        return;
      }
      
      if (request.type === 'getSelectedText') {
        // 返回当前选中的文本
        sendResponse({
          success: true,
          data: currentSelectedText || ''
        });
        return true; // 表示异步响应
      }
    } catch (error) {
      console.log('处理消息时出错:', error);
      // 尝试发送错误响应
      try {
        sendResponse({ success: false, error: error.message });
      } catch (e) {
        // 忽略发送响应时的错误
      }
    }
  });
}

// 在DOM加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
} 