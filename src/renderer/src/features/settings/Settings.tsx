import { useEffect, useState, type ReactNode } from 'react'
import {
  Building2,
  Database,
  Download,
  Info,
  Palette,
  ReceiptText,
  RefreshCw,
  Save,
  Trash2,
  Upload
} from 'lucide-react'
import { Badge, Button, Field, Input, Kbd, Modal, Select, Textarea, Toggle } from '../../components/ui'
import { ImageUpload } from '../../components/ImageUpload'
import { useSettings, useTheme } from '../../stores/settings'
import { useScanner } from '../../stores/scanner'
import { toast } from '../../stores/toasts'
import { errMessage } from '../../lib/errors'
import { cn } from '../../lib/cn'
import type { AppSettings } from '../../../../shared/types'

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'JPY', 'CAD', 'AUD', 'SGD', 'PKR', 'BDT', 'LKR', 'NPR']

type Section = 'business' | 'billing' | 'preferences' | 'data' | 'about'

const sections: { id: Section; label: string; icon: typeof Building2 }[] = [
  { id: 'business', label: 'Business profile', icon: Building2 },
  { id: 'billing', label: 'Billing & tax', icon: ReceiptText },
  { id: 'preferences', label: 'Preferences', icon: Palette },
  { id: 'data', label: 'Data & backup', icon: Database },
  { id: 'about', label: 'About & shortcuts', icon: Info }
]

export function Settings() {
  const [section, setSection] = useState<Section>('business')
  const settings = useSettings((s) => s.settings)

  return (
    <div className="flex h-full">
      <aside className="w-60 shrink-0 border-r border-app-border bg-app-surface p-3">
        {sections.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSection(id)}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
              section === id
                ? 'bg-brand/10 text-brand'
                : 'text-app-muted hover:bg-app-surface2 hover:text-app-text'
            )}
          >
            <Icon style={{ width: 18, height: 18 }} />
            {label}
          </button>
        ))}
      </aside>

      <div className="min-w-0 flex-1 overflow-y-auto p-8 scrollbar-thin">
        <div className="mx-auto max-w-2xl">
          {section === 'business' && <BusinessPanel settings={settings} />}
          {section === 'billing' && <BillingPanel settings={settings} />}
          {section === 'preferences' && <PreferencesPanel settings={settings} />}
          {section === 'data' && <DataPanel />}
          {section === 'about' && <AboutPanel />}
        </div>
      </div>
    </div>
  )
}

function SectionCard({
  title,
  description,
  children
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-app-border bg-app-surface p-6">
      <h2 className="text-base font-semibold text-app-text">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-app-muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </div>
  )
}

function BusinessPanel({ settings }: { settings: AppSettings | null }) {
  const update = useSettings((s) => s.update)
  const [form, setForm] = useState({
    business_name: '',
    owner_name: '',
    phone: '',
    email: '',
    address: ''
  })
  const [logo, setLogo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!settings) return
    setForm({
      business_name: settings.business_name,
      owner_name: settings.owner_name,
      phone: settings.phone,
      email: settings.email,
      address: settings.address
    })
    setLogo(settings.logo)
  }, [settings])

  async function save() {
    setBusy(true)
    try {
      await update({ ...form, logo })
      toast.success('Profile saved')
    } catch (e) {
      toast.error('Could not save', errMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <SectionCard title="Business profile" description="Shown on invoices and receipts">
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-app-muted">Logo</p>
          <ImageUpload value={logo} onChange={setLogo} square={false} size={96} label="Upload logo" />
        </div>
        <Field label="Business name">
          <Input
            value={form.business_name}
            onChange={(e) => setForm({ ...form, business_name: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Owner name">
            <Input
              value={form.owner_name}
              onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
            />
          </Field>
          <Field label="Phone">
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              inputMode="tel"
            />
          </Field>
        </div>
        <Field label="Email">
          <Input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            inputMode="email"
          />
        </Field>
        <Field label="Address">
          <Textarea
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            rows={2}
          />
        </Field>
        <div className="flex justify-end">
          <Button onClick={save} loading={busy}>
            <Save style={{ width: 16, height: 16 }} />
            Save changes
          </Button>
        </div>
      </div>
    </SectionCard>
  )
}

function BillingPanel({ settings }: { settings: AppSettings | null }) {
  const update = useSettings((s) => s.update)
  const [currency, setCurrency] = useState('INR')
  const [taxRate, setTaxRate] = useState('0')
  const [footer, setFooter] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!settings) return
    setCurrency(settings.currency)
    setTaxRate(String(settings.tax_rate))
    setFooter(settings.receipt_footer)
  }, [settings])

  async function save() {
    setBusy(true)
    try {
      await update({
        currency,
        tax_rate: Number(taxRate) || 0,
        receipt_footer: footer
      })
      toast.success('Billing settings saved')
    } catch (e) {
      toast.error('Could not save', errMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <SectionCard title="Billing & tax" description="Currency and tax applied to every sale">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Currency">
            <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tax rate (%)" hint="0 for no tax">
            <Input
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value.replace(/[^0-9.]/g, ''))}
              inputMode="decimal"
            />
          </Field>
        </div>
        <Field label="Receipt footer text">
          <Textarea
            value={footer}
            onChange={(e) => setFooter(e.target.value)}
            rows={2}
            placeholder="Thank you for your business!"
          />
        </Field>
        <div className="flex justify-end">
          <Button onClick={save} loading={busy}>
            <Save style={{ width: 16, height: 16 }} />
            Save changes
          </Button>
        </div>
      </div>
    </SectionCard>
  )
}

function PreferencesPanel({ settings }: { settings: AppSettings | null }) {
  const update = useSettings((s) => s.update)
  const theme = useTheme((s) => s.theme)
  const setTheme = useTheme((s) => s.setTheme)
  const devices = useScanner((s) => s.devices)
  const setActiveDevice = useScanner((s) => s.setActiveDevice)
  const [sens, setSens] = useState('1200')

  useEffect(() => {
    if (settings) setSens(String(settings.scanner_sensitivity))
  }, [settings])

  return (
    <div className="space-y-4">
      <SectionCard title="Appearance">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-app-text">Dark mode</p>
            <p className="text-xs text-app-faint">Use a dark color scheme</p>
          </div>
          <Toggle
            checked={theme === 'dark'}
            onChange={(v) => setTheme(v ? 'dark' : 'light')}
          />
        </div>
      </SectionCard>

      <SectionCard title="Camera & scanner">
        <div className="space-y-4">
          <Field label="Camera device">
            <Select
              value={settings?.camera_device_id ?? ''}
              onChange={(e) => {
                const id = e.target.value || null
                setActiveDevice(id)
                void update({ camera_device_id: id })
              }}
            >
              {devices.length ? (
                devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label || `Camera ${d.id.slice(0, 6)}`}
                  </option>
                ))
              ) : (
                <option value="">No camera detected</option>
              )}
            </Select>
          </Field>
          <Field label="Scanner sensitivity (ms)" hint="Debounce delay between identical scans">
            <Input
              value={sens}
              onChange={(e) => {
                setSens(e.target.value.replace(/[^0-9]/g, ''))
                const v = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0
                void update({ scanner_sensitivity: Math.max(300, v) })
              }}
              inputMode="numeric"
            />
          </Field>
        </div>
      </SectionCard>
    </div>
  )
}

function DataPanel() {
  const [busy, setBusy] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)

  async function backup() {
    setBusy(true)
    try {
      const path = await window.api.files.backup()
      if (path) toast.success('Backup created', 'Database saved successfully')
    } catch (e) {
      toast.error('Backup failed', errMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function restore() {
    setBusy(true)
    try {
      const ok = await window.api.files.restore()
      if (ok) {
        toast.success('Database restored', 'Reloading…')
        setTimeout(() => window.location.reload(), 1200)
      }
    } catch (e) {
      toast.error('Restore failed', errMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <SectionCard title="Backup & restore" description="Your data is stored locally in a SQLite database">
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={backup} disabled={busy}>
            <Download style={{ width: 16, height: 16 }} />
            Back up database
          </Button>
          <Button variant="secondary" onClick={restore} disabled={busy}>
            <Upload style={{ width: 16, height: 16 }} />
            Restore from file
          </Button>
        </div>
        <p className="mt-3 text-xs text-app-faint">
          Restoring replaces the current database with the selected file.
        </p>
      </SectionCard>

      <SectionCard title="Danger zone">
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-app-border p-4">
            <div>
              <p className="text-sm font-medium text-app-text">Load demo data</p>
              <p className="text-xs text-app-faint">Replace everything with sample data</p>
            </div>
            <Button variant="outline" onClick={() => {
              window.api.db.loadDemo().then(() => {
                toast.success('Demo data loaded', 'Reloading…')
                setTimeout(() => window.location.reload(), 900)
              })
            }}>
              <RefreshCw style={{ width: 16, height: 16 }} />
              Load demo
            </Button>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-danger/30 p-4">
            <div>
              <p className="text-sm font-medium text-danger">Clear all data</p>
              <p className="text-xs text-app-faint">Permanently delete products, sales and customers</p>
            </div>
            <Button variant="danger" onClick={() => setClearOpen(true)}>
              <Trash2 style={{ width: 16, height: 16 }} />
              Clear all
            </Button>
          </div>
        </div>
      </SectionCard>

      <ClearDataModal open={clearOpen} onClose={() => setClearOpen(false)} />
    </div>
  )
}

function ClearDataModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  async function confirm() {
    if (text !== 'DELETE') return
    setBusy(true)
    try {
      await window.api.db.clearAll()
      toast.success('All data cleared')
      setTimeout(() => window.location.reload(), 900)
    } catch (e) {
      toast.error('Could not clear data', errMessage(e))
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Clear all data?"
      description="This permanently deletes everything and cannot be undone"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirm} disabled={text !== 'DELETE'} loading={busy}>
            Delete everything
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-app-muted">
          Type <strong className="text-danger">DELETE</strong> to confirm.
        </p>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="DELETE"
          autoFocus
        />
      </div>
    </Modal>
  )
}

function AboutPanel() {
  const [version, setVersion] = useState('1.0.0')
  useEffect(() => {
    window.api.app.version().then(setVersion).catch(() => {})
  }, [])

  const shortcuts: [string, string][] = [
    ['F1', 'Focus New Sale'],
    ['F2', 'Add a product'],
    ['Ctrl / ⌘ + P', 'Print last invoice'],
    ['Esc', 'Close dialogs'],
    ['Enter', 'Look up customer phone']
  ]

  return (
    <div className="space-y-4">
      <SectionCard title="About">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-indigo-500 text-white shadow-lg shadow-brand/30">
            <span className="text-2xl font-bold">C</span>
          </div>
          <div>
            <p className="text-lg font-bold text-app-text">Clerkk</p>
            <p className="text-sm text-app-muted">Inventory Management & Barcode POS</p>
            <Badge variant="brand" className="mt-1">
              v{version}
            </Badge>
          </div>
        </div>
        <p className="mt-4 text-sm text-app-muted">
          Offline-first desktop POS. All data is stored locally in SQLite. No internet required.
        </p>
      </SectionCard>

      <SectionCard title="Keyboard shortcuts">
        <div className="divide-y divide-app-border">
          {shortcuts.map(([key, desc]) => (
            <div key={key} className="flex items-center justify-between py-2.5">
              <span className="text-sm text-app-muted">{desc}</span>
              <Kbd>{key}</Kbd>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}
