# AI 请求日志与 Evaluation 指南

本项目未使用 LangChain，AI 请求通过统一日志记录，便于用任意评估平台或自建脚本做 evaluation。

## 1. 日志位置与格式

- **文件**：`backend/logs/ai-requests.log`
- **格式**：JSONL（每行一个 JSON 对象）
- **空字段**：不输出，避免 `videoId= error=` 等无意义键值对

示例一行（创作助手对话）：

```json
{"ts":"2026-03-05T08:52:52.971Z","type":"CHAT","userId":"u1","message":"请提取这个视频的脚本","messageLen":12,"historyLen":4,"success":true,"response":"根据视频内容整理如下脚本...","responseLen":120}
```

失败时会有 `error` 字段，无 `response`。

## 2. 日志类型与用途

| type | 用途 | 可评估字段 |
|------|------|------------|
| CHAT | 创作助手单轮对话 | message, response, success, videoId |
| MULTI_ANALYSIS | 多视频分析 | request, response, success |
| VIDEO_ANALYSIS | 单视频 Gemini 分析 | success, duration, segmentsCount, error |
| YOUTUBE_ANALYSIS | YouTube 导入的 Gemini 分析 | success, duration, segmentsCount, error |

## 3. 不依赖 LangChain 的 Evaluation 方式

### 方式一：Promptfoo（推荐）

[Promptfoo](https://www.promptfoo.dev/) 支持用「输入/输出」对做评测，不依赖 LangChain。

1. 从日志中筛出 `type=CHAT` 的行，转为 Promptfoo 的 test case 格式（或直接用 JSONL）。
2. 在项目里加 `promptfooconfig.yaml`，用「输入 = message、期望/实际输出 = response」做断言或 LLM-as-judge。

示例：将 CHAT 日志转为 Promptfoo 的用例：

```bash
# 只取 CHAT 且 success=1 的行，得到 input/output 对
cat backend/logs/ai-requests.log | jq -c 'select(.type=="CHAT" and .success==true) | {input: .message, output: .response}' > eval-chat.jsonl
```

再用 Promptfoo 的 [dataset 配置](https://www.promptfoo.dev/docs/configuration/datasets/) 指向该文件做评测。

### 方式二：Braintrust / LangSmith 等平台

- **Braintrust**：可用 [API 或 CSV 导入](https://www.braintrust.dev/) 非 LangChain 的 run；把每条 CHAT 当作一次 experiment run，传入 message、response、metadata（如 videoId）。
- **LangSmith**：支持 [非 LangChain 的 trace](https://docs.smith.langchain.com/)；可写脚本读取 JSONL，用 SDK 上报为 trace，在 Smith 里做对比和评分。

### 方式三：自建脚本（LLM-as-judge 或规则）

1. 解析 `ai-requests.log`（按行 `JSON.parse`）。
2. 筛出 `type === 'CHAT'` 且 `success === true` 的条目。
3. 对每条调用另一个 LLM（或规则）对 `message` / `response` 打分（相关性、有用性、安全性等），或与人工标注对比，算准确率/一致性。

示例（Node 脚本读取并过滤 CHAT）：

```js
const fs = require('fs');
const lines = fs.readFileSync('backend/logs/ai-requests.log', 'utf-8').trim().split('\n');
const chats = lines
  .map(l => { try { return JSON.parse(l); } catch { return null; } })
  .filter(r => r && r.type === 'CHAT' && r.success);
console.log(JSON.stringify(chats, null, 2));
```

## 4. 统计与监控

- **成功率**：`type=CHAT` 且 `success=true` 条数 / 总 CHAT 条数。
- **视频分析**：`VIDEO_ANALYSIS` / `YOUTUBE_ANALYSIS` 的 `success`、`duration`、`segmentsCount`、`error` 做聚合或告警。

可直接用 jq 或脚本对 `backend/logs/ai-requests.log` 做统计，无需依赖 LangChain 或特定框架。
