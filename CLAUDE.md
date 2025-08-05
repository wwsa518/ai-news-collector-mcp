# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This repository contains the development documentation for an **AI News Collector & Analysis System** (AI新闻事件智能采集与分析系统). The repository currently contains only comprehensive development documentation in Chinese, with no actual source code implementation.

## Project Purpose

This project aims to build a private, lightweight, and scalable news event intelligent collection and analysis service for:
- Individual investors
- Quantitative researchers
- Intelligence analysts

## Key Architecture Information

### Technology Stack (Planned)
- **Frontend/Runtime**: Node.js 20 LTS with TypeScript 5.0+
- **Backend**: Python 3.11 with FastAPI
- **Databases**: SQLite (default), PostgreSQL/TiDB (production)
- **Cache**: Redis 7.0+
- **Vector Storage**: Chroma 0.4+ or Qdrant 1.0+
- **Message Queue**: BullMQ
- **ML/NLP**: spaCy 3.7, transformers 4.35, FinBERT

### Core Architecture Pattern
- **Hybrid Language Architecture**: TypeScript for data collection/interfaces, Python for processing/analysis
- **Microservices**: Collector, Processor, Analyzer services
- **Event-driven**: Message queue-based async processing
- **Layered Architecture**: Clear separation of concerns

### Main Components (Planned)
1. **Data Collection Layer**: RSS, web scraping, API interfaces
2. **Data Processing Layer**: Cleaning, entity recognition, event extraction
3. **Analysis Service Layer**: Sentiment analysis, risk detection, event aggregation
4. **Interface Service Layer**: MCP Server, REST API
5. **Storage Layer**: Database, cache, vector storage

## Current Repository State

**Status**: Documentation-only repository
- Contains comprehensive development documentation in Chinese
- No source code implementation present
- Ready for implementation based on the detailed specifications

## Key Features (Planned)

### Data Collection
- RSS/Atom feed collection
- Web scraping with Puppeteer
- API data source integration
- Configurable scheduling (second/minute/hour intervals)
- Fault tolerance and retry mechanisms

### Data Processing
- HTML cleaning and content extraction
- Entity recognition (stock codes, company names)
- Event extraction (subject-action-object triples)
- Standardization of time formats and geographic info

### Analysis Services
- Sentiment analysis with scoring (-1 to 1)
- Risk detection and alerting
- Event aggregation and pattern matching
- Statistical metrics calculation

### System Management
- Dynamic route configuration management
- Health monitoring and alerting
- Complete logging and audit trails
- Performance optimization

## Performance Targets (from documentation)
- **Processing latency**: <30ms per news item
- **End-to-end delay**: <30 seconds (95th percentile)
- **Concurrent connections**: 10+ connections
- **System availability**: 99.9%
- **Data integrity**: 99.99%

## File Structure (Planned)
```
ai-news-collector/
├── src/                    # TypeScript source code
│   ├── api/               # API services
│   ├── collector/         # Data collection
│   ├── processing/        # Data processing
│   ├── mcp/              # MCP server
│   ├── storage/          # Storage services
│   └── types/            # Type definitions
├── python_src/            # Python source code
│   ├── analyzer/         # Analysis services
│   ├── processor/        # Data processing
│   └── utils/            # Utilities
├── tests/                # Test suite
├── data/                 # Data storage
└── docs/                 # Documentation
```

## Common Commands (when implemented)
```bash
# Development
npm install                    # Install dependencies
npm run dev                    # Start development server
npm test                      # Run tests
npm run build                  # Build for production

# Deployment
./deploy.sh start             # Start all services
./deploy.sh start mcp         # Start with MCP server
./deploy.sh backup            # Create backup
./deploy.sh restore           # Restore from backup
```

## Environment Variables (Required)
- `OPENAI_API_KEY`: OpenAI API key (required for AI features)
- `NODE_ENV`: Environment mode (development/production)
- `DATABASE_TYPE`: Database type (sqlite/postgres)
- `REDIS_HOST`: Redis server host
- `LOG_LEVEL`: Logging level

## MCP Server Integration
The system plans to provide MCP (Model Context Protocol) server integration for Claude Desktop with tools for:
- News query with filtering (keyword, time, sentiment)
- Risk alert monitoring
- Real-time news streaming
- System status monitoring

## Development Notes
- This is currently a specification document, not an implemented system
- The documentation provides comprehensive technical specifications
- Implementation should follow the detailed architecture outlined in the Chinese documentation
- Focus on performance, scalability, and real-time processing requirements