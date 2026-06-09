# 🏥 放射科影像标注系统

Radiology Annotation System - 三甲医院放射科在线影像标注与教学系统

## 📋 项目概述

本系统为三甲医院放射科住院医生提供在线 DICOM 影像标注功能，支持科研和教学场景。医生可在自己的笔记本上通过浏览器查看和标注影像，无需抢占 PACS 主机工位。

### 技术栈

**后端:**
- Python 3.10+
- FastAPI - 高性能 Web 框架
- Pydantic - 数据验证
- pydicom - DICOM 影像处理
- NumPy - 数值计算
- Pillow - 图像处理
- python-jose + passlib - JWT 认证和密码加密

**前端:**
- React 18 + Vite
- Cornerstone.js - DICOM 医学影像渲染
- antd (Ant Design) - UI 组件库
- Zustand - 状态管理
- Axios - HTTP 客户端
- RecordRTC - 屏幕录制

**数据存储:**
- 内存字典存储（重启清空，每日从 PACS 重新同步）
- DICOM 文件存储在本地文件系统
- 路径映射在内存中

---

## 🏗️ 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                        前端 (React)                        │
│  ┌──────────┐  ┌─────────────┐  ┌───────────────────┐  │
│  │ 登录/权限 │  │ 检查列表页   │  │   影像查看器页    │  │
│  └──────────┘  └─────────────┘  └───────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Cornerstone.js (DICOM 浏览器端渲染)               │  │
│  │  - 窗宽窗位  - 测量工具  - 标注工具  - MPR        │  │
│  └───────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────┘
                             │ REST API (/api/*)
                             ▼
┌─────────────────────────────────────────────────────────┐
│                      后端 (FastAPI)                       │
│  ┌─────────┐  ┌────────┐  ┌──────────┐  ┌───────────┐  │
│  │  认证    │  │ 检查   │  │  序列    │  │   影像     │  │
│  └─────────┘  └────────┘  └──────────┘  └───────────┘  │
│  ┌──────────────┐  ┌────────┐  ┌───────────────────┐   │
│  │   标注模块    │  │  报告  │  │  PACS同步/管理统计 │   │
│  └──────────────┘  └────────┘  └───────────────────┘   │
│  ┌───────────────────────────────────────────────────┐  │
│  │              内存数据存储 (InMemoryDB)            │  │
│  │  users | patients | studies | series | images     │  │
│  │  annotations | reports | image_locks              │  │
│  └───────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ DICOM 文件系统   │
                    │  (本地存储)     │
                    └─────────────────┘
```

---

## ✨ 核心功能

### 1. PACS 同步
- ✅ 按 Modality 分目录扫描（CT、MRI、CR、DX、US）
- ✅ **按 StudyInstanceUID（DICOM tag 全球唯一标识）归类**，而非文件名
- ✅ 按患者 ID 遍历所有模态目录
- ✅ 缺失模态报告机制（不静默跳过）
- ✅ 启动时自动同步，支持手动重新同步

### 2. 影像查看
- ✅ DICOM 格式标准医学影像
- ✅ **单帧按需加载**（500 张切片不会一次性加载卡死浏览器）
- ✅ Cornerstone.js 浏览器端渲染
- ✅ 滚轮切换上下张
- ✅ 8 套窗宽窗位预设一键切换：
  - 肺窗 (WW:1500, WC:-600)
  - 纵隔窗 (WW:400, WC:40)
  - 骨窗 (WW:2500, WC:300)
  - 脑窗 (WW:80, WC:35)
  - 软组织窗 (WW:350, WC:50)
  - 腹部窗 (WW:400, WC:40)
  - 脊柱窗 (WW:1500, WC:200)
  - 默认窗位

### 3. 测量工具
- ✅ 直线测距
- ✅ 椭圆测面积
- ✅ 角度测量
- ✅ **CT 值（HU）实时显示**（鼠标位置的 HU 值，十字线位置实时更新）

### 4. 标注功能
- ✅ 矩形标注
- ✅ 椭圆标注
- ✅ 箭头标注
- ✅ 自由曲线标注
- ✅ 文字标签备注
- ✅ **四大分类**：结节、肿块、钙化、可疑淋巴
- ✅ 标注完成弹出分类选择浮层
- ✅ **标注坐标存原始 DICOM 像素坐标**（非屏幕坐标，跨分辨率一致）
- ✅ 标注数据 JSON 格式，包含：坐标、标签、标注医生、时间

### 5. MPR 多平面重建
- ✅ 三视图布局：轴位、冠位、矢位
- ✅ 三视图联动滚动
- ✅ 十字线定位联动
- ✅ 每个视图独立窗宽窗位

### 6. 悲观锁机制
- ✅ 先到先得式锁定
- ✅ 他人锁定时只读模式 + 提示「张医生正在标注」
- ✅ 解锁后其他人刷新可见新标注
- ✅ 标注状态机：待审核 → 已接受 / 已拒绝
- ✅ **被拒绝的标注从影像消失但保留在历史记录可追溯**

### 7. 教学功能
- ✅ 导出标注好的切片为 PNG
- ✅ **录制操作过程为 MP4/WebM**
- ✅ **Page Visibility API 检测**：切到后台时提示「切到后台会影响录制质量」

### 8. 统计管理
- ✅ 每位医生标注量统计
- ✅ 标注准确率（驳回率）统计
- ✅ 标注量排名
- ✅ 驳回率排名

### 9. 用户角色系统
- 👨‍⚕️ **医生 (doctor)**：查看影像、标注
- 👨‍⚕️ **审核员/主任 (reviewer)**：医生全部权限 + 审核接受/拒绝标注 + 查看统计
- 🔐 **管理员 (admin)**：全部权限 + 用户管理 + PACS 同步

### 10. 时间序列对比
- ✅ 左右分屏对比两次检查
- ✅ **按物理尺寸缩放显示**（基于 PixelSpacing DICOM tag）
- ✅ 不同层厚扫描正确对齐（5mm vs 1mm 不直接像素叠加）
- ✅ 同步/独立模式切换

---

## 📁 项目结构

```
5411-go-contract/
├── backend/                          # 后端 FastAPI
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                   # 应用入口
│   │   ├── config.py                 # 配置管理
│   │   ├── models.py                 # 数据模型 (Pydantic)
│   │   ├── database.py               # 内存数据库
│   │   ├── auth.py                   # JWT 认证 + 角色权限
│   │   ├── dicom_utils.py            # DICOM 工具函数
│   │   ├── pacs_sync.py              # PACS 同步逻辑
│   │   └── routers/                  # API 路由
│   │       ├── __init__.py
│   │       ├── auth.py               # 认证接口
│   │       ├── study.py              # 检查接口
│   │       ├── series.py             # 序列接口
│   │       ├── image.py              # 影像接口 + 悲观锁
│   │       ├── annotation.py         # 标注接口 + 审核
│   │       ├── report.py             # 报告接口
│   │       ├── sync.py               # PACS 同步接口
│   │       └── admin.py              # 管理员统计接口
│   ├── run.py                        # 启动脚本
│   ├── requirements.txt              # Python 依赖
│   └── .env.example                  # 环境变量示例
│
├── frontend/                         # 前端 React + Vite
│   ├── src/
│   │   ├── main.jsx                  # 应用入口
│   │   ├── App.jsx                   # 主应用 + 路由
│   │   ├── services/
│   │   │   └── api.js                # Axios 实例
│   │   ├── store/                    # Zustand 状态管理
│   │   │   ├── auth.js               # 认证状态
│   │   ├── viewer.js               # 查看器状态
│   │   │   └── annotation.js         # 标注状态
│   │   ├── components/               # 组件
│   │   │   ├── CornerstoneViewer.jsx # DICOM 查看器
│   │   │   ├── MPRViewer.jsx         # MPR 三视图
│   │   │   ├── AnnotationLabelPopup.jsx # 标注分类弹窗
│   │   │   └── TimeSeriesComparison.jsx # 时间序列对比
│   │   ├── pages/                    # 页面
│   │   │   ├── LoginPage.jsx         # 登录页
│   │   │   ├── StudyListPage.jsx     # 检查列表页
│   │   │   ├── ViewerPage.jsx        # 影像查看器页
│   │   │   └── AdminStatsPage.jsx    # 管理员统计页
│   │   ├── layouts/
│   │   │   └── MainLayout.jsx        # 主布局
│   │   ├── hooks/                    # 自定义 Hooks
│   │   │   ├── useScreenRecorder.js  # 屏幕录制
│   │   │   └── useImageExport.js     # 图片导出
│   │   ├── utils/
│   │   │   └── cornerstone.js        # Cornerstone 工具常量
│   │   └── styles/
│   │       └── global.css            # 全局样式
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── .env.example
│
└── PROMPT.txt                        # 需求文档
```

---

## 🚀 快速开始

### 环境变量配置

**后端 (`backend/.env`):**
```env
PORT=8000
PACS_DIR=./pacs_data
DICOM_STORAGE_DIR=./dicom_storage
SECRET_KEY=your-secret-key-here-change-in-production
ACCESS_TOKEN_EXPIRE_MINUTES=1440
```

**前端 (`frontend/.env`):**
```env
VITE_PORT=5173
VITE_API_BASE_URL=http://localhost:8000
```

### 启动后端

```bash
cd backend
pip install -r requirements.txt
python run.py
```

后端服务启动在 `http://localhost:8000`

API 文档: `http://localhost:8000/docs`

### 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端服务启动在 `http://localhost:5173`

### 测试账号

| 用户名 | 密码 | 角色 | 说明 |
|--------|------|------|------|
| admin | secret123 | 管理员 | 全部权限 |
| wang | secret123 | 审核员 | 主任审核权限 |
| zhang | secret123 | 医生 | 普通标注权限 |
| li | secret123 | 医生 | 普通标注权限 |

---

## 🔌 API 接口

### 认证
- `POST /api/auth/login` - 登录
- `GET /api/auth/me` - 获取当前用户

### 检查 (Study)
- `GET /api/studies` - 检查列表（按检查时间倒序）
- `GET /api/studies/{study_uid}` - 检查详情
- `GET /api/studies/{study_uid}/patient` - 检查的患者信息
- `GET /api/studies/patient/{patient_id}` - 患者的所有检查

### 序列 (Series)
- `GET /api/series/{series_uid}` - 序列详情
- `GET /api/series/study/{study_uid}` - 检查的序列列表

### 影像 (Image)
- `GET /api/images/{image_uid}` - 影像信息
- `GET /api/images/{image_uid}/dicom` - DICOM 文件
- `GET /api/images/{image_uid}/pixeldata` - 像素数据原始字节流
- `GET /api/images/series/{series_uid}` - 序列的影像列表
- `GET /api/images/{image_uid}/lock` - 获取锁状态
- `POST /api/images/{image_uid}/lock` - 获取锁
- `POST /api/images/{image_uid}/unlock` - 释放锁

### 标注 (Annotation)
- `GET /api/annotations/image/{image_uid}` - 影像标注列表
- `GET /api/annotations/series/{series_uid}` - 序列标注列表
- `GET /api/annotations/study/{study_uid}` - 检查标注列表
- `GET /api/annotations/me` - 我的标注
- `GET /api/annotations/{annotation_id}` - 标注详情
- `POST /api/annotations` - 创建标注
- `PUT /api/annotations/{annotation_id}` - 更新标注
- `DELETE /api/annotations/{annotation_id}` - 删除标注
- `POST /api/annotations/{id}/accept` - 接受标注（审核员）
- `POST /api/annotations/{id}/reject` - 拒绝标注（审核员）
- `GET /api/annotations/history/image/{image_uid}` - 标注历史（含被拒绝的）

### 报告 (Report)
- `GET /api/reports/study/{study_uid}` - 检查的报告列表
- `POST /api/reports` - 创建报告
- `PUT /api/reports/{report_id}` - 更新报告
- `DELETE /api/reports/{report_id}` - 删除报告

### 同步
- `POST /api/sync` - 从 PACS 同步（管理员/审核员）
- `POST /api/sync/generate-mock` - 生成模拟数据并同步（管理员）

### 管理
- `GET /api/admin/stats/overview` - 总体统计概览
- `GET /api/admin/stats/annotation-volume` - 标注量/驳回率排名
- `GET /api/admin/users` - 用户列表（管理员）

---

## 💡 关键设计细节

### 1. DICOM 归类：按 StudyInstanceUID，而非文件名

> **问题**：PACS 的 DICOM 文件名规则很乱，同一患者增强 CT 动脉期和静脉期文件名只差一个字母
> **解决方案**：后端读取 DICOM tag 中的 StudyInstanceUID（全球唯一标识）来归类
> **位置**：[pacs_sync.py](backend/app/pacs_sync.py) `sync_from_pacs()` 函数

### 2. 标注坐标：原始 DICOM 像素坐标，非屏幕坐标

> **问题**：不同医生屏幕分辨率不一样，存屏幕坐标换台电脑就对不上
> **解决方案**：所有标注坐标存储为原始 DICOM 像素坐标，渲染时再转换到画布
> **位置**：[annotation.py](backend/app/routers/annotation.py) + [cornerstone.js](frontend/src/utils/cornerstone.js)

### 3. 悲观锁 + 状态机

> **设计**：先锁的人画完之前其他人只读
> **状态流转**：待审核 (pending) → 已接受 (active) / 已拒绝 (rejected)
> **历史追溯**：被拒绝的标注从影像消失但保留在历史记录
> **位置**：[image.py](backend/app/routers/image.py) 锁接口 + [annotation.py](backend/app/routers/annotation.py) 审核接口

### 4. Page Visibility API

> **问题**：录制时浏览器标签页切后台会自动降帧/暂停
> **解决方案**：用 Page Visibility API 检测，切后台时显示警告横幅
> **位置**：[useScreenRecorder.js](frontend/src/hooks/useScreenRecorder.js)

### 5. 时间序列对比：物理尺寸缩放

> **问题**：5mm 层厚和 1mm 层厚的两次扫描像素 1:1 叠加会把结节大小看错
> **解决方案**：基于 PixelSpacing DICOM tag 计算物理尺寸，按物理比例缩放显示
> **位置**：[TimeSeriesComparison.jsx](frontend/src/components/TimeSeriesComparison.jsx)

### 6. 角色权限 UI 控制

> **设计**：主任审核驳回按钮只有审核员角色看得到
> **实现**：普通医生登录连按钮 UI 都不渲染，而非仅仅禁用
> **位置**：[ViewerPage.jsx](frontend/src/pages/ViewerPage.jsx) + [MainLayout.jsx](frontend/src/layouts/MainLayout.jsx)

---

## 📊 数据模型

### 核心实体关系

```
Patient (1) ──── (N) Study (1) ──── (N) Series (1) ──── (N) Image
                                                         │
                                                         └ (N) Annotation
                                                              │
                                                              └ Status: pending/active/rejected
```

### 主要字段

**Study (检查):**
- study_uid: 全球唯一标识
- patient_id: 患者 ID
- study_date/study_time: 检查时间
- modalities_in_study: 包含的模态
- series_uids: 序列列表
- sync_status: 同步状态 (completed/partial/failed)

**Annotation (标注):**
- annotation_id: 标注 ID
- image_uid / series_uid / study_uid: 关联影像
- annotation_type: rectangle/ellipse/arrow/freehand/text
- category: 结节/肿块/钙化/可疑淋巴
- points: 像素坐标点数组（原始 DICOM 坐标）
- status: pending/active/rejected
- created_by / created_by_name: 创建医生
- reviewed_by / review_comment: 审核信息

---

## 🔒 安全说明

- 所有 API（除登录外）都需要 Bearer Token 认证
- 密码使用 bcrypt 哈希存储
- 角色权限分层控制
- CORS 配置可按需调整

---

## 📝 注意事项

1. **数据持久化**：本设计使用内存存储，重启清空，符合「每天从 PACS 重新同步」的场景
2. **模拟数据**：首次启动会自动生成 5 位患者、每人 2 次检查的模拟 DICOM 数据，便于测试
3. **DICOM 加载**：使用 wadouri 协议单帧加载，避免一次性加载大量切片卡死浏览器
4. **录制格式**：浏览器端录制输出 WebM 格式，如需 MP4 需后端转码

---

## 🏥 真实工作流映射

| 放射科真实工作流 | 系统对应功能 |
|----------------|------------|
| 住院医生白天写报告 | 查看影像 + 标注 |
| 晚上做科研 | 标注数据导出 + 统计 |
| 教学演示 | PNG 导出 + 操作录制 |
| 主任审核 | 审核员接受/拒绝标注 |
| PACS 工位紧张 | 浏览器端查看，不占 PACS 主机 |
| 多人同看一张片 | 悲观锁 + 只读模式 |

---

## 📜 License

Internal use only.
