# 基础镜像
FROM node:20-alpine AS base

# 配置中国国内镜像源
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories && \
    echo "https://mirrors.aliyun.com/alpine/v3.19/main" > /etc/apk/repositories && \
    echo "https://mirrors.aliyun.com/alpine/v3.19/community" >> /etc/apk/repositories

# 配置npm国内镜像源
RUN npm config set registry https://registry.npmmirror.com && \
    npm config set disturl https://npmmirror.com/mirrors/node

# 配置pip国内镜像源
RUN pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple && \
    pip config set global.trusted-host pypi.tuna.tsinghua.edu.cn

# 安装必要的系统依赖
RUN apk add --no-cache \
    python3 \
    py3-pip \
    redis \
    sqlite \
    dumb-init

# 设置工作目录
WORKDIR /app

# 复制package文件
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 创建必要的目录
RUN mkdir -p data logs

# 设置环境变量
ENV NODE_ENV=production
ENV LOG_LEVEL=info

# 暴露端口
EXPOSE 3000 3001

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# 启动命令
CMD ["dumb-init", "node", "dist/index.js"]