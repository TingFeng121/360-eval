# 360度评价管理系统 / 360-Degree Evaluation System

> 开源项目 | Open Source Project

[中文](#中文) | [English](#english)

---

## 中文

### 项目简介

这是一个基于 Vue.js + Element Plus + Supabase 构建的360度员工评价管理系统。系统支持自评、互评和领导评价三种评价类型，帮助企业完成绩效考核。

### 功能特性

- **自评 (Self Evaluation)**: 员工对自己的工作表现进行评价
- **互评 (Peer Evaluation)**: 同事之间相互评价
- **领导评价 (Leader Evaluation)**: 上级对下属进行评价
- **任务管理**: 创建、分配、追踪评价任务
- **题库管理**: 支持多维度题目配置
- **权重配置**: 自定义各类评价的权重
- **数据汇总**: 自动计算最终评分

### 技术栈

- **前端框架**: Vue.js 3 + Vite
- **UI 组件**: Element Plus
- **后端/数据库**: Supabase (PostgreSQL)
- **部署平台**: Cloudflare Pages

### 本地开发

#### 环境要求

- Node.js 18+
- npm 或 yarn

#### 安装步骤

```bash
# 克隆项目
git clone https://github.com/TingFeng121/360-eval.git
cd 360-eval

# 安装依赖
npm install

# 创建本地环境变量文件
# 复制 .env.example 为 .env.local，填入你的 Supabase 配置
cp .env.example .env.local

# 启动开发服务器
npm run dev
```

#### 环境变量配置

在 `.env.local` 文件中配置以下变量：

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

这些变量可以从 [Supabase Dashboard](https://supabase.com/dashboard) 获取。

### 部署到 Cloudflare Pages

#### 方式一：GitHub 自动部署（推荐）

1. 将代码推送到 GitHub
2. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
3. 进入 **Workers & Pages** → **创建应用程序** → **Pages** → **连接到 Git**
4. 选择你的 GitHub 仓库
5. 配置构建设置：
   - **构建命令**: `npm run build`
   - **构建输出目录**: `dist`
6. 在 Pages 设置中添加环境变量：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
7. 保存并部署

#### 方式二：手动部署

```bash
# 构建项目
npm run build

# 将 dist 文件夹内容上传到 Cloudflare Pages
```

### 目录结构

```
360-eval/
├── src/
│   ├── api/           # API 调用
│   ├── components/    # 公共组件
│   ├── styles/        # 样式文件
│   ├── views/         # 页面组件
│   ├── App.vue        # 根组件
│   ├── main.js        # 入口文件
│   └── supabase.js    # Supabase 配置
├── public/            # 静态资源
├── .env.example       # 环境变量模板
├── .gitignore         # Git 忽略配置
├── supabase-setup.sql # 数据库初始化脚本
└── package.json       # 项目配置
```

### 数据库初始化

部署前需要先创建数据库表结构。运行 `supabase-setup.sql` 脚本：

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 进入你的项目 → **SQL Editor**
3. 新建查询，复制 `supabase-setup.sql` 全部内容粘贴
4. 点击 **Run** 执行

详细说明请参考 [supabase-setup.sql](supabase-setup.sql) 文件。

### 使用指南

#### 1. 登录系统

默认管理员账号：`admin` / `admin123`

#### 2. 创建评价任务

1. 进入 **任务管理** 页面
2. 点击 **新建任务**
3. 选择评价类型（自评/互评/领导评）
4. 选择被评价人和评价人
5. 点击保存

#### 3. 完成评价

1. 在首页查看待评价任务
2. 点击 **去评价** 进入评价页面
3. 对照题目进行打分
4. 提交评价

### 评分计算规则

#### 权重配置

系统支持三种评价类型的权重配置（默认权重可在此调整）：

| 评价类型 | 默认权重 | 说明 |
|---------|---------|------|
| 自评 (Self) | 20% | 员工对自己的评价 |
| 互评 (Peer) | 30% | 同事之间的评价 |
| 领导评 (Leader) | 50% | 上级对下属的评价 |

#### 评分计算公式

**最终总分 = 各评价类型得分的加权平均**

```
总分 = (自评得分 × 自评权重 + 互评得分 × 互评权重 + 领导评得分 × 领导评权重)
       ÷ (实际有数据的评价类型权重之和)
```

#### 计算示例

假设当前权重配置为：自评 20%、互评 30%、领导评 50%

| 评价类型 | 实际得分 | 权重 | 加权得分 |
|---------|---------|------|---------|
| 自评 | 85 分 | 20% | 17 分 |
| 互评 | 90 分 | 30% | 27 分 |
| 领导评 | 80 分 | 50% | 40 分 |
| **总分** | - | **100%** | **84 分** |

#### 特殊情况处理

- **缺少某类评价时**：只计算有数据的类型，权重自动重新归一化
  - 例如：只有自评(85分，权重20%)和领导评(80分，权重50%)
  - 总分 = (85×20 + 80×50) / (20 + 50) = 81.43 分

- **互评多人时**：先计算每个评价人的平均分，再对所有评价人求平均
  - 例如：3人互评，得分分别为 85、90、95
  - 互评最终得分 = (85 + 90 + 95) / 3 = 90 分

#### 维度得分计算

各评价维度（能力项）单独计算得分，公式与总分相同，最终得分也是加权平均。

### Excel 导出功能

系统支持导出员工的完整评价数据为 Excel 文件，包含以下内容：

#### 导出内容

| 工作表 | 说明 |
|--------|------|
| 自评明细 | 员工自评各维度详细得分 |
| 他评明细 | 同事评价各维度详细得分 |
| 领导评明细 | 领导评价各维度详细得分 |
| 汇总雷达 | 汇总表格 + 能力雷达图 |

#### 汇总表结构

| 列名 | 说明 |
|------|------|
| 维度 | 能力评估维度名称 |
| 自评 | 该维度自评得分 |
| 他评 | 该维度他评平均得分 |
| 领导评 | 该维度领导评得分 |
| 综合得分 | 加权平均得分 |

#### 雷达图

- 显示员工各维度综合得分的雷达图
- 维度名称旁显示对应得分（绿色数字）
- 蓝色半透明蒙版显示得分区域

### License

MIT License

---

## English

### Introduction

A 360-degree employee evaluation management system built with Vue.js + Element Plus + Supabase. The system supports three evaluation types: self-evaluation, peer evaluation, and leader evaluation, helping organizations with performance reviews.

### Features

- **Self Evaluation**: Employees evaluate their own work performance
- **Peer Evaluation**: Colleagues evaluate each other
- **Leader Evaluation**: Supervisors evaluate subordinates
- **Task Management**: Create, assign, and track evaluation tasks
- **Question Bank**: Multi-dimensional question configuration
- **Weight Configuration**: Customize evaluation weights
- **Data Summary**: Automatic score calculation

### Tech Stack

- **Frontend**: Vue.js 3 + Vite
- **UI Components**: Element Plus
- **Backend/Database**: Supabase (PostgreSQL)
- **Deployment**: Cloudflare Pages

### Local Development

#### Requirements

- Node.js 18+
- npm or yarn

#### Installation

```bash
# Clone the repository
git clone https://github.com/TingFeng121/360-eval.git
cd 360-eval

# Install dependencies
npm install

# Create local environment file
# Copy .env.example to .env.local and fill in your Supabase config
cp .env.example .env.local

# Start development server
npm run dev
```

#### Environment Variables

Configure these variables in `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Get these from your [Supabase Dashboard](https://supabase.com/dashboard).

### Deploy to Cloudflare Pages

#### Method 1: GitHub Auto-Deploy (Recommended)

1. Push code to GitHub
2. Login to [Cloudflare Dashboard](https://dash.cloudflare.com/)
3. Go to **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
4. Select your GitHub repository
5. Configure build settings:
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
6. Add environment variables in Pages settings:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
7. Save and deploy

#### Method 2: Manual Deploy

```bash
# Build project
npm run build

# Upload dist folder contents to Cloudflare Pages
```

### Project Structure

```
360-eval/
├── src/
│   ├── api/           # API calls
│   ├── components/    # Shared components
│   ├── styles/        # Style files
│   ├── views/         # Page components
│   ├── App.vue        # Root component
│   ├── main.js        # Entry point
│   └── supabase.js    # Supabase config
├── public/            # Static assets
├── .env.example       # Environment template
├── .gitignore         # Git ignore file
└── package.json       # Project config
```

### User Guide

#### 1. Login

Default admin account: `admin` / `admin123`

#### 2. Create Evaluation Task

1. Go to **Task Management** page
2. Click **New Task**
3. Select evaluation type (Self/Peer/Leader)
4. Select evaluatee and evaluator
5. Click Save

#### 3. Complete Evaluation

1. View pending tasks on dashboard
2. Click **Evaluate** to enter evaluation page
3. Rate according to questions
4. Submit evaluation

### Scoring Calculation Rules

#### Weight Configuration

The system supports weight configuration for three evaluation types (default weights can be adjusted):

| Evaluation Type | Default Weight | Description |
|----------------|----------------|-------------|
| Self Evaluation | 20% | Employee's self-assessment |
| Peer Evaluation | 30% | Evaluation between colleagues |
| Leader Evaluation | 50% | Supervisor's evaluation of subordinates |

#### Scoring Formula

**Final Score = Weighted Average of All Evaluation Type Scores**

```
Total Score = (Self Score × Self Weight + Peer Score × Peer Weight + Leader Score × Leader Weight)
              ÷ (Sum of weights for evaluation types with data)
```

#### Calculation Example

Assuming current weights: Self 20%, Peer 30%, Leader 50%

| Evaluation Type | Score | Weight | Weighted Score |
|----------------|-------|--------|----------------|
| Self | 85 | 20% | 17 |
| Peer | 90 | 30% | 27 |
| Leader | 80 | 50% | 40 |
| **Total** | - | **100%** | **84** |

#### Special Cases

- **Missing Evaluation Type**: Only calculate types with data, weights are automatically re-normalized
  - Example: Only Self (85, weight 20%) and Leader (80, weight 50%)
  - Total = (85×20 + 80×50) / (20 + 50) = 81.43

- **Multiple Peer Evaluators**: First calculate average score for each evaluator, then average all evaluators
  - Example: 3 peer evaluators, scores are 85, 90, 95
  - Peer Final Score = (85 + 90 + 95) / 3 = 90

#### Dimension Score Calculation

Each evaluation dimension (competency) is calculated separately using the same weighted average formula.

### Excel Export

The system supports exporting employee evaluation data to Excel files with the following contents:

#### Export Contents

| Worksheet | Description |
|-----------|-------------|
| Self Evaluation | Employee's self-evaluation dimension scores |
| Peer Evaluation | Colleague evaluation dimension scores |
| Leader Evaluation | Supervisor evaluation dimension scores |
| Summary Radar | Summary table + Competency radar chart |

#### Summary Table Structure

| Column | Description |
|--------|-------------|
| Dimension | Competency evaluation dimension name |
| Self | Self-evaluation score for this dimension |
| Peer | Average peer evaluation score |
| Leader | Leader evaluation score |
| Total Score | Weighted average score |

#### Radar Chart

- Displays radar chart of employee's comprehensive scores by dimension
- Score displayed next to dimension name (green numbers)
- Blue semi-transparent overlay shows scoring area

### License

MIT License
