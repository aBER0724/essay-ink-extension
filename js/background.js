/**
 * Essay.ink 后台脚本
 * 处理上下文菜单和消息传递
 */

// 全局变量，保存最近选中的文本
let lastSelectedText = '';

// 初始化扩展
function initialize() {
  try {
    console.log('Essay.ink 划词助手已初始化');
    
    // 创建右键菜单
    createContextMenus();
    
    // 设置消息监听器
    chrome.runtime.onMessage.addListener(handleMessage);
  } catch (error) {
    console.error('初始化扩展时出错:', error);
  }
}

// 创建右键菜单
function createContextMenus() {
  try {
    // 清除现有菜单
    chrome.contextMenus.removeAll(() => {
      if (chrome.runtime.lastError) {
        console.error('清除菜单时出错:', chrome.runtime.lastError);
      }
      
      try {
        // 创建保存选中文本的菜单
        chrome.contextMenus.create({
          id: 'saveSelectedText',
          title: '将选中内容添加到 Essay.ink',
          contexts: ['selection']
        }, () => {
          if (chrome.runtime.lastError) {
            console.error('创建菜单时出错:', chrome.runtime.lastError);
          }
        });
        
        // 为菜单项添加点击事件
        chrome.contextMenus.onClicked.addListener(handleContextMenuClick);
      } catch (innerError) {
        console.error('创建菜单过程中出错:', innerError);
      }
    });
  } catch (error) {
    console.error('处理右键菜单时出错:', error);
  }
}

// 处理右键菜单点击
function handleContextMenuClick(info, tab) {
  try {
    if (info.menuItemId === 'saveSelectedText' && info.selectionText) {
      // 保存选中的文本
      lastSelectedText = info.selectionText;
      // 打开弹出窗口
      chrome.action.openPopup();
    }
  } catch (error) {
    console.error('处理右键菜单点击时出错:', error);
  }
}

// 处理来自内容脚本的消息
function handleMessage(message, sender, sendResponse) {
  try {
    console.log('后台脚本收到消息:', message);
    
    // 保存选中的文本
    if (message.type === 'saveSelectedText' && message.data) {
      lastSelectedText = message.data;
      console.log('保存选中文本:', lastSelectedText);
      sendResponse({ success: true });
    }
    
    // 获取最近选中的文本
    if (message.type === 'getLastSelectedText') {
      console.log('返回选中文本:', lastSelectedText);
      sendResponse({ 
        success: true, 
        data: lastSelectedText 
      });
      return true;
    }
    
    // 返回 true 表示异步处理
    return true;
  } catch (error) {
    console.error('处理消息时出错:', error);
    try {
      sendResponse({ success: false, error: error.message });
    } catch (e) {
      // 忽略发送响应时的错误
    }
    return true;
  }
}

// 初始化
initialize(); 