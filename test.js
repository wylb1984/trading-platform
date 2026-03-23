const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('🌐 打开页面...\n');
  
  try {
    await page.goto('http://127.0.0.1:3000', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    // Test 1: 页面加载
    const title = await page.title();
    console.log(`页面标题: ${title}`);
    console.log(title.includes('Global Investing Copilot') ? '✅ 页面加载成功' : '❌ 页面加载失败');
    
    // Test 2: 搜索框存在
    const searchInput = await page.$('input');
    console.log(searchInput ? '✅ 搜索框存在' : '❌ 搜索框不存在');
    
    // Test 3: 页面内容检查
    const content = await page.content();
    console.log(content.includes('三大市场指数多空概览') ? '✅ 三大市场指数区域存在' : '❌ 三大市场指数区域不存在');
    console.log(content.includes('自选股最新交易信号分析总结') ? '✅ 交易信号区域存在' : '❌ 交易信号区域不存在');
    console.log(content.includes('自选股列表') ? '✅ 自选股列表区域存在' : '❌ 自选股列表区域不存在');
    console.log(content.includes('交易复盘') ? '✅ 交易复盘区域存在' : '❌ 交易复盘区域不存在');
    console.log(content.includes('策略回测') ? '✅ 策略回测区域存在' : '❌ 策略回测区域不存在');
    
    // Test 4: 测试搜索
    console.log('\n🔍 测试搜索功能...');
    await page.fill('input', 'AAPL');
    await page.waitForTimeout(2000);
    const searchContent = await page.content();
    console.log(searchContent.includes('苹果') ? '✅ AAPL搜索成功' : '❌ AAPL搜索失败');
    
    // 清除搜索框
    await page.fill('input', '');
    await page.waitForTimeout(500);
    
    // Test 5: 测试港股搜索
    await page.fill('input', '0700');
    await page.waitForTimeout(2000);
    const hkContent = await page.content();
    console.log(hkContent.includes('腾讯控股') ? '✅ 港股搜索成功' : '❌ 港股搜索失败');
    
    // Test 6: 测试A股搜索
    await page.fill('input', '贵州茅台');
    await page.waitForTimeout(2000);
    const cnContent = await page.content();
    console.log(cnContent.includes('600519') ? '✅ A股搜索成功' : '❌ A股搜索失败');
    
    // Test 7: 测试ETF搜索
    await page.fill('input', 'QQQ');
    await page.waitForTimeout(2000);
    const etfContent = await page.content();
    console.log(etfContent.includes('纳指100ETF') ? '✅ ETF搜索成功' : '❌ ETF搜索失败');
    
    console.log('\n✅ 前端UI测试完成');
    
  } catch (error) {
    console.error('测试错误:', error.message);
  } finally {
    await browser.close();
  }
})();
