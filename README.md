# xxz-math

数学教学辅助网站首版：

- 图形实验室：可调整长方形、三角形、圆与扇形、圆柱与圆锥；
- 知识点库：公共知识树；老师登录后切换姐姐 / Crystal 与弟弟 / Gavin，分别查看交接教学基线、下一动作和我们的实测掌握状态。

数学错题不进入网站。Stella 拍照并说明错题后，由 Codex 在 Material Hub 中归档、分析，并按需要制作错题集或举一反三。

## 本地运行

```powershell
npm test
npm run serve
```

后端未部署时保持 `config.js` 的 `apiBase: ""`。页面会显示“只读 · 未连接”，不会读取或写入学生状态。API 地址可以公开，但教师 PIN、verifier、pepper、会话密钥和 Supabase service-role key 都不得进入前端或 Git。

## 数据来源

从 Material Hub 动态生成只含通用知识的公开快照；导入器读取知识目录与教材主序，按源目录实际长度处理，不固定知识点或章节数量：

```powershell
node scripts/import-material-hub-data.mjs D:\xxz-work\projects\xxz-material-hub\math
```

快照只保留知识点标题、教材公开标题、章节名与知识点顺序，不包含学生身份、本地教材路径、交接基线、教学状态、掌握状态或证据。未进入教材主序的条目在页面中归入“衔接与补充”；学生私有状态只在老师登录后由教师 API 读取。

## 安全设计

`server/` 保存本地可测试的教师 API 参考实现：单一 4 位 PIN 由服务端使用不可逆 verifier 校验，错误尝试受限，成功后签发最长 15 分钟的会话。私有状态使用 `math_student_progress_v1`，教学状态写入走独立 `math_*` RPC。

当前没有 Supabase 迁移、真实 PIN 或生产配置；生产审计、迁移、密钥设置、写入和部署均为独立审批门禁。详见 `docs/teacher-api.md`。

## 本地检查

```powershell
npm test
node --check js/api.js
node --check js/knowledge.js
node --check server/teacher-api.mjs
```
