import "@desktop-foundation/ui-react/styles.css";
import { DesktopAppShell } from "@desktop-foundation/app-shell";
import { adminThemePreset } from "@desktop-foundation/theme-presets";
import {
  Button,
  Card,
  CardBody,
  Checkbox,
  Combobox,
  ContentPanel,
  DateRangePicker,
  Drawer,
  FormField,
  FormRow,
  FormSection,
  Input,
  Modal,
  PageHeader,
  PasswordInput,
  ProgressBar,
  RadioGroup,
  Select,
  SettingsSection,
  Switch,
  Tabs,
  Textarea,
  useDisclosure
} from "@desktop-foundation/ui-react";
import { useState } from "react";

export function App() {
  const modal = useDisclosure();
  const drawer = useDisclosure();
  const [tab, setTab] = useState("forms");
  const [range, setRange] = useState({});
  const [combo, setCombo] = useState("admin");

  return (
    <DesktopAppShell theme={adminThemePreset} client={{ product: "gallery", apiBaseURL: "http://127.0.0.1:8891" }}>
      <div style={{ minHeight: "100vh", padding: 24 }}>
        <PageHeader
          title="Component Gallery"
          description="Foundation UI components in one place."
          actions={
            <>
              <Button variant="outline" onClick={drawer.show}>Open drawer</Button>
              <Button onClick={modal.show}>Open modal</Button>
            </>
          }
        />
        <Tabs
          value={tab}
          onValueChange={setTab}
          items={[
            { value: "forms", label: "Forms" },
            { value: "layout", label: "Layout" }
          ]}
        />
        {tab === "forms" ? (
          <ContentPanel title="Forms" description="Inputs, pickers, and selectors.">
            <FormSection title="Account">
              <FormRow columns={2}>
                <Input label="Account" placeholder="admin" />
                <PasswordInput label="Password" placeholder="password" />
              </FormRow>
              <FormRow columns={2}>
                <Select label="Role" options={[{ value: "owner", label: "Owner" }, { value: "operator", label: "Operator" }]} />
                <Combobox
                  label="Preset"
                  value={combo}
                  onValueChange={setCombo}
                  options={[
                    { value: "admin", label: "Admin" },
                    { value: "merchant", label: "Merchant" },
                    { value: "dark", label: "Dark" }
                  ]}
                />
              </FormRow>
              <FormField label="Date range">
                <DateRangePicker value={range} onChange={setRange} />
              </FormField>
              <Textarea label="Notes" placeholder="Write something" />
              <Checkbox label="Remember preference" />
              <Switch label="Enable notifications" />
              <RadioGroup name="density" value="default" options={[{ value: "compact", label: "Compact" }, { value: "default", label: "Default" }]} />
            </FormSection>
          </ContentPanel>
        ) : (
          <SettingsSection title="Runtime" description="Reusable layout sections.">
            <Card>
              <CardBody>
                <ProgressBar value={72} />
              </CardBody>
            </Card>
          </SettingsSection>
        )}
        <Modal open={modal.open} title="Modal" onClose={modal.hide}>Reusable modal content.</Modal>
        <Drawer open={drawer.open} title="Drawer" onClose={drawer.hide}>Reusable drawer content.</Drawer>
      </div>
    </DesktopAppShell>
  );
}
