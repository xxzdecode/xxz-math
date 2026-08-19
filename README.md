# xxz-math

数学教学辅助网站：

- 图形实验室：滑杆与数字输入联动，图中标注边、角、顶点、高、半径等概念；覆盖长方形、三角形、圆与扇形、圆柱与圆锥、角、平行四边形和梯形；
- 知识点库：支持搜索、年级/领域/教材位置筛选和详情阅读；老师登录后切换姐姐 / Crystal 与弟弟 / Gavin，分别查看交接教学基线、下一动作、我们的教学状态和实测掌握状态。

数学错题不进入网站。Stella 拍照并说明错题后，由 Codex 在 Material Hub 中归档、分析，并按需要制作错题集或举一反三。

## 本地运行

```powershell
npm test
npm run serve
```

后端未部署时保持 `config.js` 的 `apiBase: ""`。页面会显示“只读 · 未连接”，不会读取或写入学生状态。API 地址可以公开，但教师 PIN、verifier、pepper、会话密钥和 Supabase service-role key 都不得进入前端或 Git。首次点击老师入口时在网站中输入并确认 4 位 PIN；以后直接用该 PIN 登录，后台只保存不可逆 verifier。

## 数据来源

从 Material Hub 动态生成只含通用知识的公开快照；导入器读取知识目录与教材主序，按源目录实际长度处理，不固定知识点或章节数量：

```powershell
node scripts/import-material-hub-data.mjs D:\xxz-work\projects\xxz-material-hub\math
```

快照只保留知识点标题、教材公开标题、章节名与知识点顺序，不包含学生身份、本地教材路径、交接基线、教学状态、掌握状态或证据。未进入教材主序的条目在页面中归入“衔接与补充”；学生私有状态只在老师登录后由教师 API 读取。

## 安全设计

`server/` 保存本地可测试的教师 API 参考实现：单一 4 位 PIN 由服务端使用不可逆 verifier 校验，错误尝试受限，成功后签发最长 15 分钟的会话。生产 Edge Function 支持一次性网页设密，verifier 写入仅 service-role 可见的 `math_teacher_auth_v1`；私有状态使用 `math_student_progress_v1`，教学状态写入走独立 `math_*` RPC。

当前仓库已有 Supabase 迁移与 Edge Function 源码，但尚无真实 PIN 或生产配置，也不代表迁移已经执行。详见 `docs/teacher-api.md`。

`supabase/` 中提供独立 `math_*` 迁移与 Edge Function 源码；它们只有在正式执行迁移、设置 secrets、完成首次网页设密、初始化私有进度并配置 `apiBase` 后才会生效。真实 PIN、verifier、pepper、会话密钥和 service-role key 不进入 Git。

## 本地检查

```powershell
npm test
node --check js/api.js
node --check js/knowledge.js
node --check server/teacher-api.mjs
```
