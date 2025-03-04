# 🃏 Blackjack 在线游戏（仅供学习用途）

[English Version](#-blackjack-online-game-for-learning-purposes)

本项目是一个多人在线 **Blackjack（21点）** 游戏，基于 **Flask + Socket.IO + JavaScript** 实现。支持实时多人交互、下注、庄家自动换位、特殊边注（压爆、压对）等功能。

⚠️ **免责声明：** 本项目仅供学习和技术交流使用，**不支持赌博**，不涉及任何真实资金交易。开发者不对任何因使用该项目造成的法律或经济后果负责。

---

## 📌 功能特色

- **多人在线对战**：基于 WebSocket 实现低延迟实时交互
- **完整的 Blackjack 逻辑**：包括要牌、停牌、加倍、投降等
- **自动庄家系统**：庄家每 6 轮自动轮换
- **边注支持**：
  - **压爆（Bao）**：预测庄家会爆牌
  - **压对（Dui）**：预测前两张牌为对子
- **环形牌桌 UI**：玩家按座位顺序排列，自己始终在正下方
- **移动端适配**：支持手机浏览，自动调整 UI
- **游戏规则**：21点 Blackjack 规则 + 额外的 side bet

---

## 🚀 技术栈

- **后端**：Python、Flask、Flask-SocketIO
- **前端**：HTML、CSS、JavaScript（Vanilla JS）
- **实时通信**：WebSocket（Socket.IO）
- **数据库**：无持久化存储（游戏状态存储在内存）

---

## 📂 目录结构

```plaintext
📁 blackjack-game
│── 📂 static            # 静态资源（JS、CSS、图片）
│   ├── 📂 imgs/cards    # 牌面图片（SVG格式）
│   ├── main.js         # 前端核心逻辑（牌桌、交互）
│── 📂 templates         # HTML 模板文件
│   ├── index.html      # 游戏主界面
│── 📂 game_logic        # 游戏逻辑模块
│   ├── blackjack_game.py  # 21点核心逻辑（玩家、庄家、下注等）
│── app.py              # Flask 服务器 + WebSocket 事件处理
│── README.md           # 本说明文档
│── requirements.txt    # 依赖库清单
