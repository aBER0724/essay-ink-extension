/**
 * Essay.ink 内容脚本
 * 处理页面上的选中文本
 */

// 保存当前选中的文本
let currentSelectedText = '';

// 初始化
async function initialize() {
  try {
    // 等待DOM加载完成
    if (document.readyState !== 'complete') {
      await new Promise(resolve => {
        window.addEventListener('load', resolve);
      });
    }
    
    // 加载设置
    const settings = await ReadCraftStorage.getSettings();
    console.log('内容脚本加载设置:', settings);
    
    // 如果设置中启用了悬浮球，则初始化
    if (settings.showFloatingBall !== false) {
      // 确保 FloatingBall 类已加载
      if (typeof FloatingBall === 'undefined') {
        console.error('FloatingBall 类未定义');
        return;
      }
      
      window.FloatingBall = new FloatingBall();
      await window.FloatingBall.init();
    }
    
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
              console.log('扩展上下文已失效，尝试重新初始化');
              // 尝试重新初始化扩展
              chrome.runtime.reload();
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
            // 扩展上下文已失效，尝试重新初始化
            chrome.runtime.reload();
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
        
        console.log('收到消息:', request);
        
        if (request.type === 'getSelectedText') {
          // 返回当前选中的文本
          sendResponse({
            success: true,
            data: currentSelectedText || ''
          });
          return true; // 表示异步响应
        }
        
        if (request.type === 'updateFloatingBall') {
          console.log('更新悬浮球状态:', request.data);
          // 更新悬浮球状态
          if (request.data.show) {
            if (window.FloatingBall) {
              window.FloatingBall.show();
            } else {
              // 如果悬浮球不存在，重新初始化
              window.FloatingBall = new FloatingBall();
              window.FloatingBall.init();
            }
          } else {
            if (window.FloatingBall) {
              window.FloatingBall.hide();
              // 如果悬浮球被禁用，销毁实例
              window.FloatingBall = null;
            }
          }
          return true;
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
  } catch (error) {
    console.error('初始化内容脚本失败:', error);
  }
}

// 在DOM加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
} 