# Foundation Capabilities

这份文档是桌面底座能力总表。给人读时看下面的能力边界；给外部 AI 或产品 CI 读时，以机器可读清单为准：

```text
packages/create-desktop-app/foundation-capabilities.json
```

打包后，`pnpm pack:packages` 会把同一份清单复制到：

```text
artifacts/npm/foundation-capabilities.json
```

`artifacts/npm/foundation-packages.json` 也会包含 `capabilities.url`，产品项目只需要先读取 package manifest，就能继续发现能力清单。

## Registry Contract

能力清单的核心字段：

```json
{
  "schemaVersion": 1,
  "foundationVersion": "0.1.33",
  "capabilities": [
    {
      "id": "i18n",
      "phase": "recommended",
      "owner": "shared",
      "status": "stable",
      "integrationChecks": {
        "required": [],
        "recommended": ["i18n", "i18n:missing-key", "i18n:formatters"]
      }
    }
  ]
}
```

- `phase`: 接入阶段。`required` 必须接；`recommended` 建议在真实业务前接；`recommended-before-release` 发版前接；`optional` 按业务需要接。
- `owner`: `foundation` 表示底座主责，`shared` 表示底座提供入口、产品负责策略或后端。
- `integrationChecks.required`: 这些 finding 出现 fail 时，该能力为 fail；出现 warn 或缺失时，该能力为 warn。
- `integrationChecks.recommended`: 这些 finding 非 pass 时，该能力为 warn。

## Capability Matrix

| Capability | Phase | Owner | Product Boundary |
| --- | --- | --- | --- |
| Package Consumption | required | foundation | 产品复制 manifest 里的依赖块和 pnpm overrides；底座只发布 tarball 和 manifest。 |
| App Shell | required | foundation | 产品维护路由、页面和接口路径；底座维护 Provider 和 shell 契约。 |
| Theme And Layout | required | foundation | 产品维护品牌、菜单、布局模板和 token；不要复制底座源码或覆盖内部选择器。 |
| Login Shell | recommended | foundation | 产品维护认证字段、MFA、登录接口和错误文案。 |
| Access Control | recommended | shared | 产品维护真实权限模型和后端鉴权；底座只做前端入口隐藏和守卫。 |
| I18n | recommended | shared | 产品维护业务文案、字段字典、币种、时区和语言 rollout。 |
| Errors And Request State | recommended | foundation | 产品维护业务错误码和业务补救文案。 |
| Audit Events | recommended | shared | 产品维护日志存储、保留周期、PII 策略和审计上报服务。 |
| HTTP And Upload | required-for-networked-products | foundation | 产品维护 endpoint、auth、后端 multipart 解析、对象存储和上传留存规则。 |
| Desktop Core | required-for-tauri | foundation | 产品维护平台签名、额外权限、图标、bundle id 和 native plugin 选择。 |
| Updates | recommended-before-release | shared | 产品维护 release hosting、签名、公证和灰度策略；底座提供默认 `df_update_install`，产品可在需要官方 signed updater 或定制流程时覆盖 adapter。 |
| Link Proxy | optional | shared | 产品维护允许访问的 proxy/target origin，并区分业务 API 和第三方链接请求。 |
| UI Overflow Guardrails | recommended | foundation | 产品维护页面组合和表格列定义；底座提供可复用的滚动安全组件。 |
| CI And Release | recommended-before-release | shared | 产品维护 CI provider、签名密钥、发布审批和 artifact 上传。 |

## CI Output

`desktop-foundation-ci --integration-check` 会继续输出原有 `findings`，同时把 registry 映射成 `capabilities`：

```json
{
  "summary": { "status": "warn", "pass": 31, "warn": 8, "fail": 0 },
  "capabilities": {
    "summary": { "status": "warn", "pass": 9, "warn": 5, "fail": 0 },
    "items": [
      {
        "id": "updates",
        "status": "warn",
        "disposition": "fix-before-release",
        "recommendation": "Resolve before publishing a desktop release or explicitly record the product-owned release plan.",
        "checks": [
          { "id": "updates", "required": false, "status": "warn" }
        ]
      }
    ]
  }
}
```

外部 AI 的处理顺序：

1. 先看 `summary.fail` 和 `findings`，修所有 fail。
2. 再看 `capabilities.summary`，确认哪些底座能力还处在 warn。
3. 对每个 warn 能力，按 `disposition` 和 `recommendation` 决定现在修、发版前修，还是记录产品边界。
4. 按 `checks` 回到 finding id 和 docs 修复。
5. 真业务上线前，对 `recommended-before-release` 能力逐项确认。

## Demo Boundary

当前底座只能用 demo 验证“接入形状”和“本地能力链路”：

- `examples/demo-product` 验证 AppShell、theme、login、access、i18n、audit、updates UI、table/overlay、HTTP mock。
- `pnpm smoke:capabilities` 或 `pnpm exec desktop-foundation smoke --report artifacts/foundation-smoke.json` 验证 bridge public API、adapter 边界、安全白名单、更新安装 dry-run 和 diagnostics。
- `pnpm smoke:multipart` 验证 FormData 和 Tauri bridge multipart 序列化。
- `pnpm smoke:external-ai-demo` 验证干净项目只通过 manifest 消费 tarball 后仍能 install、integration-check、build 和 mock upload。

真实业务仍必须用自己的后端、对象存储、权限模型、日志服务、发布仓库和签名链路做最终验收。
