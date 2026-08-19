# 知识点教师 API 契约与安全接入方案

本文件是尚未部署的本地设计，不代表 Supabase 已创建表、RPC、数据或密码。

## 边界

教师 API 只服务双学生知识点私有状态：读取交接基线、我们的教学状态和实测掌握状态；写操作只允许修改我们的教学状态。网站不提供数学卷批改、错题录入、题号映射或自动薄弱分析。

公共 `data/knowledge-catalog.json` 随静态站点发布。学生身份、交接基线、教学状态、掌握状态和证据不进入静态包。

## 安全结构

```text
静态数学网站
  -> HTTPS Edge Function / math-teacher-api
       -> 服务端校验教师会话
       -> 仅服务端持有 service-role 权限
       -> 读取/更新数学知识状态私有存储
```

- 使用一个 4 位数字 PIN，无用户名。
- PIN 不进入 Git、静态配置、数据库明文、日志、错误信息或分析事件。
- verifier 与高熵 pepper 分开保存为部署 secret；本地参考实现使用 PBKDF2-SHA256、随机 salt 和常量时间比较。
- 按来源和时间窗限制连续错误尝试。成功后签发 `aud=math-teacher-api`、最长 15 分钟、不可刷新的签名会话。
- 前端只在 `sessionStorage` 保存会话令牌；私有响应使用 `Cache-Control: no-store`。
- CORS 只允许确认后的正式 origin 与明确的本地开发 origin，不使用 `*`。

本地 `PinRateLimiter` 只适合单进程验证。多实例生产限流必须使用平台能力或 `math_teacher_rate_limit_v1` 原子持久化设计。

## `math_*` 隔离

首版只需要：

- `math_student_progress_v1`：双学生交接、教学和实测状态；
- `math_set_teaching_status_v1`：只更新 `teaching_status` 的服务端 RPC；
- `math_teacher_rate_limit_v1`：仅在生产限流需要落库时使用。

生产实施前必须只读审计现有 Supabase 表、RLS、策略和函数权限。不要直接把数学私有 key 放进存在宽松 anon 策略的英语 `kv_store`。仓库当前不保存或执行迁移草案。

## 状态语义

教师模式同时展示两层，不能把任意数量的 `mastery_status=unverified` 简化成“全部为 0”或“全部通用”。目录数量由 Material Hub 动态导入，不设固定上限：

- `reported_taught -> introduced_needs_review -> scheduled_review_or_diagnostic`：显示“已接触但不扎实，待复习核验”；下一动作是“旧题复习 / 诊断”。
- `reported_needs_reinforcement -> treat_as_new_instruction -> full_reteach_then_workbook`：教学安排按“完全没学过”处理；下一动作是“完整新授 + 对应《一课一练》”。
- `not_reported -> not_introduced_by_handoff -> full_instruction_then_workbook`：显示“交接未提及，按新课处理”；下一动作是“完整新授 + 对应《一课一练》”。
- 两者的实测掌握都仍是 `unverified / 待核验`，不能显示成已掌握。
- `stable` 与 `reinforce` 必须由 Material Hub 中可追溯的照片、诊断题或课堂证据流程更新，网页不能直接写入。

## 接口

### `POST /auth`

请求只接受 4 位 PIN。成功返回短期签名令牌和过期时间；失败使用统一错误消息，连续失败返回 `429`。

### `GET /teacher/progress`

返回以下安全字段：`student_id`、`knowledge_id`、`handoff_status`、`teaching_status`、`mastery_status`。不返回证据 ID、照片路径、教师诊断或其他私有材料。

### `PUT /teacher/progress/:student_id/:knowledge_id`

请求只接受 `teaching_status`：`not_recorded`、`learning` 或 `taught_by_us`。服务端 RPC 必须验证学生与知识点存在，并只改这一字段；不能修改交接基线、掌握状态或证据。

## 生产门禁

生产实施必须另行批准：只读审计 Supabase 与 RLS -> 确认私有存储 -> 创建迁移/Edge Function -> 设置 secrets 与 PIN verifier -> 写入首批 `math_*` 状态 -> 配置正式 API -> 本地与线上验收。
