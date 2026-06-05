# External AI Acceptance

这份文档给另一个 AI、接入工程师或产品仓库 reviewer 使用。目标不是验证真实业务正确性，而是确认一个干净项目只依赖公开 release manifest 就能接上桌面底座。

## Inputs

稳定接入先读 release package manifest：

```text
https://github.com/k2safe/desktop-foundation/releases/download/v0.1.36/foundation-packages.json
```

然后读取 manifest 里的：

- `consumer.dependencies`
- `consumer.devDependencies`
- `consumer.pnpm`
- `consumer.cargo.dependency`
- `capabilities.url`

`capabilities.url` 指向同一 release 的 `foundation-capabilities.json`。外部 AI 必须用这份 registry 理解能力边界，不要只靠 README 猜。

## Acceptance Commands

在一个 monorepo 外的新目录运行：

```bash
pnpm install
pnpm exec desktop-foundation-ci --integration-check --integration-summary --integration-report artifacts/foundation-integration.json
pnpm build
pnpm upload:smoke
```

底座仓库自带等价 smoke：

```bash
make smoke-external-release VERSION=0.1.36
```

发版前还可以用本地 artifacts 验证尚未上传的 tarball：

```bash
pnpm pack:packages
pnpm smoke:external-ai-demo -- --local-artifacts
```

## Pass Criteria

必须满足：

- `package.json` 和 `pnpm-lock.yaml` 不包含 `workspace:`、`link:`、`file:` 或本地 monorepo 路径。
- `foundation-packages.json` 里 5 个 `@desktop-foundation/*` 包版本一致。
- `foundation-capabilities.json` 的 `foundationVersion` 等于 package manifest 版本。
- `desktop-foundation-ci` 的 `summary.fail = 0`。
- `desktop-foundation-ci` 的 `capabilities.summary.fail = 0`。
- `pnpm build` 通过。
- `pnpm upload:smoke` 能验证 `FormData -> multipart/form-data; boundary=... -> mock server 收到字段和文件`。

## Warn Handling

`artifacts/foundation-integration.json` 里的每个 capability item 都会包含：

- `status`
- `phase`
- `disposition`
- `recommendation`
- `checks`

外部 AI 的处理规则：

| Disposition | Meaning |
| --- | --- |
| `must-fix` | 必须修，不能继续迁移业务页面。 |
| `fix-or-explain-before-handoff` | handoff 前修掉，或在交付说明里解释为什么暂时可接受。 |
| `required-for-tauri` | Tauri 桌面包发版前必须修；纯 web/headless demo 可说明跳过。 |
| `required-for-networked-products` | 接真实 API、上传、下载前必须修；demo mock 可说明边界。 |
| `fix-before-release` | 发桌面 release 前修掉，或给出产品-owned release plan。 |
| `fix-before-real-business` | 接真实业务数据前修掉，或说明产品有自定义实现。 |
| `document-if-used` | 只有产品使用该能力时才需要补策略。 |
| `ready` | 当前接入阶段已满足。 |

## Report Template

外部 AI 交付时给出这段即可：

```text
Foundation manifest:
Capability registry:
Package source:
Commands:
- pnpm install:
- pnpm exec desktop-foundation-ci --integration-check --integration-summary:
- pnpm build:
- pnpm upload:smoke:

Integration summary:
- findings: <pass/warn/fail>
- capabilities: <pass/warn/fail>

Warn decisions:
- <capability id>: <disposition> - <fixed / accepted because / follow-up owner>
```

## Business Boundary

这个验收只证明底座能力链路可接。真实业务仍必须单独验收：

- 业务 API 和权限模型
- 后端 multipart parser 和对象存储
- 审计日志上报和 PII 策略
- release signing、notarization、rollout
- product signing, notarization, rollout policy, and any custom native updater adapter that replaces `df_update_install`
- 真实菜单、路由、字段字典和多语言 copy
