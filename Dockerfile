# 构建阶段
FROM node:20-alpine AS build

# 配置中国国内镜像源
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories && \
  echo "https://mirrors.aliyun.com/alpine/v3.19/main" > /etc/apk/repositories && \
  echo "https://mirrors.aliyun.com/alpine/v3.19/community" >> /etc/apk/repositories

# 安装 python3 和 pip
RUN apk add --no-cache python3 py3-pip

# 配置npm国内镜像源
RUN npm config set registry https://registry.npmmirror.com

# 配置pip国内镜像源
RUN pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple && \
  pip config set global.trusted-host pypi.tuna.tsinghua.edu.cn

# 安装必要的系统依赖
RUN apk add --no-cache \
  redis \
  sqlite \
  dumb-init

# 设置工作目录
WORKDIR /app

# 复制package文件
COPY package*.json ./

# 安装依赖
RUN npm install --only=production

# 全局安装 TypeScript
RUN npm install -g typescript

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 创建必要的目录
RUN mkdir -p /app/data /app/logs && chown -R node:node /app/data /app/logs

# 生产阶段
FROM node:20-alpine AS production

# 设置工作目录
WORKDIR /app

# 从构建阶段复制应用文件
COPY --from=build /app/dist /app/dist
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/package*.json /app/

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
