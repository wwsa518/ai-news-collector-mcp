// ==================== 基础Agent架构 ====================

// 基础任务类型定义
interface Task {
  id: string;
  type: string;
  data: any;
  priority?: number;
  metadata?: Record<string, any>;
}

interface TaskResult {
  taskId: string;
  success: boolean;
  data?: any;
  error?: string;
  processingTime: number;
}

// Agent状态枚举
enum AgentStatus {
  IDLE = "idle",
  BUSY = "busy",
  ERROR = "error",
}

// 基础Agent抽象类
abstract class BaseAgent {
  protected agentId: string;
  protected agentType: string;
  protected status: AgentStatus = AgentStatus.IDLE;
  private taskQueue: Task[] = [];

  constructor(id: string, type: string) {
    this.agentId = id;
    this.agentType = type;
  }

  // 抽象方法，子类必须实现
  abstract async executeTask(task: Task): Promise<TaskResult>;

  // 接收任务
  async receiveTask(task: Task): Promise<TaskResult> {
    console.log(`[${this.agentId}] 接收任务: ${task.type}`);

    try {
      this.status = AgentStatus.BUSY;
      const startTime = Date.now();

      const result = await this.executeTask(task);

      const processingTime = Date.now() - startTime;
      this.status = AgentStatus.IDLE;

      return {
        ...result,
        processingTime,
      };
    } catch (error) {
      this.status = AgentStatus.ERROR;
      return {
        taskId: task.id,
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
        processingTime: Date.now() - Date.now(),
      };
    }
  }

  // 获取Agent状态
  getStatus(): AgentStatus {
    return this.status;
  }

  // 获取Agent信息
  getInfo() {
    return {
      id: this.agentId,
      type: this.agentType,
      status: this.status,
      queueLength: this.taskQueue.length,
    };
  }
}

// ==================== 具体Agent实现 ====================

// 1. RSS采集Agent
class RSSCollectorAgent extends BaseAgent {
  constructor() {
    super("rss-collector-001", "RSS_COLLECTOR");
  }

  async executeTask(task: Task): Promise<TaskResult> {
    if (task.type !== "COLLECT_RSS") {
      return {
        taskId: task.id,
        success: false,
        error: "不支持的任务类型",
        processingTime: 0,
      };
    }

    console.log(`[RSS采集] 开始采集: ${task.data.url}`);

    // 模拟RSS采集过程
    await this.simulateDelay(1000, 2000);

    // 模拟采集结果
    const mockData = {
      source: "RSS",
      url: task.data.url,
      items: [
        {
          id: `news-${Date.now()}-1`,
          title: `模拟新闻标题 ${Math.floor(Math.random() * 1000)}`,
          content: "这是一条模拟的新闻内容，用于测试RSS采集功能...",
          publishedAt: new Date().toISOString(),
          sourceUrl: task.data.url,
        },
        {
          id: `news-${Date.now()}-2`,
          title: `另一条新闻 ${Math.floor(Math.random() * 1000)}`,
          content: "这是另一条模拟新闻，包含更多测试数据...",
          publishedAt: new Date().toISOString(),
          sourceUrl: task.data.url,
        },
      ],
    };

    console.log(`[RSS采集] 采集完成，获得 ${mockData.items.length} 条新闻`);

    return {
      taskId: task.id,
      success: true,
      data: mockData,
      processingTime: 0, // 会在基类中设置
    };
  }

  private async simulateDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise((resolve) => setTimeout(resolve, delay));
  }
}

// 2. 数据清洗Agent
class DataCleaningAgent extends BaseAgent {
  constructor() {
    super("data-cleaner-001", "DATA_CLEANER");
  }

  async executeTask(task: Task): Promise<TaskResult> {
    if (task.type !== "CLEAN_DATA") {
      return {
        taskId: task.id,
        success: false,
        error: "不支持的任务类型",
        processingTime: 0,
      };
    }

    console.log(`[数据清洗] 开始清洗 ${task.data.items?.length || 0} 条数据`);

    // 模拟数据清洗过程
    await this.simulateDelay(500, 1000);

    const cleanedItems =
      task.data.items?.map((item: any) => ({
        ...item,
        title: this.cleanText(item.title),
        content: this.cleanText(item.content),
        cleanedAt: new Date().toISOString(),
        wordCount: this.countWords(item.content),
      })) || [];

    console.log(`[数据清洗] 清洗完成`);

    return {
      taskId: task.id,
      success: true,
      data: {
        ...task.data,
        items: cleanedItems,
        cleanedCount: cleanedItems.length,
      },
      processingTime: 0,
    };
  }

  private cleanText(text: string): string {
    // 简单的文本清洗：去除多余空格、特殊字符等
    return text
      .replace(/\s+/g, " ")
      .replace(/[^\w\s\u4e00-\u9fff.,!?;:()""'']/g, "")
      .trim();
  }

  private countWords(text: string): number {
    // 简单的词数统计
    return text.split(/\s+/).length;
  }

  private async simulateDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise((resolve) => setTimeout(resolve, delay));
  }
}

// 3. 情感分析Agent
class SentimentAnalysisAgent extends BaseAgent {
  constructor() {
    super("sentiment-analyzer-001", "SENTIMENT_ANALYZER");
  }

  async executeTask(task: Task): Promise<TaskResult> {
    if (task.type !== "ANALYZE_SENTIMENT") {
      return {
        taskId: task.id,
        success: false,
        error: "不支持的任务类型",
        processingTime: 0,
      };
    }

    console.log(`[情感分析] 开始分析 ${task.data.items?.length || 0} 条数据`);

    // 模拟情感分析过程
    await this.simulateDelay(800, 1500);

    const analyzedItems =
      task.data.items?.map((item: any) => ({
        ...item,
        sentiment: this.mockSentimentAnalysis(item.title + " " + item.content),
        analyzedAt: new Date().toISOString(),
      })) || [];

    console.log(`[情感分析] 分析完成`);

    return {
      taskId: task.id,
      success: true,
      data: {
        ...task.data,
        items: analyzedItems,
        analyzedCount: analyzedItems.length,
      },
      processingTime: 0,
    };
  }

  private mockSentimentAnalysis(text: string) {
    // 简单的模拟情感分析
    const positiveWords = ["好", "优秀", "成功", "增长", "盈利", "上涨"];
    const negativeWords = ["坏", "失败", "下跌", "亏损", "危机", "风险"];

    let score = 0;
    positiveWords.forEach((word) => {
      if (text.includes(word)) score += 0.3;
    });
    negativeWords.forEach((word) => {
      if (text.includes(word)) score -= 0.3;
    });

    // 添加随机因素
    score += (Math.random() - 0.5) * 0.4;
    score = Math.max(-1, Math.min(1, score)); // 限制在[-1, 1]范围内

    let label: "positive" | "negative" | "neutral";
    if (score > 0.2) label = "positive";
    else if (score < -0.2) label = "negative";
    else label = "neutral";

    return {
      score: Number(score.toFixed(3)),
      label,
      confidence: Math.random() * 0.3 + 0.7, // 0.7-1.0之间的置信度
    };
  }

  private async simulateDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise((resolve) => setTimeout(resolve, delay));
  }
}

// ==================== 主协调Agent ====================

class MasterCoordinatorAgent extends BaseAgent {
  private agents: Map<string, BaseAgent> = new Map();

  constructor() {
    super("master-coordinator-001", "MASTER_COORDINATOR");
    this.initializeAgents();
  }

  private initializeAgents() {
    // 注册所有子Agent
    const rssCollector = new RSSCollectorAgent();
    const dataCleaner = new DataCleaningAgent();
    const sentimentAnalyzer = new SentimentAnalysisAgent();

    this.agents.set("rss-collector", rssCollector);
    this.agents.set("data-cleaner", dataCleaner);
    this.agents.set("sentiment-analyzer", sentimentAnalyzer);

    console.log("[主协调器] 已初始化所有子Agent");
  }

  async executeTask(task: Task): Promise<TaskResult> {
    if (task.type !== "PROCESS_NEWS_PIPELINE") {
      return {
        taskId: task.id,
        success: false,
        error: "不支持的任务类型",
        processingTime: 0,
      };
    }

    console.log(`[主协调器] 开始处理新闻流水线: ${task.data.url}`);

    try {
      // 1. 数据采集阶段
      const collectorTask: Task = {
        id: `collect-${Date.now()}`,
        type: "COLLECT_RSS",
        data: { url: task.data.url },
      };

      const rssCollector = this.agents.get("rss-collector");
      if (!rssCollector) throw new Error("RSS采集Agent未找到");

      const collectResult = await rssCollector.receiveTask(collectorTask);
      if (!collectResult.success) {
        throw new Error(`数据采集失败: ${collectResult.error}`);
      }

      // 2. 数据清洗阶段
      const cleaningTask: Task = {
        id: `clean-${Date.now()}`,
        type: "CLEAN_DATA",
        data: collectResult.data,
      };

      const dataCleaner = this.agents.get("data-cleaner");
      if (!dataCleaner) throw new Error("数据清洗Agent未找到");

      const cleanResult = await dataCleaner.receiveTask(cleaningTask);
      if (!cleanResult.success) {
        throw new Error(`数据清洗失败: ${cleanResult.error}`);
      }

      // 3. 情感分析阶段
      const analysisTask: Task = {
        id: `analyze-${Date.now()}`,
        type: "ANALYZE_SENTIMENT",
        data: cleanResult.data,
      };

      const sentimentAnalyzer = this.agents.get("sentiment-analyzer");
      if (!sentimentAnalyzer) throw new Error("情感分析Agent未找到");

      const analysisResult = await sentimentAnalyzer.receiveTask(analysisTask);
      if (!analysisResult.success) {
        throw new Error(`情感分析失败: ${analysisResult.error}`);
      }

      console.log("[主协调器] 新闻处理流水线完成");

      return {
        taskId: task.id,
        success: true,
        data: {
          url: task.data.url,
          processedItems: analysisResult.data.items,
          totalItems: analysisResult.data.items.length,
          pipeline: {
            collected: collectResult.processingTime,
            cleaned: cleanResult.processingTime,
            analyzed: analysisResult.processingTime,
          },
        },
        processingTime: 0,
      };
    } catch (error) {
      console.error(`[主协调器] 处理失败:`, error);
      return {
        taskId: task.id,
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
        processingTime: 0,
      };
    }
  }

  // 获取所有Agent状态
  getAllAgentsStatus() {
    const status: Record<string, any> = {};
    for (const [key, agent] of this.agents) {
      status[key] = agent.getInfo();
    }
    return status;
  }
}

// ==================== 原型测试系统 ====================

class SubagentPrototypeSystem {
  private master: MasterCoordinatorAgent;

  constructor() {
    this.master = new MasterCoordinatorAgent();
  }

  // 运行单个测试
  async runSingleTest(testUrl: string) {
    console.log("\n=== 开始单个新闻处理测试 ===");
    console.log(`测试URL: ${testUrl}`);

    const task: Task = {
      id: `test-${Date.now()}`,
      type: "PROCESS_NEWS_PIPELINE",
      data: { url: testUrl },
    };

    const result = await this.master.receiveTask(task);

    console.log("\n=== 测试结果 ===");
    if (result.success) {
      console.log("✅ 测试成功");
      console.log(`处理时间: ${result.processingTime}ms`);
      console.log(`处理新闻数量: ${result.data.totalItems}`);
      console.log("流水线耗时:", result.data.pipeline);

      // 显示处理后的新闻示例
      if (result.data.processedItems.length > 0) {
        const sample = result.data.processedItems[0];
        console.log("\n--- 处理结果示例 ---");
        console.log(`标题: ${sample.title}`);
        console.log(
          `情感: ${sample.sentiment.label} (${sample.sentiment.score})`
        );
        console.log(`字数: ${sample.wordCount}`);
      }
    } else {
      console.log("❌ 测试失败");
      console.log(`错误: ${result.error}`);
    }

    return result;
  }

  // 运行并发测试
  async runConcurrentTest(testUrls: string[]) {
    console.log("\n=== 开始并发处理测试 ===");
    console.log(`并发数量: ${testUrls.length}`);

    const startTime = Date.now();
    const promises = testUrls.map((url) => this.runSingleTest(url));

    try {
      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      console.log("\n=== 并发测试总结 ===");
      console.log(`总耗时: ${totalTime}ms`);
      console.log(`成功数量: ${results.filter((r) => r.success).length}`);
      console.log(`失败数量: ${results.filter((r) => !r.success).length}`);

      return results;
    } catch (error) {
      console.error("并发测试失败:", error);
      return [];
    }
  }

  // 显示系统状态
  showSystemStatus() {
    console.log("\n=== 系统状态 ===");
    const status = this.master.getAllAgentsStatus();

    for (const [agentType, info] of Object.entries(status)) {
      console.log(`${agentType}: ${info.status} (队列: ${info.queueLength})`);
    }
  }

  // 运行完整演示
  async runFullDemo() {
    console.log("🚀 启动Subagent原型演示系统");

    // 显示初始状态
    this.showSystemStatus();

    // 单个测试
    await this.runSingleTest("https://example.com/tech-news.xml");

    // 等待一下
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 并发测试
    await this.runConcurrentTest([
      "https://example.com/business-news.xml",
      "https://example.com/finance-news.xml",
      "https://example.com/tech-news.xml",
    ]);

    // 显示最终状态
    this.showSystemStatus();

    console.log("\n✨ 原型演示完成！");
  }
}

// ==================== 使用示例 ====================

// 创建并运行原型系统
const prototypeSystem = new SubagentPrototypeSystem();

// 运行演示
prototypeSystem.runFullDemo().catch(console.error);

// 你也可以单独测试各个功能：
// prototypeSystem.runSingleTest('https://test-rss-url.com').then(console.log);
// prototypeSystem.showSystemStatus();
