# 动动健身 🤖

基于 [vladmandic/human](https://github.com/vladmandic/human)（MoveNet 姿态估计）的儿童律动健身 Web App。
孩子站在摄像头前，跟着卡通机器人教练「动动」做动作——骨骼关键点实时匹配打分。
参考 beKids Fitness 的体验：模仿动作 / 节奏运动 / 闯关游戏。

## 玩法（三种模式）

| 模式 | 路由 | 说明 |
|---|---|---|
| 🗺️ 闯关冒险 | `#/map` | 3 章节 × 3 关，每关 4–6 组动作，1–3 星评价，进度存 localStorage |
| 🙌 模仿动作 | `#/play?a=bothHandsUp&m=hold` | 动动示范 → 孩子模仿并保持（相似度环 + 保持条） |
| 🎵 节奏运动 | `#/play?a=jump&m=beat` | WebAudio 节拍，PERFECT/GOOD/MISS + 连击加分 |

进入任何游戏前先做 3 秒**身高校准**（站直不动），跳跃/侧步/下蹲等位移类动作以此为基准。

## 技术架构

```
src/
├── pose/          纯函数姿态引擎（可单测）
│   ├── geometry.ts    关节角度/仰角/躯干归一化
│   ├── actions.ts     13 个动作模板 + 加权相似度评分
│   └── calibration.ts 站立参考校准（中位数 + 稳定性）
├── camera/        PosePipeline：human.load → getUserMedia → 每帧 detect → PoseFrame
├── coach/         卡通教练「动动」（Canvas 2D，位置关键帧插值 + 表情）
├── session.ts     游戏会话状态机（demo→hold / countin→beat，时钟注入可无头测试）
├── levels.ts      关卡数据 + 星级 + localStorage 进度
├── audio.ts       WebAudio 程序化音效/节拍（无外部音频文件）
└── ui/            hash 路由 + 5 个屏幕 + 撒花
```

**姿态匹配原理**：MoveNet 17 关键点 → 关节角度（肩-肘-腕、髋-膝-踝等）+ 躯干倍数位移量 →
与动作模板加权平均 → 0–100 相似度。低置信度关键点自动剔除，体型/位置通过归一化消除。

## 运行

```bash
npm install
npm run dev        # http://localhost:5173（摄像头需 HTTPS 或 localhost）
npm test           # vitest（62 个测试）
npm run build      # 类型检查 + 生产构建
```

自测页：`#/camtest`（相机+骨架实时演示）、`#/coach`（教练动作循环演示）。

## 注意

- 模型已内置在 `public/models/`（构建后在 `dist/models/`），首次启动无需外部 CDN；加载成功后走 IndexedDB 缓存
- 只启用 body（MoveNet lightning），face/hand/object/segmentation/gesture 全部关闭（human 库默认 face.enabled=true，加载失败会触发 `model.inputs` 崩溃，必须显式关闭）
- 摄像头画面完全本地处理，不上传
- 建议 iPad / 桌面浏览器 + 前置摄像头，距镜头 1.5–2 米
- 移动端 Safari 需 iOS 16.4+（WebGL2）；性能不足时可把
  `src/camera/pipeline.ts` 的 `targetWidth` 调小（416 → 288）

## 隐私

所有推理在浏览器本地完成；摄像头帧与姿态数据不离开设备。
仅关卡星级进度保存在本地 localStorage。
