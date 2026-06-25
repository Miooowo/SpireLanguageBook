# 杀戮尖塔 · 描述学

《杀戮尖塔 2》卡牌描述标记语法参考、官方范例库与撰写规范指南。

## 在线访问

- **范例库**：https://miooowo.github.io/SpireLanguageBook/
- **撰写规范**：https://miooowo.github.io/SpireLanguageBook/guide.html

## 本地运行

```bash
python -m http.server 8080 --bind 127.0.0.1
```

或双击 `start-server.bat`，然后打开 http://127.0.0.1:8080/

## 目录结构

| 路径 | 说明 |
|------|------|
| `index.html` | 官方描述范例浏览、语法检索与统计 |
| `guide.html` | 玩家描述撰写规范与指南 |
| `zhs/` | 官方简体中文描述数据 |
| `js/parser.js` | 描述标记解析与渲染 |
