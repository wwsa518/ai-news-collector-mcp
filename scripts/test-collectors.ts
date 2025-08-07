// 测试采集器实现
import { RSSCollector } from '../agents/collector-agent/collectors/rss-collector';
import { WebCollector } from '../agents/collector-agent/collectors/web-collector';
import { APICollector } from '../agents/collector-agent/collectors/api-collector';
import { LoggerUtils } from '../shared/utils';

async function testCollectors() {
  console.log('🧪 Testing Collector Implementations...\n');

  // 1. 测试RSS采集器
  console.log('1️⃣ Testing RSS Collector...');
  const rssCollector = new RSSCollector();
  
  const rssConfig = {
    url: 'http://124.221.80.250:5678/rssp/cnbeta',
    name: 'cnbeta_test',
    category: 'tech',
    language: 'zh',
    max_items: 3
  };

  try {
    const rssResult = await rssCollector.collectFromSource(rssConfig);
    console.log('✅ RSS collection completed');
    console.log(`   - Collected ${rssResult.collected_count} items`);
    console.log(`   - Processing time: ${rssResult.processing_time}ms`);
    if (rssResult.error) {
      console.log(`   - Error: ${rssResult.error}`);
    }
  } catch (error) {
    console.error('❌ RSS collection failed:', error);
  }

  // 2. 测试网页采集器
  console.log('\n2️⃣ Testing Web Collector...');
  const webCollector = new WebCollector();
  
  const webConfig = {
    url: 'https://news.cnblogs.com',
    name: 'cnblogs_test',
    category: 'tech',
    language: 'zh',
    max_items: 3
  };

  try {
    const webResult = await webCollector.collectFromSource(webConfig);
    console.log('✅ Web collection completed');
    console.log(`   - Collected ${webResult.collected_count} items`);
    console.log(`   - Processing time: ${webResult.processing_time}ms`);
    if (webResult.error) {
      console.log(`   - Error: ${webResult.error}`);
    }
  } catch (error) {
    console.error('❌ Web collection failed:', error);
  }

  // 3. 测试API采集器
  console.log('\n3️⃣ Testing API Collector...');
  const apiCollector = new APICollector();
  
  const apiConfig = {
    url: 'https://jsonplaceholder.typicode.com/posts',
    name: 'jsonplaceholder_test',
    method: 'GET' as const,
    mapping: {
      title: 'title',
      content: 'body',
      url: 'id',
      date: 'id'
    },
    max_items: 3
  };

  try {
    const apiResult = await apiCollector.collectFromSource(apiConfig);
    console.log('✅ API collection completed');
    console.log(`   - Collected ${apiResult.collected_count} items`);
    console.log(`   - Processing time: ${apiResult.processing_time}ms`);
    if (apiResult.error) {
      console.log(`   - Error: ${apiResult.error}`);
    }
  } catch (error) {
    console.error('❌ API collection failed:', error);
  }

  // 4. 测试采集器验证
  console.log('\n4️⃣ Testing Collector Validation...');
  
  try {
    const rssValid = await rssCollector.validateRSSSource('http://124.221.80.250:5678/rssp/cnbeta');
    console.log(`✅ RSS source validation: ${rssValid}`);
  } catch (error) {
    console.error('❌ RSS validation failed:', error);
  }

  try {
    const webValid = await webCollector.validateWebSource('https://news.cnblogs.com');
    console.log(`✅ Web source validation: ${webValid}`);
  } catch (error) {
    console.error('❌ Web validation failed:', error);
  }

  try {
    const apiValid = await apiCollector.validateAPISource(apiConfig);
    console.log(`✅ API source validation: ${apiValid}`);
  } catch (error) {
    console.error('❌ API validation failed:', error);
  }

  console.log('\n🎉 Collector testing completed!');
}

// 运行测试
testCollectors().catch(console.error);