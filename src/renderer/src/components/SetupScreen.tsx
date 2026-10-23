import { useEffect, useRef, useState } from 'react'
import { CheckCircle, ChevronRight, FileText, Shield, User, Camera, Printer, Wifi } from 'lucide-react'
import { Button } from './ui'
import { cn } from '../lib/cn'

interface SetupScreenProps {
  onComplete: () => void
}

const TERMS_CONTENT = `
<h2 className="text-lg font-semibold text-app-text mb-3">Terms & Conditions</h2>

<div className="space-y-4 text-sm text-app-muted leading-relaxed">
  <div>
    <h3 className="font-medium text-app-text mb-2 flex items-center gap-2">
      <Camera className="h-4 w-4 text-brand" /> Camera & Scanner Access
    </h3>
    <p>This application requires access to your device's camera for barcode scanning functionality. The camera is used exclusively to scan product barcodes (EAN-13, UPC, QR codes, Code-128, etc.) at the point of sale. No images or video are recorded, stored, or transmitted. The camera feed is processed locally on your device only.</p>
  </div>

  <div>
    <h3 className="font-medium text-app-text mb-2 flex items-center gap-2">
      <Wifi className="h-4 w-4 text-brand" /> Network & Offline Operation
    </h3>
    <p>Clerkk is designed as an offline-first application. All data (products, customers, sales, settings) is stored locally in an encrypted SQLite database on your device. No data is sent to external servers unless you explicitly choose to export or backup your data. The application does not require an internet connection for normal operation.</p>
  </div>

  <div>
    <h3 className="font-medium text-app-text mb-2 flex items-center gap-2">
      <Printer className="h-4 w-4 text-brand" /> Printer Integration
    </h3>
    <p>When you choose to print invoices or reports, the application uses your system's native print dialog to send documents to your selected printer. Print jobs are handled by your operating system's print subsystem. No print data is stored or transmitted by the application.</p>
  </div>

  <div>
    <h3 className="font-medium text-app-text mb-2 flex items-center gap-2">
      <Shield className="h-4 w-4 text-brand" /> Data Privacy & Security
    </h3>
    <p>All business data remains on your device. The SQLite database uses WAL mode for performance and reliability. Backups are created only when you explicitly trigger them and are saved to a location you choose. The application does not include telemetry, analytics, or any form of user tracking.</p>
  </div>

  <div>
    <h3 className="font-medium text-app-text mb-2 flex items-center gap-2">
      <User className="h-4 w-4 text-brand" /> Software Information
    </h3>
    <p className="font-medium">Software Name:</p>
    <p>Clerkk — Inventory Management & Barcode POS</p>
    <p className="mt-2 font-medium">Company:</p>
    <p>Mirza Technologies</p>
    <p className="mt-2 font-medium">Created By:</p>
    <p>Mirza Aman</p>
    <p className="mt-2 font-medium">Version:</p>
    <p>1.0.0</p>
  </div>

  <div>
    <h3 className="font-medium text-app-text mb-2 flex items-center gap-2">
      <FileText className="h-4 w-4 text-brand" /> License
    </h3>
    <p>This software is provided under the MIT License. You are free to use, modify, and distribute this software subject to the license terms. The software is provided "as is" without warranty of any kind.</p>
  </div>
</div>
`

const PRIVACY_POLICY = `
<h2 className="text-lg font-semibold text-app-text mb-3">Privacy Policy</h2>

<div className="space-y-4 text-sm text-app-muted leading-relaxed">
  <p><strong>Effective Date:</strong> ${new Date().toLocaleDateString()}</p>

  <div>
    <h3 className="font-medium text-app-text mb-2">1. Information We Collect</h3>
    <p>Clerkk does not collect, transmit, or store any personal information on external servers. All data you enter (business details, products, customers, sales records) remains exclusively on your local device.</p>
  </div>

  <div>
    <h3 className="font-medium text-app-text mb-2">2. Camera Usage</h3>
    <p>The application accesses your device's camera solely for barcode scanning at the point of sale. Camera frames are processed in real-time using the html5-qrcode library. No images, video, or biometric data are captured, stored, or transmitted.</p>
  </div>

  <div>
    <h3 className="font-medium text-app-text mb-2">3. Local Data Storage</h3>
    <p>All data is stored in a local SQLite database (clerkk.db) within your user data directory. The database includes: business settings, product catalog, customer records, sales history, and activity logs. You have full control over this data.</p>
  </div>

  <div>
    <h3 className="font-medium text-app-text mb-2">4. Data Backup & Export</h3>
    <p>Backup and export functions are entirely user-initiated. When you create a backup, the database file is copied to a location you specify. When you export data (CSV, PDF), files are saved to your chosen destination. No automatic cloud sync or remote backup occurs.</p>
  </div>

  <div>
    <h3 className="font-medium text-app-text mb-2">5. Third-Party Services</h3>
    <p>This application does not integrate with any third-party analytics, crash reporting, or tracking services. All processing occurs locally.</p>
  </div>

  <div>
    <h3 className="font-medium text-app-text mb-2">6. Your Rights</h3>
    <p>You have complete control over your data. You can: view all stored data within the application, export data in standard formats (CSV, PDF), create encrypted backups, delete all data permanently, and uninstall the application at any time.</p>
  </div>

  <div>
    <h3 className="font-medium text-app-text mb-2">7. Changes to This Policy</h3>
    <p>Any updates to this privacy policy will be reflected in new versions of the application. Continued use constitutes acceptance of the updated policy.</p>
  </div>

  <div>
    <h3 className="font-medium text-app-text mb-2">8. Contact</h3>
    <p>For questions about this policy or the software, contact: Mirza Technologies — Created by Mirza Aman</p>
  </div>
</div>
`

export function SetupScreen({ onComplete }: SetupScreenProps) {
  const [step, setStep] = useState<'welcome' | 'terms' | 'policy'>('welcome')
  const [accepted, setAccepted] = useState(false)
  const [scrolledToBottom, setScrolledToBottom] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [setupComplete, setSetupComplete] = useState(false)

  // Check if already completed
  useEffect(() => {
    const done = localStorage.getItem('clerkk_setup_complete')
    if (done === 'true') {
      setSetupComplete(true)
      onComplete()
    }
  }, [onComplete])

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    if (scrollTop + clientHeight >= scrollHeight - 50) {
      setScrolledToBottom(true)
    }
  }

  const nextStep = () => {
    if (step === 'welcome') setStep('terms')
    else if (step === 'terms') setStep('policy')
  }

  const prevStep = () => {
    if (step === 'terms') setStep('welcome')
    else if (step === 'policy') setStep('terms')
  }

  const completeSetup = () => {
    localStorage.setItem('clerkk_setup_complete', 'true')
    setSetupComplete(true)
    onComplete()
  }

  if (setupComplete) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-app-bg p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl border border-app-border bg-app-surface shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-5 border-b border-app-border bg-app-surface2/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-indigo-500 text-white shadow-lg shadow-brand/30">
                <span className="text-xl font-bold">C</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-app-text">Welcome to Clerkk</h1>
                <p className="text-sm text-app-muted">Inventory Management & Barcode POS</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-app-faint">
              <span className={cn('px-2 py-0.5 rounded-full', step === 'welcome' && 'bg-brand/20 text-brand', step !== 'welcome' && 'bg-app-border text-app-muted')}>1</span>
              <ChevronRight className="h-3 w-3" />
              <span className={cn('px-2 py-0.5 rounded-full', step === 'terms' && 'bg-brand/20 text-brand', step !== 'terms' && 'bg-app-border text-app-muted')}>2</span>
              <ChevronRight className="h-3 w-3" />
              <span className={cn('px-2 py-0.5 rounded-full', step === 'policy' && 'bg-brand/20 text-brand', step !== 'policy' && 'bg-app-border text-app-muted')}>3</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Step 1: Welcome */}
          {step === 'welcome' && (
            <div className="space-y-6 animate-fade-in">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-app-text">Get Started</h2>
                <p className="mt-2 text-app-muted">
                  Before you begin, please review our terms and privacy policy.
                  This ensures you understand how Clerkk handles your data and device permissions.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <FeatureCard icon={<Camera className="h-6 w-6" />} title="Camera Access" desc="Required for barcode scanning at checkout" />
                <FeatureCard icon={<Shield className="h-6 w-6" />} title="Offline First" desc="All data stays on your device — no cloud" />
                <FeatureCard icon={<Printer className="h-6 w-6" />} title="Native Printing" desc="Print invoices via system print dialog" />
              </div>

              <div className="rounded-xl border border-app-border bg-app-surface2/50 p-4">
                <p className="text-sm text-app-muted">
                  <strong>Mirza Technologies</strong> — Created by <strong>Mirza Aman</strong>
                </p>
                <p className="mt-1 text-xs text-app-faint">Version 1.0.0 • MIT Licensed</p>
              </div>
            </div>
          )}

          {/* Step 2: Terms & Conditions */}
          {step === 'terms' && (
            <div className="space-y-4 animate-fade-in">
              <h2 className="text-xl font-bold text-app-text">Terms & Conditions</h2>
              <div
                ref={scrollRef}
                className="max-h-96 overflow-y-auto rounded-xl border border-app-border bg-app-surface2/30 p-4 prose prose-sm prose-invert max-w-none"
                onScroll={handleScroll}
                dangerouslySetInnerHTML={{ __html: TERMS_CONTENT }}
              />
              {!scrolledToBottom && (
                <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-brand/10 border border-brand/20">
                  <span className="text-sm text-brand">Scroll to read all terms →</span>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Privacy Policy */}
          {step === 'policy' && (
            <div className="space-y-4 animate-fade-in">
              <h2 className="text-xl font-bold text-app-text">Privacy Policy</h2>
              <div
                ref={scrollRef}
                className="max-h-96 overflow-y-auto rounded-xl border border-app-border bg-app-surface2/30 p-4 prose prose-sm prose-invert max-w-none"
                onScroll={handleScroll}
                dangerouslySetInnerHTML={{ __html: PRIVACY_POLICY }}
              />
              {!scrolledToBottom && (
                <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-brand/10 border border-brand/20">
                  <span className="text-sm text-brand">Scroll to read full policy →</span>
                </div>
              )}

              <div className="flex items-start gap-3 p-4 rounded-xl border border-app-border bg-app-surface2/50">
                <input
                  type="checkbox"
                  id="accept-policy"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  disabled={!scrolledToBottom}
                  className="mt-1 h-4 w-4 rounded border-app-border text-brand focus:ring-brand focus:ring-2"
                />
                <label htmlFor="accept-policy" className="text-sm text-app-text cursor-pointer">
                  <strong>I have read and agree to the Terms & Conditions and Privacy Policy</strong>
                  <br />
                  <span className="text-app-muted">
                    I understand that Clerkk requires camera access for barcode scanning and stores all data locally on my device.
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-app-border bg-app-surface2/50">
          <div className="flex items-center justify-between">
            <div className="text-xs text-app-faint">
              Step {step === 'welcome' ? 1 : step === 'terms' ? 2 : 3} of 3
            </div>
            <div className="flex gap-3">
              {step !== 'welcome' && (
                <Button variant="secondary" onClick={prevStep}>
                  Back
                </Button>
              )}
              {step === 'welcome' && (
                <Button onClick={nextStep}>
                  Continue
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              )}
              {step === 'terms' && (
                <Button onClick={nextStep}>
                  Continue
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              )}
              {step === 'policy' && (
                <Button
                  onClick={completeSetup}
                  disabled={!accepted || !scrolledToBottom}
                  className="w-full sm:w-auto"
                >
                  {accepted && scrolledToBottom ? (
                    <>
                      Complete Setup
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </>
                  ) : (
                    'Please read and accept to continue'
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-app-border bg-app-surface2/50 p-4 text-center">
      <div className="flex h-10 w-10 items-center justify-center mx-auto rounded-lg bg-brand/10 text-brand">
        {icon}
      </div>
      <h3 className="mt-3 font-medium text-app-text">{title}</h3>
      <p className="mt-1 text-xs text-app-muted">{desc}</p>
    </div>
  )
}